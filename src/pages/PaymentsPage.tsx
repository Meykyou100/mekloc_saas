import { Download, MessageCircle, Plus, Search } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField, TextAreaField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { formatMAD, type PaymentStatus } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

type FilterKey = 'tous' | 'paye' | 'partiel' | 'attente' | 'retard' | 'mois';
const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'tous', label: 'Tous' },
  { key: 'paye', label: 'Payé' },
  { key: 'partiel', label: 'Partiel' },
  { key: 'attente', label: 'En attente' },
  { key: 'retard', label: 'En retard' },
  { key: 'mois', label: 'Ce mois' },
];

export default function PaymentsPage() {
  const { payments, reservations, vehicles } = useData();
  const { notify } = useApp();
  const [filter, setFilter] = useState<FilterKey>('tous');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [paidOverrides, setPaidOverrides] = useState<Record<string, number>>({});

  const enriched = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return payments.map((payment) => {
      const reservation = reservations.find((item) => item.id === payment.reservationId);
      const vehicle = reservation ? vehicles.find((item) => item.id === reservation.vehicleId) : undefined;
      const total = payment.amount;
      const basePaid = payment.status === 'Paid' ? total : payment.status === 'Partial' ? Math.round(total * 0.55) : 0;
      const paid = Math.min(total, paidOverrides[payment.id] ?? basePaid);
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
  }, [paidOverrides, payments, reservations, vehicles]);

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
    return matchesFilter && haystack.includes(query.toLowerCase());
  });

  const totalFacture = enriched.reduce((s, i) => s + i.total, 0);
  const totalEncaisse = enriched.reduce((s, i) => s + i.paid, 0);
  const soldeOuvert = Math.max(0, totalFacture - totalEncaisse);
  const enRetard = enriched.filter((i) => i.statusFr === 'En retard').length;

  function handleAddPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get('paymentId'));
    const amount = Number(form.get('amountPaid') || 0);
    setPaidOverrides((current) => ({ ...current, [id]: Math.max(0, (current[id] || 0) + amount) }));
    notify({ title: 'Paiement enregistré', message: 'Le paiement a été ajouté avec succès.', type: 'success' });
    setModalOpen(false);
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
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
            <input className="form-control h-10 w-full pl-10 pr-4 text-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher facture, client, véhicule, réservation..." />
          </label>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 no-scrollbar md:mx-0 md:px-0">
            {filters.map((f) => (
              <button key={f.key} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === f.key ? 'bg-gold-400 text-carbon-950' : 'border border-white/10 bg-white/[0.04] text-carbon-300'}`} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-6 hidden overflow-hidden md:block">
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
                  <td className="px-5 py-4"><div className="flex gap-2"><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => notify({ title: 'Détail facture', message: `${item.invoice} · ${formatMAD(item.total)}`, type: 'info' })}>Voir</Button><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => setModalOpen(true)}>Ajouter paiement</Button><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => notify({ title: 'Téléchargement prêt', message: 'Le reçu PDF est prêt à être généré.', type: 'info' })}>Télécharger reçu</Button><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => notify({ title: 'Rappel WhatsApp', message: 'Rappel WhatsApp prêt à être envoyé.', type: 'info' })}>Envoyer rappel</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 md:hidden">
        {filtered.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-center justify-between"><p className="font-semibold">{item.invoice}</p><Badge>{item.statusFr}</Badge></div>
            <p className="mt-1 text-sm text-carbon-400">{item.client} · {item.vehicleLabel}</p>
            <p className="mt-1 text-xs text-carbon-500">Réservation: {item.reservationCode}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <p>Total: <strong>{formatMAD(item.total)}</strong></p><p>Payé: <strong>{formatMAD(item.paid)}</strong></p><p>Reste: <strong>{formatMAD(item.remaining)}</strong></p><p>Échéance: <strong>{item.dueDate}</strong></p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10"><div className={`h-2 rounded-full ${item.statusFr === 'En retard' ? 'bg-rose-400' : item.statusFr === 'Partiel' ? 'bg-gold-400' : 'bg-mint-400'}`} style={{ width: `${item.progress}%` }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" className="h-9 text-xs" onClick={() => notify({ title: 'Reçu', message: 'Le reçu PDF est prêt à être généré.', type: 'info' })}>Télécharger reçu</Button><Button variant="secondary" className="h-9 text-xs" onClick={() => notify({ title: 'Rappel WhatsApp', message: 'Rappel WhatsApp prêt à être envoyé.', type: 'info' })}>Envoyer rappel</Button></div>
          </Card>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter un paiement">
        <form className="grid gap-4" onSubmit={handleAddPayment}>
          <SelectField label="Facture / réservation" name="paymentId" required>{enriched.map((item) => <option key={item.id} value={item.id}>{item.invoice} · {item.client}</option>)}</SelectField>
          <Field label="Montant payé" name="amountPaid" type="number" required />
          <SelectField label="Mode de paiement" name="method" defaultValue="Espèces">
            <option>Espèces</option><option>Virement bancaire</option><option>Carte</option><option>Chèque</option><option>Autre</option>
          </SelectField>
          <Field label="Date de paiement" name="paymentDate" type="date" required />
          <TextAreaField label="Notes" name="notes" placeholder="Détails complémentaires..." />
          <Field label="Justificatif (placeholder)" name="receipt" placeholder="URL ou nom du fichier reçu" />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
        </form>
      </Modal>
    </div>
  );
}
