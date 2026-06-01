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
import { getReservationPaymentSummary } from '../lib/paymentBalance';

type ViewMode = 'list' | 'grid';
type ReservationFilterStatus = 'All' | ReservationStatus;
type PaymentFilter = 'all' | 'paid' | 'partial' | 'unpaid';
type AdvancedReservationFilters = {
  startDate: string;
  endDate: string;
  status: ReservationFilterStatus;
  clientId: string;
  vehicleId: string;
  city: string;
  payment: PaymentFilter;
};
const statuses: Array<ReservationFilterStatus> = ['All', 'Confirmed', 'Active', 'Completed', 'Cancelled'];
const reservationSteps = ['Client', 'Véhicule', 'Dates & lieux', 'Tarif & caution', 'Validation'];
const emptyAdvancedFilters: AdvancedReservationFilters = {
  startDate: '',
  endDate: '',
  status: 'All',
  clientId: '',
  vehicleId: '',
  city: '',
  payment: 'all',
};

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

function formatShortDate(date: string) {
  if (!date) return '—';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('fr-MA', { day: '2-digit', month: 'short' }).format(parsed);
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

function urgencyBadge(reservation: Reservation, todayIso: string) {
  if (reservation.returnDate < todayIso && reservation.status !== 'Completed' && reservation.status !== 'Cancelled') {
    return { label: 'En retard', className: 'border-rose-300/40 bg-rose-500/15 text-rose-700 dark:text-rose-100' };
  }
  if (reservation.pickupDate === todayIso) {
    return { label: "Départ aujourd'hui", className: 'border-amber-300/40 bg-amber-500/15 text-amber-700 dark:text-amber-100' };
  }
  if (reservation.returnDate === todayIso) {
    return { label: "Retour aujourd'hui", className: 'border-sky-300/40 bg-sky-500/15 text-sky-700 dark:text-sky-100' };
  }
  if (reservation.pickupDate > todayIso) {
    return { label: 'À venir', className: 'border-emerald-300/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-100' };
  }
  return null;
}

function ReservationField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[var(--app-text)]">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[var(--app-text-muted)]">{hint}</span> : null}
    </label>
  );
}

function ReservationFilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--app-gold-text)]">{label}</span>
      {children}
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
  const [clientSearch, setClientSearch] = useState('');
  const [status, setStatus] = useState<ReservationFilterStatus>('All');
  const [view, setView] = useState<ViewMode>('grid');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedReservationFilters>(emptyAdvancedFilters);
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState<AdvancedReservationFilters>(emptyAdvancedFilters);

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
  const bookedVehiclePeriods = useMemo(
    () =>
      [...vehicleReservations].sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime()),
    [vehicleReservations],
  );
  const availabilityDays = useMemo(() => {
    const baseDate = draftPickupDate || todayIso;
    const start = new Date(`${baseDate}T00:00:00`);
    const safeStart = Number.isNaN(start.getTime()) ? new Date(`${todayIso}T00:00:00`) : start;
    return Array.from({ length: 14 }).map((_, index) => {
      const date = new Date(safeStart);
      date.setDate(safeStart.getDate() + index);
      const iso = date.toISOString().slice(0, 10);
      const booked = bookedVehiclePeriods.find((reservation) => isDateOverlap(iso, iso, reservation.pickupDate, reservation.returnDate));
      return { iso, booked };
    });
  }, [bookedVehiclePeriods, draftPickupDate, todayIso]);

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
      const advancedStatusMatch = advancedFilters.status === 'All' || reservation.status === advancedFilters.status;
      const startMatch = !advancedFilters.startDate || reservation.pickupDate >= advancedFilters.startDate || reservation.returnDate >= advancedFilters.startDate;
      const endMatch = !advancedFilters.endDate || reservation.pickupDate <= advancedFilters.endDate || reservation.returnDate <= advancedFilters.endDate;
      const clientMatch = !advancedFilters.clientId || reservation.clientId === advancedFilters.clientId;
      const vehicleMatch = !advancedFilters.vehicleId || reservation.vehicleId === advancedFilters.vehicleId;
      const cityMatch = !advancedFilters.city || reservation.city === advancedFilters.city || reservation.pickupLocation === advancedFilters.city || reservation.returnLocation === advancedFilters.city;
      const paymentSummary = getReservationPaymentSummary(reservation, payments);
      const paymentMatch =
        advancedFilters.payment === 'all' ||
        (advancedFilters.payment === 'paid' && paymentSummary.remaining <= 0) ||
        (advancedFilters.payment === 'partial' && paymentSummary.paid > 0 && paymentSummary.remaining > 0) ||
        (advancedFilters.payment === 'unpaid' && paymentSummary.paid <= 0 && paymentSummary.remaining > 0);
      return statusMatch && advancedStatusMatch && startMatch && endMatch && clientMatch && vehicleMatch && cityMatch && paymentMatch && (!q || haystack.includes(q));
    });
  }, [advancedFilters, payments, query, reservations, status]);

  const filterOptions = useMemo(() => {
    const cities = Array.from(new Set(reservations.flatMap((reservation) => [reservation.city, reservation.pickupLocation, reservation.returnLocation]).filter(Boolean))).sort();
    return { cities };
  }, [reservations]);

  const filteredClientChoices = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients
      .filter((client) => `${client.fullName} ${client.phone} ${client.cin} ${client.license}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [clientSearch, clients]);

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
    setClientSearch('');
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
    setClientSearch(reservation.client || '');
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
    if (reservationStep !== reservationSteps.length - 1) {
      notify({ title: 'Validation finale requise', message: 'Cliquez sur Continuer jusqu’à l’étape Validation avant de créer la réservation.', type: 'warning' });
      return;
    }
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
      agencyId: editingReservation?.agencyId || selectedVehicle.agencyId || selectedClient.agencyId || profile?.agencyId || profile?.agency?.id || null,
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
      console.error('Reservation save failed', {
        payload,
        selectedClientId: selectedClient?.id,
        selectedVehicleId: selectedVehicle?.id,
        startDate: draftPickupDate,
        endDate: draftReturnDate,
        pickupLocation: draftPickupLocation,
        returnLocation: draftReturnLocation,
        totalPrice: totalEstimate,
        status: draftStatus,
        error,
      });
      const rawMessage = error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : '';
      const friendlyMessage =
        rawMessage.includes('Client') ? 'Client manquant'
          : rawMessage.includes('Véhicule') || rawMessage.includes('véhicule') ? 'Véhicule manquant'
            : rawMessage.includes('Date') || rawMessage.includes('date') ? 'Dates invalides'
              : rawMessage.includes('agence liée') ? rawMessage
                : rawMessage || 'Réessayez dans quelques instants.';
      notify({
        title: 'Enregistrement impossible',
        message: friendlyMessage,
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
            className="relative min-h-[118px] min-w-[148px] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3.5 shadow-[0_14px_36px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.05)] sm:min-w-0 sm:p-4"
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accent} to-transparent`} />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[10px] font-black uppercase leading-4 tracking-[0.12em] text-[var(--app-text-muted)]">{label}</p>
                  <p className="mt-2 truncate text-[1.45rem] font-black leading-none text-[var(--app-text)] sm:text-2xl">{value}</p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] border border-[#D4A017]/20 bg-[#D4A017]/10 text-[var(--app-gold-text)] shadow-[0_0_20px_rgba(212,160,23,0.10)]">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-[11px] font-semibold text-[var(--app-text-muted)]">{trend}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="mb-5 rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_18px_46px_rgba(0,0,0,.24)] md:p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto_auto_auto] xl:items-center">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(sanitizeText(event.target.value, 120))}
              placeholder="Rechercher client, véhicule, ville ou référence"
              className="focus-ring h-12 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-input)] pl-10 pr-4 text-sm text-[var(--app-text)] shadow-[inset_0_1px_0_rgba(255,255,255,.035)] transition placeholder:text-[var(--app-text-muted)] hover:border-gold-300/25"
            />
          </label>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {statuses.map((item) => (
              <button
                key={item}
                className={`focus-ring h-10 shrink-0 rounded-xl px-3 text-xs font-black transition md:text-sm ${
                  status === item ? 'bg-gold-400 text-carbon-950 shadow-[0_10px_22px_rgba(212,160,23,.14)]' : 'border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] hover:bg-[var(--app-gold-soft)]'
                }`}
                onClick={() => setStatus(item)}
              >
                {item === 'All' ? 'Tous' : statusFr(item)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 text-sm font-black text-[var(--app-text-soft)] transition hover:border-gold-300/30 hover:bg-gold-400/10 hover:text-[var(--app-gold-text)]"
            onClick={() => {
              setDraftAdvancedFilters(advancedFilters);
              setFilterDrawerOpen(true);
            }}
          >
            <ListFilter className="h-4 w-4" />
            Filtres
          </button>
          <div className="grid grid-cols-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-1 md:flex">
            <button className={`focus-ring grid h-10 min-w-0 place-items-center rounded-xl ${view === 'list' ? 'bg-gold-400 text-carbon-950' : 'text-[var(--app-text-soft)]'}`} onClick={() => setView('list')} aria-label="Vue liste">
              <ListFilter className="h-4 w-4" />
            </button>
            <button className={`focus-ring grid h-10 min-w-0 place-items-center rounded-xl ${view === 'grid' ? 'bg-gold-400 text-carbon-950' : 'text-[var(--app-text-soft)]'}`} onClick={() => setView('grid')} aria-label="Vue cartes">
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
        <Card className="data-table hidden overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-[var(--app-border)] text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
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
              <tbody className="divide-y divide-[var(--app-border)]">
                {filteredReservations.map((reservation) => {
                  const paymentSummary = getReservationPaymentSummary(reservation, payments);
                  return (
                    <tr key={reservation.id} className="transition hover:bg-[var(--app-surface-soft)]">
                      <td className="px-5 py-4 font-bold text-[var(--app-text)]">{reservation.id}</td>
                      <td className="px-5 py-4 text-[var(--app-text-soft)]">{reservation.client}</td>
                      <td className="px-5 py-4 text-[var(--app-text-soft)]">{reservation.vehicle}</td>
                      <td className="px-5 py-4 text-[var(--app-text-muted)]">{formatReservationDateTime(reservation.pickupDate, reservation.pickupTime)} → {formatReservationDateTime(reservation.returnDate, reservation.returnTime)}</td>
                      <td className="px-5 py-4"><Badge>{reservation.status}</Badge></td>
                      <td className="px-5 py-4">
                        <p className="font-black text-[var(--app-text)]">{formatMAD(paymentSummary.total)}</p>
                        <p className="mt-1 text-xs text-[var(--app-text-muted)]">Reste: <span className={paymentSummary.remaining > 0 ? 'font-bold text-amber-700 dark:text-amber-200' : 'font-bold text-emerald-700 dark:text-emerald-200'}>{formatMAD(paymentSummary.remaining)}</span></p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" className="h-9 rounded-xl px-2.5 text-xs" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEditReservation(reservation)}>Modifier</Button>
                          <Button variant="secondary" className="h-9 rounded-xl px-2.5 text-xs" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setDetailsTarget(reservation)}>Détails</Button>
                          <Button variant="secondary" className="h-9 rounded-xl px-2.5 text-xs" icon={<FileSignature className="h-3.5 w-3.5" />} onClick={() => navigate(`/contracts?reservation=${encodeURIComponent(reservation.id)}`)}>Générer contrat</Button>
                          <Button variant="danger" className="h-9 rounded-xl px-2.5 text-xs" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteTarget(reservation)}>Supprimer</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {filteredReservations.map((reservation) => {
            const days = getRentalDays(reservation.pickupDate, reservation.returnDate);
            const urgency = urgencyBadge(reservation, todayIso);
            const paymentSummary = getReservationPaymentSummary(reservation, payments);
            return (
              <Card key={reservation.id} interactive className="group relative overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-0 shadow-[0_16px_42px_rgba(16,24,32,.12),inset_0_1px_0_rgba(255,255,255,.06)] transition-all hover:border-[#D4A017]/35 dark:shadow-[0_18px_48px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.04)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#D4A017]/10 to-transparent opacity-80" />
                <div className="relative border-b border-[var(--app-border)] px-4 pb-3 pt-4 md:px-5 md:pt-5">
                  <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex rounded-full border border-gold-300/25 bg-gold-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">{reservation.id}</p>
                    <h3 className="mt-2 truncate text-base font-black text-[var(--app-text)] md:text-lg">{reservation.vehicle}</h3>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-[var(--app-text-soft)]">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-[var(--app-text-muted)]" />
                      <span className="truncate">{reservation.client}</span>
                    </p>
                  </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge>{reservation.status}</Badge>
                      {urgency ? (
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${urgency.className}`}>
                          {urgency.label}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="font-black text-[var(--app-text)]">{formatReservationDateTime(reservation.pickupDate, reservation.pickupTime)}</p>
                      <p className="mt-0.5 truncate text-[var(--app-text-muted)]">Départ</p>
                    </div>
                    <span className="rounded-full border border-gold-300/25 bg-gold-400/10 px-2 py-1 font-black text-[var(--app-gold-text)]">{days}j</span>
                    <div className="min-w-0 text-right">
                      <p className="font-black text-[var(--app-text)]">{formatReservationDateTime(reservation.returnDate, reservation.returnTime)}</p>
                      <p className="mt-0.5 truncate text-[var(--app-text-muted)]">Retour</p>
                    </div>
                  </div>
                </div>

                <div className="relative px-4 py-3 md:px-5">
                  <div className="grid gap-2 text-sm text-[var(--app-text-soft)]">
                    <p className="flex min-w-0 items-start gap-2 leading-5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-gold-text)]" /> <span className="truncate">Départ: {reservation.pickupLocation || 'Lieu non renseigné'}</span></p>
                    <p className="flex min-w-0 items-start gap-2 leading-5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-gold-text)]" /> <span className="truncate">Retour: {reservation.returnLocation || 'Lieu non renseigné'}</span></p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ReservationMoneyTile label="Total" value={formatMAD(paymentSummary.total)} />
                    <ReservationMoneyTile label="Caution" value={formatMAD(reservation.deposit || 0)} />
                    <ReservationMoneyTile label="Payé" value={formatMAD(paymentSummary.paid)} />
                    <ReservationMoneyTile
                      label="Reste"
                      value={paymentSummary.remaining > 0 ? formatMAD(paymentSummary.remaining) : 'Payé intégralement'}
                      valueClassName={paymentSummary.remaining > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-200'}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-gold-300/20 bg-gold-400/10 text-[var(--app-gold-text)]">
                        <Wallet className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Paiement</p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-[var(--app-text-soft)]">{paymentSummary.relatedPayments.length} paiement(s) lié(s)</p>
                      </div>
                    </div>
                    <Badge>{paymentSummary.statusFr}</Badge>
                  </div>
                </div>

                <div className="relative grid grid-cols-2 gap-2 border-t border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 sm:grid-cols-4">
                  <Button variant="secondary" className="h-10 min-w-0 rounded-xl px-2 text-xs" icon={<Pencil className="h-3.5 w-3.5 shrink-0" />} onClick={() => openEditReservation(reservation)}>Modifier</Button>
                  <Button variant="secondary" className="h-10 min-w-0 rounded-xl px-2 text-xs" icon={<Eye className="h-3.5 w-3.5 shrink-0" />} onClick={() => setDetailsTarget(reservation)}>Détails</Button>
                  <Button variant="secondary" className="h-10 min-w-0 rounded-xl px-2 text-xs" icon={<FileSignature className="h-3.5 w-3.5 shrink-0" />} onClick={() => navigate(`/contracts?reservation=${encodeURIComponent(reservation.id)}`)}>Générer</Button>
                  <Button variant="danger" className="h-10 min-w-0 rounded-xl px-2 text-xs" icon={<Trash2 className="h-3.5 w-3.5 shrink-0" />} onClick={() => setDeleteTarget(reservation)}>Supprimer</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={filterDrawerOpen} title="Filtres réservations" subtitle="Affinez la liste avec les données existantes." onClose={() => setFilterDrawerOpen(false)} panelClassName="sm:max-w-2xl" bodyClassName="p-0">
        <div className="grid max-h-[calc(100dvh-9rem)] grid-rows-[1fr_auto] overflow-hidden bg-[var(--app-modal)]">
          <div className="overflow-y-auto px-4 py-4 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReservationFilterField label="Date début">
                <input className="form-control h-11 rounded-2xl text-sm" type="date" value={draftAdvancedFilters.startDate} onChange={(event) => setDraftAdvancedFilters((current) => ({ ...current, startDate: event.target.value }))} />
              </ReservationFilterField>
              <ReservationFilterField label="Date fin">
                <input className="form-control h-11 rounded-2xl text-sm" type="date" value={draftAdvancedFilters.endDate} onChange={(event) => setDraftAdvancedFilters((current) => ({ ...current, endDate: event.target.value }))} />
              </ReservationFilterField>
              <ReservationFilterField label="Statut">
                <select className="form-control h-11 rounded-2xl text-sm" value={draftAdvancedFilters.status} onChange={(event) => setDraftAdvancedFilters((current) => ({ ...current, status: event.target.value as ReservationFilterStatus }))}>
                  {statuses.map((item) => <option key={item} value={item}>{item === 'All' ? 'Tous' : statusFr(item)}</option>)}
                </select>
              </ReservationFilterField>
              <ReservationFilterField label="Client">
                <select className="form-control h-11 rounded-2xl text-sm" value={draftAdvancedFilters.clientId} onChange={(event) => setDraftAdvancedFilters((current) => ({ ...current, clientId: event.target.value }))}>
                  <option value="">Tous les clients</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.fullName}</option>)}
                </select>
              </ReservationFilterField>
              <ReservationFilterField label="Véhicule">
                <select className="form-control h-11 rounded-2xl text-sm" value={draftAdvancedFilters.vehicleId} onChange={(event) => setDraftAdvancedFilters((current) => ({ ...current, vehicleId: event.target.value }))}>
                  <option value="">Tous les véhicules</option>
                  {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model}</option>)}
                </select>
              </ReservationFilterField>
              <ReservationFilterField label="Ville / lieu">
                <select className="form-control h-11 rounded-2xl text-sm" value={draftAdvancedFilters.city} onChange={(event) => setDraftAdvancedFilters((current) => ({ ...current, city: event.target.value }))}>
                  <option value="">Toutes les villes / lieux</option>
                  {filterOptions.cities.map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
              </ReservationFilterField>
              <ReservationFilterField label="Paiement">
                <select className="form-control h-11 rounded-2xl text-sm" value={draftAdvancedFilters.payment} onChange={(event) => setDraftAdvancedFilters((current) => ({ ...current, payment: event.target.value as PaymentFilter }))}>
                  <option value="all">Tous</option>
                  <option value="paid">Payé</option>
                  <option value="partial">Partiel</option>
                  <option value="unpaid">Impayé</option>
                </select>
              </ReservationFilterField>
            </div>
          </div>
          <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-[var(--app-border)] bg-[var(--app-modal)]/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur sm:flex sm:justify-end sm:px-6">
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-xl"
              onClick={() => {
                setDraftAdvancedFilters(emptyAdvancedFilters);
                setAdvancedFilters(emptyAdvancedFilters);
                setFilterDrawerOpen(false);
              }}
            >
              Réinitialiser
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl"
              onClick={() => {
                setAdvancedFilters(draftAdvancedFilters);
                setFilterDrawerOpen(false);
              }}
            >
              Appliquer les filtres
            </Button>
          </div>
        </div>
      </Modal>

      <AnimatePresence>
        {modalOpen ? (
          <motion.div className="fixed inset-0 z-50 overflow-hidden bg-carbon-950/75 p-0 backdrop-blur-sm sm:p-4 lg:flex lg:items-center lg:justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button aria-label="Fermer" className="absolute inset-0 h-full w-full cursor-default" onClick={() => !saving && setModalOpen(false)} />
            <motion.aside
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.985 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-7xl flex-col overflow-hidden rounded-none border border-[var(--app-border)] bg-[var(--app-modal)] shadow-[0_26px_80px_rgba(0,0,0,.55)] sm:h-full sm:max-h-none sm:rounded-[1.35rem] lg:h-[92dvh] lg:max-h-[920px]"
            >
              <div className="shrink-0 border-b border-[var(--app-border)] bg-[var(--app-modal)]/95 px-4 py-2.5 backdrop-blur sm:px-6 sm:py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black tracking-tight text-[var(--app-text)] sm:text-xl">{editingReservation ? 'Modifier une réservation' : 'Ajouter une réservation'}</h2>
                    <p className="mt-0.5 truncate text-xs font-medium text-[var(--app-text-muted)]">Création guidée, validation claire.</p>
                  </div>
                  <button className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]" onClick={() => !saving && setModalOpen(false)} type="button">
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>

              <form className={`grid min-h-0 flex-1 overflow-hidden ${reservationStep === 4 ? 'lg:grid-cols-[minmax(0,7fr)_minmax(290px,3fr)]' : ''}`} onSubmit={handleSubmitReservation}>
                <div className="flex min-h-0 flex-col">
                  <div className="shrink-0 border-b border-[var(--app-border)] bg-[var(--app-modal)]/95 px-3 py-2 backdrop-blur sm:px-6 sm:py-3">
                    <div className="no-scrollbar -mx-1 flex items-start gap-1 overflow-x-auto px-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-0 sm:overflow-visible sm:px-0">
                      {reservationSteps.map((step, index) => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => setReservationStep(index)}
                          className="group relative min-w-[76px] px-0.5 text-center sm:min-w-0"
                        >
                          {index > 0 ? <span className={`absolute left-0 top-3.5 h-px w-1/2 ${reservationStep >= index ? 'bg-gold-400/80' : 'bg-[var(--app-surface-soft)]'}`} /> : null}
                          {index < reservationSteps.length - 1 ? <span className={`absolute right-0 top-3.5 h-px w-1/2 ${reservationStep > index ? 'bg-gold-400/80' : 'bg-[var(--app-surface-soft)]'}`} /> : null}
                          <span className={`relative mx-auto grid h-7 w-7 place-items-center rounded-full border text-[11px] font-black transition sm:h-8 sm:w-8 sm:text-xs ${
                            reservationStep === index
                              ? 'border-gold-300 bg-gold-400 text-carbon-950 shadow-[0_0_22px_rgba(212,160,23,.24)]'
                              : reservationStep > index
                                ? 'border-gold-300/45 bg-gold-400/12 text-[var(--app-gold-text)]'
                                : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-muted)] group-hover:text-[var(--app-text-soft)]'
                          }`}>
                            {reservationStep > index ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                          </span>
                          <span className={`mt-1 block truncate text-[8.5px] font-black uppercase tracking-[0.06em] sm:text-[10px] ${
                            reservationStep === index ? 'text-[var(--app-gold-text)]' : 'text-[var(--app-text-muted)]'
                          }`}>
                            {step}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-24 sm:px-6 sm:py-5 sm:pb-28">
                    {reservationStep === 0 ? (
                      <section className="space-y-3 sm:space-y-4">
                        <div className="flex items-end justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-base font-black text-[var(--app-text)] sm:text-lg">Client</h3>
                            <p className="mt-0.5 text-xs text-[var(--app-text-muted)] sm:text-sm">Recherchez et sélectionnez le client associé.</p>
                          </div>
                        </div>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-gold-text)]" />
                          <input
                            className="form-control focus-ring h-11 w-full rounded-2xl border-[var(--app-border)] bg-[var(--app-surface-soft)] pl-10 pr-4 text-sm"
                            value={clientSearch}
                            onChange={(event) => setClientSearch(sanitizeText(event.target.value, 120))}
                            placeholder="Rechercher par nom, téléphone, CIN ou permis..."
                          />
                        </div>
                        <div className="grid gap-2">
                          {filteredClientChoices.map((client) => {
                            const isSelected = client.id === draftClientId;
                            const docsComplete = Boolean(client.idCardFrontUrl && client.idCardBackUrl);
                            const initials = client.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
                            return (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => {
                                  setDraftClientId(client.id);
                                  setClientSearch(client.fullName);
                                }}
                                className={`focus-ring group min-w-0 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${
                                  isSelected
                                    ? 'border-gold-300/55 bg-gold-400/10 shadow-[0_0_28px_rgba(212,160,23,.10)]'
                                    : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] hover:border-gold-300/25 hover:bg-[var(--app-surface-soft)]'
                                }`}
                              >
                                <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black sm:h-11 sm:w-11 sm:rounded-2xl sm:text-sm ${isSelected ? 'bg-gold-400 text-carbon-950' : 'bg-[var(--app-surface-soft)] text-[var(--app-text)]'}`}>
                                    {initials || 'CL'}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                                      <span className="truncate text-sm font-black text-[var(--app-text)] sm:text-base">{client.fullName}</span>
                                      {client.status === 'New' ? <span className="rounded-full border border-gold-300/25 bg-gold-400/12 px-2 py-0.5 text-[10px] font-black text-[var(--app-gold-text)]">Nouveau</span> : null}
                                      {client.status === 'VIP' ? <span className="rounded-full border border-gold-300/30 bg-gold-400/16 px-2 py-0.5 text-[10px] font-black text-[var(--app-gold-text)]">VIP</span> : null}
                                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${docsComplete ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200' : 'border-amber-300/25 bg-amber-500/12 text-amber-700 dark:text-amber-100'}`}>
                                        {docsComplete ? 'Documents complets' : 'Docs à compléter'}
                                      </span>
                                    </span>
                                    <span className="mt-1 grid gap-x-3 gap-y-1 text-[11px] text-[var(--app-text-muted)] sm:grid-cols-3 sm:text-xs">
                                      <span className="truncate">Tél. {client.phone || '—'}</span>
                                      <span className="truncate">CIN {client.cin || '—'}</span>
                                      <span className="truncate">Permis {client.license || '—'}</span>
                                    </span>
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                          {filteredClientChoices.length === 0 ? (
                            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-[var(--app-text-muted)]">Aucun client trouvé.</div>
                          ) : null}
                        </div>
                        {selectedClient ? (
                          <input className="sr-only" value={selectedClient.id} readOnly required />
                        ) : null}
                      </section>
                    ) : null}

                    {reservationStep === 1 ? (
                      <section className="space-y-3 sm:space-y-4">
                        <div>
                          <h3 className="text-base font-black text-[var(--app-text)] sm:text-lg">Véhicule</h3>
                          <p className="mt-0.5 text-xs text-[var(--app-text-muted)] sm:text-sm">Choisissez le véhicule disponible pour la période.</p>
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
                          <div className="premium-surface grid gap-3 rounded-2xl p-3 sm:grid-cols-[180px_1fr] sm:rounded-3xl sm:p-5">
                            <div className="relative h-24 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] sm:h-28 sm:rounded-3xl">
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
                                  <Car className="h-14 w-14 text-[var(--app-text)]/70" strokeWidth={1.3} />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-3">
                                <p className="text-sm font-black text-[var(--app-text)] sm:text-base">{selectedVehicle.brand} {selectedVehicle.model}</p>
                                <Badge>{selectedVehicle.status}</Badge>
                              </div>
                              <p className="mt-1 text-xs text-[var(--app-text-muted)] sm:text-sm"><PlateNumber value={selectedVehicle.plate} /> · {selectedVehicle.city}</p>
                              <p className="mt-2 text-xs text-[var(--app-text-soft)] sm:mt-3 sm:text-sm">{selectedVehicle.mileage.toLocaleString()} km · {formatMAD(selectedVehicle.dailyPrice)} / jour</p>
                            </div>
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {reservationStep === 2 ? (
                      <section className="space-y-3 sm:space-y-4">
                        <div>
                          <h3 className="text-base font-black text-[var(--app-text)] sm:text-lg">Dates & lieux</h3>
                          <p className="mt-0.5 text-xs text-[var(--app-text-muted)] sm:text-sm">Définissez les dates, lieux et validez la disponibilité.</p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
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
                        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                          <ReservationField label="Lieu de départ" hint="Obligatoire pour le contrat">
                            <input className={inputClass} value={draftPickupLocation} onChange={(event) => setDraftPickupLocation(event.target.value)} placeholder="Aéroport, hôtel, agence..." required />
                          </ReservationField>
                          <ReservationField label="Lieu de retour">
                            <input className={inputClass} value={draftReturnLocation} onChange={(event) => setDraftReturnLocation(event.target.value)} placeholder="Adresse de retour..." />
                          </ReservationField>
                        </div>
                        <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] sm:p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="grid h-8 w-8 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-[var(--app-gold-text)]">
                                  <CalendarDays className="h-4 w-4" />
                                </span>
                                <h4 className="text-sm font-black text-[var(--app-text)]">Disponibilité du véhicule</h4>
                              </div>
                              <p className="mt-1 text-xs text-[var(--app-text-muted)]">Consultez les périodes déjà réservées avant de choisir vos dates.</p>
                            </div>
                            {selectedVehicle ? (
                              <span className="w-fit rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-1 text-[11px] font-black text-[var(--app-text-soft)]">
                                {selectedVehicle.brand} {selectedVehicle.model}
                              </span>
                            ) : null}
                          </div>

                          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                            {availabilityDays.map((day) => (
                              <div
                                key={day.iso}
                                className={`min-w-[74px] rounded-2xl border px-2.5 py-2 text-center ${
                                  day.booked
                                    ? 'border-rose-300/40 bg-rose-500/12 text-rose-700 dark:text-rose-100'
                                    : 'border-emerald-300/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                }`}
                                title={day.booked ? `${day.booked.id} · ${day.booked.client}` : 'Disponible'}
                              >
                                <p className="text-[10px] font-black uppercase tracking-[0.12em]">{formatShortDate(day.iso)}</p>
                                <p className="mt-1 truncate text-[11px] font-bold">{day.booked ? 'Réservé' : 'Libre'}</p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 grid gap-2">
                            {bookedVehiclePeriods.length ? (
                              bookedVehiclePeriods.map((reservation) => (
                                <div
                                  key={reservation.id}
                                  className={`rounded-2xl border px-3 py-2 ${
                                    overlapReservation?.id === reservation.id
                                      ? 'border-rose-300/50 bg-rose-500/12'
                                      : 'border-[var(--app-border)] bg-[var(--app-surface-soft)]'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-black text-[var(--app-text)]">{formatShortDate(reservation.pickupDate)} → {formatShortDate(reservation.returnDate)}</p>
                                    <Badge>{reservation.status}</Badge>
                                  </div>
                                  <p className="mt-1 truncate text-xs font-semibold text-[var(--app-text-soft)]">{reservation.client || 'Client non renseigné'} · {reservation.id}</p>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-3 text-sm font-semibold text-[var(--app-text-muted)]">
                                Aucune réservation prévue pour ce véhicule.
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 sm:p-4">
                          <p className="text-sm font-semibold text-[var(--app-text-soft)]">Durée calculée: {rentalDays} jour(s)</p>
                          {overlapReservation ? (
                            <p className="mt-2 text-sm font-semibold text-rose-700 dark:text-rose-200">
                              Ce véhicule est déjà réservé sur cette période.
                              {nextAvailableDate ? ` Prochaine date disponible: ${nextAvailableDate}.` : ''}
                            </p>
                          ) : (
                            <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-200">Véhicule disponible pour cette période.</p>
                          )}
                        </div>
                      </section>
                    ) : null}

                    {reservationStep === 3 ? (
                      <section className="space-y-3 sm:space-y-4">
                        <div>
                          <h3 className="text-base font-black text-[var(--app-text)] sm:text-lg">Tarif & caution</h3>
                          <p className="mt-0.5 text-xs text-[var(--app-text-muted)] sm:text-sm">Ajustez le prix journalier, la caution et le statut.</p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.25fr] md:gap-4">
                          <ReservationField label="Prix journalier">
                            <input className={inputClass} type="number" value={draftDailyPrice} onChange={(event) => setDraftDailyPrice(event.target.value)} min={1} required />
                          </ReservationField>
                          <ReservationField label="Caution">
                            <input className={inputClass} type="number" value={draftDeposit} onChange={(event) => setDraftDeposit(event.target.value)} min={0} />
                          </ReservationField>
                          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-3 sm:px-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">Montant total</p>
                            <p className="mt-1 text-lg font-black text-[var(--app-text)]">{formatMAD(totalEstimate)}</p>
                            <p className="mt-1 text-xs text-[var(--app-text-muted)]">{rentalDays} jours × {formatMAD(dailyPriceNumber || 0)}</p>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
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
                      <section className="space-y-3 sm:space-y-4">
                        <div>
                          <h3 className="text-base font-black text-[var(--app-text)] sm:text-lg">Validation</h3>
                          <p className="mt-0.5 text-xs text-[var(--app-text-muted)] sm:text-sm">Vérifiez les informations avant enregistrement.</p>
                        </div>
                        <div className="premium-surface rounded-2xl p-4 sm:rounded-3xl sm:p-5">
                          <p className="text-base font-black text-[var(--app-text)]">{selectedClient?.fullName || 'Client non sélectionné'}</p>
                          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{selectedVehicle?.brand} {selectedVehicle?.model} · <PlateNumber value={selectedVehicle?.plate} /></p>
                          <p className="mt-2 text-sm text-[var(--app-text-soft)]">{formatReservationDateTime(draftPickupDate, draftPickupTime)} → {formatReservationDateTime(draftReturnDate, draftReturnTime)} · {rentalDays} jours</p>
                          <p className="mt-2 text-sm text-[var(--app-text-soft)]">{draftPickupLocation || 'Lieu départ non renseigné'} → {draftReturnLocation || 'Lieu retour non renseigné'}</p>
                          <p className="mt-4 text-2xl font-semibold text-[var(--app-text)]">{formatMAD(totalEstimate)}</p>
                          <p className="text-sm text-[var(--app-text-muted)]">Caution: {formatMAD(depositNumber || 0)}</p>
                        </div>

                        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 sm:p-4">
                          <p className="mb-3 text-xs font-black uppercase tracking-wide text-[var(--app-gold-text)]">Checklist</p>
                          <div className="grid gap-2">
                            {stepChecklist.map((item) => (
                              <div key={item.label} className="flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2 text-sm">
                                <span className="text-[var(--app-text-soft)]">{item.label}</span>
                                {item.ok ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> OK</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-200"><CircleAlert className="h-4 w-4" /> À vérifier</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    ) : null}

                    {reservationStep === 4 ? (
                    <div className="mt-3 rounded-2xl border border-gold-300/15 bg-[var(--app-card)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] sm:mt-5 sm:rounded-3xl sm:p-4 lg:hidden">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Aperçu avant validation</p>
                          <p className="mt-1 truncate text-xs text-[var(--app-text-muted)] sm:text-sm">Résumé final de la réservation</p>
                        </div>
                        <Badge>{draftStatus}</Badge>
                      </div>
                      <div className="grid gap-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-[var(--app-text-muted)]"><UserRound className="h-4 w-4" /> Client</span>
                          <strong className="min-w-0 truncate text-right text-[var(--app-text)]">{selectedClient?.fullName || 'Non sélectionné'}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-[var(--app-text-muted)]"><Car className="h-4 w-4" /> Véhicule</span>
                          <strong className="min-w-0 truncate text-right text-[var(--app-text)]">{selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'Non sélectionné'}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-[var(--app-text-muted)]"><CalendarDays className="h-4 w-4" /> Durée</span>
                          <strong className="text-[var(--app-text)]">{rentalDays} jour(s)</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-[var(--app-text-muted)]"><MapPin className="h-4 w-4" /> Départ</span>
                          <strong className="min-w-0 truncate text-right text-[var(--app-text)]">{formatReservationDateTime(draftPickupDate, draftPickupTime)}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-[var(--app-text-muted)]"><MapPin className="h-4 w-4" /> Retour</span>
                          <strong className="min-w-0 truncate text-right text-[var(--app-text)]">{formatReservationDateTime(draftReturnDate, draftReturnTime)}</strong>
                        </div>
                        <div className="h-px bg-[var(--app-surface-soft)]" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                            <p className="text-xs text-[var(--app-text-muted)]">Total</p>
                            <p className="mt-1 truncate font-black text-[var(--app-text)]">{formatMAD(totalEstimate)}</p>
                          </div>
                          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                            <p className="text-xs text-[var(--app-text-muted)]">Caution</p>
                            <p className="mt-1 truncate font-black text-[var(--app-text)]">{formatMAD(depositNumber || 0)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    ) : null}
                  </div>

                  <div className="sticky bottom-0 grid grid-cols-2 gap-2.5 border-t border-[var(--app-border)] bg-[var(--app-modal)]/95 px-3 py-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)] backdrop-blur sm:flex sm:items-center sm:justify-end sm:px-6 sm:py-3 sm:pb-3">
                    <button
                      className="focus-ring h-11 min-w-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 text-sm font-semibold text-[var(--app-text-soft)] transition hover:bg-[var(--app-surface-soft)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-10"
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
                        {saving ? 'Enregistrement...' : editingReservation ? 'Valider' : 'Créer'}
                      </button>
                    )}
                  </div>
                </div>

                {reservationStep === 4 ? (
                <aside className="hidden border-t border-[var(--app-border)] bg-[var(--app-card)] p-5 lg:block lg:border-l lg:border-t-0">
                  <div className="sticky top-5 space-y-4">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Aperçu avant validation</h3>
                      <p className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">Résumé permanent de la réservation.</p>
                    </div>

                    <div className="rounded-3xl border border-gold-300/15 bg-[var(--app-card)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                      {selectedVehicle ? (
                        <div className="flex gap-3">
                          <div className="vehicle-visual grid h-14 w-16 shrink-0 place-items-center rounded-2xl text-[var(--app-gold-text)]">
                            <Car className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-[var(--app-text)]">{selectedVehicle.brand} {selectedVehicle.model}</p>
                            <p className="mt-1 text-sm text-[var(--app-text-muted)]"><PlateNumber value={selectedVehicle.plate} /> · {selectedVehicle.city}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-[var(--app-border)] p-5 text-sm text-[var(--app-text-muted)]">
                          Sélectionnez un véhicule pour afficher le résumé.
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[var(--app-text-muted)]"><UserRound className="h-4 w-4" /> Client</span>
                        <strong className="min-w-0 truncate text-right text-[var(--app-text)]">{selectedClient?.fullName || 'Non sélectionné'}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[var(--app-text-muted)]"><Car className="h-4 w-4" /> Véhicule</span>
                        <strong className="min-w-0 truncate text-right text-[var(--app-text)]">{selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'Non sélectionné'}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[var(--app-text-muted)]"><CalendarDays className="h-4 w-4" /> Durée</span>
                        <strong className="text-[var(--app-text)]">{rentalDays} jour(s)</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[var(--app-text-muted)]"><MapPin className="h-4 w-4" /> Départ</span>
                        <strong className="min-w-0 truncate text-right text-[var(--app-text)]">{formatReservationDateTime(draftPickupDate, draftPickupTime)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[var(--app-text-muted)]"><MapPin className="h-4 w-4" /> Retour</span>
                        <strong className="min-w-0 truncate text-right text-[var(--app-text)]">{formatReservationDateTime(draftReturnDate, draftReturnTime)}</strong>
                      </div>
                      <div className="h-px bg-[var(--app-surface-soft)]" />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--app-text-muted)]">Montant total</span>
                        <strong className="text-lg text-[var(--app-text)]">{formatMAD(totalEstimate)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--app-text-muted)]">Caution</span>
                        <strong className="text-[var(--app-text)]">{formatMAD(depositNumber || 0)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--app-text-muted)]">Statut</span>
                        <Badge>{draftStatus}</Badge>
                      </div>
                    </div>
                  </div>
                </aside>
                ) : null}
              </form>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Supprimer la réservation">
        <div className="space-y-4">
          <p className="text-sm text-[var(--app-text-soft)]">Voulez-vous vraiment supprimer cette réservation ?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="danger" onClick={confirmDeleteReservation}>Supprimer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(detailsTarget)} onClose={() => setDetailsTarget(null)} title={`Détails · ${detailsTarget?.id || ''}`}>
        {detailsTarget ? (
          (() => {
            const detailsPaymentSummary = getReservationPaymentSummary(detailsTarget, payments);
            return (
              <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+8px)]">
                <div className="relative overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#D4A017]/10 to-transparent" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--app-gold-text)]">{detailsTarget.id}</p>
                      <h3 className="mt-1 truncate text-lg font-black text-[var(--app-text)]">{detailsTarget.vehicle}</h3>
                      <p className="mt-1 flex items-center gap-2 truncate text-sm font-semibold text-[var(--app-text-soft)]"><UserRound className="h-4 w-4 text-[var(--app-text-muted)]" /> {detailsTarget.client}</p>
                    </div>
                    <Badge>{detailsTarget.status}</Badge>
                  </div>
                  <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                      <p className="text-xs text-[var(--app-text-muted)]">Total</p>
                      <p className="mt-1 truncate font-black text-[var(--app-text)]">{formatMAD(detailsPaymentSummary.total)}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                      <p className="text-xs text-[var(--app-text-muted)]">Payé</p>
                      <p className="mt-1 truncate font-black text-[var(--app-text)]">{formatMAD(detailsPaymentSummary.paid)}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                      <p className="text-xs text-[var(--app-text-muted)]">Reste</p>
                      <p className={`mt-1 truncate font-black ${detailsPaymentSummary.remaining > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-200'}`}>{formatMAD(detailsPaymentSummary.remaining)}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                      <p className="text-xs text-[var(--app-text-muted)]">Caution</p>
                      <p className="mt-1 truncate font-black text-[var(--app-text)]">{formatMAD(detailsTarget.deposit || 0)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-[var(--app-text-soft)]">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-gold-text)]" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Période</p>
                  <p className="mt-1 text-[var(--app-text)]">{formatReservationDateTime(detailsTarget.pickupDate, detailsTarget.pickupTime)} → {formatReservationDateTime(detailsTarget.returnDate, detailsTarget.returnTime)}</p>
                </div>
              </div>
              <div className="h-px bg-[var(--app-surface-soft)]" />
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-gold-text)]" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Lieux</p>
                  <p className="mt-1 text-[var(--app-text)]">{detailsTarget.pickupLocation || 'Non renseigné'}</p>
                  <p className="mt-1 text-[var(--app-text-muted)]">{detailsTarget.returnLocation || 'Non renseigné'}</p>
                </div>
              </div>
              <div className="h-px bg-[var(--app-surface-soft)]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Notes</p>
                <p className="mt-1 leading-6 text-[var(--app-text-soft)]">{detailsTarget.notes || 'Aucune note'}</p>
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
            );
          })()
        ) : null}
      </Modal>
    </div>
  );
}

function ReservationMoneyTile({ label, value, valueClassName = 'text-[var(--app-text)]' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">{label}</p>
      <p className={`mt-1 truncate text-sm font-black md:text-base ${valueClassName}`}>{value}</p>
    </div>
  );
}
