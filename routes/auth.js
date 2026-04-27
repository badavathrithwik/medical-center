const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { userQueries } = require('../models/queries');
const { sendPasswordResetEmail } = require('../utils/emailService');

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
            gender: user.gender,
            date_of_birth: user.date_of_birth,
            user_type: user.user_type || 'student',
            is_handicapped: user.is_handicapped || false,
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
        const { name, email, password, confirmPassword, phone, department, roll_number, gender, date_of_birth, user_type, is_handicapped } = req.body;

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
            date_of_birth: date_of_birth || null,
            user_type: user_type || 'student',
            is_handicapped: is_handicapped === 'on' || is_handicapped === 'true' || false
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

// GET Forgot Password
router.get('/forgot-password', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/forgot-password', { title: 'Forgot Password' });
});

// POST Forgot Password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            req.flash('error', 'Please provide your email address.');
            return res.redirect('/auth/forgot-password');
        }

        const result = await userQueries.findByEmail(email);
        if (result.rows.length === 0) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/auth/forgot-password');
        }

        const user = result.rows[0];

        crypto.randomBytes(20, async (err, buf) => {
            if (err) {
                req.flash('error', 'An error occurred. Please try again.');
                return res.redirect('/auth/forgot-password');
            }

            const token = buf.toString('hex');
            const expires = new Date(Date.now() + 3600000); // 1 hour

            await userQueries.savePasswordResetToken(user.id, token, expires);

            const resetUrl = `http://${req.headers.host}/auth/reset-password/${token}`;
            const emailSent = await sendPasswordResetEmail(user.email, user.name, resetUrl);

            if (emailSent) {
                req.flash('success', `An e-mail has been sent to ${user.email} with further instructions.`);
                res.redirect('/auth/login');
            } else {
                req.flash('error', 'Failed to send password reset email. Please try again later.');
                res.redirect('/auth/forgot-password');
            }
        });

    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/auth/forgot-password');
    }
});

// GET Reset Password
router.get('/reset-password/:token', async (req, res) => {
    try {
        const result = await userQueries.findByPasswordResetToken(req.params.token);
        if (result.rows.length === 0) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/auth/forgot-password');
        }

        res.render('auth/reset-password', {
            title: 'Reset Password',
            token: req.params.token
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/auth/forgot-password');
    }
});

// POST Reset Password
router.post('/reset-password/:token', async (req, res) => {
    try {
        const result = await userQueries.findByPasswordResetToken(req.params.token);
        if (result.rows.length === 0) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('back');
        }

        const user = result.rows[0];
        const { password, confirmPassword } = req.body;

        if (!password || !confirmPassword) {
            req.flash('error', 'Please provide a new password and confirm it.');
            return res.redirect('back');
        }

        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters.');
            return res.redirect('back');
        }

        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('back');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await userQueries.updatePassword(user.id, hashedPassword);

        req.flash('success', 'Your password has been successfully updated. You can now log in.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('back');
    }
});

module.exports = router;
