import { CalendarDays, CheckCircle2, Download, FileSpreadsheet, Gauge, TrendingUp, UsersRound, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { MobileEmptyBlock } from '../components/ui/MobilePrimitives';
import PlateNumber from '../components/ui/PlateNumber';
import { formatMAD } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useSupportMode } from '../context/SupportModeContext';
import { getFleetResponsiblePerformance, roleLabelFr, type FleetResponsible } from '../lib/fleetResponsibles';
import { supabase } from '../lib/supabase';

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

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function loadPdfImage(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    return response.ok ? blobToDataUrl(await response.blob()) : null;
  } catch {
    return null;
  }
}

function periodLabel(period: PeriodKey) {
  return { month: 'Ce mois', quarter: '3 mois', year: 'Année', custom: 'Personnalisé' }[period];
}

function MetricCard({ label, value, note, icon: Icon, tone = 'gold', primary = false }: { label: string; value: string; note: string; icon: typeof WalletCards; tone?: 'gold' | 'green' | 'amber' | 'red'; primary?: boolean }) {
  const toneClass = {
    gold: 'border-gold-300/25 bg-gold-400/12 text-[var(--app-gold-text)]',
    green: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200',
    amber: 'border-amber-300/25 bg-amber-400/10 text-amber-700 dark:text-amber-200',
    red: 'border-rose-300/20 bg-rose-400/10 text-rose-700 dark:text-rose-200',
  }[tone];
  return (
    <Card className={`relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] shadow-[0_14px_38px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.04)] before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-gold-300/70 before:to-transparent ${primary ? 'min-h-[154px] p-4 sm:min-h-[178px] sm:rounded-3xl sm:p-6' : 'min-h-[112px] p-3 sm:min-h-[128px] sm:rounded-3xl sm:p-4'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase leading-3 tracking-[0.12em] text-[var(--app-text-muted)]  sm:text-xs">{label}</p>
          <p className={`mt-2 truncate font-black leading-none tracking-tight text-[var(--app-text)] ${primary ? 'text-xl sm:mt-4 sm:text-[1.8rem]' : 'text-base sm:mt-3 sm:text-xl'}`}>{value}</p>
        </div>
        <span className={`grid shrink-0 place-items-center rounded-xl border ${primary ? 'h-10 w-10 sm:h-12 sm:w-12 sm:rounded-2xl' : 'h-8 w-8 sm:h-10 sm:w-10 sm:rounded-2xl'} ${toneClass}`}>
          <Icon className={primary ? 'h-5 w-5' : 'h-3.5 w-3.5 sm:h-5 sm:w-5'} />
        </span>
      </div>
      <p className="mt-2 truncate text-[11px] font-medium text-[var(--app-text-muted)]  sm:text-sm">{note}</p>
    </Card>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid min-w-0 gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm sm:grid-cols-[92px_1fr_120px] sm:items-center sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
      <span className="min-w-0 truncate font-semibold text-[var(--app-text-soft)] sm:text-[var(--app-text-muted)]">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-surface-soft)]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#D4A017] to-[#f1c232]" style={{ width: `${width}%` }} />
      </div>
      <span className="truncate font-black text-[var(--app-gold-text)] sm:text-right">{formatMAD(value)}</span>
    </div>
  );
}

function CountBarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div className="grid min-w-0 gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm sm:grid-cols-[92px_1fr_52px] sm:items-center sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
      <span className="min-w-0 truncate font-semibold text-[var(--app-text-soft)] sm:text-[var(--app-text-muted)]">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-surface-soft)]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#D4A017] to-[#f1c232]" style={{ width: `${width}%` }} />
      </div>
      <span className="font-black text-[var(--app-text)]  sm:text-right">{count}</span>
    </div>
  );
}

function ReservationsChart({ items, max }: { items: Array<[string, number]>; max: number }) {
  if (!items.length) return <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] p-5 text-sm text-[var(--app-text-muted)]">Aucune réservation sur cette période.</div>;
  const visibleItems = items.slice(-8);
  const chartWidth = 640;
  const chartHeight = 250;
  const baseline = 205;
  const chartTop = 34;
  const barWidth = Math.min(44, Math.max(20, (chartWidth - 92) / visibleItems.length - 18));
  const step = (chartWidth - 92) / visibleItems.length;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface-soft),transparent)] p-3 sm:p-4">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Graphique des réservations par mois" className="h-[230px] w-full sm:h-[260px]">
        <defs><linearGradient id="reservations-gold" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#f7d56c" /><stop offset="1" stopColor="#c58a0b" /></linearGradient></defs>
        {[0, 1, 2, 3].map((index) => { const y = chartTop + ((baseline - chartTop) / 3) * index; return <line key={index} x1="46" x2={chartWidth - 18} y1={y} y2={y} stroke="currentColor" className="text-[var(--app-border)]" strokeDasharray="3 5" />; })}
        <text x="10" y={chartTop + 3} fill="currentColor" className="fill-[var(--app-text-muted)] text-[11px]">{max}</text>
        <text x="17" y={baseline + 3} fill="currentColor" className="fill-[var(--app-text-muted)] text-[11px]">0</text>
        {visibleItems.map(([label, count], index) => {
          const height = Math.max(12, ((baseline - chartTop) * count) / max);
          const x = 46 + step * index + (step - barWidth) / 2;
          const y = baseline - height;
          return <g key={label}><text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fill="currentColor" className="fill-[var(--app-text)] text-[11px] font-bold">{count}</text><rect x={x} y={y} width={barWidth} height={height} rx="7" fill="url(#reservations-gold)" /><text x={x + barWidth / 2} y="228" textAnchor="middle" fill="currentColor" className="fill-[var(--app-text-muted)] text-[10px] font-bold">{label.slice(5)}</text></g>;
        })}
      </svg>
    </div>
  );
}

function RevenueRankChart({ items, max }: { items: Array<{ id: string; label: string; plate: string; revenue: number }>; max: number }) {
  if (!items.length) return <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] p-5 text-sm text-[var(--app-text-muted)]">Aucun revenu véhicule sur cette période.</div>;
  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(180deg,var(--app-surface-soft),transparent)] p-3 sm:p-4">
      {items.slice(0, 3).map((item, index) => <div key={item.id} className="grid min-w-0 grid-cols-[24px_1fr_auto] items-center gap-2 sm:grid-cols-[28px_1fr_106px]"><span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--app-card)] text-[10px] font-black text-[var(--app-gold-text)]">{index + 1}</span><div className="min-w-0"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold text-[var(--app-text)]">{item.label}</span><span className="text-xs font-black text-[var(--app-gold-text)] sm:hidden">{formatMAD(item.revenue)}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--app-card)]"><div className="h-full rounded-full bg-gradient-to-r from-[#d4a017] via-[#e8b935] to-[#f7d56c]" style={{ width: `${Math.max(5, Math.round((item.revenue / max) * 100))}%` }} /></div><span className="mt-1 block text-[10px] font-bold text-[var(--app-text-muted)]">{item.plate}</span></div><span className="hidden text-right text-sm font-black text-[var(--app-gold-text)] sm:block">{formatMAD(item.revenue)}</span></div>)}
    </div>
  );
}

export default function ReportsPage() {
  const { notify } = useApp();
  const { vehicles, clients, payments, reservations, maintenance } = useData();
  const { agencyId: authAgencyId, profile } = useAuth();
  const { supportAgencyId, supportAgency, isSupportMode } = useSupportMode();
  const agencyId = supportAgencyId || authAgencyId;
  const agency = isSupportMode ? supportAgency : profile?.agency;
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [fleetResponsibles, setFleetResponsibles] = useState<FleetResponsible[]>([]);
  const [pdfExporting, setPdfExporting] = useState(false);

  const range = useMemo(() => getPeriodRange(period, customStart, customEnd), [customEnd, customStart, period]);

  useEffect(() => {
    let mounted = true;
    async function loadResponsibles() {
      if (!supabase || !agencyId) return;
      const { data, error } = await supabase
        .from('users_profiles')
        .select('id,full_name,email,role,account_status')
        .eq('agency_id', agencyId)
        .eq('account_status', 'active')
        .order('full_name', { ascending: true });
      if (!mounted || error) return;
      setFleetResponsibles(((data || []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null; account_status: string | null }>).map((member) => ({
        id: member.id,
        fullName: member.full_name || member.email || 'Utilisateur',
        email: member.email || '',
        role: member.role || 'agent',
        accountStatus: member.account_status,
      })));
    }
    void loadResponsibles();
    return () => { mounted = false; };
  }, [agencyId]);

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
  const responsiblePerformance = useMemo(
    () => getFleetResponsiblePerformance({ members: fleetResponsibles, vehicles, reservations, payments, start: range.start, end: range.end }),
    [fleetResponsibles, payments, range.end, range.start, reservations, vehicles],
  );
  const assignedPerformance = useMemo(
    () => responsiblePerformance.filter((item) => !item.isUnassigned && item.assignedVehicles > 0).sort((a, b) => b.revenue - a.revenue),
    [responsiblePerformance],
  );
  const unassignedPerformance = useMemo(
    () => responsiblePerformance.find((item) => item.isUnassigned),
    [responsiblePerformance],
  );
  const maxResponsibleRevenue = Math.max(...assignedPerformance.map((item) => item.revenue), 1);
  const responsibleHighlights = useMemo(() => {
    const topResponsible = assignedPerformance[0];
    const largestRemaining = assignedPerformance.reduce<typeof assignedPerformance[number] | undefined>(
      (current, item) => (!current || item.remaining > current.remaining ? item : current),
      undefined,
    );
    return { topResponsible, largestRemaining };
  }, [assignedPerformance]);

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

  async function exportPdf() {
    setPdfExporting(true);
    try {
      const [{ jsPDF }, meklocLogo, agencyLogo] = await Promise.all([
        import('jspdf'),
        loadPdfImage('/mekloc-logo-mark.png'),
        loadPdfImage(agency?.logoUrl),
      ]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 42;
      const contentWidth = pageWidth - margin * 2;
      const gold: [number, number, number] = [212, 160, 23];
      const ink: [number, number, number] = [19, 24, 32];
      const muted: [number, number, number] = [104, 115, 126];
      const generatedAt = new Date().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
      const agencyDetails = [agency?.address, agency?.phone, agency?.email].filter(Boolean).join(' · ');
      let y = 0;
      const addPdfImage = (image: string, x: number, top: number, width: number, height: number) => {
        const format = image.startsWith('data:image/jpeg') || image.startsWith('data:image/jpg') ? 'JPEG' : image.startsWith('data:image/webp') ? 'WEBP' : 'PNG';
        pdf.addImage(image, format, x, top, width, height, undefined, 'FAST');
      };

      const addFooter = () => {
        const total = pdf.getNumberOfPages();
        for (let page = 1; page <= total; page += 1) {
          pdf.setPage(page);
          pdf.setDrawColor(224, 228, 232);
          pdf.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);
          pdf.setTextColor(...muted);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.text('Généré par MekLoc · Rapport financier', margin, pageHeight - 19);
          pdf.text(`Page ${page} / ${total}`, pageWidth - margin, pageHeight - 19, { align: 'right' });
        }
      };
      const nextPage = () => {
        pdf.addPage();
        y = 46;
      };
      const ensureSpace = (height: number) => {
        if (y + height > pageHeight - 54) nextPage();
      };
      const sectionTitle = (title: string, subtitle?: string) => {
        ensureSpace(45);
        pdf.setTextColor(...ink);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text(title, margin, y);
        if (subtitle) {
          pdf.setTextColor(...muted);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8.5);
          pdf.text(subtitle, margin, y + 14);
        }
        pdf.setDrawColor(...gold);
        pdf.setLineWidth(1.5);
        pdf.line(margin, y + 22, margin + 34, y + 22);
        y += 37;
      };
      const metric = (x: number, top: number, label: string, value: string) => {
        pdf.setFillColor(250, 248, 240);
        pdf.setDrawColor(236, 225, 183);
        pdf.roundedRect(x, top, (contentWidth - 12) / 2, 57, 8, 8, 'FD');
        pdf.setTextColor(...muted);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.text(label.toUpperCase(), x + 12, top + 18);
        pdf.setTextColor(...ink);
        pdf.setFontSize(13);
        pdf.text(value, x + 12, top + 39);
      };
      const table = (title: string, headers: string[], rows: string[][]) => {
        sectionTitle(title);
        const widths = headers.map((_, index) => index === 0 ? contentWidth * 0.48 : (contentWidth * 0.52) / Math.max(headers.length - 1, 1));
        const drawHeader = () => {
          pdf.setFillColor(...ink);
          pdf.roundedRect(margin, y, contentWidth, 22, 5, 5, 'F');
          let x = margin + 10;
          pdf.setTextColor(255, 255, 255);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          headers.forEach((header, index) => { pdf.text(header, x, y + 14); x += widths[index]; });
          y += 28;
        };
        drawHeader();
        if (!rows.length) {
          pdf.setTextColor(...muted);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.text('Aucune donnée pour cette période.', margin + 4, y + 10);
          y += 28;
          return;
        }
        rows.forEach((row, rowIndex) => {
          if (y + 28 > pageHeight - 54) { nextPage(); drawHeader(); }
          if (rowIndex % 2 === 0) { pdf.setFillColor(248, 249, 250); pdf.rect(margin, y - 13, contentWidth, 24, 'F'); }
          let x = margin + 10;
          pdf.setTextColor(...ink);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8.5);
          row.forEach((cell, index) => {
            const lines = pdf.splitTextToSize(cell, widths[index] - 12);
            pdf.text(lines[0] || '—', x, y);
            x += widths[index];
          });
          y += 24;
        });
        y += 9;
      };

      pdf.setFillColor(...ink);
      pdf.rect(0, 0, pageWidth, 118, 'F');
      pdf.setFillColor(...gold);
      pdf.rect(0, 115, pageWidth, 3, 'F');
      if (meklocLogo) addPdfImage(meklocLogo, margin, 26, 42, 42);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(17);
      pdf.text('MekLoc', margin + 52, 48);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.text('Gestion location automobile', margin + 52, 63);
      if (agencyLogo) {
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(pageWidth - margin - 44, 27, 44, 44, 8, 8, 'F');
        addPdfImage(agencyLogo, pageWidth - margin - 38, 33, 32, 32);
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.text('Rapport financier', margin, 151);
      pdf.setTextColor(...muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`${agency?.name || 'Agence MekLoc'} · ${periodLabel(period)} · ${range.start || 'Début'} → ${range.end || 'Fin'}`, margin, 168);
      if (agencyDetails) pdf.text(agencyDetails, margin, 181);
      pdf.text(`Généré le ${generatedAt}`, pageWidth - margin, 168, { align: 'right' });
      y = agencyDetails ? 210 : 198;

      sectionTitle('Synthèse exécutive', 'Vue d’ensemble des indicateurs financiers sélectionnés');
      const metrics = [
        ['Chiffre d’affaires total', formatMAD(report.totalRevenue)], ['Revenus encaissés', formatMAD(report.collectedRevenue)],
        ['Paiements en attente', formatMAD(report.pendingPayments)], ['Profit estimé', formatMAD(report.estimatedProfit)],
        ['Cautions reçues', formatMAD(report.depositsReceived)], ['Cautions à rembourser', formatMAD(report.depositsToRefund)],
        ['Dépenses entretien', formatMAD(report.maintenanceExpenses)], ['Paiements en retard', formatMAD(report.overdue.reduce((sum, item) => sum + item.amount, 0))],
      ];
      metrics.forEach(([label, value], index) => {
        if (index % 2 === 0) ensureSpace(64);
        metric(margin + (index % 2 ? (contentWidth + 12) / 2 : 0), y, label, value);
        if (index % 2 === 1) y += 66;
      });
      if (metrics.length % 2) y += 66;

      sectionTitle('Tendances', 'Réservations et revenus les plus représentatifs');
      const chartRows = [
        ...report.reservationsByMonth.slice(-6).map(([label, count]) => ({ label, value: count, suffix: ' réservations', max: maxMonthlyReservations })),
        ...report.revenueByVehicle.slice(0, 5).map((item) => ({ label: item.plate, value: item.revenue, suffix: ` · ${formatMAD(item.revenue)}`, max: maxVehicleRevenue })),
      ];
      chartRows.forEach((item) => {
        ensureSpace(21);
        pdf.setTextColor(...ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.text(item.label, margin, y);
        pdf.setFillColor(234, 237, 240); pdf.roundedRect(margin + 100, y - 8, contentWidth - 190, 8, 4, 4, 'F');
        pdf.setFillColor(...gold); pdf.roundedRect(margin + 100, y - 8, Math.max(5, (contentWidth - 190) * (item.value / item.max)), 8, 4, 4, 'F');
        pdf.setTextColor(...muted); pdf.setFont('helvetica', 'normal'); pdf.text(`${item.value}${item.suffix}`, pageWidth - margin, y, { align: 'right' });
        y += 20;
      });

      table('Top véhicules rentables', ['Véhicule', 'Immatriculation', 'Revenus'], report.revenueByVehicle.slice(0, 8).map((item) => [item.label, item.plate, formatMAD(item.revenue)]));
      table('Clients les plus rentables', ['Client', 'Réservations', 'Revenus'], report.profitableClients.slice(0, 8).map((item) => [item.label, String(item.reservations), formatMAD(item.revenue)]));
      table('Performance par responsable', ['Responsable', 'Réservations', 'Revenus', 'Payé', 'Reste'], assignedPerformance.slice(0, 8).map((item) => [item.responsible?.fullName || '—', String(item.reservationsCount), formatMAD(item.revenue), formatMAD(item.paid), formatMAD(item.remaining)]));
      table('Paiements en retard', ['Client', 'Facture', 'Échéance', 'Montant'], report.overdue.slice(0, 8).map((item) => [item.client, item.invoice, item.dueDate, formatMAD(item.amount)]));
      addFooter();
      pdf.save(`rapport-financier-mekloc-${dateKey()}.pdf`);
      notify({ title: 'Export PDF prêt', message: 'Le rapport financier professionnel a été téléchargé.', type: 'success' });
    } catch {
      notify({ title: 'Export PDF impossible', message: 'Réessayez dans quelques instants.', type: 'warning' });
    } finally {
      setPdfExporting(false);
    }
  }

  return (
    <div className="space-y-3 overflow-x-hidden pb-[calc(108px+env(safe-area-inset-bottom))] md:space-y-6 md:pb-8">
      <header className="relative overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[linear-gradient(120deg,var(--app-card),var(--app-surface-soft))] p-5 shadow-[0_18px_50px_rgba(16,24,32,.10),inset_0_1px_0_rgba(255,255,255,.08)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-gold-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--app-gold-text)]">COMPTABILITÉ</p><h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--app-text)] sm:text-4xl">Rapports financiers</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-text-muted)] sm:text-base">Analysez vos revenus, paiements, cautions et rentabilité.</p></div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3"><span className="order-last rounded-full border border-gold-300/25 bg-[var(--app-gold-soft)] px-3 py-2 text-xs font-black text-[var(--app-gold-text)] sm:order-none">{periodLabel(period)}</span><Button variant="secondary" className="h-11 rounded-2xl px-4" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={exportCsv}>CSV</Button><Button className="h-11 rounded-2xl px-4" icon={<Download className="h-4 w-4" />} loading={pdfExporting} onClick={exportPdf}>PDF</Button></div>
        </div>
      </header>

      <Card className="overflow-hidden rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_18px_50px_rgba(0,0,0,.26)] sm:rounded-3xl sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#D4A017]/20 bg-[#D4A017]/10 text-[var(--app-gold-text)] sm:h-10 sm:w-10 sm:rounded-2xl">
                <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-[var(--app-text)]  sm:text-base">Filtre de période</p>
                <p className="mt-1 truncate text-xs leading-5 text-[var(--app-text-muted)]">Réservations, paiements et entretiens de la période.</p>
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
                className={`h-9 shrink-0 rounded-full px-3 text-xs font-black transition sm:h-11 sm:rounded-2xl sm:px-4 sm:text-sm ${period === key ? 'bg-gold-400 text-[#101820] shadow-[0_0_28px_rgba(212,160,23,.16)]' : 'border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] hover:bg-[var(--app-surface-soft)]'}`}
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

      <section className="space-y-4 sm:space-y-5">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Vue d’ensemble</p><h2 className="mt-1 text-xl font-black tracking-tight text-[var(--app-text)] sm:text-2xl">Résumé financier</h2></div><p className="hidden text-sm text-[var(--app-text-muted)] sm:block">Les indicateurs essentiels de votre période</p></div>
        <div className="grid grid-cols-1 gap-3 min-[500px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <MetricCard primary label="Chiffre d’affaires total" value={formatMAD(report.totalRevenue)} note="Réservations non annulées" icon={TrendingUp} tone="gold" />
          <MetricCard primary label="Revenus encaissés" value={formatMAD(report.collectedRevenue)} note="Paiements reçus" icon={WalletCards} tone="green" />
          <MetricCard primary label="Profit estimé" value={formatMAD(report.estimatedProfit)} note="Encaissé - entretien" icon={Gauge} tone={report.estimatedProfit >= 0 ? 'green' : 'red'} />
          <MetricCard primary label="Paiements en attente" value={formatMAD(report.pendingPayments)} note="Attente et retard" icon={WalletCards} tone="amber" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <MetricCard label="Cautions reçues" value={formatMAD(report.depositsReceived)} note="Période" icon={WalletCards} tone="gold" />
          <MetricCard label="Cautions à rembourser" value={formatMAD(report.depositsToRefund)} note="Actives/terminées" icon={WalletCards} tone="amber" />
          <MetricCard label="Dépenses entretien" value={formatMAD(report.maintenanceExpenses)} note="Garage et maintenance" icon={Gauge} tone="red" />
          <MetricCard label="Paiements en retard" value={formatMAD(report.overdue.reduce((sum, item) => sum + item.amount, 0))} note={`${report.overdue.length} facture(s)`} icon={WalletCards} tone="red" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card className="overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] sm:p-6">
          <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 text-[var(--app-gold-text)]">
              <TrendingUp className="h-5 w-5" />
            </span>
              <div className="min-w-0"><h2 className="min-w-0 truncate text-lg font-black tracking-tight text-[var(--app-text)] sm:text-xl">Réservations par mois</h2><p className="mt-1 text-xs text-[var(--app-text-muted)]">Volume des locations sur la période</p></div>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--app-gold-soft)] px-2.5 py-1 text-xs font-black text-[var(--app-gold-text)]">{report.filteredReservations.length}</span>
          </div>
          <ReservationsChart items={report.reservationsByMonth} max={maxMonthlyReservations} />
        </Card>

        <Card className="overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] sm:p-6">
          <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]">
              <Gauge className="h-5 w-5" />
            </span>
              <div className="min-w-0"><h2 className="min-w-0 truncate text-lg font-black tracking-tight text-[var(--app-text)] sm:text-xl">Revenus par véhicule</h2><p className="mt-1 text-xs text-[var(--app-text-muted)]">Classement des véhicules générateurs de revenus</p></div>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--app-surface-soft)] px-2.5 py-1 text-xs font-black text-[var(--app-text-soft)]">Top {Math.min(report.revenueByVehicle.length, 3)}</span>
          </div>
          <RevenueRankChart items={report.revenueByVehicle} max={maxVehicleRevenue} />
        </Card>
      </section>

      <Card className="overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[var(--app-border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-gold-300/20 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]"><UsersRound className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Flotte</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--app-text)] sm:text-xl">Performance par responsable</h2>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Revenus et paiements calculés depuis les réservations liées aux véhicules assignés.</p>
            </div>
          </div>
          <Link to="/responsables" className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 text-sm font-bold text-[var(--app-text)] transition hover:border-gold-300/30 hover:bg-[var(--app-gold-soft)]">Voir responsables</Link>
        </div>
        {assignedPerformance.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-[var(--app-text-muted)]">Aucun véhicule assigné à un responsable sur cette période.</div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,.75fr)]">
            <div className="space-y-3">
              {assignedPerformance.slice(0, 6).map((item) => {
                const width = Math.max(4, Math.round((item.revenue / maxResponsibleRevenue) * 100));
                const initials = (item.responsible?.fullName || 'R').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
                return (
                  <div key={item.responsible?.id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3.5 transition hover:border-gold-300/30 sm:p-4">
                    <div className="flex min-w-0 items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-gold-300/25 bg-[var(--app-gold-soft)] text-xs font-black text-[var(--app-gold-text)]">{initials}</span><div className="min-w-0"><p className="truncate font-black text-[var(--app-text)]">{item.responsible?.fullName}</p><p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{roleLabelFr(item.responsible?.role)} · {item.reservationsCount} réservation(s)</p></div></div><p className="shrink-0 font-black text-[var(--app-gold-text)]">{formatMAD(item.revenue)}</p></div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--app-card)]"><div className="h-full rounded-full bg-gradient-to-r from-[#D4A017] to-[#f1c232]" style={{ width: `${width}%` }} /></div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--app-text-muted)]"><span>Payé: <strong className="text-emerald-700 dark:text-emerald-200">{formatMAD(item.paid)}</strong></span><span>Reste: <strong className="text-amber-700 dark:text-amber-200">{formatMAD(item.remaining)}</strong></span></div>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-gold-300/20 bg-[var(--app-gold-soft)] p-4"><p className="text-xs font-bold text-[var(--app-text-muted)]">Top responsable</p><p className="mt-2 truncate text-lg font-black text-[var(--app-text)]">{responsibleHighlights.topResponsible?.responsible?.fullName || '—'}</p><p className="mt-1 text-sm font-black text-[var(--app-gold-text)]">{formatMAD(responsibleHighlights.topResponsible?.revenue || 0)}</p></div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4"><p className="text-xs font-bold text-[var(--app-text-muted)]">Plus grand reste</p><p className="mt-2 truncate text-lg font-black text-[var(--app-text)]">{responsibleHighlights.largestRemaining?.responsible?.fullName || '—'}</p><p className="mt-1 text-sm font-black text-amber-700 dark:text-amber-200">{formatMAD(responsibleHighlights.largestRemaining?.remaining || 0)}</p></div>
              <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4"><p className="text-xs font-bold text-[var(--app-text-muted)]">Véhicules non assignés</p><p className="mt-2 text-lg font-black text-[var(--app-text)]">{unassignedPerformance?.assignedVehicles || 0}</p><p className="mt-1 text-xs text-[var(--app-text-muted)]">À attribuer depuis Véhicules</p></div>
            </div>
          </div>
        )}
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-0 shadow-[0_18px_50px_rgba(0,0,0,.24)]">
          <div className="border-b border-[var(--app-border)] p-4 sm:p-5">
            <h2 className="text-lg font-black tracking-tight text-[var(--app-text)]  sm:text-xl">Top véhicules rentables</h2>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">Les véhicules qui génèrent le plus de revenus sur cette période.</p>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {report.revenueByVehicle.length === 0 ? (
              <MobileEmptyBlock icon={Gauge} title="Aucun revenu véhicule" message="Les véhicules rentables apparaîtront après vos premiers paiements." />
            ) : report.revenueByVehicle.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-[var(--app-text)]">{item.label}</p>
                    <div className="mt-2"><PlateNumber value={item.plate} /></div>
                  </div>
                  <p className="shrink-0 text-right font-black text-[var(--app-gold-text)]">{formatMAD(item.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-[var(--app-border)] text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
                <tr><th className="px-5 py-3">Véhicule</th><th className="px-5 py-3">Immatriculation</th><th className="px-5 py-3 text-right">Revenus</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {report.revenueByVehicle.slice(0, 8).map((item) => (
                  <tr key={item.id} className="transition hover:bg-[var(--app-gold-soft)]"><td className="px-5 py-3.5 font-semibold">{item.label}</td><td className="px-5 py-3.5 text-[var(--app-text-muted)]"><PlateNumber value={item.plate} /></td><td className="px-5 py-3.5 text-right font-black text-[var(--app-gold-text)]">{formatMAD(item.revenue)}</td></tr>
                ))}
                {report.revenueByVehicle.length === 0 ? <tr><td colSpan={3} className="px-5 py-4 text-[var(--app-text-muted)]">Aucune donnée.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-0 shadow-[0_18px_50px_rgba(0,0,0,.24)]">
          <div className="border-b border-[var(--app-border)] p-4 sm:p-5">
            <h2 className="text-lg font-black tracking-tight text-[var(--app-text)]  sm:text-xl">Clients les plus rentables</h2>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">Les clients les plus actifs et les plus contributeurs de la période.</p>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {report.profitableClients.length === 0 ? (
              <MobileEmptyBlock icon={WalletCards} title="Aucun client rentable" message="Le classement client apparaîtra après vos premières locations." />
            ) : report.profitableClients.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-[var(--app-text)]">{item.label}</p>
                    <p className="mt-1 text-sm text-[var(--app-text-muted)]">{item.reservations} réservation(s)</p>
                  </div>
                  <p className="shrink-0 text-right font-black text-[var(--app-gold-text)]">{formatMAD(item.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-[var(--app-border)] text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
                <tr><th className="px-5 py-3">Client</th><th className="px-5 py-3">Réservations</th><th className="px-5 py-3 text-right">Revenus</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {report.profitableClients.slice(0, 8).map((item) => (
                  <tr key={item.id} className="transition hover:bg-[var(--app-gold-soft)]"><td className="px-5 py-3.5 font-semibold">{item.label}</td><td className="px-5 py-3.5 text-[var(--app-text-muted)]">{item.reservations}</td><td className="px-5 py-3.5 text-right font-black text-[var(--app-gold-text)]">{formatMAD(item.revenue)}</td></tr>
                ))}
                {report.profitableClients.length === 0 ? <tr><td colSpan={3} className="px-5 py-4 text-[var(--app-text-muted)]">Aucune donnée.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <Card className="overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] sm:p-6">
        <div className="mb-5 flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-rose-300/20 bg-rose-500/10 text-[var(--app-danger)]">
            <WalletCards className="h-5 w-5" />
          </span>
          <h2 className="min-w-0 truncate text-lg font-black tracking-tight text-[var(--app-text)]  sm:text-xl">Paiements en retard</h2>
        </div>
        <div className="grid gap-3">
          {report.overdue.length === 0 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-sm"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" /></span><div><p className="font-black text-[var(--app-text)]">Aucun paiement en retard</p><p className="mt-1 text-[var(--app-text-muted)]">Tous les paiements sont à jour pour cette période.</p></div></div>
          ) : report.overdue.map((payment) => (
            <div key={payment.id} className="grid gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] md:grid-cols-[1fr_auto_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-black text-[var(--app-text)] ">{payment.client}</p>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">{payment.invoice} · échéance {payment.dueDate}</p>
              </div>
              <p className="font-black text-[var(--app-danger)] ">{formatMAD(payment.amount)}</p>
              <span className="inline-flex h-9 items-center justify-center rounded-full border border-rose-300/30 bg-rose-500/10 px-3 text-center text-xs font-black text-[var(--app-danger)]">En retard</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
