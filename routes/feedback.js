const router = require('express').Router();
const { isAuthenticated } = require('../middleware/auth');
const { feedbackQueries } = require('../models/queries');

// GET Feedback form
router.get('/', isAuthenticated, (req, res) => {
    res.render('feedback', { title: 'Feedback' });
});

// POST Feedback
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { subject, message, rating, is_anonymous } = req.body;
        await feedbackQueries.create({
            user_id: is_anonymous ? null : req.session.user.id,
            subject,
            message,
            rating: parseInt(rating),
            is_anonymous: !!is_anonymous
        });
        req.flash('success', 'Thank you for your feedback!');
        res.redirect('/feedback');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to submit feedback.');
        res.redirect('/feedback');
    }
});

module.exports = router;
