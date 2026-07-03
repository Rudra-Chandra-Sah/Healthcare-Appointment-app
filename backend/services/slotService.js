const Appointment = require("../models/Appointment");

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function toHHMM(mins) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Returns array of { startTime, endTime, available } for a doctor on a
 * given date, taking into account working hours, leave days, and already
 * held/confirmed appointments.
 */
async function getAvailableSlots(doctorUserId, doctorProfile, dateStr) {
  const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  const dayConfig = doctorProfile.workingHours.find((w) => w.day === dayOfWeek);

  const onLeave = doctorProfile.leaveDays.some((l) => l.date === dateStr);
  if (onLeave || !dayConfig || !dayConfig.isWorking) {
    return [];
  }

  const startMin = toMinutes(dayConfig.startTime);
  const endMin = toMinutes(dayConfig.endTime);
  const duration = doctorProfile.slotDurationMinutes;

  const slots = [];
  for (let t = startMin; t + duration <= endMin; t += duration) {
    slots.push({ startTime: toHHMM(t), endTime: toHHMM(t + duration) });
  }

  // Pull existing hold/confirmed appointments for that doctor+date in one query
  const booked = await Appointment.find({
    doctor: doctorUserId,
    date: dateStr,
    status: { $in: ["hold", "confirmed"] },
  }).select("startTime");

  const bookedSet = new Set(booked.map((b) => b.startTime));

  return slots.map((s) => ({ ...s, available: !bookedSet.has(s.startTime) }));
}

module.exports = { getAvailableSlots, toMinutes, toHHMM };
