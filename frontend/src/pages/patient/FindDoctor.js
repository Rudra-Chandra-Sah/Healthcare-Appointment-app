import React, { useEffect, useState } from "react";
import client from "../../api/client";
import { useNavigate } from "react-router-dom";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function FindDoctor() {
  const [query, setQuery] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadDoctors = async (specialisation) => {
    setLoading(true);
    try {
      const { data } = await client.get("/patient/doctors", { params: specialisation ? { specialisation } : {} });
      setDoctors(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDoctors(); }, []);

  useEffect(() => {
    if (!selectedDoctor) return;
    setSlotsLoading(true);
    setSlots([]);
    client
      .get(`/patient/doctors/${selectedDoctor.user._id || selectedDoctor.user.id}/slots`, { params: { date } })
      .then(({ data }) => setSlots(data.slots))
      .catch((err) => setError(err.message))
      .finally(() => setSlotsLoading(false));
  }, [selectedDoctor, date]);

  const bookSlot = async (slot) => {
    setError("");
    try {
      const doctorId = selectedDoctor.user._id || selectedDoctor.user.id;
      const { data } = await client.post("/appointments/hold", { doctorId, date, startTime: slot.startTime });
      navigate(`/patient/book/${data.appointment._id}`);
    } catch (err) {
      setError(err.message);
      // Refresh slots since this one may now be taken
      const { data } = await client.get(`/patient/doctors/${selectedDoctor.user._id || selectedDoctor.user.id}/slots`, { params: { date } });
      setSlots(data.slots);
    }
  };

  return (
    <div className="container">
      <div className="hero" style={{ paddingTop: 8 }}>
        <div className="pulse-line" />
        <h1 style={{ fontSize: 26 }}>Find a doctor</h1>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <label>Search by specialisation</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input placeholder="e.g. Cardiology, General Medicine" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 0 }} />
          <button className="btn btn-primary" onClick={() => loadDoctors(query)}>Search</button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="grid-2">
        <div>
          {loading ? (
            <p className="muted">Loading doctors...</p>
          ) : doctors.length === 0 ? (
            <div className="empty-state">No doctors found for that search.</div>
          ) : (
            doctors.map((d) => (
              <div
                key={d._id}
                className="card"
                style={{ cursor: "pointer", borderColor: selectedDoctor?._id === d._id ? "var(--teal)" : undefined }}
                onClick={() => setSelectedDoctor(d)}
              >
                <h3 style={{ fontSize: 17 }}>Dr. {d.user.name}</h3>
                <p className="muted">{d.specialisation}{d.qualifications ? ` · ${d.qualifications}` : ""}</p>
                {d.bio && <p className="small muted">{d.bio}</p>}
                <p className="small muted">Consultation fee: ${d.consultationFee || 0} · {d.slotDurationMinutes} min slots</p>
              </div>
            ))
          )}
        </div>

        <div>
          {selectedDoctor ? (
            <div className="card">
              <h3>Book with Dr. {selectedDoctor.user.name}</h3>
              <label style={{ marginTop: 10 }}>Date</label>
              <input type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />
              {slotsLoading ? (
                <p className="muted">Loading slots...</p>
              ) : slots.length === 0 ? (
                <p className="muted">No slots available on this date (doctor may be off or on leave).</p>
              ) : (
                <div className="slot-grid">
                  {slots.map((s) => (
                    <button key={s.startTime} className="slot-btn" disabled={!s.available} onClick={() => bookSlot(s)}>
                      {s.startTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">Select a doctor to see available slots.</div>
          )}
        </div>
      </div>
    </div>
  );
}
