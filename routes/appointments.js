const router = require('express').Router();
const { isAuthenticated } = require('../middleware/auth');
const { doctorQueries, appointmentQueries } = require('../models/queries');

// GET - Book appointment page (choose doctor)
router.get('/book', isAuthenticated, async (req, res) => {
    try {
        const doctors = await doctorQueries.getAll();
        const doctorsWithSlots = [];
        for (const doc of doctors.rows) {
            const slots = await doctorQueries.getSlots(doc.id);
            doctorsWithSlots.push({ ...doc, slots: slots.rows });
        }
        res.render('appointments/book', {
            title: 'Book Appointment',
            doctors: doctorsWithSlots,
            selectedDoctor: req.query.doctor || null
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load booking page.');
        res.redirect('/');
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
        const { doctor_id, slot_id, appointment_date, symptoms, priority } = req.body;
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

        await appointmentQueries.create({
            patient_id, doctor_id, slot_id,
            appointment_date, symptoms,
            priority: priority || 'normal'
        });

        req.flash('success', 'Appointment booked successfully! You will receive confirmation soon.');
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
