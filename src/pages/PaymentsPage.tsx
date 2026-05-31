import { Copy, Download, Eye, MessageCircle, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField, TextAreaField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { formatMAD, type Payment, type PaymentStatus, type Reservation } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { buildWhatsAppReminderUrl } from '../lib/assistantDuJour';
import { getNotificationPreferences } from '../lib/notificationPreferences';
import { getPaidAmount, getReservationPaymentId, getReservationPaymentSummary, paymentMatchesReservation } from '../lib/paymentBalance';
import { sanitizeText, validatePositiveNumber } from '../lib/security';

type FilterKey = 'tous' | 'paye' | 'partiel' | 'attente' | 'retard' | 'mois';
type MethodFilter = 'toutes' | 'Cash' | 'Bank transfer' | 'Card';
const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'tous', label: 'Tous' },
  { key: 'paye', label: 'Payé' },
  { key: 'partiel', label: 'Partiel' },
  { key: 'attente', label: 'En attente' },
  { key: 'retard', label: 'En retard' },
  { key: 'mois', label: 'Ce mois' },
];

function sanitizeFileName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'paiement';
}

function methodFr(method: Payment['method']) {
  if (method === 'Bank transfer') return 'Virement bancaire';
  if (method === 'Card') return 'Carte';
  return 'Espèces';
}

function buildManualReminderMessage(item: {
  client: string;
  invoice: string;
  vehicleLabel: string;
  remaining: number;
  dueDate: string;
}) {
  return `Bonjour ${item.client}, rappel MekLoc concernant la facture ${item.invoice} pour ${item.vehicleLabel}. Reste à payer: ${formatMAD(item.remaining)}. Échéance: ${item.dueDate || 'non renseignée'}. Merci de régulariser votre paiement.`;
}

