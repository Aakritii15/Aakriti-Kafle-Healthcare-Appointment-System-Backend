const express = require("express");
const app = express();
const connectDB = require("./db");
const userRoutes = require("./routes/user");
const patientRoutes = require("./routes/patient");
require("dotenv").config();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());

// Routes
app.use("/users", userRoutes);
app.use("/patients", patientRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
