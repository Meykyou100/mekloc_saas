import { Download, FileSpreadsheet, Gauge, TrendingUp, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import PlateNumber from '../components/ui/PlateNumber';
import { formatMAD } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

type PeriodKey = 'month' | 'quarter' | 'year' | 'custom';

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthKey(value: string) {
  return value?.slice(0, 7) || 'Sans date';
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getPeriodRange(period: PeriodKey, customStart: string, customEnd: string) {
  const now = new Date();
  const end = dateKey(now);
  if (period === 'custom') return { start: customStart, end: customEnd };
  if (period === 'year') return { start: `${now.getFullYear()}-01-01`, end };
  if (period === 'quarter') return { start: dateKey(addMonths(now, -3)), end };
  return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end };
}

function inRange(value: string | undefined, start: string, end: string) {
  if (!value) return false;
  return (!start || value >= start) && (!end || value <= end);
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapePdf(value: string) {
  return value.replace(/[()\\]/g, '');
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="flex min-h-[88px] flex-col justify-between p-3 sm:min-h-[122px] sm:p-5">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-carbon-400 light:text-carbon-600 sm:text-xs">{label}</p>
      <p className="mt-1 truncate text-lg font-black tracking-tight text-white light:text-carbon-950 sm:mt-3 sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-[10px] text-carbon-500 light:text-carbon-600 sm:mt-3 sm:text-sm">{note}</p>
    </Card>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[76px_1fr_92px] items-center gap-3 text-sm sm:grid-cols-[92px_1fr_120px]">
      <span className="truncate text-carbon-500">{label}</span>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-gold-400" style={{ width: `${width}%` }} />
      </div>
      <span className="truncate text-right font-semibold text-white light:text-carbon-950">{formatMAD(value)}</span>
    </div>
  );
}

export default function ReportsPage() {
  const { notify } = useApp();
  const { vehicles, clients, payments, reservations, maintenance } = useData();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const range = useMemo(() => getPeriodRange(period, customStart, customEnd), [customEnd, customStart, period]);

  const report = useMemo(() => {
    const filteredReservations = reservations.filter((item) => inRange(item.pickupDate, range.start, range.end));
    const filteredPayments = payments.filter((item) => inRange(item.dueDate, range.start, range.end));
    const filteredMaintenance = maintenance.filter((item) => inRange(item.lastServiceDate || item.date, range.start, range.end));

    const totalRevenue = filteredReservations
      .filter((item) => item.status !== 'Cancelled')
      .reduce((sum, item) => sum + Math.max(0, item.totalAmount || item.dailyPrice || 0), 0);
    const collectedRevenue = filteredPayments
      .filter((item) => item.status === 'Paid' || item.status === 'Partial')
      .reduce((sum, item) => sum + Math.max(0, item.amount), 0);
    const pendingPayments = filteredPayments
      .filter((item) => item.status === 'Pending' || item.status === 'Late')
      .reduce((sum, item) => sum + Math.max(0, item.amount), 0);
    const depositsReceived = filteredReservations
      .filter((item) => item.status !== 'Cancelled')
      .reduce((sum, item) => sum + Math.max(0, item.deposit || 0), 0);
    const depositsToRefund = filteredReservations
      .filter((item) => item.status === 'Active' || item.status === 'Completed')
      .reduce((sum, item) => sum + Math.max(0, item.deposit || 0), 0);
    const maintenanceExpenses = filteredMaintenance.reduce((sum, item) => sum + Math.max(0, item.cost || 0), 0);
    const estimatedProfit = collectedRevenue - maintenanceExpenses;

    const reservationsByMonth = Object.entries(
      filteredReservations.reduce<Record<string, number>>((acc, item) => {
        const key = monthKey(item.pickupDate);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => a[0].localeCompare(b[0]));

    const revenueByVehicle = vehicles.map((vehicle) => {
      const paid = filteredPayments
        .filter((payment) => payment.vehicleId === vehicle.id)
        .reduce((sum, payment) => sum + (payment.status === 'Paid' || payment.status === 'Partial' ? Math.max(0, payment.amount) : 0), 0);
      const booked = filteredReservations
        .filter((reservation) => reservation.vehicleId === vehicle.id && reservation.status !== 'Cancelled')
        .reduce((sum, reservation) => sum + Math.max(0, reservation.totalAmount || reservation.dailyPrice || 0), 0);
      return { id: vehicle.id, label: `${vehicle.brand} ${vehicle.model}`, plate: vehicle.plate, revenue: paid || booked };
    }).filter((item) => item.revenue > 0).sort((a, b) => b.revenue - a.revenue);

    const profitableClients = clients.map((client) => {
      const paid = filteredPayments
        .filter((payment) => payment.clientId === client.id || payment.client === client.fullName)
        .reduce((sum, payment) => sum + (payment.status === 'Paid' || payment.status === 'Partial' ? Math.max(0, payment.amount) : 0), 0);
      const booked = filteredReservations
        .filter((reservation) => reservation.clientId === client.id && reservation.status !== 'Cancelled')
        .reduce((sum, reservation) => sum + Math.max(0, reservation.totalAmount || reservation.dailyPrice || 0), 0);
      return { id: client.id, label: client.fullName, revenue: paid || booked, reservations: filteredReservations.filter((reservation) => reservation.clientId === client.id).length };
    }).filter((item) => item.revenue > 0).sort((a, b) => b.revenue - a.revenue);

    const overdue = filteredPayments.filter((item) => item.status === 'Late').sort((a, b) => b.amount - a.amount);

    return {
      filteredReservations,
      filteredPayments,
      filteredMaintenance,
      totalRevenue,
      collectedRevenue,
      pendingPayments,
      depositsReceived,
      depositsToRefund,
      maintenanceExpenses,
      estimatedProfit,
      reservationsByMonth,
      revenueByVehicle,
      profitableClients,
      overdue,
    };
  }, [clients, maintenance, payments, range.end, range.start, reservations, vehicles]);

  const hasReportData = report.filteredPayments.length > 0 || report.filteredReservations.length > 0 || report.filteredMaintenance.length > 0;
  const maxVehicleRevenue = Math.max(...report.revenueByVehicle.map((item) => item.revenue), 1);
  const maxMonthlyReservations = Math.max(...report.reservationsByMonth.map(([, count]) => count), 1);

  function exportCsv() {
    const rows = [
      ['Période', `${range.start || 'Début'} → ${range.end || 'Fin'}`],
      ['Chiffre d’affaires total', report.totalRevenue],
      ['Revenus encaissés', report.collectedRevenue],
      ['Paiements en attente', report.pendingPayments],
      ['Cautions reçues', report.depositsReceived],
      ['Cautions à rembourser', report.depositsToRefund],
      ['Dépenses entretien', report.maintenanceExpenses],
      ['Profit estimé', report.estimatedProfit],
      [],
      ['Revenus par véhicule'],
      ['Véhicule', 'Immatriculation', 'Revenus'],
      ...report.revenueByVehicle.map((item) => [item.label, item.plate, item.revenue]),
      [],
      ['Clients les plus rentables'],
      ['Client', 'Réservations', 'Revenus'],
      ...report.profitableClients.map((item) => [item.label, item.reservations, item.revenue]),
      [],
      ['Paiements en retard'],
      ['Facture', 'Client', 'Échéance', 'Montant'],
      ...report.overdue.map((item) => [item.invoice, item.client, item.dueDate, item.amount]),
    ];
    downloadTextFile(
      `rapport-mekloc-${range.start || 'debut'}-${range.end || 'fin'}.csv`,
      rows.map((row) => row.map((cell) => csvEscape(cell ?? '')).join(',')).join('\n'),
      'text/csv;charset=utf-8',
    );
    notify({ title: 'Export CSV prêt', message: 'Le rapport comptable a été téléchargé.', type: 'success' });
  }

  function exportPdf() {
    const lines = [
      'Rapport comptable MekLoc',
      `Période: ${range.start || 'Début'} -> ${range.end || 'Fin'}`,
      `Chiffre affaires total: ${formatMAD(report.totalRevenue)}`,
      `Revenus encaisses: ${formatMAD(report.collectedRevenue)}`,
      `Paiements en attente: ${formatMAD(report.pendingPayments)}`,
      `Cautions recues: ${formatMAD(report.depositsReceived)}`,
      `Cautions a rembourser: ${formatMAD(report.depositsToRefund)}`,
      `Depenses entretien: ${formatMAD(report.maintenanceExpenses)}`,
      `Profit estime: ${formatMAD(report.estimatedProfit)}`,
      '',
      'Top vehicules rentables',
      ...report.revenueByVehicle.slice(0, 8).map((item) => `${item.label} (${item.plate}) - ${formatMAD(item.revenue)}`),
      '',
      'Clients les plus rentables',
      ...report.profitableClients.slice(0, 8).map((item) => `${item.label} - ${formatMAD(item.revenue)}`),
      '',
      'Paiements en retard',
      ...report.overdue.slice(0, 8).map((item) => `${item.invoice} - ${item.client} - ${formatMAD(item.amount)}`),
    ];
    const stream = lines
      .slice(0, 34)
      .map((line, i) => `BT /F1 ${i === 0 ? 16 : 10} Tf 44 ${790 - i * 21} Td (${escapePdf(line)}) Tj ET`)
      .join('\n');
    const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000117 00000 n
0000000243 00000 n
000000${(260 + stream.length).toString().padStart(10, '0')} 00000 n
trailer << /Root 1 0 R /Size 6 >>
startxref
0
%%EOF`;
    downloadTextFile(`rapport-mekloc-${dateKey()}.pdf`, pdf, 'application/pdf');
    notify({ title: 'Export PDF prêt', message: 'Le rapport comptable a été téléchargé.', type: 'success' });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comptabilité"
        title="Rapports financiers"
        description="Tableau de bord comptable calculé depuis les données réelles de votre agence."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={exportCsv}>CSV</Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={exportPdf}>PDF</Button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <p className="text-sm font-semibold text-white light:text-carbon-950">Filtre de période</p>
            <p className="mt-1 text-xs text-carbon-500">Les montants sont basés sur les réservations, paiements et entretiens de la période.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['month', 'Ce mois'],
              ['quarter', '3 mois'],
              ['year', 'Année'],
              ['custom', 'Personnalisé'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${period === key ? 'bg-gold-400 text-carbon-950' : 'border border-white/10 text-carbon-300 hover:bg-white/[0.06]'}`}
                onClick={() => setPeriod(key as PeriodKey)}
              >
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="form-control text-sm" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              <input className="form-control text-sm" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </div>
          ) : null}
        </div>
      </Card>

      {!hasReportData ? (
        <Card className="p-6 text-sm text-carbon-400">Aucune donnée réelle sur cette période.</Card>
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Chiffre d’affaires total" value={formatMAD(report.totalRevenue)} note="Réservations non annulées" />
        <MetricCard label="Revenus encaissés" value={formatMAD(report.collectedRevenue)} note="Paiements payés ou partiels" />
        <MetricCard label="Paiements en attente" value={formatMAD(report.pendingPayments)} note="En attente et en retard" />
        <MetricCard label="Profit estimé" value={formatMAD(report.estimatedProfit)} note="Encaissé - entretien" />
        <MetricCard label="Cautions reçues" value={formatMAD(report.depositsReceived)} note="Cautions de la période" />
        <MetricCard label="Cautions à rembourser" value={formatMAD(report.depositsToRefund)} note="Locations actives ou terminées" />
        <MetricCard label="Dépenses entretien" value={formatMAD(report.maintenanceExpenses)} note="Coûts garage et maintenance" />
        <MetricCard label="Paiements en retard" value={formatMAD(report.overdue.reduce((sum, item) => sum + item.amount, 0))} note={`${report.overdue.length} facture(s)`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-gold-200" />
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Réservations par mois</h2>
          </div>
          <div className="grid gap-3">
            {report.reservationsByMonth.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400">Aucune réservation.</div>
            ) : report.reservationsByMonth.map(([label, count]) => (
              <div key={label} className="grid grid-cols-[76px_1fr_48px] items-center gap-3 text-sm">
                <span className="text-carbon-500">{label}</span>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-gold-400" style={{ width: `${Math.max(4, (count / maxMonthlyReservations) * 100)}%` }} />
                </div>
                <span className="text-right font-semibold text-white light:text-carbon-950">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Gauge className="h-5 w-5 text-carbon-300" />
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Revenus par véhicule</h2>
          </div>
          <div className="grid gap-3">
            {report.revenueByVehicle.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400">Aucun revenu véhicule.</div>
            ) : report.revenueByVehicle.slice(0, 8).map((item) => (
              <BarRow key={item.id} label={item.plate} value={item.revenue} max={maxVehicleRevenue} />
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Top véhicules rentables</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-carbon-500">
                <tr><th className="px-5 py-3">Véhicule</th><th className="px-5 py-3">Immatriculation</th><th className="px-5 py-3 text-right">Revenus</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {report.revenueByVehicle.slice(0, 8).map((item) => (
                  <tr key={item.id}><td className="px-5 py-3 font-semibold">{item.label}</td><td className="px-5 py-3 text-carbon-400"><PlateNumber value={item.plate} /></td><td className="px-5 py-3 text-right font-semibold text-gold-200">{formatMAD(item.revenue)}</td></tr>
                ))}
                {report.revenueByVehicle.length === 0 ? <tr><td colSpan={3} className="px-5 py-4 text-carbon-400">Aucune donnée.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Clients les plus rentables</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-carbon-500">
                <tr><th className="px-5 py-3">Client</th><th className="px-5 py-3">Réservations</th><th className="px-5 py-3 text-right">Revenus</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {report.profitableClients.slice(0, 8).map((item) => (
                  <tr key={item.id}><td className="px-5 py-3 font-semibold">{item.label}</td><td className="px-5 py-3 text-carbon-400">{item.reservations}</td><td className="px-5 py-3 text-right font-semibold text-gold-200">{formatMAD(item.revenue)}</td></tr>
                ))}
                {report.profitableClients.length === 0 ? <tr><td colSpan={3} className="px-5 py-4 text-carbon-400">Aucune donnée.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <WalletCards className="h-5 w-5 text-carbon-300" />
          <h2 className="text-xl font-semibold tracking-tight text-white light:text-carbon-950">Paiements en retard</h2>
        </div>
        <div className="grid gap-3">
          {report.overdue.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400">Aucun paiement en retard.</div>
          ) : report.overdue.map((payment) => (
            <div key={payment.id} className="premium-surface grid gap-3 rounded-2xl p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <p className="font-semibold text-white light:text-carbon-950">{payment.client}</p>
                <p className="mt-1 text-sm text-carbon-400">{payment.invoice} · échéance {payment.dueDate}</p>
              </div>
              <p className="font-semibold text-white light:text-carbon-950">{formatMAD(payment.amount)}</p>
              <span className="rounded-full border border-rose-300/30 bg-rose-500/10 px-3 py-1 text-center text-xs font-semibold text-rose-100">En retard</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
