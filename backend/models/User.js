const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["patient", "doctor", "admin"], required: true },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },

    // Patient-specific fields
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other", "prefer_not_to_say"] },

    // Google Calendar linkage (per-user OAuth tokens, patient or doctor)
    googleCalendar: {
      connected: { type: Boolean, default: false },
      refreshToken: { type: String, select: false },
      accessToken: { type: String, select: false },
      tokenExpiry: { type: Date },
      calendarId: { type: String, default: "primary" },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
