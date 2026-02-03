// backend/controllers/appointmentController.js
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const User = require("../models/User");

// Book appointment
exports.bookAppointment = async (req, res) => {
  try {
    const { doctorId, appointmentDate, appointmentTime, reason, notes } = req.body;
    const patientId = req.user.id;
    
    // Validate required fields
    if (!doctorId || !appointmentDate || !appointmentTime || !reason) {
      return res.status(400).json({ 
        message: "Doctor ID, appointment date, time, and reason are required" 
      });
    }
    
    // Check if doctor exists
    const doctor = await Doctor.findById(doctorId).populate('userId');
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    
    // Check if patient is trying to book with themselves
    if (doctor.userId._id.toString() === patientId) {
      return res.status(400).json({ 
        message: "Cannot book appointment with yourself" 
      });
    }
    
    // Check if appointment date is in the future
    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    if (appointmentDateTime < new Date()) {
      return res.status(400).json({ 
        message: "Appointment date and time must be in the future" 
      });
    }
    
    // Check for conflicting appointments (same doctor, same date and time)
    const appointmentDateObj = new Date(appointmentDate);
    appointmentDateObj.setHours(0, 0, 0, 0);
    
    const conflictingAppointment = await Appointment.findOne({
      doctorId: doctor.userId._id,
      appointmentDate: appointmentDateObj,
      appointmentTime: appointmentTime,
      status: { $in: ['pending', 'confirmed'] }
    });
    
    if (conflictingAppointment) {
      return res.status(400).json({ 
        message: "This time slot is already booked. Please choose another time." 
      });
    }
    
    // Check if patient already has an appointment at this time
    const patientConflict = await Appointment.findOne({
      patientId: patientId,
      appointmentDate: appointmentDateObj,
      appointmentTime: appointmentTime,
      status: { $in: ['pending', 'confirmed'] }
    });
    
    if (patientConflict) {
      return res.status(400).json({ 
        message: "You already have an appointment at this time." 
      });
    }
    
    // Create appointment
    const appointment = new Appointment({
      patientId: patientId,
      doctorId: doctor.userId._id,
      doctorProfileId: doctor._id,
      appointmentDate: appointmentDateObj,
      appointmentTime: appointmentTime,
      reason: reason,
      notes: notes || '',
      consultationFee: doctor.consultationFee,
      status: 'pending'
    });
    
    await appointment.save();
    
    // Populate for response
    await appointment.populate('doctorId', 'username email');
    await appointment.populate('patientId', 'username email');
    
    res.status(201).json({
      message: "Appointment booked successfully",
      appointment: {
        id: appointment._id,
        doctor: {
          id: appointment.doctorId._id,
          name: appointment.doctorId.username
        },
        patient: {
          id: appointment.patientId._id,
          name: appointment.patientId.username
        },
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        reason: appointment.reason,
        status: appointment.status,
        consultationFee: appointment.consultationFee
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get patient appointments
exports.getPatientAppointments = async (req, res) => {
  try {
    const patientId = req.user.id;
    
    const appointments = await Appointment.find({ patientId: patientId })
      .populate('doctorId', 'username email phone')
      .populate('doctorProfileId', 'specialization consultationFee')
      .sort({ appointmentDate: -1, appointmentTime: -1 });
    
    res.json({
      count: appointments.length,
      appointments: appointments.map(apt => ({
        id: apt._id,
        doctor: {
          id: apt.doctorId._id,
          name: apt.doctorId.username,
          email: apt.doctorId.email,
          phone: apt.doctorId.phone,
          specialization: apt.doctorProfileId.specialization
        },
        appointmentDate: apt.appointmentDate,
        appointmentTime: apt.appointmentTime,
        reason: apt.reason,
        status: apt.status,
        consultationFee: apt.consultationFee,
        notes: apt.notes,
        createdAt: apt.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Cancel appointment
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { cancellationReason } = req.body;
    
    const appointment = await Appointment.findById(id)
      .populate('patientId', 'username')
      .populate('doctorId', 'username');
    
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    
    // Check if user has permission to cancel
    const isPatient = appointment.patientId._id.toString() === userId;
    const isDoctor = appointment.doctorId._id.toString() === userId;
    const isAdmin = userRole === 'admin';
    
    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({ 
        message: "You don't have permission to cancel this appointment" 
      });
    }
    
    // Check if appointment can be cancelled
    if (appointment.status === 'cancelled') {
      return res.status(400).json({ 
        message: "Appointment is already cancelled" 
      });
    }
    
    if (appointment.status === 'completed') {
      return res.status(400).json({ 
        message: "Cannot cancel a completed appointment" 
      });
    }
    
    // Determine who cancelled
    let cancelledBy = 'patient';
    if (isDoctor) cancelledBy = 'doctor';
    if (isAdmin) cancelledBy = 'admin';
    
    // Update appointment
    appointment.status = 'cancelled';
    appointment.cancelledBy = cancelledBy;
    appointment.cancellationReason = cancellationReason || 'No reason provided';
    appointment.updatedAt = new Date();
    
    await appointment.save();
    
    res.json({
      message: "Appointment cancelled successfully",
      appointment: {
        id: appointment._id,
        status: appointment.status,
        cancelledBy: appointment.cancelledBy,
        cancellationReason: appointment.cancellationReason
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get appointment by ID
exports.getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const appointment = await Appointment.findById(id)
      .populate('patientId', 'username email phone')
      .populate('doctorId', 'username email phone')
      .populate('doctorProfileId', 'specialization consultationFee');
    
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    
    // Check if user has permission to view
    const isPatient = appointment.patientId._id.toString() === userId;
    const isDoctor = appointment.doctorId._id.toString() === userId;
    const isAdmin = userRole === 'admin';
    
    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({ 
        message: "You don't have permission to view this appointment" 
      });
    }
    
    res.json({
      id: appointment._id,
      patient: {
        id: appointment.patientId._id,
        name: appointment.patientId.username,
        email: appointment.patientId.email,
        phone: appointment.patientId.phone
      },
      doctor: {
        id: appointment.doctorId._id,
        name: appointment.doctorId.username,
        email: appointment.doctorId.email,
        phone: appointment.doctorId.phone,
        specialization: appointment.doctorProfileId.specialization
      },
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      reason: appointment.reason,
      status: appointment.status,
      consultationFee: appointment.consultationFee,
      notes: appointment.notes,
      cancelledBy: appointment.cancelledBy,
      cancellationReason: appointment.cancellationReason,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
