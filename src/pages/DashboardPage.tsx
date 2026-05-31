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
  WalletCards,
  Wrench,
} from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
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

const actionItems = [
  { label: 'Ajouter réservation', to: '/reservations', icon: CalendarClock },
  { label: 'Ajouter véhicule', to: '/vehicles', icon: Car },
  { label: 'Ajouter client', to: '/clients', icon: UserPlus },
  { label: 'Créer contrat', to: '/contracts', icon: FileSignature },
];

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
    gold: 'border-gold-300/25 bg-gold-500/10 text-gold-100 shadow-[0_0_28px_rgba(227,177,23,0.08)]',
    blue: 'border-sky-300/20 bg-sky-500/10 text-sky-100',
    green: 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100',
    violet: 'border-violet-300/20 bg-violet-500/10 text-violet-100',
  };

  return (
    <Card className="group flex min-h-[108px] flex-col justify-between rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3 transition hover:border-gold-300/25 hover:shadow-[0_18px_50px_rgba(0,0,0,0.35)] sm:min-h-[148px] sm:rounded-3xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase leading-3 tracking-[0.12em] text-[var(--app-text-muted)] sm:text-[11px]">{label}</p>
          <p className="mt-2 truncate text-[1.35rem] font-black leading-none tracking-tight text-[var(--app-text)] sm:mt-3 sm:text-3xl">{value}</p>
        </div>
        <div className={`rounded-xl border p-2 sm:rounded-2xl sm:p-2.5 ${toneClasses[tone]}`}>
          <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
        </div>
      </div>
      <p className="mt-2 line-clamp-1 text-[11px] text-[var(--app-text-muted)] sm:mt-4 sm:text-sm">{helper}</p>
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
    <div className="premium-surface flex items-center justify-between gap-4 rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-2 ${tone === 'warning' ? 'bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]' : 'bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-[var(--app-text-soft)]">{label}</span>
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
    <Card className="min-h-[136px] rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3 transition hover:border-gold-300/20 sm:min-h-[168px] sm:rounded-3xl sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-gold-300/20 bg-[var(--app-gold-soft)] p-2.5 text-[var(--app-gold-text)]">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold text-[var(--app-text)] sm:text-lg">{title}</h3>
        </div>
        <PriorityBadge priority={priority} />
      </div>
      {children || <p className="text-sm text-[var(--app-text-muted)]">{emptyText}</p>}
    </Card>
  );
}

