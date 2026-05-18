import { Download, MessageCircle, Plus, Search } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField, TextAreaField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { formatMAD, type Payment, type PaymentStatus, type Reservation } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getReservationPaymentId(reservation: Reservation) {
  return reservation.recordId && UUID_RE.test(reservation.recordId) ? reservation.recordId : reservation.id;
}

function paymentMatchesReservation(payment: Pick<Payment, 'reservationId'>, reservation: Reservation) {
  return Boolean(payment.reservationId && payment.reservationId === getReservationPaymentId(reservation));
}

function getPaidAmount(payment: Payment) {
  return payment.status === 'Pending' || payment.status === 'Late' ? 0 : Math.max(0, payment.amount);
}

export default function PaymentsPage() {
  const { payments, reservations, vehicles, clients, createPayment, updatePayment } = useData();
  const { notify } = useApp();
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
  const supportPhone = '212762971653';
  const paymentRows = payments;

  const enriched = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return paymentRows.map((payment) => {
      const reservation = reservations.find((item) => paymentMatchesReservation(payment, item));
      const vehicleId = payment.vehicleId || reservation?.vehicleId;
      const vehicle = vehicleId ? vehicles.find((item) => item.id === vehicleId) : undefined;
      const total = reservation?.totalAmount || reservation?.dailyPrice || payment.amount;
      const paid = getPaidAmount(payment);
      const remaining = Math.max(0, total - paid);
      let statusFr: 'Payé' | 'Partiel' | 'En attente' | 'En retard' = payment.status === 'Paid' ? 'Payé' : payment.status === 'Partial' ? 'Partiel' : payment.status === 'Late' ? 'En retard' : 'En attente';
      if (remaining === 0) statusFr = 'Payé';
      else if (payment.dueDate < now) statusFr = 'En retard';
      else if (paid > 0) statusFr = 'Partiel';
      return {
        ...payment,
        reservationCode: reservation?.id || '—',
        vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model}` : '—',
        total,
        paid,
        remaining,
        statusFr,
        progress: total > 0 ? Math.round((paid / total) * 100) : 0,
      };
    });
  }, [paymentRows, reservations, vehicles]);

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

  const filtered = enriched.filter((item) => {
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
  });

  const totalFacture = enriched.reduce((s, i) => s + i.total, 0);
  const totalEncaisse = enriched.reduce((s, i) => s + i.paid, 0);
  const soldeOuvert = Math.max(0, totalFacture - totalEncaisse);
  const enRetard = enriched.filter((i) => i.statusFr === 'En retard').length;

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

  function downloadReceipt(invoice: string, total: number, paid: number, remaining: number) {
    const escapePdf = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const rows = [
      'FACTURE / REÇU DE PAIEMENT',
      `Facture: ${invoice}`,
      `Date: ${new Date().toLocaleDateString('fr-MA')}`,
      `Montant total: ${formatMAD(total)}`,
      `Montant payé: ${formatMAD(paid)}`,
      `Reste à payer: ${formatMAD(remaining)}`,
      'Agence: MekLoc',
      'Signature agence: _____________________',
      'Contrat généré par MekLoc',
    ];
    const stream = rows
      .map((line, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 50 ${780 - i * 24} Td (${escapePdf(line)}) Tj ET`)
      .join('\n');
    const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000117 00000 n
0000000243 00000 n
000000${(260 + stream.length).toString().padStart(10, '0')} 00000 n
trailer << /Root 1 0 R /Size 6 >>
startxref
0
%%EOF`;
    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facture-${invoice}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function sendWhatsappReminder(invoice: string, amount: number) {
    const text = encodeURIComponent(`Bonjour, rappel de paiement MekLoc pour la facture ${invoice}. Montant: ${formatMAD(amount)}.`);
    window.open(`https://wa.me/${supportPhone}?text=${text}`, '_blank', 'noopener,noreferrer');
    notify({ title: 'WhatsApp', message: 'Rappel WhatsApp prêt à être envoyé.', type: 'info' });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Facturation"
        title="Paiements"
        description="Gérez les factures, encaissements partiels, retards et relances clients."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>Ajouter un paiement</Button>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total facturé" value={formatMAD(totalFacture)} trend="Montants des factures" icon={Download} />
        <StatCard label="Total encaissé" value={formatMAD(totalEncaisse)} trend="Paiements reçus" icon={Download} />
        <StatCard label="Solde ouvert" value={formatMAD(soldeOuvert)} trend="Reste à encaisser" icon={Download} />
        <StatCard label="Factures en retard" value={String(enRetard)} trend="Relance requise" icon={MessageCircle} />
      </div>

      <Card className="mt-6 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
            <input className="form-control h-10 w-full pl-10 pr-4 text-sm" value={query} onChange={(e) => setQuery(sanitizeText(e.target.value, 120))} placeholder="Rechercher facture, client, véhicule, réservation..." />
          </label>
          <select className="form-control h-10 min-w-[170px] text-sm" value={methodFilter} onChange={(event) => setMethodFilter(event.target.value as MethodFilter)}>
            <option value="toutes">Méthodes: Toutes</option>
            <option value="Cash">Espèces</option>
            <option value="Bank transfer">Virement</option>
            <option value="Card">Carte</option>
          </select>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 no-scrollbar md:mx-0 md:px-0">
            {filters.map((f) => (
              <button key={f.key} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === f.key ? 'bg-gold-400 text-carbon-950' : 'border border-white/10 bg-white/[0.04] text-carbon-300'}`} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <p className="text-base font-semibold text-white">Aucun paiement trouvé</p>
          <p className="mt-2 text-sm text-carbon-400">Ajustez vos filtres ou ajoutez un nouveau paiement.</p>
        </Card>
      ) : null}

      <Card className={`mt-6 hidden overflow-hidden md:block ${filtered.length === 0 ? 'hidden' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-white/[0.06] text-xs uppercase tracking-wide text-carbon-400">
              <tr>
                <th className="px-5 py-4">Facture</th><th className="px-5 py-4">Client</th><th className="px-5 py-4">Véhicule</th><th className="px-5 py-4">Réservation</th><th className="px-5 py-4">Montant</th><th className="px-5 py-4">Payé</th><th className="px-5 py-4">Reste</th><th className="px-5 py-4">Échéance</th><th className="px-5 py-4">Méthode</th><th className="px-5 py-4">Statut</th><th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.03]">
                  <td className="px-5 py-4 font-semibold">{item.invoice}</td><td className="px-5 py-4">{item.client}</td><td className="px-5 py-4">{item.vehicleLabel}</td><td className="px-5 py-4">{item.reservationCode}</td><td className="px-5 py-4">{formatMAD(item.total)}</td><td className="px-5 py-4">{formatMAD(item.paid)}</td><td className="px-5 py-4">{formatMAD(item.remaining)}</td><td className="px-5 py-4">{item.dueDate}</td><td className="px-5 py-4">{item.method}</td><td className="px-5 py-4"><Badge>{item.statusFr}</Badge></td>
                  <td className="px-5 py-4"><div className="flex gap-2"><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => notify({ title: 'Détail facture', message: `${item.invoice} · ${formatMAD(item.total)}`, type: 'info' })}>Voir</Button><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => setModalOpen(true)}>Ajouter paiement</Button><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => downloadReceipt(item.invoice, item.total, item.paid, item.remaining)}>Télécharger reçu</Button><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => sendWhatsappReminder(item.invoice, item.remaining)}>Envoyer rappel</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className={`mt-6 grid gap-4 md:hidden ${filtered.length === 0 ? 'hidden' : ''}`}>
        {filtered.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-center justify-between"><p className="font-semibold">{item.invoice}</p><Badge>{item.statusFr}</Badge></div>
            <p className="mt-1 text-sm text-carbon-400">{item.client} · {item.vehicleLabel}</p>
            <p className="mt-1 text-xs text-carbon-500">Réservation: {item.reservationCode}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <p>Total: <strong>{formatMAD(item.total)}</strong></p><p>Payé: <strong>{formatMAD(item.paid)}</strong></p><p>Reste: <strong>{formatMAD(item.remaining)}</strong></p><p>Échéance: <strong>{item.dueDate}</strong></p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10"><div className={`h-2 rounded-full ${item.statusFr === 'En retard' ? 'bg-rose-400' : item.statusFr === 'Partiel' ? 'bg-gold-400' : 'bg-mint-400'}`} style={{ width: `${item.progress}%` }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" className="h-9 text-xs" onClick={() => downloadReceipt(item.invoice, item.total, item.paid, item.remaining)}>Télécharger reçu</Button><Button variant="secondary" className="h-9 text-xs" onClick={() => sendWhatsappReminder(item.invoice, item.remaining)}>Envoyer rappel</Button></div>
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
          <p className="-mt-2 text-xs text-carbon-500">Sélectionnez une réservation pour remplir automatiquement le paiement.</p>

          {selectedReservationChoice && reservationSummary ? (
            <Card className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-200">Résumé de paiement</p>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <p className="text-carbon-400">Client</p><p className="text-right font-medium">{selectedReservationChoice.reservation.client || '—'}</p>
                <p className="text-carbon-400">Véhicule</p><p className="text-right font-medium">{selectedReservationChoice.vehicleName}</p>
                <p className="text-carbon-400">Dates</p><p className="text-right font-medium">{selectedReservationChoice.reservation.pickupDate} → {selectedReservationChoice.reservation.returnDate}</p>
                <p className="text-carbon-400">Prix total</p><p className="text-right font-medium">{formatMAD(reservationSummary.total)}</p>
                <p className="text-carbon-400">Déjà payé</p><p className="text-right font-medium">{formatMAD(reservationSummary.alreadyPaid)}</p>
                <p className="text-carbon-400">Reste à payer</p><p className="text-right font-semibold text-gold-200">{formatMAD(reservationSummary.remaining)}</p>
                <p className="text-carbon-400">Caution</p><p className="text-right font-medium">{formatMAD(selectedReservationChoice.reservation.deposit || 0)}</p>
                <p className="text-carbon-400">Statut réservation</p><p className="text-right font-medium">{selectedReservationChoice.reservation.status}</p>
                <p className="text-carbon-400">Statut paiement</p><p className="text-right font-medium">{reservationSummary.statusFr}</p>
              </div>
            </Card>
          ) : null}

          <Field label="Montant payé" name="amountPaid" type="number" required value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} />
          <SelectField label="Mode de paiement" name="method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'Cash' | 'Bank transfer' | 'Card' | 'Other')}>
            <option value="Cash">Espèces</option><option value="Bank transfer">Virement bancaire</option><option value="Card">Carte</option><option value="Other">Autre</option>
          </SelectField>
          <Field label="Date de paiement" name="paymentDate" type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
          <TextAreaField label="Notes" name="notes" placeholder="Détails complémentaires..." value={paymentNotes} onChange={(event) => setPaymentNotes(sanitizeText(event.target.value, 260))} />
          <Field label="Justificatif (placeholder)" name="receipt" placeholder="URL ou nom du fichier reçu" />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button><Button type="submit" loading={savingPayment}>{savingPayment ? 'Enregistrement...' : 'Enregistrer'}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
