import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "admin" ? "/admin" : user.role === "doctor" ? "/doctor" : "/patient");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <div className="card">
        <h2>Log in</h2>
        <p className="muted" style={{ marginBottom: 18 }}>Welcome back to Clinic Care.</p>
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          New patient? <Link to="/register">Create an account</Link>
        </p>
        <p className="small muted" style={{ marginTop: 10 }}>
          Doctor and admin accounts are created by the clinic admin. Seeded demo admin: admin@clinic.example.com / Admin@123
        </p>
      </div>
    </div>
  );
}
