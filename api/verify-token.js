module.exports = async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).send(errorPage('Token inválido', 'No se proporcionó un token.'));

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE = process.env.AIRTABLE_BASE;

  // Look up token in Airtable
  let record = null;
  try {
    const formula = encodeURIComponent(`{Email}!=""&{Token}="${token}"`);
    const atRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Tokens?filterByFormula=${formula}&maxRecords=1`, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });
    if (!atRes.ok) return res.status(500).send(errorPage('Error', 'No se pudo verificar el token.'));
    const data = await atRes.json();
    if (!data.records || data.records.length === 0) {
      return res.status(400).send(errorPage('Link inválido', 'Este link de acceso no es válido. Vuelve al dashboard y solicita uno nuevo.'));
    }
    record = data.records[0];
  } catch (e) {
    return res.status(500).send(errorPage('Error', 'Error de conexión: ' + e.message));
  }

  const fields = record.fields;

  // Check if already used
  if (fields.Used) {
    return res.status(400).send(errorPage('Link ya usado', 'Este link ya fue utilizado. Vuelve al dashboard y solicita uno nuevo.'));
  }

  // Check expiry
  if (fields.Expiry && new Date(fields.Expiry) < new Date()) {
    return res.status(400).send(errorPage('Link expirado', 'Este link expiró (30 minutos). Vuelve al dashboard y solicita uno nuevo.'));
  }

  const { Email: email, Industry: industry, Fuente: fuente } = fields;

  // Mark token as used
  try {
    await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Tokens/${record.id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { Used: true } })
    });
  } catch (e) {}

  // Save verified lead to Leads table
  try {
    await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Table%201`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          Email: email,
          Fuente: fuente || 'Dashboard Demo',
        }
      })
    });
  } catch (e) {}

  // Redirect to dashboard
  return res.redirect(302, `/?verified=true&email=${encodeURIComponent(email)}&industry=${encodeURIComponent(industry || 'General')}`);
}

function errorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title} — Smartflow</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}.card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:2.5rem;max-width:420px;text-align:center;width:100%}.icon{width:52px;height:52px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:24px}h1{font-size:20px;font-weight:600;color:#18181b;margin-bottom:.5rem}p{font-size:14px;color:#71717a;line-height:1.65;margin-bottom:1.75rem}.btn{display:inline-block;padding:.8rem 1.75rem;background:#18181b;color:#fff;text-decoration:none;border-radius:50px;font-size:14px;font-weight:500}</style>
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
