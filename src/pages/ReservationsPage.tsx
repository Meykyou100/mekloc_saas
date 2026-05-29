import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  Car,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  FileSignature,
  LayoutGrid,
  ListFilter,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import PlateNumber from '../components/ui/PlateNumber';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatMAD, type Reservation, type ReservationStatus } from '../data/mockData';
import { sanitizeText } from '../lib/security';
import { buildWhatsAppReminderUrl } from '../lib/assistantDuJour';
import { getNotificationPreferences } from '../lib/notificationPreferences';

type ViewMode = 'list' | 'grid';
type ReservationFilterStatus = 'All' | ReservationStatus;
const statuses: Array<ReservationFilterStatus> = ['All', 'Confirmed', 'Active', 'Completed', 'Cancelled'];
const reservationSteps = ['Client', 'Véhicule', 'Dates & lieux', 'Tarif & caution', 'Confirmation'];

const inputClass = 'form-control focus-ring w-full text-sm';

function getRentalDays(start: string, end: string) {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 1;
  return Math.max(1, Math.ceil((to - from) / 86_400_000));
}

function isoPlusOne(dateIso: string) {
  const value = new Date(dateIso);
  if (Number.isNaN(value.getTime())) return new Date().toISOString().slice(0, 10);
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

function formatReservationDateTime(date: string, time?: string) {
  return `${date || '—'}${time ? ` ${time}` : ''}`;
}

function parseOptionalNumber(value: string) {
  if (value.trim() === '') return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return trimmed;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function isDateOverlap(startA: string, endA: string, startB: string, endB: string) {
  return new Date(startA) <= new Date(endB) && new Date(endA) >= new Date(startB);
}

function statusFr(status: ReservationStatus) {
  if (status === 'Confirmed') return 'Confirmée';
  if (status === 'Active') return 'Active';
  if (status === 'Completed') return 'Terminée';
  return 'Annulée';
}

function paymentMatchesReservation(payment: { reservationId?: string }, reservation: Reservation) {
  return Boolean(payment.reservationId && payment.reservationId === (reservation.recordId || reservation.id));
}

function urgencyBadge(reservation: Reservation, todayIso: string) {
  if (reservation.returnDate < todayIso && reservation.status !== 'Completed' && reservation.status !== 'Cancelled') {
    return { label: 'En retard', className: 'border-rose-300/40 bg-rose-500/15 text-rose-100' };
  }
  if (reservation.pickupDate === todayIso) {
    return { label: "Départ aujourd'hui", className: 'border-amber-300/40 bg-amber-500/15 text-amber-100' };
  }
  if (reservation.returnDate === todayIso) {
    return { label: "Retour aujourd'hui", className: 'border-sky-300/40 bg-sky-500/15 text-sky-100' };
  }
  if (reservation.pickupDate > todayIso) {
    return { label: 'À venir', className: 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100' };
  }
  return null;
}

function ReservationField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-carbon-100 light:text-carbon-800">{label}</span>
      {children}
      {hint ? <span className="text-xs text-carbon-500">{hint}</span> : null}
    </label>
  );
}

export default function ReservationsPage() {
  const { clients, vehicles, reservations, payments, refreshData, createReservation, updateReservation, deleteReservation } = useData();
  const { notify } = useApp();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ReservationFilterStatus>('All');
  const [view, setView] = useState<ViewMode>('grid');

  const [modalOpen, setModalOpen] = useState(false);
  const [reservationStep, setReservationStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Reservation | null>(null);

  const [draftClientId, setDraftClientId] = useState('');
  const [draftVehicleId, setDraftVehicleId] = useState('');
  const [draftPickupDate, setDraftPickupDate] = useState('');
  const [draftReturnDate, setDraftReturnDate] = useState('');
  const [draftPickupLocation, setDraftPickupLocation] = useState('');
  const [draftReturnLocation, setDraftReturnLocation] = useState('');
  const [draftPickupTime, setDraftPickupTime] = useState('');
  const [draftReturnTime, setDraftReturnTime] = useState('');
  const [draftDailyPrice, setDraftDailyPrice] = useState('');
  const [draftDeposit, setDraftDeposit] = useState('');
  const [draftMileageOut, setDraftMileageOut] = useState('');
  const [draftFuelLevelOut, setDraftFuelLevelOut] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftStatus, setDraftStatus] = useState<ReservationStatus>('Confirmed');

  const todayIso = new Date().toISOString().slice(0, 10);
  const notificationPreferences = getNotificationPreferences(profile?.agency?.settings);

  const selectedClient = clients.find((client) => client.id === draftClientId) || null;
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === draftVehicleId) || null;
  const rentalDays = getRentalDays(draftPickupDate || todayIso, draftReturnDate || todayIso);
  const dailyPriceNumber = parseOptionalNumber(draftDailyPrice);
  const depositNumber = parseOptionalNumber(draftDeposit);
  const mileageOutNumber = parseOptionalNumber(draftMileageOut);
  const totalEstimate = Math.max(0, Number(dailyPriceNumber || 0) * rentalDays);

  const vehicleReservations = useMemo(
    () =>
      reservations.filter(
        (item) =>
          item.vehicleId === draftVehicleId &&
          item.id !== editingReservation?.id &&
          (item.status === 'Confirmed' || item.status === 'Active'),
      ),
    [draftVehicleId, editingReservation?.id, reservations],
  );

  const overlapReservation = useMemo(() => {
    if (!draftPickupDate || !draftReturnDate || !draftVehicleId) return null;
    return vehicleReservations.find((reservation) =>
      isDateOverlap(draftPickupDate, draftReturnDate, reservation.pickupDate, reservation.returnDate),
    );
  }, [draftPickupDate, draftReturnDate, draftVehicleId, vehicleReservations]);

  const nextAvailableDate = useMemo(() => {
    if (!overlapReservation) return null;
    const next = new Date(overlapReservation.returnDate);
    next.setDate(next.getDate() + 1);
    return next.toISOString().slice(0, 10);
  }, [overlapReservation]);

  const filteredReservations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations.filter((reservation) => {
      const haystack = `${reservation.client} ${reservation.vehicle} ${reservation.city} ${reservation.id}`.toLowerCase();
      const statusMatch = status === 'All' || reservation.status === status;
      return statusMatch && (!q || haystack.includes(q));
    });
  }, [query, reservations, status]);

  const stats = useMemo(() => {
    const total = reservations.length;
    const confirmed = reservations.filter((r) => r.status === 'Confirmed').length;
    const active = reservations.filter((r) => r.status === 'Active').length;
    const completed = reservations.filter((r) => r.status === 'Completed').length;
    const cancelled = reservations.filter((r) => r.status === 'Cancelled').length;
    const revenue = reservations.reduce((sum, reservation) => sum + (reservation.totalAmount ?? reservation.dailyPrice), 0);
    return { total, confirmed, active, completed, cancelled, revenue };
  }, [reservations]);

  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalOpen]);

  function resetDraft() {
    const firstClient = clients[0] || null;
    const firstVehicle = vehicles[0] || null;
    setDraftClientId(firstClient?.id || '');
    setDraftVehicleId(firstVehicle?.id || '');
    setDraftPickupDate(todayIso);
    const next = new Date(todayIso);
    next.setDate(next.getDate() + 2);
    setDraftReturnDate(next.toISOString().slice(0, 10));
    setDraftPickupTime('10:00');
    setDraftReturnTime('18:00');
    setDraftDailyPrice(firstVehicle?.dailyPrice ? String(firstVehicle.dailyPrice) : '');
    setDraftDeposit('');
    setDraftPickupLocation('');
    setDraftReturnLocation('');
    setDraftMileageOut('');
    setDraftFuelLevelOut('');
    setDraftNotes('');
    setDraftStatus('Confirmed');
    setReservationStep(0);
  }

  function openNewReservation() {
    setEditingReservation(null);
    resetDraft();
    setModalOpen(true);
  }

  useEffect(() => {
    if (!clients.length || !vehicles.length) return;
    if (searchParams.get('create') !== '1') return;

    const vehicleId = searchParams.get('vehicleId') || '';
    const clientId = searchParams.get('clientId') || '';
    const pickup = searchParams.get('pickup') || todayIso;
    const returnDate = searchParams.get('return') || isoPlusOne(pickup);

    openNewReservation();

    const nextClient = clients.find((item) => item.id === clientId) || clients[0] || null;
    if (nextClient) {
      setDraftClientId(nextClient.id);
    }
    const nextVehicle = vehicles.find((item) => item.id === vehicleId) || vehicles[0] || null;
    if (nextVehicle) {
      setDraftVehicleId(nextVehicle.id);
      setDraftDailyPrice(nextVehicle.dailyPrice ? String(nextVehicle.dailyPrice) : '');
    }
    setDraftPickupDate(pickup);
    setDraftReturnDate(returnDate);
    setDraftPickupLocation(nextVehicle?.city || '');
    setReservationStep(2);

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('create');
      next.delete('vehicleId');
      next.delete('clientId');
      next.delete('pickup');
      next.delete('return');
      return next;
    }, { replace: true });
  }, [clients, searchParams, setSearchParams, todayIso, vehicles]);

  function openEditReservation(reservation: Reservation) {
    setEditingReservation(reservation);
    setDraftClientId(reservation.clientId);
    setDraftVehicleId(reservation.vehicleId);
    setDraftPickupDate(reservation.pickupDate);
    setDraftReturnDate(reservation.returnDate);
    setDraftPickupTime(reservation.pickupTime || '');
    setDraftReturnTime(reservation.returnTime || '');
    setDraftDailyPrice(String(reservation.dailyPrice || ''));
    setDraftDeposit(String(reservation.deposit ?? ''));
    setDraftPickupLocation(reservation.pickupLocation || '');
    setDraftReturnLocation(reservation.returnLocation || '');
    setDraftMileageOut(String(reservation.mileageOut ?? ''));
    setDraftFuelLevelOut(reservation.fuelLevelOut || '');
    setDraftNotes(reservation.notes || '');
    setDraftStatus(reservation.status);
    setReservationStep(0);
    setModalOpen(true);
  }

  function validateCurrentStep() {
    if (reservationStep === 0 && !draftClientId) {
      notify({ title: 'Client requis', message: 'Veuillez sélectionner un client.', type: 'warning' });
      return false;
    }
    if (reservationStep === 1 && !draftVehicleId) {
      notify({ title: 'Véhicule requis', message: 'Veuillez sélectionner un véhicule.', type: 'warning' });
      return false;
    }
    if (reservationStep === 2) {
      if (!draftPickupDate || !draftReturnDate) {
        notify({ title: 'Dates requises', message: 'Veuillez choisir la date de départ et de retour.', type: 'warning' });
        return false;
      }
      if (new Date(draftReturnDate) <= new Date(draftPickupDate)) {
        notify({ title: 'Dates invalides', message: 'La date de retour doit être après la date de départ.', type: 'warning' });
        return false;
      }
      if (overlapReservation) {
        notify({ title: 'Conflit véhicule', message: 'Ce véhicule est déjà réservé sur cette période.', type: 'warning' });
        return false;
      }
    }
    if (reservationStep === 3) {
      if (!dailyPriceNumber || dailyPriceNumber <= 0) {
        notify({ title: 'Tarif invalide', message: 'Le prix journalier doit être supérieur à 0.', type: 'warning' });
        return false;
      }
      if (depositNumber !== null && depositNumber < 0) {
        notify({ title: 'Caution invalide', message: 'La caution doit être positive ou égale à 0.', type: 'warning' });
        return false;
      }
    }
    return true;
  }

  async function handleSubmitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClient || !selectedVehicle) {
      notify({ title: 'Données incomplètes', message: 'Veuillez sélectionner un client et un véhicule.', type: 'warning' });
      return;
    }
    if (new Date(draftReturnDate) <= new Date(draftPickupDate)) {
      notify({ title: 'Dates invalides', message: 'La date de retour doit être après la date de départ.', type: 'warning' });
      return;
    }
    if (overlapReservation) {
      notify({ title: 'Conflit véhicule', message: 'Ce véhicule est déjà réservé sur cette période.', type: 'warning' });
      return;
    }
    if (!dailyPriceNumber || dailyPriceNumber <= 0 || (depositNumber !== null && depositNumber < 0)) {
      notify({ title: 'Tarification invalide', message: 'Vérifiez prix journalier et caution.', type: 'warning' });
      return;
    }

    const payload: Reservation = {
      id: editingReservation?.id || `RS-${1024 + reservations.length + 1}`,
      client: selectedClient.fullName,
      clientId: selectedClient.id,
      vehicle: `${selectedVehicle.brand} ${selectedVehicle.model}`,
      vehicleId: selectedVehicle.id,
      pickupDate: draftPickupDate,
      returnDate: draftReturnDate,
      pickupTime: normalizeTimeInput(draftPickupTime),
      returnTime: normalizeTimeInput(draftReturnTime),
      dailyPrice: dailyPriceNumber,
      deposit: depositNumber ?? 0,
      totalAmount: totalEstimate,
      pickupLocation: draftPickupLocation,
      returnLocation: draftReturnLocation,
      mileageOut: mileageOutNumber ?? 0,
      fuelLevelOut: draftFuelLevelOut,
      status: draftStatus,
      notes: draftNotes,
      city: selectedVehicle.city,
    };

    try {
      setSaving(true);
      if (editingReservation) {
        await updateReservation(payload);
        await refreshData();
        notify({ title: 'Réservation modifiée', message: `${payload.id} mise à jour avec succès.`, type: 'success' });
      } else {
        await createReservation(payload);
        await refreshData();
        notify({ title: 'Réservation ajoutée', message: `${selectedClient.fullName} réservé(e) pour ${selectedVehicle.model}.`, type: 'success' });
      }
      setModalOpen(false);
      setEditingReservation(null);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Reservation save failed', error);
      notify({
        title: 'Enregistrement impossible',
        message: error instanceof Error ? error.message : 'Réessayez dans quelques instants.',
        type: 'warning',
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteReservation() {
    if (!deleteTarget) return;
    try {
      await deleteReservation(deleteTarget.id);
      notify({ title: 'Réservation supprimée', message: `${deleteTarget.id} a été supprimée.`, type: 'success' });
      setDeleteTarget(null);
    } catch (error) {
      notify({ title: 'Suppression impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    }
  }

  async function handleUpdateStatus(reservation: Reservation, nextStatus: ReservationStatus) {
    try {
      await updateReservation({ ...reservation, status: nextStatus });
      notify({ title: 'Statut mis à jour', message: `${reservation.id} est maintenant ${statusFr(nextStatus).toLowerCase()}.`, type: 'success' });
    } catch (error) {
      notify({ title: 'Mise à jour impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    }
  }

  const stepChecklist = [
    { label: 'Client sélectionné', ok: Boolean(draftClientId) },
    { label: 'Véhicule sélectionné', ok: Boolean(draftVehicleId) },
    { label: 'Dates valides', ok: Boolean(draftPickupDate && draftReturnDate && new Date(draftReturnDate) > new Date(draftPickupDate)) },
    { label: 'Aucun chevauchement', ok: !overlapReservation },
    { label: 'Prix calculé', ok: totalEstimate > 0 },
  ];

  const reservationStatCards = [
    { label: 'Total réservations', value: String(stats.total), trend: 'Global', icon: CalendarDays, accent: 'from-gold-400/16' },
    { label: 'Confirmées', value: String(stats.confirmed), trend: 'Planifiées', icon: CheckCircle2, accent: 'from-emerald-400/14' },
    { label: 'Actives', value: String(stats.active), trend: 'En cours', icon: Clock3, accent: 'from-sky-400/14' },
    { label: 'Terminées', value: String(stats.completed), trend: 'Historique', icon: CheckCircle2, accent: 'from-violet-400/14' },
    { label: 'Annulées', value: String(stats.cancelled), trend: 'À suivre', icon: X, accent: 'from-rose-400/14' },
    { label: 'Revenus prévus', value: formatMAD(stats.revenue), trend: 'Estimé', icon: Wallet, accent: 'from-amber-400/14' },
  ];

  return (
    <div className="overflow-x-hidden pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-6">
      <PageHeader
        eyebrow="Réservations"
        title="Réservations"
        description="Pilotage complet des départs, retours, cautions et contrats de location."
        action={
          <Button
            className="h-12 rounded-2xl px-5 shadow-[0_0_34px_rgba(212,160,23,0.18)]"
            icon={<Plus className="h-4 w-4" />}
            onClick={openNewReservation}
          >
            Ajouter une réservation
          </Button>
        }
      />

      <div className="no-scrollbar -mx-4 mb-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:mb-5 xl:grid-cols-6">
        {reservationStatCards.map(({ label, value, trend, icon: Icon, accent }) => (
          <div
            key={label}
            className="relative min-h-[118px] min-w-[148px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-950/95 via-[#10141a] to-black p-3.5 shadow-[0_14px_36px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.05)] sm:min-w-0 sm:p-4"
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accent} to-transparent`} />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[10px] font-black uppercase leading-4 tracking-[0.12em] text-carbon-400">{label}</p>
                  <p className="mt-2 truncate text-[1.45rem] font-black leading-none text-white sm:text-2xl">{value}</p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] border border-[#D4A017]/20 bg-[#D4A017]/10 text-gold-200 shadow-[0_0_20px_rgba(212,160,23,0.10)]">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-[11px] font-semibold text-carbon-400">{trend}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="mb-5 rounded-3xl border-white/10 bg-gradient-to-br from-zinc-950/95 via-[#10141a] to-black p-3 shadow-[0_18px_46px_rgba(0,0,0,.24)] md:p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto_auto] xl:items-center">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
            <input
              value={query}
              onChange={(event) => setQuery(sanitizeText(event.target.value, 120))}
              placeholder="Rechercher client, véhicule, ville ou référence"
              className="focus-ring h-12 w-full rounded-2xl border border-white/[0.08] bg-black/30 pl-10 pr-4 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,.035)] transition placeholder:text-carbon-500 hover:border-white/15 light:bg-white light:text-carbon-950"
            />
          </label>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {statuses.map((item) => (
              <button
                key={item}
                className={`focus-ring h-10 shrink-0 rounded-xl px-3 text-xs font-black transition md:text-sm ${
                  status === item ? 'bg-gold-400 text-carbon-950 shadow-[0_10px_22px_rgba(212,160,23,.14)]' : 'border border-white/10 bg-white/[0.04] text-carbon-300 hover:bg-white/10'
                }`}
                onClick={() => setStatus(item)}
              >
                {item === 'All' ? 'Tous' : statusFr(item)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1 md:flex">
            <button className={`focus-ring grid h-10 min-w-0 place-items-center rounded-xl ${view === 'list' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300'}`} onClick={() => setView('list')} aria-label="Vue liste">
              <ListFilter className="h-4 w-4" />
            </button>
            <button className={`focus-ring grid h-10 min-w-0 place-items-center rounded-xl ${view === 'grid' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300'}`} onClick={() => setView('grid')} aria-label="Vue cartes">
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {filteredReservations.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucune réservation trouvée"
          message={reservations.length ? 'Aucun résultat avec ces filtres.' : 'Ajoutez votre première réservation.'}
          action="Ajouter une réservation"
          onAction={openNewReservation}
        />
      ) : view === 'list' ? (
        <Card className="data-table hidden overflow-hidden rounded-3xl border-white/10 bg-gradient-to-br from-zinc-950/95 via-[#10141a] to-black md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-white/[0.06] text-xs uppercase tracking-wide text-carbon-400">
                <tr>
                  <th className="px-5 py-4">Référence</th>
                  <th className="px-5 py-4">Client</th>
                  <th className="px-5 py-4">Véhicule</th>
                  <th className="px-5 py-4">Dates</th>
                  <th className="px-5 py-4">Statut</th>
                  <th className="px-5 py-4">Total</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredReservations.map((reservation) => (
                  <tr key={reservation.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4 font-bold text-white">{reservation.id}</td>
                    <td className="px-5 py-4 text-carbon-300">{reservation.client}</td>
                    <td className="px-5 py-4 text-carbon-300">{reservation.vehicle}</td>
                    <td className="px-5 py-4 text-carbon-400">{formatReservationDateTime(reservation.pickupDate, reservation.pickupTime)} → {formatReservationDateTime(reservation.returnDate, reservation.returnTime)}</td>
                    <td className="px-5 py-4"><Badge>{reservation.status}</Badge></td>
                    <td className="px-5 py-4 text-white">{formatMAD(reservation.totalAmount ?? reservation.dailyPrice)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" className="h-9 rounded-xl px-2.5 text-xs" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEditReservation(reservation)}>Modifier</Button>
                        <Button variant="secondary" className="h-9 rounded-xl px-2.5 text-xs" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setDetailsTarget(reservation)}>Détails</Button>
                        <Button variant="secondary" className="h-9 rounded-xl px-2.5 text-xs" icon={<FileSignature className="h-3.5 w-3.5" />} onClick={() => navigate(`/contracts?reservation=${encodeURIComponent(reservation.id)}`)}>Générer contrat</Button>
                        <Button variant="danger" className="h-9 rounded-xl px-2.5 text-xs" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(reservation)}>Supprimer</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {filteredReservations.map((reservation) => {
            const days = getRentalDays(reservation.pickupDate, reservation.returnDate);
            const urgency = urgencyBadge(reservation, todayIso);
            const payment = payments.find((item) => paymentMatchesReservation(item, reservation));
            return (
              <Card key={reservation.id} interactive className="group relative overflow-hidden rounded-3xl border-white/10 bg-gradient-to-br from-[#131821] via-[#0f141c] to-[#07090d] p-4 shadow-[0_14px_38px_rgba(0,0,0,.30),inset_0_1px_0_rgba(255,255,255,.04)] transition-all hover:border-[#D4A017]/35 md:p-5">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#D4A017]/8 to-transparent opacity-80" />
                <div className="relative mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gold-300/80">{reservation.id}</p>
                    <h3 className="mt-1 truncate text-base font-black text-white">{reservation.vehicle}</h3>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-carbon-300">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-carbon-500" />
                      <span className="truncate">{reservation.client}</span>
                    </p>
                  </div>
                  <div className="shrink-0"><Badge>{reservation.status}</Badge></div>
                </div>

                {urgency ? (
                  <div className={`relative mb-3 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${urgency.className}`}>
                    {urgency.label}
                  </div>
                ) : null}

                <div className="relative grid gap-2.5 text-sm text-carbon-300">
                  <p className="flex min-w-0 items-start gap-2 leading-5"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gold-200" /> <span className="min-w-0">{formatReservationDateTime(reservation.pickupDate, reservation.pickupTime)} → {formatReservationDateTime(reservation.returnDate, reservation.returnTime)} <span className="text-carbon-500">({days} jours)</span></span></p>
                  <p className="flex min-w-0 items-start gap-2 leading-5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-200" /> <span className="truncate">{reservation.pickupLocation || 'Lieu départ non renseigné'}</span></p>
                  <p className="flex min-w-0 items-start gap-2 leading-5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-200" /> <span className="truncate">{reservation.returnLocation || 'Lieu retour non renseigné'}</span></p>
                </div>

                <div className="relative mt-4 grid grid-cols-2 gap-2.5">
                  <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <p className="text-xs text-carbon-500">Total</p>
                    <p className="mt-1 truncate font-black text-white">{formatMAD(reservation.totalAmount ?? reservation.dailyPrice)}</p>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <p className="text-xs text-carbon-500">Caution</p>
                    <p className="mt-1 truncate font-black text-white">{formatMAD(reservation.deposit || 0)}</p>
                  </div>
                </div>

                <div className="relative mt-3 flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                  <Wallet className="h-4 w-4 shrink-0 text-gold-200" />
                  <span className="text-xs font-semibold text-carbon-500">Paiement</span>
                  {payment ? <Badge>{payment.status}</Badge> : <span className="text-xs text-carbon-400">Non renseigné</span>}
                </div>

                <div className="relative mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button variant="secondary" className="h-11 min-w-0 rounded-xl px-2.5 text-xs sm:h-9 sm:px-3" icon={<Pencil className="h-3.5 w-3.5 shrink-0" />} onClick={() => openEditReservation(reservation)}>Modifier</Button>
                  <Button variant="secondary" className="h-11 min-w-0 rounded-xl px-2.5 text-xs sm:h-9 sm:px-3" icon={<Eye className="h-3.5 w-3.5 shrink-0" />} onClick={() => setDetailsTarget(reservation)}>Détails</Button>
                  <Button variant="secondary" className="h-11 min-w-0 rounded-xl px-2.5 text-xs sm:h-9 sm:px-3" icon={<FileSignature className="h-3.5 w-3.5 shrink-0" />} onClick={() => navigate(`/contracts?reservation=${encodeURIComponent(reservation.id)}`)}>Générer</Button>
                  <Button variant="danger" className="h-11 min-w-0 rounded-xl px-2.5 text-xs sm:h-9 sm:px-3" icon={<Trash2 className="h-3.5 w-3.5 shrink-0" />} onClick={() => setDeleteTarget(reservation)}>Supprimer</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {modalOpen ? (
          <motion.div className="fixed inset-0 z-50 overflow-hidden bg-[#050505]/88 p-0 backdrop-blur-sm sm:p-4 lg:flex lg:items-center lg:justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button aria-label="Fermer" className="absolute inset-0 h-full w-full cursor-default" onClick={() => !saving && setModalOpen(false)} />
            <motion.aside
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.985 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-none border border-white/[0.07] bg-[#0B0D10] shadow-[0_26px_80px_rgba(0,0,0,.55)] sm:h-full sm:max-h-none sm:rounded-[1.5rem] lg:h-[92dvh] lg:max-h-[920px]"
            >
              <div className="shrink-0 border-b border-white/10 bg-[#0B0D10]/95 px-4 py-4 backdrop-blur sm:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-carbon-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {editingReservation ? 'Modifier réservation' : 'Nouvelle réservation'}
                  </div>
                    <h2 className="truncate text-lg font-black tracking-tight text-white sm:text-2xl">{editingReservation ? 'Modifier une réservation' : 'Ajouter une réservation'}</h2>
                    <p className="mt-1 text-sm text-carbon-400">Flux guidé pour créer rapidement une réservation fiable.</p>
                  </div>
                  <button className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-carbon-300 transition hover:bg-white/10 hover:text-white" onClick={() => !saving && setModalOpen(false)} type="button">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <form className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1fr_360px]" onSubmit={handleSubmitReservation}>
                <div className="flex min-h-0 flex-col">
                  <div className="shrink-0 border-b border-white/10 bg-[#0B0D10]/95 px-4 py-3 backdrop-blur sm:px-7 sm:py-4">
                    <div className="sm:hidden">
                      <p className="text-xs font-semibold text-carbon-400">{reservationStep + 1}/5 • {reservationSteps[reservationStep]}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10">
                        <div className="h-1.5 rounded-full bg-gold-400 transition-all" style={{ width: `${((reservationStep + 1) / reservationSteps.length) * 100}%` }} />
                      </div>
                      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
                        {reservationSteps.map((step, index) => (
                          <button
                            key={step}
                            type="button"
                            onClick={() => setReservationStep(index)}
                            className={`h-10 shrink-0 rounded-xl border px-3 text-xs font-black transition ${
                              reservationStep === index
                                ? 'border-gold-300/50 bg-gold-400 text-carbon-950'
                                : 'border-white/10 bg-white/[0.04] text-carbon-300'
                            }`}
                          >
                            {index + 1}. {step}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="hidden sm:grid sm:grid-cols-5 sm:gap-2">
                      {reservationSteps.map((step, index) => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => setReservationStep(index)}
                          className={`rounded-xl border px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.08em] transition ${
                            reservationStep === index
                              ? 'border-gold-400/45 bg-white/[0.045] text-gold-200'
                              : 'border-white/10 bg-white/[0.025] text-carbon-500 hover:text-carbon-200'
                          }`}
                        >
                          <span className="mr-2 text-carbon-500">0{index + 1}</span>{step}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-28 sm:px-7 sm:py-6">
                    {reservationStep === 0 ? (
                      <section className="space-y-5">
                        <div>
                          <h3 className="text-xl font-semibold text-white">Client</h3>
                          <p className="mt-1 text-sm text-carbon-400">Sélectionnez le client associé à la réservation.</p>
                        </div>
                        <ReservationField label="Client">
                          <select className={inputClass} value={draftClientId} onChange={(event) => setDraftClientId(event.target.value)} required>
                            {clients.map((client) => <option key={client.id} value={client.id}>{client.fullName}</option>)}
                          </select>
                        </ReservationField>
                        {selectedClient ? (
                          <div className="premium-surface rounded-3xl p-5">
                            <div className="flex gap-4">
                              <div className="premium-avatar grid h-14 w-14 place-items-center rounded-2xl text-lg font-black text-carbon-950">
                                {selectedClient.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                              </div>
                              <div>
                                <div className="mb-2"><Badge>{selectedClient.status}</Badge></div>
                                <p className="font-semibold text-white">{selectedClient.fullName}</p>
                                <p className="mt-1 text-sm text-carbon-400">{selectedClient.phone} · {selectedClient.cin}</p>
                                <p className="mt-1 text-sm text-carbon-500">Permis {selectedClient.license} · {selectedClient.totalRentals} réservations passées</p>
                                {selectedClient.idCardFrontUrl && selectedClient.idCardBackUrl ? (
                                  <p className="mt-2 text-xs font-semibold text-emerald-200">Documents identité complets</p>
                                ) : (
                                  <p className="mt-2 text-xs font-semibold text-amber-200">Pièces d’identité manquantes</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {reservationStep === 1 ? (
                      <section className="space-y-5">
                        <div>
                          <h3 className="text-xl font-semibold text-white">Véhicule</h3>
                          <p className="mt-1 text-sm text-carbon-400">Choisissez le véhicule disponible pour la période.</p>
                        </div>
                        <ReservationField label="Véhicule">
                          <select
                            className={inputClass}
                            value={draftVehicleId}
                            onChange={(event) => {
                              const v = vehicles.find((item) => item.id === event.target.value);
                              setDraftVehicleId(event.target.value);
                              if (v) setDraftDailyPrice(v.dailyPrice ? String(v.dailyPrice) : '');
                            }}
                            required
                          >
                            {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model}</option>)}
                          </select>
                        </ReservationField>
                        {selectedVehicle ? (
                          <div className="premium-surface grid gap-3 rounded-3xl p-5 sm:grid-cols-[180px_1fr]">
                            <div className="relative h-32 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-950 sm:h-28">
                              {selectedVehicle.imageUrl ? (
                                <img
                                  src={selectedVehicle.imageUrl}
                                  alt={`${selectedVehicle.brand} ${selectedVehicle.model}`}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="grid h-full w-full place-items-center">
                                  <Car className="h-14 w-14 text-white/70" strokeWidth={1.3} />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-3">
                                <p className="text-lg font-semibold text-white">{selectedVehicle.brand} {selectedVehicle.model}</p>
                                <Badge>{selectedVehicle.status}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-carbon-400"><PlateNumber value={selectedVehicle.plate} /> · {selectedVehicle.city}</p>
                              <p className="mt-3 text-sm text-carbon-300">{selectedVehicle.mileage.toLocaleString()} km · {formatMAD(selectedVehicle.dailyPrice)} / jour</p>
                            </div>
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {reservationStep === 2 ? (
                      <section className="space-y-5">
                        <div>
                          <h3 className="text-xl font-semibold text-white">Dates & lieux</h3>
                          <p className="mt-1 text-sm text-carbon-400">Définissez les dates, lieux et validez la disponibilité.</p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <ReservationField label="Date de départ">
                            <input className={inputClass} type="date" value={draftPickupDate} onChange={(event) => setDraftPickupDate(event.target.value)} required />
                          </ReservationField>
                          <ReservationField label="Heure de départ">
                            <input className={inputClass} type="time" value={draftPickupTime} onChange={(event) => setDraftPickupTime(event.target.value)} />
                          </ReservationField>
                          <ReservationField label="Date de retour">
                            <input className={inputClass} type="date" value={draftReturnDate} onChange={(event) => setDraftReturnDate(event.target.value)} required />
                          </ReservationField>
                          <ReservationField label="Heure de retour">
                            <input className={inputClass} type="time" value={draftReturnTime} onChange={(event) => setDraftReturnTime(event.target.value)} />
                          </ReservationField>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <ReservationField label="Lieu de départ" hint="Obligatoire pour le contrat">
                            <input className={inputClass} value={draftPickupLocation} onChange={(event) => setDraftPickupLocation(event.target.value)} placeholder="Aéroport, hôtel, agence..." required />
                          </ReservationField>
                          <ReservationField label="Lieu de retour">
                            <input className={inputClass} value={draftReturnLocation} onChange={(event) => setDraftReturnLocation(event.target.value)} placeholder="Adresse de retour..." />
                          </ReservationField>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-sm font-semibold text-carbon-100">Durée calculée: {rentalDays} jour(s)</p>
                          {overlapReservation ? (
                            <p className="mt-2 text-sm font-semibold text-rose-200">
                              Ce véhicule est déjà réservé sur cette période.
                              {nextAvailableDate ? ` Prochaine date disponible: ${nextAvailableDate}.` : ''}
                            </p>
                          ) : (
                            <p className="mt-2 text-sm font-semibold text-emerald-200">Véhicule disponible pour cette période.</p>
                          )}
                        </div>
                      </section>
                    ) : null}

                    {reservationStep === 3 ? (
                      <section className="space-y-5">
                        <div>
                          <h3 className="text-xl font-semibold text-white">Tarif & caution</h3>
                          <p className="mt-1 text-sm text-carbon-400">Ajustez le prix journalier, la caution et le statut.</p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.25fr]">
                          <ReservationField label="Prix journalier">
                            <input className={inputClass} type="number" value={draftDailyPrice} onChange={(event) => setDraftDailyPrice(event.target.value)} min={1} required />
                          </ReservationField>
                          <ReservationField label="Caution">
                            <input className={inputClass} type="number" value={draftDeposit} onChange={(event) => setDraftDeposit(event.target.value)} min={0} />
                          </ReservationField>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-carbon-500">Montant total</p>
                            <p className="mt-1 text-xl font-semibold text-white">{formatMAD(totalEstimate)}</p>
                            <p className="mt-1 text-xs text-carbon-500">{rentalDays} jours × {formatMAD(dailyPriceNumber || 0)}</p>
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <ReservationField label="Kilométrage sortie">
                            <input className={inputClass} type="number" value={draftMileageOut} onChange={(event) => setDraftMileageOut(event.target.value)} min={0} />
                          </ReservationField>
                          <ReservationField label="Niveau carburant sortie">
                            <input className={inputClass} value={draftFuelLevelOut} onChange={(event) => setDraftFuelLevelOut(event.target.value)} placeholder="Ex: 3/4" />
                          </ReservationField>
                        </div>
                        <ReservationField label="Statut">
                          <select className={inputClass} value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as ReservationStatus)}>
                            <option value="Confirmed">Confirmée</option>
                            <option value="Active">Active</option>
                            <option value="Completed">Terminée</option>
                            <option value="Cancelled">Annulée</option>
                          </select>
                        </ReservationField>
                        <ReservationField label="Notes">
                          <textarea className={`${inputClass} min-h-24 resize-none py-3 leading-6`} value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} placeholder="Préférences client, accessoires, remarques..." />
                        </ReservationField>
                      </section>
                    ) : null}

                    {reservationStep === 4 ? (
                      <section className="space-y-5">
                        <div>
                          <h3 className="text-xl font-semibold text-white">Confirmation</h3>
                          <p className="mt-1 text-sm text-carbon-400">Vérifiez les informations avant enregistrement.</p>
                        </div>
                        <div className="premium-surface rounded-3xl p-5">
                          <p className="text-lg font-semibold text-white">{selectedClient?.fullName || 'Client non sélectionné'}</p>
                          <p className="mt-1 text-sm text-carbon-400">{selectedVehicle?.brand} {selectedVehicle?.model} · <PlateNumber value={selectedVehicle?.plate} /></p>
                          <p className="mt-2 text-sm text-carbon-300">{formatReservationDateTime(draftPickupDate, draftPickupTime)} → {formatReservationDateTime(draftReturnDate, draftReturnTime)} · {rentalDays} jours</p>
                          <p className="mt-2 text-sm text-carbon-300">{draftPickupLocation || 'Lieu départ non renseigné'} → {draftReturnLocation || 'Lieu retour non renseigné'}</p>
                          <p className="mt-4 text-2xl font-semibold text-white">{formatMAD(totalEstimate)}</p>
                          <p className="text-sm text-carbon-400">Caution: {formatMAD(depositNumber || 0)}</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="mb-3 text-xs font-black uppercase tracking-wide text-gold-200">Checklist</p>
                          <div className="grid gap-2">
                            {stepChecklist.map((item) => (
                              <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm">
                                <span className="text-carbon-200">{item.label}</span>
                                {item.ok ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> OK</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-200"><CircleAlert className="h-4 w-4" /> À vérifier</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    ) : null}

                    <div className="mt-5 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.025] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] lg:hidden">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-200">Résumé</p>
                          <p className="mt-1 truncate text-sm text-carbon-400">Aperçu avant validation</p>
                        </div>
                        <Badge>{draftStatus}</Badge>
                      </div>
                      <div className="grid gap-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-carbon-400"><UserRound className="h-4 w-4" /> Client</span>
                          <strong className="min-w-0 truncate text-right text-white">{selectedClient?.fullName || 'Non sélectionné'}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-carbon-400"><Car className="h-4 w-4" /> Véhicule</span>
                          <strong className="min-w-0 truncate text-right text-white">{selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'Non sélectionné'}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-carbon-400"><CalendarDays className="h-4 w-4" /> Durée</span>
                          <strong className="text-white">{rentalDays} jour(s)</strong>
                        </div>
                        <div className="h-px bg-white/10" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <p className="text-xs text-carbon-500">Total</p>
                            <p className="mt-1 truncate font-black text-white">{formatMAD(totalEstimate)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <p className="text-xs text-carbon-500">Caution</p>
                            <p className="mt-1 truncate font-black text-white">{formatMAD(depositNumber || 0)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-white/10 bg-[#0B0D10]/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+10px)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:px-7 sm:py-4 sm:pb-4">
                    <button
                      className="focus-ring h-11 min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-carbon-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10"
                      disabled={reservationStep === 0 || saving}
                      type="button"
                      onClick={() => setReservationStep((step) => Math.max(0, step - 1))}
                    >
                      Retour
                    </button>
                    {reservationStep < reservationSteps.length - 1 ? (
                      <button
                        className="focus-ring h-11 min-w-0 rounded-xl bg-[#D4A017] px-4 text-sm font-bold text-carbon-950 shadow-[0_10px_24px_rgba(212,160,23,.14)] transition hover:-translate-y-0.5 hover:bg-[#E8B923] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          if (!validateCurrentStep()) return;
                          setReservationStep((step) => Math.min(reservationSteps.length - 1, step + 1));
                        }}
                      >
                        Continuer
                      </button>
                    ) : (
                      <button
                        className="focus-ring h-11 min-w-0 rounded-xl bg-[#D4A017] px-3 text-sm font-bold text-carbon-950 shadow-[0_10px_24px_rgba(212,160,23,.14)] transition hover:-translate-y-0.5 hover:bg-[#E8B923] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:px-4"
                        type="submit"
                        disabled={saving}
                      >
                        {saving ? 'Enregistrement...' : editingReservation ? 'Enregistrer les modifications' : 'Créer la réservation'}
                      </button>
                    )}
                  </div>
                </div>

                <aside className="hidden border-t border-white/[0.07] bg-[#0F1115] p-5 lg:block lg:border-l lg:border-t-0 lg:p-6">
                  <div className="sticky top-6 space-y-5">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-carbon-500">Résumé réservation</h3>
                      <p className="mt-2 text-sm leading-6 text-carbon-400">Vérification rapide avant enregistrement.</p>
                    </div>

                    <div className="premium-surface rounded-3xl p-5">
                      {selectedVehicle ? (
                        <div className="flex gap-4">
                          <div className="vehicle-visual grid h-16 w-20 shrink-0 place-items-center rounded-2xl text-gold-200">
                            <Car className="h-7 w-7" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{selectedVehicle.brand} {selectedVehicle.model}</p>
                            <p className="mt-1 text-sm text-carbon-400"><PlateNumber value={selectedVehicle.plate} /> · {selectedVehicle.city}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-carbon-400">
                          Sélectionnez un véhicule pour afficher le résumé.
                        </div>
                      )}
                    </div>

                    <div className="premium-surface grid gap-3 rounded-3xl p-5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-carbon-400"><UserRound className="h-4 w-4" /> Client</span>
                        <strong className="text-right text-white">{selectedClient?.fullName || 'Non sélectionné'}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-carbon-400"><CalendarDays className="h-4 w-4" /> Durée</span>
                        <strong className="text-white">{rentalDays} jour(s)</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-carbon-400"><MapPin className="h-4 w-4" /> Départ</span>
                        <strong className="text-white">{formatReservationDateTime(draftPickupDate, draftPickupTime)}</strong>
                      </div>
                      <div className="h-px bg-white/10" />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-carbon-400">Montant total</span>
                        <strong className="text-lg text-white">{formatMAD(totalEstimate)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-carbon-400">Caution</span>
                        <strong className="text-white">{formatMAD(depositNumber || 0)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-carbon-400">Statut</span>
                        <Badge>{draftStatus}</Badge>
                      </div>
                    </div>
                  </div>
                </aside>
              </form>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Supprimer la réservation">
        <div className="space-y-4">
          <p className="text-sm text-carbon-300">Voulez-vous vraiment supprimer cette réservation ?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="danger" onClick={confirmDeleteReservation}>Supprimer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(detailsTarget)} onClose={() => setDetailsTarget(null)} title={`Détails · ${detailsTarget?.id || ''}`}>
        {detailsTarget ? (
          <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+8px)]">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#131821] via-[#0f141c] to-[#07090d] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#D4A017]/10 to-transparent" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold-300">{detailsTarget.id}</p>
                  <h3 className="mt-1 truncate text-lg font-black text-white">{detailsTarget.vehicle}</h3>
                  <p className="mt-1 flex items-center gap-2 truncate text-sm font-semibold text-carbon-300"><UserRound className="h-4 w-4 text-carbon-500" /> {detailsTarget.client}</p>
                </div>
                <Badge>{detailsTarget.status}</Badge>
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-carbon-500">Total</p>
                  <p className="mt-1 truncate font-black text-white">{formatMAD(detailsTarget.totalAmount ?? detailsTarget.dailyPrice)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-carbon-500">Caution</p>
                  <p className="mt-1 truncate font-black text-white">{formatMAD(detailsTarget.deposit || 0)}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-carbon-300">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gold-200" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-carbon-500">Période</p>
                  <p className="mt-1 text-white">{formatReservationDateTime(detailsTarget.pickupDate, detailsTarget.pickupTime)} → {formatReservationDateTime(detailsTarget.returnDate, detailsTarget.returnTime)}</p>
                </div>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-200" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-carbon-500">Lieux</p>
                  <p className="mt-1 text-white">{detailsTarget.pickupLocation || 'Non renseigné'}</p>
                  <p className="mt-1 text-carbon-400">{detailsTarget.returnLocation || 'Non renseigné'}</p>
                </div>
              </div>
              <div className="h-px bg-white/10" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-carbon-500">Notes</p>
                <p className="mt-1 leading-6 text-carbon-300">{detailsTarget.notes || 'Aucune note'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {(() => {
                const detailsClient = clients.find((item) => item.id === detailsTarget.clientId);
                const whatsappUrl = buildWhatsAppReminderUrl({
                  kind: 'confirmation',
                  phone: detailsClient?.phone,
                  clientName: detailsTarget.client,
                  vehicle: detailsTarget.vehicle,
                  date: detailsTarget.pickupDate,
                });
                if (!notificationPreferences.reservationConfirmation) {
                  return <Button variant="secondary" className="min-w-0 rounded-xl px-2.5 text-xs sm:px-4 sm:text-sm" disabled>WhatsApp désactivé</Button>;
                }
                return whatsappUrl ? (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    <Button variant="secondary" className="w-full min-w-0 rounded-xl px-2.5 text-xs sm:w-auto sm:px-4 sm:text-sm" icon={<MessageCircle className="h-4 w-4" />}>WhatsApp</Button>
                  </a>
                ) : (
                  <Button variant="secondary" className="min-w-0 rounded-xl px-2.5 text-xs sm:px-4 sm:text-sm" disabled>Téléphone manquant</Button>
                );
              })()}
              <Button variant="secondary" className="min-w-0 rounded-xl px-2.5 text-xs sm:px-4 sm:text-sm" icon={<Pencil className="h-4 w-4" />} onClick={() => { setDetailsTarget(null); openEditReservation(detailsTarget); }}>
                Modifier
              </Button>
              <Button variant="secondary" className="min-w-0 rounded-xl px-2.5 text-xs sm:px-4 sm:text-sm" icon={<FileSignature className="h-4 w-4" />} onClick={() => navigate(`/contracts?reservation=${encodeURIComponent(detailsTarget.id)}`)}>
                Générer
              </Button>
              <Button variant="secondary" className="min-w-0 rounded-xl px-2.5 text-xs sm:px-4 sm:text-sm" onClick={() => handleUpdateStatus(detailsTarget, 'Completed')}>
                Terminée
              </Button>
              <Button variant="danger" className="min-w-0 rounded-xl px-2.5 text-xs sm:px-4 sm:text-sm" onClick={() => handleUpdateStatus(detailsTarget, 'Cancelled')}>
                Annuler
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
