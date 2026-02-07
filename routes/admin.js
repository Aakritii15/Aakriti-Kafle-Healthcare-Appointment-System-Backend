const express = require("express");
const router = express.Router();
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");
const adminController = require("../controllers/adminController");

// Get all pending doctors
router.get("/pending-doctors", authMiddleware, adminMiddleware, adminController.getPendingDoctors);

// Verify a doctor
router.put("/verify-doctor/:id", authMiddleware, adminMiddleware, adminController.verifyDoctor);

router.get("/users", authMiddleware, adminMiddleware, adminController.getAllUsers);
router.put("/users/:id/status", authMiddleware, adminMiddleware, adminController.updateUserStatus);
router.get("/emergency-cases", authMiddleware, adminMiddleware, adminController.getEmergencyCases);
router.get("/reports", authMiddleware, adminMiddleware, adminController.getSystemReports);

module.exports = router;
