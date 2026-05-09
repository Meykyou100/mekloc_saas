import { Banknote, CalendarClock, CheckCircle2, Crown, FileText, RefreshCw, ShieldAlert, Trash2, UserPlus, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth, type AccountStatus, type AgencyPlan, type BillingStatus, type PaymentMethod } from '../context/AuthContext';
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
      const reqs = (reqRes.data || []) as AccessRequestRow[];
      setAccessRequests(reqs);
      setRequestNotes(Object.fromEntries(reqs.map((r) => [r.id, r.admin_notes || ''])));

      const profiles = (usersRes.data || []) as Array<{ agency_id: string | null; account_status: AccountStatus; email: string | null }>;
      const vehicles = (vehicleRes.data || []) as Array<{ agency_id: string | null }>;
      const mapped = ((agencyRes.data || []) as Array<{ id: string; name: string; plan: AgencyPlan; billing_status: BillingStatus; next_payment_due_date: string | null; monthly_price: number | null }>)
        .map((a) => ({
          id: a.id,
          agencyName: a.name,
          email: profiles.find((p) => p.agency_id === a.id)?.email || '—',
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

  async function createOrLinkProfileFromRequest(request: AccessRequestRow, agencyId: string) {
    if (!supabase) return;
    const email = request.email.trim().toLowerCase();
    const { data: existingProfile } = await supabase
      .from('users_profiles')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (existingProfile?.id) {
      await supabase.from('users_profiles').update({ agency_id: agencyId, account_status: 'active' }).eq('id', existingProfile.id);
      const webhook = import.meta.env.VITE_CREATE_APPROVED_USER_WEBHOOK as string | undefined;
      if (webhook) {
        await fetch(webhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
            'x-internal-key': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({ email, agencyId }),
        });
      }
    } else {
      const webhook = import.meta.env.VITE_CREATE_APPROVED_USER_WEBHOOK as string | undefined;
      if (!webhook) {
        notify({ title: 'Webhook invitation manquant', message: 'Configurez VITE_CREATE_APPROVED_USER_WEBHOOK.', type: 'warning' });
        return;
      }
      const response = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          'x-internal-key': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ email, agencyId }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Invitation impossible: ${text}`);
      }
      notify({ title: 'Invitation envoyée', message: 'Le client va recevoir un email pour définir son mot de passe.', type: 'success' });
    }
  }

  async function approveRequest(request: AccessRequestRow) {
    if (!supabase || !isSupabaseConfigured) return;
    const plan = request.selected_plan || 'starter';
    const monthlyPrice = monthlyPriceByPlan[plan];
    const now = new Date().toISOString().slice(0, 10);
    const nextDue = addDays(now, 30);

    const { data: existingAgency } = await supabase
      .from('agencies')
      .select('id')
      .eq('name', request.agency_name)
      .limit(1)
      .maybeSingle();

    let agencyId = existingAgency?.id;
    if (!agencyId) {
      const { data: created, error } = await supabase
        .from('agencies')
        .insert({
          name: request.agency_name,
          slug: `${request.agency_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-5)}`,
          created_by: profile?.id || null,
          plan,
          billing_status: 'trial',
          subscription_start_date: now,
          subscription_end_date: nextDue,
          next_payment_due_date: nextDue,
          monthly_price: monthlyPrice,
        })
        .select('id')
        .single();
      if (error) throw error;
      agencyId = created.id;
    } else {
      await supabase
        .from('agencies')
        .update({
          plan,
          billing_status: 'trial',
          next_payment_due_date: nextDue,
          monthly_price: monthlyPrice,
        })
        .eq('id', agencyId);
    }

    await createOrLinkProfileFromRequest(request, agencyId);
    await updateRequest(request.id, { status: 'approved' }, 'Demande approuvée');
    await loadAll();
  }

  async function deleteRequest() {
    if (!requestToDelete || !supabase) return;
    const { error } = await supabase.from('access_requests').delete().eq('id', requestToDelete.id);
    if (error) throw error;
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
    for (const table of ['payments', 'contracts', 'reservations', 'maintenance', 'clients', 'vehicles', 'users_profiles']) {
      const { error } = await supabase.from(table).delete().eq('agency_id', agency.id);
      if (error) throw error;
    }
    const { error } = await supabase.from('agencies').delete().eq('id', agency.id);
    if (error) throw error;
    await loadAll();
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
                    const existingAgency = agencies.find((a) => a.agencyName === req.agency_name);
                    if (!existingAgency) return notify({ title: 'Agence introuvable', message: 'Approuvez d’abord la demande.', type: 'warning' });
                    await createOrLinkProfileFromRequest(req, existingAgency.id);
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
