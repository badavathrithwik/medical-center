
const { doctorQueries, bulletinQueries } = require('../models/queries');
const { renderEJS } = require('../utils/renderEJS');

module.exports = async (req, res) => {
  const { url, method } = req;
  // Home page
  if (url === '/' && method === 'GET') {
    try {
      const [doctors, bulletins] = await Promise.all([
        doctorQueries.getAll(),
        bulletinQueries.getAll()
      ]);
      await renderEJS(res, 'index', {
        title: 'Medical Center - IIT Ropar',
        doctors: doctors.rows,
        bulletins: bulletins.rows,
        user: null
      });
    } catch (err) {
      await renderEJS(res, 'index', { title: 'Medical Center - IIT Ropar', doctors: [], bulletins: [], user: null });
    }
    return;
  }
  // Team page
  if (url === '/team' && method === 'GET') {
    try {
      const doctors = await doctorQueries.getAll();
      await renderEJS(res, 'team', { title: 'Our Team', doctors: doctors.rows, user: null });
    } catch (err) {
      await renderEJS(res, 'team', { title: 'Our Team', doctors: [], user: null });
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
      await renderEJS(res, 'schedule', { title: 'Schedule', doctors: doctorsWithSlots, user: null });
    } catch (err) {
      await renderEJS(res, 'schedule', { title: 'Schedule', doctors: [], user: null });
    }
    return;
  }
  // Facilities page
  if (url === '/facilities' && method === 'GET') {
    await renderEJS(res, 'facilities', { title: 'Facilities', user: null });
    return;
  }
  // Information page
  if (url === '/information' && method === 'GET') {
    await renderEJS(res, 'information', { title: 'Information', user: null });
    return;
  }
  // Health bulletins
  if (url === '/bulletins' && method === 'GET') {
    try {
      const bulletins = await bulletinQueries.getAll();
      await renderEJS(res, 'bulletins', { title: 'Health Bulletins', bulletins: bulletins.rows, user: null });
    } catch (err) {
      await renderEJS(res, 'bulletins', { title: 'Health Bulletins', bulletins: [], user: null });
    }
    return;
  }
  // 404 fallback
  await renderEJS(res, '404', { title: 'Page Not Found', user: null }, 404);
};
