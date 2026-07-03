const express = require("express");
const asyncHandler = require("express-async-handler");
const Appointment = require("../models/Appointment");
const DoctorProfile = require("../models/DoctorProfile");
const { protect, authorize } = require("../middleware/auth");
const llmService = require("../services/llmService");
const emailService = require("../services/emailService");

const router = express.Router();
router.use(protect, authorize("doctor"));

// @route  GET /api/doctor/profile
router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const profile = await DoctorProfile.findOne({ user: req.user._id });
    res.json(profile);
  })
);

// @route  PUT /api/doctor/profile
// @desc   Doctor can update their own bio/qualifications/leave (not specialisation/fee - admin controlled)
router.put(
  "/profile",
  asyncHandler(async (req, res) => {
    const profile = await DoctorProfile.findOne({ user: req.user._id });
    if (!profile) {
      res.status(404);
      throw new Error("Profile not found");
    }
    ["bio", "qualifications", "isAcceptingPatients"].forEach((f) => {
      if (req.body[f] !== undefined) profile[f] = req.body[f];
    });
    await profile.save();
    res.json(profile);
  })
);

// @route  GET /api/doctor/appointments?date=YYYY-MM-DD
router.get(
  "/appointments",
  asyncHandler(async (req, res) => {
    const filter = { doctor: req.user._id, status: { $ne: "hold" } };
    if (req.query.date) filter.date = req.query.date;
    const appts = await Appointment.find(filter).populate("patient", "name email phone dateOfBirth gender").sort({ date: 1, startTime: 1 });
    res.json(appts);
  })
);

// @route  GET /api/doctor/appointments/:id
// @desc   Fetch a single appointment including the AI pre-visit summary
router.get(
  "/appointments/:id",
  asyncHandler(async (req, res) => {
    const appt = await Appointment.findOne({ _id: req.params.id, doctor: req.user._id }).populate("patient", "name email phone dateOfBirth gender");
    if (!appt) {
      res.status(404);
      throw new Error("Appointment not found");
    }
    res.json(appt);
  })
);

// @route  POST /api/doctor/appointments/:id/complete
// @desc   Doctor submits clinical notes + prescription. Generates a
//         patient-friendly LLM summary and schedules medication reminders.
router.post(
  "/appointments/:id/complete",
  asyncHandler(async (req, res) => {
    const { clinicalNotes, prescription } = req.body; // prescription: [{medicine,dosage,frequencyPerDay,durationDays,instructions}]
    if (!clinicalNotes) {
      res.status(400);
      throw new Error("clinicalNotes is required");
    }
    const appt = await Appointment.findOne({ _id: req.params.id, doctor: req.user._id }).populate("patient").populate("doctor");
    if (!appt) {
      res.status(404);
      throw new Error("Appointment not found");
    }
    if (appt.status !== "confirmed") {
      res.status(400);
      throw new Error(`Cannot complete an appointment with status '${appt.status}'`);
    }

    appt.postVisit = { clinicalNotes, prescription: prescription || [], submittedAt: new Date() };
    appt.postVisitSummary = await llmService.generatePostVisitSummary(clinicalNotes, prescription || []);
    appt.status = "completed";
    await appt.save();

    // Notify patient the summary is ready
    const tpl = emailService.templates.postVisitSummaryReady(appt.patient.name, appt.doctor.name);
    await emailService.queueAndSend({
      type: "post_visit_summary_ready",
      recipient: appt.patient._id,
      recipientEmail: appt.patient.email,
      appointment: appt._id,
      subject: tpl.subject,
      body: tpl.body,
    });

    // Schedule medication reminders based on prescription frequency.
    // Simple model: for each medicine, send N reminders/day (spread across
    // waking hours) for durationDays, starting the day after the visit.
    for (const med of prescription || []) {
      const timesPerDay = Math.max(1, Math.min(6, med.frequencyPerDay || 1));
      const wakingStart = 8; // 08:00
      const wakingEnd = 22; // 22:00
      const interval = (wakingEnd - wakingStart) / timesPerDay;

      for (let day = 0; day < (med.durationDays || 1); day++) {
        for (let dose = 0; dose < timesPerDay; dose++) {
          const scheduledFor = new Date();
          scheduledFor.setDate(scheduledFor.getDate() + day + 1);
          scheduledFor.setHours(Math.floor(wakingStart + dose * interval), 0, 0, 0);

          const medTpl = emailService.templates.medicationReminder(appt.patient.name, med.medicine, med.dosage);
          await emailService.queueAndSend({
            type: "medication_reminder",
            recipient: appt.patient._id,
            recipientEmail: appt.patient.email,
            appointment: appt._id,
            subject: medTpl.subject,
            body: medTpl.body,
            scheduledFor,
          });
        }
      }
    }

    res.json({ appointment: appt });
  })
);

module.exports = router;
