import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  Car,
  FileSignature,
  MessageCircle,
  Plus,
  UserPlus,
  UsersRound,
  WalletCards,
  Wrench,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import { MobileEmptyBlock } from '../components/ui/MobilePrimitives';
import PlateNumber from '../components/ui/PlateNumber';
import {
  formatMAD,
} from '../data/mockData';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  buildWhatsAppReminderUrl,
  getOverdueReservations,
  getPaymentAlerts,
  getTodayReservations,
  getVehicleExpiryAlerts,
  type AssistantPriority,
} from '../lib/assistantDuJour';
import { getNotificationPreferences } from '../lib/notificationPreferences';
import { daysUntil, isSubscriptionExpiringSoon } from '../lib/subscription';
import { useSupportMode } from '../context/SupportModeContext';
import { fleetPeriodRange, getFleetResponsiblePerformance, type FleetResponsible } from '../lib/fleetResponsibles';
import { canAccess } from '../lib/permissions';
import { supabase } from '../lib/supabase';

const actionItems = [
  { label: 'Ajouter réservation', to: '/reservations', icon: CalendarClock },
  { label: 'Ajouter véhicule', to: '/vehicles', icon: Car },
  { label: 'Ajouter client', to: '/clients', icon: UserPlus },
  { label: 'Créer contrat', to: '/contracts', icon: FileSignature },
];

const secondaryPriorityActionClass = 'inline-flex min-h-9 items-center justify-center gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 py-2 text-xs font-bold text-[var(--app-text-soft)] transition hover:bg-[var(--app-surface-soft)]';
const primaryPriorityActionClass = 'inline-flex min-h-9 items-center justify-center rounded-xl border border-gold-300/40 bg-[var(--app-gold-soft)] px-3 py-2 text-xs font-bold text-[var(--app-gold-text)] transition hover:bg-gold-500/20';
const disabledPriorityActionClass = 'inline-flex min-h-9 cursor-not-allowed items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--app-text-muted)]';

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'gold',
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Car;
  tone?: 'gold' | 'blue' | 'green' | 'violet';
}) {
  const toneClasses = {
    gold: 'border-gold-400/30 bg-gold-500/10 text-amber-700 shadow-[0_0_28px_rgba(227,177,23,0.08)] dark:text-gold-100',
    blue: 'border-sky-400/25 bg-sky-500/10 text-sky-700 dark:text-sky-100',
    green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100',
    violet: 'border-violet-400/25 bg-violet-500/10 text-violet-700 dark:text-violet-100',
  };

  return (
    <Card className="group flex min-h-[104px] flex-col justify-between rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3 transition hover:border-gold-300/25 hover:shadow-[0_18px_50px_rgba(0,0,0,0.20)] sm:min-h-[124px] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase leading-4 tracking-[0.1em] text-[var(--app-text-muted)] sm:tracking-[0.12em]">{label}</p>
          <p className="mt-2 truncate text-[1.35rem] font-black leading-none tracking-tight text-[var(--app-text)] sm:text-2xl">{value}</p>
        </div>
        <div className={`rounded-xl border p-2 sm:rounded-2xl sm:p-2.5 ${toneClasses[tone]}`}>
          <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
        </div>
      </div>
      <p className="mt-2 line-clamp-1 text-xs font-medium text-[var(--app-text-muted)]">{helper}</p>
    </Card>
  );
}

function ActivityRow({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  icon: typeof Car;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <div className="premium-surface flex min-w-0 items-center justify-between gap-3 rounded-2xl px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`rounded-xl p-2 ${tone === 'warning' ? 'bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]' : 'bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-[var(--app-text-soft)]">{label}</span>
      </div>
      <strong className="text-lg font-semibold text-[var(--app-text)]">{value}</strong>
    </div>
  );
}

function PriorityCard({
  title,
  priority,
  emptyText,
  icon: Icon,
  children,
}: {
  title: string;
  priority: AssistantPriority;
  emptyText: string;
  icon: typeof Car;
  children?: ReactNode;
}) {
  return (
    <Card className="min-h-[150px] rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3.5 transition hover:border-gold-300/20 sm:rounded-3xl sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-gold-300/20 bg-[var(--app-gold-soft)] p-2.5 text-[var(--app-gold-text)]">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-base font-black leading-tight text-[var(--app-text)]">{title}</h3>
        </div>
        <PriorityBadge priority={priority} />
      </div>
      {children || <p className="text-sm text-[var(--app-text-muted)]">{emptyText}</p>}
    </Card>
  );
}

