const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type NotificationType = 'trial_started' | 'trial_reminder_3d' | 'trial_reminder_1d' | 'trial_expired' | 'payment_confirmed';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Session admin manquante.' }, 401);

    const projectUrl = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const resendKey = Deno.env.get('RESEND_API_KEY') || '';
    if (!projectUrl || !serviceRole || !anonKey) throw new Error('Configuration Supabase incomplète.');

    const userRes = await fetch(`${projectUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authHeader },
    });
    if (!userRes.ok) return json({ error: 'Session admin invalide.' }, 401);
    const user = await userRes.json() as { id?: string };
    const serviceHeaders = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' };
    const adminRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(user.id || '')}&select=is_super_admin&limit=1`, { headers: serviceHeaders });
    const admins = await adminRes.json() as Array<{ is_super_admin?: boolean }>;
    if (!admins[0]?.is_super_admin) return json({ error: 'Accès Super Admin requis.' }, 403);

    const body = await req.json() as { agencyId?: string; type?: NotificationType };
    if (!body.agencyId || !body.type) return json({ error: 'Agence et type requis.' }, 400);
    const agencyRes = await fetch(`${projectUrl}/rest/v1/agencies?id=eq.${encodeURIComponent(body.agencyId)}&select=id,name,plan,monthly_price,trial_ends_at,paid_until&limit=1`, { headers: serviceHeaders });
    const agencies = await agencyRes.json() as Array<{ id: string; name: string; plan: string; monthly_price: number; trial_ends_at?: string | null; paid_until?: string | null }>;
    const agency = agencies[0];
    if (!agency) return json({ error: 'Agence introuvable.' }, 404);
    const ownerRes = await fetch(`${projectUrl}/rest/v1/users_profiles?agency_id=eq.${encodeURIComponent(body.agencyId)}&role=eq.owner&select=full_name,email&limit=1`, { headers: serviceHeaders });
    const owners = await ownerRes.json() as Array<{ full_name?: string | null; email?: string | null }>;
    const owner = owners[0];
    if (!owner?.email) return json({ error: 'Email propriétaire introuvable.' }, 400);
    if (!resendKey) return json({ sent: false, error: 'RESEND_API_KEY manquante.' });

    const labels: Record<NotificationType, { subject: string; title: string; message: string }> = {
      trial_started: {
        subject: 'Votre essai gratuit MekLoc de 7 jours est activé',
        title: 'Bienvenue dans votre essai MekLoc',
        message: `Votre agence dispose maintenant de 7 jours pour tester toutes les fonctionnalités du plan ${agency.plan}.`,
      },
      trial_reminder_3d: {
        subject: 'Votre essai MekLoc arrive bientôt à échéance',
        title: 'Plus que 3 jours d’essai gratuit',
        message: `Votre accès d’essai se termine le ${agency.trial_ends_at ? new Date(agency.trial_ends_at).toLocaleDateString('fr-FR') : 'prochainement'}.`,
      },
      trial_reminder_1d: {
        subject: 'Dernier jour de votre essai MekLoc',
        title: 'Plus qu’un jour pour profiter de MekLoc',
        message: `Votre accès d’essai se termine le ${agency.trial_ends_at ? new Date(agency.trial_ends_at).toLocaleDateString('fr-FR') : 'prochainement'}.`,
      },
      trial_expired: {
        subject: 'Votre essai gratuit MekLoc est terminé',
        title: 'Votre essai est arrivé à échéance',
        message: 'Vos données sont conservées. Contactez MekLoc pour réactiver immédiatement votre espace.',
      },
      payment_confirmed: {
        subject: 'Votre abonnement MekLoc est activé',
        title: 'Paiement confirmé',
        message: `Votre abonnement est actif jusqu’au ${agency.paid_until ? new Date(agency.paid_until).toLocaleDateString('fr-FR') : 'prochain renouvellement'}.`,
      },
    };
    const content = labels[body.type];
    const appUrl = (Deno.env.get('PUBLIC_SITE_URL') || 'https://mekloc.com').replace(/\/$/, '');
    const html = `<div style="background:#070807;padding:32px;font-family:Arial,sans-serif;color:#fff"><div style="max-width:620px;margin:auto;border:1px solid #4f4015;border-radius:22px;padding:30px;background:#101111"><p style="color:#f5c542;font-weight:700;letter-spacing:.14em">MEKLOC</p><h1>${escapeHtml(content.title)}</h1><p style="color:#c8c8c8;line-height:1.7">Bonjour ${escapeHtml(owner.full_name || agency.name)},</p><p style="color:#c8c8c8;line-height:1.7">${escapeHtml(content.message)}</p><p><strong>${escapeHtml(agency.name)}</strong> · ${escapeHtml(agency.plan.toUpperCase())} · ${Number(agency.monthly_price || 0)} MAD</p><a href="${appUrl}/auth" style="display:inline-block;margin-top:18px;padding:13px 20px;border-radius:12px;background:#e3b117;color:#080808;font-weight:800;text-decoration:none">Ouvrir MekLoc</a></div></div>`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') || 'MekLoc <contact@mekloc.com>',
        to: [owner.email],
        subject: content.subject,
        html,
      }),
    });
    if (!response.ok) return json({ sent: false, error: `Resend ${response.status}: ${await response.text()}` });
    const timestampField = body.type === 'trial_reminder_3d'
      ? 'trial_reminder_3d_sent_at'
      : body.type === 'trial_reminder_1d'
        ? 'trial_reminder_1d_sent_at'
        : body.type === 'trial_expired'
          ? 'trial_expired_email_sent_at'
          : 'last_trial_email_sent_at';
    await fetch(`${projectUrl}/rest/v1/agencies?id=eq.${encodeURIComponent(body.agencyId)}`, {
      method: 'PATCH',
      headers: serviceHeaders,
      body: JSON.stringify({ [timestampField]: new Date().toISOString() }),
    });
    return json({ sent: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erreur inconnue.' }, 400);
  }
});
