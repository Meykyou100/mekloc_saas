import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Car,
  Clock3,
  FileSignature,
  MapPin,
  Plus,
  RefreshCcw,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useData } from '../context/DataContext';
import { formatMAD, type Reservation, type ReservationStatus } from '../data/mockData';

const VEHICLE_COL_WIDTH = 228;
const DAY_COL_WIDTH = 108;
const ROW_HEIGHT = 104;
const BLOCK_HEIGHT = 44;
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
    return 'border-amber-300/60 bg-amber-500/25 text-amber-50';
  }
  if (reservation.returnDate === dayIso) {
    return 'border-cyan-300/55 bg-cyan-500/22 text-cyan-50';
  }
  return 'border-white/20 bg-white/15 text-white';
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
  if (state === 'maintenance') return 'bg-sky-500/12 hover:bg-sky-500/18';
  if (state === 'departure_today') return 'bg-amber-500/12 hover:bg-amber-500/20';
  if (state === 'return_today') return 'bg-cyan-500/12 hover:bg-cyan-500/20';
  if (state === 'reserved') return 'bg-white/[0.04] hover:bg-white/[0.08]';
  return 'bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14]';
}

function isArchivedVehicle(vehicle: { archivedAt?: string; status: string }) {
  return Boolean(vehicle.archivedAt || vehicle.status.toLowerCase() === 'archived');
}

