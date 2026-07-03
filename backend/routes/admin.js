const express = require("express");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const DoctorProfile = require("../models/DoctorProfile");
const Appointment = require("../models/Appointment");
const { protect, authorize } = require("../middleware/auth");
const emailService = require("../services/emailService");
const calendarService = require("../services/calendarService");

const router = express.Router();
router.use(protect, authorize("admin"));

// @route  POST /api/admin/doctors
// @desc   Create a doctor account + profile
router.post(
  "/doctors",
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, specialisation, qualifications, bio, slotDurationMinutes, workingHours, consultationFee } = req.body;
    if (!name || !email || !password || !specialisation) {
      res.status(400);
      throw new Error("name, email, password and specialisation are required");
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      res.status(409);
      throw new Error("An account with this email already exists");
    }
    const user = await User.create({ name, email, password, phone, role: "doctor" });
    const profile = await DoctorProfile.create({
      user: user._id,
      specialisation,
      qualifications,
      bio,
      slotDurationMinutes: slotDurationMinutes || 30,
      workingHours,
      consultationFee,
    });
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email }, profile });
  })
);

// @route  GET /api/admin/doctors
router.get(
  "/doctors",
  asyncHandler(async (req, res) => {
    const profiles = await DoctorProfile.find().populate("user", "name email phone isActive");
    res.json(profiles);
  })
);

// @route  PUT /api/admin/doctors/:profileId
// @desc   Update doctor profile (specialisation, hours, slot duration, fee, active status)
router.put(
  "/doctors/:profileId",
  asyncHandler(async (req, res) => {
    const profile = await DoctorProfile.findById(req.params.profileId);
    if (!profile) {
      res.status(404);
      throw new Error("Doctor profile not found");
    }
    const fields = ["specialisation", "qualifications", "bio", "slotDurationMinutes", "workingHours", "consultationFee", "isAcceptingPatients"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) profile[f] = req.body[f];
    });
    await profile.save();
    res.json(profile);
  })
);

// @route  POST /api/admin/doctors/:profileId/leave
// @desc   Mark a doctor on leave for a date. Cancels affected appointments
//         and notifies patients by email + removes their calendar event.
router.post(
  "/doctors/:profileId/leave",
  asyncHandler(async (req, res) => {
    const { date, reason } = req.body; // date: "YYYY-MM-DD"
    if (!date) {
      res.status(400);
      throw new Error("date is required (YYYY-MM-DD)");
    }
    const profile = await DoctorProfile.findById(req.params.profileId).populate("user");
    if (!profile) {
      res.status(404);
      throw new Error("Doctor profile not found");
    }

    if (!profile.leaveDays.some((l) => l.date === date)) {
      profile.leaveDays.push({ date, reason });
      await profile.save();
    }

    // Find all affected hold/confirmed appointments on that date
    const affected = await Appointment.find({
      doctor: profile.user._id,
      date,
      status: { $in: ["hold", "confirmed"] },
    }).populate("patient");

    const results = [];
    for (const appt of affected) {
      appt.status = "doctor_leave_cancelled";
      appt.cancellationReason = reason || "Doctor unavailable";
      appt.cancelledBy = "admin";
      await appt.save();

      // Best-effort calendar cleanup — never let this block the cancellation
      if (appt.calendarEvents?.patientEventId) {
        await calendarService.deleteEvent(appt.patient, appt.calendarEvents.patientEventId).catch(() => {});
      }
      if (appt.calendarEvents?.doctorEventId) {
        await calendarService.deleteEvent(profile.user, appt.calendarEvents.doctorEventId).catch(() => {});
      }

      const tpl = emailService.templates.doctorLeaveNotice(appt.patient.name, profile.user.name, appt.date, appt.startTime);
      await emailService.queueAndSend({
        type: "doctor_leave_notice",
        recipient: appt.patient._id,
        recipientEmail: appt.patient.email,
        appointment: appt._id,
        subject: tpl.subject,
        body: tpl.body,
      });

      results.push({ appointmentId: appt._id, patientEmail: appt.patient.email, notified: true });
    }

    res.json({ message: `Doctor marked on leave for ${date}`, affectedAppointments: results.length, details: results });
  })
);

// @route  GET /api/admin/appointments
router.get(
  "/appointments",
  asyncHandler(async (req, res) => {
    const { date, doctorId, status } = req.query;
    const filter = {};
    if (date) filter.date = date;
    if (doctorId) filter.doctor = doctorId;
    if (status) filter.status = status;
    const appts = await Appointment.find(filter).populate("doctor", "name email").populate("patient", "name email").sort({ date: -1 });
    res.json(appts);
  })
);

module.exports = router;
