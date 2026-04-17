const ejs = require('ejs');
const path = require('path');

// Utility to render EJS in both Express and Vercel serverless
async function renderEJS(req, res, view, data = {}, status = 200) {
  // If Express (local), use res.render
  if (typeof res.render === 'function') {
    return res.status(status).render(view, data);
  }
  // If Vercel serverless, use ejs.renderFile
  // Also pass default values for locals that might be expected globally
  const renderData = {
    user: null,
    currentPath: req.url || '/',
    error: [],
    success: [],
    ...data
  };

  // Try both process.cwd() and __dirname parent for robustness
  const tryPaths = [
    path.resolve(process.cwd(), 'views', `${view}.ejs`),
    path.resolve(__dirname, '..', 'views', `${view}.ejs`)
  ];
  let html = null;
  let lastErr = null;
  for (const templatePath of tryPaths) {
    try {
      html = await ejs.renderFile(templatePath, renderData);
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!html) {
    res.status(500).send('Template not found or error rendering EJS: ' + (lastErr ? lastErr.message : 'Unknown error'));
    return;
  }
  res.status(status).send(html);
}

module.exports = { renderEJS };
