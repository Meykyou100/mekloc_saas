import { AlertTriangle, ArrowRight, Car, CircleDollarSign, Clock3, Mail, RefreshCw, Search, ShieldCheck, UsersRound, WalletCards } from 'lucide-react';
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

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'gold' | 'amber' }) {
  const styles = { neutral: 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]', green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200', gold: 'border-gold-300/25 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]', amber: 'border-amber-400/25 bg-amber-500/10 text-amber-800 dark:text-amber-100' }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${styles}`}>{children}</span>;
}

function OverviewCard({ label, value, subline, icon: Icon, tone = 'gold' }: { label: string; value: string; subline: ReactNode; icon: typeof Car; tone?: 'gold' | 'green' | 'amber' }) {
  const tones = { gold: 'border-gold-300/25 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]', green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200', amber: 'border-amber-400/25 bg-amber-500/10 text-amber-800 dark:text-amber-100' }[tone];
  return <Card className="min-w-0 rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_12px_28px_rgba(16,24,32,.07)] sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--app-text-muted)]">{label}</p><p className="mt-2 break-words text-xl font-black tracking-tight text-[var(--app-text)] sm:text-2xl">{value}</p></div><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${tones}`}><Icon className="h-4 w-4" /></span></div><div className="mt-3 border-t border-[var(--app-border-soft)] pt-3 text-xs leading-5 text-[var(--app-text-muted)]">{subline}</div></Card>;
}

function InlineMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'green' | 'amber' }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--app-text-muted)]">{label}</p><p className={`mt-0.5 text-sm font-black ${tone === 'green' ? 'text-emerald-700 dark:text-emerald-200' : tone === 'amber' ? 'text-amber-800 dark:text-amber-100' : 'text-[var(--app-text)]'}`}>{value}</p></div>;
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
  const treatmentRef = useRef<HTMLDivElement>(null);

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
  const unassigned = performance.find((item) => item.isUnassigned) || null;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return performance.filter((item) => {
      const member = item.responsible;
      const match = item.isUnassigned ? !normalized || 'non assigne non assigné véhicules sans responsable'.includes(normalized) : !normalized || `${member?.fullName || ''} ${member?.email || ''} ${member?.role || ''}`.toLowerCase().includes(normalized);
      if (!match) return false;
      if (filter === 'with_vehicles') return !item.isUnassigned && item.assignedVehicles > 0;
      if (filter === 'without_vehicles') return !item.isUnassigned && item.assignedVehicles === 0;
      if (filter === 'remaining') return item.remaining > 0;
      return filter === 'unassigned' ? item.isUnassigned : true;
    });
  }, [filter, performance, query]);
  const responsibles = filtered.filter((item) => !item.isUnassigned);
  const totals = useMemo(() => performance.reduce((result, item) => ({ vehicles: result.vehicles + (item.isUnassigned ? 0 : item.assignedVehicles), revenue: result.revenue + item.revenue, paid: result.paid + item.paid, remaining: result.remaining + item.remaining, active: result.active + item.activeReservations }), { vehicles: 0, revenue: 0, paid: 0, remaining: 0, active: 0 }), [performance]);
  const showUnassigned = Boolean(unassigned && (filter === 'all' || filter === 'unassigned') && (!query || 'non assigne non assigné véhicules sans responsable'.includes(query.trim().toLowerCase())));
  const showTreatment = () => { setFilter('unassigned'); setQuery(''); window.setTimeout(() => treatmentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); };

  return <div className="space-y-4 overflow-x-hidden pb-[calc(110px+env(safe-area-inset-bottom))] md:space-y-5 md:pb-8">
    <header className="flex flex-col gap-3 rounded-3xl border border-[var(--app-border)] bg-[linear-gradient(120deg,var(--app-card),var(--app-surface-soft))] px-4 py-4 shadow-[0_12px_30px_rgba(16,24,32,.07)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.22em] text-[var(--app-gold-text)]">Flotte</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--app-text)]">Responsables de flotte</h1><p className="mt-1 text-sm text-[var(--app-text-muted)]">La performance de votre flotte, en un coup d’œil.</p></div>
      <div className="grid grid-cols-1 gap-2 sm:flex"><Link to="/vehicles" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gold-400 px-4 text-sm font-black text-carbon-950 transition hover:bg-gold-300"><Car className="h-4 w-4" />Assigner véhicules</Link><Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} className="h-11 whitespace-nowrap rounded-2xl px-4" onClick={() => setReloadKey((value) => value + 1)}>Actualiser</Button></div>
    </header>

    <section><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-black text-[var(--app-text)]">Vue d’ensemble</h2><span className="text-xs text-[var(--app-text-muted)]">{range.start} → {range.end}</span></div><div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
      <OverviewCard label="Responsables actifs" value={String(members.length)} icon={UsersRound} tone="green" subline={<>{totals.active} réservation(s) active(s)</>} />
      <OverviewCard label="Véhicules suivis" value={`${totals.vehicles} assignés`} icon={Car} tone={(unassigned?.assignedVehicles || 0) > 0 ? 'amber' : 'green'} subline={<><strong className="text-[var(--app-text-soft)]">{unassigned?.assignedVehicles || 0}</strong> non assigné(s)</>} />
      <OverviewCard label="Revenus période" value={formatMAD(totals.revenue)} icon={CircleDollarSign} subline={<><strong className="text-emerald-700 dark:text-emerald-200">{formatMAD(totals.paid)}</strong> encaissés</>} />
      <OverviewCard label="Reste à payer" value={formatMAD(totals.remaining)} icon={WalletCards} tone={totals.remaining > 0 ? 'amber' : 'green'} subline={<>{totals.active} location(s) en cours</>} />
    </div></section>

    {unassigned && unassigned.assignedVehicles > 0 ? <section className="flex flex-col gap-3 rounded-2xl border border-gold-300/30 bg-[var(--app-gold-soft)] px-4 py-3.5 shadow-[0_10px_24px_rgba(146,101,0,.05)] sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-400/20 text-[var(--app-gold-text)]"><AlertTriangle className="h-5 w-5" /></span><div><h2 className="font-black text-[var(--app-text)]">{unassigned.assignedVehicles} véhicule{unassigned.assignedVehicles > 1 ? 's' : ''} sans responsable</h2><p className="mt-0.5 text-sm text-[var(--app-text-muted)]">Assignez ces véhicules pour suivre les revenus par responsable.</p></div></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><Button className="h-11 rounded-2xl" onClick={showTreatment}>Assigner maintenant</Button><Link to="/vehicles" className="inline-flex h-10 items-center justify-center px-2 text-sm font-bold text-[var(--app-gold-text)] hover:underline">Voir véhicules</Link></div></section> : <section className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-100"><ShieldCheck className="h-5 w-5 shrink-0" />Tous les véhicules sont assignés.</section>}

    <section className="border-y border-[var(--app-border-soft)] py-3"><div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" /><input className="form-control h-10 w-full rounded-xl pl-10 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un responsable" /></label><div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 lg:mx-0 lg:px-0">{([['month', 'Ce mois'], ['quarter', '3 mois'], ['year', 'Année']] as Array<[FleetPeriod, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`h-10 shrink-0 rounded-xl px-3 text-xs font-black transition ${period === value ? 'bg-gold-400 text-carbon-950' : 'border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]'}`}>{label}</button>)}</div></div><div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">{([['all', 'Tous'], ['with_vehicles', 'Avec véhicules'], ['without_vehicles', 'Sans véhicules'], ['remaining', 'Avec reste'], ['unassigned', 'Non assigné']] as Array<[ResponsibleFilter, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`h-8 shrink-0 rounded-full px-3 text-[11px] font-bold transition ${filter === value ? 'bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]' : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-soft)]'}`}>{label}</button>)}</div></section>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)] xl:items-start"><section><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--app-gold-text)]">Équipe</p><h2 className="mt-1 text-xl font-black text-[var(--app-text)]">Responsables</h2></div><span className="text-sm font-semibold text-[var(--app-text-muted)]">{responsibles.length}</span></div>
      {teamLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />)}</div> : responsibles.length === 0 ? <EmptyState icon={UsersRound} title={members.length === 0 ? 'Aucun membre disponible' : 'Aucun responsable trouvé'} message={members.length === 0 ? 'Ajoutez un membre depuis Paramètres > Équipe.' : 'Ajustez la recherche ou les filtres pour retrouver un responsable.'} /> : <div className="space-y-3">{responsibles.map((item) => <ResponsibleRow key={item.responsible?.id} item={item} onDetails={() => setSelected(item)} />)}</div>}
    </section>
    <aside ref={treatmentRef} className="xl:sticky xl:top-5"><div className="mb-3"><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--app-gold-text)]">Priorités</p><h2 className="mt-1 text-xl font-black text-[var(--app-text)]">À traiter</h2></div>{showUnassigned && unassigned ? <UnassignedCard item={unassigned} /> : <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-5"><ShieldCheck className="h-6 w-6 text-emerald-700 dark:text-emerald-200" /><p className="mt-3 font-black text-[var(--app-text)]">Rien à attribuer</p><p className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">Tous les véhicules sont déjà rattachés à un responsable.</p></Card>}</aside>
    </div>

    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.responsible?.fullName || 'Responsable'} subtitle="Détails de performance" panelClassName="sm:ml-auto sm:mr-0 sm:h-[100dvh] sm:max-h-none sm:max-w-xl sm:rounded-l-3xl sm:rounded-r-none" bodyClassName="p-0">{selected ? <ResponsibleDetails item={selected} payments={payments} /> : null}</Modal>
  </div>;
}

