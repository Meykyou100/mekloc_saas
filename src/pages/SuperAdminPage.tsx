import { Banknote, CalendarClock, CheckCircle2, Crown, FileText, Filter, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
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
  id: string; agencyName: string; ownerName: string; email: string; phone: string; vehiclesCount: number;
  plan: AgencyPlan; billingStatus: BillingStatus; subscriptionEndDate: string | null; lastPaymentDate: string | null;
  nextPaymentDueDate: string | null; monthlyPrice: number; annualPrice: number; billingType: 'monthly' | 'annual';
  usersCount: number; accountStatus: AccountStatus; createdDate: string; paymentMethod: PaymentMethod; paymentNotes: string;
};
type DeletedAgency = AdminAgency & { deletedAt: string };
type FilterValue = 'all' | AccountStatus | BillingStatus;
type AccessRequestStatus = 'pending' | 'contacted' | 'payment_pending' | 'approved' | 'rejected';
type AccessRequestRow = {
  id: string; agency_name: string; owner_name: string; email: string; phone_country_code: string; phone_number: string;
  city: string; selected_plan: string; billing_type: 'monthly' | 'annual'; vehicle_count: number; status: AccessRequestStatus;
  admin_notes: string | null; created_at: string;
};

const filters: FilterValue[] = ['all', 'pending', 'active', 'suspended', 'rejected', 'overdue', 'paid', 'unpaid'];
const planPrices: Record<AgencyPlan, number> = { starter: 99, pro: 250, business: 499 };
const demoAgencies: AdminAgency[] = [
  { id: 'demo-agency-1', agencyName: 'Atlas Rent Marrakech', ownerName: clients[0].fullName, email: clients[0].email, phone: clients[0].phone, vehiclesCount: vehicles.length, plan: 'pro', billingStatus: 'paid', subscriptionEndDate: '2026-06-01', lastPaymentDate: '2026-05-01', nextPaymentDueDate: '2026-06-01', monthlyPrice: 250, annualPrice: 2500, billingType: 'monthly', usersCount: 3, accountStatus: 'active', createdDate: '2026-04-18', paymentMethod: 'bank_transfer', paymentNotes: 'Demo agency account.' },
  { id: 'demo-agency-2', agencyName: 'Casa Premium Cars', ownerName: clients[1].fullName, email: clients[1].email, phone: clients[1].phone, vehiclesCount: 0, plan: 'business', billingStatus: 'overdue', subscriptionEndDate: '2026-05-05', lastPaymentDate: payments[1].dueDate, nextPaymentDueDate: '2026-05-05', monthlyPrice: 499, annualPrice: 4990, billingType: 'monthly', usersCount: 1, accountStatus: 'pending', createdDate: '2026-05-08', paymentMethod: 'cash', paymentNotes: 'Waiting for first subscription payment.' },
];

