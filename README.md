# 🏥 Healthcare Appointment System

A full-stack Healthcare Appointment Management System that enables patients to book appointments, doctors to manage consultations, and administrators to oversee the entire platform.

## 📌 Features

### 👨‍⚕️ Patient
- User Registration & Login
- Book Appointments
- View Appointment History
- Receive Email Notifications
- Google Calendar Integration
- View Prescriptions

### 🩺 Doctor
- Doctor Dashboard
- Manage Appointments
- Generate AI-based Pre-Visit Summary
- Add Diagnosis & Prescription
- Generate Patient-Friendly Visit Summary

### 👨‍💼 Admin
- Manage Doctors
- Manage Patients
- View All Appointments
- Doctor Leave Management
- Dashboard & Analytics

---

# 🚀 Technologies Used

### Frontend
- React.js
- Bootstrap
- Axios

### Backend
- Node.js
- Express.js

### Database
- MongoDB

### APIs & Services
- Google Calendar API
- Nodemailer
- Anthropic Claude API

### Authentication
- JWT Authentication
- OAuth 2.0

---

# 📂 Project Structure

```
healthcare-app/
│
├── backend/
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   ├── jobs/
│   └── server.js
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── context/
│
├── docs/
└── README.md
```

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/Rudra-Chandra-Sah/Healthcare-Appointment-app.git
```

## Backend Setup

```bash
cd backend
npm install
npm run dev
```

## Frontend Setup

```bash
cd frontend
npm install
npm start
```

---

# 🔐 Environment Variables

Create a `.env` file inside the backend folder.

```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key

LLM_MODE=mock

EMAIL_MODE=mock

GOOGLE_CALENDAR_MODE=mock
```

To use live services, configure:

```env
ANTHROPIC_API_KEY=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

---

# 📖 API Modules

- Authentication
- Patient
- Doctor
- Admin
- Appointment
- Google Calendar

---

# 📸 Screenshots

> Add screenshots of:
- Login Page
- Patient Dashboard
- Doctor Dashboard
- Admin Dashboard
- Appointment Booking

---

# 🎯 Future Enhancements

- Online Payment Gateway
- Video Consultation
- SMS Notifications
- Electronic Health Records (EHR)
- Multi-language Support

---

# 👨‍💻 Author

**Rudra Chandra Sah**

GitHub: https://github.com/Rudra-Chandra-Sah

---

# 📜 License

This project is developed for educational purposes.