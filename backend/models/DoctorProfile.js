const mongoose = require("mongoose");

// working hours per weekday (0=Sun..6=Sat). Each day can have a start/end
// or be marked unavailable entirely.
const workingHourSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    isWorking: { type: Boolean, default: true },
    startTime: { type: String, default: "09:00" }, // "HH:mm" 24h
    endTime: { type: String, default: "17:00" },
  },
  { _id: false }
);

const doctorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    specialisation: { type: String, required: true, trim: true, index: true },
    qualifications: { type: String, trim: true },
    bio: { type: String, trim: true },
    slotDurationMinutes: { type: Number, required: true, default: 30 },
    workingHours: { type: [workingHourSchema], default: () => defaultWorkingHours() },
    // Explicit leave days (single dates). For date-range leave, expand into
    // individual dates when created so conflict lookups stay O(1) per date.
    leaveDays: [
      {
        date: { type: String, required: true }, // "YYYY-MM-DD"
        reason: { type: String, trim: true },
      },
    ],
    consultationFee: { type: Number, default: 0 },
    isAcceptingPatients: { type: Boolean, default: true },
  },
  { timestamps: true }
);

function defaultWorkingHours() {
  return [1, 2, 3, 4, 5].map((day) => ({ day, isWorking: true, startTime: "09:00", endTime: "17:00" }))
    .concat([0, 6].map((day) => ({ day, isWorking: false, startTime: "09:00", endTime: "17:00" })));
}

doctorProfileSchema.index({ "leaveDays.date": 1 });

module.exports = mongoose.model("DoctorProfile", doctorProfileSchema);
