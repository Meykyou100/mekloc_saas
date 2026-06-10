import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Car,
  Copy,
  CreditCard,
  Download,
  Edit3,
  Eye,
  FileImage,
  FileSignature,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Save,
  Trash2,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { formatMAD, type Client, type Contract, type Payment, type Reservation } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import {
  getClientDocumentDownload,
  getClientDocumentKind,
  resolveClientDocumentUrl,
  type ClientDocumentKind,
} from '../lib/clientDocuments';
import { getClientPaymentBalance } from '../lib/paymentBalance';

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

type ClientEditForm = Pick<Client, 'fullName' | 'phone' | 'email' | 'cin' | 'license' | 'address'>;

function hasCompleteDocs(client: Client) {
  return Boolean(client.idCardFrontUrl && client.idCardBackUrl);
}

function buildEditForm(client: Client): ClientEditForm {
  return {
    fullName: client.fullName || '',
    phone: client.phone || '',
    email: client.email || '',
    cin: client.cin || '',
    license: client.license || '',
    address: client.address || '',
  };
}

export default function ClientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useApp();
  const { clients, reservations, payments, contracts, updateClient, deleteClient: removeClient } = useData();
  const [moreOpen, setMoreOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<ClientEditForm | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);
  const [frontDocumentPreview, setFrontDocumentPreview] = useState<string | null>(null);
  const [backDocumentPreview, setBackDocumentPreview] = useState<string | null>(null);
  const [documentAction, setDocumentAction] = useState<'front-view' | 'front-download' | 'back-view' | 'back-download' | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const documentResolveRef = useRef(0);
  const client = clients.find((item) => item.id === id);

  useEffect(() => {
    if (!moreOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreOpen]);

  useEffect(() => {
    const resolveId = documentResolveRef.current + 1;
    documentResolveRef.current = resolveId;
    setFrontDocumentPreview(null);
    setBackDocumentPreview(null);
    if (!client) return undefined;

    void Promise.all([
      resolveClientDocumentUrl(client.idCardFrontUrl),
      resolveClientDocumentUrl(client.idCardBackUrl),
    ]).then(([frontUrl, backUrl]) => {
      if (documentResolveRef.current !== resolveId) return;
      setFrontDocumentPreview(frontUrl);
      setBackDocumentPreview(backUrl);
    });

    return () => {
      documentResolveRef.current += 1;
    };
  }, [client?.id, client?.idCardFrontUrl, client?.idCardBackUrl]);

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

  const selectedClient = client;
  const reservationTotal = clientReservations.reduce((sum, reservation) => sum + (reservation.totalAmount ?? 0), 0);
  const paymentTotal = clientPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalSpent = paymentTotal || reservationTotal || client.totalSpent || 0;
  const paymentBalance = getClientPaymentBalance(client.id, clientReservations, payments);
  const latestReservation = clientReservations[0];
  const frontDocumentUrl = client.idCardFrontUrl;
  const backDocumentUrl = client.idCardBackUrl;
  const docsComplete = hasCompleteDocs(client);
  const isVerified = docsComplete && Boolean(client.cin || client.license);

  const metrics = [
    { label: 'Total locations', value: String(clientReservations.length), icon: Car, helper: 'Historique réel' },
    { label: 'Total dépensé', value: totalSpent ? formatMAD(totalSpent) : '—', icon: Wallet, helper: 'Paiements ou réservations' },
    { label: 'Reste à payer', value: formatMAD(paymentBalance.remaining), icon: CreditCard, helper: paymentBalance.remaining > 0 ? 'Solde ouvert' : 'Payé intégralement' },
    { label: 'Dernière réservation', value: latestReservation ? formatDate(latestReservation.pickupDate) : '—', icon: CalendarClock, helper: latestReservation?.vehicle || 'Aucune location' },
    { label: 'Client depuis', value: formatDate(client.createdAt), icon: BadgeCheck, helper: client.createdAt ? 'Date de création' : 'Non renseigné' },
  ];

  function handleNewReservation() {
    navigate(`/reservations?create=1&clientId=${encodeURIComponent(selectedClient.id)}`);
  }

  function handleCreateContract() {
    const contractReservation = clientReservations.find((reservation) => ['Active', 'Confirmed'].includes(reservation.status)) || clientReservations[0];
    if (!contractReservation) {
      notify({
        title: 'Réservation requise',
        message: 'Créez d’abord une réservation pour ce client avant de générer un contrat.',
        type: 'warning',
      });
      return;
    }
    navigate(`/contracts?reservation=${encodeURIComponent(contractReservation.recordId || contractReservation.id)}`);
  }

  function handleOpenEdit() {
    setEditForm(buildEditForm(selectedClient));
    setEditOpen(true);
  }

  async function viewDocument(side: 'front' | 'back') {
    const storedUrl = side === 'front' ? frontDocumentUrl : backDocumentUrl;
    const action = `${side}-view` as const;
    const openedWindow = window.open('about:blank', '_blank');
    if (openedWindow) openedWindow.opener = null;
    setDocumentAction(action);

    try {
      const resolvedUrl = await resolveClientDocumentUrl(storedUrl);
      if (!resolvedUrl) throw new Error('Document indisponible.');
      if (openedWindow) {
        openedWindow.location.href = resolvedUrl;
      } else {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      openedWindow?.close();
      notify({
        title: 'Ouverture impossible',
        message: error instanceof Error ? error.message : 'Réessayez dans un instant.',
        type: 'warning',
      });
    } finally {
      setDocumentAction(null);
    }
  }

  async function downloadDocument(side: 'front' | 'back') {
    const storedUrl = side === 'front' ? frontDocumentUrl : backDocumentUrl;
    const action = `${side}-download` as const;
    setDocumentAction(action);

    try {
      if (!storedUrl) throw new Error('Document indisponible.');
      const { blob, filename } = await getClientDocumentDownload(storedUrl);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename || `piece-identite-${side}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      notify({
        title: 'Téléchargement impossible',
        message: error instanceof Error ? error.message : 'Réessayez dans un instant.',
        type: 'warning',
      });
    } finally {
      setDocumentAction(null);
    }
  }

  async function handleSaveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm) return;
    if (!editForm.fullName.trim()) {
      notify({ title: 'Nom obligatoire', message: 'Veuillez renseigner le nom complet du client.', type: 'warning' });
      return;
    }
    try {
      setSavingClient(true);
      await updateClient({ ...selectedClient, ...editForm });
      setEditOpen(false);
      notify({ title: 'Client modifié', message: 'La fiche client a été mise à jour.', type: 'success' });
    } catch (error) {
      notify({ title: 'Modification impossible', message: error instanceof Error ? error.message : 'Veuillez réessayer.', type: 'warning' });
    } finally {
      setSavingClient(false);
    }
  }

  async function copyValue(label: string, value?: string) {
    if (!value?.trim()) {
      notify({ title: `${label} manquant`, message: 'Aucune valeur à copier.', type: 'warning' });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      notify({ title: `${label} copié`, message: value, type: 'success' });
    } catch {
      notify({ title: 'Copie impossible', message: 'Votre navigateur bloque la copie automatique.', type: 'warning' });
    }
  }

  async function handleDeleteClient() {
    try {
      setDeletingClient(true);
      await removeClient(selectedClient.id);
      notify({ title: 'Client supprimé', message: `${selectedClient.fullName} a été retiré du CRM.`, type: 'warning' });
      navigate('/clients');
    } catch (error) {
      notify({ title: 'Suppression impossible', message: error instanceof Error ? error.message : 'Veuillez réessayer.', type: 'warning' });
    } finally {
      setDeletingClient(false);
    }
  }

  return (
    <div className="relative overflow-x-hidden pb-8">
      <div className="pointer-events-none absolute right-[-12%] top-10 h-80 w-80 rounded-full bg-[#D4A017]/10 blur-3xl" />

      <Link to="/clients" className="relative mb-5 inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 transition hover:text-gold-200 light:text-carbon-700">
        <ArrowLeft className="h-4 w-4" />
        Retour aux clients
      </Link>

      <section className="relative overflow-hidden rounded-[32px] border border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-[var(--app-shadow)] dark:bg-gradient-to-br dark:from-zinc-950/95 dark:via-[#11151c] dark:to-black dark:shadow-[0_28px_80px_rgba(0,0,0,.34)] md:p-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#D4A017]/14 to-transparent" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-[28px] bg-gradient-to-br from-[#F5C542] to-[#B8870E] text-3xl font-black text-black shadow-[0_0_48px_rgba(212,160,23,0.25)]">
              {clientInitials(client.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.26em] text-[var(--app-gold-text)]">Profil client</p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[var(--app-text)] md:text-4xl">{client.fullName}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--app-text-soft)]">
                <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-1">CIN / Passeport: <strong className="text-[var(--app-text)]">{client.cin || 'Non renseigné'}</strong></span>
                <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-1">Permis: <strong className="text-[var(--app-text)]">{client.license || 'Non renseigné'}</strong></span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{client.status === 'New' ? 'New' : 'Actif'}</Badge>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${docsComplete ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200' : 'border-amber-300/30 bg-amber-500/12 text-amber-700 dark:text-amber-100'}`}>
                  {docsComplete ? 'Documents complets' : 'Documents manquants'}
                </span>
                {isVerified ? (
                  <span className="rounded-full border border-gold-300/25 bg-gold-400/12 px-3 py-1 text-xs font-bold text-[var(--app-gold-text)]">Client vérifié</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:items-center xl:justify-end">
            <button type="button" onClick={handleNewReservation} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#D4A017] px-4 text-sm font-black text-black transition hover:bg-[#f1c232]">
              <UserPlus className="h-4 w-4" />
              Nouvelle réservation
            </button>
            <button type="button" onClick={handleCreateContract} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#D4A017]/35 bg-[#D4A017]/10 px-4 text-sm font-bold text-[var(--app-gold-text)] transition hover:bg-[#D4A017]/16">
              <FileSignature className="h-4 w-4" />
              Créer un contrat
            </button>
            <button type="button" onClick={handleOpenEdit} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 text-sm font-bold text-[var(--app-text)] transition hover:bg-[color-mix(in_srgb,var(--app-surface-soft)_70%,var(--app-text)_8%)]">
              <Edit3 className="h-4 w-4" />
              Modifier client
            </button>
            <div ref={moreMenuRef} className="relative">
              <button type="button" onClick={() => setMoreOpen((current) => !current)} className="focus-ring inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 text-[var(--app-text)] transition hover:bg-[color-mix(in_srgb,var(--app-surface-soft)_70%,var(--app-text)_8%)] sm:w-auto" aria-label="Plus d’actions" aria-expanded={moreOpen}>
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {moreOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-modal)] p-2 shadow-[var(--app-shadow)] backdrop-blur-xl dark:bg-zinc-950/95 dark:shadow-[0_24px_80px_rgba(0,0,0,.45)]">
                  <button type="button" onClick={() => { setMoreOpen(false); navigate('/clients'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[var(--app-text-soft)] transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]">
                    <ArrowLeft className="h-4 w-4 text-[var(--app-gold-text)]" />
                    Voir dans la liste clients
                  </button>
                  <button type="button" onClick={() => copyValue('Téléphone', client.phone)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[var(--app-text-soft)] transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]">
                    <Copy className="h-4 w-4 text-[var(--app-gold-text)]" />
                    Copier téléphone
                  </button>
                  <button type="button" onClick={() => copyValue('Email', client.email)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[var(--app-text-soft)] transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]">
                    <Mail className="h-4 w-4 text-[var(--app-gold-text)]" />
                    Copier email
                  </button>
                  <div className="my-2 border-t border-[var(--app-border)]" />
                  <button type="button" onClick={() => { setMoreOpen(false); setDeleteOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[var(--app-danger)] transition hover:bg-rose-500/10">
                    <Trash2 className="h-4 w-4" />
                    Supprimer client
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, helper }) => (
          <div key={label} className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[var(--app-shadow)] dark:bg-gradient-to-br dark:from-zinc-950/90 dark:to-black dark:shadow-[0_18px_48px_rgba(0,0,0,.26)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--app-text-muted)]">{label}</p>
                <p className="mt-3 truncate text-2xl font-black text-[var(--app-text)]">{value}</p>
                <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">{helper}</p>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 text-[var(--app-gold-text)]">
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </section>

      <div className="relative mt-6 grid items-start gap-5 xl:grid-cols-[minmax(340px,0.4fr)_minmax(520px,0.6fr)]">
        <div className="grid content-start gap-5">
          <InfoCard title="Coordonnées" icon={Phone}>
            <InfoRow icon={Phone} label="Téléphone" value={client.phone} />
            <InfoRow icon={Mail} label="Email" value={client.email} />
            <InfoRow icon={MapPin} label="Adresse" value={client.address} />
            <InfoRow icon={MapPin} label="Ville" value="" />
          </InfoCard>

          <Card className="border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-[var(--app-shadow)] dark:bg-gradient-to-br dark:from-zinc-950/95 dark:to-black dark:shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            <SectionTitle icon={FileImage} title="Pièces d’identité" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <DocumentPreview
                title="Recto"
                sourceUrl={frontDocumentUrl}
                previewUrl={frontDocumentPreview}
                onView={() => viewDocument('front')}
                onDownload={() => downloadDocument('front')}
                viewLoading={documentAction === 'front-view'}
                downloadLoading={documentAction === 'front-download'}
              />
              <DocumentPreview
                title="Verso"
                sourceUrl={backDocumentUrl}
                previewUrl={backDocumentPreview}
                onView={() => viewDocument('back')}
                onDownload={() => downloadDocument('back')}
                viewLoading={documentAction === 'back-view'}
                downloadLoading={documentAction === 'back-download'}
              />
            </div>
            <div className="mt-4 grid gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm">
              <TextPair label="CIN / Passeport" value={client.cin || 'Non renseigné'} />
              <TextPair label="Permis" value={client.license || 'Non renseigné'} />
              <TextPair label="Statut" value={docsComplete ? 'Complet' : 'Incomplet'} valueClassName={docsComplete ? 'text-emerald-700 dark:text-emerald-200' : 'text-amber-700 dark:text-amber-100'} />
            </div>
          </Card>

          <InfoCard title="Notes internes" icon={Edit3}>
            <p className="text-sm leading-6 text-[var(--app-text-soft)]">Aucune note interne.</p>
          </InfoCard>
        </div>

        <div className="grid content-start gap-5">
          <Card className="border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-[var(--app-shadow)] dark:bg-gradient-to-br dark:from-zinc-950/95 dark:to-black dark:shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            <SectionTitle icon={Car} title="Historique des locations" />
            <div className="mt-5 grid gap-3">
              {clientReservations.length ? clientReservations.map((reservation) => (
                <ReservationRow key={reservation.id} reservation={reservation} />
              )) : <EmptyHistory icon={Car} text="Aucune location enregistrée pour ce client." />}
            </div>
          </Card>

          <Card className="border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-[var(--app-shadow)] dark:bg-gradient-to-br dark:from-zinc-950/95 dark:to-black dark:shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            <SectionTitle icon={CreditCard} title="Historique des paiements" />
            <div className="mt-5 grid gap-3">
              {clientPayments.length ? clientPayments.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} reservations={clientReservations} />
              )) : <EmptyHistory icon={CreditCard} text="Aucun paiement lié à ce client pour le moment." />}
            </div>
          </Card>

          <Card className="border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-[var(--app-shadow)] dark:bg-gradient-to-br dark:from-zinc-950/95 dark:to-black dark:shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            <SectionTitle icon={FileSignature} title="Contrats liés" />
            <div className="mt-5 grid gap-3">
              {clientContracts.length ? clientContracts.map((contract) => (
                <ContractRow key={contract.id} contract={contract} />
              )) : <EmptyHistory icon={FileText} text="Vous n’avez pas encore généré de contrat pour ce client." />}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={editOpen && Boolean(editForm)} title="Modifier client" onClose={() => !savingClient && setEditOpen(false)}>
        {editForm ? (
          <form className="space-y-5" onSubmit={handleSaveClient}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileInput label="Nom complet" value={editForm.fullName} onChange={(value) => setEditForm((current) => current ? { ...current, fullName: value } : current)} />
              <ProfileInput label="Téléphone" value={editForm.phone} onChange={(value) => setEditForm((current) => current ? { ...current, phone: value } : current)} />
              <ProfileInput label="Email" value={editForm.email} onChange={(value) => setEditForm((current) => current ? { ...current, email: value } : current)} />
              <ProfileInput label="CIN / Passeport" value={editForm.cin} onChange={(value) => setEditForm((current) => current ? { ...current, cin: value } : current)} />
              <ProfileInput label="Permis" value={editForm.license} onChange={(value) => setEditForm((current) => current ? { ...current, license: value } : current)} />
              <ProfileInput label="Adresse" value={editForm.address} onChange={(value) => setEditForm((current) => current ? { ...current, address: value } : current)} className="sm:col-span-2" />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={savingClient}>Annuler</Button>
              <Button type="submit" icon={<Save className="h-4 w-4" />} loading={savingClient}>Enregistrer</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={deleteOpen} title="Supprimer ce client ?" onClose={() => !deletingClient && setDeleteOpen(false)}>
        <div className="space-y-5">
          <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-5">
            <div className="flex gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-[var(--app-danger)]" />
              <div>
                <p className="font-black text-[var(--app-text)]">Cette action supprimera la fiche client.</p>
                <p className="mt-2 text-sm leading-6 text-[var(--app-text-soft)]">Vérifiez que vous n’avez plus besoin de cette fiche avant de continuer.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deletingClient}>Annuler</Button>
            <Button type="button" variant="danger" icon={<Trash2 className="h-4 w-4" />} loading={deletingClient} onClick={handleDeleteClient}>Supprimer client</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ProfileInput({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="text-sm font-semibold text-[var(--app-text-soft)]">{label}</span>
      <input
        className="form-control h-12 rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] text-base text-[var(--app-text)] sm:text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Phone; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 text-[var(--app-gold-text)]">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="text-base font-black text-[var(--app-text)]">{title}</h2>
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: typeof Phone; children: React.ReactNode }) {
  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-[var(--app-shadow)] dark:bg-gradient-to-br dark:from-zinc-950/95 dark:to-black dark:shadow-[0_24px_70px_rgba(0,0,0,.28)]">
      <SectionTitle icon={icon} title={title} />
      <div className="mt-4 grid gap-3">{children}</div>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-[var(--app-gold-text)]" />
      <div className="min-w-0">
        <p className="text-xs text-[var(--app-text-muted)]">{label}</p>
        <p className="truncate text-sm font-semibold text-[var(--app-text)]">{value?.trim() || 'Non renseigné'}</p>
      </div>
    </div>
  );
}

function TextPair({ label, value, valueClassName = 'text-[var(--app-text)]' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--app-text-muted)]">{label}</span>
      <strong className={`text-right ${valueClassName}`}>{value}</strong>
    </div>
  );
}

type DocumentPreviewProps = {
  title: string;
  sourceUrl?: string;
  previewUrl: string | null;
  onView: () => void;
  onDownload: () => void;
  viewLoading?: boolean;
  downloadLoading?: boolean;
};

function DocumentPreview({
  title,
  sourceUrl,
  previewUrl,
  onView,
  onDownload,
  viewLoading,
  downloadLoading,
}: DocumentPreviewProps) {
  const [broken, setBroken] = useState(false);
  const hasDocument = Boolean(sourceUrl);
  const documentKind = getClientDocumentKind(sourceUrl);
  const showImage = hasDocument && documentKind === 'image' && Boolean(previewUrl) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [previewUrl]);

  return (
    <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-[var(--app-text)]">{title}</p>
        {hasDocument ? <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-200">Ajouté</span> : null}
      </div>
      {hasDocument ? (
        <div className="space-y-3">
          <div className="relative h-44 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card-soft)] dark:bg-black/30">
            {showImage ? (
              <img
                src={previewUrl || ''}
                alt={`Document ${title}`}
                onError={() => setBroken(true)}
                className="h-full w-full object-contain"
              />
            ) : (
              <ProfileDocumentPlaceholder kind={documentKind} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 min-w-0 rounded-xl px-2 text-xs"
              icon={<Eye className="h-3.5 w-3.5" />}
              loading={viewLoading}
              onClick={onView}
            >
              Voir document
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-10 min-w-0 rounded-xl border-gold-300/30 px-2 text-xs text-[var(--app-gold-text)]"
              icon={<Download className="h-3.5 w-3.5" />}
              loading={downloadLoading}
              onClick={onDownload}
            >
              Télécharger
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-card-soft)] p-4 text-center dark:bg-black/20">
          <div>
            <FileImage className="mx-auto h-8 w-8 text-[var(--app-gold-text)]" />
            <p className="mt-3 text-sm font-bold text-[var(--app-text)]">Document non ajouté</p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">Ajoutez ce document depuis la fiche client.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileDocumentPlaceholder({ kind }: { kind: ClientDocumentKind }) {
  const Icon = kind === 'image' ? FileImage : FileText;
  return (
    <div className="grid h-full place-items-center p-4 text-center">
      <div>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-[var(--app-gold-text)]">
          <Icon className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-bold text-[var(--app-text)]">Document disponible</p>
        <p className="mt-1 text-xs text-[var(--app-text-muted)]">
          {kind === 'pdf' ? 'Fichier PDF' : kind === 'image' ? 'Aperçu indisponible' : 'Fichier joint'}
        </p>
      </div>
    </div>
  );
}

function EmptyHistory({ icon: Icon, text }: { icon: typeof Phone; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] px-5 py-7 text-center">
      <Icon className="mx-auto h-8 w-8 text-[var(--app-gold-text)]" />
      <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-[var(--app-text-soft)]">{text}</p>
    </div>
  );
}

function ReservationRow({ reservation }: { reservation: Reservation }) {
  return (
    <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 transition hover:border-[#D4A017]/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-black text-[var(--app-text)]">{reservation.vehicle || 'Véhicule non renseigné'}</p>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{reservationRef(reservation)} · {formatDate(reservation.pickupDate)} → {formatDate(reservation.returnDate)}</p>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <Badge>{statusLabel(reservation.status)}</Badge>
          <p className="font-black text-[var(--app-gold-text)]">{reservation.totalAmount ? formatMAD(reservation.totalAmount) : '—'}</p>
          <Link to="/reservations" className="focus-ring inline-flex h-9 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-xs font-bold text-[var(--app-text)]">
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
    <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-[var(--app-text)]">{displayReference}</p>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{formatDate(payment.dueDate)} · {paymentMethodLabel(payment.method)}</p>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <Badge>{statusLabel(payment.status)}</Badge>
          <p className="font-black text-[var(--app-gold-text)]">{formatMAD(payment.amount)}</p>
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
    <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-black text-[var(--app-text)]">{contract.contractNumber || contract.id}</p>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{contract.vehicle || 'Véhicule non renseigné'} · {formatDate(contract.pickupDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{statusLabel(contract.status)}</Badge>
          {contract.pdfPath ? (
            <a href={contract.pdfPath} target="_blank" rel="noreferrer" className="focus-ring inline-flex h-9 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-xs font-bold text-[var(--app-text)]">
              Ouvrir
            </a>
          ) : (
            <Link to="/contracts" className="focus-ring inline-flex h-9 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-xs font-bold text-[var(--app-text)]">
              Voir
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