function measureReceiptLogo(dataUrl: string) {
  return new Promise<string | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(dataUrl);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

async function blobToReceiptDataUrl(blob: Blob) {
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function loadImageDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (response.ok) {
      const dataUrl = await blobToReceiptDataUrl(await response.blob());
      if (dataUrl) {
        const measured = await measureReceiptLogo(dataUrl);
        if (measured) return measured;
      }
    }
  } catch {
    // Some Supabase Storage URLs reject fetch but can still be decoded by an image element.
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export default function PaymentsPage() {
  const { payments, reservations, vehicles, clients, createPayment, updatePayment, deletePayment } = useData();
  const { notify } = useApp();
  const { profile } = useAuth();
  const notificationPreferences = getNotificationPreferences(profile?.agency?.settings);
  const [filter, setFilter] = useState<FilterKey>('tous');
  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('toutes');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank transfer' | 'Card' | 'Other'>('Cash');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [detailPaymentId, setDetailPaymentId] = useState<string | null>(null);
  const [reminderPaymentId, setReminderPaymentId] = useState<string | null>(null);
  const paymentRows = payments;

  const enriched = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return paymentRows.map((payment) => {
      const reservation = reservations.find((item) => paymentMatchesReservation(payment, item));
      const vehicleId = payment.vehicleId || reservation?.vehicleId;
      const vehicle = vehicleId ? vehicles.find((item) => item.id === vehicleId) : undefined;
      const client = clients.find((item) => item.id === (payment.clientId || reservation?.clientId)) ||
        clients.find((item) => item.fullName.trim().toLowerCase() === payment.client.trim().toLowerCase());
      const reservationPaymentSummary = reservation ? getReservationPaymentSummary(reservation, paymentRows) : null;
      const total = reservationPaymentSummary?.total || payment.amount;
      const paid = reservationPaymentSummary?.paid ?? getPaidAmount(payment);
      const relatedPayments = reservationPaymentSummary?.relatedPayments || [payment];
      const remaining = Math.max(0, total - paid);
      let statusFr: 'Payé' | 'Partiel' | 'En attente' | 'En retard' = payment.status === 'Paid' ? 'Payé' : payment.status === 'Partial' ? 'Partiel' : payment.status === 'Late' ? 'En retard' : 'En attente';
      if (remaining === 0) statusFr = 'Payé';
      else if (payment.dueDate < now) statusFr = 'En retard';
      else if (paid > 0) statusFr = 'Partiel';
      return {
        ...payment,
        reservationIdForUi: reservation?.id || '',
        reservationCode: reservation?.id || '—',
        vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model}` : '—',
        clientPhone: client?.phone,
        total,
        paid,
        remaining,
        relatedPayments,
        statusFr,
        progress: total > 0 ? Math.round((paid / total) * 100) : 0,
      };
    });
  }, [clients, paymentRows, reservations, vehicles]);

  const reservationChoices = useMemo(
    () =>
      reservations.map((reservation) => {
        const vehicle = vehicles.find((item) => item.id === reservation.vehicleId);
        const total = reservation.totalAmount || reservation.dailyPrice;
        const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model}` : reservation.vehicle || 'Véhicule';
        return {
          reservation,
          vehicleName,
          total,
          label: `${reservation.id} • ${reservation.client || 'Client'} • ${vehicleName} • ${reservation.pickupDate} → ${reservation.returnDate} • ${formatMAD(total)}`,
        };
      }),
    [reservations, vehicles],
  );

  const selectedReservationChoice = useMemo(
    () => reservationChoices.find((item) => item.reservation.id === selectedReservationId),
    [reservationChoices, selectedReservationId],
  );

  const reservationSummary = useMemo(() => {
    if (!selectedReservationChoice) return null;
    const reservation = selectedReservationChoice.reservation;
    const total = selectedReservationChoice.total;
    const alreadyPaidFromRows = paymentRows
      .filter((item) => paymentMatchesReservation(item, reservation))
      .reduce((sum, item) => sum + getPaidAmount(item), 0);
    const alreadyPaid = Math.max(0, alreadyPaidFromRows);
    const remaining = Math.max(0, total - alreadyPaid);
    const statusFr = remaining <= 0 ? 'Payé' : alreadyPaid > 0 ? 'Partiel' : 'En attente';
    return { total, alreadyPaid, remaining, statusFr };
  }, [paymentRows, selectedReservationChoice]);

  useEffect(() => {
    if (!modalOpen) return;
    const fallback = reservationChoices[0]?.reservation.id || '';
    const nextId = selectedReservationId || fallback;
    setSelectedReservationId(nextId);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('Cash');
  }, [modalOpen, reservationChoices, selectedReservationId]);

  useEffect(() => {
    if (!selectedReservationChoice || !reservationSummary) return;
    setAmountPaid(String(reservationSummary.remaining > 0 ? reservationSummary.remaining : selectedReservationChoice.total));
  }, [reservationSummary, selectedReservationChoice]);

  const filtered = useMemo(() => enriched.filter((item) => {
    const inMonth = item.dueDate.slice(0, 7) === new Date().toISOString().slice(0, 7);
    const matchesFilter =
      filter === 'tous' ||
      (filter === 'paye' && item.statusFr === 'Payé') ||
      (filter === 'partiel' && item.statusFr === 'Partiel') ||
      (filter === 'attente' && item.statusFr === 'En attente') ||
      (filter === 'retard' && item.statusFr === 'En retard') ||
      (filter === 'mois' && inMonth);
    const haystack = `${item.invoice} ${item.client} ${item.vehicleLabel} ${item.reservationCode}`.toLowerCase();
    const methodHit = methodFilter === 'toutes' || item.method === methodFilter;
    return matchesFilter && methodHit && haystack.includes(query.toLowerCase());
  }), [enriched, filter, methodFilter, query]);

  const totalFacture = enriched.reduce((s, i) => s + i.total, 0);
  const totalEncaisse = enriched.reduce((s, i) => s + i.paid, 0);
  const soldeOuvert = Math.max(0, totalFacture - totalEncaisse);
  const enRetard = enriched.filter((i) => i.statusFr === 'En retard').length;
  const detailPayment = detailPaymentId ? enriched.find((item) => item.id === detailPaymentId) || null : null;
  const reminderPayment = reminderPaymentId ? enriched.find((item) => item.id === reminderPaymentId) || null : null;

  function openPaymentModal(reservationId?: string) {
    if (reservationId) setSelectedReservationId(reservationId);
    setModalOpen(true);
  }

  function openPaymentModalForRow(item: (typeof enriched)[number]) {
    openPaymentModal(item.reservationIdForUi);
  }

  async function handleAddPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReservationId) {
      notify({ title: 'Validation', message: 'Veuillez sélectionner une réservation', type: 'warning' });
      return;
    }
    const amount = Number(amountPaid || 0);
    if (!validatePositiveNumber(amount)) {
      notify({ title: 'Montant invalide', message: 'Montant invalide', type: 'warning' });
      return;
    }
    if (!paymentDate) {
      notify({ title: 'Validation', message: 'Date invalide', type: 'warning' });
      return;
    }
    if (!selectedReservationChoice || !reservationSummary) {
      notify({ title: 'Validation', message: 'Veuillez sélectionner une réservation', type: 'warning' });
      return;
    }
    if (amount > reservationSummary.remaining + 0.01) {
      notify({ title: 'Montant invalide', message: 'Le montant dépasse le reste à payer', type: 'warning' });
      return;
    }

    const reservation = selectedReservationChoice.reservation;
    const fallbackClient = clients.find(
      (item) => item.fullName.trim().toLowerCase() === (reservation.client || '').trim().toLowerCase(),
    );
    const resolvedClientId = reservation.clientId || fallbackClient?.id;
    if (!resolvedClientId) {
      notify({ title: 'Validation', message: 'Client invalide pour cette réservation', type: 'warning' });
      return;
    }

    try {
      setSavingPayment(true);
      const linkedPayment = paymentRows.find((item) => paymentMatchesReservation(item, reservation));
      const reservationIdForDb = getReservationPaymentId(reservation);
      if (linkedPayment) {
        const nextAmount = Math.max(0, linkedPayment.amount + amount);
        const nextStatus: PaymentStatus =
          nextAmount >= reservationSummary.total ? 'Paid' : nextAmount > 0 ? 'Partial' : 'Pending';
        await updatePayment({
          ...linkedPayment,
          client: reservation.client,
          clientId: resolvedClientId,
          reservationId: reservationIdForDb,
          vehicleId: reservation.vehicleId,
          amount: nextAmount,
          method: paymentMethod === 'Other' ? 'Cash' : paymentMethod,
          status: nextStatus,
          dueDate: paymentDate,
        });
      } else {
        const nextPayment: Payment = {
          id: `pay-${Date.now()}`,
          invoice: `INV-${reservation.id}`,
          client: reservation.client,
          clientId: resolvedClientId,
          reservationId: reservationIdForDb,
          vehicleId: reservation.vehicleId,
          amount,
          method: paymentMethod === 'Other' ? 'Cash' : paymentMethod,
          status: amount >= reservationSummary.remaining ? 'Paid' : amount > 0 ? 'Partial' : 'Pending',
          dueDate: paymentDate,
        };
        await createPayment(nextPayment);
      }

      setSelectedReservationId('');
      setAmountPaid('');
      setPaymentNotes('');
      notify({ title: 'Paiement enregistré', message: 'Le paiement a été ajouté avec succès.', type: 'success' });
      setModalOpen(false);
    } catch (error) {
      let message = 'Réessayez.';
      if (error instanceof Error && error.message) {
        message = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        const raw = String((error as { message?: unknown }).message || '').trim();
        if (raw) message = raw;
      }
      notify({ title: 'Enregistrement impossible', message, type: 'warning' });
    } finally {
      setSavingPayment(false);
    }
  }

  async function confirmDeletePayment() {
    if (!paymentToDelete) return;
    try {
      await deletePayment(paymentToDelete.id);
      notify({
        title: 'Paiement supprimé',
        message: paymentToDelete.reservationId ? 'Le paiement a été supprimé. Le solde de la réservation est recalculé.' : 'Le paiement a été supprimé.',
        type: 'success',
      });
      setPaymentToDelete(null);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Payment delete failed', error);
      notify({ title: 'Suppression impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    }
  }

  async function downloadReceipt(item: (typeof enriched)[number]) {
    const agency = profile?.agency;
    const agencyName = agency?.name || 'MekLoc';
    const agencyPhone = agency?.phone || profile?.phone || '';
    const agencyEmail = agency?.email || profile?.email || '';
    const agencyAddress = agency?.address || '';
    const logoDataUrl = await loadImageDataUrl(agency?.logoUrl || undefined);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 48;
    const right = pageWidth - margin;

    pdf.setFillColor(18, 20, 24);
    pdf.rect(0, 0, pageWidth, 118, 'F');
    pdf.setFillColor(212, 160, 23);
    pdf.rect(0, 116, pageWidth, 3, 'F');

    if (logoDataUrl) {
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(margin, 26, 58, 58, 10, 10, 'F');
      pdf.addImage(logoDataUrl, 'PNG', margin + 8, 34, 42, 42, undefined, 'FAST');
    } else {
      pdf.setFillColor(212, 160, 23);
      pdf.roundedRect(margin, 26, 58, 58, 10, 10, 'F');
      pdf.setTextColor(18, 20, 24);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.text('M', margin + 22, 63);
    }

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text(agencyName, margin + 74, 48);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    [agencyAddress, agencyPhone, agencyEmail].filter(Boolean).forEach((line, index) => {
      pdf.text(String(line), margin + 74, 64 + index * 13);
    });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('REÇU DE PAIEMENT', right, 50, { align: 'right' });
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`N° ${item.invoice}`, right, 70, { align: 'right' });

    let y = 158;
    pdf.setTextColor(18, 20, 24);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Informations paiement', margin, y);
    pdf.text('Résumé financier', 330, y);
    y += 18;

    const leftRows = [
      ['Date paiement', item.dueDate || new Date().toISOString().slice(0, 10)],
      ['Client', item.client],
      ['Véhicule', item.vehicleLabel],
      ['Réservation', item.reservationCode],
      ['Méthode', methodFr(item.method)],
    ];
    const rightRows = [
      ['Montant payé', formatMAD(item.paid)],
      ['Total', formatMAD(item.total)],
      ['Déjà payé', formatMAD(item.paid)],
      ['Reste à payer', formatMAD(item.remaining)],
      ['Statut', item.statusFr],
    ];
    const drawRows = (rows: string[][], x: number, startY: number) => {
      rows.forEach(([label, value], index) => {
        const rowY = startY + index * 30;
        pdf.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 248 : 255);
        pdf.roundedRect(x, rowY - 13, 220, 24, 4, 4, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(105, 112, 122);
        pdf.text(label, x + 10, rowY - 1);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(18, 20, 24);
        pdf.text(String(value || '—').slice(0, 34), x + 90, rowY - 1);
      });
    };
    drawRows(leftRows, margin, y);
    drawRows(rightRows, 330, y);

    y = 370;
    pdf.setFillColor(250, 247, 238);
    pdf.roundedRect(margin, y, pageWidth - margin * 2, 86, 8, 8, 'F');
    pdf.setTextColor(120, 88, 10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Montant encaissé', margin + 18, y + 30);
    pdf.setTextColor(18, 20, 24);
    pdf.setFontSize(24);
    pdf.text(formatMAD(item.paid), margin + 18, y + 60);
    pdf.setFontSize(11);
    pdf.text(`Reste: ${formatMAD(item.remaining)}`, right - 18, y + 60, { align: 'right' });

    y = 520;
    pdf.setDrawColor(190, 190, 190);
    pdf.roundedRect(margin, y, 210, 90, 6, 6);
    pdf.roundedRect(right - 210, y, 210, 90, 6, 6);
    pdf.setTextColor(105, 112, 122);
    pdf.setFontSize(9);
    pdf.text('Signature client', margin + 16, y + 24);
    pdf.text('Signature / cachet agence', right - 194, y + 24);

    pdf.setTextColor(105, 112, 122);
    pdf.setFontSize(8);
    pdf.text('Document généré par MekLoc - Smart Rental Management System', pageWidth / 2, 790, { align: 'center' });
    pdf.save(`recu-paiement-${sanitizeFileName(item.invoice || item.id)}.pdf`);
  }

  function sendWhatsappReminder(item: { client: string; clientPhone?: string; vehicleLabel: string; remaining: number }) {
    const whatsappUrl = buildWhatsAppReminderUrl({
      kind: 'payment',
      phone: item.clientPhone,
      clientName: item.client,
      vehicle: item.vehicleLabel,
      amount: item.remaining,
    });
    if (!whatsappUrl) return;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  async function copyReminderMessage() {
    if (!reminderPayment) return;
    const message = buildManualReminderMessage(reminderPayment);
    try {
      await navigator.clipboard.writeText(message);
      notify({ title: 'Rappel copié', message: 'Le message de rappel est prêt à coller.', type: 'success' });
    } catch {
      notify({ title: 'Copie impossible', message: 'Sélectionnez le message puis copiez-le manuellement.', type: 'warning' });
    }
  }

  return (
    <div className="relative overflow-x-hidden pb-[calc(108px+env(safe-area-inset-bottom))] md:pb-28">
      <div className="pointer-events-none absolute -right-20 top-6 h-48 w-48 rounded-full bg-gold-400/10 blur-3xl md:hidden" />
      <div className="relative mb-3 rounded-2xl border border-[var(--app-border)] bg-[radial-gradient(circle_at_top_right,rgba(227,177,23,.16),transparent_36%),linear-gradient(135deg,rgba(12,17,24,.96),rgba(2,3,5,.98))] p-3 shadow-[0_18px_50px_rgba(0,0,0,.26),inset_0_1px_0_rgba(255,255,255,.04)] md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">FINANCES</p>
            <h1 className="mt-0.5 text-2xl font-black leading-none text-[var(--app-text)]">Paiements</h1>
            <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">Suivez vos paiements, cautions et restes à payer.</p>
          </div>
          <Button className="h-11 shrink-0 rounded-2xl px-3 text-xs shadow-[0_14px_34px_rgba(227,177,23,.16)]" icon={<Plus className="h-4 w-4" />} onClick={() => openPaymentModal()}>
            Ajouter
          </Button>
        </div>
      </div>
      <div className="hidden md:block">
        <PageHeader
          eyebrow="FINANCES"
          title="Paiements"
          description="Suivez vos paiements, cautions et restes à payer."
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => openPaymentModal()}>Ajouter un paiement</Button>}
        />
      </div>

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:mb-0 md:grid-cols-4 md:gap-4">
        {[
          { label: 'Total facturé', value: formatMAD(totalFacture), helper: 'Factures', icon: Download, tone: 'gold' },
          { label: 'Total encaissé', value: formatMAD(totalEncaisse), helper: 'Reçus', icon: Download, tone: 'green' },
          { label: 'Solde ouvert', value: formatMAD(soldeOuvert), helper: 'À encaisser', icon: Download, tone: 'amber' },
          { label: 'En retard', value: String(enRetard), helper: 'Relance', icon: MessageCircle, tone: 'red' },
        ].map(({ label, value, helper, icon: Icon, tone }) => (
          <div
            key={label}
            className="relative min-h-[106px] min-w-[138px] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_18px_48px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.04)] transition duration-300 hover:-translate-y-0.5 hover:border-gold-300/30  md:min-h-[112px] md:min-w-0 md:rounded-3xl md:p-4"
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 ${
              tone === 'green'
                ? 'bg-emerald-300/60'
                : tone === 'red'
                  ? 'bg-rose-300/60'
                  : tone === 'amber'
                    ? 'bg-amber-300/70'
                    : 'bg-gold-300/70'
            }`} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase leading-3 tracking-[0.12em] text-[var(--app-text-muted)]">{label}</p>
                <p className="mt-2 truncate text-[1.2rem] font-black leading-none text-[var(--app-text)]  md:text-xl">{value}</p>
              </div>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border md:h-10 md:w-10 md:rounded-2xl ${
                tone === 'green'
                  ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200'
                  : tone === 'red'
                    ? 'border-rose-300/20 bg-rose-400/10 text-rose-200'
                    : tone === 'amber'
                      ? 'border-amber-300/25 bg-amber-400/10 text-amber-700 dark:text-amber-200'
                      : 'border-gold-300/25 bg-gold-400/12 text-[var(--app-gold-text)]'
              }`}>
                <Icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
              </span>
            </div>
            <p className="mt-2 truncate text-[11px] text-[var(--app-text-muted)] md:text-xs">{helper}</p>
          </div>
        ))}
      </div>

      <Card className="mt-3 p-3 md:mt-6 md:p-4">
        <div className="grid gap-2.5 md:grid-cols-[1fr_auto_auto] md:gap-3">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
            <input className="form-control h-11 w-full rounded-2xl pl-10 pr-4 text-sm md:h-10" value={query} onChange={(e) => setQuery(sanitizeText(e.target.value, 120))} placeholder="Rechercher facture, client, véhicule..." />
          </label>
          <select className="form-control h-11 min-w-0 rounded-2xl text-sm md:h-10 md:min-w-[170px]" value={methodFilter} onChange={(event) => setMethodFilter(event.target.value as MethodFilter)}>
            <option value="toutes">Méthodes: Toutes</option>
            <option value="Cash">Espèces</option>
            <option value="Bank transfer">Virement</option>
            <option value="Card">Carte</option>
          </select>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 no-scrollbar md:mx-0 md:px-0">
            {filters.map((f) => (
              <button key={f.key} className={`h-9 shrink-0 rounded-full border px-3 text-xs font-bold transition ${filter === f.key ? 'border-gold-300/50 bg-gold-400 text-[#101820] shadow-[0_10px_24px_rgba(227,177,23,.16)]' : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] hover:border-gold-300/25 hover:text-[var(--app-text)]'}`} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="mt-4 p-6 text-center md:mt-6 md:p-10">
          <p className="text-base font-semibold text-[var(--app-text)]">Aucun paiement trouvé</p>
          <p className="mt-2 text-sm text-[var(--app-text-muted)]">Ajustez vos filtres ou ajoutez un nouveau paiement.</p>
        </Card>
      ) : null}

      <Card className={`mt-6 hidden overflow-hidden md:block ${filtered.length === 0 ? 'hidden' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-[var(--app-border)] text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
              <tr>
                <th className="px-5 py-4">Facture</th><th className="px-5 py-4">Client</th><th className="px-5 py-4">Véhicule</th><th className="px-5 py-4">Réservation</th><th className="px-5 py-4">Montant</th><th className="px-5 py-4">Payé</th><th className="px-5 py-4">Reste</th><th className="px-5 py-4">Échéance</th><th className="px-5 py-4">Méthode</th><th className="px-5 py-4">Statut</th><th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--app-border)]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--app-surface-soft)]">
                  <td className="px-5 py-4 font-semibold">{item.invoice}</td><td className="px-5 py-4">{item.client}</td><td className="px-5 py-4">{item.vehicleLabel}</td><td className="px-5 py-4">{item.reservationCode}</td><td className="px-5 py-4">{formatMAD(item.total)}</td><td className="px-5 py-4">{formatMAD(item.paid)}</td><td className="px-5 py-4">{formatMAD(item.remaining)}</td><td className="px-5 py-4">{item.dueDate}</td><td className="px-5 py-4">{item.method}</td><td className="px-5 py-4"><Badge>{item.statusFr}</Badge></td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" className="h-8 px-2.5 text-xs" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setDetailPaymentId(item.id)}>Voir</Button>
                      <Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => openPaymentModalForRow(item)}>Ajouter paiement</Button>
                      <Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => downloadReceipt(item)}>Télécharger reçu</Button>
                      <Button variant="secondary" className="h-8 px-2.5 text-xs" disabled={item.remaining <= 0} onClick={() => setReminderPaymentId(item.id)}>
                        {item.remaining <= 0 ? 'Payé intégralement' : 'Envoyer rappel'}
                      </Button>
                      <Button variant="danger" className="h-8 px-2.5 text-xs" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setPaymentToDelete(item)}>Supprimer</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className={`mt-3 grid gap-3 md:hidden ${filtered.length === 0 ? 'hidden' : ''}`}>
        {filtered.map((item) => (
          <Card key={item.id} className="overflow-hidden rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_14px_38px_rgba(0,0,0,.30)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-black text-[var(--app-text)]">{item.invoice}</p>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--app-text-soft)]">{item.client}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--app-text-muted)]">{item.vehicleLabel} · Réservation {item.reservationCode}</p>
              </div>
              <Badge>{item.statusFr}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2.5"><p className="text-[11px] text-[var(--app-text-muted)]">Total</p><strong className="mt-1 block truncate text-[var(--app-text)]">{formatMAD(item.total)}</strong></div>
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2.5"><p className="text-[11px] text-[var(--app-text-muted)]">Payé</p><strong className="mt-1 block truncate text-[var(--app-text)]">{formatMAD(item.paid)}</strong></div>
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2.5"><p className="text-[11px] text-[var(--app-text-muted)]">Reste</p><strong className={`mt-1 block truncate ${item.remaining > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-200'}`}>{item.remaining > 0 ? formatMAD(item.remaining) : 'Payé intégralement'}</strong></div>
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2.5"><p className="text-[11px] text-[var(--app-text-muted)]">Échéance</p><strong className="mt-1 block truncate text-[var(--app-text)]">{item.dueDate}</strong></div>
            </div>
            <div className="mt-2.5 h-2 rounded-full bg-[var(--app-surface-soft)]"><div className={`h-2 rounded-full ${item.statusFr === 'En retard' ? 'bg-rose-400' : item.statusFr === 'Partiel' ? 'bg-gold-400' : 'bg-mint-400'}`} style={{ width: `${item.progress}%` }} /></div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-10 min-w-0 rounded-xl px-2 text-xs" icon={<Eye className="h-4 w-4" />} onClick={() => setDetailPaymentId(item.id)}>Voir</Button>
              <Button variant="secondary" className="h-10 min-w-0 rounded-xl px-2 text-xs" onClick={() => openPaymentModalForRow(item)}>Ajouter</Button>
              <Button variant="secondary" className="h-10 min-w-0 rounded-xl px-2 text-xs" onClick={() => downloadReceipt(item)}>Reçu</Button>
              <Button variant="secondary" className="h-10 min-w-0 rounded-xl px-2 text-xs" disabled={item.remaining <= 0} onClick={() => setReminderPaymentId(item.id)}>
                {item.remaining <= 0 ? 'Soldé' : 'Rappel'}
              </Button>
              <Button variant="danger" className="col-span-2 h-10 rounded-xl text-xs" icon={<Trash2 className="h-4 w-4" />} onClick={() => setPaymentToDelete(item)}>Supprimer</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter un paiement">
        <form className="grid gap-4" onSubmit={handleAddPayment}>
          <SelectField
            label="Réservation / facture"
            name="reservationId"
            required
            value={selectedReservationId}
            onChange={(event) => setSelectedReservationId(event.target.value)}
          >
            {reservationChoices.length === 0 ? <option value="">Aucune réservation disponible</option> : null}
            {reservationChoices.map((item) => (
              <option key={item.reservation.id} value={item.reservation.id}>
                {item.label}
              </option>
            ))}
          </SelectField>
          <p className="-mt-2 text-xs text-[var(--app-text-muted)]">Sélectionnez une réservation pour remplir automatiquement le paiement.</p>

          {selectedReservationChoice && reservationSummary ? (
            <Card className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-gold-text)]">Résumé de paiement</p>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <p className="text-[var(--app-text-muted)]">Client</p><p className="text-right font-medium">{selectedReservationChoice.reservation.client || '—'}</p>
                <p className="text-[var(--app-text-muted)]">Véhicule</p><p className="text-right font-medium">{selectedReservationChoice.vehicleName}</p>
                <p className="text-[var(--app-text-muted)]">Dates</p><p className="text-right font-medium">{selectedReservationChoice.reservation.pickupDate} → {selectedReservationChoice.reservation.returnDate}</p>
                <p className="text-[var(--app-text-muted)]">Prix total</p><p className="text-right font-medium">{formatMAD(reservationSummary.total)}</p>
                <p className="text-[var(--app-text-muted)]">Déjà payé</p><p className="text-right font-medium">{formatMAD(reservationSummary.alreadyPaid)}</p>
                <p className="text-[var(--app-text-muted)]">Reste à payer</p><p className="text-right font-semibold text-[var(--app-gold-text)]">{formatMAD(reservationSummary.remaining)}</p>
                <p className="text-[var(--app-text-muted)]">Caution</p><p className="text-right font-medium">{formatMAD(selectedReservationChoice.reservation.deposit || 0)}</p>
                <p className="text-[var(--app-text-muted)]">Statut réservation</p><p className="text-right font-medium">{selectedReservationChoice.reservation.status}</p>
                <p className="text-[var(--app-text-muted)]">Statut paiement</p><p className="text-right font-medium">{reservationSummary.statusFr}</p>
              </div>
            </Card>
          ) : null}

          <Field label="Montant payé" name="amountPaid" type="number" required value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} />
          <SelectField label="Mode de paiement" name="method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'Cash' | 'Bank transfer' | 'Card' | 'Other')}>
            <option value="Cash">Espèces</option><option value="Bank transfer">Virement bancaire</option><option value="Card">Carte</option><option value="Other">Autre</option>
          </SelectField>
          <Field label="Date de paiement" name="paymentDate" type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
          <TextAreaField label="Notes" name="notes" placeholder="Détails complémentaires..." value={paymentNotes} onChange={(event) => setPaymentNotes(sanitizeText(event.target.value, 260))} />
          <Field label="Justificatif" name="receipt" placeholder="URL ou nom du fichier reçu" />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button><Button type="submit" loading={savingPayment}>{savingPayment ? 'Enregistrement...' : 'Enregistrer'}</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(detailPayment)} onClose={() => setDetailPaymentId(null)} title={`Détail facture · ${detailPayment?.invoice || ''}`}>
        {detailPayment ? (
          <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+8px)]">
            <div className="relative overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#D4A017]/10 to-transparent" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--app-gold-text)]">{detailPayment.invoice}</p>
                  <h3 className="mt-1 truncate text-lg font-black text-[var(--app-text)]">{detailPayment.client}</h3>
                  <p className="mt-1 truncate text-sm font-semibold text-[var(--app-text-soft)]">{detailPayment.vehicleLabel} · Réservation {detailPayment.reservationCode}</p>
                </div>
                <Badge>{detailPayment.statusFr}</Badge>
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <SummaryTile label="Total" value={formatMAD(detailPayment.total)} />
                <SummaryTile label="Payé" value={formatMAD(detailPayment.paid)} />
                <SummaryTile label="Reste" value={detailPayment.remaining > 0 ? formatMAD(detailPayment.remaining) : 'Payé intégralement'} valueClassName={detailPayment.remaining > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-200'} />
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-[var(--app-text-soft)]">
              <TextLine label="Facture" value={detailPayment.invoice} />
              <TextLine label="Client" value={detailPayment.client} />
              <TextLine label="Véhicule" value={detailPayment.vehicleLabel} />
              <TextLine label="Réservation" value={detailPayment.reservationCode} />
              <TextLine label="Échéance" value={detailPayment.dueDate} />
              <TextLine label="Méthode" value={methodFr(detailPayment.method)} />
              <TextLine label="Statut" value={detailPayment.statusFr} valueClassName={detailPayment.remaining > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-200'} />
            </div>

            <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Historique des paiements</p>
              <div className="mt-3 grid gap-2">
                {detailPayment.relatedPayments.map((payment) => (
                  <div key={payment.id} className="grid gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--app-text)]">{payment.invoice}</p>
                      <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{payment.dueDate} · {methodFr(payment.method)}</p>
                    </div>
                    <Badge>{payment.status}</Badge>
                    <p className="font-black text-[var(--app-gold-text)]">{formatMAD(payment.amount)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <Button variant="secondary" className="h-11 rounded-xl text-xs sm:text-sm" onClick={() => { setDetailPaymentId(null); openPaymentModalForRow(detailPayment); }}>Ajouter paiement</Button>
              <Button variant="secondary" className="h-11 rounded-xl text-xs sm:text-sm" onClick={() => downloadReceipt(detailPayment)}>Télécharger reçu</Button>
              <Button variant="secondary" className="h-11 rounded-xl text-xs sm:text-sm" disabled={detailPayment.remaining <= 0} onClick={() => setReminderPaymentId(detailPayment.id)}>
                Rappel
              </Button>
              <Button variant="danger" className="h-11 rounded-xl text-xs sm:text-sm" onClick={() => setPaymentToDelete(detailPayment)}>Supprimer</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(reminderPayment)} onClose={() => setReminderPaymentId(null)} title="Rappel de paiement">
        {reminderPayment ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Le rappel peut être copié/envoyé manuellement</p>
              <p className="mt-3 text-sm leading-6 text-[var(--app-text-soft)]">Aucun envoi automatique n’est déclenché depuis MekLoc ici. Vous pouvez copier le message ou ouvrir WhatsApp si un numéro client est disponible.</p>
            </div>
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm leading-6 text-[var(--app-text-soft)]">
              {buildManualReminderMessage(reminderPayment)}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="secondary" className="h-11 rounded-xl" icon={<Copy className="h-4 w-4" />} onClick={copyReminderMessage}>Copier</Button>
              <Button
                variant="secondary"
                className="h-11 rounded-xl"
                icon={<MessageCircle className="h-4 w-4" />}
                disabled={!notificationPreferences.paymentReminder || !reminderPayment.clientPhone}
                onClick={() => sendWhatsappReminder(reminderPayment)}
              >
                WhatsApp
              </Button>
              <Button className="h-11 rounded-xl" onClick={() => setReminderPaymentId(null)}>Terminer</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(paymentToDelete)} onClose={() => setPaymentToDelete(null)} title="Supprimer le paiement">
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
            <p className="font-semibold text-[var(--app-danger)]">Cette action supprimera ce paiement ou reçu.</p>
            <p className="mt-2 text-sm text-[var(--app-text-soft)]">Si ce paiement est lié à une réservation, le solde sera recalculé après suppression.</p>
          </div>
          <p className="text-sm text-[var(--app-text-soft)]">Facture: <strong>{paymentToDelete?.invoice}</strong></p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPaymentToDelete(null)}>Annuler</Button>
            <Button type="button" variant="danger" onClick={confirmDeletePayment}>Supprimer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SummaryTile({ label, value, valueClassName = 'text-[var(--app-text)]' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
      <p className="text-xs text-[var(--app-text-muted)]">{label}</p>
      <p className={`mt-1 truncate font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}

function TextLine({ label, value, valueClassName = 'text-[var(--app-text)]' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] pb-3 last:border-0 last:pb-0">
      <span className="text-[var(--app-text-muted)]">{label}</span>
      <strong className={`min-w-0 truncate text-right ${valueClassName}`}>{value || '—'}</strong>
    </div>
  );
}
