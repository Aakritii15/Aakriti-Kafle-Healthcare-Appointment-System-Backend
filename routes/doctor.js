// backend/routes/doctor.js
const express = require("express");
const router = express.Router();
const doctorController = require("../controllers/doctorController");
const appointmentController = require("../controllers/appointmentController");
const { authMiddleware, doctorMiddleware } = require("../middleware/authMiddleware");

// Public routes
router.get("/search", doctorController.searchDoctors);
router.get("/:id", doctorController.getDoctorById);

// Protected routes - Doctor's own appointments
router.get("/appointments/my", authMiddleware, doctorMiddleware, doctorController.getDoctorAppointments);

module.exports = router;
