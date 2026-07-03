import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const home = user?.role === "admin" ? "/admin" : user?.role === "doctor" ? "/doctor" : "/patient";

  return (
    <div className="topbar">
      <Link to={user ? home : "/"} className="brand">
        <span className="brand-mark">+</span> Clinic Care
      </Link>
      <div className="nav-links">
        {user ? (
          <>
            {user.role === "patient" && (
              <>
                <Link to="/patient">Find a Doctor</Link>
                <Link to="/patient/appointments">My Appointments</Link>
              </>
            )}
            {user.role === "doctor" && (
              <>
                <Link to="/doctor">Today's Schedule</Link>
                <Link to="/doctor/appointments">All Appointments</Link>
              </>
            )}
            {user.role === "admin" && (
              <>
                <Link to="/admin">Doctors</Link>
                <Link to="/admin/appointments">Appointments</Link>
              </>
            )}
            <span className="role-pill">{user.role}</span>
            <button onClick={() => { logout(); navigate("/"); }}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register" className="btn btn-primary" style={{ padding: "8px 14px" }}>Sign up</Link>
          </>
        )}
      </div>
    </div>
  );
}
