import { AlertTriangle, ArrowRight, Car, CircleDollarSign, Clock3, Mail, RefreshCw, Search, ShieldCheck, TrendingUp, UserRound, UsersRound, WalletCards } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import PlateNumber from '../components/ui/PlateNumber';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useSupportMode } from '../context/SupportModeContext';
import { formatMAD, type Payment } from '../data/mockData';
import { fleetPeriodRange, getFleetResponsiblePerformance, responsibleInitials, roleLabelFr, type FleetPeriod, type FleetResponsible, type FleetResponsiblePerformance } from '../lib/fleetResponsibles';
import { getReservationPaymentSummary } from '../lib/paymentBalance';
import { supabase } from '../lib/supabase';

type ResponsibleFilter = 'all' | 'with_vehicles' | 'without_vehicles' | 'remaining' | 'unassigned';

function Metric({ label, value, note, icon: Icon, tone = 'gold' }: { label: string; value: string; note: string; icon: typeof Car; tone?: 'gold' | 'green' | 'amber' | 'red' }) {
  const toneClass = {
    gold: 'border-gold-300/25 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]',
    green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    amber: 'border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200',
    red: 'border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-200',
  }[tone];
  return <Card className="min-w-0 rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3.5 shadow-[0_14px_32px_rgba(16,24,32,.08)] sm:p-4">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0"><p className="text-[10px] font-black uppercase leading-4 tracking-[0.12em] text-[var(--app-text-muted)]">{label}</p><p className="mt-2 break-words text-lg font-black leading-tight text-[var(--app-text)] sm:text-xl">{value}</p></div>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${toneClass}`}><Icon className="h-4 w-4" /></span>
    </div>
    <p className="mt-2 text-xs leading-4 text-[var(--app-text-muted)]">{note}</p>
  </Card>;
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'gold' | 'red' | 'amber' }) {
  const classes = {
    neutral: 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]', green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200', gold: 'border-gold-300/25 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]', red: 'border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-200', amber: 'border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  }[tone];
  return <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${classes}`}>{children}</span>;
}

function DetailStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'green' | 'amber' }) {
  return <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[var(--app-text-muted)]">{label}</p><p className={`mt-1 break-words text-base font-black ${tone === 'green' ? 'text-emerald-700 dark:text-emerald-200' : tone === 'amber' ? 'text-amber-700 dark:text-amber-200' : 'text-[var(--app-text)]'}`}>{value}</p></div>;
}

export default function FleetResponsiblesPage() {
  const { vehicles, reservations, payments } = useData();
  const { agencyId: authAgencyId } = useAuth();
  const { supportAgencyId } = useSupportMode();
  const agencyId = supportAgencyId || authAgencyId;
  const [members, setMembers] = useState<FleetResponsible[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ResponsibleFilter>('all');
  const [period, setPeriod] = useState<FleetPeriod>('month');
  const [selected, setSelected] = useState<FleetResponsiblePerformance | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const unassignedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    async function loadMembers() {
      if (!supabase || !agencyId) { if (mounted) { setMembers([]); setTeamLoading(false); } return; }
      setTeamLoading(true);
      const { data, error } = await supabase.from('users_profiles').select('id,full_name,email,role,account_status').eq('agency_id', agencyId).eq('account_status', 'active').order('full_name', { ascending: true });
      if (!mounted) return;
      setMembers(error ? [] : ((data || []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null; account_status: string | null }>).map((member) => ({ id: member.id, fullName: member.full_name || member.email || 'Utilisateur', email: member.email || '', role: member.role || 'agent', accountStatus: member.account_status })));
      setTeamLoading(false);
    }
    void loadMembers();
    return () => { mounted = false; };
  }, [agencyId, reloadKey]);

  const range = useMemo(() => fleetPeriodRange(period), [period]);
  const performance = useMemo(() => getFleetResponsiblePerformance({ members, vehicles, reservations, payments, start: range.start, end: range.end }), [members, payments, range.end, range.start, reservations, vehicles]);
  const assigned = performance.filter((item) => !item.isUnassigned);
  const unassigned = performance.find((item) => item.isUnassigned) || null;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return performance.filter((item) => {
      const member = item.responsible;
      const searchMatch = item.isUnassigned ? !normalized || 'non assigne non assigné véhicules sans responsable'.includes(normalized) : !normalized || `${member?.fullName || ''} ${member?.email || ''} ${member?.role || ''}`.toLowerCase().includes(normalized);
      if (!searchMatch) return false;
      if (filter === 'with_vehicles') return !item.isUnassigned && item.assignedVehicles > 0;
      if (filter === 'without_vehicles') return !item.isUnassigned && item.assignedVehicles === 0;
      if (filter === 'remaining') return item.remaining > 0;
      return filter === 'unassigned' ? item.isUnassigned : true;
    });
  }, [filter, performance, query]);
  const totals = useMemo(() => performance.reduce((result, item) => ({ vehicles: result.vehicles + (item.isUnassigned ? 0 : item.assignedVehicles), revenue: result.revenue + item.revenue, paid: result.paid + item.paid, remaining: result.remaining + item.remaining, active: result.active + item.activeReservations }), { vehicles: 0, revenue: 0, paid: 0, remaining: 0, active: 0 }), [performance]);
  const focusUnassigned = () => { setFilter('unassigned'); setQuery(''); window.setTimeout(() => unassignedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); };

  return <div className="space-y-5 overflow-x-hidden pb-[calc(118px+env(safe-area-inset-bottom))] md:space-y-6 md:pb-8">
    <section className="overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[linear-gradient(122deg,var(--app-card),var(--app-surface-soft))] p-4 shadow-[0_16px_42px_rgba(16,24,32,.09)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.22em] text-[var(--app-gold-text)]">Flotte</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--app-text)] sm:text-3xl">Responsables de flotte</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-text-muted)]">Suivez les véhicules, réservations, revenus et restes à payer par responsable.</p><StatusPill tone="gold"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Performance calculée depuis les véhicules assignés</StatusPill></div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap"><Link to="/vehicles" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gold-400 px-4 text-sm font-black text-carbon-950 transition hover:bg-gold-300"><Car className="h-4 w-4" />Assigner véhicules</Link><Button variant="secondary" className="h-11 rounded-2xl px-4" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-7">
      <Metric label="Responsables actifs" value={String(members.length)} note="Membres disponibles" icon={UsersRound} tone="green" />
      <Metric label="Véhicules assignés" value={String(totals.vehicles)} note="Suivis par membre" icon={Car} />
      <Metric label="Véhicules non assignés" value={String(unassigned?.assignedVehicles || 0)} note="À attribuer" icon={AlertTriangle} tone={(unassigned?.assignedVehicles || 0) > 0 ? 'amber' : 'green'} />
      <Metric label="Revenus période" value={formatMAD(totals.revenue)} note="Réservations non annulées" icon={CircleDollarSign} />
      <Metric label="Encaissements" value={formatMAD(totals.paid)} note="Paiements enregistrés" icon={TrendingUp} tone="green" />
      <Metric label="Reste à payer" value={formatMAD(totals.remaining)} note="À suivre sur la période" icon={WalletCards} tone={totals.remaining > 0 ? 'amber' : 'green'} />
      <Metric label="Réservations actives" value={String(totals.active)} note="Locations en cours" icon={Clock3} tone="green" />
    </section>

    {(unassigned?.assignedVehicles || 0) > 0 ? <section className="rounded-3xl border border-amber-400/30 bg-[linear-gradient(120deg,rgba(245,158,11,.13),var(--app-card))] p-4 shadow-[0_12px_28px_rgba(146,64,14,.08)] sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-200"><AlertTriangle className="h-5 w-5" /></span><div><h2 className="font-black text-[var(--app-text)]">Véhicules sans responsable</h2><p className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">Assignez vos véhicules pour suivre la performance de chaque membre.</p></div></div><Button variant="secondary" className="mt-4 h-11 w-full rounded-2xl sm:mt-0 sm:w-auto" onClick={focusUnassigned}>Voir les véhicules <ArrowRight className="ml-2 h-4 w-4" /></Button></section> : <section className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-100"><ShieldCheck className="h-5 w-5 shrink-0" />Tous les véhicules sont assignés.</section>}

    <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-3.5 shadow-[0_14px_34px_rgba(16,24,32,.08)] sm:p-4"><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><label className="relative block min-w-0"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" /><input className="form-control h-11 w-full rounded-2xl pl-10 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un responsable par nom ou email" /></label><div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 lg:mx-0 lg:px-0">{([['month', 'Ce mois'], ['quarter', '3 mois'], ['year', 'Année']] as Array<[FleetPeriod, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`h-11 shrink-0 rounded-2xl px-4 text-sm font-black transition ${period === value ? 'bg-gold-400 text-carbon-950' : 'border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]'}`}>{label}</button>)}</div></div><div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">{([['all', 'Tous'], ['with_vehicles', 'Avec véhicules'], ['without_vehicles', 'Sans véhicules'], ['remaining', 'Avec reste à payer'], ['unassigned', 'Non assigné']] as Array<[ResponsibleFilter, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`h-10 shrink-0 rounded-2xl px-3.5 text-xs font-bold transition ${filter === value ? 'border border-gold-300/35 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]' : 'border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-muted)]'}`}>{label}</button>)}</div></Card>

    <section><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[var(--app-gold-text)]">Performance par responsable</p><h2 className="mt-1 text-xl font-black text-[var(--app-text)]">Suivi de la flotte</h2></div><p className="text-sm font-semibold text-[var(--app-text-muted)]">{range.start} → {range.end}</p></div>
      {teamLoading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />)}</div> : filtered.length === 0 ? <EmptyState icon={UsersRound} title="Aucun responsable trouvé" message="Ajustez la recherche ou les filtres pour retrouver un responsable." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <ResponsibleCard key={item.responsible?.id || 'unassigned'} item={item} onDetails={() => setSelected(item)} unassignedRef={item.isUnassigned ? unassignedRef : undefined} />)}</div>}
      {!teamLoading && members.length === 0 ? <div className="mt-4"><EmptyState icon={UsersRound} title="Aucun membre disponible" message="Ajoutez un membre depuis Paramètres > Équipe." /></div> : null}
    </section>

    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.isUnassigned ? 'Véhicules non assignés' : selected?.responsible?.fullName || 'Responsable'} subtitle="Détails de performance" panelClassName="sm:ml-auto sm:mr-0 sm:h-[100dvh] sm:max-h-none sm:max-w-xl sm:rounded-l-3xl sm:rounded-r-none" bodyClassName="p-0">{selected ? <ResponsibleDetails item={selected} payments={payments} /> : null}</Modal>
  </div>;
}

function ResponsibleCard({ item, onDetails, unassignedRef }: { item: FleetResponsiblePerformance; onDetails: () => void; unassignedRef?: React.RefObject<HTMLDivElement> }) {
  const responsible = item.responsible; const title = item.isUnassigned ? 'Véhicules non assignés' : responsible?.fullName || 'Responsable'; const collectionRate = item.revenue > 0 ? Math.min(100, Math.round((item.paid / item.revenue) * 100)) : 0; const preview = item.vehicles.slice(0, 2);
  return <div ref={unassignedRef}><Card className={`flex min-w-0 flex-col rounded-3xl border p-4 shadow-[0_14px_34px_rgba(16,24,32,.09)] transition hover:-translate-y-0.5 sm:p-5 ${item.isUnassigned ? 'border-amber-400/35 bg-[linear-gradient(145deg,rgba(245,158,11,.10),var(--app-card))]' : 'border-[var(--app-border)] bg-[var(--app-card)] hover:border-gold-300/30'}`}>
    <div className="flex items-start gap-3"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-sm font-black ${item.isUnassigned ? 'border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200' : 'border-gold-300/25 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]'}`}>{item.isUnassigned ? <AlertTriangle className="h-5 w-5" /> : responsibleInitials(title)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-lg font-black text-[var(--app-text)]">{title}</p><StatusPill tone={item.isUnassigned ? 'amber' : 'green'}>{item.isUnassigned ? 'À attribuer' : 'Actif'}</StatusPill></div><p className="mt-0.5 truncate text-sm text-[var(--app-text-muted)]">{item.isUnassigned ? 'Centralisez les véhicules sans suivi' : roleLabelFr(responsible?.role)}</p>{!item.isUnassigned && responsible?.email ? <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">{responsible.email}</p> : null}</div></div>
    <div className="mt-4 grid grid-cols-2 gap-2"><DetailStat label="Véhicules" value={String(item.assignedVehicles)} /><DetailStat label="Réservations" value={String(item.reservationsCount)} /><DetailStat label="Revenus" value={formatMAD(item.revenue)} /><DetailStat label="Encaissements" value={formatMAD(item.paid)} tone="green" /><DetailStat label="Reste" value={formatMAD(item.remaining)} tone={item.remaining > 0 ? 'amber' : 'default'} /><DetailStat label="Retards" value={String(item.lateReturns)} tone={item.lateReturns > 0 ? 'amber' : 'default'} /></div>
    <div className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3"><div className="flex items-center justify-between gap-2 text-xs"><span className="font-bold text-[var(--app-text-soft)]">Encaissements / revenus</span><span className="font-black text-emerald-700 dark:text-emerald-200">{collectionRate}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--app-card)]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${collectionRate}%` }} /></div></div>
    <div className="mt-3 min-h-8"><p className="mb-1.5 text-[10px] font-black uppercase tracking-[.12em] text-[var(--app-text-muted)]">Véhicules</p>{preview.length ? <div className="flex flex-wrap gap-1.5">{preview.map((vehicle) => <StatusPill key={vehicle.id} tone="neutral">{vehicle.brand} {vehicle.model}</StatusPill>)}{item.vehicles.length > preview.length ? <StatusPill tone="neutral">+{item.vehicles.length - preview.length}</StatusPill> : null}</div> : <p className="text-xs text-[var(--app-text-muted)]">Aucun véhicule assigné.</p>}</div>
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">{item.isUnassigned ? <Link to="/vehicles" className="inline-flex h-11 items-center justify-center rounded-2xl bg-gold-400 px-4 text-sm font-black text-carbon-950 transition hover:bg-gold-300">Assigner ces véhicules <ArrowRight className="ml-2 h-4 w-4" /></Link> : <Button variant="secondary" className="h-11 rounded-2xl" onClick={onDetails}>Voir détails <ArrowRight className="h-4 w-4" /></Button>}{!item.isUnassigned ? <Link to="/vehicles" className="inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 text-sm font-bold text-[var(--app-text)] transition hover:border-gold-300/30">Gérer véhicules</Link> : null}</div>
  </Card></div>;
}

