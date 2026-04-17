const ejs = require('ejs');
const path = require('path');

// Utility to render EJS in both Express and Vercel serverless
async function renderEJS(res, view, data = {}, status = 200) {
  // If Express (local), use res.render
  if (typeof res.render === 'function') {
    return res.status(status).render(view, data);
  }
  // If Vercel serverless, use ejs.renderFile
  const templatePath = path.join(process.cwd(), 'views', `${view}.ejs`);
  const html = await ejs.renderFile(templatePath, data);
  res.status(status).send(html);
}

module.exports = { renderEJS };
