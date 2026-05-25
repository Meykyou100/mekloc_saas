// Supabase Edge Function: send-access-request-email
// Sends an admin notification when a new MekLoc access request is submitted.
// Deploy with: supabase functions deploy send-access-request-email

const allowedOrigins = new Set([
  'https://mekloc.com',
  'https://www.mekloc.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
]);

const rateBuckets = new Map<string, number[]>();

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) || origin.includes('localhost') || origin.includes('127.0.0.1') ? origin || '*' : 'https://mekloc.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(req: Request, payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function clientIp(req: Request) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((timestamp) => timestamp > now - windowMs);
  if (hits.length >= limit) {
    rateBuckets.set(key, hits);
    return false;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  return true;
}

function sanitizeText(value: unknown, maxLength = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function escapeHtml(value: unknown) {
  return sanitizeText(value, 1200)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function getSiteUrl() {
  return cleanUrl(Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('APP_URL') || 'https://mekloc.com');
}

function getLogoUrl(siteUrl: string) {
  const logoUrl = Deno.env.get('EMAIL_LOGO_URL') || `${siteUrl}/mekloc-logo-dark.png`;
  return /^https?:\/\//i.test(logoUrl) ? logoUrl : `${siteUrl}/${logoUrl.replace(/^\/+/, '')}`;
}

function getFromEmail() {
  return Deno.env.get('RESEND_FROM_EMAIL') || 'MekLoc <contact@mekloc.com>';
}

function getAdminEmail() {
  return Deno.env.get('ADMIN_NOTIFICATION_EMAIL') || 'contact@mekloc.com';
}

function formatDate(value: string) {
  if (!value) return 'Aujourd’hui';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Aujourd’hui';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Casablanca',
  }).format(date);
}

function billingLabel(value: string) {
  if (value === 'annual') return 'Annuel';
  if (value === 'monthly') return 'Mensuel';
  return value || 'Non renseigné';
}

function row(label: string, value: unknown) {
  return `
    <tr>
      <td style="padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.08); color:#A1A1AA; font-size:13px; width:42%;">${escapeHtml(label)}</td>
      <td style="padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.08); color:#FFFFFF; font-size:14px; font-weight:700; text-align:right;">${escapeHtml(value || 'Non renseigné')}</td>
    </tr>`;
}

