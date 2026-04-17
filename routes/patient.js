const router = require('express').Router();
const { isAuthenticated } = require('../middleware/auth');
const { appointmentQueries, prescriptionQueries, medicalRecordQueries, userQueries } = require('../models/queries');

function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function attachQueueSnapshots(appointments, queueRows, currentUserId) {
    const queuesByAppointment = new Map();

    queueRows.forEach((row) => {
        if (!queuesByAppointment.has(row.appointment_id)) {
            queuesByAppointment.set(row.appointment_id, []);
        }

        queuesByAppointment.get(row.appointment_id).push({
            appointmentId: row.queue_appointment_id,
            patientId: row.queue_patient_id,
            patientName: row.queue_patient_id === currentUserId ? 'You' : row.queue_patient_name,
            isCurrentPatient: row.queue_patient_id === currentUserId,
            position: row.queue_position
        });
    });

    return appointments.map((appointment) => {
        const queue = queuesByAppointment.get(appointment.id) || [];
        const queuePosition = appointment.queue_position || queue.find((entry) => entry.isCurrentPatient)?.position || null;
        const queueSize = appointment.queue_size || queue.length;

        return {
            ...appointment,
            queue,
            queuePosition,
            queueSize,
            patientsAhead: queuePosition ? Math.max(queuePosition - 1, 0) : null
        };
    });
}

// Patient Dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [appointments, queueSnapshots, prescriptions, medicalRecord] = await Promise.all([
            appointmentQueries.getByPatient(userId),
            appointmentQueries.getUpcomingQueueSnapshots(userId),
            prescriptionQueries.getByPatient(userId),
            medicalRecordQueries.getByPatient(userId)
        ]);

        const upcoming = attachQueueSnapshots(appointments.rows, queueSnapshots.rows, userId).filter(a =>
            new Date(a.appointment_date) >= startOfToday() && a.status !== 'cancelled'
        );

        res.render('patient/dashboard', {
            title: 'My Dashboard',
            appointments: upcoming.slice(0, 5),
            recentPrescriptions: prescriptions.rows.slice(0, 3),
            medicalRecord: medicalRecord.rows[0] || null,
            totalAppointments: appointments.rows.length,
            totalPrescriptions: prescriptions.rows.length
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load dashboard.');
        res.redirect('/');
    }
});

// My Appointments
router.get('/appointments', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [appointments, queueSnapshots] = await Promise.all([
            appointmentQueries.getByPatient(userId),
            appointmentQueries.getUpcomingQueueSnapshots(userId)
        ]);

        res.render('patient/appointments', {
            title: 'My Appointments',
            appointments: attachQueueSnapshots(appointments.rows, queueSnapshots.rows, userId)
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load appointments.');
        res.redirect('/patient/dashboard');
    }
});

// My Prescriptions
router.get('/prescriptions', isAuthenticated, async (req, res) => {
    try {
        const prescriptions = await prescriptionQueries.getByPatient(req.session.user.id);
        res.render('patient/prescriptions', {
            title: 'My Prescriptions',
            prescriptions: prescriptions.rows
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load prescriptions.');
        res.redirect('/patient/dashboard');
    }
});

// View single prescription
router.get('/prescriptions/:id', isAuthenticated, async (req, res) => {
    try {
        const prescription = await prescriptionQueries.findById(req.params.id);
        if (prescription.rows.length === 0 || prescription.rows[0].patient_id !== req.session.user.id) {
            req.flash('error', 'Prescription not found.');
            return res.redirect('/patient/prescriptions');
        }
        res.render('patient/prescription-detail', {
            title: 'Prescription Details',
            prescription: prescription.rows[0]
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load prescription.');
        res.redirect('/patient/prescriptions');
    }
});

// Medical Records
router.get('/medical-records', isAuthenticated, async (req, res) => {
    try {
        const record = await medicalRecordQueries.getByPatient(req.session.user.id);
        res.render('patient/medical-records', {
            title: 'My Medical Records',
            record: record.rows[0] || null
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load medical records.');
        res.redirect('/patient/dashboard');
    }
});

// Update Medical Records
router.post('/medical-records', isAuthenticated, async (req, res) => {
    try {
        const data = { patient_id: req.session.user.id, ...req.body };
        await medicalRecordQueries.upsert(data);
        req.flash('success', 'Medical records updated successfully.');
        res.redirect('/patient/medical-records');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to update medical records.');
        res.redirect('/patient/medical-records');
    }
});

// Profile
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await userQueries.findById(req.session.user.id);
        res.render('patient/profile', {
            title: 'My Profile',
            profile: user.rows[0]
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load profile.');
        res.redirect('/patient/dashboard');
    }
});

// Update Profile
router.post('/profile', isAuthenticated, async (req, res) => {
    try {
        const { name, phone, department, gender, date_of_birth } = req.body;
        await userQueries.update(req.session.user.id, { name, phone, department, gender, date_of_birth });
        req.session.user.name = name;
        req.session.user.phone = phone;
        req.session.user.department = department;
        req.flash('success', 'Profile updated successfully.');
        res.redirect('/patient/profile');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to update profile.');
        res.redirect('/patient/profile');
    }
});

module.exports = router;
