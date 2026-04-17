const router = require('express').Router();
const { doctorQueries, bulletinQueries } = require('../models/queries');

// Home page
router.get('/', async (req, res) => {
    try {
        const [doctors, bulletins] = await Promise.all([
            doctorQueries.getAll(),
            bulletinQueries.getAll()
        ]);
        res.render('index', {
            title: 'Medical Center - IIT Ropar',
            doctors: doctors.rows,
            bulletins: bulletins.rows
        });
    } catch (err) {
        console.error(err);
        res.render('index', { title: 'Medical Center - IIT Ropar', doctors: [], bulletins: [] });
    }
});

// Team page
router.get('/team', async (req, res) => {
    try {
        const doctors = await doctorQueries.getAll();
        res.render('team', { title: 'Our Team', doctors: doctors.rows });
    } catch (err) {
        res.render('team', { title: 'Our Team', doctors: [] });
    }
});

// Schedule page
router.get('/schedule', async (req, res) => {
    try {
        const doctors = await doctorQueries.getAll();
        const doctorsWithSlots = [];
        for (const doc of doctors.rows) {
            const slots = await doctorQueries.getSlots(doc.id);
            doctorsWithSlots.push({ ...doc, slots: slots.rows });
        }
        res.render('schedule', { title: 'Schedule', doctors: doctorsWithSlots });
    } catch (err) {
        res.render('schedule', { title: 'Schedule', doctors: [] });
    }
});

// Facilities page
router.get('/facilities', (req, res) => {
    res.render('facilities', { title: 'Facilities' });
});

// Information page
router.get('/information', (req, res) => {
    res.render('information', { title: 'Information' });
});

// Health bulletins
router.get('/bulletins', async (req, res) => {
    try {
        const bulletins = await bulletinQueries.getAll();
        res.render('bulletins', { title: 'Health Bulletins', bulletins: bulletins.rows });
    } catch (err) {
        res.render('bulletins', { title: 'Health Bulletins', bulletins: [] });
    }
});

module.exports = router;