function buildAdminNotificationHtml(input: {
  agencyName: string;
  ownerName: string;
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  websiteUrl: string;
  planName: string;
  billingType: string;
  vehicleCount: string;
  promoCode: string;
  emailVerifiedAt: string;
  termsAccepted: boolean;
  siteUrl: string;
  logoUrl: string;
}) {
  const adminUrl = `${input.siteUrl}/dashboard`;
  const preheader = 'Une nouvelle agence vient de demander un accès MekLoc.';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nouvelle demande d'accès MekLoc</title>
  </head>
  <body style="margin:0; padding:0; background:#111111; font-family:Arial, Helvetica, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#111111; padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:720px; border-radius:24px; overflow:hidden; border:1px solid rgba(227,177,23,0.28); background:#080808;">
            <tr>
              <td style="padding:26px 28px 18px; background:linear-gradient(135deg,#141414 0%,#080808 62%,rgba(227,177,23,0.14) 100%); border-bottom:1px solid rgba(227,177,23,0.18);">
                <img src="${escapeHtml(input.logoUrl)}" width="150" alt="MekLoc" style="display:block; max-width:150px; height:auto; margin-bottom:22px;">
                <div style="display:inline-block; padding:7px 12px; border-radius:999px; border:1px solid rgba(227,177,23,0.38); color:#F5C542; font-size:11px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase;">Nouvelle demande</div>
                <h1 style="margin:18px 0 8px; color:#FFFFFF; font-size:30px; line-height:1.18; font-weight:900;">MekLoc — Nouvelle demande d’accès ✅</h1>
                <p style="margin:0; color:#D4D4D8; font-size:15px; line-height:1.7;">Email vérifié le ${escapeHtml(formatDate(input.emailVerifiedAt))}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:18px; border:1px solid rgba(255,255,255,0.10); background:#101010;">
                  <tr>
                    <td style="padding:20px;">
                      <h2 style="margin:0 0 8px; color:#F5C542; font-size:13px; letter-spacing:2px; text-transform:uppercase;">Informations de l’agence</h2>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        ${row('Agence', input.agencyName)}
                        ${row('Responsable', input.ownerName)}
                        ${row('Adresse', input.address)}
                        ${row('Ville', input.city)}
                        ${row('Pays', input.country)}
                        ${row('Email', input.email)}
                        ${row('Téléphone', input.phone)}
                        ${row('Site / Instagram', input.websiteUrl || 'Non renseigné')}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:18px; border:1px solid rgba(227,177,23,0.20); background:linear-gradient(135deg,rgba(227,177,23,0.10),#101010 48%,#0A0A0A);">
                  <tr>
                    <td style="padding:20px;">
                      <h2 style="margin:0 0 8px; color:#F5C542; font-size:13px; letter-spacing:2px; text-transform:uppercase;">Abonnement choisi</h2>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        ${row('Formule', input.planName)}
                        ${row('Facturation', billingLabel(input.billingType))}
                        ${row('Nombre de véhicules', input.vehicleCount)}
                        ${row('Code promo', input.promoCode || 'Aucun')}
                        ${row('CGU acceptées', input.termsAccepted ? 'Oui' : 'Non')}
                        ${row('Email vérifié', 'Oui')}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 28px 28px;">
                <a href="${escapeHtml(adminUrl)}" style="display:inline-block; background:#E3B117; color:#080808; text-decoration:none; font-size:15px; font-weight:900; padding:15px 24px; border-radius:14px;">Ouvrir le panneau admin</a>
                <p style="margin:22px 0 0; color:#A1A1AA; font-size:12px; line-height:1.7;">
                  Vous recevez cet email car vous êtes administrateur MekLoc.<br>
                  Support : <a href="mailto:contact@mekloc.com" style="color:#F5C542; text-decoration:none;">contact@mekloc.com</a>
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return json(req, { success: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('send-access-request-email missing RESEND_API_KEY');
      return json(req, { success: false, error: 'missing_resend_api_key' }, 500);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json(req, { success: false, error: 'invalid_json_body' }, 400);
    }

    const siteUrl = getSiteUrl();
    const logoUrl = getLogoUrl(siteUrl);
    const adminEmail = getAdminEmail();
    const fromEmail = getFromEmail();
    const agencyName = sanitizeText((body as Record<string, unknown>).agencyName, 140);
    const ownerName = sanitizeText((body as Record<string, unknown>).ownerName, 140);
    const email = sanitizeText((body as Record<string, unknown>).email, 254).toLowerCase();
    const ip = clientIp(req);

    if (!agencyName || !ownerName || !isEmail(email)) {
      return json(req, { success: false, error: 'missing_required_fields' }, 400);
    }
    if (!checkRateLimit(`ip:${ip}`, 20, 60 * 60 * 1000) || !checkRateLimit(`email:${email}`, 5, 60 * 60 * 1000)) {
      return json(req, { success: false, error: 'rate_limited' }, 429);
    }

    const input = {
      agencyName,
      ownerName,
      address: sanitizeText((body as Record<string, unknown>).address, 220),
      city: sanitizeText((body as Record<string, unknown>).city, 100),
      country: sanitizeText((body as Record<string, unknown>).country || 'Maroc', 100),
      email,
      phone: sanitizeText((body as Record<string, unknown>).phone, 80),
      websiteUrl: sanitizeText((body as Record<string, unknown>).websiteUrl, 220),
      planName: sanitizeText((body as Record<string, unknown>).planName, 80),
      billingType: sanitizeText((body as Record<string, unknown>).billingType, 30),
      vehicleCount: sanitizeText((body as Record<string, unknown>).vehicleCount, 20),
      promoCode: sanitizeText((body as Record<string, unknown>).promoCode, 80),
      emailVerifiedAt: sanitizeText((body as Record<string, unknown>).emailVerifiedAt, 80),
      termsAccepted: Boolean((body as Record<string, unknown>).termsAccepted),
      siteUrl,
      logoUrl,
    };

    const subject = `Nouvelle demande d’accès MekLoc — ${agencyName}`;
    const text = [
      'MekLoc — Nouvelle demande d’accès',
      `Agence: ${agencyName}`,
      `Responsable: ${ownerName}`,
      `Email: ${email}`,
      `Téléphone: ${input.phone || 'Non renseigné'}`,
      `Formule: ${input.planName || 'Non renseigné'}`,
      `Facturation: ${billingLabel(input.billingType)}`,
      `Véhicules: ${input.vehicleCount || 'Non renseigné'}`,
      `Admin: ${siteUrl}/dashboard`,
    ].join('\n');
    const html = buildAdminNotificationHtml(input);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        subject,
        text,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const details = await resendResponse.text();
      console.error('send-access-request-email resend failed', { status: resendResponse.status, details });
      return json(req, { success: false, error: 'resend_failed' }, 502);
    }

    return json(req, { success: true });
  } catch (error) {
    console.error('send-access-request-email failed', error);
    return json(req, { success: false, error: 'internal_error' }, 500);
  }
});
