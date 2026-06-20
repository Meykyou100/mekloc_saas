import { AlertTriangle, Car, CircleDollarSign, Clock3, Mail, Search, UserRound, UsersRound, WalletCards } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import PlateNumber from '../components/ui/PlateNumber';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useSupportMode } from '../context/SupportModeContext';
import { formatMAD, type Payment } from '../data/mockData';
import {
  fleetPeriodRange,
  getFleetResponsiblePerformance,
  responsibleInitials,
  roleLabelFr,
  type FleetPeriod,
  type FleetResponsible,
  type FleetResponsiblePerformance,
} from '../lib/fleetResponsibles';
import { getReservationPaymentSummary } from '../lib/paymentBalance';
import { supabase } from '../lib/supabase';

type ResponsibleFilter = 'all' | 'with_vehicles' | 'without_vehicles' | 'remaining' | 'unassigned';

function Metric({ label, value, note, icon: Icon, tone = 'gold' }: { label: string; value: string; note: string; icon: typeof Car; tone?: 'gold' | 'green' | 'amber' | 'red' }) {
  const toneClass = {
    gold: 'border-gold-300/20 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]',
    green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    amber: 'border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200',
    red: 'border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-200',
  }[tone];
  return (
    <Card className="flex min-w-[156px] flex-col justify-between rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_14px_32px_rgba(16,24,32,.10)] sm:min-w-0 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-[var(--app-text-muted)]">{label}</p>
          <p className="mt-2 truncate text-xl font-black text-[var(--app-text)] sm:text-2xl">{value}</p>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${toneClass}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 text-xs text-[var(--app-text-muted)]">{note}</p>
    </Card>
  );
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'gold' | 'red' }) {
  const classes = {
    neutral: 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]',
    green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    gold: 'border-gold-300/25 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]',
    red: 'border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-200',
  }[tone];
  return <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${classes}`}>{children}</span>;
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

  useEffect(() => {
    let mounted = true;
    async function loadMembers() {
      if (!supabase || !agencyId) {
        if (mounted) {
          setMembers([]);
          setTeamLoading(false);
        }
        return;
      }
      setTeamLoading(true);
      const { data, error } = await supabase
        .from('users_profiles')
        .select('id,full_name,email,role,account_status')
        .eq('agency_id', agencyId)
        .eq('account_status', 'active')
        .order('full_name', { ascending: true });
      if (!mounted) return;
      if (!error) {
        setMembers(((data || []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null; account_status: string | null }>).map((member) => ({
          id: member.id,
          fullName: member.full_name || member.email || 'Utilisateur',
          email: member.email || '',
          role: member.role || 'agent',
          accountStatus: member.account_status,
        })));
      } else {
        setMembers([]);
      }
      setTeamLoading(false);
    }
    void loadMembers();
    return () => { mounted = false; };
  }, [agencyId]);

  const range = useMemo(() => fleetPeriodRange(period), [period]);
  const performance = useMemo(
    () => getFleetResponsiblePerformance({ members, vehicles, reservations, payments, start: range.start, end: range.end }),
    [members, payments, range.end, range.start, reservations, vehicles],
  );
  const assigned = performance.filter((item) => !item.isUnassigned);
  const unassigned = performance.find((item) => item.isUnassigned) || null;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return performance.filter((item) => {
      const member = item.responsible;
      const searchMatch = item.isUnassigned
        ? !normalized || 'non assigne non assigné'.includes(normalized)
        : !normalized || `${member?.fullName || ''} ${member?.email || ''} ${member?.role || ''}`.toLowerCase().includes(normalized);
      if (!searchMatch) return false;
      if (filter === 'with_vehicles') return !item.isUnassigned && item.assignedVehicles > 0;
      if (filter === 'without_vehicles') return !item.isUnassigned && item.assignedVehicles === 0;
      if (filter === 'remaining') return item.remaining > 0;
      if (filter === 'unassigned') return item.isUnassigned;
      return true;
    });
  }, [filter, performance, query]);

  const totalAssignedVehicles = assigned.reduce((sum, item) => sum + item.assignedVehicles, 0);
  const totalRevenue = performance.reduce((sum, item) => sum + item.revenue, 0);
  const totalRemaining = performance.reduce((sum, item) => sum + item.remaining, 0);
  const activeReservations = performance.reduce((sum, item) => sum + item.activeReservations, 0);

  return (
    <div className="space-y-4 overflow-x-hidden pb-[calc(118px+env(safe-area-inset-bottom))] md:space-y-6 md:pb-8">
      <div className="md:hidden">
        <div className="rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(135deg,var(--app-card),var(--app-surface))] p-4 shadow-[0_14px_34px_rgba(16,24,32,.10)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--app-gold-text)]">Flotte</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--app-text)]">Responsables de flotte</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">Suivez les véhicules, réservations et revenus par responsable.</p>
        </div>
      </div>
      <div className="hidden md:block">
        <PageHeader eyebrow="Flotte" title="Responsables de flotte" description="Suivez les véhicules, réservations et revenus générés par responsable." />
      </div>

      <section className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 xl:grid-cols-6">
        <Metric label="Responsables actifs" value={String(members.length)} note="Membres actifs" icon={UsersRound} tone="green" />
        <Metric label="Véhicules assignés" value={String(totalAssignedVehicles)} note="Dans la flotte" icon={Car} />
        <Metric label="Non assignés" value={String(unassigned?.assignedVehicles || 0)} note="À attribuer" icon={AlertTriangle} tone={(unassigned?.assignedVehicles || 0) > 0 ? 'amber' : 'green'} />
        <Metric label="Revenus période" value={formatMAD(totalRevenue)} note="Réservations non annulées" icon={CircleDollarSign} />
        <Metric label="Reste à payer" value={formatMAD(totalRemaining)} note="Selon les paiements liés" icon={WalletCards} tone={totalRemaining > 0 ? 'amber' : 'green'} />
        <Metric label="Réservations actives" value={String(activeReservations)} note="Locations en cours" icon={Clock3} tone="green" />
      </section>

      <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_14px_34px_rgba(16,24,32,.10)] sm:rounded-3xl sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="relative block min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
            <input className="form-control h-11 w-full rounded-2xl pl-10 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un responsable par nom ou email" />
          </label>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 lg:mx-0 lg:px-0">
            {([
              ['month', 'Ce mois'],
              ['quarter', '3 mois'],
              ['year', 'Année'],
            ] as Array<[FleetPeriod, string]>).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPeriod(value)} className={`h-11 shrink-0 rounded-2xl px-4 text-sm font-black transition ${period === value ? 'bg-gold-400 text-carbon-950' : 'border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">
          {([
            ['all', 'Tous'],
            ['with_vehicles', 'Avec véhicules'],
            ['without_vehicles', 'Sans véhicules'],
            ['remaining', 'Avec reste à payer'],
            ['unassigned', 'Non assigné'],
          ] as Array<[ResponsibleFilter, string]>).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`h-9 shrink-0 rounded-xl px-3 text-xs font-bold transition ${filter === value ? 'border border-gold-300/35 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]' : 'border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-muted)]'}`}>{label}</button>
          ))}
        </div>
      </Card>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2 sm:mb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--app-gold-text)]">Performance par responsable</p>
            <h2 className="mt-1 text-xl font-black text-[var(--app-text)]">Suivi de la flotte</h2>
          </div>
          <p className="text-sm font-semibold text-[var(--app-text-muted)]">{range.start} → {range.end}</p>
        </div>
        {teamLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={UsersRound} title="Aucun responsable trouvé" message="Ajustez la recherche ou les filtres pour retrouver un responsable." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const responsible = item.responsible;
              const title = item.isUnassigned ? 'Non assigné' : responsible?.fullName || 'Responsable';
              return (
                <Card key={responsible?.id || 'unassigned'} className="flex min-w-0 flex-col rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_14px_34px_rgba(16,24,32,.10)] transition hover:border-gold-300/25 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-sm font-black ${item.isUnassigned ? 'border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200' : 'border-gold-300/25 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]'}`}>{item.isUnassigned ? <Car className="h-5 w-5" /> : responsibleInitials(title)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-black text-[var(--app-text)]">{title}</p>
                      <p className="mt-0.5 truncate text-sm text-[var(--app-text-muted)]">{item.isUnassigned ? 'Véhicules sans responsable' : roleLabelFr(responsible?.role)}</p>
                      {!item.isUnassigned && responsible?.email ? <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">{responsible.email}</p> : null}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Véhicules</p><p className="mt-1 text-lg font-black text-[var(--app-text)]">{item.assignedVehicles}</p></div>
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Réservations</p><p className="mt-1 text-lg font-black text-[var(--app-text)]">{item.reservationsCount}</p></div>
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Encaissé</p><p className="mt-1 truncate text-sm font-black text-emerald-700 dark:text-emerald-200">{formatMAD(item.paid)}</p></div>
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Reste</p><p className={`mt-1 truncate text-sm font-black ${item.remaining > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-[var(--app-text)]'}`}>{formatMAD(item.remaining)}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill tone="gold">{formatMAD(item.revenue)} revenus</StatusPill>
                    {item.activeReservations ? <StatusPill tone="green">{item.activeReservations} active(s)</StatusPill> : null}
                    {item.lateReturns ? <StatusPill tone="red">{item.lateReturns} retard(s)</StatusPill> : null}
                  </div>
                  <Button variant="secondary" className="mt-4 h-11 w-full rounded-2xl" onClick={() => setSelected(item)}>Voir détails</Button>
                </Card>
              );
            })}
          </div>
        )}
        {!teamLoading && members.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-[var(--app-text-muted)]">Aucun responsable disponible. Ajoutez des membres depuis Paramètres &gt; Équipe.</p> : null}
      </section>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.isUnassigned ? 'Véhicules non assignés' : selected?.responsible?.fullName || 'Responsable'} subtitle="Détails de performance" panelClassName="sm:max-w-4xl lg:max-h-[90dvh]" bodyClassName="p-0">
        {selected ? <ResponsibleDetails item={selected} payments={payments} /> : null}
      </Modal>
    </div>
  );
}

