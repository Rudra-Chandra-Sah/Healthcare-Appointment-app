const express = require("express");
const asyncHandler = require("express-async-handler");
const Appointment = require("../models/Appointment");
const DoctorProfile = require("../models/DoctorProfile");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
const llmService = require("../services/llmService");
const emailService = require("../services/emailService");
const calendarService = require("../services/calendarService");

const router = express.Router();
router.use(protect);

const HOLD_MINUTES = 5;

// @route  POST /api/appointments/hold
// @desc   Patient starts booking a slot. Atomic — relies on the partial
//         unique index on Appointment(doctor,date,startTime) so that if
//         two requests race for the same slot, MongoDB itself rejects the
//         second insert (duplicate key error 11000), which we translate
//         into a 409 Conflict for the client.
router.post(
  "/hold",
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const { doctorId, date, startTime } = req.body;
    if (!doctorId || !date || !startTime) {
      res.status(400);
      throw new Error("doctorId, date and startTime are required");
    }

    const profile = await DoctorProfile.findOne({ user: doctorId });
    if (!profile) {
      res.status(404);
      throw new Error("Doctor not found");
    }
    if (profile.leaveDays.some((l) => l.date === date)) {
      res.status(409);
      throw new Error("Doctor is on leave that day");
    }

    const startMin = require("../services/slotService").toMinutes(startTime);
    const endTime = require("../services/slotService").toHHMM(startMin + profile.slotDurationMinutes);

    try {
      const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
      const appt = await Appointment.create({
        doctor: doctorId,
        patient: req.user._id,
        date,
        startTime,
        endTime,
        status: "hold",
        holdExpiresAt,
      });
      res.status(201).json({ appointment: appt, holdExpiresAt, message: `Slot held for ${HOLD_MINUTES} minutes. Submit symptoms and confirm to finalize.` });
    } catch (err) {
      if (err.code === 11000) {
        res.status(409);
        throw new Error("This slot was just booked by someone else. Please choose another slot.");
      }
      throw err;
    }
  })
);

// @route  POST /api/appointments/:id/symptoms
// @desc   Patient submits symptom form; triggers LLM pre-visit summary.
router.post(
  "/:id/symptoms",
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const { symptoms, durationDays, severity, additionalNotes } = req.body;
    if (!symptoms) {
      res.status(400);
      throw new Error("symptoms field is required");
    }
    const appt = await Appointment.findOne({ _id: req.params.id, patient: req.user._id });
    if (!appt) {
      res.status(404);
      throw new Error("Appointment not found");
    }
    if (appt.status !== "hold" && appt.status !== "confirmed") {
      res.status(400);
      throw new Error("Cannot submit symptoms for a cancelled/completed appointment");
    }

    appt.symptomForm = { symptoms, durationDays, severity, additionalNotes, submittedAt: new Date() };
    // LLM failures are caught inside llmService and degrade to a mock
    // summary rather than throwing — booking must never break because of it.
    appt.preVisitSummary = await llmService.generatePreVisitSummary(symptoms);
    await appt.save();

    res.json({ appointment: appt });
  })
);

