import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../../api/client";

export default function ConfirmBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [severity, setSeverity] = useState("mild");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [step, setStep] = useState("symptoms"); // symptoms -> review -> done
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!appt?.holdExpiresAt) return;
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(appt.holdExpiresAt) - new Date()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [appt]);

  const submitSymptoms = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await client.post(`/appointments/${id}/symptoms`, {
        symptoms,
        durationDays: durationDays ? Number(durationDays) : undefined,
        severity,
        additionalNotes,
      });
      setAppt(data.appointment);
      setStep("review");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmBooking = async () => {
    setError("");
    setBusy(true);
    try {
      const { data } = await client.post(`/appointments/${id}/confirm`);
      setAppt(data.appointment);
      setStep("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="pulse-line" />
      {step === "symptoms" && (
        <div className="card">
          <h2>Tell us what's going on</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            {secondsLeft !== null && secondsLeft > 0
              ? `Your slot is held for ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} more.`
              : "Your slot is held for a few minutes while you fill this in."}
          </p>
          <form onSubmit={submitSymptoms}>
            <label>Symptoms</label>
            <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} required placeholder="e.g. persistent cough and mild fever for 3 days" />
            <label>How many days have you had these symptoms?</label>
            <input type="number" min="0" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            <label>Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
            <label>Anything else the doctor should know?</label>
            <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} />
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Analyzing symptoms..." : "Continue"}</button>
          </form>
        </div>
      )}

      {step === "review" && appt && (
        <div className="card">
          <h2>Review & confirm</h2>
          <p className="muted">Date: {appt.date} at {appt.startTime}</p>
          {appt.preVisitSummary && (
            <div className="card" style={{ background: "var(--sage)", marginTop: 12 }}>
              <p className="small muted" style={{ marginBottom: 6 }}>AI pre-visit note for your doctor:</p>
              <p style={{ fontSize: 14 }}>{appt.preVisitSummary.chiefComplaint}</p>
            </div>
          )}
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy} onClick={confirmBooking}>
            {busy ? "Confirming..." : "Confirm appointment"}
          </button>
        </div>
      )}

      {step === "done" && appt && (
        <div className="card">
          <h2>You're booked ✓</h2>
          <p className="muted">Appointment confirmed for <b>{appt.date} at {appt.startTime}</b>. A confirmation email and calendar invite are on their way.</p>
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={() => navigate("/patient/appointments")}>
            Go to my appointments
          </button>
        </div>
      )}
    </div>
  );
}
