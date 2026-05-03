if (!global._tokens) global._tokens = new Map();

module.exports = async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(errorPage('Token inválido', 'No se proporcionó un token de acceso.'));
  }

  const data = global._tokens.get(token);

  if (!data) {
    return res.status(400).send(errorPage('Link expirado', 'Este link de acceso ya expiró o fue usado. Vuelve al dashboard y solicita uno nuevo.'));
  }

  if (data.expiry < Date.now()) {
    global._tokens.delete(token);
    return res.status(400).send(errorPage('Link expirado', 'Este link expiró (15 minutos). Vuelve al dashboard y solicita uno nuevo.'));
  }

  const { email, fuente, industry } = data;

  // Token is valid — delete it (one-time use)
  global._tokens.delete(token);

  // Save verified lead to Airtable
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE = process.env.AIRTABLE_BASE;
  try {
    await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Table%201`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          Email: email,
          Fuente: fuente,
          Fecha: new Date().toISOString().split('T')[0],
        }
      })
    });
  } catch (e) {
    // Don't block access if Airtable fails
    console.log('Airtable error:', e.message);
  }

  // Redirect to dashboard with verified email as query param
  const dashboardUrl = `/?verified=true&email=${encodeURIComponent(email)}&industry=${encodeURIComponent(industry)}`;
  return res.redirect(302, dashboardUrl);
}

function errorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title} — Smartflow</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}.card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:2.5rem;max-width:420px;text-align:center}.icon{width:48px;height:48px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:22px}h1{font-size:20px;font-weight:600;color:#18181b;margin-bottom:.5rem}p{font-size:14px;color:#71717a;line-height:1.65;margin-bottom:1.5rem}.btn{display:inline-block;padding:.75rem 1.5rem;background:#18181b;color:#fff;text-decoration:none;border-radius:50px;font-size:14px;font-weight:500}</style>
</head>
<body>
<div class="card">
  <div class="icon">⏱</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="/" class="btn">Volver al dashboard →</a>
</div>
</body></html>`;
}