function PriorityBadge({ priority }: { priority: AssistantPriority }) {
  if (priority === 'urgent') return <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-200">Urgent</span>;
  if (priority === 'today') return <span className="rounded-full border border-gold-300/20 bg-[var(--app-gold-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--app-gold-text)]">Aujourd’hui</span>;
  if (priority === 'missing') return <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:text-orange-200">À suivre</span>;
  return <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--app-text-soft)]">À surveiller</span>;
}

function QuickActionsCard() {
  return (
    <Card className="self-start rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[var(--app-shadow)] sm:rounded-[28px] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--app-gold-text)]">Commandes</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--app-text)]">Actions rapides</h2>
        </div>
        <span className="hidden rounded-full border border-gold-300/20 bg-[var(--app-gold-soft)] px-3 py-1 text-[11px] font-black text-[var(--app-gold-text)] sm:inline-flex">
          Accès direct
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
        {actionItems.map(({ label, to, icon: Icon }, index) => (
          <Link
            key={label}
            to={to}
            className={`focus-ring flex h-11 min-w-0 items-center justify-between rounded-2xl border px-3 text-[13px] font-black transition ${
              index === 0
                ? 'border-[#E8B923]/70 bg-[#D4A017] text-carbon-950 shadow-[0_14px_30px_rgba(212,160,23,.18)] hover:bg-[#E8B923]'
                : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] hover:border-gold-300/25 hover:bg-[var(--app-gold-soft)]'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </span>
            <Plus className="h-4 w-4 shrink-0" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const {
    loading,
    vehicles,
    reservations,
    maintenance: maintenanceItems,
    payments,
    clients,
    contracts,
    updateReservation,
  } = useData();
  const { profile, agencyId: authAgencyId } = useAuth();
  const { supportAgency, supportAgencyId, isSupportMode } = useSupportMode();
  const agencyId = supportAgencyId || authAgencyId;
  const { notify } = useApp();
  const [fleetMembers, setFleetMembers] = useState<FleetResponsible[]>([]);
  const notificationPreferences = getNotificationPreferences((isSupportMode ? supportAgency : profile?.agency)?.settings);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const responsibleRange = useMemo(() => fleetPeriodRange('month'), []);

  useEffect(() => {
    let mounted = true;
    async function loadFleetMembers() {
      if (!supabase || !agencyId) {
        if (mounted) setFleetMembers([]);
        return;
      }
      const { data, error } = await supabase
        .from('users_profiles')
        .select('id,full_name,email,role,account_status')
        .eq('agency_id', agencyId)
        .eq('account_status', 'active')
        .order('full_name', { ascending: true });
      if (!mounted) return;
      if (error) {
        setFleetMembers([]);
        return;
      }
      setFleetMembers(((data || []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null; account_status: string | null }>).map((member) => ({
        id: member.id,
        fullName: member.full_name || member.email || 'Utilisateur',
        email: member.email || '',
        role: member.role || 'agent',
        accountStatus: member.account_status,
      })));
    }
    void loadFleetMembers();
    return () => { mounted = false; };
  }, [agencyId]);

  const fleetResponsiblePerformance = useMemo(
    () => getFleetResponsiblePerformance({
      members: fleetMembers,
      vehicles,
      reservations,
      payments,
      start: responsibleRange.start,
      end: responsibleRange.end,
    }),
    [fleetMembers, payments, reservations, responsibleRange.end, responsibleRange.start, vehicles],
  );
  const topFleetResponsible = fleetResponsiblePerformance
    .filter((item) => !item.isUnassigned && item.assignedVehicles > 0)
    .sort((a, b) => b.revenue - a.revenue)[0];
  const unassignedFleetVehicles = fleetResponsiblePerformance.find((item) => item.isUnassigned)?.assignedVehicles || 0;
  const fleetRemainingBalance = fleetResponsiblePerformance.reduce((total, item) => total + item.remaining, 0);
  const canOpenFleetResponsibles = Boolean(profile?.isSuperAdmin) || canAccess(profile?.role, 'reports');
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === 'Available').length;
  const activeReservations = reservations.filter((reservation) => reservation.status === 'Active').length;
  const monthlyRevenue = payments
    .filter((payment) => payment.status === 'Paid' || payment.status === 'Partial')
    .reduce((total, payment) => total + payment.amount, 0);
  const pendingPayments = payments.filter((payment) => payment.status === 'Pending' || payment.status === 'Late').length;
  const pickupsToday = reservations.filter((reservation) => reservation.pickupDate === today).length;
  const returnsToday = reservations.filter((reservation) => reservation.returnDate === today).length;
  const latePayments = payments.filter((payment) => payment.status === 'Late').length;
  const urgentMaintenance = maintenanceItems.filter((item) => item.priority === 'High').length;
  const upcomingPickups = reservations.filter((reservation) => reservation.pickupDate >= today && reservation.status !== 'Cancelled').slice(0, 3);
  const upcomingReturns = reservations.filter((reservation) => reservation.returnDate >= today && reservation.status !== 'Cancelled').slice(0, 3);
  const latePaymentItems = payments.filter((payment) => payment.status === 'Late' || payment.status === 'Pending').slice(0, 3);
  const todayPickups = useMemo(() => getTodayReservations(reservations, 'pickup'), [reservations]);
  const todayReturns = useMemo(() => getTodayReservations(reservations, 'return'), [reservations]);
  const overdueReservations = useMemo(() => getOverdueReservations(reservations), [reservations]);
  const paymentAlerts = useMemo(() => getPaymentAlerts(reservations, payments), [reservations, payments]);
  const vehicleAlerts = useMemo(
    () => getVehicleExpiryAlerts(vehicles, maintenanceItems),
    [vehicles, maintenanceItems],
  );
  const prioritiesAreClear =
    todayPickups.length === 0 &&
    todayReturns.length === 0 &&
    overdueReservations.length === 0 &&
    paymentAlerts.length === 0;

  async function markReservationCompleted(reservationId: string) {
    const target = reservations.find((reservation) => reservation.id === reservationId);
    if (!target) return;
    try {
      await updateReservation({ ...target, status: 'Completed' });
      notify({
        title: 'Réservation mise à jour',
        message: `${target.id} marquée comme terminée.`,
        type: 'success',
      });
    } catch {
      notify({
        title: 'Action impossible',
        message: 'La réservation n’a pas pu être mise à jour.',
        type: 'warning',
      });
    }
  }

  function getClientPhoneByReservation(reservationId: string, fallbackClientName: string) {
    const reservation = reservations.find((item) => item.id === reservationId);
    if (reservation?.clientId) {
      const byId = clients.find((client) => client.id === reservation.clientId);
      if (byId?.phone) return byId.phone;
    }
    const byName = clients.find(
      (client) => client.fullName.trim().toLowerCase() === fallbackClientName.trim().toLowerCase(),
    );
    return byName?.phone;
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-clip pb-[calc(124px+env(safe-area-inset-bottom))] md:space-y-6 md:overflow-visible md:pb-0">
      <header className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.22)] md:flex-row md:items-end md:justify-between md:rounded-none md:border-0 md:bg-none md:p-0 md:shadow-none">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--app-gold-text)] md:text-xs md:tracking-[0.34em]">Espace agence</p>
          <h1 className="mt-0.5 text-2xl font-black leading-none tracking-tight text-[var(--app-text)] sm:text-4xl md:mt-3">
            Tableau de bord
          </h1>
          <p className="mt-1 max-w-3xl truncate text-xs leading-5 text-[var(--app-text-muted)] sm:text-base md:mt-2 md:whitespace-normal md:leading-6">
            Vue claire des locations du jour, du parc disponible, des paiements et des actions prioritaires.
          </p>
        </div>
        <div className="hidden w-fit rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--app-text-soft)] shadow-[0_14px_40px_rgba(0,0,0,0.22)] md:block">
          {new Date().toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </header>

      {!isSupportMode && isSubscriptionExpiringSoon(profile?.agency) ? (
        <div className="rounded-2xl border border-white/[0.07] bg-[var(--app-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--app-gold-text)]">
          L’abonnement expire dans {daysUntil(profile?.agency?.subscriptionEndDate)} jour(s). Renouvelez pour éviter une interruption.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[var(--app-shadow)] sm:rounded-[28px] sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-gold-text)]">Assistant du jour</p>
            <h2 className="mt-1 text-lg font-black text-[var(--app-text)] sm:mt-2 sm:text-2xl">Actions prioritaires de la journée</h2>
            <p className="mt-1 text-xs text-[var(--app-text-muted)] sm:text-sm">Les urgences opérationnelles à traiter en premier.</p>
          </div>
          {prioritiesAreClear ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
              Tout est à jour
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <PriorityCard title="Départs aujourd’hui" priority="today" icon={CalendarClock} emptyText="Aucun départ prévu.">
              {todayPickups.length === 0 ? (
                null
              ) : (
                <div className="space-y-3">
                  {todayPickups.slice(0, 1).map((reservation) => {
                    const contractExists = contracts.some(
                      (contract) =>
                        contract.clientId === reservation.clientId &&
                        contract.vehicleId === reservation.vehicleId &&
                        contract.pickupDate === reservation.pickupDate &&
                        contract.returnDate === reservation.returnDate,
                    );
                    const phone = getClientPhoneByReservation(reservation.id, reservation.client);
                    const whatsappUrl = buildWhatsAppReminderUrl({
                      kind: 'pickup',
                      phone,
                      clientName: reservation.client,
                      vehicle: reservation.vehicle,
                      date: reservation.pickupDate,
                    });
                    return (
                      <div key={`pickup-${reservation.id}`} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                        <p className="text-sm font-semibold text-[var(--app-text)]">{reservation.client} · {reservation.vehicle}</p>
                        <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                          {reservation.pickupLocation || 'Lieu à confirmer'} · {reservation.pickupDate}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link to="/reservations" className={secondaryPriorityActionClass}>
                            Voir réservation
                          </Link>
                          {!contractExists ? (
                            <Link to="/contracts" className={primaryPriorityActionClass}>
                              Générer contrat
                            </Link>
                          ) : null}
                          {!notificationPreferences.reservationConfirmation ? (
                            <button type="button" disabled className={disabledPriorityActionClass}>
                              WhatsApp désactivé
                            </button>
                          ) : whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className={secondaryPriorityActionClass}>
                              <MessageCircle className="h-3.5 w-3.5" /> Envoyer WhatsApp
                            </a>
                          ) : (
                            <button type="button" disabled className={disabledPriorityActionClass}>
                              Téléphone manquant
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {todayPickups.length > 1 ? (
                    <p className="text-xs font-medium text-[var(--app-text-muted)]">+ {todayPickups.length - 1} autre(s) départ(s) aujourd’hui</p>
                  ) : null}
                </div>
              )}
            </PriorityCard>

            <PriorityCard title="Retours aujourd’hui" priority="today" icon={ArrowRight} emptyText="Aucun retour prévu.">
              {todayReturns.length === 0 ? (
                null
              ) : (
                <div className="space-y-3">
                  {todayReturns.slice(0, 1).map((reservation) => {
                    const phone = getClientPhoneByReservation(reservation.id, reservation.client);
                    const whatsappUrl = buildWhatsAppReminderUrl({
                      kind: 'return',
                      phone,
                      clientName: reservation.client,
                      vehicle: reservation.vehicle,
                      date: reservation.returnDate,
                    });
                    return (
                      <div key={`return-${reservation.id}`} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                        <p className="text-sm font-semibold text-[var(--app-text)]">{reservation.client} · {reservation.vehicle}</p>
                        <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                          {reservation.returnLocation || 'Lieu à confirmer'} · {reservation.returnDate}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void markReservationCompleted(reservation.id)}
                            className={primaryPriorityActionClass}
                          >
                            Marquer terminée
                          </button>
                          <Link to="/reservations" className={secondaryPriorityActionClass}>
                            Voir détails
                          </Link>
                          {!notificationPreferences.returnReminder ? (
                            <button type="button" disabled className={disabledPriorityActionClass}>
                              WhatsApp désactivé
                            </button>
                          ) : whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className={secondaryPriorityActionClass}>
                              <MessageCircle className="h-3.5 w-3.5" /> Envoyer WhatsApp
                            </a>
                          ) : (
                            <button type="button" disabled className={disabledPriorityActionClass}>
                              Téléphone manquant
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {todayReturns.length > 1 ? (
                    <p className="text-xs font-medium text-[var(--app-text-muted)]">+ {todayReturns.length - 1} autre(s) retour(s) aujourd’hui</p>
                  ) : null}
                </div>
              )}
            </PriorityCard>

            <PriorityCard title="Retards" priority="urgent" icon={AlertTriangle} emptyText="Aucun retour en retard.">
              {overdueReservations.length === 0 ? (
                null
              ) : (
                <div className="space-y-3">
                  {overdueReservations.slice(0, 1).map((reservation) => (
                    <div key={`overdue-${reservation.id}`} className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3">
                      <p className="text-sm font-semibold text-[var(--app-text)]">{reservation.client} · {reservation.vehicle}</p>
                      <p className="mt-1 text-sm font-medium text-rose-700 dark:text-rose-200">Retour en retard depuis le {reservation.returnDate}</p>
                      <div className="mt-3">
                        <Link to="/reservations" className="inline-flex min-h-9 items-center justify-center gap-1 rounded-xl border border-rose-400/35 bg-rose-500/5 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-500/10 dark:text-rose-200">
                          <AlertTriangle className="h-3.5 w-3.5" /> Voir réservation
                        </Link>
                      </div>
                    </div>
                  ))}
                  {overdueReservations.length > 1 ? (
                    <p className="text-xs font-medium text-[var(--app-text-muted)]">+ {overdueReservations.length - 1} autre(s) retard(s)</p>
                  ) : null}
                </div>
              )}
            </PriorityCard>

            <PriorityCard title="Paiements à suivre" priority="missing" icon={WalletCards} emptyText="Aucun paiement en attente.">
              {paymentAlerts.length === 0 ? (
                null
              ) : (
                <div className="space-y-3">
                  {paymentAlerts.slice(0, 1).map((item) => {
                    const phone = getClientPhoneByReservation(item.reservation.id, item.reservation.client);
                    const whatsappUrl = buildWhatsAppReminderUrl({
                      kind: 'payment',
                      phone,
                      clientName: item.reservation.client,
                      amount: item.remaining,
                    });
                    return (
                      <div key={`pay-${item.reservation.id}`} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                        <p className="text-sm font-semibold text-[var(--app-text)]">{item.reservation.client} · {item.reservation.id}</p>
                        <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                          Reste à payer: {formatMAD(item.remaining)} {item.cautionMissing ? '· Caution manquante' : ''}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link to="/payments" className={secondaryPriorityActionClass}>
                            Ajouter paiement
                          </Link>
                          {!notificationPreferences.paymentReminder ? (
                            <button type="button" disabled className={disabledPriorityActionClass}>
                              WhatsApp désactivé
                            </button>
                          ) : whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className={secondaryPriorityActionClass}>
                              <MessageCircle className="h-3.5 w-3.5" /> Envoyer WhatsApp
                            </a>
                          ) : (
                            <button type="button" disabled className={disabledPriorityActionClass}>
                              Téléphone manquant
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {paymentAlerts.length > 1 ? (
                    <p className="text-xs font-medium text-[var(--app-text-muted)]">+ {paymentAlerts.length - 1} paiement(s) à suivre</p>
                  ) : null}
                </div>
              )}
            </PriorityCard>
          </div>
        )}
      </div>
      <QuickActionsCard />
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Véhicules disponibles" value={String(availableVehicles)} helper="Prêts pour de nouvelles réservations" icon={Car} tone="green" />
        <KpiCard label="Réservations actives" value={String(activeReservations)} helper="Locations en cours" icon={CalendarClock} tone="blue" />
        <KpiCard label="Revenus du mois" value={formatMAD(monthlyRevenue)} helper="Paiements encaissés et partiels" icon={WalletCards} tone="gold" />
        <KpiCard label="Paiements en attente" value={String(pendingPayments)} helper="Factures en attente ou en retard" icon={Banknote} tone="violet" />
      </section>

      <section>
        <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3.5 sm:rounded-3xl sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-gold-300/25 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]">
                <UsersRound className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Pilotage flotte</p>
                <h2 className="mt-1 text-lg font-black text-[var(--app-text)]">Responsables de flotte</h2>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">Suivi du mois par responsable et véhicules non assignés.</p>
              </div>
            </div>
            {canOpenFleetResponsibles ? (
              <Link to="/responsables" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gold-300/30 bg-[var(--app-gold-soft)] px-3 text-sm font-bold text-[var(--app-gold-text)] transition hover:bg-gold-400/20">
                Voir responsables <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--app-text-muted)]">Top responsable</p>
              <p className="mt-1 truncate text-base font-black text-[var(--app-text)]">{topFleetResponsible?.responsible?.fullName || '—'}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--app-gold-text)]">{topFleetResponsible ? `${formatMAD(topFleetResponsible.revenue)} ce mois` : 'Aucune donnée ce mois'}</p>
            </div>
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--app-text-muted)]">Véhicules non assignés</p>
              <p className="mt-1 text-2xl font-black text-[var(--app-text)]">{unassignedFleetVehicles}</p>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">À attribuer à un responsable</p>
            </div>
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--app-text-muted)]">Reste à encaisser</p>
              <p className="mt-1 truncate text-2xl font-black text-[var(--app-gold-text)]">{formatMAD(fleetRemainingBalance)}</p>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">Réservations du mois</p>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3.5 sm:rounded-3xl sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[var(--app-text)] sm:text-xl sm:font-semibold">Activité du jour</h2>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Actions opérationnelles à suivre aujourd’hui.</p>
            </div>
            <span className="text-sm font-medium text-[var(--app-text-muted)]">
              {new Date().toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ActivityRow label="Départs aujourd’hui" value={String(pickupsToday)} icon={CalendarClock} />
            <ActivityRow label="Retours aujourd’hui" value={String(returnsToday)} icon={ArrowRight} />
            <ActivityRow label="Paiements en retard" value={String(latePayments)} icon={Banknote} tone="warning" />
            <ActivityRow label="Alertes entretien" value={String(urgentMaintenance)} icon={Wrench} tone="warning" />
          </div>
        </Card>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 sm:p-5">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">Départs à venir</h2>
          <div className="mt-5 grid gap-3">
            {upcomingPickups.length === 0 ? (
              <MobileEmptyBlock icon={CalendarClock} title="Aucun départ prévu" message="Les prochains départs apparaîtront ici." />
            ) : upcomingPickups.map((reservation) => (
              <div key={reservation.id} className="premium-surface rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--app-text)]">{reservation.client}</p>
                  <Badge>{reservation.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">{reservation.vehicle}</p>
                <p className="mt-3 text-sm font-semibold text-[var(--app-gold-text)]">{reservation.pickupDate} · {reservation.city}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 sm:p-5">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">Retours à venir</h2>
          <div className="mt-5 grid gap-3">
            {upcomingReturns.length === 0 ? (
              <MobileEmptyBlock icon={ArrowRight} title="Aucun retour prévu" message="Les retours planifiés seront visibles ici." />
            ) : upcomingReturns.map((reservation) => (
              <div key={reservation.id} className="premium-surface rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--app-text)]">{reservation.vehicle}</p>
                  <span className="text-sm font-semibold text-[var(--app-text-muted)]">{reservation.returnDate}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">{reservation.client}</p>
                <p className="mt-3 text-sm text-[var(--app-text-muted)]">{reservation.notes}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 sm:p-5">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">Paiements à relancer</h2>
          <div className="mt-5 grid gap-3">
            {latePaymentItems.length === 0 ? (
              <MobileEmptyBlock icon={Banknote} title="Aucun retard" message="Les paiements en attente ou en retard seront listés ici." />
            ) : latePaymentItems.map((payment) => (
              <div key={payment.id} className="premium-surface rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--app-text)]">{payment.client}</p>
                  <Badge>{payment.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">{payment.invoice} · due {payment.dueDate}</p>
                <p className="mt-3 font-semibold text-[var(--app-text)]">{formatMAD(payment.amount)}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="min-w-0 overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)]">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] p-4 sm:p-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[var(--app-text)] sm:text-xl sm:font-semibold">Réservations récentes</h2>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Dernières réservations et mouvements de flotte.</p>
            </div>
            <Link
              to="/reservations"
              className="focus-ring hidden min-h-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:border-gold-300/25 hover:bg-[var(--app-gold-soft)] sm:inline-flex"
            >
              Voir tout
            </Link>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {reservations.slice(0, 5).length === 0 ? (
              <MobileEmptyBlock icon={CalendarClock} title="Aucune réservation" message="Créez une réservation pour voir l’activité récente." />
            ) : reservations.slice(0, 5).map((reservation) => (
              <div key={reservation.id} className="min-w-0 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-gold-text)]">{reservation.id}</p>
                    <p className="mt-1 truncate text-sm font-bold text-[var(--app-text)]">{reservation.client}</p>
                  </div>
                  <Badge>{reservation.status}</Badge>
                </div>
                <p className="mt-2 truncate text-sm font-medium text-[var(--app-text-soft)]">{reservation.vehicle}</p>
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">{reservation.pickupDate} → {reservation.returnDate}</p>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
                <tr>
                  <th className="px-5 py-3 sm:px-6">Réservation</th>
                  <th className="px-5 py-3 sm:px-6">Client</th>
                  <th className="px-5 py-3 sm:px-6">Véhicule</th>
                  <th className="px-5 py-3 sm:px-6">Dates</th>
                  <th className="px-5 py-3 sm:px-6">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {reservations.slice(0, 5).map((reservation) => (
                  <tr key={reservation.id} className="transition hover:bg-[var(--app-surface-soft)]">
                    <td className="px-5 py-4 font-semibold text-[var(--app-text)] sm:px-6">{reservation.id}</td>
                    <td className="px-5 py-4 text-[var(--app-text-soft)] sm:px-6">{reservation.client}</td>
                    <td className="px-5 py-4 text-[var(--app-text-soft)] sm:px-6">{reservation.vehicle}</td>
                    <td className="px-5 py-4 text-[var(--app-text-muted)] sm:px-6">{reservation.pickupDate} - {reservation.returnDate}</td>
                    <td className="px-5 py-4 sm:px-6"><Badge>{reservation.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">État de la flotte</h2>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Disponibilité par statut opérationnel.</p>
            </div>
            <Car className="h-5 w-5 text-[var(--app-text-muted)]" />
          </div>
          <div className="grid gap-4">
            {['Available', 'Rented', 'Maintenance', 'Unavailable'].map((status) => {
              const count = vehicles.filter((vehicle) => vehicle.status === status).length;
              const percent = vehicles.length ? Math.round((count / vehicles.length) * 100) : 0;
              return (
                <div key={status}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-[var(--app-text-soft)]">{status}</span>
                    <span className="font-semibold text-[var(--app-text)]">{count} véhicule(s)</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--app-surface-soft)]">
                    <div
                      className={`h-2 rounded-full ${status === 'Available' ? 'bg-gold-400' : 'bg-[color-mix(in_srgb,var(--app-text)_30%,transparent)]'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section>
        <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Wrench className="h-5 w-5 text-[var(--app-gold-text)]" />
            <h2 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">Alertes entretien</h2>
          </div>
          <div className="grid gap-3">
            {vehicleAlerts.length > 0 ? (
              vehicleAlerts.slice(0, 5).map((item) => (
                <div key={`veh-alert-${item.source}-${item.vehicle.id}-${item.date}`} className="premium-surface flex items-center justify-between gap-4 rounded-2xl p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--app-text)]">
                      {item.vehicle.brand} {item.vehicle.model} · <PlateNumber value={item.vehicle.plate} />
                    </p>
                    <p className="mt-1 text-sm text-[var(--app-text-muted)]">{item.label} · {item.date || 'Date non renseignée'}</p>
                  </div>
                  <PriorityBadge priority={item.priority} />
                </div>
              ))
            ) : maintenanceItems.length === 0 ? (
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-[var(--app-text-muted)]">Aucune alerte entretien pour le moment.</div>
            ) : maintenanceItems.slice(0, 5).map((item) => (
              <div key={item.id} className="premium-surface flex items-center justify-between gap-4 rounded-2xl p-4">
                <div>
                  <p className="font-semibold text-[var(--app-text)]">{item.vehicle}</p>
                  <p className="mt-1 text-sm text-[var(--app-text-muted)]">{item.type} · {item.date}</p>
                </div>
                <Badge>{item.priority}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
