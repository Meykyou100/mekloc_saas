import { Download, FileSpreadsheet, Gauge, TrendingUp, WalletCards } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { formatMAD, revenueByMonth } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-carbon-400 light:text-carbon-600">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white light:text-carbon-950">{value}</p>
      <p className="mt-3 text-sm text-carbon-500 light:text-carbon-600">{note}</p>
    </Card>
  );
}

export default function ReportsPage() {
  const { notify } = useApp();
  const { vehicles, payments, reservations } = useData();
  const topVehicles = [...vehicles].sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  const monthlyRevenue = revenueByMonth[4]?.value || payments.reduce((sum, payment) => sum + payment.amount, 0);
  const activeReservations = reservations.filter((reservation) => reservation.status === 'Active').length;
  const occupancyRate = vehicles.length ? Math.round((activeReservations / vehicles.length) * 100) : 0;
  const overduePayments = payments.filter((payment) => payment.status === 'Late').reduce((sum, payment) => sum + payment.amount, 0);
  const reservationGrowth = '+12%';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business reports"
        title="Reports"
        description="Useful agency metrics without noise: revenue, occupancy, overdue payments, and top-performing vehicles."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => notify({ title: 'CSV export ready', type: 'success' })}>CSV</Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={() => notify({ title: 'PDF report generated', message: 'Demo export action completed.', type: 'success' })}>PDF</Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Monthly revenue" value={formatMAD(monthlyRevenue)} note="Current month bookings" />
        <MetricCard label="Occupancy rate" value={`${occupancyRate}%`} note="Active rentals vs fleet" />
        <MetricCard label="Overdue payments" value={formatMAD(overduePayments)} note="Needs follow-up" />
        <MetricCard label="Reservation growth" value={reservationGrowth} note="Compared with last month" />
        <MetricCard label="Fleet size" value={String(vehicles.length)} note="Vehicles under management" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-gold-200" />
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Monthly revenue</h2>
          </div>
          <div className="grid gap-3">
            {revenueByMonth.slice(-6).map((item) => {
              const max = Math.max(...revenueByMonth.map((month) => month.value));
              return (
                <div key={item.label} className="grid grid-cols-[44px_1fr_96px] items-center gap-3 text-sm">
                  <span className="text-carbon-500">{item.label}</span>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gold-400" style={{ width: `${(item.value / max) * 100}%` }} />
                  </div>
                  <span className="text-right font-semibold text-white light:text-carbon-950">{formatMAD(item.value)}</span>
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
            {topVehicles.map((vehicle) => (
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
          {payments.filter((payment) => payment.status === 'Late' || payment.status === 'Pending').map((payment) => (
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
