// backend/controllers/userController.js
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Register User (Patient, Doctor, Moderator)
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
    const validRoles = ['patient', 'doctor', 'admin', 'moderator'];
    if (!validRoles.includes(role)) {
      console.log("[REGISTER] Invalid role:", role);
      return res.status(400).json({ message: "Invalid role. Must be: patient, doctor, admin, or moderator" });
    }

    // Only allow admin creation by existing admins (for security)
    if (role === 'admin') {
      // Check if admin token is provided
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(403).json({ message: "Admin registration requires admin privileges" });
      }
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminUser = await User.findById(decoded.id);
        if (!adminUser || adminUser.role !== 'admin') {
          return res.status(403).json({ message: "Only admins can create admin accounts" });
        }
      } catch (err) {
        return res.status(403).json({ message: "Invalid admin token" });
      }
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
        bio: bio || '',
        consultationFee: consultationFee || 0,
        isVerified: false, // Requires admin verification
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
