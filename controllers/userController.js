// backend/controllers/userController.js
const crypto = require("crypto");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ensureAdmin = require("../utils/ensureAdmin");

// Register User (Patient, Doctor, Admin)
exports.registerUser = async (req, res) => {
  try {
    console.log("[REGISTER] Registration attempt:", { email: req.body.email, role: req.body.role });
    
    const { username, email, password, role, phone, address, dateOfBirth, specialization, licenseNumber, qualifications, experience, bio, consultationFee } = req.body;

    // Validate required fields
    if (!username || !email || !password || !role) {
      console.log("[REGISTER] Missing required fields");
      return res.status(400).json({ message: "Username, email, password, and role are required" });
    }

    // Validate password length
    if (password.length < 6) {
      console.log("[REGISTER] Password too short");
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Validate role
    const validRoles = ['patient', 'doctor', 'admin'];
    if (!validRoles.includes(role)) {
      console.log("[REGISTER] Invalid role:", role);
      return res.status(400).json({ message: "Invalid role. Must be: patient, doctor, or admin" });
    }

    // Admin accounts cannot be registered from UI
    if (role === "admin") {
      return res
        .status(403)
        .json({ message: "Admin registration is disabled. Contact system owner." });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    console.log("[REGISTER] Normalized email:", normalizedEmail);

    // Check if email already exists (case-insensitive)
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.log("[REGISTER] Email already exists:", normalizedEmail);
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    console.log("[REGISTER] Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (normalize email to lowercase)
    const user = new User({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      phone: phone?.trim(),
      address: address?.trim(),
      dateOfBirth: dateOfBirth || undefined,
    });

    console.log("[REGISTER] Saving user to database...");
    await user.save();
    console.log("[REGISTER] User saved successfully:", user._id);

    // If doctor, create doctor profile
    if (role === 'doctor') {
      if (!specialization || !licenseNumber) {
        // If doctor registration fails, delete the user
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({ message: "Specialization and license number are required for doctor registration" });
      }

      // Check if license number already exists
      const existingDoctor = await Doctor.findOne({ licenseNumber });
      if (existingDoctor) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({ message: "License number already registered" });
      }

      const doctor = new Doctor({
        userId: user._id,
        specialization,
        licenseNumber,
        qualifications: qualifications || [],
        experience: experience || 0,
        bio: bio || "",
        consultationFee: consultationFee || 0,
        isVerified: false, // Admin verifies in Doctor Verification panel
      });

      await doctor.save();
    }

    console.log("[REGISTER] Registration successful for:", normalizedEmail);
    
    res.status(201).json({ 
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully`,
      userId: user._id,
      role: user.role,
      ...(role === 'doctor' && { requiresVerification: true })
    });
  } catch (err) {
    console.error("[REGISTER] Registration error:", err);
    
    // Handle specific MongoDB errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field === 'email' ? 'Email' : 'Username'} already exists` 
      });
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        message: errors.join(', ') 
      });
    }
    
    res.status(500).json({ 
      message: err.message || "Registration failed. Please try again." 
    });
  }
};

// Login
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[LOGIN] Attempting login for email: ${normalizedEmail}`);

    // If admin email matches .env and user not found, ensure admin exists
    if (!await User.findOne({ email: normalizedEmail }) && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      if (normalizedEmail === process.env.ADMIN_EMAIL.toLowerCase().trim()) {
        try {
          await ensureAdmin();
        } catch (seedErr) {
          console.error("[LOGIN] Admin seed failed:", seedErr.message);
        }
      }
    }

    // Find user by email (case-insensitive)
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.log(`[LOGIN] User not found: ${normalizedEmail}`);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log(`[LOGIN] User found: ${user.username}, Role: ${user.role}`);

    // Check if user is active
    if (!user.isActive) {
      console.log(`[LOGIN] Account deactivated for: ${normalizedEmail}`);
      return res.status(403).json({ message: "Account is deactivated. Please contact admin." });
    }

    // Check if password exists and is a valid hash
    if (!user.password) {
      console.log(`[LOGIN] No password found for user: ${normalizedEmail}`);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare password
    console.log(`[LOGIN] Comparing password...`);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`[LOGIN] Password mismatch for: ${normalizedEmail}`);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log(`[LOGIN] Login successful for: ${normalizedEmail}`);

    // Generate token with user role
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: "24h" }
    );

    // Get doctor verification status if doctor
    let doctorInfo = null;
    if (user.role === 'doctor') {
      const doctor = await Doctor.findOne({ userId: user._id });
      doctorInfo = {
        isVerified: doctor?.isVerified || false,
        specialization: doctor?.specialization,
      };
    }

    res.json({ 
      token, 
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
      doctorInfo
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    
    let doctorInfo = null;
    if (user.role === 'doctor') {
      doctorInfo = await Doctor.findOne({ userId: user._id });
    }

    res.json({
      user,
      doctorInfo
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Forgot password – send reset token (no email service; token returned for dev)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    user.updatedAt = new Date();
    await user.save();
    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${token}`;
    res.json({ message: "If an account exists with this email, you will receive a password reset link.", resetLink });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reset password – use token from email/link
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.updatedAt = new Date();
    await user.save();
    res.json({ message: "Password reset successfully. You can now login." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
