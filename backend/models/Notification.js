const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "booking_confirmation",
        "appointment_reminder",
        "cancellation",
        "doctor_leave_notice",
        "medication_reminder",
        "post_visit_summary_ready",
      ],
      required: true,
    },
    channel: { type: String, enum: ["email"], default: "email" },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientEmail: { type: String, required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "abandoned"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    scheduledFor: { type: Date, default: Date.now }, // for reminders sent in the future
    sentAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ status: 1, scheduledFor: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
