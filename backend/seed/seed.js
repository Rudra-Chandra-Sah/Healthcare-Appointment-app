require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/User");
const DoctorProfile = require("../models/DoctorProfile");

async function seed() {
  await connectDB();

  const adminEmail = "admin@clinic.example.com";
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: "Clinic Admin",
      email: adminEmail,
      password: "Admin@123",
      role: "admin",
    });
    console.log(`Created admin: ${adminEmail} / Admin@123`);
  } else {
    console.log("Admin already exists, skipping.");
  }

  const doctorEmail = "dr.smith@clinic.example.com";
  let doctorUser = await User.findOne({ email: doctorEmail });
  if (!doctorUser) {
    doctorUser = await User.create({
      name: "Dr. Jane Smith",
      email: doctorEmail,
      password: "Doctor@123",
      role: "doctor",
      phone: "+1-555-0100",
    });
    await DoctorProfile.create({
      user: doctorUser._id,
      specialisation: "General Medicine",
      qualifications: "MBBS, MD",
      bio: "10+ years of experience in general and family medicine.",
      slotDurationMinutes: 30,
      consultationFee: 50,
    });
    console.log(`Created doctor: ${doctorEmail} / Doctor@123`);
  } else {
    console.log("Sample doctor already exists, skipping.");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
