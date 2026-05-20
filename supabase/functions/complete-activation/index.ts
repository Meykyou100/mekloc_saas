import { defaultCorsHeaders as corsHeaders, getSupabaseConfig, json, serviceHeaders } from '../_shared/security.ts';

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function extractUserId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const obj = payload as Record<string, unknown>;
  if (typeof obj.id === 'string') return obj.id;
  const user = obj.user && typeof obj.user === 'object' ? obj.user as Record<string, unknown> : null;
  if (typeof user?.id === 'string') return user.id;
  const data = obj.data && typeof obj.data === 'object' ? obj.data as Record<string, unknown> : null;
  const dataUser = data?.user && typeof data.user === 'object' ? data.user as Record<string, unknown> : null;
  return typeof dataUser?.id === 'string' ? dataUser.id : '';
}

async function findOrCreateAuthUser(projectUrl: string, serviceRole: string, email: string) {
  const headers = serviceHeaders(serviceRole);
  const lookupRes = await fetch(`${projectUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers });
  if (lookupRes.ok) {
    const payload = await lookupRes.json() as { users?: Array<{ id?: string }> };
    const found = payload.users?.find((item) => normalizeEmail((item as { email?: string }).email || email) === email) || payload.users?.[0];
    if (found?.id) return found.id;
  }

  const createRes = await fetch(`${projectUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { source: 'mekloc-short-activation' } }),
  });
  const createText = await createRes.text();
  if (!createRes.ok && !/already|exists|registered/i.test(createText)) throw new Error(createText || 'Création utilisateur impossible.');
  if (createRes.ok) return extractUserId(JSON.parse(createText));

  const retryRes = await fetch(`${projectUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers });
  const retryPayload = await retryRes.json() as { users?: Array<{ id?: string }> };
  return retryPayload.users?.[0]?.id || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { projectUrl, serviceRole } = getSupabaseConfig();
    const { token, password } = await req.json() as { token?: string; password?: string };
    const safeToken = String(token || '').trim();
    const nextPassword = String(password || '');
    if (!safeToken) return json(corsHeaders, { success: false, error: 'Lien manquant.' }, 400);
    if (nextPassword.length < 8) return json(corsHeaders, { success: false, error: 'Mot de passe trop court.' }, 400);

    const headers = serviceHeaders(serviceRole);
    const linkRes = await fetch(`${projectUrl}/rest/v1/activation_links?token=eq.${encodeURIComponent(safeToken)}&select=*&limit=1`, { headers });
    if (!linkRes.ok) throw new Error(await linkRes.text());
    const rows = await linkRes.json() as Array<{ id: string; email: string; agency_id: string | null; role: string | null; expires_at: string; used_at: string | null }>;
    const link = rows?.[0];
    if (!link) return json(corsHeaders, { success: false, error: 'Lien introuvable.' }, 404);
    if (link.used_at) return json(corsHeaders, { success: false, error: 'Ce lien a déjà été utilisé.' }, 410);
    if (new Date(link.expires_at).getTime() <= Date.now()) return json(corsHeaders, { success: false, error: 'Ce lien a expiré.' }, 410);

    const email = normalizeEmail(link.email);
    const userId = await findOrCreateAuthUser(projectUrl, serviceRole, email);
    if (!userId) throw new Error('Utilisateur Auth introuvable.');

    const updateUserRes = await fetch(`${projectUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password: nextPassword, email_confirm: true }),
    });
    if (!updateUserRes.ok) throw new Error(await updateUserRes.text());

    if (link.agency_id) {
      const profilePayload = {
        id: userId,
        email,
        agency_id: link.agency_id,
        role: link.role || 'agent',
        account_status: 'active',
        is_super_admin: false,
      };
      const profileRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(userId)}&select=id&limit=1`, { headers });
      const profiles = profileRes.ok ? await profileRes.json() as Array<{ id: string }> : [];
      if (profiles?.[0]?.id) {
        const updateProfileRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(profilePayload),
        });
        if (!updateProfileRes.ok) throw new Error(await updateProfileRes.text());
      } else {
        const insertProfileRes = await fetch(`${projectUrl}/rest/v1/users_profiles`, {
          method: 'POST',
          headers,
          body: JSON.stringify([profilePayload]),
        });
        if (!insertProfileRes.ok) throw new Error(await insertProfileRes.text());
      }
    }

    const markUsedRes = await fetch(`${projectUrl}/rest/v1/activation_links?id=eq.${encodeURIComponent(link.id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    });
    if (!markUsedRes.ok) throw new Error(await markUsedRes.text());

    console.log('complete-activation: complete', { email, userId, agencyId: link.agency_id });
    return json(corsHeaders, { success: true, email });
  } catch (error) {
    console.error('complete-activation failed', error instanceof Error ? error.message : error);
    return json(corsHeaders, { success: false, error: error instanceof Error ? error.message : 'Activation impossible.' }, 500);
  }
});
