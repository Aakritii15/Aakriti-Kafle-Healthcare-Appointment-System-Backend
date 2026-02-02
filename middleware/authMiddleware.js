const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Basic authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Role-based middleware
const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
    }

    next();
  };
};

// Specific role middlewares
const adminMiddleware = (req, res, next) => {
  roleMiddleware('admin')(req, res, next);
};

const doctorMiddleware = (req, res, next) => {
  roleMiddleware('doctor')(req, res, next);
};

const patientMiddleware = (req, res, next) => {
  roleMiddleware('patient')(req, res, next);
};

const moderatorMiddleware = (req, res, next) => {
  roleMiddleware('moderator')(req, res, next);
};

// Admin or Moderator middleware
const adminOrModeratorMiddleware = (req, res, next) => {
  roleMiddleware('admin', 'moderator')(req, res, next);
};

module.exports = { 
  authMiddleware,
  roleMiddleware,
  adminMiddleware,
  doctorMiddleware,
  patientMiddleware,
  moderatorMiddleware,
  adminOrModeratorMiddleware
};
