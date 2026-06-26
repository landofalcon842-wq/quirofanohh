// netlify/functions/send-email.js
// QuirófanoHH — Función de envío de correos vía Brevo
// Mejorada para entregabilidad en Hotmail, Outlook y Yahoo

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { to, subject, message, icsContent } = JSON.parse(event.body || '{}');

    if (!to || !subject || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan campos requeridos: to, subject, message' })
      };
    }

    const recipients = Array.isArray(to) ? to : [to];
    const validRecipients = [...new Set(
      recipients
        .map(e => String(e).trim().toLowerCase())
        .filter(e => e && e.includes('@') && e.includes('.'))
    )];

    if (!validRecipients.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No hay destinatarios válidos' })
      };
    }

    const BREVO_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'BREVO_API_KEY no configurada en variables de entorno de Netlify' })
      };
    }

    // ── Construir HTML del correo (mejora entregabilidad) ──────────────
    // Los correos en texto plano suelen ir a SPAM en Hotmail/Yahoo
    // Un HTML simple con estructura mejora significativamente la entregabilidad
    const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <!-- Header -->
      <tr>
        <td style="background:#1A3A6B;padding:20px 30px;border-radius:8px 8px 0 0;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">🏥 Hospital Humanitario</p>
          <p style="margin:4px 0 0;color:#A8D4F0;font-size:12px;">Sistema de Gestión Quirúrgica — QuirófanoHH</p>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="background:#ffffff;padding:30px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
          <pre style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#333333;white-space:pre-wrap;margin:0;">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#f8f8f8;padding:16px 30px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
          <p style="margin:0;color:#999999;font-size:11px;text-align:center;">
            Hospital Humanitario · Cuenca, Ecuador · Sistema QuirófanoHH<br>
            Este es un mensaje automático, por favor no responda a este correo.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

    // ── Construir payload para Brevo API ───────────────────────────────
    const emailPayload = {
      sender: {
        name: 'QuirófanoHH — Hospital Humanitario',
        email: 'quirofanohhumanitario@gmail.com'
      },
      to: validRecipients.map(email => ({ email })),
      subject: subject,
      htmlContent: htmlBody,
      textContent: message,  // Texto plano como fallback
      headers: {
        // Headers que mejoran entregabilidad
        'X-Mailer': 'QuirófanoHH Sistema v1.0',
        'X-Priority': subject.includes('EMERGENCIA') ? '1' : '3',
        'Importance': subject.includes('EMERGENCIA') ? 'High' : 'Normal'
      }
    };

    // Adjuntar .ics si se proporcionó (para aprobaciones de cirugías)
    if (icsContent) {
      emailPayload.attachment = [{
        name: 'cirugia_quirofanohh.ics',
        content: Buffer.from(icsContent, 'utf8').toString('base64')
      }];
    }

    // ── Enviar via Brevo API ───────────────────────────────────────────
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[send-email] Brevo error:', response.status, JSON.stringify(result));
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          ok: false,
          error: result.message || 'Error de Brevo',
          code: result.code,
          sent: 0
        })
      };
    }

    console.log('[send-email] ✅ Enviado a:', validRecipients.join(', '), '| MessageId:', result.messageId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        sent: validRecipients.length,
        recipients: validRecipients,
        messageId: result.messageId,
        withCalendar: !!icsContent
      })
    };

  } catch (err) {
    console.error('[send-email] Error interno:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message, sent: 0 })
    };
  }
};
