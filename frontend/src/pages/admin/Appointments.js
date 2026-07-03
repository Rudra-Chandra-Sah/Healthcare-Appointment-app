import React, { useEffect, useState } from "react";
import client from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";

export default function AdminAppointments() {
  const [appts, setAppts] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    client
      .get("/admin/appointments", { params: status ? { status } : {} })
      .then(({ data }) => setAppts(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [status]);

  return (
    <div className="container">
      <div className="hero" style={{ paddingTop: 8 }}>
        <div className="pulse-line" />
        <h1 style={{ fontSize: 26 }}>All appointments</h1>
      </div>

      <label>Filter by status</label>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 240 }}>
        <option value="">All</option>
        <option value="hold">Hold</option>
        <option value="confirmed">Confirmed</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
        <option value="doctor_leave_cancelled">Doctor leave cancelled</option>
      </select>

      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <p className="muted">Loading...</p>
      ) : appts.length === 0 ? (
        <div className="empty-state">No appointments found.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Date</th><th>Time</th><th>Doctor</th><th>Patient</th><th>Status</th></tr>
          </thead>
          <tbody>
            {appts.map((a) => (
              <tr key={a._id}>
                <td>{a.date}</td>
                <td>{a.startTime}</td>
                <td>Dr. {a.doctor?.name}</td>
                <td>{a.patient?.name}</td>
                <td><StatusBadge status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
