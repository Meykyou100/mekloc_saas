import type { Payment, Reservation } from '../data/mockData';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReservationPaymentIdentity = Pick<Reservation, 'id' | 'recordId'>;

export function getReservationPaymentId(reservation: ReservationPaymentIdentity) {
  return reservation.recordId && UUID_RE.test(reservation.recordId) ? reservation.recordId : reservation.id;
}

export function paymentMatchesReservation(payment: Pick<Payment, 'reservationId'>, reservation: ReservationPaymentIdentity) {
  if (!payment.reservationId) return false;
  const expectedId = getReservationPaymentId(reservation);
  return payment.reservationId === expectedId || payment.reservationId === reservation.id || payment.reservationId === reservation.recordId;
}

export function getPaidAmount(payment: Pick<Payment, 'amount' | 'status'>) {
  return payment.status === 'Pending' || payment.status === 'Late' ? 0 : Math.max(0, payment.amount || 0);
}

export function getReservationTotal(reservation: Pick<Reservation, 'totalAmount' | 'dailyPrice'>) {
  return Math.max(0, reservation.totalAmount ?? reservation.dailyPrice ?? 0);
}

export function getReservationPaymentSummary(reservation: Reservation, payments: Payment[]) {
  const total = getReservationTotal(reservation);
  const relatedPayments = payments.filter((payment) => paymentMatchesReservation(payment, reservation));
  const paid = Math.min(total, relatedPayments.reduce((sum, payment) => sum + getPaidAmount(payment), 0));
  const remaining = Math.max(0, total - paid);
  const statusFr = remaining <= 0 ? 'Payé' : paid > 0 ? 'Partiel' : 'En attente';

  return { total, paid, remaining, relatedPayments, statusFr };
}

export function getClientPaymentBalance(clientId: string, reservations: Reservation[], payments: Payment[]) {
  const clientReservations = reservations.filter((reservation) => reservation.clientId === clientId);
  const summaries = clientReservations.map((reservation) => getReservationPaymentSummary(reservation, payments));
  const total = summaries.reduce((sum, summary) => sum + summary.total, 0);
  const paid = summaries.reduce((sum, summary) => sum + summary.paid, 0);
  const remaining = summaries.reduce((sum, summary) => sum + summary.remaining, 0);

  return {
    reservations: clientReservations.length,
    total,
    paid,
    remaining,
  };
}
