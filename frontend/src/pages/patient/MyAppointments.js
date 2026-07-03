import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";

export default function MyAppointments() {
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    client
      .get("/patient/appointments")
      .then(({ data }) => setAppts(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const cancel = async (id) => {
    if (!window.confirm("Cancel this appointment?")) return;
    try {
      await client.post(`/appointments/${id}/cancel`, { reason: "Cancelled by patient" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <div className="hero" style={{ paddingTop: 8 }}>
        <div className="pulse-line" />
        <h1 style={{ fontSize: 26 }}>My appointments</h1>
      </div>
      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <p className="muted">Loading...</p>
      ) : appts.length === 0 ? (
        <div className="empty-state">
          No appointments yet. <Link to="/patient">Find a doctor</Link> to book one.
        </div>
      ) : (
        <div className="card">
          {appts.map((a) => (
            <div className="list-item" key={a._id}>
              <div>
                <b>Dr. {a.doctor?.name}</b>
                <div className="muted small">{a.date} at {a.startTime}</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <StatusBadge status={a.status} />
                {a.status === "completed" && (
                  <Link to={`/patient/appointments/${a._id}`} className="btn btn-secondary" style={{ padding: "6px 12px" }}>
                    View summary
                  </Link>
                )}
                {(a.status === "confirmed") && (
                  <button className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => cancel(a._id)}>Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
