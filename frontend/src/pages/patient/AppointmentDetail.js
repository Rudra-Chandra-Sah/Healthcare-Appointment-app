import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";

export default function AppointmentDetail() {
  const { id } = useParams();
  const [appt, setAppt] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get(`/patient/appointments/${id}`)
      .then(({ data }) => setAppt(data))
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="container error-text">{error}</div>;
  if (!appt) return <div className="container muted">Loading...</div>;

  return (
    <div className="container narrow">
      <Link to="/patient/appointments" className="small">← Back to appointments</Link>
      <div className="pulse-line" />
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <h2>Visit with Dr. {appt.doctor?.name}</h2>
          <StatusBadge status={appt.status} />
        </div>
        <p className="muted">{appt.date} at {appt.startTime}</p>

        {appt.postVisitSummary?.summaryText && (
          <>
            <h3 style={{ fontSize: 16, marginTop: 20 }}>Summary of your visit</h3>
            <p>{appt.postVisitSummary.summaryText}</p>

            {appt.postVisitSummary.medicationSchedule?.length > 0 && (
              <>
                <h3 style={{ fontSize: 16, marginTop: 16 }}>Medication schedule</h3>
                <ul>{appt.postVisitSummary.medicationSchedule.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </>
            )}

            {appt.postVisitSummary.followUpSteps?.length > 0 && (
              <>
                <h3 style={{ fontSize: 16, marginTop: 16 }}>Follow-up steps</h3>
                <ul>{appt.postVisitSummary.followUpSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </>
            )}
          </>
        )}

        {!appt.postVisitSummary?.summaryText && <p className="muted">Summary not available yet.</p>}
      </div>
    </div>
  );
}