function ResponsibleDetails({ item, payments }: { item: FleetResponsiblePerformance; payments: Payment[] }) {
  const title = item.isUnassigned ? 'Véhicules non assignés' : item.responsible?.fullName || 'Responsable'; const rate = item.revenue > 0 ? Math.min(100, Math.round((item.paid / item.revenue) * 100)) : 0;
  return <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:p-6"><section className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-lg font-black text-[var(--app-text)]">{title}</p>{item.isUnassigned ? <p className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">Assignez ces véhicules depuis la gestion des véhicules.</p> : <p className="mt-1 flex items-center gap-2 truncate text-sm text-[var(--app-text-muted)]"><Mail className="h-4 w-4 shrink-0" />{item.responsible?.email || 'Email non renseigné'}</p>}</div><StatusPill tone={item.remaining > 0 ? 'amber' : 'green'}>{formatMAD(item.remaining)} reste</StatusPill></div><div className="mt-4 grid grid-cols-2 gap-2"><DetailStat label="Véhicules" value={String(item.assignedVehicles)} /><DetailStat label="Réservations" value={String(item.reservationsCount)} /><DetailStat label="Actives" value={String(item.activeReservations)} tone="green" /><DetailStat label="Retards" value={String(item.lateReturns)} tone={item.lateReturns > 0 ? 'amber' : 'default'} /></div></section>
    <section className="mt-5"><h3 className="text-base font-black text-[var(--app-text)]">Paiements / reste à payer</h3><div className="mt-3 grid grid-cols-3 gap-2"><DetailStat label="Revenus" value={formatMAD(item.revenue)} /><DetailStat label="Encaissé" value={formatMAD(item.paid)} tone="green" /><DetailStat label="Reste" value={formatMAD(item.remaining)} tone={item.remaining > 0 ? 'amber' : 'default'} /></div><div className="mt-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3"><div className="flex justify-between text-xs font-bold text-[var(--app-text-soft)]"><span>Progression des encaissements</span><span className="text-emerald-700 dark:text-emerald-200">{rate}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--app-card)]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} /></div></div></section>
    <section className="mt-5"><h3 className="text-base font-black text-[var(--app-text)]">Véhicules assignés</h3><div className="mt-3 space-y-2">{item.vehicles.length === 0 ? <EmptyState icon={Car} title="Aucun véhicule assigné" message="Les véhicules apparaîtront ici après leur assignation." /> : item.vehicles.map((vehicle) => { const linked = item.reservations.filter((reservation) => reservation.vehicleId === vehicle.id); const revenue = linked.filter((reservation) => reservation.status !== 'Cancelled').reduce((sum, reservation) => sum + getReservationPaymentSummary(reservation, payments).total, 0); return <div key={vehicle.id} className="flex gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3">{vehicle.imageUrl ? <img src={vehicle.imageUrl} alt="" className="h-14 w-16 shrink-0 rounded-xl object-cover" /> : <span className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-[var(--app-surface-soft)] text-[var(--app-text-muted)]"><Car className="h-5 w-5" /></span>}<div className="min-w-0 flex-1"><p className="truncate font-black text-[var(--app-text)]">{vehicle.brand} {vehicle.model}</p><p className="mt-0.5 text-xs text-[var(--app-text-muted)]"><PlateNumber value={vehicle.plate} /> · {vehicle.city || '—'}</p><p className="mt-1 text-xs font-bold text-[var(--app-gold-text)]">{formatMAD(revenue)} revenus</p></div><Badge>{vehicle.status}</Badge></div>; })}</div></section>
    <section className="mt-5"><h3 className="text-base font-black text-[var(--app-text)]">Réservations période</h3><p className="mt-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm text-[var(--app-text-muted)]">{item.reservationsCount ? `${item.reservationsCount} réservation(s) sur la période, dont ${item.activeReservations} active(s).` : 'Aucune réservation sur cette période.'}</p></section><section className="mt-5"><h3 className="text-base font-black text-[var(--app-text)]">Retards / actions à suivre</h3><p className={`mt-2 rounded-2xl border p-3 text-sm ${item.lateReturns ? 'border-amber-400/25 bg-amber-500/10 text-amber-800 dark:text-amber-100' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100'}`}>{item.lateReturns ? `${item.lateReturns} retour(s) en retard à traiter.` : 'Aucun retard à suivre.'}</p></section>
    <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2"><Link to="/vehicles" className="inline-flex h-11 items-center justify-center rounded-2xl bg-gold-400 px-4 text-sm font-black text-carbon-950">Gérer véhicules</Link><Link to="/reservations" className="inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 text-sm font-bold text-[var(--app-text)]">Voir réservations</Link></div>
  </div>;
}
