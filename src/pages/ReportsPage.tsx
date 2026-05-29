import { CalendarDays, Download, FileSpreadsheet, Gauge, TrendingUp, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { MobileEmptyBlock } from '../components/ui/MobilePrimitives';
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

function MetricCard({ label, value, note, tone = 'gold' }: { label: string; value: string; note: string; tone?: 'gold' | 'green' | 'amber' | 'red' }) {
  const toneClass = {
    gold: 'from-[#D4A017]/16 text-gold-100',
    green: 'from-emerald-400/14 text-emerald-100',
    amber: 'from-amber-400/14 text-amber-100',
    red: 'from-rose-400/14 text-rose-100',
  }[tone];
  return (
    <Card className={`relative flex min-h-[112px] min-w-0 flex-col justify-between overflow-hidden rounded-3xl border-white/10 bg-gradient-to-br ${toneClass} via-white/[0.035] to-black p-3 shadow-[0_14px_38px_rgba(0,0,0,.22)] sm:min-h-[132px] sm:p-5`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <p className="line-clamp-2 text-[10px] font-black uppercase tracking-[0.12em] text-carbon-400 light:text-carbon-600 sm:text-xs">{label}</p>
      <p className="mt-2 break-words text-lg font-black tracking-tight text-white light:text-carbon-950 sm:mt-3 sm:text-2xl">{value}</p>
      <p className="mt-2 line-clamp-2 text-[11px] font-medium text-carbon-500 light:text-carbon-600 sm:text-sm">{note}</p>
    </Card>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid min-w-0 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm sm:grid-cols-[92px_1fr_120px] sm:items-center sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
      <span className="min-w-0 truncate font-semibold text-carbon-300 sm:text-carbon-500">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-[#D4A017] to-[#f1c232]" style={{ width: `${width}%` }} />
      </div>
      <span className="truncate font-black text-gold-100 sm:text-right">{formatMAD(value)}</span>
    </div>
  );
}

function CountBarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div className="grid min-w-0 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm sm:grid-cols-[92px_1fr_52px] sm:items-center sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
      <span className="min-w-0 truncate font-semibold text-carbon-300 sm:text-carbon-500">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-[#D4A017] to-[#f1c232]" style={{ width: `${width}%` }} />
      </div>
      <span className="font-black text-white light:text-carbon-950 sm:text-right">{count}</span>
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
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button variant="secondary" className="h-11 w-full rounded-2xl sm:w-auto" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={exportCsv}>CSV</Button>
            <Button className="h-11 w-full rounded-2xl sm:w-auto" icon={<Download className="h-4 w-4" />} onClick={exportPdf}>PDF</Button>
          </div>
        }
      />

      <Card className="overflow-hidden rounded-3xl border-white/10 bg-gradient-to-br from-[#121720] via-[#0d1118] to-black p-4 shadow-[0_18px_50px_rgba(0,0,0,.26)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 text-gold-200">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-black text-white light:text-carbon-950">Filtre de période</p>
                <p className="mt-1 text-xs leading-5 text-carbon-500">Les montants sont basés sur les réservations, paiements et entretiens de la période.</p>
              </div>
            </div>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
            {[
              ['month', 'Ce mois'],
              ['quarter', '3 mois'],
              ['year', 'Année'],
              ['custom', 'Personnalisé'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`h-11 shrink-0 rounded-2xl px-4 text-sm font-black transition ${period === key ? 'bg-gold-400 text-carbon-950 shadow-[0_0_28px_rgba(212,160,23,.16)]' : 'border border-white/10 bg-white/[0.035] text-carbon-300 hover:bg-white/[0.06]'}`}
                onClick={() => setPeriod(key as PeriodKey)}
              >
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input aria-label="Début période" className="form-control h-11 rounded-2xl text-sm" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              <input aria-label="Fin période" className="form-control h-11 rounded-2xl text-sm" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </div>
          ) : null}
        </div>
      </Card>

      {!hasReportData ? (
        <MobileEmptyBlock icon={TrendingUp} title="Aucune donnée sur cette période" message="Les revenus, réservations et dépenses apparaîtront dès que votre activité commence." />
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Chiffre d’affaires total" value={formatMAD(report.totalRevenue)} note="Réservations non annulées" tone="gold" />
        <MetricCard label="Revenus encaissés" value={formatMAD(report.collectedRevenue)} note="Paiements payés ou partiels" tone="green" />
        <MetricCard label="Paiements en attente" value={formatMAD(report.pendingPayments)} note="En attente et en retard" tone="amber" />
        <MetricCard label="Profit estimé" value={formatMAD(report.estimatedProfit)} note="Encaissé - entretien" tone={report.estimatedProfit >= 0 ? 'green' : 'red'} />
        <MetricCard label="Cautions reçues" value={formatMAD(report.depositsReceived)} note="Cautions de la période" tone="gold" />
        <MetricCard label="Cautions à rembourser" value={formatMAD(report.depositsToRefund)} note="Locations actives ou terminées" tone="amber" />
        <MetricCard label="Dépenses entretien" value={formatMAD(report.maintenanceExpenses)} note="Coûts garage et maintenance" tone="red" />
        <MetricCard label="Paiements en retard" value={formatMAD(report.overdue.reduce((sum, item) => sum + item.amount, 0))} note={`${report.overdue.length} facture(s)`} tone="red" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card className="overflow-hidden rounded-3xl border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] sm:p-6">
          <div className="mb-5 flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 text-gold-200">
              <TrendingUp className="h-5 w-5" />
            </span>
            <h2 className="min-w-0 truncate text-lg font-black tracking-tight text-white light:text-carbon-950 sm:text-xl">Réservations par mois</h2>
          </div>
          <div className="grid gap-3">
            {report.reservationsByMonth.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400">Aucune réservation.</div>
            ) : report.reservationsByMonth.map(([label, count]) => (
              <CountBarRow key={label} label={label} count={count} max={maxMonthlyReservations} />
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] sm:p-6">
          <div className="mb-5 flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-carbon-300">
              <Gauge className="h-5 w-5" />
            </span>
            <h2 className="min-w-0 truncate text-lg font-black tracking-tight text-white light:text-carbon-950 sm:text-xl">Revenus par véhicule</h2>
          </div>
          <div className="grid gap-3">
            {report.revenueByVehicle.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400">Aucun revenu véhicule.</div>
            ) : report.revenueByVehicle.slice(0, 8).map((item) => (
              <BarRow key={item.id} label={item.plate} value={item.revenue} max={maxVehicleRevenue} />
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden rounded-3xl border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-0 shadow-[0_18px_50px_rgba(0,0,0,.24)]">
          <div className="border-b border-white/10 p-4 sm:p-5">
            <h2 className="text-lg font-black tracking-tight text-white light:text-carbon-950 sm:text-xl">Top véhicules rentables</h2>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {report.revenueByVehicle.length === 0 ? (
              <MobileEmptyBlock icon={Gauge} title="Aucun revenu véhicule" message="Les véhicules rentables apparaîtront après vos premiers paiements." />
            ) : report.revenueByVehicle.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">{item.label}</p>
                    <div className="mt-2"><PlateNumber value={item.plate} /></div>
                  </div>
                  <p className="shrink-0 text-right font-black text-gold-200">{formatMAD(item.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
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

        <Card className="overflow-hidden rounded-3xl border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-0 shadow-[0_18px_50px_rgba(0,0,0,.24)]">
          <div className="border-b border-white/10 p-4 sm:p-5">
            <h2 className="text-lg font-black tracking-tight text-white light:text-carbon-950 sm:text-xl">Clients les plus rentables</h2>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {report.profitableClients.length === 0 ? (
              <MobileEmptyBlock icon={WalletCards} title="Aucun client rentable" message="Le classement client apparaîtra après vos premières locations." />
            ) : report.profitableClients.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">{item.label}</p>
                    <p className="mt-1 text-sm text-carbon-400">{item.reservations} réservation(s)</p>
                  </div>
                  <p className="shrink-0 text-right font-black text-gold-200">{formatMAD(item.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
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

      <Card className="overflow-hidden rounded-3xl border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] sm:p-6">
        <div className="mb-5 flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-rose-300/20 bg-rose-500/10 text-rose-100">
            <WalletCards className="h-5 w-5" />
          </span>
          <h2 className="min-w-0 truncate text-lg font-black tracking-tight text-white light:text-carbon-950 sm:text-xl">Paiements en retard</h2>
        </div>
        <div className="grid gap-3">
          {report.overdue.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400">Aucun paiement en retard.</div>
          ) : report.overdue.map((payment) => (
            <div key={payment.id} className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] md:grid-cols-[1fr_auto_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-black text-white light:text-carbon-950">{payment.client}</p>
                <p className="mt-1 text-sm text-carbon-400">{payment.invoice} · échéance {payment.dueDate}</p>
              </div>
              <p className="font-black text-rose-100 light:text-carbon-950">{formatMAD(payment.amount)}</p>
              <span className="inline-flex h-9 items-center justify-center rounded-full border border-rose-300/30 bg-rose-500/10 px-3 text-center text-xs font-black text-rose-100">En retard</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
