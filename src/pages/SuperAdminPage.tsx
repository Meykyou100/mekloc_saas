import { Banknote, CalendarClock, CheckCircle2, Crown, FileText, RefreshCw, ShieldAlert, Trash2, UserPlus, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth, type AccountStatus, type AgencyPlan, type BillingStatus } from '../context/AuthContext';
import { formatMAD } from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AccessRequestStatus = 'pending' | 'pending_verification' | 'contacted' | 'payment_pending' | 'approved' | 'rejected' | 'verified';
type AccessRequestRow = {
  id: string;
  agency_name: string;
  owner_name: string;
  email: string;
  phone_country_code: string;
  phone_number: string;
  country: string;
  city: string;
  selected_plan: AgencyPlan;
  billing_type: 'monthly' | 'annual';
  vehicle_count: number;
  status: AccessRequestStatus;
  admin_notes: string | null;
  created_at: string;
  activation_link?: string | null;
};

type AdminAgency = {
  id: string;
  agencyName: string;
  email: string;
  plan: AgencyPlan;
  billingStatus: BillingStatus;
  nextPaymentDueDate: string | null;
  vehiclesCount: number;
  usersCount: number;
  accountStatus: AccountStatus;
  monthlyPrice: number;
};

const monthlyPriceByPlan: Record<AgencyPlan, number> = { starter: 99, pro: 250, business: 499 };

function addDays(baseDate: string | null, days: number) {
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}


