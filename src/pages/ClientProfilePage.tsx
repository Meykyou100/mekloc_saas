import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Car,
  CreditCard,
  Edit3,
  Eye,
  FileImage,
  FileSignature,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { formatMAD, type Client, type Contract, type Payment, type Reservation } from '../data/mockData';
import { useData } from '../context/DataContext';

function clientInitials(name?: string) {
  const parts = (name || 'Client').trim().split(/\s+/).filter(Boolean);
  return parts.map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'CL';
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '—';
  return date.toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function reservationRef(reservation: Reservation) {
  return reservation.recordId || reservation.id;
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    Confirmed: 'Confirmée',
    Active: 'Active',
    Completed: 'Terminée',
    Cancelled: 'Annulée',
    Paid: 'Payé',
    Partial: 'Partiel',
    Pending: 'En attente',
    Late: 'En retard',
    Draft: 'Brouillon',
    Signed: 'Signé',
    Downloaded: 'Téléchargé',
  };
  return status ? labels[status] || status : '—';
}

function paymentMethodLabel(method?: string) {
  const labels: Record<string, string> = {
    Cash: 'Espèces',
    Card: 'Carte',
    'Bank transfer': 'Virement',
  };
  return method ? labels[method] || method : '—';
}

function hasCompleteDocs(client: Client) {
  return Boolean(client.idCardFrontUrl && client.idCardBackUrl);
}

