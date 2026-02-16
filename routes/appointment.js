// backend/routes/appointment.js
const express = require("express");
const router = express.Router();
const appointmentController = require("../controllers/appointmentController");
const { authMiddleware } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(authMiddleware);

// Book appointment (patient only)
router.post("/book", appointmentController.bookAppointment);

// Get booked slots
router.get("/booked-slots", appointmentController.getBookedSlots);

// Get patient appointments
router.get("/my", appointmentController.getPatientAppointments);

// Get appointment by ID
router.get("/:id", appointmentController.getAppointmentById);

// Cancel appointment
router.put("/:id/cancel", appointmentController.cancelAppointment);

module.exports = router;
