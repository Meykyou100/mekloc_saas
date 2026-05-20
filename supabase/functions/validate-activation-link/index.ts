import { defaultCorsHeaders as corsHeaders, getSupabaseConfig, json, serviceHeaders } from '../_shared/security.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { projectUrl, serviceRole } = getSupabaseConfig();
    const { token } = await req.json() as { token?: string };
    const safeToken = String(token || '').trim();
    if (!safeToken) return json(corsHeaders, { valid: false, reason: 'missing' }, 400);

    const res = await fetch(`${projectUrl}/rest/v1/activation_links?token=eq.${encodeURIComponent(safeToken)}&select=id,email,agency_id,role,expires_at,used_at&limit=1`, {
      headers: serviceHeaders(serviceRole),
    });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json() as Array<{ email: string; agency_id: string | null; role: string | null; expires_at: string; used_at: string | null }>;
    const link = rows?.[0];
    if (!link) return json(corsHeaders, { valid: false, reason: 'not_found' }, 404);
    if (link.used_at) return json(corsHeaders, { valid: false, reason: 'used' }, 410);
    if (new Date(link.expires_at).getTime() <= Date.now()) return json(corsHeaders, { valid: false, reason: 'expired' }, 410);

    return json(corsHeaders, {
      valid: true,
      email: link.email,
      agency_id: link.agency_id,
      role: link.role,
      expires_at: link.expires_at,
    });
  } catch (error) {
    console.error('validate-activation-link failed', error instanceof Error ? error.message : error);
    return json(corsHeaders, { valid: false, reason: 'server_error' }, 500);
  }
});
