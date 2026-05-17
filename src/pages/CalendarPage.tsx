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

const GRID_DAY_WIDTH = 92;
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
  if (status === 'Active') return 'Réservé';
  if (status === 'Confirmed') return 'Réservé';
  if (status === 'Completed') return 'Terminé';
  return 'Annulé';
}

function blockClass(reservation: Reservation, dayIso: string) {
  if (reservation.pickupDate === dayIso) {
    return 'bg-amber-500/25 border-amber-300/50 text-amber-100';
  }
  if (reservation.returnDate === dayIso) {
    return 'bg-sky-500/20 border-sky-300/45 text-sky-100';
  }
  if (reservation.status === 'Completed') {
    return 'bg-emerald-500/15 border-emerald-300/35 text-emerald-100';
  }
  return 'bg-white/10 border-white/20 text-white';
}

export default function CalendarPage() {
  const { vehicles, reservations, maintenance, loading } = useData();
  const navigate = useNavigate();
  const [daysToShow, setDaysToShow] = useState(14);
  const [windowStart, setWindowStart] = useState(() => toDateOnly(new Date()));
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const todayIso = isoDate(new Date());
  const days = useMemo(
    () => Array.from({ length: daysToShow }, (_, index) => addDays(windowStart, index)),
    [daysToShow, windowStart],
  );
  const gridTemplate = useMemo(
    () => ({ gridTemplateColumns: `repeat(${days.length}, ${GRID_DAY_WIDTH}px)` }),
    [days.length],
  );
  const firstDayIso = days[0] ? isoDate(days[0]) : todayIso;
  const lastDayIso = days[days.length - 1] ? isoDate(days[days.length - 1]) : todayIso;

  const reservationBlocksByVehicle = useMemo(() => {
    const grouped = new Map<string, CalendarBlock[]>();
    reservations
      .filter((reservation) => reservation.status !== 'Cancelled')
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
  }, [days.length, firstDayIso, lastDayIso, reservations, windowStart]);

  const maintenanceDatesByVehicle = useMemo(() => {
    const grouped = new Map<string, Set<string>>();
    maintenance.forEach((item) => {
      const dateIso = item.nextServiceDate?.slice(0, 10);
      if (!dateIso) return;
      if (!grouped.has(item.vehicleId)) grouped.set(item.vehicleId, new Set());
      grouped.get(item.vehicleId)!.add(dateIso);
    });
    return grouped;
  }, [maintenance]);

  const hasData = vehicles.length > 0;

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

  const renderRowStatus = (vehicleId: string, dayIso: string, blocks: CalendarBlock[]) => {
    const hasReservation = blocks.some(
      (block) => block.reservation.pickupDate <= dayIso && block.reservation.returnDate >= dayIso,
    );
    if (hasReservation) return 'Réservé';
    const inMaintenance =
      maintenanceDatesByVehicle.get(vehicleId)?.has(dayIso) ||
      vehicles.find((item) => item.id === vehicleId)?.status === 'Maintenance';
    if (inMaintenance) return 'Maintenance';
    return 'Disponible';
  };

  return (
    <section>
      <PageHeader
        eyebrow="PLANIFICATION"
        title="Calendrier"
        description="Visualisez votre flotte par jour, suivez les réservations et créez rapidement une nouvelle location."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => setWindowStart(toDateOnly(new Date()))}>
              Aujourd’hui
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/reservations')}>
              Nouvelle réservation
            </Button>
          </div>
        }
      />

      <Card className="space-y-4 p-4 sm:p-5">
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
        </div>

        <div className="grid gap-2 rounded-xl border border-white/10 bg-carbon-950/55 p-3 text-xs sm:grid-cols-5 sm:text-sm">
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
            <div className="h-16 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
            <div className="h-16 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
            <div className="h-16 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
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
          <div className="overflow-x-auto pb-1">
            <div className="min-w-max space-y-3">
              <div className="flex gap-3">
                <div className="w-52 shrink-0" />
                <div className="grid gap-2" style={gridTemplate}>
                  {days.map((day) => {
                    const dayIso = isoDate(day);
                    const isToday = dayIso === todayIso;
                    return (
                      <div
                        key={dayIso}
                        className={`rounded-xl border px-2 py-2 text-center ${
                          isToday ? 'border-gold-300/50 bg-gold-500/15 text-gold-100' : 'border-white/10 bg-white/[0.03] text-carbon-200'
                        }`}
                      >
                        <p className="text-[11px] uppercase tracking-[0.14em]">{day.toLocaleDateString('fr-FR', { weekday: 'short' })}</p>
                        <p className="mt-1 text-sm font-semibold">{String(day.getDate()).padStart(2, '0')}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {vehicles.map((vehicle) => {
                const blocks = reservationBlocksByVehicle.get(vehicle.id) || [];
                return (
                  <div key={vehicle.id} className="flex gap-3">
                    <div className="w-52 shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="truncate text-sm font-semibold text-white">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="mt-1 text-xs text-carbon-400">{vehicle.plate}</p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-carbon-300">
                        <MapPin className="h-3.5 w-3.5" />
                        {vehicle.city || 'Ville'}
                      </div>
                      <div className="mt-2">
                        <Badge>{vehicle.status}</Badge>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="grid gap-2" style={gridTemplate}>
                        {days.map((day) => {
                          const dayIso = isoDate(day);
                          const cellStatus = renderRowStatus(vehicle.id, dayIso, blocks);
                          const isDepartureToday = blocks.some((block) => block.reservation.pickupDate === dayIso);
                          const isReturnToday = blocks.some((block) => block.reservation.returnDate === dayIso);
                          const statusClass =
                            cellStatus === 'Réservé'
                              ? 'bg-white/[0.02] border-white/10'
                              : cellStatus === 'Maintenance'
                                ? 'bg-sky-500/12 border-sky-300/30'
                                : 'bg-emerald-500/10 border-emerald-300/25 hover:bg-emerald-500/20';

                          return (
                            <button
                              key={`${vehicle.id}-${dayIso}`}
                              className={`relative h-20 rounded-xl border text-left transition ${statusClass}`}
                              onClick={() => {
                                if (cellStatus !== 'Disponible') return;
                                goToReservationCreate(vehicle.id, dayIso);
                              }}
                            >
                              {cellStatus === 'Disponible' ? (
                                <span className="absolute left-2 top-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                                  Disponible
                                </span>
                              ) : null}
                              {cellStatus === 'Maintenance' ? (
                                <span className="absolute left-2 top-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-100">
                                  <Wrench className="h-3 w-3" /> Maintenance
                                </span>
                              ) : null}
                              {isDepartureToday ? (
                                <span className="absolute right-1.5 top-1.5 rounded-full border border-amber-300/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-100">
                                  Départ
                                </span>
                              ) : null}
                              {isReturnToday ? (
                                <span className="absolute bottom-1.5 right-1.5 rounded-full border border-cyan-300/40 bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-100">
                                  Retour
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pointer-events-none absolute inset-0 grid gap-2" style={gridTemplate}>
                        {blocks.map((block) => {
                          const startDayIso = isoDate(addDays(windowStart, block.startIndex));
                          return (
                            <button
                              key={`${vehicle.id}-${block.reservation.id}`}
                              className={`pointer-events-auto mt-2 h-11 rounded-xl border px-2 text-left text-xs font-semibold shadow-lg ${blockClass(block.reservation, startDayIso)}`}
                              style={{ gridColumn: `${block.startIndex + 1} / ${block.endIndex + 2}` }}
                              onClick={() => setSelectedReservation(block.reservation)}
                            >
                              <span className="block truncate">
                                {block.reservation.id} • {block.reservation.client}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] opacity-85">
                                {reservationLabel(block.reservation.status)} • {formatMAD(block.reservation.totalAmount ?? 0)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(selectedReservation)}
        title="Détails de réservation"
        onClose={() => setSelectedReservation(null)}
      >
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
                  {selectedReservation.pickupDate} → {selectedReservation.returnDate}
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