function PriorityBadge({ priority }: { priority: AssistantPriority }) {
  if (priority === 'urgent') return <span className="rounded-full border border-rose-300/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 light:text-rose-700">Urgent</span>;
  if (priority === 'today') return <span className="rounded-full border border-gold-300/20 bg-[var(--app-gold-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--app-gold-text)]">Aujourd’hui</span>;
  if (priority === 'missing') return <span className="rounded-full border border-orange-300/25 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-300 light:text-orange-700">À suivre</span>;
  return <span className="rounded-full border border-[var(--app-border)] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-[var(--app-text-soft)]">À surveiller</span>;
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
  const { profile } = useAuth();
  const { notify } = useApp();
  const notificationPreferences = getNotificationPreferences(profile?.agency?.settings);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
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
    <div className="space-y-4 pb-[calc(108px+env(safe-area-inset-bottom))] md:space-y-6 md:pb-0">
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
        <div className="hidden w-fit rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--app-text-soft)] shadow-[0_14px_40px_rgba(0,0,0,0.22)] light:text-carbon-700 md:block">
          {new Date().toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </header>

      {isSubscriptionExpiringSoon(profile?.agency) ? (
        <div className="rounded-2xl border border-white/[0.07] bg-[var(--app-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--app-gold-text)]">
          L’abonnement expire dans {daysUntil(profile?.agency?.subscriptionEndDate)} jour(s). Renouvelez pour éviter une interruption.
        </div>
      ) : null}

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[var(--app-shadow)] sm:rounded-[28px] sm:p-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-gold-text)]">Assistant du jour</p>
            <h2 className="mt-1 text-lg font-black text-[var(--app-text)] sm:mt-2 sm:text-2xl">Actions prioritaires de la journée</h2>
            <p className="mt-1 text-xs text-[var(--app-text-muted)] sm:text-sm">Les urgences opérationnelles à traiter en premier.</p>
          </div>
          {prioritiesAreClear ? (
            <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 light:text-emerald-700">
              Tout est à jour
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
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
                          <Link to="/reservations" className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-white/[0.07]">
                            Voir réservation
                          </Link>
                          {!contractExists ? (
                            <Link to="/contracts" className="rounded-lg border border-gold-300/40 bg-[var(--app-gold-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--app-gold-text)] hover:bg-gold-500/20">
                              Générer contrat
                            </Link>
                          ) : null}
                          {!notificationPreferences.reservationConfirmation ? (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)]">
                              WhatsApp désactivé
                            </button>
                          ) : whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-white/[0.07]">
                              <MessageCircle className="h-3.5 w-3.5" /> Envoyer WhatsApp
                            </a>
                          ) : (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)]">
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
                            className="rounded-lg border border-gold-300/40 bg-[var(--app-gold-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--app-gold-text)] hover:bg-gold-500/20"
                          >
                            Marquer terminée
                          </button>
                          <Link to="/reservations" className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-white/[0.07]">
                            Voir détails
                          </Link>
                          {!notificationPreferences.returnReminder ? (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)]">
                              WhatsApp désactivé
                            </button>
                          ) : whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-white/[0.07]">
                              <MessageCircle className="h-3.5 w-3.5" /> Envoyer WhatsApp
                            </a>
                          ) : (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)]">
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
                      <p className="mt-1 text-xs text-rose-200 light:text-rose-700">Retour en retard depuis le {reservation.returnDate}</p>
                      <div className="mt-3">
                        <Link to="/reservations" className="inline-flex items-center gap-1 rounded-lg border border-rose-200/30 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 light:text-rose-700">
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
                          <Link to="/payments" className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-white/[0.07]">
                            Ajouter paiement
                          </Link>
                          {!notificationPreferences.paymentReminder ? (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)]">
                              WhatsApp désactivé
                            </button>
                          ) : whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-white/[0.07]">
                              <MessageCircle className="h-3.5 w-3.5" /> Envoyer WhatsApp
                            </a>
                          ) : (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)]">
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
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Véhicules disponibles" value={String(availableVehicles)} helper="Prêts pour de nouvelles réservations" icon={Car} tone="green" />
        <KpiCard label="Réservations actives" value={String(activeReservations)} helper="Locations en cours" icon={CalendarClock} tone="blue" />
        <KpiCard label="Revenus du mois" value={formatMAD(monthlyRevenue)} helper="Paiements encaissés et partiels" icon={WalletCards} tone="gold" />
        <KpiCard label="Paiements en attente" value={String(pendingPayments)} helper="Factures en attente ou en retard" icon={Banknote} tone="violet" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 sm:rounded-3xl sm:p-6">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">Activité du jour</h2>
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

        <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 sm:rounded-3xl sm:p-6">
          <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">Actions rapides</h2>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Lancez les actions les plus fréquentes.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {actionItems.map(({ label, to, icon: Icon }, index) => (
              <Link
                key={label}
                to={to}
                className={`focus-ring flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  index === 0
                    ? 'border-[#E8B923]/70 bg-[#D4A017] text-carbon-950 hover:bg-[#E8B923]'
                    : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] hover:border-gold-300/25 hover:bg-[var(--app-gold-soft)]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <Plus className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-5 sm:p-6">
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

        <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-5 sm:p-6">
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

        <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-5 sm:p-6">
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

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)]">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">Réservations récentes</h2>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Dernières réservations et mouvements de flotte.</p>
            </div>
            <Link
              to="/reservations"
              className="focus-ring hidden min-h-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-white/10 px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-white/15 light:border-carbon-950/10 light:bg-carbon-950/5 light:text-carbon-950 sm:inline-flex"
            >
              Voir tout
            </Link>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {reservations.slice(0, 5).length === 0 ? (
              <MobileEmptyBlock icon={CalendarClock} title="Aucune réservation" message="Créez une réservation pour voir l’activité récente." />
            ) : reservations.slice(0, 5).map((reservation) => (
              <div key={reservation.id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-gold-text)]">{reservation.id}</p>
                    <p className="mt-1 font-semibold text-[var(--app-text)]">{reservation.client}</p>
                  </div>
                  <Badge>{reservation.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--app-text-soft)]">{reservation.vehicle}</p>
                <p className="mt-2 text-xs text-[var(--app-text-muted)]">{reservation.pickupDate} → {reservation.returnDate}</p>
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
              <tbody className="divide-y divide-white/10">
                {reservations.slice(0, 5).map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-white/[0.025]">
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