function ResponsibleDetails({ item, payments }: { item: FleetResponsiblePerformance; payments: Payment[] }) {
  const title = item.isUnassigned ? 'Non assigné' : item.responsible?.fullName || 'Responsable';
  return (
    <div className="max-h-[78dvh] overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:p-6">
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-black text-[var(--app-text)]">{title}</p>
            {!item.isUnassigned ? <p className="mt-1 flex items-center gap-2 text-sm text-[var(--app-text-muted)]"><Mail className="h-4 w-4" />{item.responsible?.email || 'Email non renseigné'}</p> : <p className="mt-1 text-sm text-[var(--app-text-muted)]">Assignez ces véhicules depuis la fiche véhicule.</p>}
          </div>
          <StatusPill tone={item.remaining > 0 ? 'gold' : 'green'}>{formatMAD(item.remaining)} reste</StatusPill>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div><p className="text-xs text-[var(--app-text-muted)]">Véhicules</p><p className="mt-1 font-black text-[var(--app-text)]">{item.assignedVehicles}</p></div>
          <div><p className="text-xs text-[var(--app-text-muted)]">Réservations</p><p className="mt-1 font-black text-[var(--app-text)]">{item.reservationsCount}</p></div>
          <div><p className="text-xs text-[var(--app-text-muted)]">Actives</p><p className="mt-1 font-black text-[var(--app-text)]">{item.activeReservations}</p></div>
          <div><p className="text-xs text-[var(--app-text-muted)]">Retards</p><p className="mt-1 font-black text-[var(--app-text)]">{item.lateReturns}</p></div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/vehicles"><Button variant="secondary" className="h-10 rounded-xl">Voir véhicules</Button></Link>
        <Link to="/reservations"><Button variant="secondary" className="h-10 rounded-xl">Voir réservations</Button></Link>
      </div>
      <section className="mt-5">
        <h3 className="text-base font-black text-[var(--app-text)]">Véhicules assignés</h3>
        <div className="mt-3 grid gap-3">
          {item.vehicles.length === 0 ? <EmptyState icon={Car} title="Aucun véhicule assigné" message="Les véhicules apparaîtront ici après leur assignation." /> : item.vehicles.map((vehicle) => {
            const linkedReservations = item.reservations.filter((reservation) => reservation.vehicleId === vehicle.id);
            const revenue = linkedReservations.filter((reservation) => reservation.status !== 'Cancelled').reduce((sum, reservation) => sum + getReservationPaymentSummary(reservation, payments).total, 0);
            const active = linkedReservations.find((reservation) => reservation.status === 'Active');
            return (
              <div key={vehicle.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 sm:flex-row sm:items-center">
                {vehicle.imageUrl ? <img src={vehicle.imageUrl} alt="" className="h-16 w-full rounded-xl object-cover sm:w-20" /> : <div className="grid h-16 w-full place-items-center rounded-xl bg-[var(--app-surface-soft)] text-[var(--app-text-muted)] sm:w-20"><Car className="h-5 w-5" /></div>}
                <div className="min-w-0 flex-1"><p className="truncate font-black text-[var(--app-text)]">{vehicle.brand} {vehicle.model}</p><p className="mt-1 text-sm text-[var(--app-text-muted)]"><PlateNumber value={vehicle.plate} /> · {vehicle.city || '—'} · {formatMAD(vehicle.dailyPrice)}/jour</p><p className="mt-1 text-xs font-semibold text-[var(--app-gold-text)]">Revenus: {formatMAD(revenue)}</p></div>
                <div className="flex flex-wrap gap-2 sm:justify-end"><Badge>{vehicle.status}</Badge>{active ? <StatusPill tone="green">Active</StatusPill> : null}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
