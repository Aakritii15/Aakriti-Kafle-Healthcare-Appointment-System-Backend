const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const debugController = require("../controllers/debugController");
const { authMiddleware } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password", userController.resetPassword);

// Debug routes (remove in production)
router.get("/debug/check", debugController.checkUser);
router.get("/debug/list", debugController.listUsers);

// Protected routes
router.get("/profile", authMiddleware, userController.getProfile);

module.exports = router;
