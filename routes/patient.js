const express = require("express");
const router = express.Router();
const Patient = require("../models/patient"); // Your patient model
const { authMiddleware } = require("../middleware/authMiddleware");

// CREATE a new patient
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, age } = req.body;
    const newPatient = new Patient({ name, email, phone, age });
    await newPatient.save();
    res.status(201).json(newPatient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// READ all patients
router.get("/", authMiddleware, async (req, res) => {
  try {
    const patients = await Patient.find();
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// READ a single patient by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// UPDATE a patient by ID
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, age } = req.body;
    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, age },
      { new: true, runValidators: true }
    );
    if (!updatedPatient) return res.status(404).json({ message: "Patient not found" });
    res.json(updatedPatient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE a patient by ID
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deletedPatient = await Patient.findByIdAndDelete(req.params.id);
    if (!deletedPatient) return res.status(404).json({ message: "Patient not found" });
    res.json({ message: "Patient deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
