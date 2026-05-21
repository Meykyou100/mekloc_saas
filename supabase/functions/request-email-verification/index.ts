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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: defaultCorsHeaders });

  try {
    const { projectUrl, serviceRole } = getSupabaseConfig();
    const headers = serviceHeaders(serviceRole);
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'MekLoc <no-reply@mekloc.app>';
    const otpSecret = Deno.env.get('OTP_SECRET') || serviceRole;
    const { email } = await req.json() as { email?: string };
    const normalizedEmail = normalizeEmail(email);
    const ip = getClientIp(req);

    if (!normalizedEmail || !isEmail(normalizedEmail)) return json(defaultCorsHeaders, { error: 'Email invalide' }, 400);
    if (isBlockedEmail(normalizedEmail)) return json(defaultCorsHeaders, { error: 'Domaine email non accepté.' }, 400);

    const recentRes = await fetch(
      `${projectUrl}/rest/v1/email_verifications?email=eq.${encodeURIComponent(normalizedEmail)}&created_at=gte.${encodeURIComponent(new Date(Date.now() - 60 * 1000).toISOString())}&select=id&limit=1`,
      { headers },
    );
    const recent = recentRes.ok ? await recentRes.json() as Array<{ id: string }> : [];
    if (recent.length) return json(defaultCorsHeaders, { error: 'Attendez une minute avant de renvoyer un code.' }, 429);

    const hourlyRes = await fetch(
      `${projectUrl}/rest/v1/email_verifications?email=eq.${encodeURIComponent(normalizedEmail)}&created_at=gte.${encodeURIComponent(new Date(Date.now() - 60 * 60 * 1000).toISOString())}&select=id`,
      { headers },
    );
    const hourly = hourlyRes.ok ? await hourlyRes.json() as Array<{ id: string }> : [];
    if (hourly.length >= 5) return json(defaultCorsHeaders, { error: 'Trop de demandes. Réessayez plus tard.' }, 429);

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    const codeHash = await sha256(`${normalizedEmail}:${code}:${otpSecret}`);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const insertRes = await fetch(`${projectUrl}/rest/v1/email_verifications`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ email: normalizedEmail, code_hash: codeHash, expires_at: expiresAt }),
    });
    if (!insertRes.ok) throw new Error(await insertRes.text() || 'Création code impossible.');

    if (!resendApiKey) {
      console.error('request-email-verification missing RESEND_API_KEY', { email: normalizedEmail, ip });
      return json(defaultCorsHeaders, { error: 'Service email non configuré.' }, 500);
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
    if (!resendResponse.ok) throw new Error('Envoi email impossible.');

    return json(defaultCorsHeaders, { success: true, expiresAt });
  } catch (error) {
    console.error('request-email-verification failed', error);
    return json(defaultCorsHeaders, { error: error instanceof Error ? error.message : 'Envoi code impossible.' }, 400);
  }
});
