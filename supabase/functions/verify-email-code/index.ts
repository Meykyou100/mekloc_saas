import { defaultCorsHeaders, getSupabaseConfig, isEmail, json, sanitizeText, serviceHeaders } from '../_shared/security.ts';

function normalizeEmail(value: unknown) {
  return sanitizeText(value, 254).toLowerCase();
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: defaultCorsHeaders });

  try {
    const { projectUrl, serviceRole } = getSupabaseConfig();
    const headers = serviceHeaders(serviceRole);
    const otpSecret = Deno.env.get('OTP_SECRET') || serviceRole;
    const { email, code } = await req.json() as { email?: string; code?: string };
    const normalizedEmail = normalizeEmail(email);
    const safeCode = String(code || '').replace(/\D/g, '').slice(0, 6);

    if (!normalizedEmail || !isEmail(normalizedEmail) || safeCode.length !== 6) {
      return json(defaultCorsHeaders, { error: 'Code incorrect' }, 400);
    }

    const lookupRes = await fetch(
      `${projectUrl}/rest/v1/email_verifications?email=eq.${encodeURIComponent(normalizedEmail)}&order=created_at.desc&limit=1&select=id,email,code_hash,expires_at,verified_at,attempts`,
      { headers },
    );
    if (!lookupRes.ok) throw new Error(await lookupRes.text() || 'Vérification impossible.');
    const rows = await lookupRes.json() as Array<{ id: string; code_hash: string; expires_at: string; verified_at: string | null; attempts: number | null }>;
    const row = rows[0];
    if (!row) return json(defaultCorsHeaders, { error: 'Code incorrect' }, 400);
    if (row.verified_at) return json(defaultCorsHeaders, { error: 'Email déjà vérifié' }, 409);
    if (new Date(row.expires_at).getTime() < Date.now()) return json(defaultCorsHeaders, { error: 'Code expiré' }, 410);
    if (Number(row.attempts || 0) >= 5) return json(defaultCorsHeaders, { error: 'Trop de tentatives' }, 429);

    const codeHash = await sha256(`${normalizedEmail}:${safeCode}:${otpSecret}`);
    if (codeHash !== row.code_hash) {
      await fetch(`${projectUrl}/rest/v1/email_verifications?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ attempts: Number(row.attempts || 0) + 1 }),
      });
      return json(defaultCorsHeaders, { error: 'Code incorrect' }, 400);
    }

    const verifiedAt = new Date().toISOString();
    const updateRes = await fetch(`${projectUrl}/rest/v1/email_verifications?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ verified_at: verifiedAt }),
    });
    if (!updateRes.ok) throw new Error(await updateRes.text() || 'Validation impossible.');

    return json(defaultCorsHeaders, { success: true, verifiedAt, email: normalizedEmail });
  } catch (error) {
    console.error('verify-email-code failed', error);
    return json(defaultCorsHeaders, { error: error instanceof Error ? error.message : 'Vérification impossible.' }, 400);
  }
});
