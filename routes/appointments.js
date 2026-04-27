const router = require('express').Router();
const { isAuthenticated } = require('../middleware/auth');
const { doctorQueries, appointmentQueries, userQueries } = require('../models/queries');
const { matchDoctors, calculatePriority } = require('../utils/symptomMatcher');
const { sendBookingConfirmation } = require('../utils/emailService');

// GET - Book appointment page (choose doctor)
router.get('/book', isAuthenticated, async (req, res) => {
    try {
        const doctors = await doctorQueries.getAll();
        const doctorsWithSlots = [];
        for (const doc of doctors.rows) {
            const slots = await doctorQueries.getSlots(doc.id);
            doctorsWithSlots.push({ ...doc, slots: slots.rows });
        }

        // Get patient info for gender-based doctor preference
        const patient = await userQueries.findById(req.session.user.id);
        const patientData = patient.rows[0] || {};

        res.render('appointments/book', {
            title: 'Book Appointment',
            doctors: doctorsWithSlots,
            selectedDoctor: req.query.doctor || null,
            patientGender: patientData.gender || '',
            patientUserType: patientData.user_type || 'student',
            patientIsHandicapped: patientData.is_handicapped || false,
            patientDob: patientData.date_of_birth || null
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load booking page.');
        res.redirect('/');
    }
});

// GET - Recommend doctors based on symptoms (AJAX)
router.get('/recommend-doctors', isAuthenticated, async (req, res) => {
    try {
        const { symptoms } = req.query;
        if (!symptoms) {
            return res.json({ doctors: [] });
        }

        const allDoctors = await doctorQueries.getAll();
        const doctorsWithSlots = [];
        for (const doc of allDoctors.rows) {
            const slots = await doctorQueries.getSlots(doc.id);
            doctorsWithSlots.push({ ...doc, slots: slots.rows });
        }

        const ranked = matchDoctors(symptoms, doctorsWithSlots);
        res.json({ doctors: ranked });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to recommend doctors' });
    }
});

// GET - Get available slots for a doctor on a date (AJAX)
router.get('/slots/:doctorId/:date', isAuthenticated, async (req, res) => {
    try {
        const { doctorId, date } = req.params;
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay();

        const slots = await doctorQueries.getAvailableSlots(doctorId, dayOfWeek);
        const availableSlots = [];

        for (const slot of slots.rows) {
            const count = await appointmentQueries.countByDateAndSlot(doctorId, date, slot.id);
            const booked = parseInt(count.rows[0].count);
            if (booked < slot.max_patients) {
                availableSlots.push({
                    ...slot,
                    booked,
                    remaining: slot.max_patients - booked
                });
            }
        }

        res.json({ slots: availableSlots });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch slots' });
    }
});

// POST - Create appointment
router.post('/book', isAuthenticated, async (req, res) => {
    try {
        const { doctor_id, slot_id, appointment_date, symptoms, priority, prefer_female_doctor } = req.body;
        const patient_id = req.session.user.id;

        // Validate date is not in the past
        const apptDate = new Date(appointment_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (apptDate < today) {
            req.flash('error', 'Cannot book appointment for a past date.');
            return res.redirect('/appointments/book');
        }

        // Check if already have appointment with same doctor on same day
        const existing = await appointmentQueries.checkExisting(patient_id, doctor_id, appointment_date);
        if (existing.rows.length > 0) {
            req.flash('error', 'You already have an appointment with this doctor on this date.');
            return res.redirect('/appointments/book');
        }

        // Check slot availability
        const count = await appointmentQueries.countByDateAndSlot(doctor_id, appointment_date, slot_id);
        const slot = await doctorQueries.getSlotById(slot_id);
        if (slot.rows.length === 0 || parseInt(count.rows[0].count) >= slot.rows[0].max_patients) {
            req.flash('error', 'This slot is no longer available. Please choose another.');
            return res.redirect('/appointments/book');
        }

        // Get full patient data for priority calculation
        const patientResult = await userQueries.findById(patient_id);
        const patientData = patientResult.rows[0] || {};

        // Auto-calculate priority
        const { priority: autoPriority, reasons } = calculatePriority({
            symptoms,
            userType: patientData.user_type,
            isHandicapped: patientData.is_handicapped,
            dateOfBirth: patientData.date_of_birth,
            manualPriority: priority || 'normal'
        });

        const appointment = await appointmentQueries.create({
            patient_id, doctor_id, slot_id,
            appointment_date, symptoms,
            priority: autoPriority,
            prefer_female_doctor: prefer_female_doctor === 'on' || prefer_female_doctor === 'true' || false
        });

        // Get doctor info for email
        const doctor = await doctorQueries.findById(doctor_id);
        const doctorData = doctor.rows[0] || {};
        const slotData = slot.rows[0] || {};

        // Send confirmation email (non-blocking)
        const dateFormatted = new Date(appointment_date).toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const timeSlot = `${slotData.start_time ? slotData.start_time.substring(0, 5) : ''} - ${slotData.end_time ? slotData.end_time.substring(0, 5) : ''}`;

        sendBookingConfirmation({
            patientName: patientData.name || req.session.user.name,
            patientEmail: patientData.email || req.session.user.email,
            doctorName: doctorData.name || 'Doctor',
            specialization: doctorData.specialization || '',
            appointmentDate: dateFormatted,
            timeSlot: timeSlot,
            symptoms: symptoms || 'Not specified',
            priority: autoPriority,
            priorityReasons: reasons
        }).catch(err => console.error('Email error (non-blocking):', err.message));

        req.flash('success', 'Appointment booked successfully! A confirmation email has been sent.');
        res.redirect('/patient/appointments');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to book appointment. Please try again.');
        res.redirect('/appointments/book');
    }
});

// POST - Cancel appointment
router.post('/:id/cancel', isAuthenticated, async (req, res) => {
    try {
        const appointment = await appointmentQueries.findById(req.params.id);
        if (appointment.rows.length === 0) {
            req.flash('error', 'Appointment not found.');
            return res.redirect('/patient/appointments');
        }

        const appt = appointment.rows[0];
        if (appt.patient_id !== req.session.user.id && req.session.user.role !== 'admin') {
            req.flash('error', 'Unauthorized action.');
            return res.redirect('/patient/appointments');
        }

        await appointmentQueries.updateStatus(req.params.id, 'cancelled', 'Cancelled by patient');
        req.flash('success', 'Appointment cancelled successfully.');

        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/appointments');
        }
        res.redirect('/patient/appointments');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to cancel appointment.');
        res.redirect('/patient/appointments');
    }
});

module.exports = router;
