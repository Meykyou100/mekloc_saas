import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Car, CheckCircle2, Filter, LayoutGrid, ListFilter, MapPin, Plus, Search, UserRound, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import {
  formatMAD,
  type Reservation,
  type ReservationStatus,
} from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

type ViewMode = 'table' | 'calendar';

const statuses: Array<'All' | ReservationStatus> = ['All', 'Confirmed', 'Active', 'Completed', 'Cancelled'];
const reservationPanelMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18 },
};

function getRentalDays(pickupDate: string, returnDate: string) {
  const pickup = new Date(pickupDate);
  const dropoff = new Date(returnDate);
  const days = Math.ceil((dropoff.getTime() - pickup.getTime()) / 86_400_000);
  return Number.isFinite(days) ? Math.max(1, days) : 1;
}

function ReservationField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-carbon-100 light:text-carbon-800">{label}</span>
      {children}
      {hint ? <span className="text-xs text-carbon-500">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'form-control focus-ring w-full text-sm';

const reservationSteps = ['Sélectionner client', 'Sélectionner véhicule', 'Choisir les dates', 'Tarif et caution', 'Confirmer'];

export default function ReservationsPage() {
  const { clients, vehicles, reservations, createReservation } = useData();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | ReservationStatus>('All');
  const [view, setView] = useState<ViewMode>('calendar');
  const [modalOpen, setModalOpen] = useState(false);
  const [draftClientId, setDraftClientId] = useState('');
  const [draftVehicleId, setDraftVehicleId] = useState('');
  const [draftPickupDate, setDraftPickupDate] = useState('2026-05-15');
  const [draftReturnDate, setDraftReturnDate] = useState('2026-05-19');
  const [draftDailyPrice, setDraftDailyPrice] = useState(850);
  const [draftDeposit, setDraftDeposit] = useState(4000);
  const [reservationStep, setReservationStep] = useState(0);
  const { notify } = useApp();

  const filteredReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      const haystack = `${reservation.client} ${reservation.vehicle} ${reservation.city} ${reservation.id}`.toLowerCase();
      return haystack.includes(query.toLowerCase()) && (status === 'All' || reservation.status === status);
    });
  }, [query, reservations, status]);

  const selectedClient = clients.find((client) => client.id === draftClientId) || clients[0];
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === draftVehicleId) || vehicles[0];
  const rentalDays = getRentalDays(draftPickupDate, draftReturnDate);
  const totalEstimate = rentalDays * Number(draftDailyPrice || selectedVehicle?.dailyPrice || 0);
  const isMobileCards = view === 'calendar';

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

  function openReservationPanel() {
    const firstClient = clients[0];
    const firstVehicle = vehicles[0];
    setDraftClientId(firstClient?.id || '');
    setDraftVehicleId(firstVehicle?.id || '');
    setDraftDailyPrice(firstVehicle?.dailyPrice || 850);
    setDraftDeposit(4000);
    setDraftPickupDate('2026-05-15');
    setDraftReturnDate('2026-05-19');
    setReservationStep(0);
    setModalOpen(true);
  }

  async function handleAddReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const clientId = String(form.get('client'));
    const vehicleId = String(form.get('vehicle'));
    const client = clients.find((item) => item.id === clientId) || clients[0];
    const vehicle = vehicles.find((item) => item.id === vehicleId) || vehicles[0];
    if (!client || !vehicle) {
      notify({
        title: 'Données incomplètes',
        message: 'Ajoutez au moins un client et un véhicule avant de créer une réservation.',
        type: 'warning',
      });
      return;
    }
    const nextReservation: Reservation = {
      id: `RS-${1024 + reservations.length + 1}`,
      client: client.fullName,
      clientId,
      vehicle: `${vehicle.brand} ${vehicle.model}`,
      vehicleId,
      pickupDate: String(form.get('pickupDate')),
      returnDate: String(form.get('returnDate')),
      dailyPrice: Number(form.get('dailyPrice') || vehicle.dailyPrice),
      deposit: Number(form.get('deposit') || 0),
      status: 'Confirmed',
      notes: String(form.get('notes') || ''),
      city: vehicle.city,
    };
    try {
      await createReservation(nextReservation);
      setModalOpen(false);
      notify({ title: 'Réservation ajoutée', message: `${client.fullName} est réservé(e) pour ${vehicle.model}.`, type: 'success' });
    } catch (error) {
      notify({
        title: 'Réservation non enregistrée',
        message: error instanceof Error ? error.message : 'Réessayez dans quelques instants.',
        type: 'warning',
      });
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Bookings"
        title="Réservations"
        description="Gérez les réservations, les créneaux de départ/retour, les cautions et les statuts."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={openReservationPanel}>Ajouter une réservation</Button>}
      />

      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher par client, véhicule, ville ou ID"
            className="focus-ring h-10 w-full rounded-xl border border-white/[0.07] bg-[#0F1115] pl-10 pr-4 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,.025)] transition placeholder:text-carbon-500 hover:border-white/12 light:bg-white light:text-carbon-950"
            />
          </label>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 no-scrollbar md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {statuses.map((item) => (
              <button
                key={item}
                className={`focus-ring shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition md:text-sm ${
                  status === item ? 'bg-gold-400 text-carbon-950' : 'border border-white/10 bg-white/[0.04] text-carbon-300 hover:bg-white/10 light:text-carbon-700'
                }`}
                onClick={() => setStatus(item)}
              >
                {item === 'All' ? 'Tous' : item === 'Confirmed' ? 'Confirmée' : item === 'Active' ? 'Active' : item === 'Completed' ? 'Terminée' : 'Annulée'}
              </button>
            ))}
          </div>
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] p-1 md:flex">
            <button
              className={`focus-ring grid h-9 w-10 place-items-center rounded-lg ${view === 'table' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300'}`}
              onClick={() => setView('table')}
              aria-label="Table view"
            >
              <ListFilter className="h-4 w-4" />
            </button>
            <button
              className={`focus-ring grid h-9 w-10 place-items-center rounded-lg ${view === 'calendar' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300'}`}
              onClick={() => setView('calendar')}
              aria-label="Calendar view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {filteredReservations.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No reservations found"
          message="Adjust the filters or add a new booking to keep the calendar moving."
          action="Add reservation"
          onAction={openReservationPanel}
        />
      ) : !isMobileCards ? (
        <Card className="data-table hidden overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-white/[0.06] text-xs uppercase tracking-wide text-carbon-400">
                <tr>
                  <th className="px-5 py-4">Reservation</th>
                  <th className="px-5 py-4">Client</th>
                  <th className="px-5 py-4">Vehicle</th>
                  <th className="px-5 py-4">Pickup</th>
                  <th className="px-5 py-4">Return</th>
                  <th className="px-5 py-4">Daily price</th>
                  <th className="px-5 py-4">Deposit</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredReservations.map((reservation) => (
                  <tr key={reservation.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4 font-bold text-white light:text-carbon-950">{reservation.id}</td>
                    <td className="px-5 py-4 text-carbon-300 light:text-carbon-700">{reservation.client}</td>
                    <td className="px-5 py-4 text-carbon-300 light:text-carbon-700">{reservation.vehicle}</td>
                    <td className="px-5 py-4 text-carbon-400">{reservation.pickupDate}</td>
                    <td className="px-5 py-4 text-carbon-400">{reservation.returnDate}</td>
                    <td className="px-5 py-4 text-white light:text-carbon-950">{formatMAD(reservation.dailyPrice)}</td>
                    <td className="px-5 py-4 text-carbon-300 light:text-carbon-700">{formatMAD(reservation.deposit)}</td>
                    <td className="px-5 py-4"><Badge>{reservation.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredReservations.map((reservation) => (
            <Card key={reservation.id} interactive className="p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 text-gold-200">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <Badge>{reservation.status}</Badge>
              </div>
              <p className="text-xs text-carbon-500">{reservation.id}</p>
              <h3 className="font-black text-white light:text-carbon-950">{reservation.vehicle}</h3>
              <p className="mt-1 text-sm text-carbon-400">{reservation.client}</p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs uppercase tracking-wide text-carbon-500">Rental window</p>
                <p className="mt-2 font-semibold text-carbon-100 light:text-carbon-800">
                  {reservation.pickupDate} → {reservation.returnDate}
                </p>
              </div>
              <p className="mt-4 font-semibold text-gold-200">{formatMAD(reservation.dailyPrice)}</p>
              <p className="mt-4 text-sm leading-6 text-carbon-400">{reservation.notes}</p>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            className="fixed inset-0 z-50 overflow-hidden bg-[#050505]/88 p-0 backdrop-blur-sm sm:p-4"
            {...reservationPanelMotion}
          >
            <button
              aria-label="Close reservation panel"
              className="absolute inset-0 h-full w-full cursor-default"
              onClick={() => setModalOpen(false)}
            />
            <motion.aside
              initial={{ opacity: 0, x: 36, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 28, scale: 0.985 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="relative ml-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-none border border-white/[0.07] bg-[#0B0D10] shadow-[0_26px_80px_rgba(0,0,0,.55)] sm:h-full sm:max-h-none sm:rounded-[1.5rem] light:bg-white"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:gap-4 sm:px-7 sm:py-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-carbon-300 light:text-carbon-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Nouvelle réservation
                  </div>
                  <h2 className="text-base font-semibold tracking-tight text-white sm:text-2xl light:text-carbon-950">Ajouter une réservation</h2>
                  <p className="mt-0.5 max-w-2xl text-xs leading-5 text-carbon-400 sm:text-sm sm:leading-6 light:text-carbon-600">Flux simple et rapide pour créer une réservation.</p>
                </div>
                <button
                  className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-carbon-300 transition hover:bg-white/10 hover:text-white"
                  onClick={() => setModalOpen(false)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1fr_360px]" onSubmit={handleAddReservation}>
                <div className="flex min-h-0 flex-col">
                  <div className="border-b border-white/10 px-3 py-2 sm:px-7 sm:py-4">
                    <div className="sm:hidden">
                      <p className="text-xs font-semibold text-carbon-400">{reservationStep + 1}/5 • {reservationSteps[reservationStep]}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10">
                        <div className="h-1.5 rounded-full bg-gold-400 transition-all" style={{ width: `${((reservationStep + 1) / reservationSteps.length) * 100}%` }} />
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
                          <span className="mr-2 text-carbon-500">0{index + 1}</span>{step.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-28 sm:px-7 sm:py-6">
                    <AnimatePresence mode="wait">
                      {reservationStep === 0 ? (
                        <motion.section
                          key="client"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="space-y-5"
                        >
                          <div>
                            <h3 className="text-base font-semibold tracking-tight text-white sm:text-xl light:text-carbon-950">Sélectionner client</h3>
                            <p className="mt-1 text-xs text-carbon-400 sm:text-sm">Choisissez le client lié à cette réservation.</p>
                          </div>
                          <ReservationField label="Client">
                            <select
                              className={inputClass}
                              name="client"
                              required
                              value={draftClientId}
                              onChange={(event) => setDraftClientId(event.target.value)}
                            >
                              {clients.map((client) => (
                                <option key={client.id} value={client.id}>{client.fullName}</option>
                              ))}
                            </select>
                          </ReservationField>
                          {selectedClient ? (
                            <div className="premium-surface rounded-2xl p-3 sm:rounded-3xl sm:p-5">
                              <div className="flex items-start gap-3">
                                <div className="premium-avatar grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black text-carbon-950 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-lg">
                                  {selectedClient.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                                </div>
                                <div>
                                  <div className="mb-2"><Badge>{selectedClient.status}</Badge></div>
                                  <p className="text-sm font-semibold text-white sm:text-lg light:text-carbon-950">{selectedClient.fullName}</p>
                                  <p className="mt-1 text-xs text-carbon-400 sm:text-sm">{selectedClient.phone} · {selectedClient.cin}</p>
                                  <p className="mt-1 text-xs text-carbon-500 sm:text-sm">Permis {selectedClient.license} · {selectedClient.totalRentals} locations</p>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </motion.section>
                      ) : null}

                      {reservationStep === 1 ? (
                        <motion.section
                          key="vehicle"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="space-y-5"
                        >
                          <div>
                            <h3 className="text-base font-semibold tracking-tight text-white sm:text-xl light:text-carbon-950">Sélectionner véhicule</h3>
                            <p className="mt-1 text-xs text-carbon-400 sm:text-sm">Assignez un véhicule et vérifiez sa disponibilité.</p>
                          </div>
                          <ReservationField label="Vehicle">
                            <select
                              className={inputClass}
                              name="vehicle"
                              required
                              value={draftVehicleId}
                              onChange={(event) => {
                                const nextVehicle = vehicles.find((vehicle) => vehicle.id === event.target.value);
                                setDraftVehicleId(event.target.value);
                                if (nextVehicle) setDraftDailyPrice(nextVehicle.dailyPrice);
                              }}
                            >
                              {vehicles.map((vehicle) => (
                                <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model}</option>
                              ))}
                            </select>
                          </ReservationField>
                          {selectedVehicle ? (
                            <div className="premium-surface grid gap-3 rounded-2xl p-3 sm:grid-cols-[180px_1fr] sm:rounded-3xl sm:p-5">
                              <div className="vehicle-visual grid h-24 place-items-center rounded-2xl sm:h-36 sm:rounded-3xl">
                                <Car className="h-16 w-16 text-white/70" strokeWidth={1.3} />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <p className="text-sm font-semibold text-white sm:text-lg light:text-carbon-950">{selectedVehicle.brand} {selectedVehicle.model}</p>
                                  <Badge>{selectedVehicle.status}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-carbon-400 sm:text-sm">{selectedVehicle.plate} · {selectedVehicle.city}</p>
                                <p className="mt-2 text-xs text-carbon-500 sm:mt-4 sm:text-sm">{selectedVehicle.mileage.toLocaleString()} km · {formatMAD(selectedVehicle.dailyPrice)} / jour</p>
                              </div>
                            </div>
                          ) : null}
                        </motion.section>
                      ) : null}

                      {reservationStep === 2 ? (
                        <motion.section
                          key="dates"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="space-y-5"
                        >
                          <div>
                            <h3 className="text-base font-semibold tracking-tight text-white sm:text-xl light:text-carbon-950">Choisir les dates</h3>
                            <p className="mt-1 text-xs text-carbon-400 sm:text-sm">Définissez la période de location.</p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <ReservationField label="Pickup date">
                              <input
                                className={inputClass}
                                name="pickupDate"
                                type="date"
                                value={draftPickupDate}
                                onChange={(event) => setDraftPickupDate(event.target.value)}
                                required
                              />
                            </ReservationField>
                            <ReservationField label="Return date">
                              <input
                                className={inputClass}
                                name="returnDate"
                                type="date"
                                value={draftReturnDate}
                                onChange={(event) => setDraftReturnDate(event.target.value)}
                                required
                              />
                            </ReservationField>
                          </div>
                        </motion.section>
                      ) : null}

                      {reservationStep === 3 ? (
                        <motion.section
                          key="pricing"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="space-y-5"
                        >
                          <div>
                            <h3 className="text-base font-semibold tracking-tight text-white sm:text-xl light:text-carbon-950">Tarif et caution</h3>
                            <p className="mt-1 text-xs text-carbon-400 sm:text-sm">Confirmez le prix journalier et la caution.</p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.15fr]">
                            <ReservationField label="Daily price">
                              <input
                                className={inputClass}
                                name="dailyPrice"
                                type="number"
                                value={draftDailyPrice}
                                onChange={(event) => setDraftDailyPrice(Number(event.target.value))}
                                required
                              />
                            </ReservationField>
                            <ReservationField label="Deposit">
                              <input
                                className={inputClass}
                                name="deposit"
                                type="number"
                                value={draftDeposit}
                                onChange={(event) => setDraftDeposit(Number(event.target.value))}
                                required
                              />
                            </ReservationField>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-carbon-500">Total estimate</p>
                              <p className="mt-1 text-xl font-semibold text-white light:text-carbon-950">{formatMAD(totalEstimate)}</p>
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <ReservationField label="Pickup location" hint="Optional operational detail">
                              <input className={inputClass} placeholder="Airport, hotel, agency desk..." />
                            </ReservationField>
                            <ReservationField label="Accessories" hint="Optional customer request">
                              <input className={inputClass} placeholder="Child seat, GPS, extra driver..." />
                            </ReservationField>
                          </div>
                          <ReservationField label="Custom notes">
                            <textarea
                              className={`${inputClass} min-h-24 resize-none py-3 leading-6`}
                              name="notes"
                              placeholder="Pickup location, client preferences, accessories..."
                            />
                          </ReservationField>
                        </motion.section>
                      ) : null}

                      {reservationStep === 4 ? (
                        <motion.section
                          key="confirm"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="space-y-5"
                        >
                          <div>
                            <h3 className="text-base font-semibold tracking-tight text-white sm:text-xl light:text-carbon-950">Confirmer</h3>
                            <p className="mt-1 text-xs text-carbon-400 sm:text-sm">Vérifiez les détails avant l’enregistrement.</p>
                          </div>
                          <div className="premium-surface grid gap-3 rounded-3xl p-5">
                            <p className="text-lg font-semibold text-white light:text-carbon-950">{selectedClient?.fullName} · {selectedVehicle?.brand} {selectedVehicle?.model}</p>
                            <p className="text-sm text-carbon-400">{draftPickupDate} au {draftReturnDate} · {rentalDays} jour(s)</p>
                            <p className="text-2xl font-semibold text-white light:text-carbon-950">{formatMAD(totalEstimate)}</p>
                          </div>
                        </motion.section>
                      ) : null}
                    </AnimatePresence>

                    <input type="hidden" name="client" value={draftClientId} />
                    <input type="hidden" name="vehicle" value={draftVehicleId} />
                    <input type="hidden" name="pickupDate" value={draftPickupDate} />
                    <input type="hidden" name="returnDate" value={draftReturnDate} />
                    <input type="hidden" name="dailyPrice" value={draftDailyPrice} />
                    <input type="hidden" name="deposit" value={draftDeposit} />
                  </div>

                  <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-[#0B0D10]/95 px-3 py-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)] backdrop-blur sm:px-7 sm:py-4 sm:pb-4">
                    <button
                      className="focus-ring h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-carbon-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={reservationStep === 0}
                      type="button"
                      onClick={() => setReservationStep((step) => Math.max(0, step - 1))}
                    >
                      Retour
                    </button>
                    {reservationStep < reservationSteps.length - 1 ? (
                      <button
                        className="focus-ring h-10 rounded-xl bg-[#D4A017] px-4 text-sm font-bold text-carbon-950 shadow-[0_10px_24px_rgba(212,160,23,.14)] transition hover:-translate-y-0.5 hover:bg-[#E8B923]"
                        type="button"
                        onClick={() => setReservationStep((step) => Math.min(reservationSteps.length - 1, step + 1))}
                      >
                        Continuer
                      </button>
                    ) : (
                      <button
                        className="focus-ring h-10 rounded-xl bg-[#D4A017] px-4 text-sm font-bold text-carbon-950 shadow-[0_10px_24px_rgba(212,160,23,.14)] transition hover:-translate-y-0.5 hover:bg-[#E8B923]"
                        type="submit"
                      >
                        Enregistrer
                      </button>
                    )}
                  </div>
                </div>

                <aside className="hidden border-t border-white/[0.07] bg-[#0F1115] p-5 light:bg-carbon-950/[0.03] lg:block lg:border-l lg:border-t-0 lg:p-6">
                  <div className="sticky top-6 space-y-5">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-carbon-500">Reservation Summary</h3>
                      <p className="mt-2 text-sm leading-6 text-carbon-400">A quick confirmation before saving this booking.</p>
                    </div>

                    <div className="premium-surface rounded-3xl p-5">
                      {selectedVehicle ? (
                        <div className="flex gap-4">
                          <div className="vehicle-visual grid h-16 w-20 shrink-0 place-items-center rounded-2xl text-gold-200">
                            <Car className="h-7 w-7" />
                          </div>
                          <div>
                            <p className="font-semibold text-white light:text-carbon-950">{selectedVehicle.brand} {selectedVehicle.model}</p>
                            <p className="mt-1 text-sm text-carbon-400">{selectedVehicle.plate} · {selectedVehicle.city}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-carbon-400">
                          Select a vehicle to preview pricing and branch details.
                        </div>
                      )}
                    </div>

                    <div className="premium-surface grid gap-3 rounded-3xl p-5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-carbon-400"><UserRound className="h-4 w-4" /> Client</span>
                        <strong className="text-right text-white light:text-carbon-950">{selectedClient?.fullName || 'Not selected'}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-carbon-400"><CalendarDays className="h-4 w-4" /> Duration</span>
                        <strong className="text-white light:text-carbon-950">{rentalDays} day(s)</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-carbon-400"><MapPin className="h-4 w-4" /> Pickup</span>
                        <strong className="text-white light:text-carbon-950">{draftPickupDate}</strong>
                      </div>
                      <div className="h-px bg-white/10" />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-carbon-400">Total price</span>
                        <strong className="text-lg text-white light:text-carbon-950">{formatMAD(totalEstimate)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-carbon-400">Deposit</span>
                        <strong className="text-white light:text-carbon-950">{formatMAD(Number(draftDeposit || 0))}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-carbon-400">Status</span>
                        <Badge>Confirmed</Badge>
                      </div>
                    </div>
                  </div>
                </aside>
              </form>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
