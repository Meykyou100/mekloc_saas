import { defaultCorsHeaders as corsHeaders, getAuthUser, getSupabaseConfig, json, serviceHeaders } from '../_shared/security.ts';

type ProfileRow = {
  id: string;
  agency_id: string | null;
  role: string | null;
  account_status: string | null;
  is_super_admin: boolean | null;
  email?: string | null;
};

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin') return 'owner';
  if (['owner', 'manager', 'agent', 'accountant'].includes(role)) return role;
  return 'agent';
}

function randomToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 28);
}

function getAppOrigin(rawOrigin: string | undefined, redirectTo: string | undefined) {
  const configuredOrigin = Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('APP_URL') || 'https://mekloc.com';
  const candidate = rawOrigin || redirectTo || configuredOrigin;
  try {
    const url = new URL(candidate);
    return url.origin;
  } catch {
    return 'https://mekloc.com';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { projectUrl, serviceRole, anonKey } = getSupabaseConfig();
    const headers = serviceHeaders(serviceRole);
    const caller = await getAuthUser(projectUrl, anonKey, req.headers.get('Authorization') || '');
    if (!caller?.id) return json(corsHeaders, { error: 'Session manquante.' }, 401);

    const body = await req.json() as { email?: string; agencyId?: string; role?: string; redirectTo?: string; appOrigin?: string };
    const email = normalizeEmail(body.email);
    if (!email) return json(corsHeaders, { error: 'Email requis.' }, 400);

    const callerRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(caller.id)}&select=id,agency_id,role,account_status,is_super_admin&limit=1`, { headers });
    const callerRows = await callerRes.json() as ProfileRow[];
    const callerProfile = callerRows?.[0];
    const callerRole = normalizeRole(callerProfile?.role);
    if (!callerProfile?.is_super_admin) {
      if (!callerProfile?.agency_id || callerProfile.account_status !== 'active') return json(corsHeaders, { error: 'Compte agence inactif.' }, 403);
      if (callerRole !== 'owner' && callerRole !== 'manager') return json(corsHeaders, { error: 'Accès refusé.' }, 403);
    }

    const targetRes = await fetch(`${projectUrl}/rest/v1/users_profiles?email=ilike.${encodeURIComponent(email)}&select=id,agency_id,role,email&limit=1`, { headers });
    const targetRows = await targetRes.json() as ProfileRow[];
    const target = targetRows?.[0];
    const agencyId = body.agencyId || target?.agency_id || callerProfile?.agency_id || null;
    const role = normalizeRole(body.role || target?.role || 'owner');

    if (!callerProfile?.is_super_admin && agencyId !== callerProfile?.agency_id) {
      return json(corsHeaders, { error: 'Cet utilisateur ne fait pas partie de votre agence.' }, 403);
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const insertRes = await fetch(`${projectUrl}/rest/v1/activation_links`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{
        token,
        email,
        agency_id: agencyId,
        role,
        expires_at: expiresAt,
      }]),
    });
    if (!insertRes.ok) throw new Error(await insertRes.text());

    const origin = getAppOrigin(body.appOrigin, body.redirectTo);
    const activationLink = `${origin}/set-password?token=${encodeURIComponent(token)}`;
    console.log('create-activation-link: created', { email, agencyId, role, expiresAt });
    return json(corsHeaders, { success: true, activationLink, token, expiresAt, email, agencyId, role });
  } catch (error) {
    console.error('create-activation-link failed', error instanceof Error ? error.message : error);
    return json(corsHeaders, { error: error instanceof Error ? error.message : 'Génération du lien impossible.' }, 400);
  }
});
