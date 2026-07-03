import React, { useEffect, useState } from "react";
import client from "../../api/client";

const emptyForm = {
  name: "", email: "", password: "", phone: "", specialisation: "", qualifications: "", bio: "",
  slotDurationMinutes: 30, consultationFee: 0,
};

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaveDate, setLeaveDate] = useState({});

  const load = () => client.get("/admin/doctors").then(({ data }) => setDoctors(data)).catch((err) => setError(err.message));
  useEffect(load, []);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setBusy(true);
    try {
      await client.post("/admin/doctors", form);
      setSuccess(`Doctor account created for ${form.name}.`);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const markLeave = async (profileId) => {
    const date = leaveDate[profileId];
    if (!date) return;
    setError(""); setSuccess("");
    try {
      const { data } = await client.post(`/admin/doctors/${profileId}/leave`, { date, reason: "Doctor unavailable" });
      setSuccess(`Marked on leave for ${date}. ${data.affectedAppointments} patient(s) notified.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <div className="hero" style={{ paddingTop: 8 }}>
        <div className="pulse-line" />
        <h1 style={{ fontSize: 26 }}>Manage doctors</h1>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={submit}>
          <h3>Add a doctor</h3>
          <label>Full name</label>
          <input value={form.name} onChange={update("name")} required />
          <label>Email</label>
          <input type="email" value={form.email} onChange={update("email")} required />
          <label>Temporary password</label>
          <input type="password" value={form.password} onChange={update("password")} required minLength={6} />
          <label>Phone</label>
          <input value={form.phone} onChange={update("phone")} />
          <label>Specialisation</label>
          <input value={form.specialisation} onChange={update("specialisation")} required />
          <label>Qualifications</label>
          <input value={form.qualifications} onChange={update("qualifications")} />
          <label>Bio</label>
          <textarea value={form.bio} onChange={update("bio")} />
          <div className="grid-2">
            <div>
              <label>Slot duration (min)</label>
              <input type="number" value={form.slotDurationMinutes} onChange={update("slotDurationMinutes")} />
            </div>
            <div>
              <label>Consultation fee ($)</label>
              <input type="number" value={form.consultationFee} onChange={update("consultationFee")} />
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          {success && <div className="success-text" style={{ marginBottom: 12 }}>{success}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Creating..." : "Create doctor account"}</button>
        </form>

        <div>
          {doctors.map((d) => (
            <div className="card" key={d._id}>
              <h3 style={{ fontSize: 16 }}>Dr. {d.user?.name}</h3>
              <p className="muted small">{d.specialisation} · {d.slotDurationMinutes} min slots · ${d.consultationFee}</p>
              {d.leaveDays?.length > 0 && (
                <p className="small muted">On leave: {d.leaveDays.map((l) => l.date).join(", ")}</p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input
                  type="date"
                  style={{ marginBottom: 0 }}
                  value={leaveDate[d._id] || ""}
                  onChange={(e) => setLeaveDate({ ...leaveDate, [d._id]: e.target.value })}
                />
                <button className="btn btn-coral" onClick={() => markLeave(d._id)}>Mark on leave</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
