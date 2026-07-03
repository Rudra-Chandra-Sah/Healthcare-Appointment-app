import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../api/client";
import { StatusBadge, UrgencyBadge } from "../../components/StatusBadge";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Schedule({ allDates }) {
  const [date, setDate] = useState(todayStr());
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    client
      .get("/doctor/appointments", { params: allDates ? {} : { date } })
      .then(({ data }) => setAppts(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [date, allDates]);

  return (
    <div className="container">
      <div className="hero" style={{ paddingTop: 8 }}>
        <div className="pulse-line" />
        <h1 style={{ fontSize: 26 }}>{allDates ? "All appointments" : "Today's schedule"}</h1>
      </div>
      {!allDates && (
        <div style={{ marginBottom: 16 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <p className="muted">Loading...</p>
      ) : appts.length === 0 ? (
        <div className="empty-state">No appointments{allDates ? "" : " for this date"}.</div>
      ) : (
        <div className="card">
          {appts.map((a) => (
            <div className="list-item" key={a._id}>
              <div>
                <b>{a.patient?.name}</b>
                <div className="muted small">{a.date} at {a.startTime}</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {a.preVisitSummary?.urgencyLevel && <UrgencyBadge level={a.preVisitSummary.urgencyLevel} />}
                <StatusBadge status={a.status} />
                <Link to={`/doctor/appointments/${a._id}`} className="btn btn-secondary" style={{ padding: "6px 12px" }}>
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
