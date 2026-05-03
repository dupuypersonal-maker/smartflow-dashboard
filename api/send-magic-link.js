module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, fuente, industry } = req.body;
  if (!email || !email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const blocked = ['mailinator','guerrillamail','tempmail','throwaway','yopmail','sharklasers','trashmail','maildrop','dispostable','fakeinbox'];
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (blocked.some(b => domain.includes(b))) {
    return res.status(400).json({ error: 'Por favor usa un email corporativo o personal válido.' });
  }

  const RESEND_KEY = process.env.RESEND_KEY;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE = process.env.AIRTABLE_BASE;
  const BASE_URL = process.env.BASE_URL || `https://${req.headers.host}`;

  // Generate token
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) token += chars[Math.floor(Math.random() * chars.length)];
  const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // Save token to Airtable Tokens table
  try {
    const atRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Tokens`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          Token: token,
          Email: email,
          Industry: industry || 'General',
          Fuente: fuente || 'Dashboard Demo',
          Expiry: expiry,
          Used: false
        }
      })
    });
    if (!atRes.ok) {
      const err = await atRes.text();
      return res.status(500).json({ error: 'Error guardando token: ' + err });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Error Airtable: ' + e.message });
  }

  const magicLink = `${BASE_URL}/api/verify-token?token=${token}`;

  // Send email via Resend
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Smartflow <onboarding@resend.dev>',
        to: [email],
        subject: 'Tu acceso al dashboard — Smartflow',
        html: `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
<tr><td style="background:#18181b;padding:28px 36px">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><span style="display:inline-block;width:28px;height:28px;background:#2563eb;border-radius:7px;text-align:center;line-height:28px;color:#fff;font-size:14px;font-weight:700;margin-right:8px">S</span><span style="font-family:Georgia,serif;font-size:18px;color:#fafafa;letter-spacing:-0.02em">Smartflow</span></td>
<td align="right" style="font-size:11px;color:rgba(250,250,250,0.4);letter-spacing:0.1em;text-transform:uppercase">Dashboard</td>
</tr></table>
</td></tr>
<tr><td style="padding:36px 36px 28px">
<p style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#2563eb;font-weight:600;margin:0 0 12px">Acceso solicitado</p>
<h1 style="font-family:Georgia,serif;font-size:26px;color:#18181b;margin:0 0 12px;line-height:1.2;letter-spacing:-0.02em;font-weight:400">Tu dashboard está<br>listo para ver.</h1>
<p style="font-size:14px;color:#71717a;line-height:1.65;margin:0 0 28px;font-weight:300">Haz click en el botón para acceder. Este link expira en <strong style="color:#18181b">30 minutos</strong>.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
<tr><td align="center"><a href="${magicLink}" style="display:inline-block;padding:14px 36px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:50px;font-size:15px;font-weight:600">Acceder a mi dashboard →</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-radius:8px;margin-bottom:24px">
<tr><td style="padding:16px 20px"><p style="font-size:12px;color:#71717a;margin:0;line-height:1.5">Si no puedes hacer click, copia este link:<br><span style="color:#2563eb;word-break:break-all;font-size:11px">${magicLink}</span></p></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e4e4e7;padding-top:20px">
<p style="font-size:13px;color:#18181b;font-weight:500;margin:0 0 6px">¿Quieres este dashboard con tus datos en tiempo real?</p>
<p style="font-size:13px;color:#71717a;margin:0 0 14px;font-weight:300">Agenda 30 minutos y conectamos todas tus fuentes.</p>
<a href="https://cal.com/smartflow.es/30min?user=smartflow.es" style="display:inline-block;padding:9px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:50px;font-size:13px;font-weight:500">Agendar sesión →</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#fafafa;padding:20px 36px;border-top:1px solid #e4e4e7">
<p style="font-size:11px;color:#a1a1aa;margin:0">Smartflow · Si no solicitaste este acceso, ignora este email.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`
      })
    });
    if (!emailRes.ok) {
      const err = await emailRes.text();
      return res.status(500).json({ error: 'No se pudo enviar el email: ' + err });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Error enviando email: ' + e.message });
  }

  return res.status(200).json({ success: true });
}
