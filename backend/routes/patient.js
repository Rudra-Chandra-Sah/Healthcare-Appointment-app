const express = require("express");
const asyncHandler = require("express-async-handler");
const DoctorProfile = require("../models/DoctorProfile");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
const slotService = require("../services/slotService");
const calendarService = require("../services/calendarService");

const router = express.Router();
router.use(protect, authorize("patient"));

// @route  GET /api/patient/doctors?specialisation=Cardiology
router.get(
  "/doctors",
  asyncHandler(async (req, res) => {
    const filter = { isAcceptingPatients: true };
    if (req.query.specialisation) {
      filter.specialisation = new RegExp(req.query.specialisation, "i");
    }
    const doctors = await DoctorProfile.find(filter).populate("user", "name email phone");
    res.json(doctors);
  })
);

// @route  GET /api/patient/doctors/:profileId/slots?date=YYYY-MM-DD
router.get(
  "/doctors/:profileId/slots",
  asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (!date) {
      res.status(400);
      throw new Error("date query param is required (YYYY-MM-DD)");
    }
    const profile = await DoctorProfile.findById(req.params.profileId);
    if (!profile) {
      res.status(404);
      throw new Error("Doctor not found");
    }
    const slots = await slotService.getAvailableSlots(profile.user, profile, date);
    res.json({ date, doctorId: profile.user, slots });
  })
);

// @route  GET /api/patient/appointments
router.get(
  "/appointments",
  asyncHandler(async (req, res) => {
    const appts = await Appointment.find({ patient: req.user._id, status: { $ne: "hold" } })
      .populate("doctor", "name email")
      .sort({ date: -1 });
    res.json(appts);
  })
);

// @route  GET /api/patient/appointments/:id
router.get(
  "/appointments/:id",
  asyncHandler(async (req, res) => {
    const appt = await Appointment.findOne({ _id: req.params.id, patient: req.user._id }).populate("doctor", "name email");
    if (!appt) {
      res.status(404);
      throw new Error("Appointment not found");
    }
    res.json(appt);
  })
);

// @route  GET /api/patient/google/connect
// @desc   Returns Google OAuth consent URL
router.get(
  "/google/connect",
  asyncHandler(async (req, res) => {
    const url = calendarService.getAuthUrl(JSON.stringify({ userId: req.user._id.toString() }));
    res.json({ url });
  })
);

module.exports = router;
