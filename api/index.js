
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
        bulletins: bulletins.rows
      });
    } catch (err) {
      await renderEJS(res, 'index', { title: 'Medical Center - IIT Ropar', doctors: [], bulletins: [] });
    }
    return;
  }
  // Team page
  if (url === '/team' && method === 'GET') {
    try {
      const doctors = await doctorQueries.getAll();
      await renderEJS(res, 'team', { title: 'Our Team', doctors: doctors.rows });
    } catch (err) {
      await renderEJS(res, 'team', { title: 'Our Team', doctors: [] });
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
      await renderEJS(res, 'schedule', { title: 'Schedule', doctors: doctorsWithSlots });
    } catch (err) {
      await renderEJS(res, 'schedule', { title: 'Schedule', doctors: [] });
    }
    return;
  }
  // Facilities page
  if (url === '/facilities' && method === 'GET') {
    await renderEJS(res, 'facilities', { title: 'Facilities' });
    return;
  }
  // Information page
  if (url === '/information' && method === 'GET') {
    await renderEJS(res, 'information', { title: 'Information' });
    return;
  }
  // Health bulletins
  if (url === '/bulletins' && method === 'GET') {
    try {
      const bulletins = await bulletinQueries.getAll();
      await renderEJS(res, 'bulletins', { title: 'Health Bulletins', bulletins: bulletins.rows });
    } catch (err) {
      await renderEJS(res, 'bulletins', { title: 'Health Bulletins', bulletins: [] });
    }
    return;
  }
  // 404 fallback
  await renderEJS(res, '404', { title: 'Page Not Found' }, 404);
};
