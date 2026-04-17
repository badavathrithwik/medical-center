const router = require('express').Router();
const { isAdminOrDoctor } = require('../middleware/auth');
const {
    statsQueries, appointmentQueries, prescriptionQueries,
    userQueries, medicalRecordQueries, bulletinQueries, feedbackQueries, doctorQueries
} = require('../models/queries');

// Admin Dashboard
router.get('/dashboard', isAdminOrDoctor, async (req, res) => {
    try {
        const stats = await statsQueries.getDashboardStats();
        const recentAppointments = await appointmentQueries.getAll({ limit: 10 });
        const recentPrescriptions = await prescriptionQueries.getAll();

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats,
            appointments: recentAppointments.rows.slice(0, 10),
            prescriptions: recentPrescriptions.rows.slice(0, 5)
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load dashboard.');
        res.redirect('/');
    }
});

// All Patients
router.get('/patients', isAdminOrDoctor, async (req, res) => {
    try {
        const search = req.query.search || '';
        let patients;
        if (search) {
            patients = await userQueries.search(search);
        } else {
            patients = await userQueries.getStudents();
        }
        res.render('admin/patients', {
            title: 'Patients',
            patients: patients.rows,
            search
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load patients.');
        res.redirect('/admin/dashboard');
    }
});

// Patient Detail
router.get('/patients/:id', isAdminOrDoctor, async (req, res) => {
    try {
        const [patient, records, appointments, prescriptions] = await Promise.all([
            userQueries.findById(req.params.id),
            medicalRecordQueries.getByPatient(req.params.id),
            appointmentQueries.getByPatient(req.params.id),
            prescriptionQueries.getByPatient(req.params.id)
        ]);

        if (patient.rows.length === 0) {
            req.flash('error', 'Patient not found.');
            return res.redirect('/admin/patients');
        }

        res.render('admin/patient-detail', {
            title: `Patient: ${patient.rows[0].name}`,
            patient: patient.rows[0],
            medicalRecord: records.rows[0] || null,
            appointments: appointments.rows,
            prescriptions: prescriptions.rows
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load patient details.');
        res.redirect('/admin/patients');
    }
});

// All Appointments
router.get('/appointments', isAdminOrDoctor, async (req, res) => {
    try {
        const filters = {
            status: req.query.status || '',
            date: req.query.date || '',
            doctor_id: req.query.doctor_id || ''
        };

        let appointments;
        if (req.session.user.role === 'doctor') {
            const doctor = await doctorQueries.findByUserId(req.session.user.id);
            if (doctor.rows.length > 0) {
                appointments = await appointmentQueries.getByDoctor(doctor.rows[0].id);
            } else {
                appointments = { rows: [] };
            }
        } else {
            appointments = await appointmentQueries.getAll(filters);
        }

        const doctors = await doctorQueries.getAll();

        res.render('admin/appointments', {
            title: 'Appointments',
            appointments: appointments.rows,
            doctors: doctors.rows,
            filters
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load appointments.');
        res.redirect('/admin/dashboard');
    }
});

// Update Appointment Status
router.post('/appointments/:id/status', isAdminOrDoctor, async (req, res) => {
    try {
        const { status, notes } = req.body;
        await appointmentQueries.updateStatus(req.params.id, status, notes);
        req.flash('success', 'Appointment status updated.');
        res.redirect('/admin/appointments');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to update appointment.');
        res.redirect('/admin/appointments');
    }
});

// Prescriptions list
router.get('/prescriptions', isAdminOrDoctor, async (req, res) => {
    try {
        const prescriptions = await prescriptionQueries.getAll();
        res.render('admin/prescriptions', {
            title: 'Prescriptions',
            prescriptions: prescriptions.rows
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load prescriptions.');
        res.redirect('/admin/dashboard');
    }
});

// Add Prescription Form
router.get('/prescriptions/add', isAdminOrDoctor, async (req, res) => {
    try {
        const appointmentId = req.query.appointment_id;
        let appointment = null;
        if (appointmentId) {
            const result = await appointmentQueries.findById(appointmentId);
            if (result.rows.length > 0) appointment = result.rows[0];
        }

        const patients = await userQueries.getStudents();
        const doctors = await doctorQueries.getAll();

        res.render('admin/add-prescription', {
            title: 'Add Prescription',
            appointment,
            patients: patients.rows,
            doctors: doctors.rows
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load prescription form.');
        res.redirect('/admin/prescriptions');
    }
});

// Create Prescription
router.post('/prescriptions', isAdminOrDoctor, async (req, res) => {
    try {
        const { appointment_id, doctor_id, patient_id, diagnosis, tests_recommended, instructions, follow_up_date } = req.body;

        // Parse medicines from form
        const medicineNames = Array.isArray(req.body['medicine_name[]']) ? req.body['medicine_name[]'] : [req.body['medicine_name[]']].filter(Boolean);
        const medicineDosages = Array.isArray(req.body['medicine_dosage[]']) ? req.body['medicine_dosage[]'] : [req.body['medicine_dosage[]']].filter(Boolean);
        const medicineFreqs = Array.isArray(req.body['medicine_frequency[]']) ? req.body['medicine_frequency[]'] : [req.body['medicine_frequency[]']].filter(Boolean);
        const medicineDurations = Array.isArray(req.body['medicine_duration[]']) ? req.body['medicine_duration[]'] : [req.body['medicine_duration[]']].filter(Boolean);

        const medicines = medicineNames.map((name, i) => ({
            name,
            dosage: medicineDosages[i] || '',
            frequency: medicineFreqs[i] || '',
            duration: medicineDurations[i] || ''
        }));

        await prescriptionQueries.create({
            appointment_id: appointment_id || null,
            doctor_id,
            patient_id,
            diagnosis,
            medicines,
            tests_recommended,
            instructions,
            follow_up_date: follow_up_date || null
        });

        // If linked to appointment, mark completed
        if (appointment_id) {
            await appointmentQueries.updateStatus(appointment_id, 'completed', 'Prescription issued');
        }

        req.flash('success', 'Prescription created successfully.');
        res.redirect('/admin/prescriptions');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to create prescription.');
        res.redirect('/admin/prescriptions/add');
    }
});

// View Prescription
router.get('/prescriptions/:id', isAdminOrDoctor, async (req, res) => {
    try {
        const prescription = await prescriptionQueries.findById(req.params.id);
        if (prescription.rows.length === 0) {
            req.flash('error', 'Prescription not found.');
            return res.redirect('/admin/prescriptions');
        }
        res.render('admin/prescription-detail', {
            title: 'Prescription Details',
            prescription: prescription.rows[0]
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load prescription.');
        res.redirect('/admin/prescriptions');
    }
});

// Update Medical Record
router.post('/patients/:id/medical-record', isAdminOrDoctor, async (req, res) => {
    try {
        const data = { patient_id: req.params.id, ...req.body };
        await medicalRecordQueries.upsert(data);
        req.flash('success', 'Medical record updated.');
        res.redirect(`/admin/patients/${req.params.id}`);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to update medical record.');
        res.redirect(`/admin/patients/${req.params.id}`);
    }
});

// Health Bulletins Management
router.get('/bulletins', isAdminOrDoctor, async (req, res) => {
    try {
        const bulletins = await bulletinQueries.getAll();
        res.render('admin/bulletins', { title: 'Health Bulletins', bulletins: bulletins.rows });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load bulletins.');
        res.redirect('/admin/dashboard');
    }
});

router.post('/bulletins', isAdminOrDoctor, async (req, res) => {
    try {
        const { title, content, category } = req.body;
        await bulletinQueries.create({ title, content, category, author: req.session.user.name });
        req.flash('success', 'Health bulletin created.');
        res.redirect('/admin/bulletins');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to create bulletin.');
        res.redirect('/admin/bulletins');
    }
});

// Feedback Management
router.get('/feedback', isAdminOrDoctor, async (req, res) => {
    try {
        const feedback = await feedbackQueries.getAll();
        res.render('admin/feedback', { title: 'Feedback', feedback: feedback.rows });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load feedback.');
        res.redirect('/admin/dashboard');
    }
});

router.post('/feedback/:id/respond', isAdminOrDoctor, async (req, res) => {
    try {
        const { status, admin_response } = req.body;
        await feedbackQueries.updateStatus(req.params.id, status, admin_response);
        req.flash('success', 'Feedback updated.');
        res.redirect('/admin/feedback');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to update feedback.');
        res.redirect('/admin/feedback');
    }
});

module.exports = router;
