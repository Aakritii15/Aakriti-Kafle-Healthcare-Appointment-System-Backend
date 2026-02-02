// Test script to debug authentication
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
require("dotenv").config();

// Test password hashing and comparison
async function testPasswordHashing() {
  console.log("Testing password hashing...\n");
  
  const testPassword = "test123";
  
  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    console.log("Hashed password:", hashedPassword);
    
    // Compare password
    const isMatch = await bcrypt.compare(testPassword, hashedPassword);
    console.log("Password match:", isMatch);
    
    // Test with wrong password
    const wrongMatch = await bcrypt.compare("wrongpassword", hashedPassword);
    console.log("Wrong password match:", wrongMatch);
    
    console.log("\n✅ Password hashing is working correctly!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Test database connection and check users
async function testDatabase() {
  console.log("\nTesting database connection...\n");
  
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("✅ MongoDB connected successfully");
    
    const User = require("./models/User");
    
    // Get all users (without passwords for security)
    const users = await User.find({}).select("email username role createdAt");
    console.log("\nUsers in database:");
    console.log(users);
    
    // Check if any users have password issues
    const allUsers = await User.find({});
    console.log("\nChecking password hashes...");
    allUsers.forEach(user => {
      const hasHash = user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$"));
      console.log(`Email: ${user.email}, Has valid hash: ${hasHash}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Database error:", error.message);
  }
}

// Run tests
async function runTests() {
  await testPasswordHashing();
  await testDatabase();
  process.exit(0);
}

runTests();
