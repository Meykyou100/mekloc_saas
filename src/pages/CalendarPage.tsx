import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  FileSignature,
  MapPin,
  Plus,
  Phone,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import PlateNumber from '../components/ui/PlateNumber';
import { useData } from '../context/DataContext';
import { formatMAD, type Reservation, type ReservationStatus } from '../data/mockData';

const MOBILE_VEHICLE_COL_WIDTH = 144;
const MOBILE_DAY_COL_WIDTH = 72;
const MOBILE_ROW_HEIGHT = 84;
const VEHICLE_COL_WIDTH = 260;
const DAY_COL_WIDTH = 118;
const ROW_HEIGHT = 112;
const BLOCK_HEIGHT = 48;
const DAY_OPTIONS = [7, 14, 30];
const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

type CalendarBlock = {
  reservation: Reservation;
  startIndex: number;
  endIndex: number;
};

function toDateOnly(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDate(value: Date) {
  const localDate = toDateOnly(value);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKey(value?: string | Date) {
  if (!value) return '';
  if (value instanceof Date) return isoDate(value);
  return value.slice(0, 10);
}

function dateFromKey(value: string) {
  const [year, month, day] = dateKey(value).split('-').map(Number);
  return toDateOnly(new Date(year, (month || 1) - 1, day || 1));
}

function addDays(value: Date, days: number) {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dayDiff(from: Date | string, to: Date | string) {
  const fromDate = from instanceof Date ? toDateOnly(from) : dateFromKey(from);
  const toDate = to instanceof Date ? toDateOnly(to) : dateFromKey(to);
  const fromUtc = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const toUtc = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

function formatCalendarDate(value: Date | string) {
  const date = value instanceof Date ? toDateOnly(value) : dateFromKey(value);
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS_FR[date.getMonth()]}`;
}

function reservationLabel(status: ReservationStatus) {
  if (status === 'Active') return 'Active';
  if (status === 'Confirmed') return 'Confirmée';
  if (status === 'Completed') return 'Terminée';
  return 'Annulée';
}

function blockClass(reservation: Reservation, dayIso: string) {
  if (dateKey(reservation.pickupDate) === dayIso) {
    return 'border-amber-300/60 bg-gradient-to-r from-amber-500/35 to-amber-500/18 text-amber-50 light:text-amber-900';
  }
  if (dateKey(reservation.returnDate) === dayIso) {
    return 'border-cyan-300/55 bg-gradient-to-r from-cyan-500/30 to-teal-500/18 text-cyan-50 light:text-cyan-900';
  }
  return 'border-emerald-300/35 bg-gradient-to-r from-emerald-500/30 to-emerald-500/14 text-white light:text-emerald-900';
}

type CellState = 'available' | 'reserved' | 'maintenance' | 'departure_today' | 'return_today';

function stateLabel(state: CellState) {
  if (state === 'maintenance') return 'Maintenance';
  if (state === 'departure_today') return "Départ aujourd'hui";
  if (state === 'return_today') return "Retour aujourd'hui";
  if (state === 'reserved') return 'Réservé';
  return 'Disponible';
}

function cellClass(state: CellState) {
  if (state === 'maintenance') return 'bg-violet-500/10 hover:bg-violet-500/16';
  if (state === 'departure_today') return 'bg-amber-500/12 hover:bg-amber-500/20';
  if (state === 'return_today') return 'bg-cyan-500/12 hover:bg-cyan-500/20';
  if (state === 'reserved') return 'bg-sky-500/[0.045] hover:bg-sky-500/[0.08]';
  return 'bg-emerald-500/[0.045] hover:bg-emerald-500/[0.10]';
}

function isArchivedVehicle(vehicle: { archivedAt?: string; status: string }) {
  return Boolean(vehicle.archivedAt || vehicle.status.toLowerCase() === 'archived');
}

function vehicleStatusLabel(status: string, archived?: boolean) {
  if (archived) return 'Archivé';
  if (status === 'Available') return 'Disponible';
  if (status === 'Rented') return 'Réservé';
  if (status === 'Maintenance') return 'Maintenance';
  if (status === 'Unavailable') return 'Indisponible';
  return status;
}

function vehicleStatusClass(status: string, archived?: boolean) {
  if (archived) return 'border-carbon-500/30 bg-[var(--app-surface-soft)] text-[var(--app-text-muted)]';
  if (status === 'Available') return 'border-emerald-300/30 bg-emerald-500/12 text-emerald-200 light:text-emerald-700';
  if (status === 'Rented') return 'border-sky-300/30 bg-sky-500/12 text-sky-200 light:text-sky-700';
  if (status === 'Maintenance') return 'border-violet-300/30 bg-violet-500/12 text-violet-200 light:text-violet-700';
  return 'border-amber-300/30 bg-amber-500/12 text-amber-100 light:text-amber-700';
}

function formatMoroccoTel(phone?: string) {
  const cleaned = (phone || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+212')) return cleaned;
  if (cleaned.startsWith('00212')) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith('212')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+212${cleaned.slice(1)}`;
  return cleaned.startsWith('+') ? cleaned : `+212${cleaned}`;
}

export default function CalendarPage() {
  const { vehicles, reservations, maintenance, clients, loading } = useData();
  const navigate = useNavigate();
  const [daysToShow, setDaysToShow] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 7 : 14));
  const [windowStart, setWindowStart] = useState(() => toDateOnly(new Date()));
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState(() => isoDate(new Date()));
  const [showArchived, setShowArchived] = useState(false);

  const todayIso = isoDate(new Date());
  const days = useMemo(
    () => Array.from({ length: daysToShow }, (_, index) => addDays(windowStart, index)),
    [daysToShow, windowStart],
  );

  const firstDayIso = days[0] ? isoDate(days[0]) : todayIso;
  const lastDayIso = days[days.length - 1] ? isoDate(days[days.length - 1]) : todayIso;
  const timelineWidth = days.length * DAY_COL_WIDTH;
  const archivedVehicleCount = vehicles.filter(isArchivedVehicle).length;
  const visibleVehicles = useMemo(
    () => vehicles.filter((vehicle) => (showArchived ? isArchivedVehicle(vehicle) : !isArchivedVehicle(vehicle))),
    [showArchived, vehicles],
  );
  const visibleVehicleIds = useMemo(() => new Set(visibleVehicles.map((vehicle) => vehicle.id)), [visibleVehicles]);
  const vehiclesById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const hasData = visibleVehicles.length > 0;

  const reservationBlocksByVehicle = useMemo(() => {
    const grouped = new Map<string, CalendarBlock[]>();
    reservations
      .filter((reservation) => reservation.status === 'Confirmed' || reservation.status === 'Active')
      .filter((reservation) => visibleVehicleIds.has(reservation.vehicleId))
      .forEach((reservation) => {
        const pickupIso = dateKey(reservation.pickupDate);
        const returnIso = dateKey(reservation.returnDate);
        if (returnIso < firstDayIso || pickupIso > lastDayIso) return;
        const startIndex = Math.max(0, dayDiff(windowStart, pickupIso));
        const endIndex = Math.min(days.length - 1, dayDiff(windowStart, returnIso));
        if (endIndex < 0 || startIndex >= days.length || endIndex < startIndex) return;
        const current = grouped.get(reservation.vehicleId) || [];
        current.push({ reservation, startIndex, endIndex });
        grouped.set(reservation.vehicleId, current);
      });

    grouped.forEach((blocks) => {
      blocks.sort((a, b) => a.startIndex - b.startIndex);
    });

    return grouped;
  }, [days.length, firstDayIso, lastDayIso, reservations, visibleVehicleIds, windowStart]);

  const maintenanceDatesByVehicle = useMemo(() => {
    const grouped = new Map<string, Set<string>>();
    maintenance.forEach((item) => {
      if (!visibleVehicleIds.has(item.vehicleId)) return;
      const dateIso = item.nextServiceDate?.slice(0, 10);
      if (!dateIso) return;
      if (!grouped.has(item.vehicleId)) grouped.set(item.vehicleId, new Set());
      grouped.get(item.vehicleId)!.add(dateIso);
    });
    return grouped;
  }, [maintenance, visibleVehicleIds]);

  const activeReservationsInWindow = useMemo(() => {
    return reservations
      .filter((reservation) => reservation.status === 'Confirmed' || reservation.status === 'Active')
      .filter((reservation) => visibleVehicleIds.has(reservation.vehicleId));
  }, [reservations, visibleVehicleIds]);

  const selectedDate = useMemo(() => dateFromKey(selectedDayIso), [selectedDayIso]);
  const selectedDateLabel = useMemo(() => {
    return selectedDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDate]);

  const dayDetails = useMemo(() => {
    const departures = activeReservationsInWindow.filter((reservation) => dateKey(reservation.pickupDate) === selectedDayIso);
    const returns = activeReservationsInWindow.filter((reservation) => dateKey(reservation.returnDate) === selectedDayIso);
    const active = activeReservationsInWindow.filter(
      (reservation) => dateKey(reservation.pickupDate) <= selectedDayIso && dateKey(reservation.returnDate) >= selectedDayIso,
    );
    const maintenanceItems = maintenance.filter((item) => {
      if (!visibleVehicleIds.has(item.vehicleId)) return false;
      return item.nextServiceDate?.slice(0, 10) === selectedDayIso || vehiclesById.get(item.vehicleId)?.status === 'Maintenance';
    });
    return { departures, returns, active, maintenanceItems };
  }, [activeReservationsInWindow, maintenance, selectedDayIso, vehiclesById, visibleVehicleIds]);

  const calendarStats = useMemo(() => {
    const activeVehicles = visibleVehicles.filter((vehicle) => !isArchivedVehicle(vehicle)).length;
    const reservationsToday = activeReservationsInWindow.filter(
      (reservation) => dateKey(reservation.pickupDate) <= todayIso && dateKey(reservation.returnDate) >= todayIso,
    ).length;
    const returnsToday = activeReservationsInWindow.filter((reservation) => dateKey(reservation.returnDate) === todayIso).length;
    const maintenanceCount = visibleVehicles.filter((vehicle) => vehicle.status === 'Maintenance').length;
    const occupiedVehicleIds = new Set(
      activeReservationsInWindow
        .filter((reservation) => dateKey(reservation.pickupDate) <= todayIso && dateKey(reservation.returnDate) >= todayIso)
        .map((reservation) => reservation.vehicleId),
    );
    const occupancy = activeVehicles ? Math.round((occupiedVehicleIds.size / activeVehicles) * 100) : 0;
    return { activeVehicles, reservationsToday, returnsToday, maintenanceCount, occupancy };
  }, [activeReservationsInWindow, todayIso, visibleVehicles]);

  const dateRangeLabel = useMemo(() => {
    if (!days.length) return 'Période actuelle';
    return `${formatCalendarDate(days[0])} → ${formatCalendarDate(days[days.length - 1])}`;
  }, [days]);

  const goToReservationCreate = (vehicleId: string, dateIso: string) => {
    const returnDate = isoDate(addDays(dateFromKey(dateIso), 1));
    navigate(
      `/reservations?create=1&vehicleId=${encodeURIComponent(vehicleId)}&pickup=${encodeURIComponent(dateIso)}&return=${encodeURIComponent(returnDate)}`,
    );
  };

  const getCellState = (vehicleId: string, dayIso: string, blocks: CalendarBlock[]): CellState => {
    const activeReservation = blocks.find(
      (block) => dateKey(block.reservation.pickupDate) <= dayIso && dateKey(block.reservation.returnDate) >= dayIso,
    );
    const isMaintenanceDay =
      maintenanceDatesByVehicle.get(vehicleId)?.has(dayIso) ||
      vehicles.find((vehicle) => vehicle.id === vehicleId)?.status === 'Maintenance';

    if (activeReservation && dateKey(activeReservation.reservation.pickupDate) === dayIso) return 'departure_today';
    if (activeReservation && dateKey(activeReservation.reservation.returnDate) === dayIso) return 'return_today';
    if (isMaintenanceDay) return 'maintenance';
    if (activeReservation) return 'reserved';
    return 'available';
  };

  return (
    <section className="relative overflow-x-hidden pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-8">
      <div className="pointer-events-none absolute right-[-24%] top-5 h-64 w-64 rounded-full bg-[#D4A017]/10 blur-3xl" />
      <div className="md:hidden">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--app-gold-text)]">PLANIFICATION</p>
            <h1 className="mt-2 text-[1.85rem] font-black leading-none tracking-tight text-[var(--app-text)]">Calendrier</h1>
            <p className="mt-2 max-w-[230px] text-[13px] leading-5 text-[var(--app-text-soft)]">
              Planifiez et suivez votre flotte en temps réel.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-2.5 text-xs font-black text-[var(--app-text)] shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur"
              onClick={() => {
                const today = toDateOnly(new Date());
                setWindowStart(today);
                setSelectedDayIso(isoDate(today));
              }}
            >
              <RefreshCcw className="h-3.5 w-3.5 text-[var(--app-gold-text)]" />
              Aujourd’hui
            </button>
            <button
              type="button"
              aria-label="Nouvelle réservation"
              className="grid h-9 w-9 place-items-center rounded-xl bg-[#D4A017] text-black shadow-[0_0_24px_rgba(212,160,23,0.32)] transition active:scale-95"
              onClick={() => navigate('/reservations')}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <PageHeader
          eyebrow="PLANIFICATION"
          title="Calendrier"
          description="Planifiez et suivez votre flotte en temps réel. Optimisez chaque réservation, chaque kilomètre."
          action={
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Button
                variant="secondary"
                icon={<RefreshCcw className="h-4 w-4" />}
                className="w-full rounded-2xl sm:w-auto"
                onClick={() => {
                  const today = toDateOnly(new Date());
                  setWindowStart(today);
                  setSelectedDayIso(isoDate(today));
                }}
              >
                Aujourd’hui
              </Button>
              <Button className="w-full rounded-2xl shadow-[0_0_34px_rgba(212,160,23,0.18)] sm:w-auto" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/reservations')}>
                Nouvelle réservation
              </Button>
            </div>
          }
        />
      </div>

      <div className="no-scrollbar relative -mx-4 mb-3 flex gap-2.5 overflow-x-auto px-4 pb-1 md:mx-0 md:mb-6 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-5">
        {[
          { label: 'Véhicules', value: String(calendarStats.activeVehicles), helper: 'Dans votre flotte', icon: Car, tone: 'text-emerald-200 light:text-emerald-700', glow: 'from-emerald-400/14' },
          { label: 'Réserv.', value: String(calendarStats.reservationsToday), helper: 'Aujourd’hui', icon: CalendarDays, tone: 'text-violet-200 light:text-violet-700', glow: 'from-violet-400/14' },
          { label: 'Retours', value: String(calendarStats.returnsToday), helper: 'Aujourd’hui', icon: RefreshCcw, tone: 'text-cyan-200 light:text-cyan-700', glow: 'from-cyan-400/14' },
          { label: 'Maintenance', value: String(calendarStats.maintenanceCount), helper: 'Non disponibles', icon: Wrench, tone: 'text-amber-200 light:text-amber-700', glow: 'from-amber-400/14' },
          { label: 'Occupation', value: `${calendarStats.occupancy}%`, helper: 'Cette semaine', icon: TrendingUp, tone: 'text-sky-200 light:text-sky-700', glow: 'from-sky-400/14' },
        ].map(({ label, value, helper, icon: Icon, tone, glow }) => (
          <div key={label} className="group relative min-h-[118px] min-w-[136px] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[var(--app-shadow)] transition hover:border-[#D4A017]/35 md:min-h-[126px] md:min-w-0 md:rounded-3xl md:p-4">
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${glow} to-transparent opacity-80`} />
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase leading-3 tracking-[0.12em] text-[var(--app-text-muted)]">{label}</p>
                <p className="mt-2 truncate text-[1.7rem] font-black leading-none text-[var(--app-text)] md:text-3xl">{value}</p>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] border border-[#D4A017]/20 bg-[#D4A017]/10 shadow-[0_0_20px_rgba(212,160,23,0.10)] md:h-10 md:w-10">
                <Icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${tone}`} />
              </span>
            </div>
            <div className="relative mt-2.5">
              <p className="truncate text-[11px] font-medium text-[var(--app-text-muted)]">{helper}</p>
              <span className="mt-1.5 block h-1 w-14 rounded-full bg-gradient-to-r from-[#D4A017]/70 via-white/20 to-transparent" />
            </div>
          </div>
        ))}
      </div>

      <Card className="relative mb-3 rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[var(--app-shadow)] md:mb-4 md:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid grid-cols-[minmax(0,1fr)_40px_40px] items-center gap-2 md:flex md:flex-wrap md:gap-2">
            <button type="button" className="focus-ring h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 text-xs font-bold text-[var(--app-text)] md:h-11 md:rounded-2xl md:px-4 md:text-sm">
              Vue semaine
            </button>
            <button
              type="button"
              className="focus-ring grid h-10 w-10 place-items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] transition hover:border-[#D4A017]/30 hover:text-[var(--app-gold-text)] md:h-11 md:w-11 md:rounded-2xl"
              onClick={() => setWindowStart((current) => addDays(current, -daysToShow))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="focus-ring grid h-10 w-10 place-items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] transition hover:border-[#D4A017]/30 hover:text-[var(--app-gold-text)] md:h-11 md:w-11 md:rounded-2xl"
              onClick={() => setWindowStart((current) => addDays(current, daysToShow))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="col-span-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D4A017]/20 bg-[var(--app-gold-soft)] px-3 text-xs font-black text-[var(--app-gold-text)] md:col-span-1 md:h-11 md:rounded-2xl md:px-4 md:text-sm">
              <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4" />
              {dateRangeLabel}
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:items-end">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 md:flex md:flex-wrap md:items-center">
              <button type="button" className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 text-xs font-bold text-[var(--app-text-soft)] transition hover:border-[#D4A017]/30 md:gap-2 md:rounded-2xl">
                <Filter className="h-3.5 w-3.5" />
                Filtres
              </button>
              {archivedVehicleCount > 0 ? (
                <button
                  type="button"
                  className={`focus-ring h-8 rounded-xl border px-2.5 text-xs font-bold transition md:h-10 md:rounded-2xl md:px-3 ${
                    showArchived ? 'border-gold-300/40 bg-gold-400 text-carbon-950' : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] hover:bg-[var(--app-gold-soft)]'
                  }`}
                  onClick={() => setShowArchived((current) => !current)}
                >
                  Afficher archivés
                </button>
              ) : null}
              <div className="flex h-10 min-w-0 items-center gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-0.5 md:rounded-2xl md:p-1">
                {DAY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-black transition md:flex-none md:rounded-xl md:px-3 md:py-2 ${
                      daysToShow === option ? 'bg-[#D4A017] text-carbon-950' : 'text-[var(--app-text-soft)] hover:bg-[var(--app-gold-soft)]'
                    }`}
                    onClick={() => setDaysToShow(option)}
                  >
                    {option} jours
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 text-[10px] leading-4 md:gap-x-3 md:gap-y-2 md:text-xs">
              {[
                ['Disponible', 'bg-emerald-400', 'text-emerald-200 light:text-emerald-700'],
                ['Réservé', 'bg-sky-400', 'text-sky-200 light:text-sky-700'],
                ['Départ aujourd’hui', 'bg-amber-400', 'text-amber-200 light:text-amber-700'],
                ['Retour aujourd’hui', 'bg-cyan-400', 'text-cyan-200 light:text-cyan-700'],
                ['Maintenance', 'bg-violet-400', 'text-violet-200 light:text-violet-700'],
              ].map(([label, dot, text]) => (
                <span key={label} className={`inline-flex items-center gap-2 ${text}`}>
                  <span className={`h-2 w-2 rounded-full ${dot} md:h-2.5 md:w-2.5`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="relative grid gap-4 md:gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-0 shadow-[var(--app-shadow)]">
          {loading ? (
            <div className="space-y-3 p-5">
              <div className="h-24 animate-pulse rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />
              <div className="h-24 animate-pulse rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />
              <div className="h-24 animate-pulse rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />
            </div>
          ) : !hasData ? (
            <div className="p-6">
              <EmptyState
                icon={Car}
                title="Aucun véhicule dans votre flotte"
                message="Ajoutez un véhicule pour commencer la planification."
                action="Ajouter un véhicule"
                onAction={() => navigate('/vehicles')}
              />
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-3 md:px-5 md:py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--app-text-muted)] md:text-xs md:tracking-[0.22em]">Planning flotte</p>
                    <h2 className="mt-1 text-[1rem] font-black text-[var(--app-text)] md:text-lg">Vue hebdomadaire des véhicules</h2>
                  </div>
                  <p className="text-[11px] text-[var(--app-text-muted)] md:text-sm">{visibleVehicles.length} véhicule{visibleVehicles.length > 1 ? 's' : ''} affiché{visibleVehicles.length > 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="p-0 md:hidden">
                <div className="no-scrollbar overflow-x-auto">
                  <div className="min-w-max">
                    <div className="flex border-t border-[var(--app-border)] bg-[var(--app-card)]">
                      <div
                        className="sticky left-0 z-30 flex h-[54px] shrink-0 items-center border-r border-[var(--app-border)] bg-[var(--app-card)] px-3 shadow-[10px_0_24px_rgba(0,0,0,.18)] backdrop-blur"
                        style={{ width: MOBILE_VEHICLE_COL_WIDTH }}
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--app-text-soft)]">VÉHICULES</p>
                      </div>

                      <div
                        className="grid h-[54px] border-l border-[var(--app-border)] bg-[var(--app-card)]"
                        style={{
                          width: days.length * MOBILE_DAY_COL_WIDTH,
                          gridTemplateColumns: `repeat(${days.length}, ${MOBILE_DAY_COL_WIDTH}px)`,
                        }}
                      >
                        {days.map((day) => {
                          const dayIso = isoDate(day);
                          const isToday = dayIso === todayIso;
                          const isSelected = dayIso === selectedDayIso;
                          return (
                            <button
                              type="button"
                              key={`mobile-header-${dayIso}`}
                              onClick={() => setSelectedDayIso(dayIso)}
                              className={`relative flex h-full flex-col items-center justify-center border-l border-[var(--app-border)] text-center transition first:border-l-0 ${
                                isToday || isSelected ? 'bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]' : 'text-[var(--app-text-soft)] active:bg-[var(--app-surface-soft)]'
                              }`}
                            >
                              {isToday ? <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#F5C542] shadow-[0_0_14px_rgba(245,197,66,.65)]" /> : null}
                              <p className="text-[10px] font-bold capitalize leading-4">{day.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</p>
                              <p className="text-[15px] font-black leading-4">{String(day.getDate()).padStart(2, '0')}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {visibleVehicles.map((vehicle, rowIndex) => {
                      const blocks = reservationBlocksByVehicle.get(vehicle.id) || [];
                      const maintenanceDays = days
                        .map((day, dayIndex) => ({ dayIso: isoDate(day), dayIndex }))
                        .filter(({ dayIso }) => maintenanceDatesByVehicle.get(vehicle.id)?.has(dayIso) || vehicle.status === 'Maintenance');
                      return (
                        <div key={`mobile-timeline-${vehicle.id}`} className="flex border-t border-[var(--app-border)] first:border-t-0">
                          <div
                            className="sticky left-0 z-20 shrink-0 bg-[var(--app-card)] px-2 py-2 shadow-[10px_0_24px_rgba(0,0,0,.18)] backdrop-blur"
                            style={{ width: MOBILE_VEHICLE_COL_WIDTH, minHeight: MOBILE_ROW_HEIGHT }}
                          >
                            <div className="flex gap-2">
                              <div className="grid h-11 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]">
                                {vehicle.imageUrl ? (
                                  <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                ) : (
                                  <Car className="h-4 w-4 text-[var(--app-gold-text)]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-black text-[var(--app-text)]">{vehicle.brand} {vehicle.model}</p>
                                <p className="mt-0.5 truncate text-[10px] text-[var(--app-text-muted)]"><PlateNumber value={vehicle.plate} /></p>
                                <span className={`mt-1 inline-flex max-w-full rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${vehicleStatusClass(vehicle.status, isArchivedVehicle(vehicle))}`}>
                                  {vehicleStatusLabel(vehicle.status, isArchivedVehicle(vehicle))}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div
                            className="relative border-l border-[var(--app-border)] bg-[linear-gradient(90deg,var(--app-border)_1px,transparent_1px)]"
                            style={{
                              width: days.length * MOBILE_DAY_COL_WIDTH,
                              minHeight: MOBILE_ROW_HEIGHT,
                              backgroundSize: `${MOBILE_DAY_COL_WIDTH}px 100%`,
                            }}
                          >
                            {days.map((day) => {
                              const dayIso = isoDate(day);
                              const isToday = dayIso === todayIso;
                              return isToday ? (
                                <span
                                  key={`mobile-today-${vehicle.id}-${dayIso}`}
                                  className="absolute inset-y-0 z-0 w-px bg-[#F5C542]/80 shadow-[0_0_20px_rgba(245,197,66,.9)]"
                                  style={{ left: days.findIndex((candidate) => isoDate(candidate) === dayIso) * MOBILE_DAY_COL_WIDTH }}
                                />
                              ) : null;
                            })}

                            {days.map((day, dayIndex) => {
                              const dayIso = isoDate(day);
                              const blocksForDay = blocks;
                              const cellState = getCellState(vehicle.id, dayIso, blocksForDay);
                              if (cellState !== 'available') return null;
                              return (
                                <button
                                  key={`mobile-create-${vehicle.id}-${dayIso}`}
                                  type="button"
                                  className="absolute inset-y-0 z-0 opacity-0"
                                  style={{ left: dayIndex * MOBILE_DAY_COL_WIDTH, width: MOBILE_DAY_COL_WIDTH }}
                                  onClick={() => {
                                    setSelectedDayIso(dayIso);
                                    goToReservationCreate(vehicle.id, dayIso);
                                  }}
                                  aria-label={`Créer réservation ${vehicle.brand} ${vehicle.model} ${dayIso}`}
                                />
                              );
                            })}

                            {blocks.map((block) => {
                              const spanDays = block.endIndex - block.startIndex + 1;
                              const left = block.startIndex * MOBILE_DAY_COL_WIDTH + 6;
                              const width = Math.max(128, spanDays * MOBILE_DAY_COL_WIDTH - 12);
                              const startDayIso = isoDate(addDays(windowStart, block.startIndex));
                              return (
                                <button
                                  key={`mobile-block-${vehicle.id}-${block.reservation.id}`}
                                  className={`absolute top-3 z-10 rounded-xl border px-2.5 py-2 text-left shadow-[0_12px_22px_rgba(0,0,0,.38)] transition active:scale-[0.98] ${blockClass(block.reservation, startDayIso)}`}
                                  style={{ left, width, minHeight: 50 }}
                                  onClick={() => {
                                    setSelectedReservation(block.reservation);
                                    setSelectedDayIso(dateKey(block.reservation.pickupDate));
                                  }}
                                >
                                  <span className="block truncate text-[11px] font-black">{block.reservation.id} · {block.reservation.client}</span>
                                  <span className="mt-1 block truncate text-[11px] opacity-85">
                                    {formatCalendarDate(block.reservation.pickupDate)} → {formatCalendarDate(block.reservation.returnDate)}
                                  </span>
                                </button>
                              );
                            })}

                            {maintenanceDays.slice(0, 1).map(({ dayIndex, dayIso }) => (
                              <button
                                key={`mobile-maintenance-${vehicle.id}-${dayIso}-${rowIndex}`}
                                className="absolute top-3 z-10 rounded-xl border border-violet-300/35 bg-gradient-to-r from-violet-500/30 to-sky-500/18 px-2.5 py-2 text-left text-violet-50 shadow-[0_12px_22px_rgba(0,0,0,.28)] light:text-violet-900"
                                style={{ left: dayIndex * MOBILE_DAY_COL_WIDTH + 6, width: Math.max(128, MOBILE_DAY_COL_WIDTH * 2 - 12), minHeight: 50 }}
                                onClick={() => setSelectedDayIso(dayIso)}
                              >
                                <span className="block truncate text-xs font-black">Maintenance programmée</span>
                                <span className="mt-1 block truncate text-[11px] opacity-85">{formatCalendarDate(dayIso)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="hidden overflow-x-auto pb-3 md:block">
                <div className="min-w-max">
                  <div className="sticky top-0 z-20 flex">
                    <div
                      className="sticky left-0 z-30 flex h-16 shrink-0 items-center rounded-tl-3xl border border-[var(--app-border)] bg-[var(--app-card)] px-5 backdrop-blur"
                      style={{ width: VEHICLE_COL_WIDTH }}
                    >
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--app-text-soft)]">Véhicules</p>
                    </div>

                    <div className="flex rounded-tr-3xl border border-l-0 border-[var(--app-border)] bg-[var(--app-card)] backdrop-blur">
                      {days.map((day) => {
                        const dayIso = isoDate(day);
                        const isToday = dayIso === todayIso;
                        const isSelected = dayIso === selectedDayIso;
                        return (
                          <button
                            type="button"
                            key={dayIso}
                            onClick={() => setSelectedDayIso(dayIso)}
                            className={`relative flex h-16 shrink-0 flex-col items-center justify-center border-l border-[var(--app-border)] px-1 text-center transition ${
                              isToday || isSelected ? 'bg-[var(--app-gold-soft)] text-[var(--app-gold-text)]' : 'text-[var(--app-text-soft)] hover:bg-[var(--app-surface-soft)]'
                            }`}
                            style={{ width: DAY_COL_WIDTH }}
                          >
                            {isToday ? <span className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-[#F5C542] shadow-[0_0_18px_rgba(245,197,66,.7)]" /> : null}
                            <p className="text-[10px] uppercase tracking-[0.14em]">
                              {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                            </p>
                            <p className="mt-0.5 text-lg font-black">{String(day.getDate()).padStart(2, '0')}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {visibleVehicles.map((vehicle, rowIndex) => {
                    const blocks = reservationBlocksByVehicle.get(vehicle.id) || [];
                    return (
                      <div key={vehicle.id} className="flex">
                        <div
                          className={`sticky left-0 z-10 shrink-0 border border-t-0 border-[var(--app-border)] bg-[var(--app-card)] px-4 py-3 backdrop-blur ${
                            rowIndex === visibleVehicles.length - 1 ? 'rounded-bl-3xl' : ''
                          }`}
                          style={{ width: VEHICLE_COL_WIDTH, minHeight: ROW_HEIGHT }}
                        >
                          <div className="flex gap-3">
                            <div className="grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]">
                              {vehicle.imageUrl ? (
                                <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                              ) : (
                                <Car className="h-6 w-6 text-[var(--app-gold-text)]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[var(--app-text)]">
                                {vehicle.brand} {vehicle.model}
                              </p>
                              <p className="mt-1 text-xs text-[var(--app-text-muted)]"><PlateNumber value={vehicle.plate} /></p>
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--app-text-soft)]">
                                <MapPin className="h-3.5 w-3.5" />
                                <span className="truncate">{vehicle.city || 'Ville non renseignée'}</span>
                              </div>
                              <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${vehicleStatusClass(vehicle.status, isArchivedVehicle(vehicle))}`}>
                                {vehicleStatusLabel(vehicle.status, isArchivedVehicle(vehicle))}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`relative border border-l-0 border-t-0 border-[var(--app-border)] ${
                            rowIndex === visibleVehicles.length - 1 ? 'rounded-br-3xl' : ''
                          }`}
                          style={{ width: timelineWidth, minHeight: ROW_HEIGHT }}
                        >
                          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${days.length}, ${DAY_COL_WIDTH}px)` }}>
                            {days.map((day) => {
                              const dayIso = isoDate(day);
                              const cellState = getCellState(vehicle.id, dayIso, blocks);
                              const label = stateLabel(cellState);
                              const canCreate = cellState === 'available';
                              const isToday = dayIso === todayIso;

                              return (
                                <button
                                  key={`${vehicle.id}-${dayIso}`}
                                  className={`group relative h-full border-l border-[var(--app-border)] px-2 py-2 text-left transition first:border-l-0 ${cellClass(cellState)} ${
                                    canCreate ? 'cursor-pointer' : 'cursor-default'
                                  }`}
                                  onClick={() => {
                                    setSelectedDayIso(dayIso);
                                    if (!canCreate) return;
                                    goToReservationCreate(vehicle.id, dayIso);
                                  }}
                                >
                                  {isToday ? <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#F5C542]/70 shadow-[0_0_18px_rgba(245,197,66,.8)]" /> : null}
                                  <span className="pointer-events-none absolute bottom-2 left-2 text-[10px] font-semibold text-[var(--app-text-muted)] opacity-0 transition group-hover:opacity-100">
                                    {label}
                                  </span>
                                  {cellState === 'maintenance' ? (
                                    <span className="absolute right-2 top-2 text-violet-200 light:text-violet-700">
                                      <Wrench className="h-3.5 w-3.5" />
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>

                          {blocks.map((block) => {
                            const spanDays = block.endIndex - block.startIndex + 1;
                            const left = block.startIndex * DAY_COL_WIDTH + 6;
                            const width = spanDays * DAY_COL_WIDTH - 12;
                            const startDayIso = isoDate(addDays(windowStart, block.startIndex));
                            const compact = spanDays <= 1;
                            return (
                              <button
                                key={`${vehicle.id}-${block.reservation.id}`}
                                className={`absolute top-4 z-10 rounded-2xl border px-3 py-2 text-left text-xs font-semibold shadow-[0_12px_26px_rgba(0,0,0,0.42)] transition hover:scale-[1.01] hover:brightness-110 ${blockClass(block.reservation, startDayIso)}`}
                                style={{ left, width, minHeight: BLOCK_HEIGHT }}
                                onClick={() => {
                                  setSelectedReservation(block.reservation);
                                  setSelectedDayIso(dateKey(block.reservation.pickupDate));
                                }}
                                title={`${block.reservation.id} • ${block.reservation.client}`}
                              >
                                <span className="block truncate">{compact ? block.reservation.id : `${block.reservation.id} • ${block.reservation.client}`}</span>
                                {!compact ? (
                                  <span className="mt-0.5 block truncate text-[10px] opacity-85">
                                    {reservationLabel(block.reservation.status)} • {formatMAD(block.reservation.totalAmount ?? 0)}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </Card>

        <Card className="rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[var(--app-shadow)] md:p-5 2xl:sticky 2xl:top-24 2xl:self-start">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--app-gold-text)] md:text-xs">Détails du jour</p>
              <h2 className="mt-1.5 text-base font-black capitalize text-[var(--app-text)] md:mt-2 md:text-xl">{selectedDateLabel}</h2>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#D4A017]/20 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)] md:h-11 md:w-11 md:rounded-2xl">
              <CalendarDays className="h-4 w-4 md:h-5 md:w-5" />
            </span>
          </div>

          <div className="mt-4 space-y-3 md:mt-5 md:space-y-5">
            {[
              { title: 'Départs aujourd’hui', items: dayDetails.departures, tone: 'text-amber-200 light:text-amber-700', badge: 'Départ' },
              { title: 'Retours aujourd’hui', items: dayDetails.returns, tone: 'text-cyan-200 light:text-cyan-700', badge: 'Retour' },
              { title: 'Réservations actives', items: dayDetails.active, tone: 'text-emerald-200 light:text-emerald-700', badge: 'Actif' },
            ].map(({ title, items, tone, badge }) => (
              <div key={title}>
                <div className="mb-2 flex items-center justify-between">
                  <p className={`text-[13px] font-black md:text-sm ${tone}`}>{title}</p>
                  <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-2 py-0.5 text-xs font-bold text-[var(--app-text-soft)]">{items.length}</span>
                </div>
                {items.length ? (
                  <div className="space-y-2">
                    {items.slice(0, 3).map((reservation) => {
                      const vehicle = vehiclesById.get(reservation.vehicleId);
                      const client = clients.find((item) => item.id === reservation.clientId) ||
                        clients.find((item) => item.fullName.trim().toLowerCase() === reservation.client.trim().toLowerCase());
                      const phoneHref = formatMoroccoTel(client?.phone);
                      return (
                        <button
                          key={`${title}-${reservation.id}`}
                          type="button"
                          onClick={() => setSelectedReservation(reservation)}
                          className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-left transition hover:border-[#D4A017]/30 hover:bg-[var(--app-gold-soft)]"
                        >
                          <div className="flex gap-3">
                            <div className="grid h-11 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]">
                              {vehicle?.imageUrl ? <img src={vehicle.imageUrl} alt={reservation.vehicle} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <Car className="h-5 w-5 text-[var(--app-gold-text)]" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-[13px] font-black text-[var(--app-text)] md:text-sm">{reservation.vehicle}</p>
                                  <p className="truncate text-xs text-[var(--app-text-muted)]">{vehicle?.plate ? <PlateNumber value={vehicle.plate} /> : reservation.id}</p>
                                </div>
                                <span className="rounded-full border border-[#D4A017]/30 bg-[var(--app-gold-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--app-gold-text)]">{badge}</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--app-text-muted)]">
                                <span className="inline-flex items-center gap-1">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {badge === 'Retour' ? reservation.returnTime || 'Heure non renseignée' : reservation.pickupTime || 'Heure non renseignée'}
                                </span>
                                <span className="truncate">{reservation.client}</span>
                              </div>
                            </div>
                            <span
                              role="link"
                              tabIndex={phoneHref ? 0 : -1}
                              title={phoneHref ? `Appeler ${client?.phone || phoneHref}` : 'Téléphone indisponible'}
                              aria-label={phoneHref ? `Appeler ${reservation.client}` : 'Téléphone indisponible'}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (phoneHref) window.location.href = `tel:${phoneHref}`;
                              }}
                              onKeyDown={(event) => {
                                if (!phoneHref) return;
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  window.location.href = `tel:${phoneHref}`;
                                }
                              }}
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition ${
                                phoneHref
                                  ? 'border-gold-300/20 bg-[var(--app-gold-soft)] text-[var(--app-gold-text)] hover:border-gold-300/45 hover:bg-gold-400/15'
                                  : 'cursor-not-allowed border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-muted)]'
                              }`}
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-[13px] text-[var(--app-text-muted)] md:text-sm">Aucun mouvement prévu.</p>
                )}
              </div>
            ))}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-black text-violet-200 light:text-violet-700 md:text-sm">Maintenance</p>
                <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-2 py-0.5 text-xs font-bold text-[var(--app-text-soft)]">{dayDetails.maintenanceItems.length}</span>
              </div>
              {dayDetails.maintenanceItems.length ? (
                <div className="space-y-2">
                  {dayDetails.maintenanceItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-3">
                      <p className="text-sm font-black text-[var(--app-text)]">{item.vehicle}</p>
                      <p className="mt-1 text-xs text-[var(--app-text-muted)]">{item.serviceType} • {item.providerName || 'Garage non renseigné'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm text-[var(--app-text-muted)]">Aucune maintenance prévue.</p>
              )}
            </div>

            {!dayDetails.departures.length && !dayDetails.returns.length && !dayDetails.active.length && !dayDetails.maintenanceItems.length ? (
              <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-center md:p-5">
                <ShieldCheck className="mx-auto h-8 w-8 text-[var(--app-gold-text)]" />
                <p className="mt-3 text-sm font-black text-[var(--app-text)] md:text-base">Aucun mouvement prévu aujourd’hui.</p>
                <p className="mt-1 text-xs text-[var(--app-text-muted)] md:text-sm">Votre flotte est calme sur cette date.</p>
              </div>
            ) : null}
          </div>

          <Button className="mt-5 w-full rounded-2xl" variant="secondary" onClick={() => navigate(`/reservations?date=${encodeURIComponent(selectedDayIso)}`)}>
            Voir toutes les réservations du jour
          </Button>
        </Card>
      </div>

      <Modal open={Boolean(selectedReservation)} title="Détails de réservation" onClose={() => setSelectedReservation(null)}>
        {selectedReservation ? (
          <div className="space-y-4">
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-[var(--app-text)]">{selectedReservation.id}</p>
                <Badge>{selectedReservation.status}</Badge>
              </div>
              <div className="grid gap-2 text-sm text-[var(--app-text-soft)] sm:grid-cols-2">
                <p className="inline-flex items-center gap-2">
                  <Car className="h-4 w-4 text-[var(--app-text-muted)]" />
                  {selectedReservation.vehicle}
                </p>
                <p className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[var(--app-text-muted)]" />
                  {selectedReservation.pickupDate}{selectedReservation.pickupTime ? ` ${selectedReservation.pickupTime}` : ''} → {selectedReservation.returnDate}{selectedReservation.returnTime ? ` ${selectedReservation.returnTime}` : ''}
                </p>
                <p className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[var(--app-text-muted)]" />
                  {selectedReservation.pickupLocation || 'Lieu départ non renseigné'}
                </p>
                <p className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[var(--app-text-muted)]" />
                  {selectedReservation.returnLocation || 'Lieu retour non renseigné'}
                </p>
              </div>
              <p className="text-sm font-semibold text-[var(--app-gold-text)]">
                Montant total: {formatMAD(selectedReservation.totalAmount ?? selectedReservation.dailyPrice)}
              </p>
            </Card>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                icon={<CalendarDays className="h-4 w-4" />}
                onClick={() => {
                  navigate(`/reservations?focus=${encodeURIComponent(selectedReservation.id)}`);
                  setSelectedReservation(null);
                }}
              >
                Voir réservation
              </Button>
              <Button
                icon={<FileSignature className="h-4 w-4" />}
                onClick={() => {
                  navigate(`/contracts?reservation=${encodeURIComponent(selectedReservation.id)}`);
                  setSelectedReservation(null);
                }}
              >
                Générer contrat
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
