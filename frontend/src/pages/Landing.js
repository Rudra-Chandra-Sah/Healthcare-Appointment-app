import React from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="container">
      <div className="hero">
        <div className="pulse-line" />
        <h1>Care coordinated before, during, and after every visit.</h1>
        <p>
          Book appointments in a few clicks, tell your doctor what's going on before you arrive,
          and get a plain-language summary afterward — with reminders that keep you on track.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <Link to="/register" className="btn btn-primary">Book an appointment</Link>
          <Link to="/login" className="btn btn-ghost">Log in</Link>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 40 }}>
        <div className="card">
          <h3>For patients</h3>
          <p className="muted">Search doctors by specialisation, pick an open slot, share your symptoms in advance, and get a visit summary you'll actually understand.</p>
        </div>
        <div className="card">
          <h3>For doctors</h3>
          <p className="muted">Walk into every visit with an AI-prepared symptom summary and urgency flag, then wrap up with notes that turn into patient-friendly guidance automatically.</p>
        </div>
      </div>
    </div>
  );
}
