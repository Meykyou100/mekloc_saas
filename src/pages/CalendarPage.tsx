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
  return toDateOnly(value).toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dayDiff(from: Date, to: Date) {
  return Math.floor((toDateOnly(to).getTime() - toDateOnly(from).getTime()) / 86_400_000);
}

function formatCalendarDate(value: Date) {
  return `${String(value.getDate()).padStart(2, '0')} ${MONTHS_FR[value.getMonth()]}`;
}

function reservationLabel(status: ReservationStatus) {
  if (status === 'Active') return 'Active';
  if (status === 'Confirmed') return 'Confirmée';
  if (status === 'Completed') return 'Terminée';
  return 'Annulée';
}

function blockClass(reservation: Reservation, dayIso: string) {
  if (reservation.pickupDate === dayIso) {
    return 'border-amber-300/60 bg-gradient-to-r from-amber-500/35 to-amber-500/18 text-amber-50';
  }
  if (reservation.returnDate === dayIso) {
    return 'border-cyan-300/55 bg-gradient-to-r from-cyan-500/30 to-teal-500/18 text-cyan-50';
  }
  return 'border-emerald-300/35 bg-gradient-to-r from-emerald-500/30 to-emerald-500/14 text-white';
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
  if (archived) return 'border-carbon-500/30 bg-white/5 text-carbon-300';
  if (status === 'Available') return 'border-emerald-300/30 bg-emerald-500/12 text-emerald-200';
  if (status === 'Rented') return 'border-sky-300/30 bg-sky-500/12 text-sky-200';
  if (status === 'Maintenance') return 'border-violet-300/30 bg-violet-500/12 text-violet-200';
  return 'border-amber-300/30 bg-amber-500/12 text-amber-100';
}