function ResponsibleRow({ item, onDetails }: { item: FleetResponsiblePerformance; onDetails: () => void }) {
  const name = item.responsible?.fullName || 'Responsable'; const rate = item.revenue > 0 ? Math.min(100, Math.round((item.paid / item.revenue) * 100)) : 0;
  if (item.assignedVehicles === 0) return <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_12px_28px_rgba(16,24,32,.06)] sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--app-surface-soft)] text-sm font-black text-[var(--app-gold-text)]">{responsibleInitials(name)}</span><div className="min-w-0"><p className="truncate font-black text-[var(--app-text)]">{name}</p><p className="mt-0.5 truncate text-sm text-[var(--app-text-muted)]">{roleLabelFr(item.responsible?.role)} · Aucun véhicule assigné</p></div></div><Link to="/vehicles" className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl bg-gold-400 px-4 text-sm font-black text-carbon-950">Assigner un véhicule</Link></div></Card>;
  return <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_12px_28px_rgba(16,24,32,.06)] transition hover:border-gold-300/30 max-sm:rounded-2xl max-sm:p-3.5 sm:p-5"><div className="flex flex-col gap-4 max-sm:gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gold-300/25 bg-[var(--app-gold-soft)] text-sm font-black text-[var(--app-gold-text)] max-sm:h-10 max-sm:w-10 max-sm:rounded-xl">{responsibleInitials(name)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-[var(--app-text)]">{name}</p><StatusPill tone="green">Actif</StatusPill></div><p className="mt-0.5 truncate text-sm text-[var(--app-text-muted)]">{roleLabelFr(item.responsible?.role)} · {item.responsible?.email || 'Email non renseigné'}</p></div><StatusPill tone="neutral">{item.assignedVehicles} véhicule{item.assignedVehicles > 1 ? 's' : ''}</StatusPill></div><div className="grid grid-cols-3 gap-3 border-y border-[var(--app-border-soft)] py-3 max-sm:gap-2 max-sm:py-2.5"><InlineMetric label="Revenus" value={formatMAD(item.revenue)} /><InlineMetric label="Encaissé" value={formatMAD(item.paid)} tone="green" /><InlineMetric label="Reste" value={formatMAD(item.remaining)} tone={item.remaining > 0 ? 'amber' : 'default'} /></div><div><div className="flex items-center justify-between text-xs"><span className="font-semibold text-[var(--app-text-muted)]">Encaissements</span><span className="font-black text-emerald-700 dark:text-emerald-200">{rate}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--app-surface-soft)]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} /></div></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Button variant="secondary" className="h-11 rounded-2xl" onClick={onDetails}>Voir détails</Button><Link to="/vehicles" className="inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 text-sm font-bold text-[var(--app-text)]">Gérer véhicules</Link></div></div></Card>;
}

function UnassignedCard({ item }: { item: FleetResponsiblePerformance }) {
  const vehicles = item.vehicles.slice(0, 3);
  return <Card className="rounded-3xl border-amber-400/30 bg-[linear-gradient(145deg,rgba(245,158,11,.14),var(--app-card))] p-5 shadow-[0_14px_30px_rgba(146,64,14,.08)]"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/15 text-amber-800 dark:text-amber-100"><AlertTriangle className="h-5 w-5" /></span><h3 className="mt-4 text-lg font-black text-[var(--app-text)]">Véhicules non assignés</h3><p className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">Ces véhicules n’alimentent encore aucun suivi individuel.</p><div className="mt-4 grid grid-cols-2 gap-y-3 border-y border-amber-400/20 py-4"><InlineMetric label="Véhicules" value={String(item.assignedVehicles)} /><InlineMetric label="Revenus" value={formatMAD(item.revenue)} /><InlineMetric label="Reste" value={formatMAD(item.remaining)} tone={item.remaining > 0 ? 'amber' : 'default'} /><InlineMetric label="Retards" value={String(item.lateReturns)} tone={item.lateReturns > 0 ? 'amber' : 'default'} /></div>{vehicles.length ? <div className="mt-4 flex flex-wrap gap-1.5">{vehicles.map((vehicle) => <StatusPill key={vehicle.id} tone="neutral">{vehicle.brand} {vehicle.model}</StatusPill>)}{item.vehicles.length > vehicles.length ? <StatusPill tone="neutral">+{item.vehicles.length - vehicles.length}</StatusPill> : null}</div> : null}<Link to="/vehicles" className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gold-400 px-4 text-sm font-black text-carbon-950">Assigner ces véhicules <ArrowRight className="ml-2 h-4 w-4" /></Link></Card>;
}