// @route  POST /api/appointments/:id/confirm
// @desc   Confirms a held slot: flips status, sends emails, creates
//         calendar events for patient + doctor.
router.post(
  "/:id/confirm",
  authorize("patient"),
  asyncHandler(async (req, res) => {
    const appt = await Appointment.findOne({ _id: req.params.id, patient: req.user._id }).populate("patient").populate("doctor");
    if (!appt) {
      res.status(404);
      throw new Error("Appointment not found");
    }
    if (appt.status !== "hold") {
      res.status(400);
      throw new Error(`Cannot confirm an appointment with status '${appt.status}'`);
    }
    if (appt.holdExpiresAt && appt.holdExpiresAt < new Date()) {
      res.status(410);
      throw new Error("Hold has expired. Please select a slot again.");
    }

    appt.status = "confirmed";
    appt.holdExpiresAt = undefined; // remove TTL field now that it's confirmed
    await appt.save();

    // Email confirmation to both sides (best-effort, queued + retried in background)
    const patientTpl = emailService.templates.bookingConfirmation(appt.patient.name, appt.doctor.name, appt.date, appt.startTime);
    await emailService.queueAndSend({
      type: "booking_confirmation",
      recipient: appt.patient._id,
      recipientEmail: appt.patient.email,
      appointment: appt._id,
      subject: patientTpl.subject,
      body: patientTpl.body,
    });
    const doctorTpl = emailService.templates.bookingConfirmation(appt.doctor.name, `patient ${appt.patient.name}`, appt.date, appt.startTime);
    await emailService.queueAndSend({
      type: "booking_confirmation",
      recipient: appt.doctor._id,
      recipientEmail: appt.doctor.email,
      appointment: appt._id,
      subject: doctorTpl.subject,
      body: doctorTpl.body,
    });

    // Schedule a reminder email 24h before the appointment
    const apptDateTime = new Date(`${appt.date}T${appt.startTime}:00`);
    const reminderTime = new Date(apptDateTime.getTime() - 24 * 60 * 60 * 1000);
    if (reminderTime > new Date()) {
      const reminderTpl = emailService.templates.appointmentReminder(appt.patient.name, appt.doctor.name, appt.date, appt.startTime);
      await emailService.queueAndSend({
        type: "appointment_reminder",
        recipient: appt.patient._id,
        recipientEmail: appt.patient.email,
        appointment: appt._id,
        subject: reminderTpl.subject,
        body: reminderTpl.body,
        scheduledFor: reminderTime,
      });
    }

    // Google Calendar events (best-effort; mocked unless GOOGLE_CALENDAR_MODE=live)
    const startISO = apptDateTime.toISOString();
    const endISO = new Date(apptDateTime.getTime() + 30 * 60 * 1000).toISOString();
    const patientEvent = await calendarService.createEvent(appt.patient, {
      summary: `Appointment with Dr. ${appt.doctor.name}`,
      description: "Healthcare appointment booked via Clinic Care platform.",
      startISO,
      endISO,
    });
    const doctorEvent = await calendarService.createEvent(appt.doctor, {
      summary: `Appointment with ${appt.patient.name}`,
      description: "Healthcare appointment booked via Clinic Care platform.",
      startISO,
      endISO,
    });
    appt.calendarEvents = {
      patientEventId: patientEvent.id,
      patientEventLink: patientEvent.link,
      doctorEventId: doctorEvent.id,
      doctorEventLink: doctorEvent.link,
    };
    await appt.save();

    res.json({ appointment: appt });
  })
);

// @route  POST /api/appointments/:id/cancel
router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const filter = { _id: req.params.id };
    if (req.user.role === "patient") filter.patient = req.user._id;
    if (req.user.role === "doctor") filter.doctor = req.user._id;

    const appt = await Appointment.findOne(filter).populate("patient").populate("doctor");
    if (!appt) {
      res.status(404);
      throw new Error("Appointment not found");
    }
    if (["cancelled", "completed", "doctor_leave_cancelled"].includes(appt.status)) {
      res.status(400);
      throw new Error(`Appointment already ${appt.status}`);
    }

    appt.status = "cancelled";
    appt.cancellationReason = reason;
    appt.cancelledBy = req.user.role;
    appt.holdExpiresAt = undefined;
    await appt.save();

    if (appt.calendarEvents?.patientEventId) {
      await calendarService.deleteEvent(appt.patient, appt.calendarEvents.patientEventId).catch(() => {});
    }
    if (appt.calendarEvents?.doctorEventId) {
      await calendarService.deleteEvent(appt.doctor, appt.calendarEvents.doctorEventId).catch(() => {});
    }

    const tpl = emailService.templates.cancellation(appt.patient.name, appt.doctor.name, appt.date, appt.startTime, reason);
    await emailService.queueAndSend({
      type: "cancellation",
      recipient: appt.patient._id,
      recipientEmail: appt.patient.email,
      appointment: appt._id,
      subject: tpl.subject,
      body: tpl.body,
    });

    res.json({ appointment: appt });
  })
);

module.exports = router;
