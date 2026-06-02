exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const { to, subject, message } = JSON.parse(event.body);

    if (!to || !subject || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan campos: to, subject, message' })
      };
    }

    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1A3A6B;color:#fff;padding:16px 20px;border-radius:6px 6px 0 0">
    <div style="font-size:18px;font-weight:700;letter-spacing:2px">HOSPITAL HUMANITARIO</div>
    <div style="font-size:11px;opacity:.7;margin-top:3px">Sistema de Gestión Quirúrgica · Cuenca, Ecuador</div>
  </div>
  <div style="padding:20px;background:#f9f9f7;border:1px solid #ddd;border-top:none;border-radius:0 0 6px 6px">
    <pre style="font-family:Arial,sans-serif;font-size:13px;line-height:1.7;white-space:pre-wrap;margin:0">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
  </div>
  <div style="font-size:10px;color:#999;text-align:center;margin-top:10px">
    Mensaje automatico - No responder - Hospital Humanitario - Cuenca, Ecuador
  </div>
</div>`;

    const recipients = Array.isArray(to)
      ? to
      : String(to).split(',').map(e => e.trim()).filter(e => e.includes('@'));

    const results = [];
    for (const email of recipients) {
      if (!email) continue;
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'QuirofanoHH <onboarding@resend.dev>',
          to: [email],
          subject,
          html,
          text: message
        })
      });
      const result = await resp.json();
      results.push({ email, ok: resp.ok, id: result.id });
      console.log(`Email ${resp.ok ? 'enviado' : 'fallido'} a ${email}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, sent: results.filter(r=>r.ok).length, results })
    };

  } catch (e) {
    console.error('Error send-email:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};