export default function ClientProfilePage() {
  const { id } = useParams();
  const { clients, reservations, payments, contracts } = useData();
  const [previewImage, setPreviewImage] = useState<{ title: string; url: string } | null>(null);
  const client = clients.find((item) => item.id === id);

  const clientReservations = useMemo(() => {
    if (!client) return [];
    return reservations
      .filter((reservation) => reservation.clientId === client.id)
      .sort((a, b) => new Date(b.pickupDate || 0).getTime() - new Date(a.pickupDate || 0).getTime());
  }, [client, reservations]);

  const reservationIds = useMemo(() => new Set(clientReservations.map((reservation) => reservation.recordId || reservation.id)), [clientReservations]);

  const clientPayments = useMemo(() => {
    if (!client) return [];
    return payments
      .filter((payment) => payment.clientId === client.id || (payment.reservationId ? reservationIds.has(payment.reservationId) : false) || payment.client === client.fullName)
      .sort((a, b) => new Date(b.dueDate || 0).getTime() - new Date(a.dueDate || 0).getTime());
  }, [client, payments, reservationIds]);

  const clientContracts = useMemo(() => {
    if (!client) return [];
    return contracts
      .filter((contract) => contract.clientId === client.id || contract.client === client.fullName)
      .sort((a, b) => new Date(b.pickupDate || 0).getTime() - new Date(a.pickupDate || 0).getTime());
  }, [client, contracts]);

  if (!client) {
    return (
      <div>
        <Link to="/clients" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200 light:text-carbon-700">
          <ArrowLeft className="h-4 w-4" />
          Retour aux clients
        </Link>
        <Card className="p-6 text-carbon-300 light:text-carbon-700">Aucun client trouvé.</Card>
      </div>
    );
  }

  const reservationTotal = clientReservations.reduce((sum, reservation) => sum + (reservation.totalAmount ?? 0), 0);
  const paymentTotal = clientPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalSpent = paymentTotal || reservationTotal || client.totalSpent || 0;
  const latestReservation = clientReservations[0];
  const docsComplete = hasCompleteDocs(client);
  const isVerified = docsComplete && Boolean(client.cin || client.license);

  const metrics = [
    { label: 'Total locations', value: String(clientReservations.length), icon: Car, helper: 'Historique réel' },
    { label: 'Total dépensé', value: totalSpent ? formatMAD(totalSpent) : '—', icon: Wallet, helper: 'Paiements ou réservations' },
    { label: 'Dernière réservation', value: latestReservation ? formatDate(latestReservation.pickupDate) : '—', icon: CalendarClock, helper: latestReservation?.vehicle || 'Aucune location' },
    { label: 'Client depuis', value: formatDate(client.createdAt), icon: BadgeCheck, helper: client.createdAt ? 'Date de création' : 'Non renseigné' },
  ];

  return (
    <div className="relative overflow-x-hidden pb-8">
      <div className="pointer-events-none absolute right-[-12%] top-10 h-80 w-80 rounded-full bg-[#D4A017]/10 blur-3xl" />

      <Link to="/clients" className="relative mb-5 inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 transition hover:text-gold-200 light:text-carbon-700">
        <ArrowLeft className="h-4 w-4" />
        Retour aux clients
      </Link>

      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-zinc-950/95 via-[#11151c] to-black p-5 shadow-[0_28px_80px_rgba(0,0,0,.34)] md:p-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#D4A017]/14 to-transparent" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-[28px] bg-gradient-to-br from-[#F5C542] to-[#B8870E] text-3xl font-black text-black shadow-[0_0_48px_rgba(212,160,23,0.25)]">
              {clientInitials(client.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.26em] text-gold-200">Profil client</p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-white md:text-4xl">{client.fullName}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-carbon-300">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">CIN / Passeport: <strong className="text-white">{client.cin || 'Non renseigné'}</strong></span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Permis: <strong className="text-white">{client.license || 'Non renseigné'}</strong></span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{client.status === 'New' ? 'New' : 'Actif'}</Badge>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${docsComplete ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-200' : 'border-amber-300/30 bg-amber-500/12 text-amber-100'}`}>
                  {docsComplete ? 'Documents complets' : 'Documents manquants'}
                </span>
                {isVerified ? (
                  <span className="rounded-full border border-gold-300/25 bg-gold-400/12 px-3 py-1 text-xs font-bold text-gold-100">Client vérifié</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:items-center xl:justify-end">
            <Link to="/reservations" className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#D4A017] px-4 text-sm font-black text-black transition hover:bg-[#f1c232]">
              <UserPlus className="h-4 w-4" />
              Nouvelle réservation
            </Link>
            <Link to="/contracts" className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/10 px-4 text-sm font-bold text-gold-100 transition hover:bg-[#D4A017]/16">
              <FileSignature className="h-4 w-4" />
              Créer un contrat
            </Link>
            <Link to="/clients" className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-white transition hover:bg-white/[0.08]">
              <Edit3 className="h-4 w-4" />
              Modifier client
            </Link>
            <button type="button" className="focus-ring inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-white transition hover:bg-white/[0.08]" aria-label="Plus d’actions">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      <section className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, helper }) => (
          <div key={label} className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950/90 to-black p-4 shadow-[0_18px_48px_rgba(0,0,0,.26)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-carbon-500">{label}</p>
                <p className="mt-3 truncate text-2xl font-black text-white">{value}</p>
                <p className="mt-1 truncate text-xs text-carbon-500">{helper}</p>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 text-gold-200">
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </section>

      <div className="relative mt-6 grid gap-6 xl:grid-cols-[minmax(340px,0.4fr)_minmax(520px,0.6fr)]">
        <div className="grid gap-6">
          <InfoCard title="Coordonnées" icon={Phone}>
            <InfoRow icon={Phone} label="Téléphone" value={client.phone} />
            <InfoRow icon={Mail} label="Email" value={client.email} />
            <InfoRow icon={MapPin} label="Adresse" value={client.address} />
            <InfoRow icon={MapPin} label="Ville" value="" />
          </InfoCard>

          <Card className="border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-5 shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            <SectionTitle icon={FileImage} title="Pièces d’identité" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <DocumentPreview title="Recto" url={client.idCardFrontUrl} onOpen={(url) => setPreviewImage({ title: 'Pièce identité recto', url })} />
              <DocumentPreview title="Verso" url={client.idCardBackUrl} onOpen={(url) => setPreviewImage({ title: 'Pièce identité verso', url })} />
            </div>
            <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm">
              <TextPair label="CIN / Passeport" value={client.cin || 'Non renseigné'} />
              <TextPair label="Permis" value={client.license || 'Non renseigné'} />
              <TextPair label="Statut" value={docsComplete ? 'Complet' : 'Incomplet'} valueClassName={docsComplete ? 'text-emerald-200' : 'text-amber-100'} />
            </div>
          </Card>

          <InfoCard title="Notes internes" icon={Edit3}>
            <p className="text-sm leading-6 text-carbon-300">Aucune note interne.</p>
          </InfoCard>
        </div>

        <div className="grid gap-6">
          <Card className="border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-5 shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            <SectionTitle icon={Car} title="Historique des locations" />
            <div className="mt-5 grid gap-3">
              {clientReservations.length ? clientReservations.map((reservation) => (
                <ReservationRow key={reservation.id} reservation={reservation} />
              )) : <EmptyHistory icon={Car} text="Aucune location enregistrée pour ce client." />}
            </div>
          </Card>

          <Card className="border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-5 shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            <SectionTitle icon={CreditCard} title="Historique des paiements" />
            <div className="mt-5 grid gap-3">
              {clientPayments.length ? clientPayments.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} reservations={clientReservations} />
              )) : <EmptyHistory icon={CreditCard} text="Aucun paiement lié à ce client pour le moment." />}
            </div>
          </Card>

          <Card className="border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-5 shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            <SectionTitle icon={FileSignature} title="Contrats liés" />
            <div className="mt-5 grid gap-3">
              {clientContracts.length ? clientContracts.map((contract) => (
                <ContractRow key={contract.id} contract={contract} />
              )) : <EmptyHistory icon={FileText} text="Vous n’avez pas encore généré de contrat pour ce client." />}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={Boolean(previewImage)} title={previewImage?.title || 'Document'} onClose={() => setPreviewImage(null)}>
        {previewImage ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black">
              <img src={previewImage.url} alt={previewImage.title} className="max-h-[70vh] w-full object-contain" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setPreviewImage(null)}>Fermer</Button>
              <a href={previewImage.url} target="_blank" rel="noreferrer" className="focus-ring inline-flex h-10 items-center justify-center rounded-xl bg-[#D4A017] px-4 text-sm font-black text-black">
                Ouvrir l’image
              </a>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Phone; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 text-gold-200">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="text-base font-black text-white light:text-carbon-950">{title}</h2>
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: typeof Phone; children: React.ReactNode }) {
  return (
    <Card className="border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-5 shadow-[0_24px_70px_rgba(0,0,0,.28)]">
      <SectionTitle icon={icon} title={title} />
      <div className="mt-5 grid gap-3">{children}</div>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-gold-200" />
      <div className="min-w-0">
        <p className="text-xs text-carbon-500">{label}</p>
        <p className="truncate text-sm font-semibold text-white light:text-carbon-950">{value?.trim() || 'Non renseigné'}</p>
      </div>
    </div>
  );
}

function TextPair({ label, value, valueClassName = 'text-white light:text-carbon-950' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-carbon-500">{label}</span>
      <strong className={`text-right ${valueClassName}`}>{value}</strong>
    </div>
  );
}

function DocumentPreview({ title, url, onOpen }: { title: string; url?: string; onOpen: (url: string) => void }) {
  const [broken, setBroken] = useState(false);
  const validUrl = Boolean(url && !broken);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white light:text-carbon-950">{title}</p>
        {validUrl ? <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-bold text-emerald-200">Ajouté</span> : null}
      </div>
      {validUrl && url ? (
        <div className="space-y-3">
          <button type="button" onClick={() => onOpen(url)} className="block w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <img
              src={url}
              alt={`Document ${title}`}
              onError={() => setBroken(true)}
              className="h-44 w-full object-cover"
            />
          </button>
          <button type="button" onClick={() => onOpen(url)} className="focus-ring inline-flex h-9 items-center gap-2 rounded-xl border border-[#D4A017]/25 bg-[#D4A017]/10 px-3 text-xs font-bold text-gold-100">
            <Eye className="h-3.5 w-3.5" />
            Ouvrir l’image
          </button>
        </div>
      ) : (
        <div className="grid h-44 place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20 text-center">
          <div>
            <FileImage className="mx-auto h-8 w-8 text-carbon-500" />
            <p className="mt-3 text-sm font-bold text-carbon-300">Document non ajouté</p>
            <p className="mt-1 text-xs text-carbon-500">Ajoutez ce document depuis la fiche client.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyHistory({ icon: Icon, text }: { icon: typeof Phone; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center">
      <Icon className="mx-auto h-8 w-8 text-carbon-500" />
      <p className="mt-3 text-sm font-semibold text-carbon-300">{text}</p>
    </div>
  );
}

function ReservationRow({ reservation }: { reservation: Reservation }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-[#D4A017]/25 hover:bg-white/[0.055]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-black text-white light:text-carbon-950">{reservation.vehicle || 'Véhicule non renseigné'}</p>
          <p className="mt-1 text-sm text-carbon-400">{reservationRef(reservation)} · {formatDate(reservation.pickupDate)} → {formatDate(reservation.returnDate)}</p>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <Badge>{statusLabel(reservation.status)}</Badge>
          <p className="font-black text-gold-100">{reservation.totalAmount ? formatMAD(reservation.totalAmount) : '—'}</p>
          <Link to="/reservations" className="focus-ring inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-white">
            Voir
          </Link>
        </div>
      </div>
    </div>
  );
}

function PaymentRow({ payment, reservations }: { payment: Payment; reservations: Reservation[] }) {
  const linkedReservation = reservations.find((reservation) => payment.reservationId && reservationIdsEqual(payment.reservationId, reservation));
  const displayReference = payment.invoice || (linkedReservation ? reservationRef(linkedReservation) : 'Paiement');
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-white light:text-carbon-950">{displayReference}</p>
          <p className="mt-1 text-sm text-carbon-400">{formatDate(payment.dueDate)} · {paymentMethodLabel(payment.method)}</p>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <Badge>{statusLabel(payment.status)}</Badge>
          <p className="font-black text-gold-100">{formatMAD(payment.amount)}</p>
        </div>
      </div>
    </div>
  );
}

function reservationIdsEqual(paymentReservationId: string, reservation: Reservation) {
  return paymentReservationId === reservation.id || paymentReservationId === reservation.recordId;
}

function ContractRow({ contract }: { contract: Contract }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-black text-white light:text-carbon-950">{contract.contractNumber || contract.id}</p>
          <p className="mt-1 text-sm text-carbon-400">{contract.vehicle || 'Véhicule non renseigné'} · {formatDate(contract.pickupDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{statusLabel(contract.status)}</Badge>
          {contract.pdfPath ? (
            <a href={contract.pdfPath} target="_blank" rel="noreferrer" className="focus-ring inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-white">
              Ouvrir
            </a>
          ) : (
            <Link to="/contracts" className="focus-ring inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-white">
              Voir
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