export default function CalendarPage() {
  const { vehicles, reservations, maintenance, loading } = useData();
  const navigate = useNavigate();
  const [daysToShow, setDaysToShow] = useState(14);
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
        if (reservation.returnDate < firstDayIso || reservation.pickupDate > lastDayIso) return;
        const startIndex = Math.max(0, dayDiff(windowStart, new Date(reservation.pickupDate)));
        const endIndex = Math.min(days.length - 1, dayDiff(windowStart, new Date(reservation.returnDate)));
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

  const selectedDate = useMemo(() => toDateOnly(new Date(selectedDayIso)), [selectedDayIso]);
  const selectedDateLabel = useMemo(() => {
    return selectedDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDate]);

  const dayDetails = useMemo(() => {
    const departures = activeReservationsInWindow.filter((reservation) => reservation.pickupDate === selectedDayIso);
    const returns = activeReservationsInWindow.filter((reservation) => reservation.returnDate === selectedDayIso);
    const active = activeReservationsInWindow.filter(
      (reservation) => reservation.pickupDate <= selectedDayIso && reservation.returnDate >= selectedDayIso,
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
      (reservation) => reservation.pickupDate <= todayIso && reservation.returnDate >= todayIso,
    ).length;
    const returnsToday = activeReservationsInWindow.filter((reservation) => reservation.returnDate === todayIso).length;
    const maintenanceCount = visibleVehicles.filter((vehicle) => vehicle.status === 'Maintenance').length;
    const occupiedVehicleIds = new Set(
      activeReservationsInWindow
        .filter((reservation) => reservation.pickupDate <= todayIso && reservation.returnDate >= todayIso)
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
    const returnDate = isoDate(addDays(new Date(dateIso), 1));
    navigate(
      `/reservations?create=1&vehicleId=${encodeURIComponent(vehicleId)}&pickup=${encodeURIComponent(dateIso)}&return=${encodeURIComponent(returnDate)}`,
    );
  };

  const getCellState = (vehicleId: string, dayIso: string, blocks: CalendarBlock[]): CellState => {
    const activeReservation = blocks.find(
      (block) => block.reservation.pickupDate <= dayIso && block.reservation.returnDate >= dayIso,
    );
    const isMaintenanceDay =
      maintenanceDatesByVehicle.get(vehicleId)?.has(dayIso) ||
      vehicles.find((vehicle) => vehicle.id === vehicleId)?.status === 'Maintenance';

    if (activeReservation?.reservation.pickupDate === dayIso) return 'departure_today';
    if (activeReservation?.reservation.returnDate === dayIso) return 'return_today';
    if (isMaintenanceDay) return 'maintenance';
    if (activeReservation) return 'reserved';
    return 'available';
  };

  return (
    <section className="relative overflow-x-hidden pb-8">
      <div className="pointer-events-none absolute right-[-18%] top-8 h-80 w-80 rounded-full bg-[#D4A017]/10 blur-3xl" />
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

      <div className="relative mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Véhicules actifs', value: String(calendarStats.activeVehicles), helper: `${visibleVehicles.length} visibles`, icon: Car, tone: 'text-gold-200', glow: 'from-[#D4A017]/18' },
          { label: 'Réservations aujourd’hui', value: String(calendarStats.reservationsToday), helper: 'En cours aujourd’hui', icon: CalendarDays, tone: 'text-sky-200', glow: 'from-sky-400/14' },
          { label: 'Retours aujourd’hui', value: String(calendarStats.returnsToday), helper: `${dayDetails.returns.length} sur le jour sélectionné`, icon: RefreshCcw, tone: 'text-teal-200', glow: 'from-teal-400/14' },
          { label: 'En maintenance', value: String(calendarStats.maintenanceCount), helper: 'Véhicules immobilisés', icon: Wrench, tone: 'text-violet-200', glow: 'from-violet-400/14' },
          { label: 'Taux d’occupation', value: `${calendarStats.occupancy}%`, helper: 'Flotte réservée', icon: TrendingUp, tone: 'text-emerald-200', glow: 'from-emerald-400/14' },
        ].map(({ label, value, helper, icon: Icon, tone, glow }) => (
          <div key={label} className="group relative min-h-[126px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950/90 to-black p-4 shadow-[0_18px_48px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition hover:border-[#D4A017]/35">
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${glow} to-transparent opacity-80`} />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-carbon-500">{label}</p>
                <p className="mt-3 truncate text-3xl font-black text-white">{value}</p>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 shadow-[0_0_28px_rgba(212,160,23,0.12)]">
                <Icon className={`h-5 w-5 ${tone}`} />
              </span>
            </div>
            <div className="relative mt-3 flex items-center justify-between gap-3">
              <p className="truncate text-xs font-medium text-carbon-400">{helper}</p>
              <span className="h-1.5 w-16 rounded-full bg-gradient-to-r from-[#D4A017]/70 via-white/20 to-transparent" />
            </div>
          </div>
        ))}
      </div>

      <Card className="relative mb-5 border-white/10 bg-gradient-to-br from-zinc-950/90 to-black p-4 shadow-[0_18px_46px_rgba(0,0,0,.24)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="focus-ring h-11 rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-bold text-white">
              Vue semaine
            </button>
            <button
              type="button"
              className="focus-ring grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.045] text-carbon-200 transition hover:border-[#D4A017]/30 hover:text-gold-100"
              onClick={() => setWindowStart((current) => addDays(current, -daysToShow))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="focus-ring grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.045] text-carbon-200 transition hover:border-[#D4A017]/30 hover:text-gold-100"
              onClick={() => setWindowStart((current) => addDays(current, daysToShow))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="flex h-11 items-center gap-2 rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 px-4 text-sm font-black text-gold-100">
              <CalendarDays className="h-4 w-4" />
              {dateRangeLabel}
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="focus-ring inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-xs font-bold text-carbon-200 transition hover:border-[#D4A017]/30">
                <Filter className="h-3.5 w-3.5" />
                Filtres
              </button>
              {archivedVehicleCount > 0 ? (
                <button
                  type="button"
                  className={`focus-ring h-10 rounded-2xl border px-3 text-xs font-bold transition ${
                    showArchived ? 'border-gold-300/40 bg-gold-400 text-carbon-950' : 'border-white/10 bg-white/[0.045] text-carbon-300 hover:bg-white/10'
                  }`}
                  onClick={() => setShowArchived((current) => !current)}
                >
                  Afficher archivés
                </button>
              ) : null}
              <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.045] p-1">
                {DAY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                      daysToShow === option ? 'bg-[#D4A017] text-carbon-950' : 'text-carbon-300 hover:bg-white/10'
                    }`}
                    onClick={() => setDaysToShow(option)}
                  >
                    {option} jours
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {[
                ['Disponible', 'bg-emerald-400', 'text-emerald-200'],
                ['Réservé', 'bg-sky-400', 'text-sky-200'],
                ['Départ aujourd’hui', 'bg-amber-400', 'text-amber-200'],
                ['Retour aujourd’hui', 'bg-cyan-400', 'text-cyan-200'],
                ['Maintenance', 'bg-violet-400', 'text-violet-200'],
              ].map(([label, dot, text]) => (
                <span key={label} className={`inline-flex items-center gap-2 ${text}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="relative grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-0 shadow-[0_24px_70px_rgba(0,0,0,.30)]">
          {loading ? (
            <div className="space-y-3 p-5">
              <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
              <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
              <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
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
              <div className="border-b border-white/10 bg-white/[0.025] px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-carbon-500">Planning flotte</p>
                    <h2 className="mt-1 text-lg font-black text-white">Vue hebdomadaire des véhicules</h2>
                  </div>
                  <p className="text-sm text-carbon-400">{visibleVehicles.length} véhicule{visibleVehicles.length > 1 ? 's' : ''} affiché{visibleVehicles.length > 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="space-y-3 p-3 md:hidden">
                <div className="no-scrollbar overflow-x-auto pb-1">
                  <div className="grid min-w-max gap-2" style={{ gridTemplateColumns: `150px repeat(${days.length}, 38px)` }}>
                    <div className="sticky left-0 z-10 rounded-xl border border-white/10 bg-carbon-950/95 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-carbon-400">
                      Véhicule
                    </div>
                    {days.map((day) => {
                      const dayIso = isoDate(day);
                      const isToday = dayIso === todayIso;
                      const isSelected = dayIso === selectedDayIso;
                      return (
                        <button
                          type="button"
                          key={`mobile-head-${dayIso}`}
                          onClick={() => setSelectedDayIso(dayIso)}
                          className={`rounded-xl border px-1 py-2 text-center transition ${isToday || isSelected ? 'border-gold-300/55 bg-gold-400 text-carbon-950' : 'border-white/10 bg-white/[0.04] text-carbon-300'}`}
                        >
                          <p className="text-[9px] font-bold uppercase">{day.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}</p>
                          <p className="text-xs font-black">{String(day.getDate()).padStart(2, '0')}</p>
                        </button>
                      );
                    })}

                    {visibleVehicles.map((vehicle) => {
                      const blocks = reservationBlocksByVehicle.get(vehicle.id) || [];
                      return (
                        <div key={`mobile-row-${vehicle.id}`} className="contents">
                          <div className="sticky left-0 z-10 min-h-[76px] rounded-xl border border-white/10 bg-carbon-950/95 px-3 py-2 shadow-[8px_0_18px_rgba(0,0,0,.35)]">
                            <div className="flex items-center gap-2">
                              <div className="grid h-9 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                {vehicle.imageUrl ? <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} className="h-full w-full object-cover" /> : <Car className="h-4 w-4 text-gold-200" />}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">{vehicle.brand} {vehicle.model}</p>
                                <p className="mt-0.5 truncate text-[11px] text-carbon-400"><PlateNumber value={vehicle.plate} /></p>
                              </div>
                            </div>
                          </div>
                          {days.map((day) => {
                            const dayIso = isoDate(day);
                            const cellState = getCellState(vehicle.id, dayIso, blocks);
                            const isToday = dayIso === todayIso;
                            const canCreate = cellState === 'available';
                            const dotClass =
                              cellState === 'maintenance' ? 'bg-violet-300' :
                              cellState === 'departure_today' ? 'bg-amber-300' :
                              cellState === 'return_today' ? 'bg-cyan-300' :
                              cellState === 'reserved' ? 'bg-sky-300' : 'bg-emerald-300';
                            return (
                              <button
                                key={`mobile-${vehicle.id}-${dayIso}`}
                                className={`grid min-h-[76px] place-items-center rounded-xl border transition ${isToday ? 'border-gold-300/50 bg-gold-400/12' : 'border-white/10 bg-white/[0.035]'} ${canCreate ? 'active:scale-95' : ''}`}
                                onClick={() => {
                                  setSelectedDayIso(dayIso);
                                  if (!canCreate) return;
                                  goToReservationCreate(vehicle.id, dayIso);
                                }}
                                title={stateLabel(cellState)}
                              >
                                <span className={`h-2.5 w-2.5 rounded-full shadow-[0_0_12px_rgba(255,255,255,.18)] ${dotClass}`} />
                              </button>
                            );
                          })}
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
                      className="sticky left-0 z-30 flex h-16 shrink-0 items-center rounded-tl-3xl border border-white/10 bg-carbon-950/95 px-5 backdrop-blur"
                      style={{ width: VEHICLE_COL_WIDTH }}
                    >
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-carbon-300">Véhicules</p>
                    </div>

                    <div className="flex rounded-tr-3xl border border-l-0 border-white/10 bg-carbon-950/95 backdrop-blur">
                      {days.map((day) => {
                        const dayIso = isoDate(day);
                        const isToday = dayIso === todayIso;
                        const isSelected = dayIso === selectedDayIso;
                        return (
                          <button
                            type="button"
                            key={dayIso}
                            onClick={() => setSelectedDayIso(dayIso)}
                            className={`relative flex h-16 shrink-0 flex-col items-center justify-center border-l border-white/10 px-1 text-center transition ${
                              isToday || isSelected ? 'bg-gold-500/16 text-gold-100' : 'text-carbon-200 hover:bg-white/[0.04]'
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
                          className={`sticky left-0 z-10 shrink-0 border border-t-0 border-white/10 bg-carbon-950/98 px-4 py-3 backdrop-blur ${
                            rowIndex === visibleVehicles.length - 1 ? 'rounded-bl-3xl' : ''
                          }`}
                          style={{ width: VEHICLE_COL_WIDTH, minHeight: ROW_HEIGHT }}
                        >
                          <div className="flex gap-3">
                            <div className="grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                              {vehicle.imageUrl ? (
                                <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} className="h-full w-full object-cover" />
                              ) : (
                                <Car className="h-6 w-6 text-gold-200" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">
                                {vehicle.brand} {vehicle.model}
                              </p>
                              <p className="mt-1 text-xs text-carbon-400"><PlateNumber value={vehicle.plate} /></p>
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-carbon-300">
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
                          className={`relative border border-l-0 border-t-0 border-white/10 ${
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
                                  className={`group relative h-full border-l border-white/10 px-2 py-2 text-left transition first:border-l-0 ${cellClass(cellState)} ${
                                    canCreate ? 'cursor-pointer' : 'cursor-default'
                                  }`}
                                  onClick={() => {
                                    setSelectedDayIso(dayIso);
                                    if (!canCreate) return;
                                    goToReservationCreate(vehicle.id, dayIso);
                                  }}
                                >
                                  {isToday ? <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#F5C542]/70 shadow-[0_0_18px_rgba(245,197,66,.8)]" /> : null}
                                  <span className="pointer-events-none absolute bottom-2 left-2 text-[10px] font-semibold text-carbon-400 opacity-0 transition group-hover:opacity-100">
                                    {label}
                                  </span>
                                  {cellState === 'maintenance' ? (
                                    <span className="absolute right-2 top-2 text-violet-200">
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
                                  setSelectedDayIso(block.reservation.pickupDate);
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

        <Card className="border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-5 shadow-[0_24px_70px_rgba(0,0,0,.30)] 2xl:sticky 2xl:top-24 2xl:self-start">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-300">Détails du jour</p>
              <h2 className="mt-2 text-xl font-black capitalize text-white">{selectedDateLabel}</h2>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 text-gold-200">
              <CalendarDays className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-5 space-y-5">
            {[
              { title: 'Départs aujourd’hui', items: dayDetails.departures, tone: 'text-amber-200', badge: 'Départ' },
              { title: 'Retours aujourd’hui', items: dayDetails.returns, tone: 'text-cyan-200', badge: 'Retour' },
              { title: 'Réservations actives', items: dayDetails.active, tone: 'text-emerald-200', badge: 'Actif' },
            ].map(({ title, items, tone, badge }) => (
              <div key={title}>
                <div className="mb-2 flex items-center justify-between">
                  <p className={`text-sm font-black ${tone}`}>{title}</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-bold text-carbon-300">{items.length}</span>
                </div>
                {items.length ? (
                  <div className="space-y-2">
                    {items.slice(0, 3).map((reservation) => {
                      const vehicle = vehiclesById.get(reservation.vehicleId);
                      return (
                        <button
                          key={`${title}-${reservation.id}`}
                          type="button"
                          onClick={() => setSelectedReservation(reservation)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-[#D4A017]/30 hover:bg-white/[0.06]"
                        >
                          <div className="flex gap-3">
                            <div className="grid h-12 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                              {vehicle?.imageUrl ? <img src={vehicle.imageUrl} alt={reservation.vehicle} className="h-full w-full object-cover" /> : <Car className="h-5 w-5 text-gold-200" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-white">{reservation.vehicle}</p>
                                  <p className="truncate text-xs text-carbon-500">{vehicle?.plate ? <PlateNumber value={vehicle.plate} /> : reservation.id}</p>
                                </div>
                                <span className="rounded-full border border-[#D4A017]/30 bg-[#D4A017]/10 px-2 py-0.5 text-[11px] font-bold text-gold-100">{badge}</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-carbon-400">
                                <span className="inline-flex items-center gap-1">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {badge === 'Retour' ? reservation.returnTime || 'Heure non renseignée' : reservation.pickupTime || 'Heure non renseignée'}
                                </span>
                                <span className="truncate">{reservation.client}</span>
                              </div>
                            </div>
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-carbon-300">
                              <Phone className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-sm text-carbon-500">Aucun mouvement prévu.</p>
                )}
              </div>
            ))}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-black text-violet-200">Maintenance</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-bold text-carbon-300">{dayDetails.maintenanceItems.length}</span>
              </div>
              {dayDetails.maintenanceItems.length ? (
                <div className="space-y-2">
                  {dayDetails.maintenanceItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-3">
                      <p className="text-sm font-black text-white">{item.vehicle}</p>
                      <p className="mt-1 text-xs text-carbon-400">{item.serviceType} • {item.providerName || 'Garage non renseigné'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-sm text-carbon-500">Aucune maintenance prévue.</p>
              )}
            </div>

            {!dayDetails.departures.length && !dayDetails.returns.length && !dayDetails.active.length && !dayDetails.maintenanceItems.length ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-gold-200" />
                <p className="mt-3 font-black text-white">Aucun mouvement prévu aujourd’hui.</p>
                <p className="mt-1 text-sm text-carbon-400">Votre flotte est calme sur cette date.</p>
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
                <p className="text-base font-semibold text-white">{selectedReservation.id}</p>
                <Badge>{selectedReservation.status}</Badge>
              </div>
              <div className="grid gap-2 text-sm text-carbon-200 sm:grid-cols-2">
                <p className="inline-flex items-center gap-2">
                  <Car className="h-4 w-4 text-carbon-400" />
                  {selectedReservation.vehicle}
                </p>
                <p className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-carbon-400" />
                  {selectedReservation.pickupDate}{selectedReservation.pickupTime ? ` ${selectedReservation.pickupTime}` : ''} → {selectedReservation.returnDate}{selectedReservation.returnTime ? ` ${selectedReservation.returnTime}` : ''}
                </p>
                <p className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-carbon-400" />
                  {selectedReservation.pickupLocation || 'Lieu départ non renseigné'}
                </p>
                <p className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-carbon-400" />
                  {selectedReservation.returnLocation || 'Lieu retour non renseigné'}
                </p>
              </div>
              <p className="text-sm font-semibold text-gold-200">
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
