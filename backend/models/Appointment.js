const mongoose = require("mongoose");

/**
 * Double-booking prevention strategy (see SYSTEM_DESIGN.md for full write-up):
 *
 * 1. A booking first inserts a document with status "hold" for
 *    (doctor, date, startTime). A partial unique index below guarantees
 *    MongoDB itself rejects a second hold/confirmed doc for the same
 *    (doctor, date, startTime) — this is atomic at the DB layer, so two
 *    simultaneous requests cannot both succeed even under a race condition.
 * 2. The hold has a `holdExpiresAt` (TTL index) — if the patient does not
 *    confirm within HOLD_MINUTES, MongoDB automatically deletes the hold
 *    document, freeing the slot again.
 * 3. Confirming payment/details flips status "hold" -> "confirmed" and
 *    unsets holdExpiresAt (so the TTL no longer applies).
 */

const appointmentSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    date: { type: String, required: true }, // "YYYY-MM-DD" (clinic-local date)
    startTime: { type: String, required: true }, // "HH:mm"
    endTime: { type: String, required: true },

    status: {
      type: String,
      enum: ["hold", "confirmed", "cancelled", "completed", "no_show", "doctor_leave_cancelled"],
      default: "hold",
    },

    // TTL field: only present while status === "hold"
    holdExpiresAt: { type: Date },

    // Pre-visit symptom intake
    symptomForm: {
      symptoms: { type: String },
      durationDays: { type: Number },
      severity: { type: String, enum: ["mild", "moderate", "severe"] },
      additionalNotes: { type: String },
      submittedAt: { type: Date },
    },

    // LLM-generated pre-visit summary for the doctor
    preVisitSummary: {
      urgencyLevel: { type: String, enum: ["Low", "Medium", "High"] },
      chiefComplaint: { type: String },
      suggestedQuestions: [{ type: String }],
      generatedAt: { type: Date },
      raw: { type: String },
      failed: { type: Boolean, default: false },
    },

    // Doctor's post-visit clinical notes + prescription
    postVisit: {
      clinicalNotes: { type: String },
      prescription: [
        {
          medicine: String,
          dosage: String,
          frequencyPerDay: Number,
          durationDays: Number,
          instructions: String,
        },
      ],
      submittedAt: { type: Date },
    },

    // LLM-generated patient-friendly summary
    postVisitSummary: {
      summaryText: { type: String },
      medicationSchedule: [{ type: String }],
      followUpSteps: [{ type: String }],
      generatedAt: { type: Date },
      raw: { type: String },
      failed: { type: Boolean, default: false },
    },

    // Google Calendar linkage
    calendarEvents: {
      patientEventId: { type: String },
      doctorEventId: { type: String },
      patientEventLink: { type: String },
      doctorEventLink: { type: String },
    },

    cancellationReason: { type: String },
    cancelledBy: { type: String, enum: ["patient", "doctor", "admin", "system"] },
  },
  { timestamps: true }
);

// Core anti-double-booking constraint: only one hold/confirmed doc per
// doctor+date+startTime combination.
appointmentSchema.index(
  { doctor: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["hold", "confirmed"] } },
  }
);

// TTL: MongoDB background task removes expired holds automatically.
appointmentSchema.index({ holdExpiresAt: 1 }, { expireAfterSeconds: 0 });

appointmentSchema.index({ patient: 1, date: -1 });
appointmentSchema.index({ doctor: 1, date: -1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
