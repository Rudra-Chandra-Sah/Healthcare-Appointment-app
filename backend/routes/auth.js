const express = require("express");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const DoctorProfile = require("../models/DoctorProfile");
const { protect } = require("../middleware/auth");

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const sanitize = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  googleCalendarConnected: user.googleCalendar?.connected || false,
});

// @route  POST /api/auth/register
// @desc   Register a patient (doctors are created by admin only)
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, dateOfBirth, gender } = req.body;
    if (!name || !email || !password) {
      res.status(400);
      throw new Error("Name, email and password are required");
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      res.status(409);
      throw new Error("An account with this email already exists");
    }
    const user = await User.create({
      name,
      email,
      password,
      phone,
      dateOfBirth,
      gender,
      role: "patient",
    });
    res.status(201).json({ user: sanitize(user), token: signToken(user) });
  })
);

// @route  POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400);
      throw new Error("Email and password are required");
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      res.status(401);
      throw new Error("Invalid email or password");
    }
    if (!user.isActive) {
      res.status(403);
      throw new Error("This account has been deactivated. Contact the clinic admin.");
    }
    res.json({ user: sanitize(user), token: signToken(user) });
  })
);

// @route  GET /api/auth/me
router.get(
  "/me",
  protect,
  asyncHandler(async (req, res) => {
    let extra = {};
    if (req.user.role === "doctor") {
      extra.doctorProfile = await DoctorProfile.findOne({ user: req.user._id });
    }
    res.json({ user: sanitize(req.user), ...extra });
  })
);

module.exports = router;