function ResponsibleDetails({ item, payments }: { item: FleetResponsiblePerformance; payments: Payment[] }) {
  const name = item.responsible?.fullName || 'Responsable'; const rate = item.revenue > 0 ? Math.min(100, Math.round((item.paid / item.revenue) * 100)) : 0;
  return <div className="space-y-5 p-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:p-6"><section className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--app-gold-soft)] text-sm font-black text-[var(--app-gold-text)]">{responsibleInitials(name)}</span><div className="min-w-0"><p className="font-black text-[var(--app-text)]">{name}</p><p className="mt-1 flex items-center gap-2 truncate text-sm text-[var(--app-text-muted)]"><Mail className="h-4 w-4 shrink-0" />{item.responsible?.email || 'Email non renseigné'}</p></div></div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--app-border-soft)] pt-4"><InlineMetric label="Véhicules" value={String(item.assignedVehicles)} /><InlineMetric label="Réservations" value={String(item.reservationsCount)} /><InlineMetric label="Retards" value={String(item.lateReturns)} tone={item.lateReturns ? 'amber' : 'default'} /></div></section><section><div className="flex items-center justify-between"><h3 className="font-black text-[var(--app-text)]">Paiements</h3><span className="text-sm font-black text-emerald-700 dark:text-emerald-200">{rate}% encaissé</span></div><div className="mt-3 grid grid-cols-3 gap-2"><InlineMetric label="Revenus" value={formatMAD(item.revenue)} /><InlineMetric label="Encaissé" value={formatMAD(item.paid)} tone="green" /><InlineMetric label="Reste" value={formatMAD(item.remaining)} tone={item.remaining ? 'amber' : 'default'} /></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--app-surface-soft)]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} /></div></section><section><h3 className="font-black text-[var(--app-text)]">Véhicules assignés</h3><div className="mt-3 space-y-2">{item.vehicles.length === 0 ? <EmptyState icon={Car} title="Aucun véhicule assigné" message="Attribuez un véhicule pour démarrer le suivi." /> : item.vehicles.map((vehicle) => { const related = item.reservations.filter((reservation) => reservation.vehicleId === vehicle.id); const revenue = related.filter((reservation) => reservation.status !== 'Cancelled').reduce((total, reservation) => total + getReservationPaymentSummary(reservation, payments).total, 0); return <div key={vehicle.id} className="flex items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3">{vehicle.imageUrl ? <img src={vehicle.imageUrl} alt="" className="h-12 w-14 shrink-0 rounded-xl object-cover" /> : <span className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-[var(--app-surface-soft)] text-[var(--app-text-muted)]"><Car className="h-5 w-5" /></span>}<div className="min-w-0 flex-1"><p className="truncate font-black text-[var(--app-text)]">{vehicle.brand} {vehicle.model}</p><p className="mt-0.5 text-xs text-[var(--app-text-muted)]"><PlateNumber value={vehicle.plate} /> · {formatMAD(revenue)}</p></div><Badge>{vehicle.status}</Badge></div>; })}</div></section><section><h3 className="font-black text-[var(--app-text)]">À suivre</h3><p className="mt-2 rounded-2xl bg-[var(--app-surface-soft)] p-3 text-sm text-[var(--app-text-muted)]">{item.reservationsCount ? `${item.reservationsCount} réservation(s) sur cette période, dont ${item.activeReservations} active(s).` : 'Aucune réservation sur cette période.'}{item.lateReturns ? ` ${item.lateReturns} retour(s) nécessitent une attention.` : ''}</p></section><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Link to="/vehicles" className="inline-flex h-11 items-center justify-center rounded-2xl bg-gold-400 px-4 text-sm font-black text-carbon-950">Gérer véhicules</Link><Link to="/reservations" className="inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 text-sm font-bold text-[var(--app-text)]">Voir réservations</Link></div></div>;
}
