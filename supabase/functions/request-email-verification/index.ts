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
  return `
  <div style="font-family: Inter, Arial, sans-serif; background:#070909; color:#F5F5F5; padding:24px;">
    <div style="max-width:560px; margin:0 auto; border:1px solid rgba(255,255,255,0.12); border-radius:16px; background:#0F1115; overflow:hidden;">
      <div style="padding:18px 22px; border-bottom:1px solid rgba(255,255,255,0.08);">
        <h2 style="margin:0; font-size:20px; color:#D4A017;">MekLoc</h2>
        <p style="margin:6px 0 0; color:#B8BDC7; font-size:13px;">Vérification email</p>
      </div>
      <div style="padding:22px;">
        <p style="margin:0 0 14px; color:#DDE2EA;">Entrez ce code pour valider votre demande d’accès MekLoc.</p>
        <div style="letter-spacing:8px; font-size:32px; font-weight:800; color:#D4A017; padding:14px 0;">${code}</div>
        <p style="margin:0; color:#8A8F98; font-size:13px;">Ce code expire dans 10 minutes.</p>
      </div>
    </div>
  </div>`;
}

function getFromEmail() {
  return Deno.env.get('RESEND_FROM_EMAIL') || 'MekLoc <contact@mekloc.com>';
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
    const emailTestMode = Deno.env.get('EMAIL_TEST_MODE') === 'true' || !resendApiKey;
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
    if (recent.length) return json(defaultCorsHeaders, { ok: false, error: 'Attendez une minute avant de renvoyer un code.' });

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

    return json(defaultCorsHeaders, { ok: true, success: true, test_mode: false, expiresAt });
  } catch (error) {
    console.error('request-email-verification failed', error);
    return json(defaultCorsHeaders, { ok: false, error: error instanceof Error ? error.message : 'Envoi code impossible.' });
  }
});
