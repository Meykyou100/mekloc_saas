import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Crown,
  FileText,
  Filter,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth, type AccountStatus, type AgencyPlan, type BillingStatus, type PaymentMethod } from '../context/AuthContext';
import { clients, formatMAD, payments, vehicles } from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AdminAgency = {
  id: string;
  agencyName: string;
  ownerName: string;
  email: string;
  phone: string;
  vehiclesCount: number;
  plan: AgencyPlan;
  billingStatus: BillingStatus;
  subscriptionEndDate: string | null;
  lastPaymentDate: string | null;
  nextPaymentDueDate: string | null;
  monthlyPrice: number;
  annualPrice: number;
  billingType: 'monthly' | 'annual';
  usersCount: number;
  accountStatus: AccountStatus;
  createdDate: string;
  paymentMethod: PaymentMethod;
  paymentNotes: string;
};

type FilterValue = 'all' | AccountStatus | BillingStatus;
type AccessRequestStatus = 'pending' | 'contacted' | 'payment_pending' | 'approved' | 'rejected';
type AccessRequestRow = {
  id: string;
  agency_name: string;
  owner_name: string;
  email: string;
  phone_country_code: string;
  phone_number: string;
  city: string;
  selected_plan: string;
  billing_type: 'monthly' | 'annual';
  vehicle_count: number;
  status: AccessRequestStatus;
  admin_notes: string | null;
  created_at: string;
};

const filters: FilterValue[] = ['all', 'pending', 'active', 'suspended', 'rejected', 'overdue', 'paid', 'unpaid'];
const planPrices: Record<AgencyPlan, number> = {
  starter: 99,
  pro: 250,
  business: 499,
};

