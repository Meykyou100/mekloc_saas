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
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import {
  formatMAD,
} from '../data/mockData';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  buildWhatsAppReminderUrl,
  getMissingDocumentClients,
  getOverdueReservations,
  getPaymentAlerts,
  getTodayReservations,
  getVehicleExpiryAlerts,
  type AssistantPriority,
} from '../lib/assistantDuJour';
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
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Car;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-carbon-400 light:text-carbon-600">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white light:text-carbon-950">{value}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-carbon-200 light:bg-carbon-950/[0.04] light:text-carbon-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-5 text-sm text-carbon-500 light:text-carbon-600">{helper}</p>
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
    <div className="premium-surface flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-2 ${tone === 'warning' ? 'bg-white/[0.04] text-gold-200' : 'bg-white/[0.04] text-carbon-200 light:text-carbon-700'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-carbon-300 light:text-carbon-700">{label}</span>
      </div>
      <strong className="text-lg font-semibold text-white light:text-carbon-950">{value}</strong>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: AssistantPriority }) {
  if (priority === 'urgent') return <Badge>Urgent</Badge>;
  if (priority === 'today') return <Badge>Aujourd’hui</Badge>;
  if (priority === 'missing') return <Badge>Manquant</Badge>;
  return <Badge>À surveiller</Badge>;
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
  const missingDocuments = useMemo(() => getMissingDocumentClients(clients), [clients]);
  const vehicleAlerts = useMemo(
    () => getVehicleExpiryAlerts(vehicles, maintenanceItems),
    [vehicles, maintenanceItems],
  );
  const isAllGood =
    todayPickups.length === 0 &&
    todayReturns.length === 0 &&
    overdueReservations.length === 0 &&
    paymentAlerts.length === 0 &&
    missingDocuments.length === 0 &&
    vehicleAlerts.length === 0;

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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Espace agence"
        title="Tableau de bord"
        description="Vue claire des locations du jour, du parc disponible, des paiements et des actions prioritaires."
      />

      {isSubscriptionExpiringSoon(profile?.agency) ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-sm font-semibold text-gold-100 light:text-gold-800">
          L’abonnement expire dans {daysUntil(profile?.agency?.subscriptionEndDate)} jour(s). Renouvelez pour éviter une interruption.
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold-200">Assistant du jour</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Actions prioritaires de la journée</h2>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-carbon-300">
            {new Date().toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        ) : isAllGood ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-100">
            Tout est à jour aujourd’hui.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Départs aujourd’hui</h3>
                <PriorityBadge priority="today" />
              </div>
              {todayPickups.length === 0 ? (
                <p className="text-sm text-carbon-400">Aucun départ prévu.</p>
              ) : (
                <div className="space-y-3">
                  {todayPickups.slice(0, 4).map((reservation) => {
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
                      <div key={`pickup-${reservation.id}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-sm font-semibold text-white">{reservation.client} · {reservation.vehicle}</p>
                        <p className="mt-1 text-xs text-carbon-400">
                          {reservation.pickupLocation || 'Lieu à confirmer'} · {reservation.pickupDate}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link to="/reservations" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-200 hover:bg-white/[0.07]">
                            Voir réservation
                          </Link>
                          {!contractExists ? (
                            <Link to="/contracts" className="rounded-lg border border-gold-300/40 bg-gold-500/20 px-3 py-1.5 text-xs font-semibold text-gold-100 hover:bg-gold-500/30">
                              Générer contrat
                            </Link>
                          ) : null}
                          {whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-200 hover:bg-white/[0.07]">
                              <MessageCircle className="h-3.5 w-3.5" /> Envoyer WhatsApp
                            </a>
                          ) : (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-500">
                              Téléphone manquant
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Retours aujourd’hui</h3>
                <PriorityBadge priority="today" />
              </div>
              {todayReturns.length === 0 ? (
                <p className="text-sm text-carbon-400">Aucun retour prévu.</p>
              ) : (
                <div className="space-y-3">
                  {todayReturns.slice(0, 4).map((reservation) => {
                    const phone = getClientPhoneByReservation(reservation.id, reservation.client);
                    const whatsappUrl = buildWhatsAppReminderUrl({
                      kind: 'return',
                      phone,
                      clientName: reservation.client,
                      vehicle: reservation.vehicle,
                      date: reservation.returnDate,
                    });
                    return (
                      <div key={`return-${reservation.id}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-sm font-semibold text-white">{reservation.client} · {reservation.vehicle}</p>
                        <p className="mt-1 text-xs text-carbon-400">
                          {reservation.returnLocation || 'Lieu à confirmer'} · {reservation.returnDate}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void markReservationCompleted(reservation.id)}
                            className="rounded-lg border border-gold-300/40 bg-gold-500/20 px-3 py-1.5 text-xs font-semibold text-gold-100 hover:bg-gold-500/30"
                          >
                            Marquer terminée
                          </button>
                          <Link to="/reservations" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-200 hover:bg-white/[0.07]">
                            Voir détails
                          </Link>
                          {whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-200 hover:bg-white/[0.07]">
                              <MessageCircle className="h-3.5 w-3.5" /> Envoyer WhatsApp
                            </a>
                          ) : (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-500">
                              Téléphone manquant
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Retards</h3>
                <PriorityBadge priority="urgent" />
              </div>
              {overdueReservations.length === 0 ? (
                <p className="text-sm text-carbon-400">Aucun retour en retard.</p>
              ) : (
                <div className="space-y-3">
                  {overdueReservations.slice(0, 4).map((reservation) => (
                    <div key={`overdue-${reservation.id}`} className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-3">
                      <p className="text-sm font-semibold text-white">{reservation.client} · {reservation.vehicle}</p>
                      <p className="mt-1 text-xs text-rose-100">Retour en retard depuis le {reservation.returnDate}</p>
                      <div className="mt-3">
                        <Link to="/reservations" className="inline-flex items-center gap-1 rounded-lg border border-rose-200/30 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/10">
                          <AlertTriangle className="h-3.5 w-3.5" /> Voir réservation
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Paiements à suivre</h3>
                <PriorityBadge priority="missing" />
              </div>
              {paymentAlerts.length === 0 ? (
                <p className="text-sm text-carbon-400">Aucun paiement en attente.</p>
              ) : (
                <div className="space-y-3">
                  {paymentAlerts.slice(0, 4).map((item) => {
                    const phone = getClientPhoneByReservation(item.reservation.id, item.reservation.client);
                    const whatsappUrl = buildWhatsAppReminderUrl({
                      kind: 'payment',
                      phone,
                      clientName: item.reservation.client,
                      amount: item.remaining,
                    });
                    return (
                      <div key={`pay-${item.reservation.id}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-sm font-semibold text-white">{item.reservation.client} · {item.reservation.id}</p>
                        <p className="mt-1 text-xs text-carbon-400">
                          Reste à payer: {formatMAD(item.remaining)} {item.cautionMissing ? '· Caution manquante' : ''}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link to="/payments" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-200 hover:bg-white/[0.07]">
                            Ajouter paiement
                          </Link>
                          {whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-200 hover:bg-white/[0.07]">
                              <MessageCircle className="h-3.5 w-3.5" /> Envoyer WhatsApp
                            </a>
                          ) : (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-500">
                              Téléphone manquant
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Documents manquants</h3>
                <PriorityBadge priority="missing" />
              </div>
              {missingDocuments.length === 0 ? (
                <p className="text-sm text-carbon-400">Tous les dossiers clients sont complets.</p>
              ) : (
                <div className="space-y-3">
                  {missingDocuments.slice(0, 4).map((item) => {
                    const whatsappUrl = buildWhatsAppReminderUrl({
                      kind: 'documents',
                      phone: item.client.phone,
                      clientName: item.client.fullName,
                      missingDocs: item.missing,
                    });
                    return (
                      <div key={`doc-${item.client.id}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-sm font-semibold text-white">{item.client.fullName}</p>
                        <p className="mt-1 text-xs text-carbon-400">Documents manquants: {item.missing.join(' / ')}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link to="/clients" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-200 hover:bg-white/[0.07]">
                            Compléter client
                          </Link>
                          {whatsappUrl ? (
                            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-200 hover:bg-white/[0.07]">
                              <MessageCircle className="h-3.5 w-3.5" /> Envoyer WhatsApp
                            </a>
                          ) : (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-500">
                              Téléphone manquant
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Véhicules à surveiller</h3>
                <PriorityBadge priority="watch" />
              </div>
              {vehicleAlerts.length === 0 ? (
                <p className="text-sm text-carbon-400">Aucune alerte véhicule.</p>
              ) : (
                <div className="space-y-3">
                  {vehicleAlerts.slice(0, 5).map((item) => (
                    <div key={`veh-alert-${item.source}-${item.vehicle.id}-${item.date}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">
                          {item.vehicle.brand} {item.vehicle.model} · {item.vehicle.plate}
                        </p>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <p className="mt-1 text-xs text-carbon-400">{item.label} · {item.date || 'Date non renseignée'}</p>
                      <div className="mt-3">
                        <Link to="/vehicles" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-carbon-200 hover:bg-white/[0.07]">
                          Voir véhicule
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Véhicules disponibles" value={String(availableVehicles)} helper="Prêts pour de nouvelles réservations" icon={Car} />
        <KpiCard label="Réservations actives" value={String(activeReservations)} helper="Locations en cours" icon={CalendarClock} />
        <KpiCard label="Revenus du mois" value={formatMAD(monthlyRevenue)} helper="Paiements encaissés et partiels" icon={WalletCards} />
        <KpiCard label="Paiements en attente" value={String(pendingPayments)} helper="Factures en attente ou en retard" icon={Banknote} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Activité du jour</h2>
              <p className="mt-1 text-sm text-carbon-400 light:text-carbon-600">Actions opérationnelles à suivre aujourd’hui.</p>
            </div>
            <span className="text-sm font-medium text-carbon-500 light:text-carbon-600">
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

        <Card className="p-5 sm:p-6">
          <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Actions rapides</h2>
              <p className="mt-1 text-sm text-carbon-400 light:text-carbon-600">Lancez les actions les plus fréquentes.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {actionItems.map(({ label, to, icon: Icon }, index) => (
              <Link
                key={label}
                to={to}
                className={`focus-ring flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  index === 0
                    ? 'border-[#E8B923]/70 bg-[#D4A017] text-carbon-950 hover:bg-[#E8B923]'
                    : 'border-white/10 bg-white/[0.035] text-carbon-200 hover:border-white/20 hover:bg-white/[0.06] light:text-carbon-800'
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

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Upcoming Pickups</h2>
          <div className="mt-5 grid gap-3">
            {upcomingPickups.map((reservation) => (
              <div key={reservation.id} className="premium-surface rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white light:text-carbon-950">{reservation.client}</p>
                  <Badge>{reservation.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-carbon-400">{reservation.vehicle}</p>
                <p className="mt-3 text-sm font-semibold text-gold-100 light:text-gold-800">{reservation.pickupDate} · {reservation.city}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Upcoming Returns</h2>
          <div className="mt-5 grid gap-3">
            {upcomingReturns.map((reservation) => (
              <div key={reservation.id} className="premium-surface rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white light:text-carbon-950">{reservation.vehicle}</p>
                  <span className="text-sm font-semibold text-carbon-400">{reservation.returnDate}</span>
                </div>
                <p className="mt-2 text-sm text-carbon-400">{reservation.client}</p>
                <p className="mt-3 text-sm text-carbon-500">{reservation.notes}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Late Payments</h2>
          <div className="mt-5 grid gap-3">
            {latePaymentItems.map((payment) => (
              <div key={payment.id} className="premium-surface rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white light:text-carbon-950">{payment.client}</p>
                  <Badge>{payment.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-carbon-400">{payment.invoice} · due {payment.dueDate}</p>
                <p className="mt-3 font-semibold text-white light:text-carbon-950">{formatMAD(payment.amount)}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Recent Reservations</h2>
              <p className="mt-1 text-sm text-carbon-400 light:text-carbon-600">Latest bookings and handoffs.</p>
            </div>
            <Link
              to="/reservations"
              className="focus-ring hidden min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 light:border-carbon-950/10 light:bg-carbon-950/5 light:text-carbon-950 sm:inline-flex"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-carbon-500">
                <tr>
                  <th className="px-5 py-3 sm:px-6">Reservation</th>
                  <th className="px-5 py-3 sm:px-6">Client</th>
                  <th className="px-5 py-3 sm:px-6">Vehicle</th>
                  <th className="px-5 py-3 sm:px-6">Dates</th>
                  <th className="px-5 py-3 sm:px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {reservations.slice(0, 5).map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-white/[0.025]">
                    <td className="px-5 py-4 font-semibold text-white light:text-carbon-950 sm:px-6">{reservation.id}</td>
                    <td className="px-5 py-4 text-carbon-300 light:text-carbon-700 sm:px-6">{reservation.client}</td>
                    <td className="px-5 py-4 text-carbon-300 light:text-carbon-700 sm:px-6">{reservation.vehicle}</td>
                    <td className="px-5 py-4 text-carbon-500 light:text-carbon-600 sm:px-6">{reservation.pickupDate} - {reservation.returnDate}</td>
                    <td className="px-5 py-4 sm:px-6"><Badge>{reservation.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Fleet Status</h2>
              <p className="mt-1 text-sm text-carbon-400 light:text-carbon-600">Availability by operational state.</p>
            </div>
            <Car className="h-5 w-5 text-carbon-400" />
          </div>
          <div className="grid gap-4">
            {['Available', 'Rented', 'Maintenance', 'Unavailable'].map((status) => {
              const count = vehicles.filter((vehicle) => vehicle.status === status).length;
              const percent = vehicles.length ? Math.round((count / vehicles.length) * 100) : 0;
              return (
                <div key={status}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-carbon-300 light:text-carbon-700">{status}</span>
                    <span className="font-semibold text-white light:text-carbon-950">{count} vehicles</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 light:bg-carbon-950/10">
                    <div
                      className={`h-2 rounded-full ${status === 'Available' ? 'bg-gold-400' : 'bg-white/35 light:bg-carbon-950/30'}`}
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
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Wrench className="h-5 w-5 text-gold-200" />
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Maintenance Alerts</h2>
          </div>
          <div className="grid gap-3">
            {maintenanceItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400">Aucune donnée pour le moment.</div>
            ) : maintenanceItems.map((item) => (
              <div key={item.id} className="premium-surface flex items-center justify-between gap-4 rounded-2xl p-4">
                <div>
                  <p className="font-semibold text-white light:text-carbon-950">{item.vehicle}</p>
                  <p className="mt-1 text-sm text-carbon-400">{item.type} · {item.date}</p>
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
