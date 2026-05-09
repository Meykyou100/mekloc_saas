import {
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
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import {
  formatMAD,
  revenueByMonth,
  activityFeed,
} from '../data/mockData';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { daysUntil, isSubscriptionExpiringSoon } from '../lib/subscription';

const today = '2026-05-09';

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

export default function DashboardPage() {
  const { vehicles, reservations, maintenance: maintenanceItems, payments } = useData();
  const { profile } = useAuth();
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === 'Available').length;
  const activeReservations = reservations.filter((reservation) => reservation.status === 'Active').length;
  const monthlyRevenue = payments
    .filter((payment) => payment.status === 'Paid' || payment.status === 'Partial')
    .reduce((total, payment) => total + payment.amount, 0) || revenueByMonth[4].value;
  const pendingPayments = payments.filter((payment) => payment.status === 'Pending' || payment.status === 'Late').length;
  const pickupsToday = reservations.filter((reservation) => reservation.pickupDate === today).length;
  const returnsToday = reservations.filter((reservation) => reservation.returnDate === today).length;
  const latePayments = payments.filter((payment) => payment.status === 'Late').length;
  const urgentMaintenance = maintenanceItems.filter((item) => item.priority === 'High').length;
  const upcomingPickups = reservations.filter((reservation) => reservation.pickupDate >= today && reservation.status !== 'Cancelled').slice(0, 3);
  const upcomingReturns = reservations.filter((reservation) => reservation.returnDate >= today && reservation.status !== 'Cancelled').slice(0, 3);
  const latePaymentItems = payments.filter((payment) => payment.status === 'Late' || payment.status === 'Pending').slice(0, 3);

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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Available Vehicles" value={String(availableVehicles)} helper="Ready for new bookings" icon={Car} />
        <KpiCard label="Active Reservations" value={String(activeReservations)} helper="Currently on rent" icon={CalendarClock} />
        <KpiCard label="Monthly Revenue" value={formatMAD(monthlyRevenue)} helper="Collected and partial invoices" icon={WalletCards} />
        <KpiCard label="Pending Payments" value={String(pendingPayments)} helper="Pending or late invoices" icon={Banknote} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Today Activity</h2>
              <p className="mt-1 text-sm text-carbon-400 light:text-carbon-600">Daily operations that need the owner’s attention.</p>
            </div>
            <span className="text-sm font-medium text-carbon-500 light:text-carbon-600">09 May 2026</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ActivityRow label="Pickups today" value={String(pickupsToday)} icon={CalendarClock} />
            <ActivityRow label="Returns today" value={String(returnsToday)} icon={ArrowRight} />
            <ActivityRow label="Late payments" value={String(latePayments)} icon={Banknote} tone="warning" />
            <ActivityRow label="Maintenance alerts" value={String(urgentMaintenance)} icon={Wrench} tone="warning" />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Quick Actions</h2>
            <p className="mt-1 text-sm text-carbon-400 light:text-carbon-600">Start the common tasks from one place.</p>
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

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Wrench className="h-5 w-5 text-gold-200" />
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Maintenance Alerts</h2>
          </div>
          <div className="grid gap-3">
            {maintenanceItems.map((item) => (
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

        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-carbon-300" />
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Recent Activity Timeline</h2>
          </div>
          <div className="grid gap-4">
            {activityFeed.map(({ icon: Icon, text, time }) => (
              <div key={text} className="flex gap-3">
                <div className="mt-1 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-carbon-300">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-carbon-200 light:text-carbon-800">{text}</p>
                  <p className="mt-1 text-xs text-carbon-500">{time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
