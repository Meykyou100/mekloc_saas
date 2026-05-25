import { defaultCorsHeaders, getClientIp, getSupabaseConfig, isEmail, json, sanitizeText, serviceHeaders } from '../_shared/security.ts';

function normalizeEmail(value: unknown) {
  return sanitizeText(value, 254).toLowerCase();
}

function isBlockedEmail(email: string) {
  const domain = email.split('@')[1] || '';
  const blocked = new Set(['example.com', 'test.com', 'fake.com', 'mailinator.com', 'tempmail.com', '10minutemail.com', 'yopmail.com', 'invalid.com']);
  return blocked.has(domain) || domain.endsWith('.test') || domain.endsWith('.invalid') || domain.includes('fake');
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function buildOtpEmail(code: string) {
  const siteUrl = Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('APP_URL') || 'https://mekloc.com';
  const cleanSiteUrl = siteUrl.replace(/\/$/, '');
  const logoUrl = Deno.env.get('EMAIL_LOGO_URL') || `${cleanSiteUrl}/mekloc-logo-dark.png`;

  return `
  <!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Votre code de vérification MekLoc</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f6f4ef; font-family:Arial, Helvetica, sans-serif; color:#1f2933;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; line-height:1px; font-size:1px;">
        Utilisez ce code pour confirmer votre adresse email MekLoc.
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:#f6f4ef; margin:0; padding:0;">
        <tr>
          <td align="center" style="padding:28px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border:1px solid #eadfbf; border-radius:18px; overflow:hidden;">
              <tr>
                <td align="center" style="padding:30px 26px 18px 26px;">
                  <img src="${logoUrl}" width="180" alt="MekLoc" style="display:block; width:180px; max-width:72%; height:auto; border:0; outline:none; text-decoration:none;">
                </td>
              </tr>
              <tr>
                <td style="padding:0 30px 8px 30px; text-align:center;">
                  <p style="margin:0 0 10px 0; color:#d4a017; font-size:12px; line-height:18px; font-weight:700; letter-spacing:2.2px; text-transform:uppercase;">
                    MekLoc
                  </p>
                  <h1 style="margin:0; color:#101820; font-size:28px; line-height:34px; font-weight:800;">
                    Vérification de votre email
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 34px 0 34px; text-align:center;">
                  <p style="margin:0; color:#4b5563; font-size:16px; line-height:26px;">
                    Entrez ce code pour valider votre demande d’accès MekLoc.
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:26px 30px 18px 30px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                    <tr>
                      <td style="background-color:#fff8dc; border:1px solid #e3b117; border-radius:16px; padding:18px 24px; text-align:center;">
                        <span style="display:block; color:#111827; font-size:36px; line-height:44px; font-weight:800; letter-spacing:8px; font-family:Arial, Helvetica, sans-serif;">
                          ${code}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 34px 28px 34px; text-align:center;">
                  <p style="margin:0; color:#6b7280; font-size:14px; line-height:22px;">
                    Ce code expire dans 10 minutes.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:22px 30px; background-color:#fbfaf7; border-top:1px solid #f0e7cf; text-align:center;">
                  <p style="margin:0 0 10px 0; color:#6b7280; font-size:13px; line-height:21px;">
                    Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.
                  </p>
                  <p style="margin:0; color:#6b7280; font-size:13px; line-height:21px;">
                    Support :
                    <a href="mailto:contact@mekloc.com" style="color:#b8860b; text-decoration:none; font-weight:700;">contact@mekloc.com</a>
                    &nbsp;·&nbsp;
                    <a href="${cleanSiteUrl}" style="color:#b8860b; text-decoration:none; font-weight:700;">${cleanSiteUrl}</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function getFromEmail() {
  return Deno.env.get('RESEND_FROM_EMAIL') || 'MekLoc <contact@mekloc.com>';
}

function isProductionRequest(req: Request) {
  const configuredOrigins = [
    Deno.env.get('PUBLIC_SITE_URL'),
    Deno.env.get('APP_URL'),
  ].filter(Boolean) as string[];
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';

  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === 'mekloc.com' || host === 'www.mekloc.com') return true;
  } catch {
    // Ignore invalid/missing origin and rely on configured production URLs below.
  }

  return configuredOrigins.some((value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host === 'mekloc.com' || host === 'www.mekloc.com';
    } catch {
      return false;
    }
  });
}

Deno.serve(async (req) => {
  try {
    console.log('request-email-verification:start', {
      method: req.method,
      origin: req.headers.get('origin') || null,
      hasBody: Boolean(req.headers.get('content-length')) || req.headers.get('transfer-encoding') === 'chunked',
    });

    if (req.method === 'OPTIONS') return json(defaultCorsHeaders, { ok: true }, 200);
    if (req.method !== 'POST') return json(defaultCorsHeaders, { ok: false, error: 'method_not_allowed' });

    const { projectUrl, serviceRole } = getSupabaseConfig();
    const headers = serviceHeaders(serviceRole);
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const productionRequest = isProductionRequest(req);
    const emailTestMode = !productionRequest && (Deno.env.get('EMAIL_TEST_MODE') === 'true' || !resendApiKey);
    const fromEmail = getFromEmail();
    const otpSecret = Deno.env.get('OTP_SECRET') || serviceRole;
    let body: { email?: string };
    try {
      const rawBody = await req.text();
      if (!rawBody.trim()) return json(defaultCorsHeaders, { ok: false, error: 'email_required' });
      body = JSON.parse(rawBody) as { email?: string };
    } catch (error) {
      console.error('request-email-verification invalid JSON body', error);
      return json(defaultCorsHeaders, { ok: false, error: 'invalid_json_body' });
    }
    const { email } = body;
    const normalizedEmail = normalizeEmail(email);
    const ip = getClientIp(req);

    if (!normalizedEmail) return json(defaultCorsHeaders, { ok: false, error: 'email_required' });
    if (!isEmail(normalizedEmail)) return json(defaultCorsHeaders, { ok: false, error: 'Email invalide' });
    if (isBlockedEmail(normalizedEmail)) return json(defaultCorsHeaders, { ok: false, error: 'Domaine email non accepté.' });

    const recentRes = await fetch(
      `${projectUrl}/rest/v1/email_verifications?email=eq.${encodeURIComponent(normalizedEmail)}&created_at=gte.${encodeURIComponent(new Date(Date.now() - 60 * 1000).toISOString())}&select=id&limit=1`,
      { headers },
    );
    const recent = recentRes.ok ? await recentRes.json() as Array<{ id: string }> : [];
    if (recent.length) return json(defaultCorsHeaders, { ok: false, error: 'Un code vient déjà d’être envoyé. Patientez une minute avant de renvoyer.' });

    const hourlyRes = await fetch(
      `${projectUrl}/rest/v1/email_verifications?email=eq.${encodeURIComponent(normalizedEmail)}&created_at=gte.${encodeURIComponent(new Date(Date.now() - 60 * 60 * 1000).toISOString())}&select=id`,
      { headers },
    );
    const hourly = hourlyRes.ok ? await hourlyRes.json() as Array<{ id: string }> : [];
    if (hourly.length >= 5) return json(defaultCorsHeaders, { ok: false, error: 'Trop de demandes. Réessayez plus tard.' });

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    const codeHash = await sha256(`${normalizedEmail}:${code}:${otpSecret}`);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const insertRes = await fetch(`${projectUrl}/rest/v1/email_verifications`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ email: normalizedEmail, code_hash: codeHash, expires_at: expiresAt }),
    });
    if (!insertRes.ok) {
      const details = await insertRes.text();
      console.error('request-email-verification database insert failed', { status: insertRes.status, details });
      return json(defaultCorsHeaders, {
        ok: false,
        error: 'database_insert_failed',
        details: details || `HTTP ${insertRes.status}`,
      });
    }

    if (emailTestMode) {
      console.error('request-email-verification test mode', { email: normalizedEmail, ip, reason: resendApiKey ? 'EMAIL_TEST_MODE=true' : 'RESEND_API_KEY missing' });
      return json(defaultCorsHeaders, { ok: true, success: true, test_mode: true, otp_code: code, expiresAt });
    }

    if (!resendApiKey) {
      console.error('request-email-verification missing RESEND_API_KEY in production mode', { email: normalizedEmail, ip });
      return json(defaultCorsHeaders, { ok: false, success: false, error: 'Service email non configuré.' }, 500);
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [normalizedEmail],
        subject: 'Votre code de vérification MekLoc',
        text: `Votre code de vérification MekLoc est ${code}. Il expire dans 10 minutes.`,
        html: buildOtpEmail(code),
      }),
    });
    if (!resendResponse.ok) {
      const details = await resendResponse.text();
      console.error('request-email-verification resend failed', { status: resendResponse.status, details });
      return json(defaultCorsHeaders, { ok: false, error: 'email_send_failed', details: details || `HTTP ${resendResponse.status}` });
    }

    return json(defaultCorsHeaders, { ok: true, success: true, message: 'Code envoyé', test_mode: false, expiresAt });
  } catch (error) {
    console.error('request-email-verification failed', error);
    return json(defaultCorsHeaders, { ok: false, error: error instanceof Error ? error.message : 'Envoi code impossible.' });
  }
});