function addDays(dateValue: string | null | undefined, days: number) {
  const date = dateValue ? new Date(dateValue) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const demoAgencies: AdminAgency[] = [
  {
    id: 'demo-agency-1',
    agencyName: 'Atlas Rent Marrakech',
    ownerName: clients[0].fullName,
    email: clients[0].email,
    phone: clients[0].phone,
    vehiclesCount: vehicles.length,
    plan: 'pro',
    billingStatus: 'paid',
    subscriptionEndDate: '2026-06-01',
    lastPaymentDate: '2026-05-01',
    nextPaymentDueDate: '2026-06-01',
    monthlyPrice: 250,
    annualPrice: 2500,
    billingType: 'monthly',
    usersCount: 3,
    accountStatus: 'active',
    createdDate: '2026-04-18',
    paymentMethod: 'bank_transfer',
    paymentNotes: 'Demo agency account.',
  },
  {
    id: 'demo-agency-2',
    agencyName: 'Casa Premium Cars',
    ownerName: clients[1].fullName,
    email: clients[1].email,
    phone: clients[1].phone,
    vehiclesCount: 0,
    plan: 'business',
    billingStatus: 'overdue',
    subscriptionEndDate: '2026-05-05',
    lastPaymentDate: payments[1].dueDate,
    nextPaymentDueDate: '2026-05-05',
    monthlyPrice: 499,
    annualPrice: 4990,
    billingType: 'monthly',
    usersCount: 1,
    accountStatus: 'pending',
    createdDate: '2026-05-08',
    paymentMethod: 'cash',
    paymentNotes: 'Waiting for first subscription payment.',
  },
];

export default function SuperAdminPage() {
  const { notify } = useApp();
  const { isSupabaseEnabled, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<AdminAgency[]>(demoAgencies);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [accessRequests, setAccessRequests] = useState<AccessRequestRow[]>([]);
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [requestToDelete, setRequestToDelete] = useState<AccessRequestRow | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<AdminAgency | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [deletingAgencyId, setDeletingAgencyId] = useState<string | null>(null);

  const loadAgencies = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setAgencies(demoAgencies);
      return;
    }

    setLoading(true);
    try {
      const [agenciesResult, profilesResult, vehiclesResult, requestsResult] = await Promise.all([
        supabase
          .from('agencies')
          .select(
            'id, name, plan, billing_status, subscription_end_date, last_payment_date, next_payment_due_date, monthly_price, payment_method, payment_notes, created_at',
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('users_profiles')
          .select('id, agency_id, full_name, email, phone, role, account_status, is_super_admin')
          .order('created_at', { ascending: true }),
        supabase.from('vehicles').select('id, agency_id'),
        supabase.from('access_requests').select('*').order('created_at', { ascending: false }),
      ]);

      if (agenciesResult.error || profilesResult.error || vehiclesResult.error) {
        throw agenciesResult.error || profilesResult.error || vehiclesResult.error;
      }

      const profiles = (profilesResult.data || []) as {
        agency_id: string | null;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        role: string;
        account_status: AccountStatus;
      }[];
      const vehicleRows = (vehiclesResult.data || []) as { agency_id: string }[];

      const nextAgencies = ((agenciesResult.data || []) as {
        id: string;
        name: string;
        plan: AgencyPlan | null;
        billing_status: BillingStatus | null;
        subscription_end_date: string | null;
        last_payment_date: string | null;
        next_payment_due_date: string | null;
        monthly_price: number | null;
        payment_method: PaymentMethod | null;
        payment_notes: string | null;
        created_at: string;
      }[]).map((agency) => {
        const owner =
          profiles.find((profile) => profile.agency_id === agency.id && profile.role === 'Admin') ||
          profiles.find((profile) => profile.agency_id === agency.id);

        return {
          id: agency.id,
          agencyName: agency.name,
          ownerName: owner?.full_name || 'Propriétaire agence',
          email: owner?.email || 'Aucun email',
          phone: owner?.phone || 'Aucun téléphone',
          vehiclesCount: vehicleRows.filter((vehicle) => vehicle.agency_id === agency.id).length,
          plan: agency.plan || 'starter',
          billingStatus: agency.billing_status || 'trial',
          subscriptionEndDate: agency.subscription_end_date,
          lastPaymentDate: agency.last_payment_date,
          nextPaymentDueDate: agency.next_payment_due_date,
          monthlyPrice: Number(agency.monthly_price ?? 0),
          annualPrice: Number((agency.monthly_price ?? 0) * 10),
          billingType: 'monthly' as const,
          usersCount: profiles.filter((profile) => profile.agency_id === agency.id).length,
          accountStatus: owner?.account_status || 'pending',
          createdDate: agency.created_at,
          paymentMethod: agency.payment_method || 'other',
          paymentNotes: agency.payment_notes || '',
        };
      });

      setAgencies(nextAgencies);
      setNoteDrafts(
        Object.fromEntries(nextAgencies.map((agency) => [agency.id, agency.paymentNotes])),
      );
      if (requestsResult.error) {
        setAccessRequests([]);
        setRequestNotes({});
        notify({
          title: 'Demandes d’accès indisponibles',
          message: 'Vérifiez la table/policies access_requests. Le reste du panneau reste accessible.',
          type: 'warning',
        });
      } else {
        const nextRequests = (requestsResult.data || []) as AccessRequestRow[];
        setAccessRequests(nextRequests);
        setRequestNotes(Object.fromEntries(nextRequests.map((r) => [r.id, r.admin_notes || ''])));
      }
    } catch (error) {
      notify({
        title: 'Données admin non chargées',
        message: error instanceof Error ? error.message : 'Vérifiez les politiques RLS super admin.',
        type: 'warning',
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadAgencies();
  }, [loadAgencies]);

  const filteredAgencies = useMemo(() => {
    if (filter === 'all') return agencies;
    return agencies.filter((agency) => agency.accountStatus === filter || agency.billingStatus === filter);
  }, [agencies, filter]);

  async function updateAgencyRow(id: string, patch: Partial<AdminAgency>) {
    setAgencies((current) => current.map((agency) => (agency.id === id ? { ...agency, ...patch } : agency)));

    if (!supabase || !isSupabaseConfigured) return;

    const dbPatch: Record<string, unknown> = {};
    if (patch.plan) dbPatch.plan = patch.plan;
    if (patch.billingStatus) dbPatch.billing_status = patch.billingStatus;
    if (patch.subscriptionEndDate !== undefined) dbPatch.subscription_end_date = patch.subscriptionEndDate;
    if (patch.lastPaymentDate !== undefined) dbPatch.last_payment_date = patch.lastPaymentDate;
    if (patch.nextPaymentDueDate !== undefined) dbPatch.next_payment_due_date = patch.nextPaymentDueDate;
    if (patch.monthlyPrice !== undefined) dbPatch.monthly_price = patch.monthlyPrice;
    if (patch.paymentMethod) dbPatch.payment_method = patch.paymentMethod;
    if (patch.paymentNotes !== undefined) dbPatch.payment_notes = patch.paymentNotes;

    const { error } = await supabase.from('agencies').update(dbPatch).eq('id', id);
    if (error) throw error;
  }

  async function updateAccountStatus(id: string, status: AccountStatus) {
    setAgencies((current) =>
      current.map((agency) => (agency.id === id ? { ...agency, accountStatus: status } : agency)),
    );

    if (!supabase || !isSupabaseConfigured) return;

    const { error } = await supabase
      .from('users_profiles')
      .update({ account_status: status })
      .eq('agency_id', id)
      .eq('role', 'Admin');
    if (error) throw error;
  }

  async function safeAction(title: string, action: () => Promise<void>) {
    try {
      await action();
      notify({ title, message: 'Action super admin enregistrée.', type: 'success' });
    } catch (error) {
      await loadAgencies();
      notify({
        title: 'Action failed',
        message: error instanceof Error ? error.message : 'Try again later.',
        type: 'warning',
      });
    }
  }

  async function updateAccessRequest(id: string, patch: Partial<AccessRequestRow>, title: string) {
    setAccessRequests((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.from('access_requests').update(patch).eq('id', id);
      if (error) throw error;
    }
    notify({ title, message: 'Demande mise à jour.', type: 'success' });
  }

  async function deleteAccessRequest(row: AccessRequestRow) {
    setDeletingRequestId(row.id);
    try {
      if (supabase && isSupabaseConfigured) {
        const { error } = await supabase.from('access_requests').delete().eq('id', row.id);
        if (error) throw error;
      }
      setAccessRequests((current) => current.filter((item) => item.id !== row.id));
      notify({ title: 'Demande supprimée avec succès', type: 'success' });
    } catch (error) {
      notify({ title: 'Suppression impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally {
      setDeletingRequestId(null);
      setRequestToDelete(null);
    }
  }

  async function deleteAgencyAccount(agency: AdminAgency) {
    setDeletingAgencyId(agency.id);
    try {
      if (supabase && isSupabaseConfigured) {
        const agencyId = agency.id;
        const steps: Array<{ table: string; column: string }> = [
          { table: 'payments', column: 'agency_id' },
          { table: 'contracts', column: 'agency_id' },
          { table: 'reservations', column: 'agency_id' },
          { table: 'maintenance', column: 'agency_id' },
          { table: 'clients', column: 'agency_id' },
          { table: 'vehicles', column: 'agency_id' },
          { table: 'users_profiles', column: 'agency_id' },
        ];

        for (const step of steps) {
          const { error } = await supabase.from(step.table).delete().eq(step.column, agencyId);
          if (error) throw error;
        }

        const { error: agencyError } = await supabase.from('agencies').delete().eq('id', agencyId);
        if (agencyError) throw agencyError;
      }

      setAgencies((current) => current.filter((item) => item.id !== agency.id));
      notify({ title: 'Compte agence supprimé', message: 'L’agence et ses données associées ont été supprimées.', type: 'success' });
    } catch (error) {
      notify({ title: 'Suppression impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally {
      setDeletingAgencyId(null);
      setAgencyToDelete(null);
    }
  }

  if (!isSupabaseEnabled || !profile?.isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white light:bg-carbon-50 light:text-carbon-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Espace sécurisé"
          title="Super Admin"
          description="Approve agencies, manage subscriptions, and monitor billing health across MekLoc."
          action={
            <div className="flex gap-2">
              <Button
                variant="secondary"
                icon={<RefreshCw className="h-4 w-4" />}
                loading={loading}
                onClick={loadAgencies}
              >
                Actualiser
              </Button>
              <Button variant="secondary" onClick={async () => { await signOut(); navigate('/auth'); }}>
                Déconnexion
              </Button>
            </div>
          }
        />

        {!isSupabaseConfigured ? (
          <Card className="mb-5 p-4 text-sm text-gold-100 light:text-gold-800">
            Supabase env variables are missing, so this admin panel is showing mock fallback data.
          </Card>
        ) : null}

        <Card className="mb-5 p-4">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item}
                className={`focus-ring rounded-xl px-3 py-2 text-sm font-semibold capitalize transition ${
                  filter === item
                    ? 'bg-gold-400 text-carbon-950'
                    : 'border border-white/10 bg-white/[0.04] text-carbon-300 hover:bg-white/10 light:text-carbon-700'
                }`}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </Card>

        <div className="grid gap-5">
          {filteredAgencies.map((agency) => (
            <Card key={agency.id} className="overflow-hidden">
              <div className="grid gap-5 border-b border-white/10 p-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-white light:text-carbon-950">{agency.agencyName}</h2>
                    <Badge>{agency.accountStatus}</Badge>
                    <Badge>{agency.billingStatus}</Badge>
                    {agency.billingStatus === 'overdue' ? (
                      <span className="rounded-full border border-rose-300/30 bg-rose-400/15 px-2.5 py-1 text-xs font-bold text-rose-100 light:text-rose-700">
                        overdue
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 text-sm text-carbon-300 light:text-carbon-700 md:grid-cols-3">
                    <p><strong className="text-white light:text-carbon-950">Owner:</strong> {agency.ownerName}</p>
                    <p><strong className="text-white light:text-carbon-950">Email:</strong> {agency.email}</p>
                    <p><strong className="text-white light:text-carbon-950">Phone:</strong> {agency.phone}</p>
                    <p><strong className="text-white light:text-carbon-950">Vehicles:</strong> {agency.vehiclesCount}</p>
                    <p><strong className="text-white light:text-carbon-950">Created:</strong> {agency.createdDate.slice(0, 10)}</p>
                    <p><strong className="text-white light:text-carbon-950">Method:</strong> {agency.paymentMethod}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-wide text-carbon-500">Plan</p>
                    <p className="mt-1 text-lg font-black capitalize text-white light:text-carbon-950">{agency.plan}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-wide text-carbon-500">Prix mensuel</p>
                    <p className="mt-1 text-lg font-black text-white light:text-carbon-950">{formatMAD(agency.monthlyPrice)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-wide text-carbon-500">Dernier paiement</p>
                    <p className="mt-1 text-sm font-bold text-white light:text-carbon-950">{agency.lastPaymentDate || 'None'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-wide text-carbon-500">Prochaine échéance</p>
                    <p className="mt-1 text-sm font-bold text-white light:text-carbon-950">{agency.nextPaymentDueDate || 'Not set'}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-5 xl:grid-cols-[1fr_0.85fr]">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => safeAction('Agence approuvée', () => updateAccountStatus(agency.id, 'active'))}>Approuver</Button>
                  <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => safeAction('Agence rejetée', () => updateAccountStatus(agency.id, 'rejected'))}>Rejeter</Button>
                  <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} onClick={() => safeAction('Agence suspendue', () => updateAccountStatus(agency.id, 'suspended'))}>Suspendre le compte</Button>
                  <Button icon={<Crown className="h-4 w-4" />} onClick={() => safeAction('Agence réactivée', () => updateAccountStatus(agency.id, 'active'))}>Réactiver</Button>
                  <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} onClick={() => safeAction('Marked as paid', () => updateAgencyRow(agency.id, {
                    billingStatus: 'paid',
                    lastPaymentDate: new Date().toISOString().slice(0, 10),
                    nextPaymentDueDate: addDays(new Date().toISOString(), 30),
                    subscriptionEndDate: addDays(new Date().toISOString(), 30),
                  }))}>Marquer payé</Button>
                  <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} onClick={() => safeAction('Marqué non payé', () => updateAgencyRow(agency.id, { billingStatus: 'unpaid' }))}>Marquer non payé</Button>
                  <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => safeAction('Subscription extended', () => updateAgencyRow(agency.id, {
                    nextPaymentDueDate: addDays(agency.nextPaymentDueDate, 30),
                    subscriptionEndDate: addDays(agency.subscriptionEndDate || agency.nextPaymentDueDate, 30),
                  }))}>Prolonger 1 mois</Button>
                  <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => safeAction('Abonnement prolongé', () => updateAgencyRow(agency.id, {
                    nextPaymentDueDate: addDays(agency.nextPaymentDueDate, 365),
                    subscriptionEndDate: addDays(agency.subscriptionEndDate || agency.nextPaymentDueDate, 365),
                  }))}>Prolonger 1 an</Button>
                  <Button variant="danger" loading={deletingAgencyId === agency.id} onClick={() => setAgencyToDelete(agency)}>Supprimer le compte</Button>
                </div>

                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm font-medium text-carbon-200 light:text-carbon-700">
                    <span>Changer le plan</span>
                    <select
                      value={agency.plan}
                      className="focus-ring rounded-xl border border-white/10 bg-carbon-950/45 px-3 py-2.5 text-white light:bg-white light:text-carbon-950"
                      onChange={(event) => {
                        const plan = event.target.value as AgencyPlan;
                        safeAction('Subscription plan changed', () => updateAgencyRow(agency.id, {
                          plan,
                          monthlyPrice: planPrices[plan],
                        }));
                      }}
                    >
                      <option value="starter">starter</option>
                      <option value="pro">pro</option>
                      <option value="business">business</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-carbon-200 light:text-carbon-700">
                    <span>Payment notes</span>
                    <textarea
                      value={noteDrafts[agency.id] ?? agency.paymentNotes}
                      className="focus-ring min-h-20 rounded-xl border border-white/10 bg-carbon-950/45 px-3 py-2.5 text-white light:bg-white light:text-carbon-950"
                      onChange={(event) => setNoteDrafts((current) => ({ ...current, [agency.id]: event.target.value }))}
                    />
                  </label>
                  <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={() => safeAction('Payment notes saved', () => updateAgencyRow(agency.id, {
                    paymentNotes: noteDrafts[agency.id] ?? agency.paymentNotes,
                  }))}>
                    Add payment notes
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredAgencies.length === 0 ? (
          <Card className="mt-5 grid place-items-center p-10 text-center">
            <Filter className="mb-4 h-8 w-8 text-gold-300" />
            <p className="font-bold text-white light:text-carbon-950">No agencies match this filter.</p>
          </Card>
        ) : null}

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Demandes d’accès</h2>
            <p className="mt-1 text-sm text-carbon-400">Suivi des nouvelles demandes agences avant activation.</p>
          </div>
          <div className="grid gap-4 p-5">
            {accessRequests.length === 0 ? <p className="text-sm text-carbon-400">Aucune demande d’accès.</p> : accessRequests.map((req) => (
              <div key={req.id} className="premium-surface rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{req.agency_name}</p>
                  <Badge>{req.status}</Badge>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-carbon-300 md:grid-cols-3">
                  <p><strong>Responsable:</strong> {req.owner_name}</p>
                  <p><strong>Email:</strong> {req.email}</p>
                  <p><strong>Téléphone:</strong> {req.phone_country_code} {req.phone_number}</p>
                  <p><strong>Ville:</strong> {req.city}</p>
                  <p><strong>Plan:</strong> {req.selected_plan}</p>
                  <p><strong>Facturation:</strong> {req.billing_type === 'annual' ? 'Annuel' : 'Mensuel'}</p>
                  <p><strong>Véhicules:</strong> {req.vehicle_count}</p>
                  <p><strong>Date:</strong> {req.created_at.slice(0, 10)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => updateAccessRequest(req.id, { status: 'contacted' }, 'Marquée contactée')}>Marquer contactée</Button>
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => updateAccessRequest(req.id, { status: 'payment_pending' }, 'Paiement en attente')}>Paiement en attente</Button>
                  <Button className="h-8 px-2.5 text-xs" onClick={() => updateAccessRequest(req.id, { status: 'approved' }, 'Demande approuvée')}>Approuver</Button>
                  <Button variant="danger" className="h-8 px-2.5 text-xs" onClick={() => updateAccessRequest(req.id, { status: 'rejected' }, 'Demande rejetée')}>Rejeter</Button>
                  <Button variant="danger" className="h-8 px-2.5 text-xs" loading={deletingRequestId === req.id} onClick={() => setRequestToDelete(req)}>Supprimer la demande</Button>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                  <textarea className="form-control min-h-16" value={requestNotes[req.id] || ''} onChange={(e) => setRequestNotes((c) => ({ ...c, [req.id]: e.target.value }))} placeholder="Note admin..." />
                  <Button variant="secondary" className="h-10" onClick={() => updateAccessRequest(req.id, { admin_notes: requestNotes[req.id] || '' }, 'Note enregistrée')}>Enregistrer note</Button>
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
          <Button variant="danger" loading={Boolean(requestToDelete && deletingRequestId === requestToDelete.id)} onClick={() => requestToDelete && deleteAccessRequest(requestToDelete)}>
            Supprimer
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(agencyToDelete)} onClose={() => setAgencyToDelete(null)} title="Suppression du compte agence">
        <p className="text-sm text-carbon-300">Cette action va supprimer l’agence et ses données associées. Continuer ?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAgencyToDelete(null)}>Annuler</Button>
          <Button variant="danger" loading={Boolean(agencyToDelete && deletingAgencyId === agencyToDelete.id)} onClick={() => agencyToDelete && deleteAgencyAccount(agencyToDelete)}>
            Supprimer définitivement
          </Button>
        </div>
      </Modal>
    </div>
  );
}
