import type { Client, MaintenanceItem, Payment, Reservation, Vehicle } from '../data/mockData';

export type AssistantPriority = 'urgent' | 'today' | 'watch' | 'missing';

export type ReservationPaymentAlert = {
  reservation: Reservation;
  total: number;
  alreadyPaid: number;
  remaining: number;
  cautionMissing: boolean;
};

export type MissingClientDocumentsAlert = {
  client: Client;
  missing: string[];
};

export type VehicleExpiryAlert = {
  vehicle: Vehicle;
  label: string;
  date: string;
  priority: AssistantPriority;
  source: 'assurance' | 'visite' | 'entretien';
};

type WhatsAppReminderKind = 'confirmation' | 'pickup' | 'return' | 'payment' | 'contract' | 'documents';

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toLocalDate(date: string | undefined | null) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizePhone(phone: string | undefined | null) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
}

function compactDate(value: string | undefined) {
  if (!value) return 'date à confirmer';
  const d = toLocalDate(value);
  if (!d) return value;
  return d.toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getReservationPaymentId(reservation: Reservation) {
  return reservation.recordId || reservation.id;
}

export function getTodayReservations(
  reservations: Reservation[],
  mode: 'pickup' | 'return',
  today = new Date(),
) {
  const key = toDateKey(today);
  return reservations.filter((reservation) => {
    if (reservation.status === 'Cancelled') return false;
    if (mode === 'pickup') return reservation.pickupDate === key;
    return reservation.returnDate === key;
  });
}

export function getOverdueReservations(reservations: Reservation[], today = new Date()) {
  const key = toDateKey(today);
  return reservations.filter((reservation) => {
    if (reservation.status === 'Completed' || reservation.status === 'Cancelled') return false;
    return reservation.returnDate < key;
  });
}

export function getPaymentAlerts(reservations: Reservation[], payments: Payment[]): ReservationPaymentAlert[] {
  return reservations
    .filter((reservation) => reservation.status !== 'Cancelled')
    .map((reservation) => {
      const total = Math.max(0, reservation.totalAmount || reservation.dailyPrice || 0);
      const reservationPaymentId = getReservationPaymentId(reservation);
      const alreadyPaid = payments
        .filter(
          (payment) =>
            payment.reservationId === reservationPaymentId &&
            payment.status !== 'Pending' &&
            payment.status !== 'Late',
        )
        .reduce((sum, payment) => sum + Math.max(0, payment.amount), 0);
      const remaining = Math.max(0, total - alreadyPaid);
      const cautionMissing = !(reservation.deposit > 0);
      return { reservation, total, alreadyPaid, remaining, cautionMissing };
    })
    .filter((item) => item.remaining > 0 || item.cautionMissing)
    .sort((a, b) => b.remaining - a.remaining);
}

export function getMissingDocumentClients(clients: Client[]): MissingClientDocumentsAlert[] {
  return clients
    .map((client) => {
      const missing: string[] = [];
      if (!client.idCardFrontUrl) missing.push('Recto');
      if (!client.idCardBackUrl) missing.push('Verso');
      return { client, missing };
    })
    .filter((item) => item.missing.length > 0);
}

export function getVehicleExpiryAlerts(
  vehicles: Vehicle[],
  maintenanceItems: MaintenanceItem[],
  today = new Date(),
) {
  const soonThreshold = new Date(today);
  soonThreshold.setDate(soonThreshold.getDate() + 30);

  const alerts: VehicleExpiryAlert[] = [];
  const now = today.getTime();
  const soon = soonThreshold.getTime();

  vehicles.forEach((vehicle) => {
    const insuranceDate = toLocalDate(vehicle.insuranceExpiry);
    if (insuranceDate) {
      const ts = insuranceDate.getTime();
      if (ts <= soon) {
        alerts.push({
          vehicle,
          label: ts < now ? 'Assurance expirée' : 'Assurance expire bientôt',
          date: vehicle.insuranceExpiry,
          priority: ts < now ? 'urgent' : 'watch',
          source: 'assurance',
        });
      }
    }

    const inspectionDate = toLocalDate(vehicle.inspectionDate);
    if (inspectionDate) {
      const ts = inspectionDate.getTime();
      if (ts <= soon) {
        alerts.push({
          vehicle,
          label: ts < now ? 'Visite technique expirée' : 'Visite technique proche',
          date: vehicle.inspectionDate,
          priority: ts < now ? 'urgent' : 'watch',
          source: 'visite',
        });
      }
    }
  });

  const criticalMaintenance = maintenanceItems.filter((item) => item.status === 'Overdue' || item.status === 'Due soon');
  criticalMaintenance.forEach((item) => {
    const matchVehicle = vehicles.find((vehicle) => vehicle.id === item.vehicleId);
    if (!matchVehicle) return;
    alerts.push({
      vehicle: matchVehicle,
      label: item.status === 'Overdue' ? 'Entretien en retard' : 'Entretien à prévoir',
      date: item.nextServiceDate || item.date || '',
      priority: item.status === 'Overdue' ? 'urgent' : 'watch',
      source: 'entretien',
    });
  });

  return alerts.slice(0, 8);
}

export function buildWhatsAppReminderUrl({
  kind,
  phone,
  clientName,
  vehicle,
  date,
  amount,
  missingDocs,
}: {
  kind: WhatsAppReminderKind;
  phone: string | undefined | null;
  clientName: string;
  vehicle?: string;
  date?: string;
  amount?: number;
  missingDocs?: string[];
}) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  const intro = `Bonjour ${clientName},`;
  const bodyByKind: Record<WhatsAppReminderKind, string> = {
    confirmation: `confirmation réservation: votre réservation${vehicle ? ` pour ${vehicle}` : ''} est bien enregistrée pour le ${compactDate(date)}. Merci de nous confirmer votre disponibilité.`,
    pickup: `rappel pour votre départ prévu le ${compactDate(date)}${vehicle ? ` avec ${vehicle}` : ''}. Merci de confirmer votre disponibilité.`,
    return: `rappel retour véhicule: retour prévu le ${compactDate(date)}${vehicle ? ` (${vehicle})` : ''}. Merci de nous confirmer l’heure de restitution.`,
    payment: `rappel paiement: il reste ${amount ? `${amount.toLocaleString('fr-MA')} MAD` : 'un montant'} à régler. Merci de finaliser votre paiement aujourd’hui.`,
    contract: `envoi contrat: votre contrat de location${vehicle ? ` pour ${vehicle}` : ''} est prêt. Merci de le vérifier et de nous confirmer réception.`,
    documents: `merci de compléter votre dossier (${(missingDocs || []).join(' / ') || 'documents manquants'}) pour valider votre réservation.`,
  };
  const text = encodeURIComponent(`${intro}\n${bodyByKind[kind]}\n\n— MekLoc`);
  return `https://wa.me/${normalizedPhone}?text=${text}`;
}
