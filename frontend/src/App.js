import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import TopBar from "./components/TopBar";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CalendarConnect from "./pages/CalendarConnect";

import FindDoctor from "./pages/patient/FindDoctor";
import ConfirmBooking from "./pages/patient/ConfirmBooking";
import MyAppointments from "./pages/patient/MyAppointments";
import AppointmentDetail from "./pages/patient/AppointmentDetail";

import Schedule from "./pages/doctor/Schedule";
import DoctorAppointmentDetail from "./pages/doctor/AppointmentDetail";

import AdminDoctors from "./pages/admin/Doctors";
import AdminAppointments from "./pages/admin/Appointments";

import "./styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-shell">
          <TopBar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/calendar-connect" element={<CalendarConnect />} />

            {/* Patient portal */}
            <Route path="/patient" element={<ProtectedRoute role="patient"><FindDoctor /></ProtectedRoute>} />
            <Route path="/patient/book/:id" element={<ProtectedRoute role="patient"><ConfirmBooking /></ProtectedRoute>} />
            <Route path="/patient/appointments" element={<ProtectedRoute role="patient"><MyAppointments /></ProtectedRoute>} />
            <Route path="/patient/appointments/:id" element={<ProtectedRoute role="patient"><AppointmentDetail /></ProtectedRoute>} />

            {/* Doctor portal */}
            <Route path="/doctor" element={<ProtectedRoute role="doctor"><Schedule /></ProtectedRoute>} />
            <Route path="/doctor/appointments" element={<ProtectedRoute role="doctor"><Schedule allDates /></ProtectedRoute>} />
            <Route path="/doctor/appointments/:id" element={<ProtectedRoute role="doctor"><DoctorAppointmentDetail /></ProtectedRoute>} />

            {/* Admin portal */}
            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDoctors /></ProtectedRoute>} />
            <Route path="/admin/appointments" element={<ProtectedRoute role="admin"><AdminAppointments /></ProtectedRoute>} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
