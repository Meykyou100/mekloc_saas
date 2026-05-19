import { Download, FileSpreadsheet, Gauge, TrendingUp, WalletCards } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { formatMAD } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="flex min-h-[82px] flex-col justify-between p-3 sm:min-h-[118px] sm:p-5">
      <p className="truncate text-[11px] font-medium text-carbon-400 light:text-carbon-600 sm:text-sm">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tracking-tight text-white light:text-carbon-950 sm:mt-3 sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-[10px] text-carbon-500 light:text-carbon-600 sm:mt-3 sm:text-sm">{note}</p>
    </Card>
  );
}

export default function ReportsPage() {
  const { notify } = useApp();
  const { vehicles, payments, reservations } = useData();
  const topVehicles = [...vehicles].sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  const monthlyRevenue = payments.filter((p) => p.status === 'Paid' || p.status === 'Partial').reduce((sum, payment) => sum + payment.amount, 0);
  const activeReservations = reservations.filter((reservation) => reservation.status === 'Active').length;
  const occupancyRate = vehicles.length ? Math.round((activeReservations / vehicles.length) * 100) : 0;
  const overduePayments = payments.filter((payment) => payment.status === 'Late').reduce((sum, payment) => sum + payment.amount, 0);
  const fleetSize = vehicles.length;
  const hasReportData = payments.length > 0 || reservations.length > 0 || vehicles.length > 0;
  const monthlyRevenueSeries = Object.entries(
    payments.reduce<Record<string, number>>((acc, payment) => {
      const monthKey = payment.dueDate?.slice(0, 7) || '';
      if (!monthKey) return acc;
      acc[monthKey] = (acc[monthKey] || 0) + payment.amount;
      return acc;
    }, {}),
  ).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business reports"
        title="Reports"
        description="Indicateurs calculés depuis les données réelles de votre agence."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => notify({ title: 'Export CSV', message: 'Fonction disponible bientôt.', type: 'info' })}>CSV</Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={() => notify({ title: 'Export PDF', message: 'Fonction disponible bientôt.', type: 'info' })}>PDF</Button>
          </div>
        }
      />

      {!hasReportData ? (
        <Card className="p-6 text-sm text-carbon-400">Aucune donnée pour le moment.</Card>
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Monthly revenue" value={formatMAD(monthlyRevenue)} note="Current month bookings" />
        <MetricCard label="Occupancy rate" value={`${occupancyRate}%`} note="Active rentals vs fleet" />
        <MetricCard label="Overdue payments" value={formatMAD(overduePayments)} note="Needs follow-up" />
        <MetricCard label="Réservations actives" value={String(activeReservations)} note="En cours actuellement" />
        <MetricCard label="Fleet size" value={String(fleetSize)} note="Vehicles under management" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-gold-200" />
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Monthly revenue</h2>
          </div>
          <div className="grid gap-3">
            {monthlyRevenueSeries.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400">Aucune donnée pour le moment.</div>
            ) : monthlyRevenueSeries.map(([label, value]) => {
              const max = Math.max(...monthlyRevenueSeries.map(([, amount]) => amount), 1);
              return (
                <div key={label} className="grid grid-cols-[72px_1fr_96px] items-center gap-3 text-sm">
                  <span className="text-carbon-500">{label}</span>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gold-400" style={{ width: `${(value / max) * 100}%` }} />
                  </div>
                  <span className="text-right font-semibold text-white light:text-carbon-950">{formatMAD(value)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Gauge className="h-5 w-5 text-carbon-300" />
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Most rented vehicles</h2>
          </div>
          <div className="grid gap-3">
            {topVehicles.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400">Aucune donnée pour le moment.</div>
            ) : topVehicles.map((vehicle) => (
              <div key={vehicle.id} className="premium-surface flex items-center justify-between rounded-2xl p-4">
                <div>
                  <p className="font-semibold text-white light:text-carbon-950">{vehicle.brand} {vehicle.model}</p>
                  <p className="mt-1 text-sm text-carbon-400">{vehicle.plate} · {vehicle.city}</p>
                </div>
                <p className="font-semibold text-white light:text-carbon-950">{formatMAD(vehicle.revenue)}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <WalletCards className="h-5 w-5 text-carbon-300" />
          <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Overdue payment watchlist</h2>
        </div>
        <div className="grid gap-3">
          {payments.filter((payment) => payment.status === 'Late' || payment.status === 'Pending').length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400">Aucune donnée pour le moment.</div>
          ) : payments.filter((payment) => payment.status === 'Late' || payment.status === 'Pending').map((payment) => (
            <div key={payment.id} className="premium-surface grid gap-3 rounded-2xl p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <p className="font-semibold text-white light:text-carbon-950">{payment.client}</p>
                <p className="mt-1 text-sm text-carbon-400">{payment.invoice} · due {payment.dueDate}</p>
              </div>
              <p className="font-semibold text-white light:text-carbon-950">{formatMAD(payment.amount)}</p>
              <span className="rounded-full border border-white/10 px-3 py-1 text-center text-xs font-semibold text-carbon-300">{payment.status}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