function addDays(dateValue: string | null | undefined, days: number) {
  const date = dateValue ? new Date(dateValue) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

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
  const [deletedAgencies, setDeletedAgencies] = useState<DeletedAgency[]>(() => JSON.parse(localStorage.getItem('mekloc-deleted-agencies') || '[]'));
  const deletedAgencyIds = useMemo(() => new Set(deletedAgencies.map((item) => item.id)), [deletedAgencies]);

  const persistDeletedAgencies = (rows: DeletedAgency[]) => {
    setDeletedAgencies(rows);
    localStorage.setItem('mekloc-deleted-agencies', JSON.stringify(rows));
  };

  const exportAccountsCsv = (rows: AdminAgency[], filename = 'mekloc-comptes.csv') => {
    const headers = ['Nom agence', 'Propriétaire', 'Email', 'Téléphone', 'Plan', 'Statut compte', 'Statut paiement', 'Prix mensuel', 'Prix annuel', 'Type facturation', 'Dernier paiement', 'Prochain paiement', 'Fin abonnement', 'Véhicules', 'Utilisateurs', 'Date création', 'Méthode paiement', 'Notes'];
    const csv = [headers, ...rows.map((r) => [r.agencyName, r.ownerName, r.email, r.phone, r.plan, r.accountStatus, r.billingStatus, r.monthlyPrice, r.annualPrice, r.billingType, r.lastPaymentDate || '', r.nextPaymentDueDate || '', r.subscriptionEndDate || '', r.vehiclesCount, r.usersCount, r.createdDate, r.paymentMethod, r.paymentNotes])]
      .map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const loadAgencies = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setAgencies(demoAgencies.filter((agency) => !deletedAgencyIds.has(agency.id)));
      return;
    }
    setLoading(true);
    try {
      const [agenciesResult, profilesResult, vehiclesResult, requestsResult] = await Promise.all([
        supabase.from('agencies').select('id, name, plan, billing_status, subscription_end_date, last_payment_date, next_payment_due_date, monthly_price, payment_method, payment_notes, created_at').order('created_at', { ascending: false }),
        supabase.from('users_profiles').select('agency_id, full_name, email, phone, role, account_status').order('created_at', { ascending: true }),
        supabase.from('vehicles').select('agency_id'),
        supabase.from('access_requests').select('*').order('created_at', { ascending: false }),
      ]);
      if (agenciesResult.error || profilesResult.error || vehiclesResult.error) throw agenciesResult.error || profilesResult.error || vehiclesResult.error;
      const profiles = (profilesResult.data || []) as Array<{ agency_id: string | null; full_name: string | null; email: string | null; phone: string | null; role: string; account_status: AccountStatus }>;
      const vehicleRows = (vehiclesResult.data || []) as Array<{ agency_id: string }>;
      const nextAgencies = ((agenciesResult.data || []) as Array<{ id: string; name: string; plan: AgencyPlan | null; billing_status: BillingStatus | null; subscription_end_date: string | null; last_payment_date: string | null; next_payment_due_date: string | null; monthly_price: number | null; payment_method: PaymentMethod | null; payment_notes: string | null; created_at: string }>)
        .map((a) => {
          const owner = profiles.find((p) => p.agency_id === a.id && p.role === 'Admin') || profiles.find((p) => p.agency_id === a.id);
          return {
            id: a.id, agencyName: a.name, ownerName: owner?.full_name || 'Propriétaire agence', email: owner?.email || 'Aucun email', phone: owner?.phone || 'Aucun téléphone',
            vehiclesCount: vehicleRows.filter((v) => v.agency_id === a.id).length, plan: a.plan || 'starter', billingStatus: a.billing_status || 'trial',
            subscriptionEndDate: a.subscription_end_date, lastPaymentDate: a.last_payment_date, nextPaymentDueDate: a.next_payment_due_date,
            monthlyPrice: Number(a.monthly_price ?? 0), annualPrice: Number((a.monthly_price ?? 0) * 10), billingType: 'monthly' as const,
            usersCount: profiles.filter((p) => p.agency_id === a.id).length, accountStatus: owner?.account_status || 'pending',
            createdDate: a.created_at, paymentMethod: a.payment_method || 'other', paymentNotes: a.payment_notes || '',
          };
        });
      setAgencies(nextAgencies.filter((agency) => !deletedAgencyIds.has(agency.id)));
      setNoteDrafts(Object.fromEntries(nextAgencies.map((a) => [a.id, a.paymentNotes])));
      if (requestsResult.error) {
        setAccessRequests([]);
      } else {
        const reqs = (requestsResult.data || []) as AccessRequestRow[];
        setAccessRequests(reqs);
        setRequestNotes(Object.fromEntries(reqs.map((r) => [r.id, r.admin_notes || ''])));
      }
    } catch (error) {
      notify({ title: 'Données admin non chargées', message: error instanceof Error ? error.message : 'Vérifiez les politiques RLS super admin.', type: 'warning' });
    } finally { setLoading(false); }
  }, [deletedAgencyIds, notify]);

  useEffect(() => { loadAgencies(); }, [loadAgencies]);
  const filteredAgencies = useMemo(() => filter === 'all' ? agencies : agencies.filter((a) => a.accountStatus === filter || a.billingStatus === filter), [agencies, filter]);

  async function updateAgencyRow(id: string, patch: Partial<AdminAgency>) {
    setAgencies((curr) => curr.map((a) => (a.id === id ? { ...a, ...patch } : a)));
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
    setAgencies((curr) => curr.map((a) => (a.id === id ? { ...a, accountStatus: status } : a)));
    if (!supabase || !isSupabaseConfigured) return;
    const { error } = await supabase.from('users_profiles').update({ account_status: status }).eq('agency_id', id).eq('role', 'Admin');
    if (error) throw error;
  }

  async function safeAction(title: string, action: () => Promise<void>) {
    try { await action(); notify({ title, message: 'Action super admin enregistrée.', type: 'success' }); }
    catch (error) { await loadAgencies(); notify({ title: 'Action impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' }); }
  }

  async function updateAccessRequest(id: string, patch: Partial<AccessRequestRow>, title: string) {
    setAccessRequests((curr) => curr.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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
      setAccessRequests((curr) => curr.filter((r) => r.id !== row.id));
      notify({ title: 'Demande supprimée avec succès', type: 'success' });
    } catch (error) {
      notify({ title: 'Suppression impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally { setDeletingRequestId(null); setRequestToDelete(null); }
  }

  async function deleteAgencyAccount(agency: AdminAgency) {
    setDeletingAgencyId(agency.id);
    try {
      if (supabase && isSupabaseConfigured) {
        for (const table of ['payments', 'contracts', 'reservations', 'maintenance', 'clients', 'vehicles', 'users_profiles']) {
          const { error } = await supabase.from(table).delete().eq('agency_id', agency.id);
          if (error) throw error;
        }
        const { error } = await supabase.from('agencies').delete().eq('id', agency.id);
        if (error) throw error;
      }
      const nextDeleted = [{ ...agency, deletedAt: new Date().toISOString() }, ...deletedAgencies];
      persistDeletedAgencies(nextDeleted);
      setAgencies((curr) => curr.filter((a) => a.id !== agency.id));
      notify({ title: 'Compte agence supprimé', message: 'L’agence et ses données associées ont été supprimées.', type: 'success' });
    } catch (error) {
      notify({ title: 'Suppression impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally { setDeletingAgencyId(null); setAgencyToDelete(null); }
  }

  if (!isSupabaseEnabled || !profile?.isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Espace sécurisé" title="Super Admin" description="Gestion des agences, abonnements et demandes d’accès." action={<div className="flex gap-2"><Button variant="secondary" onClick={() => exportAccountsCsv(agencies, 'mekloc-comptes-actifs.csv')}>Exporter Excel</Button><Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={loading} onClick={loadAgencies}>Actualiser</Button><Button variant="secondary" onClick={async () => { await signOut(); navigate('/auth'); }}>Déconnexion</Button></div>} />
        <Card className="mb-5 p-4"><div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item} className={`focus-ring rounded-xl px-3 py-2 text-sm font-semibold capitalize transition ${filter === item ? 'bg-gold-400 text-carbon-950' : 'border border-white/10 bg-white/[0.04] text-carbon-300 hover:bg-white/10'}`} onClick={() => setFilter(item)}>{item}</button>)}</div></Card>

        <div className="grid gap-5">
          {filteredAgencies.map((agency) => (
            <Card key={agency.id} className="overflow-hidden">
              <div className="grid gap-5 border-b border-white/10 p-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">{agency.agencyName}</h2><Badge>{agency.accountStatus}</Badge><Badge>{agency.billingStatus}</Badge></div>
                  <div className="grid gap-3 text-sm text-carbon-300 md:grid-cols-3"><p><strong className="text-white">Propriétaire:</strong> {agency.ownerName}</p><p><strong className="text-white">Email:</strong> {agency.email}</p><p><strong className="text-white">Téléphone:</strong> {agency.phone}</p><p><strong className="text-white">Véhicules:</strong> {agency.vehiclesCount}</p><p><strong className="text-white">Création:</strong> {agency.createdDate.slice(0, 10)}</p><p><strong className="text-white">Paiement:</strong> {agency.paymentMethod}</p></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs uppercase tracking-wide text-carbon-500">Plan</p><p className="mt-1 text-lg font-black capitalize">{agency.plan}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs uppercase tracking-wide text-carbon-500">Prix mensuel</p><p className="mt-1 text-lg font-black">{formatMAD(agency.monthlyPrice)}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs uppercase tracking-wide text-carbon-500">Dernier paiement</p><p className="mt-1 text-sm font-bold">{agency.lastPaymentDate || 'Aucun'}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs uppercase tracking-wide text-carbon-500">Prochaine échéance</p><p className="mt-1 text-sm font-bold">{agency.nextPaymentDueDate || 'Non défini'}</p></div>
                </div>
              </div>
              <div className="grid gap-4 p-5 xl:grid-cols-[1fr_0.85fr]">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => safeAction('Agence approuvée', () => updateAccountStatus(agency.id, 'active'))}>Approuver</Button>
                  <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => safeAction('Agence rejetée', () => updateAccountStatus(agency.id, 'rejected'))}>Rejeter</Button>
                  <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} onClick={() => safeAction('Agence suspendue', () => updateAccountStatus(agency.id, 'suspended'))}>Suspendre le compte</Button>
                  <Button icon={<Crown className="h-4 w-4" />} onClick={() => safeAction('Agence réactivée', () => updateAccountStatus(agency.id, 'active'))}>Réactiver</Button>
                  <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} onClick={() => safeAction('Marqué payé', () => updateAgencyRow(agency.id, { billingStatus: 'paid', lastPaymentDate: new Date().toISOString().slice(0, 10), nextPaymentDueDate: addDays(new Date().toISOString(), 30), subscriptionEndDate: addDays(new Date().toISOString(), 30) }))}>Marquer payé</Button>
                  <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} onClick={() => safeAction('Marqué non payé', () => updateAgencyRow(agency.id, { billingStatus: 'unpaid' }))}>Marquer non payé</Button>
                  <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => safeAction('Prolongé 1 mois', () => updateAgencyRow(agency.id, { nextPaymentDueDate: addDays(agency.nextPaymentDueDate, 30), subscriptionEndDate: addDays(agency.subscriptionEndDate || agency.nextPaymentDueDate, 30) }))}>Prolonger 1 mois</Button>
                  <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => safeAction('Prolongé 1 an', () => updateAgencyRow(agency.id, { nextPaymentDueDate: addDays(agency.nextPaymentDueDate, 365), subscriptionEndDate: addDays(agency.subscriptionEndDate || agency.nextPaymentDueDate, 365) }))}>Prolonger 1 an</Button>
                  <Button variant="secondary" onClick={() => exportAccountsCsv([agency], `compte-${agency.agencyName.replace(/\s+/g, '-').toLowerCase()}.csv`)}>Exporter</Button>
                  <Button variant="danger" loading={deletingAgencyId === agency.id} onClick={() => setAgencyToDelete(agency)}>Supprimer le compte</Button>
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm font-medium text-carbon-200"><span>Changer le plan</span><select value={agency.plan} className="focus-ring rounded-xl border border-white/10 bg-carbon-950/45 px-3 py-2.5 text-white" onChange={(e) => safeAction('Plan modifié', () => updateAgencyRow(agency.id, { plan: e.target.value as AgencyPlan, monthlyPrice: planPrices[e.target.value as AgencyPlan] }))}><option value="starter">starter</option><option value="pro">pro</option><option value="business">business</option></select></label>
                  <label className="grid gap-2 text-sm font-medium text-carbon-200"><span>Notes de paiement</span><textarea value={noteDrafts[agency.id] ?? agency.paymentNotes} className="focus-ring min-h-20 rounded-xl border border-white/10 bg-carbon-950/45 px-3 py-2.5 text-white" onChange={(e) => setNoteDrafts((c) => ({ ...c, [agency.id]: e.target.value }))} /></label>
                  <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={() => safeAction('Notes enregistrées', () => updateAgencyRow(agency.id, { paymentNotes: noteDrafts[agency.id] ?? agency.paymentNotes }))}>Enregistrer notes</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredAgencies.length === 0 && <Card className="mt-5 grid place-items-center p-10 text-center"><Filter className="mb-4 h-8 w-8 text-gold-300" /><p className="font-bold text-white">Aucune agence pour ce filtre.</p></Card>}

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5"><h2 className="text-xl font-bold">Demandes d’accès</h2><p className="mt-1 text-sm text-carbon-400">Suivi des nouvelles demandes agences avant activation.</p></div>
          <div className="grid gap-4 p-5">
            {accessRequests.length === 0 ? <p className="text-sm text-carbon-400">Aucune demande d’accès.</p> : accessRequests.map((req) => (
              <div key={req.id} className="premium-surface rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-white">{req.agency_name}</p><Badge>{req.status}</Badge></div>
                <div className="mt-2 grid gap-2 text-sm text-carbon-300 md:grid-cols-3"><p><strong>Responsable:</strong> {req.owner_name}</p><p><strong>Email:</strong> {req.email}</p><p><strong>Téléphone:</strong> {req.phone_country_code} {req.phone_number}</p><p><strong>Ville:</strong> {req.city}</p><p><strong>Plan:</strong> {req.selected_plan}</p><p><strong>Facturation:</strong> {req.billing_type === 'annual' ? 'Annuel' : 'Mensuel'}</p><p><strong>Véhicules:</strong> {req.vehicle_count}</p><p><strong>Date:</strong> {req.created_at.slice(0, 10)}</p></div>
                <div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => updateAccessRequest(req.id, { status: 'contacted' }, 'Marquée contactée')}>Marquer contactée</Button><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => updateAccessRequest(req.id, { status: 'payment_pending' }, 'Paiement en attente')}>Paiement en attente</Button><Button className="h-8 px-2.5 text-xs" onClick={() => updateAccessRequest(req.id, { status: 'approved' }, 'Demande approuvée')}>Approuver</Button><Button variant="danger" className="h-8 px-2.5 text-xs" onClick={() => updateAccessRequest(req.id, { status: 'rejected' }, 'Demande rejetée')}>Rejeter</Button><Button variant="danger" className="h-8 px-2.5 text-xs" loading={deletingRequestId === req.id} onClick={() => setRequestToDelete(req)}>Supprimer la demande</Button></div>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]"><textarea className="form-control min-h-16" value={requestNotes[req.id] || ''} onChange={(e) => setRequestNotes((c) => ({ ...c, [req.id]: e.target.value }))} placeholder="Note admin..." /><Button variant="secondary" className="h-10" onClick={() => updateAccessRequest(req.id, { admin_notes: requestNotes[req.id] || '' }, 'Note enregistrée')}>Enregistrer note</Button></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5"><h2 className="text-xl font-bold">Comptes supprimés</h2><p className="mt-1 text-sm text-carbon-400">Historique local des suppressions.</p></div>
          <div className="grid gap-3 p-5">{deletedAgencies.length === 0 ? <p className="text-sm text-carbon-400">Aucun compte supprimé.</p> : deletedAgencies.map((a) => <div key={`${a.id}-${a.deletedAt}`} className="premium-surface rounded-2xl p-4"><p className="font-semibold text-white">{a.agencyName}</p><p className="mt-1 text-sm text-carbon-300">{a.ownerName} • {a.email}</p><p className="mt-1 text-xs text-carbon-400">Supprimé le: {a.deletedAt.slice(0, 10)}</p></div>)}</div>
        </Card>
      </div>

      <Modal open={Boolean(requestToDelete)} onClose={() => setRequestToDelete(null)} title="Confirmer la suppression">
        <p className="text-sm text-carbon-300">Voulez-vous vraiment supprimer cette demande ?</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setRequestToDelete(null)}>Annuler</Button><Button variant="danger" loading={Boolean(requestToDelete && deletingRequestId === requestToDelete.id)} onClick={() => requestToDelete && deleteAccessRequest(requestToDelete)}>Supprimer</Button></div>
      </Modal>
      <Modal open={Boolean(agencyToDelete)} onClose={() => setAgencyToDelete(null)} title="Suppression du compte agence">
        <p className="text-sm text-carbon-300">Cette action va supprimer l’agence et ses données associées. Continuer ?</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setAgencyToDelete(null)}>Annuler</Button><Button variant="danger" loading={Boolean(agencyToDelete && deletingAgencyId === agencyToDelete.id)} onClick={() => agencyToDelete && deleteAgencyAccount(agencyToDelete)}>Supprimer définitivement</Button></div>
      </Modal>
    </div>
  );
}
