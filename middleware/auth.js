// Authentication & Authorization Middleware

function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    req.flash('error', 'Please log in to access this page.');
    res.redirect('/auth/login');
}

function isAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error', 'Access denied. Admin privileges required.');
    res.redirect('/');
}

function isDoctor(req, res, next) {
    if (req.session && req.session.user && (req.session.user.role === 'doctor' || req.session.user.role === 'admin')) {
        return next();
    }
    req.flash('error', 'Access denied. Doctor privileges required.');
    res.redirect('/');
}

function isAdminOrDoctor(req, res, next) {
    if (req.session && req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'doctor')) {
        return next();
    }
    req.flash('error', 'Access denied.');
    res.redirect('/');
}

function setLocals(req, res, next) {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentPath = req.path;
    next();
}

module.exports = {
    isAuthenticated,
    isAdmin,
    isDoctor,
    isAdminOrDoctor,
    setLocals
};
