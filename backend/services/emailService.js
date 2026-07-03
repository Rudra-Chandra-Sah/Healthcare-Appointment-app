const nodemailer = require("nodemailer");
const Notification = require("../models/Notification");

const isLive = () => process.env.EMAIL_MODE === "live";

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;

  if (process.env.EMAIL_PROVIDER === "sendgrid") {
    transporter = nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      auth: { user: "apikey", pass: process.env.SENDGRID_API_KEY },
    });
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Queues a notification row (status "pending") and attempts immediate send.
 * If it fails, it stays "pending"/"failed" with attempts tracked so the
 * background retry job (jobs/emailRetryJob.js) can pick it up later.
 * This decouples "user-facing request succeeded" from "email definitely
 * sent" — booking/cancellation flows never block or fail on email issues.
 */
async function queueAndSend({ type, recipient, recipientEmail, appointment, subject, body, scheduledFor }) {
  const notification = await Notification.create({
    type,
    recipient,
    recipientEmail,
    appointment,
    subject,
    body,
    scheduledFor: scheduledFor || new Date(),
    status: "pending",
  });

  // If scheduled for the future (e.g. a reminder), leave it pending for the
  // cron job to pick up at the right time.
  if (scheduledFor && scheduledFor > new Date()) {
    return notification;
  }

  await attemptSend(notification);
  return notification;
}

async function attemptSend(notification) {
  notification.attempts += 1;
  try {
    if (!isLive()) {
      // MOCK MODE: log instead of actually sending over SMTP.
      console.log(`\n[MOCK EMAIL] To: ${notification.recipientEmail}\nSubject: ${notification.subject}\n${notification.body}\n`);
    } else {
      await getTransporter().sendMail({
        from: process.env.EMAIL_FROM,
        to: notification.recipientEmail,
        subject: notification.subject,
        html: notification.body,
      });
    }
    notification.status = "sent";
    notification.sentAt = new Date();
    notification.lastError = undefined;
  } catch (err) {
    notification.status = "failed";
    notification.lastError = err.message;
    console.error(`Email send failed (attempt ${notification.attempts}) to ${notification.recipientEmail}: ${err.message}`);
  }
  await notification.save();
  return notification;
}

// --- Templates ---

const templates = {
  bookingConfirmation: (name, doctorName, date, time) => ({
    subject: "Appointment Confirmed",
    body: `<p>Hi ${name},</p><p>Your appointment with Dr. ${doctorName} is confirmed for <b>${date} at ${time}</b>.</p><p>You'll receive a reminder before your visit. If you need to reschedule, please do so from your patient portal.</p>`,
  }),
  appointmentReminder: (name, doctorName, date, time) => ({
    subject: "Appointment Reminder",
    body: `<p>Hi ${name},</p><p>This is a reminder of your upcoming appointment with Dr. ${doctorName} on <b>${date} at ${time}</b>.</p>`,
  }),
  cancellation: (name, doctorName, date, time, reason) => ({
    subject: "Appointment Cancelled",
    body: `<p>Hi ${name},</p><p>Your appointment with Dr. ${doctorName} on <b>${date} at ${time}</b> has been cancelled.${reason ? ` Reason: ${reason}` : ""}</p><p>Please book a new slot at your convenience.</p>`,
  }),
  doctorLeaveNotice: (name, doctorName, date, time) => ({
    subject: "Your Appointment Needs Rescheduling",
    body: `<p>Hi ${name},</p><p>Dr. ${doctorName} is unavailable on <b>${date}</b> and your <b>${time}</b> appointment has been cancelled as a result. We're sorry for the inconvenience — please rebook a new slot from your portal.</p>`,
  }),
  medicationReminder: (name, medicine, dosage) => ({
    subject: "Medication Reminder",
    body: `<p>Hi ${name},</p><p>Reminder to take your medication: <b>${medicine}</b> (${dosage}).</p>`,
  }),
  postVisitSummaryReady: (name, doctorName) => ({
    subject: "Your Visit Summary is Ready",
    body: `<p>Hi ${name},</p><p>Dr. ${doctorName} has shared a summary and next steps from your recent visit. Log in to your patient portal to view it.</p>`,
  }),
};

module.exports = { queueAndSend, attemptSend, templates };