export default function CalendarPage() {
  const { vehicles, reservations, maintenance, loading } = useData();
  const navigate = useNavigate();
  const [daysToShow, setDaysToShow] = useState(14);
  const [windowStart, setWindowStart] = useState(() => toDateOnly(new Date()));
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
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
    <section>
      <PageHeader
        eyebrow="PLANIFICATION"
        title="Calendrier"
        description="Visualisez votre flotte par jour, suivez les réservations et créez rapidement une nouvelle location."
        action={
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button
              variant="secondary"
              icon={<RefreshCcw className="h-4 w-4" />}
              className="w-full sm:w-auto"
              onClick={() => setWindowStart(toDateOnly(new Date()))}
            >
              Aujourd’hui
            </Button>
            <Button className="w-full sm:w-auto" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/reservations')}>
              Nouvelle réservation
            </Button>
          </div>
        }
      />

      <Card className="space-y-4 p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Vue flotte</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{dateRangeLabel}</h2>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {DAY_OPTIONS.map((option) => (
              <button
                key={option}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  daysToShow === option ? 'bg-[#D4A017] text-carbon-950' : 'text-carbon-300 hover:bg-white/10'
                }`}
                onClick={() => setDaysToShow(option)}
              >
                {option} jours
              </button>
            ))}
          </div>
          {archivedVehicleCount > 0 ? (
            <button
              type="button"
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                showArchived ? 'border-gold-300/40 bg-gold-400 text-carbon-950' : 'border-white/10 bg-white/[0.04] text-carbon-300 hover:bg-white/10'
              }`}
              onClick={() => setShowArchived((current) => !current)}
            >
              Afficher archivés
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-carbon-950/55 p-3 text-xs sm:grid-cols-5 sm:text-sm">
          <div className="flex items-center gap-2 text-emerald-200">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Disponible
          </div>
          <div className="flex items-center gap-2 text-white">
            <span className="h-2.5 w-2.5 rounded-full bg-white/70" />
            Réservé
          </div>
          <div className="flex items-center gap-2 text-sky-200">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
            Maintenance
          </div>
          <div className="flex items-center gap-2 text-amber-200">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Départ aujourd’hui
          </div>
          <div className="flex items-center gap-2 text-cyan-200">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
            Retour aujourd’hui
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
            <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
            <div className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
          </div>
        ) : !hasData ? (
          <EmptyState
            icon={Car}
            title="Aucun véhicule pour le moment"
            message="Ajoutez un véhicule pour commencer la planification."
            action="Ajouter un véhicule"
            onAction={() => navigate('/vehicles')}
          />
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            <div className="no-scrollbar overflow-x-auto pb-1">
              <div className="grid min-w-max gap-2" style={{ gridTemplateColumns: `132px repeat(${days.length}, 34px)` }}>
                <div className="sticky left-0 z-10 rounded-xl border border-white/10 bg-carbon-950/95 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-carbon-400">
                  Véhicule
                </div>
                {days.map((day) => {
                  const dayIso = isoDate(day);
                  const isToday = dayIso === todayIso;
                  return (
                    <div
                      key={`mobile-head-${dayIso}`}
                      className={`rounded-xl border px-1 py-2 text-center ${isToday ? 'border-gold-300/45 bg-gold-400 text-carbon-950' : 'border-white/10 bg-white/[0.04] text-carbon-300'}`}
                    >
                      <p className="text-[9px] font-bold uppercase">{day.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}</p>
                      <p className="text-xs font-black">{String(day.getDate()).padStart(2, '0')}</p>
                    </div>
                  );
                })}

                {visibleVehicles.map((vehicle) => {
                  const blocks = reservationBlocksByVehicle.get(vehicle.id) || [];
                  return (
                    <div key={`mobile-row-${vehicle.id}`} className="contents">
                      <div className="sticky left-0 z-10 min-h-[70px] rounded-xl border border-white/10 bg-carbon-950/95 px-3 py-2 shadow-[8px_0_18px_rgba(0,0,0,.35)]">
                        <p className="truncate text-sm font-bold text-white">{vehicle.brand} {vehicle.model}</p>
                        <p className="mt-0.5 truncate text-[11px] text-carbon-400">{vehicle.plate}</p>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-carbon-500">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{vehicle.city || '—'}</span>
                        </div>
                      </div>
                      {days.map((day) => {
                        const dayIso = isoDate(day);
                        const cellState = getCellState(vehicle.id, dayIso, blocks);
                        const isToday = dayIso === todayIso;
                        const canCreate = cellState === 'available';
                        const dotClass =
                          cellState === 'maintenance' ? 'bg-sky-300' :
                          cellState === 'departure_today' ? 'bg-amber-300' :
                          cellState === 'return_today' ? 'bg-cyan-300' :
                          cellState === 'reserved' ? 'bg-white' : 'bg-emerald-300';
                        return (
                          <button
                            key={`mobile-${vehicle.id}-${dayIso}`}
                            className={`grid min-h-[70px] place-items-center rounded-xl border transition ${isToday ? 'border-gold-300/50 bg-gold-400/12' : 'border-white/10 bg-white/[0.035]'} ${canCreate ? 'active:scale-95' : ''}`}
                            onClick={() => {
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

          <div className="hidden overflow-x-auto pb-2 md:block">
            <div className="min-w-max">
              <div className="sticky top-0 z-20 flex">
                <div
                  className="sticky left-0 z-30 flex h-14 shrink-0 items-center rounded-tl-2xl border border-white/10 bg-carbon-950/95 px-4 backdrop-blur"
                  style={{ width: VEHICLE_COL_WIDTH }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-carbon-300">Véhicules</p>
                </div>

                <div className="flex rounded-tr-2xl border border-l-0 border-white/10 bg-carbon-950/95 backdrop-blur">
                  {days.map((day) => {
                    const dayIso = isoDate(day);
                    const isToday = dayIso === todayIso;
                    return (
                      <div
                        key={dayIso}
                        className={`flex h-14 shrink-0 flex-col items-center justify-center border-l border-white/10 px-1 text-center ${
                          isToday ? 'bg-gold-500/15 text-gold-100' : 'text-carbon-200'
                        }`}
                        style={{ width: DAY_COL_WIDTH }}
                      >
                        <p className="text-[10px] uppercase tracking-[0.14em]">
                          {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold">{String(day.getDate()).padStart(2, '0')}</p>
                      </div>
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
                        rowIndex === visibleVehicles.length - 1 ? 'rounded-bl-2xl' : ''
                      }`}
                      style={{ width: VEHICLE_COL_WIDTH, minHeight: ROW_HEIGHT }}
                    >
                      <p className="truncate text-sm font-semibold text-white">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="mt-1 text-xs text-carbon-400">{vehicle.plate}</p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-carbon-300">
                        <MapPin className="h-3.5 w-3.5" />
                        {vehicle.city || 'Ville non renseignée'}
                      </div>
                      <div className="mt-2">
                        <Badge>{isArchivedVehicle(vehicle) ? 'Archivé' : vehicle.status}</Badge>
                      </div>
                    </div>

                    <div
                      className={`relative border border-l-0 border-t-0 border-white/10 ${
                        rowIndex === visibleVehicles.length - 1 ? 'rounded-br-2xl' : ''
                      }`}
                      style={{ width: timelineWidth, minHeight: ROW_HEIGHT }}
                    >
                      <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${days.length}, ${DAY_COL_WIDTH}px)` }}>
                        {days.map((day) => {
                          const dayIso = isoDate(day);
                          const cellState = getCellState(vehicle.id, dayIso, blocks);
                          const label = stateLabel(cellState);
                          const canCreate = cellState === 'available';

                          return (
                            <button
                              key={`${vehicle.id}-${dayIso}`}
                              className={`group relative h-full border-l border-white/10 px-2 py-2 text-left transition first:border-l-0 ${cellClass(cellState)} ${
                                canCreate ? 'cursor-pointer' : 'cursor-default'
                              }`}
                              onClick={() => {
                                if (!canCreate) return;
                                goToReservationCreate(vehicle.id, dayIso);
                              }}
                            >
                              <span className="pointer-events-none absolute bottom-2 left-2 text-[10px] font-semibold text-carbon-400 opacity-0 transition group-hover:opacity-100">
                                {label}
                              </span>
                              {cellState === 'maintenance' ? (
                                <span className="absolute right-2 top-2 text-sky-200">
                                  <Wrench className="h-3.5 w-3.5" />
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      {blocks.map((block) => {
                        const spanDays = block.endIndex - block.startIndex + 1;
                        const left = block.startIndex * DAY_COL_WIDTH + 4;
                        const width = spanDays * DAY_COL_WIDTH - 8;
                        const startDayIso = isoDate(addDays(windowStart, block.startIndex));
                        const compact = spanDays <= 1;
                        return (
                          <button
                            key={`${vehicle.id}-${block.reservation.id}`}
                            className={`absolute top-3 z-10 rounded-xl border px-2 py-1.5 text-left text-xs font-semibold shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition hover:brightness-110 ${blockClass(block.reservation, startDayIso)}`}
                            style={{ left, width, minHeight: BLOCK_HEIGHT }}
                            onClick={() => setSelectedReservation(block.reservation)}
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