export default function SuperAdminPage() {
  const { profile, isSupabaseEnabled, signOut } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accessRequests, setAccessRequests] = useState<AccessRequestRow[]>([]);
  const [agencies, setAgencies] = useState<AdminAgency[]>([]);
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [requestToDelete, setRequestToDelete] = useState<AccessRequestRow | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<AdminAgency | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [activationLinkToCopy, setActivationLinkToCopy] = useState<{ email: string; link: string } | null>(null);

  const loadAll = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [reqRes, agencyRes, usersRes, vehicleRes] = await Promise.all([
        supabase.from('access_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('agencies').select('id,name,plan,billing_status,next_payment_due_date,monthly_price'),
        supabase.from('users_profiles').select('agency_id,account_status,email'),
        supabase.from('vehicles').select('agency_id'),
      ]);
      if (reqRes.error || agencyRes.error || usersRes.error || vehicleRes.error) throw reqRes.error || agencyRes.error || usersRes.error || vehicleRes.error;
      const reqs = ((reqRes.data || []) as AccessRequestRow[]).filter((r) => r.status !== 'approved');
      const approvedReqs = ((reqRes.data || []) as AccessRequestRow[]).filter((r) => r.status === 'approved');
      setAccessRequests(reqs);
      setRequestNotes(Object.fromEntries(reqs.map((r) => [r.id, r.admin_notes || ''])));

      const profiles = (usersRes.data || []) as Array<{ agency_id: string | null; account_status: AccountStatus; email: string | null }>;
      const vehicles = (vehicleRes.data || []) as Array<{ agency_id: string | null }>;
      const mapped = ((agencyRes.data || []) as Array<{ id: string; name: string; plan: AgencyPlan; billing_status: BillingStatus; next_payment_due_date: string | null; monthly_price: number | null }>)
        .map((a) => ({
          id: a.id,
          agencyName: a.name,
          email: profiles.find((p) => p.agency_id === a.id)?.email || approvedReqs.find((r) => r.agency_name === a.name)?.email || '—',
          plan: a.plan || 'starter',
          billingStatus: a.billing_status || 'trial',
          nextPaymentDueDate: a.next_payment_due_date,
          vehiclesCount: vehicles.filter((v) => v.agency_id === a.id).length,
          usersCount: profiles.filter((p) => p.agency_id === a.id).length,
          accountStatus: profiles.find((p) => p.agency_id === a.id)?.account_status || 'pending',
          monthlyPrice: Number(a.monthly_price || monthlyPriceByPlan[a.plan || 'starter']),
        }));
      setAgencies(mapped);
    } catch (error) {
      notify({ title: 'Erreur chargement', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function runAction(key: string, action: () => Promise<void>) {
    setActionLoading((curr) => ({ ...curr, [key]: true }));
    try {
      await action();
    } catch (error) {
      notify({
        title: 'Action impossible',
        message: error instanceof Error ? error.message : 'Veuillez réessayer.',
        type: 'warning',
      });
    } finally {
      setActionLoading((curr) => ({ ...curr, [key]: false }));
    }
  }

  async function updateRequest(id: string, patch: Partial<AccessRequestRow>, toast: string) {
    if (!supabase || !isSupabaseConfigured) return;
    const { error } = await supabase.from('access_requests').update(patch).eq('id', id);
    if (error) throw error;
    setAccessRequests((curr) => curr.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    notify({ title: toast, type: 'success' });
  }

  async function approveRequest(request: AccessRequestRow) {
    if (!supabase || !isSupabaseConfigured) return;
    const webhook = import.meta.env.VITE_APPROVE_ACCESS_REQUEST_WEBHOOK as string | undefined;
    if (!webhook) throw new Error('Webhook approbation manquant. Configurez VITE_APPROVE_ACCESS_REQUEST_WEBHOOK.');
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Session admin introuvable. Reconnectez-vous puis réessayez.');
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        'x-internal-key': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({
        accessRequestId: request.id,
        redirectTo: `${window.location.origin}/set-password`,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Approbation impossible');
    if (payload?.activationLink) {
      await supabase.from('access_requests').update({ activation_link: payload.activationLink }).eq('id', request.id);
    }
    if (payload?.inviteInfo === 'email_failed') {
      notify({
        title: "Demande approuvée",
        message: "Compte approuvé. Email d’activation non envoyé, utilisez “Créer compte client” pour copier le lien.",
        type: 'warning',
      });
    } else {
      notify({ title: "Demande approuvée", message: "Un lien d’activation a été envoyé au client.", type: 'success' });
    }
    await loadAll();
  }

  async function deleteRequest() {
    if (!requestToDelete || !supabase) return;
    const webhook = import.meta.env.VITE_DELETE_ACCESS_REQUEST_WEBHOOK as string | undefined;
    if (!webhook) throw new Error('Webhook suppression demande manquant. Configurez VITE_DELETE_ACCESS_REQUEST_WEBHOOK.');
    const archivedPayload = {
      original_request_id: requestToDelete.id,
      agency_name: requestToDelete.agency_name,
      owner_name: requestToDelete.owner_name,
      email: requestToDelete.email,
      phone_country_code: requestToDelete.phone_country_code,
      phone_number: requestToDelete.phone_number,
      country: requestToDelete.country,
      city: requestToDelete.city,
      selected_plan: requestToDelete.selected_plan,
      billing_type: requestToDelete.billing_type,
      vehicle_count: requestToDelete.vehicle_count,
      status: requestToDelete.status,
      admin_notes: requestToDelete.admin_notes,
      deleted_by: profile?.id ?? null,
      deleted_reason: 'Suppression depuis Super Admin',
    };
    await supabase.from('deleted_access_requests').insert(archivedPayload);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Session admin introuvable. Reconnectez-vous puis réessayez.');
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        'x-internal-key': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ requestId: requestToDelete.id }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Suppression demande impossible: ${text}`);
    }
    setAccessRequests((curr) => curr.filter((r) => r.id !== requestToDelete.id));
    setRequestToDelete(null);
    notify({ title: 'Demande supprimée', type: 'success' });
  }

  async function changeAgencyPlan(agency: AdminAgency, plan: AgencyPlan) {
    if (!supabase) return;
    const { error } = await supabase.from('agencies').update({ plan, monthly_price: monthlyPriceByPlan[plan] }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function markBilling(agency: AdminAgency, status: BillingStatus) {
    if (!supabase) return;
    const { error } = await supabase.from('agencies').update({ billing_status: status }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function extendSubscription(agency: AdminAgency, days: number) {
    if (!supabase) return;
    const { error } = await supabase.from('agencies').update({ next_payment_due_date: addDays(agency.nextPaymentDueDate, days) }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function suspendAgency(agency: AdminAgency) {
    if (!supabase) return;
    const { error } = await supabase.from('users_profiles').update({ account_status: 'suspended' }).eq('agency_id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function deleteAgency(agency: AdminAgency) {
    if (!supabase) return;
    const webhook = import.meta.env.VITE_DELETE_AGENCY_ACCOUNT_WEBHOOK as string | undefined;
    if (!webhook) {
      throw new Error('Webhook suppression manquant. Configurez VITE_DELETE_AGENCY_ACCOUNT_WEBHOOK.');
    }
    const { data: linkedProfiles } = await supabase.from('users_profiles').select('id,email').eq('agency_id', agency.id);
    const ownerEmail = linkedProfiles?.[0]?.email || agency.email || null;
    await supabase.from('deleted_access_accounts').insert({
      agency_id: agency.id,
      agency_name: agency.agencyName,
      owner_email: ownerEmail,
      owner_profile_id: linkedProfiles?.[0]?.id ?? null,
      plan: agency.plan,
      billing_status: agency.billingStatus,
      deleted_by: profile?.id ?? null,
      deleted_reason: 'Suppression depuis Super Admin',
    });
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Session admin introuvable. Reconnectez-vous puis réessayez.');

    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        'x-internal-key': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ agencyId: agency.id }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Suppression définitive impossible: ${text}`);
    }
    setAgencies((curr) => curr.filter((a) => a.id !== agency.id));
    await loadAll();
  }

  async function generateActivationLinkForEmail(email: string) {
    if (!supabase) return;
    const webhook = import.meta.env.VITE_GENERATE_ACTIVATION_LINK_WEBHOOK as string | undefined;
    if (!webhook) throw new Error('Webhook génération lien manquant. Configurez VITE_GENERATE_ACTIVATION_LINK_WEBHOOK.');
    const normalized = email.trim().toLowerCase();
    if (!normalized || normalized === '—') throw new Error('Email client introuvable.');
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Session admin introuvable. Reconnectez-vous puis réessayez.');
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        'x-internal-key': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ email: normalized, redirectTo: `${window.location.origin}/set-password` }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Génération du lien impossible');
    if (payload?.activationLink) {
      setActivationLinkToCopy({ email: normalized, link: payload.activationLink });
      try {
        await navigator.clipboard.writeText(payload.activationLink);
        notify({ title: 'Lien copié', message: 'Lien d’activation copié. Envoyez-le au client via WhatsApp ou Gmail.', type: 'success' });
      } catch {
        notify({
          title: 'Lien généré',
          message: 'Safari a bloqué la copie automatique. Copiez le lien affiché manuellement.',
          type: 'warning',
        });
      }
      return;
    }
    if (payload?.inviteSent) {
      notify({ title: 'Invitation envoyée', message: "Le client a reçu un email d’activation.", type: 'success' });
      return;
    }
    notify({ title: 'Action effectuée', message: 'Activation traitée avec succès.', type: 'success' });
  }

  if (!isSupabaseEnabled || !profile?.isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Espace sécurisé"
          title="Super Admin"
          description="Gestion des demandes d’accès et des comptes agences."
          action={<div className="flex gap-2"><Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={loading} onClick={loadAll}>Actualiser</Button><Button variant="secondary" onClick={async () => { await signOut(); navigate('/auth'); }}>Déconnexion</Button></div>}
        />

        {activationLinkToCopy ? (
          <Card className="mt-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">Lien d’activation généré</p>
                <p className="mt-1 text-xs text-carbon-400">{activationLinkToCopy.email}</p>
                <input className="form-control mt-3" value={activationLinkToCopy.link} readOnly />
              </div>
              <Button
                variant="secondary"
                className="h-10"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(activationLinkToCopy.link);
                    notify({ title: 'Lien copié', type: 'success' });
                  } catch {
                    notify({ title: 'Copie bloquée', message: 'Sélectionnez le lien et copiez-le manuellement.', type: 'warning' });
                  }
                }}
              >
                Copier
              </Button>
            </div>
          </Card>
        ) : null}

        <Card className="mt-4 overflow-hidden">
          <div className="border-b border-white/10 p-5"><h2 className="text-xl font-bold">Demandes d’accès</h2></div>
          <div className="grid gap-4 p-5">
            {accessRequests.length === 0 ? <p className="text-sm text-carbon-400">Aucune demande d’accès.</p> : accessRequests.map((req) => (
              <div key={req.id} className="premium-surface rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-white">{req.agency_name}</p><Badge>{req.status}</Badge></div>
                <div className="mt-2 grid gap-2 text-sm text-carbon-300 md:grid-cols-3">
                  <p><strong>Agence:</strong> {req.agency_name}</p><p><strong>Responsable:</strong> {req.owner_name}</p><p><strong>Email:</strong> {req.email}</p>
                  <p><strong>Téléphone:</strong> {req.phone_country_code} {req.phone_number}</p><p><strong>Pays:</strong> {req.country}</p><p><strong>Ville:</strong> {req.city}</p>
                  <p><strong>Plan demandé:</strong> {req.selected_plan}</p><p><strong>Facturation:</strong> {req.billing_type === 'annual' ? 'Annuel' : 'Mensuel'}</p><p><strong>Nombre de véhicules:</strong> {req.vehicle_count}</p>
                  <p><strong>Date de demande:</strong> {req.created_at.slice(0, 10)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" loading={Boolean(actionLoading[`req-contact-${req.id}`])} onClick={() => runAction(`req-contact-${req.id}`, async () => updateRequest(req.id, { status: 'contacted' }, 'Marquée contactée'))}>Marquer contactée</Button>
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" loading={Boolean(actionLoading[`req-payment-${req.id}`])} onClick={() => runAction(`req-payment-${req.id}`, async () => updateRequest(req.id, { status: 'payment_pending' }, 'Paiement en attente'))}>Paiement en attente</Button>
                  <Button className="h-8 px-2.5 text-xs" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-approve-${req.id}`])} onClick={() => runAction(`req-approve-${req.id}`, async () => approveRequest(req))}>Approuver</Button>
                  <Button variant="danger" className="h-8 px-2.5 text-xs" icon={<XCircle className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-reject-${req.id}`])} onClick={() => runAction(`req-reject-${req.id}`, async () => updateRequest(req.id, { status: 'rejected' }, 'Demande rejetée'))}>Rejeter</Button>
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" icon={<UserPlus className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-create-${req.id}`])} onClick={() => runAction(`req-create-${req.id}`, async () => {
                    if (!req.activation_link) return notify({ title: 'Lien indisponible', message: "Aucun lien d’activation enregistré.", type: 'warning' });
                    setActivationLinkToCopy({ email: req.email, link: req.activation_link });
                    try {
                      await navigator.clipboard.writeText(req.activation_link);
                      notify({ title: 'Lien copié', message: 'Lien d’activation copié dans le presse-papiers.', type: 'success' });
                    } catch {
                      notify({ title: 'Lien affiché', message: 'Safari a bloqué la copie automatique. Copiez le lien affiché manuellement.', type: 'warning' });
                    }
                  })}>Créer compte client</Button>
                  <Button variant="danger" className="h-8 px-2.5 text-xs" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setRequestToDelete(req)}>Supprimer la demande</Button>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                  <textarea className="form-control min-h-16" value={requestNotes[req.id] || ''} onChange={(e) => setRequestNotes((c) => ({ ...c, [req.id]: e.target.value }))} placeholder="Notes admin..." />
                  <Button variant="secondary" className="h-10" icon={<FileText className="h-4 w-4" />} loading={Boolean(actionLoading[`req-note-${req.id}`])} onClick={() => runAction(`req-note-${req.id}`, async () => updateRequest(req.id, { admin_notes: requestNotes[req.id] || '' }, 'Note enregistrée'))}>Enregistrer note admin</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5"><h2 className="text-xl font-bold">Comptes agences approuvés</h2></div>
          <div className="grid gap-4 p-5">
            {agencies.map((agency) => (
              <div key={agency.id} className="premium-surface rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-white">{agency.agencyName}</p><div className="flex gap-2"><Badge>{agency.plan}</Badge><Badge>{agency.billingStatus}</Badge></div></div>
                <div className="mt-2 grid gap-2 text-sm text-carbon-300 md:grid-cols-3">
                  <p><strong>Email:</strong> {agency.email}</p><p><strong>Prochaine échéance:</strong> {agency.nextPaymentDueDate || '-'}</p><p><strong>Véhicules:</strong> {agency.vehiclesCount}</p>
                  <p><strong>Utilisateurs:</strong> {agency.usersCount}</p><p><strong>Statut compte:</strong> {agency.accountStatus}</p><p><strong>Prix:</strong> {formatMAD(agency.monthlyPrice)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<Crown className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-plan-${agency.id}`])} onClick={() => runAction(`agency-plan-${agency.id}`, async () => changeAgencyPlan(agency, agency.plan === 'starter' ? 'pro' : agency.plan === 'pro' ? 'business' : 'starter'))}>Changer plan</Button>
                  <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-paid-${agency.id}`])} onClick={() => runAction(`agency-paid-${agency.id}`, async () => markBilling(agency, 'paid'))}>Marquer payé</Button>
                  <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-unpaid-${agency.id}`])} onClick={() => runAction(`agency-unpaid-${agency.id}`, async () => markBilling(agency, 'unpaid'))}>Marquer non payé</Button>
                  <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-extend-${agency.id}`])} onClick={() => runAction(`agency-extend-${agency.id}`, async () => extendSubscription(agency, 30))}>Prolonger abonnement</Button>
                  <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-link-${agency.id}`])} onClick={() => runAction(`agency-link-${agency.id}`, async () => generateActivationLinkForEmail(agency.email))}>Générer lien d’activation</Button>
                  <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-suspend-${agency.id}`])} onClick={() => runAction(`agency-suspend-${agency.id}`, async () => suspendAgency(agency))}>Suspendre compte</Button>
                  <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setAgencyToDelete(agency)}>Supprimer le compte</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={Boolean(requestToDelete)} onClose={() => setRequestToDelete(null)} title="Confirmer la suppression">
        <p className="text-sm text-carbon-300">Voulez-vous vraiment supprimer cette demande ?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRequestToDelete(null)}>Annuler</Button>
          <Button variant="danger" loading={Boolean(actionLoading['delete-request'])} onClick={() => runAction('delete-request', deleteRequest)}>Supprimer</Button>
        </div>
      </Modal>

      <Modal open={Boolean(agencyToDelete)} onClose={() => setAgencyToDelete(null)} title="Confirmer la suppression">
        <p className="text-sm text-carbon-300">Cette action va supprimer l’agence et ses données associées. Continuer ?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAgencyToDelete(null)}>Annuler</Button>
          <Button
            variant="danger"
            loading={Boolean(actionLoading['delete-agency'])}
            onClick={() => runAction('delete-agency', async () => {
              if (!agencyToDelete) return;
              await deleteAgency(agencyToDelete);
              setAgencyToDelete(null);
              notify({ title: 'Compte supprimé', type: 'success' });
            })}
          >
            Supprimer le compte
          </Button>
        </div>
      </Modal>
    </div>
  );
}
