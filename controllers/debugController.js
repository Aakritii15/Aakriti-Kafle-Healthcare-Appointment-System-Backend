const User = require("../models/User");

// Check if user exists (for debugging )
exports.checkUser = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.json({ 
        exists: false, 
        message: "User not found in database",
        suggestion: "Please register first"
      });
    }

    // Return user info (without password)
    return res.json({
      exists: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      passwordHashExists: !!user.password,
      passwordHashFormat: user.password ? (user.password.startsWith("$2") ? "Valid bcrypt hash" : "Invalid format") : "No password"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// List all users (for debugging only)
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("email username role isActive createdAt");
    res.json({ 
      count: users.length,
      users: users 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
