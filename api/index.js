const { doctorQueries, bulletinQueries } = require('../models/queries');

module.exports = async (req, res) => {
  const { url, method } = req;
  // Home page
  if (url === '/' && method === 'GET') {
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
      res.render('index', { title: 'Medical Center - IIT Ropar', doctors: [], bulletins: [] });
    }
    return;
  }
  // Team page
  if (url === '/team' && method === 'GET') {
    try {
      const doctors = await doctorQueries.getAll();
      res.render('team', { title: 'Our Team', doctors: doctors.rows });
    } catch (err) {
      res.render('team', { title: 'Our Team', doctors: [] });
    }
    return;
  }
  // Schedule page
  if (url === '/schedule' && method === 'GET') {
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
    return;
  }
  // Facilities page
  if (url === '/facilities' && method === 'GET') {
    res.render('facilities', { title: 'Facilities' });
    return;
  }
  // Information page
  if (url === '/information' && method === 'GET') {
    res.render('information', { title: 'Information' });
    return;
  }
  // Health bulletins
  if (url === '/bulletins' && method === 'GET') {
    try {
      const bulletins = await bulletinQueries.getAll();
      res.render('bulletins', { title: 'Health Bulletins', bulletins: bulletins.rows });
    } catch (err) {
      res.render('bulletins', { title: 'Health Bulletins', bulletins: [] });
    }
    return;
  }
  // 404 fallback
  res.status(404).render('404', { title: 'Page Not Found' });
};
