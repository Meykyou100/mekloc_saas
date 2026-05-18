import { defaultCorsHeaders as corsHeaders, json, requireSuperAdmin } from '../_shared/security.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return json(corsHeaders, { error: auth.error }, auth.status);

    const body = await req.json();
    const { email, agencyId, redirectTo } = body as { email: string; agencyId: string; redirectTo?: string };
    if (!email || !agencyId) return json(corsHeaders, { error: 'Paramètres invalides.' }, 400);

    const normalized = email.trim().toLowerCase();
    const serviceHeaders = {
      apikey: auth.serviceRole,
      Authorization: `Bearer ${auth.serviceRole}`,
      'Content-Type': 'application/json',
    };

    const adminRes = await fetch(`${auth.projectUrl}/auth/v1/invite`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        email: normalized,
        data: { agency_id: agencyId },
        ...(redirectTo ? { redirect_to: redirectTo } : {}),
      }),
    });

    if (!adminRes.ok) {
      const text = await adminRes.text();
      if (/email_exists|already|registered/i.test(text)) {
        const recoverRes = await fetch(`${auth.projectUrl}/auth/v1/recover`, {
          method: 'POST',
          headers: { apikey: auth.anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalized,
            ...(redirectTo ? { redirect_to: redirectTo } : {}),
          }),
        });
        if (!recoverRes.ok) {
          console.error('create-approved-user recovery failed', await recoverRes.text());
          return json(corsHeaders, { error: 'Invitation impossible.' }, 400);
        }
        return json(corsHeaders, { success: true, info: 'password_recovery_sent' });
      }
      console.error('create-approved-user invite failed', text);
      return json(corsHeaders, { error: 'Invitation impossible.' }, 400);
    }

    return json(corsHeaders, { success: true });
  } catch (error) {
    console.error('create-approved-user failed', error);
    return json(corsHeaders, { error: 'Invitation impossible.' }, 500);
  }
});
