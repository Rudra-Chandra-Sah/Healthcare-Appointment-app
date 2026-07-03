import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import client from "../../api/client";
import { StatusBadge, UrgencyBadge } from "../../components/StatusBadge";

const emptyMed = { medicine: "", dosage: "", frequencyPerDay: 1, durationDays: 5, instructions: "" };

export default function DoctorAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState(null);
  const [error, setError] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [prescription, setPrescription] = useState([{ ...emptyMed }]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    client.get(`/doctor/appointments/${id}`).then(({ data }) => setAppt(data)).catch((err) => setError(err.message));
  };
  useEffect(load, [id]);

  const updateMed = (i, field, value) => {
    const next = [...prescription];
    next[i] = { ...next[i], [field]: value };
    setPrescription(next);
  };

  const addMed = () => setPrescription([...prescription, { ...emptyMed }]);
  const removeMed = (i) => setPrescription(prescription.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await client.post(`/doctor/appointments/${id}/complete`, {
        clinicalNotes,
        prescription: prescription.filter((p) => p.medicine.trim()),
      });
      navigate("/doctor/appointments");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="container error-text">{error}</div>;
  if (!appt) return <div className="container muted">Loading...</div>;

  return (
    <div className="container">
      <Link to="/doctor/appointments" className="small">← Back to appointments</Link>
      <div className="pulse-line" />

      <div className="grid-2">
        <div>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2>{appt.patient?.name}</h2>
              <StatusBadge status={appt.status} />
            </div>
            <p className="muted">{appt.date} at {appt.startTime}</p>
            <p className="small muted">{appt.patient?.email} {appt.patient?.phone ? `· ${appt.patient.phone}` : ""}</p>
          </div>

          {appt.symptomForm?.symptoms && (
            <div className="card">
              <h3 style={{ fontSize: 16 }}>Patient-reported symptoms</h3>
              <p>{appt.symptomForm.symptoms}</p>
              <p className="small muted">
                Duration: {appt.symptomForm.durationDays ?? "—"} day(s) · Severity: {appt.symptomForm.severity || "—"}
              </p>
              {appt.symptomForm.additionalNotes && <p className="small muted">Notes: {appt.symptomForm.additionalNotes}</p>}
            </div>
          )}

          {appt.preVisitSummary?.chiefComplaint && (
            <div className="card" style={{ background: "var(--sage)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 16 }}>AI pre-visit summary</h3>
                <UrgencyBadge level={appt.preVisitSummary.urgencyLevel} />
              </div>
              <p><b>Chief complaint:</b> {appt.preVisitSummary.chiefComplaint}</p>
              {appt.preVisitSummary.suggestedQuestions?.length > 0 && (
                <>
                  <p className="small" style={{ fontWeight: 600, marginTop: 8 }}>Suggested questions:</p>
                  <ul className="small">{appt.preVisitSummary.suggestedQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </>
              )}
              {appt.preVisitSummary.failed && <p className="small muted">(AI summary generation had an issue — this is a fallback summary.)</p>}
            </div>
          )}
        </div>

        <div>
          {appt.status === "confirmed" ? (
            <form className="card" onSubmit={submit}>
              <h3>Complete visit</h3>
              <label>Clinical notes</label>
              <textarea value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} required placeholder="Diagnosis, observations, treatment plan..." />

              <label>Prescription</label>
              {prescription.map((p, i) => (
                <div key={i} className="card" style={{ padding: 12, marginBottom: 10 }}>
                  <input placeholder="Medicine" value={p.medicine} onChange={(e) => updateMed(i, "medicine", e.target.value)} />
                  <input placeholder="Dosage (e.g. 500mg)" value={p.dosage} onChange={(e) => updateMed(i, "dosage", e.target.value)} />
                  <div className="grid-2">
                    <div>
                      <label className="small">Times/day</label>
                      <input type="number" min="1" max="6" value={p.frequencyPerDay} onChange={(e) => updateMed(i, "frequencyPerDay", Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="small">Duration (days)</label>
                      <input type="number" min="1" value={p.durationDays} onChange={(e) => updateMed(i, "durationDays", Number(e.target.value))} />
                    </div>
                  </div>
                  <input placeholder="Instructions (e.g. after food)" value={p.instructions} onChange={(e) => updateMed(i, "instructions", e.target.value)} />
                  {prescription.length > 1 && <button type="button" className="btn btn-ghost" onClick={() => removeMed(i)}>Remove</button>}
                </div>
              ))}
              <button type="button" className="btn btn-secondary" onClick={addMed} style={{ marginBottom: 14 }}>+ Add medicine</button>

              {error && <div className="error-text">{error}</div>}
              <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Submitting..." : "Complete visit & generate summary"}</button>
            </form>
          ) : appt.status === "completed" ? (
            <div className="card">
              <h3>Post-visit summary (sent to patient)</h3>
              <p>{appt.postVisitSummary?.summaryText}</p>
            </div>
          ) : (
            <div className="empty-state">This appointment is {appt.status.replace(/_/g, " ")}.</div>
          )}
        </div>
      </div>
    </div>
  );
}
