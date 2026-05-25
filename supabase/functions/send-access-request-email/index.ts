// Supabase Edge Function: send-access-request-email
// Sends access-request confirmation email via Resend.
// Deploy with: supabase functions deploy send-access-request-email

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const rateBuckets = new Map<string, number[]>();

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildAccessRequestHtml(input: { ownerName: string; email: string; selectedPlan: string }) {
  return `
  <div style="font-family: Inter, Arial, sans-serif; background:#070909; color:#F5F5F5; padding:24px;">
    <div style="max-width:620px; margin:0 auto; border:1px solid rgba(255,255,255,0.12); border-radius:16px; background:#0F1115; overflow:hidden;">
      <div style="padding:18px 22px; border-bottom:1px solid rgba(255,255,255,0.08);">
        <h2 style="margin:0; font-size:20px; color:#D4A017;">MekLoc</h2>
        <p style="margin:6px 0 0; color:#B8BDC7; font-size:13px;">Smart Rental Management System</p>
      </div>
      <div style="padding:22px;">
        <p style="margin:0 0 14px;">Bonjour ${input.ownerName || 'cher client'},</p>
        <p style="margin:0 0 14px; color:#DDE2EA;">
          Nous avons bien reçu votre demande d’accès pour le plan <strong style="color:#F5F5F5;">${input.selectedPlan}</strong>.
        </p>
        <p style="margin:0 0 14px; color:#DDE2EA;">
          Vérifiez votre messagerie et cliquez sur le lien de confirmation pour valider votre demande.
        </p>
        <p style="margin:0 0 14px; color:#DDE2EA;">
          Vérifiez aussi vos spams si vous ne trouvez pas l’email. Le lien expire dans 24h.
        </p>
        <div style="margin-top:20px; font-size:12px; color:#8A8F98;">
          Cet email a été envoyé à ${input.email}
        </div>
        <div style="margin-top:10px; font-size:12px; color:#8A8F98;">
          Besoin d’aide ? Contactez-nous : contact@mekloc.com
        </div>
      </div>
    </div>
  </div>`;
}

function getFromEmail() {
  return Deno.env.get('RESEND_FROM_EMAIL') || 'MekLoc <contact@mekloc.com>';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = getFromEmail();

    if (!resendApiKey) {
      console.error('send-access-request-email missing RESEND_API_KEY');
      return json({ success: true, accepted: true });
    }

    const body = await req.json();
    const { to, ownerName, selectedPlan } = body as {
      to?: string;
      ownerName?: string;
      selectedPlan?: string;
    };

    const normalizedTo = sanitizeText(to, 254).toLowerCase();
    const safeOwnerName = sanitizeText(ownerName, 120);
    const safeSelectedPlan = sanitizeText(selectedPlan, 40) || 'MekLoc';
    const safeSubject = 'Votre demande d’accès MekLoc a été reçue';
    const safeText = `Bonjour ${safeOwnerName || 'cher client'}, nous avons bien reçu votre demande pour le plan ${safeSelectedPlan}.`;
    const safeHtml = buildAccessRequestHtml({ ownerName: safeOwnerName, selectedPlan: safeSelectedPlan, email: normalizedTo });
    const ip = clientIp(req);

    if (!isEmail(normalizedTo)) {
      return json({ success: true, accepted: true });
    }
    if (
      !checkRateLimit(`ip:${ip}`, 8, 60 * 60 * 1000) ||
      !checkRateLimit(`email:${normalizedTo}`, 3, 60 * 60 * 1000)
    ) {
      return json({ success: true, accepted: true });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [normalizedTo],
        subject: safeSubject,
        text: safeText || undefined,
        html: safeHtml || undefined,
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error('Resend request failed', errorBody);
      return json({ success: true, accepted: true });
    }

    return json({ success: true, accepted: true });
  } catch (error) {
    console.error('send-access-request-email failed', error);
    return json({ success: true, accepted: true });
  }
});
