const cron = require("node-cron");
const Notification = require("../models/Notification");
const emailService = require("../services/emailService");

/**
 * Runs on REMINDER_CRON schedule. Finds "pending" notifications whose
 * scheduledFor time has arrived (appointment reminders, medication
 * reminders queued for the future) and sends them.
 */
function startReminderJob() {
  const schedule = process.env.REMINDER_CRON || "*/15 * * * *";
  cron.schedule(schedule, async () => {
    try {
      const due = await Notification.find({
        status: "pending",
        scheduledFor: { $lte: new Date() },
      }).limit(200);

      if (due.length === 0) return;
      console.log(`[reminderJob] Sending ${due.length} due notification(s)...`);
      for (const n of due) {
        await emailService.attemptSend(n);
      }
    } catch (err) {
      console.error("[reminderJob] error:", err.message);
    }
  });
  console.log(`Reminder job scheduled: ${schedule}`);
}

module.exports = startReminderJob;
