const Doctor = require("../models/Doctor");
const User = require("../models/User");
const Appointment = require("../models/Appointment");

// Get all pending doctor verifications
exports.getPendingDoctors = async (req, res) => {
    try {
        const doctors = await Doctor.find({ isVerified: false })
            .populate("userId", "username email -_id") 
            .select("-password"); 

      

        const formattedDoctors = doctors.map(doc => ({
            _id: doc._id,
            username: doc.userId ? doc.userId.username : "Unknown",
            email: doc.userId ? doc.userId.email : "Unknown",
            specialization: doc.specialization,
            licenseNumber: doc.licenseNumber,
            qualifications: doc.qualifications,
            experience: doc.experience,
            consultationFee: doc.consultationFee,
            createdAt: doc.createdAt
        }));

        res.json(formattedDoctors);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

// Verify (Approve/Reject) a doctor
exports.verifyDoctor = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    try {
        const doctor = await Doctor.findById(id);

        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        if (status === "approved") {
            doctor.isVerified = true;
            doctor.verifiedAt = Date.now();
            // Optional: doctor.verifiedBy = req.user.id;
            await doctor.save();
            return res.json({ message: "Doctor verified successfully" });
        } else if (status === "rejected") {
            

            doctor.isVerified = false;
            await doctor.save();

            return res.json({ message: "Doctor verification rejected" });
        } else {
            return res.status(400).json({ message: "Invalid status" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

// Get all users 
exports.getAllUsers = async (req, res) => {
    try {
        const { role } = req.query; 
        const filter = {};
        if (role) filter.role = role;
        const users = await User.find(filter)
            .select("-password -resetPasswordToken -resetPasswordExpires")
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

// Update user status (enable/disable account)
exports.updateUserStatus = async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be true or false" });
    }
    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.role === "admin") {
            return res.status(403).json({ message: "Cannot change admin account status" });
        }
        user.isActive = isActive;
        user.updatedAt = Date.now();
        await user.save();
        res.json({ message: isActive ? "User enabled" : "User disabled", user: { _id: user._id, isActive: user.isActive } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

// Get emergency cases 
exports.getEmergencyCases = async (req, res) => {
    try {
        const appointments = await Appointment.find({ isEmergency: true })
            .populate("patientId", "username email")
            .populate("doctorId", "username email")
            .populate("doctorProfileId", "specialization")
            .sort({ appointmentDate: 1, appointmentTime: 1 });
        const formatted = appointments.map((a) => ({
            _id: a._id,
            patient: a.patientId ? { name: a.patientId.username, email: a.patientId.email } : null,
            doctor: a.doctorId ? { name: a.doctorId.username, email: a.doctorId.email } : null,
            specialization: a.doctorProfileId?.specialization,
            appointmentDate: a.appointmentDate,
            appointmentTime: a.appointmentTime,
            reason: a.reason,
            notes: a.notes,
            status: a.status,
            createdAt: a.createdAt,
        }));
        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

// System reports and analytics
exports.getSystemReports = async (req, res) => {
    try {
        const [usersByRole, appointmentStats, doctorStats, recentAppointments] = await Promise.all([
            User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
            Appointment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
            Doctor.aggregate([
                { $group: { _id: "$isVerified", count: { $sum: 1 } } },
            ]),
            Appointment.find()
                .populate("patientId", "username")
                .populate("doctorId", "username")
                .sort({ createdAt: -1 })
                .limit(10)
                .select("appointmentDate appointmentTime status reason patientId doctorId"),
        ]);
        const usersSummary = { patient: 0, doctor: 0, admin: 0 };
        usersByRole.forEach((r) => { usersSummary[r._id] = r.count; });
        const appointmentsSummary = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
        appointmentStats.forEach((s) => { appointmentsSummary[s._id] = s.count; });
        let verifiedDoctors = 0, pendingDoctors = 0;
        doctorStats.forEach((s) => {
            if (s._id === true) verifiedDoctors = s.count;
            else pendingDoctors = s.count;
        });
        const emergencyCount = await Appointment.countDocuments({ isEmergency: true });
        res.json({
            users: usersSummary,
            appointments: appointmentsSummary,
            doctors: { verified: verifiedDoctors, pending: pendingDoctors },
            emergencyCases: emergencyCount,
            recentAppointments: recentAppointments.map((a) => ({
                _id: a._id,
                date: a.appointmentDate,
                time: a.appointmentTime,
                status: a.status,
                reason: a.reason,
                patient: a.patientId?.username,
                doctor: a.doctorId?.username,
            })),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};
