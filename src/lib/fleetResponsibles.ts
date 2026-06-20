import type { Payment, Reservation, Vehicle } from '../data/mockData';
import { getReservationPaymentSummary } from './paymentBalance';

export type FleetResponsible = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  accountStatus?: string | null;
};

export type FleetResponsiblePerformance = {
  responsible: FleetResponsible | null;
  isUnassigned: boolean;
  vehicles: Vehicle[];
  reservations: Reservation[];
  assignedVehicles: number;
  reservationsCount: number;
  activeReservations: number;
  revenue: number;
  paid: number;
  remaining: number;
  lateReturns: number;
};

export type FleetPeriod = 'month' | 'quarter' | 'year';

export function fleetPeriodRange(period: FleetPeriod) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  if (period === 'year') return { start: `${now.getFullYear()}-01-01`, end };
  if (period === 'quarter') {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 3);
    return { start: start.toISOString().slice(0, 10), end };
  }
  return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end };
}

export function roleLabelFr(role: string | null | undefined) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'owner' || normalized === 'admin') return 'Propriétaire';
  if (normalized === 'manager') return 'Manager';
  if (normalized === 'accountant') return 'Comptable';
  return 'Agent';
}

export function responsibleInitials(value: string | null | undefined) {
  return String(value || 'NA')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'NA';
}

function isInRange(value: string, start: string, end: string) {
  return value >= start && value <= end;
}

export function getFleetResponsiblePerformance({
  members,
  vehicles,
  reservations,
  payments,
  start,
  end,
}: {
  members: FleetResponsible[];
  vehicles: Vehicle[];
  reservations: Reservation[];
  payments: Payment[];
  start: string;
  end: string;
}): FleetResponsiblePerformance[] {
  const today = new Date().toISOString().slice(0, 10);
  const activeVehicles = vehicles.filter((vehicle) => !vehicle.archivedAt);
  const groups: Array<{ responsible: FleetResponsible | null; isUnassigned: boolean }> = [
    ...members.map((responsible) => ({ responsible, isUnassigned: false })),
    { responsible: null, isUnassigned: true },
  ];

  return groups.map(({ responsible, isUnassigned }) => {
    const assignedVehicles = activeVehicles.filter((vehicle) =>
      isUnassigned ? !vehicle.responsibleUserId : vehicle.responsibleUserId === responsible?.id,
    );
    const vehicleIds = new Set(assignedVehicles.map((vehicle) => vehicle.id));
    const relatedReservations = reservations.filter((reservation) => vehicleIds.has(reservation.vehicleId));
    const periodReservations = relatedReservations.filter((reservation) => isInRange(reservation.pickupDate, start, end));
    const billableReservations = periodReservations.filter((reservation) => reservation.status !== 'Cancelled');
    const paymentTotals = billableReservations.reduce(
      (totals, reservation) => {
        const summary = getReservationPaymentSummary(reservation, payments);
        totals.revenue += summary.total;
        totals.paid += summary.paid;
        totals.remaining += summary.remaining;
        return totals;
      },
      { revenue: 0, paid: 0, remaining: 0 },
    );

    return {
      responsible,
      isUnassigned,
      vehicles: assignedVehicles,
      reservations: relatedReservations,
      assignedVehicles: assignedVehicles.length,
      reservationsCount: billableReservations.length,
      activeReservations: relatedReservations.filter((reservation) => reservation.status === 'Active').length,
      revenue: paymentTotals.revenue,
      paid: paymentTotals.paid,
      remaining: paymentTotals.remaining,
      lateReturns: relatedReservations.filter((reservation) => reservation.returnDate < today && !['Completed', 'Cancelled'].includes(reservation.status)).length,
    };
  });
}
