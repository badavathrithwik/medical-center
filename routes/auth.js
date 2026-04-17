const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { userQueries } = require('../models/queries');

// GET Login
router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/login', { title: 'Login' });
});

// POST Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            req.flash('error', 'Please provide email and password.');
            return res.redirect('/auth/login');
        }

        const result = await userQueries.findByEmail(email);
        if (result.rows.length === 0) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/auth/login');
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/auth/login');
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            department: user.department,
            roll_number: user.roll_number,
        };

        req.flash('success', `Welcome back, ${user.name}!`);

        if (user.role === 'admin') return res.redirect('/admin/dashboard');
        if (user.role === 'doctor') return res.redirect('/admin/appointments');
        return res.redirect('/patient/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/auth/login');
    }
});

// GET Register
router.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/register', { title: 'Register' });
});

// POST Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, confirmPassword, phone, department, roll_number, gender, date_of_birth } = req.body;

        // Validation
        if (!name || !email || !password) {
            req.flash('error', 'Name, email, and password are required.');
            return res.redirect('/auth/register');
        }

        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters.');
            return res.redirect('/auth/register');
        }

        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('/auth/register');
        }

        // Check if email exists
        const existing = await userQueries.findByEmail(email);
        if (existing.rows.length > 0) {
            req.flash('error', 'An account with this email already exists.');
            return res.redirect('/auth/register');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        await userQueries.create({
            name, email, password: hashedPassword,
            role: 'student', phone, department, roll_number, gender,
            date_of_birth: date_of_birth || null
        });

        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Registration failed. Please try again.');
        res.redirect('/auth/register');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;
