const express = require("express");
const cors = require("cors");
const app = express();
const connectDB = require("./db");
const userRoutes = require("./routes/user");
const patientRoutes = require("./routes/patient");
const doctorRoutes = require("./routes/doctor");
const appointmentRoutes = require("./routes/appointment");
const ensureAdmin = require("./utils/ensureAdmin");
require("dotenv").config();

// Connect to MongoDB
connectDB();
// Ensure admin exists (from .env)
ensureAdmin().catch((err) => console.error("[ADMIN] Seed error:", err));

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Routes
app.use("/users", userRoutes);
app.use("/patients", patientRoutes);
app.use("/doctors", doctorRoutes);
app.use("/appointments", appointmentRoutes);

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Healthcare Appointment System API is running" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
