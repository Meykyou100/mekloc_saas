import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Camera,
  CreditCard,
  Edit3,
  Eye,
  FileImage,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatMAD, type Client } from '../data/mockData';
import { normalizeText, safeStoragePath, sanitizeText, validateEmail, validateFileUpload, validatePhone } from '../lib/security';
import { storageBuckets, supabase } from '../lib/supabase';

type ClientFilter = 'all' | 'with-docs' | 'missing-docs' | 'active';

type ClientFormState = {
  fullName: string;
  phone: string;
  email: string;
  cin: string;
  license: string;
  address: string;
};

type ClientFormErrors = Partial<Record<keyof ClientFormState, string>>;

function buildInitialForm(client?: Client | null): ClientFormState {
  return {
    fullName: client?.fullName || '',
    phone: client?.phone || '+212 6',
    email: client?.email || '',
    cin: client?.cin || '',
    license: client?.license || '',
    address: client?.address || '',
  };
}

function formatClientSince(value?: string) {
  if (!value) return 'Date non disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date non disponible';
  return date.toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function hasDocs(client: Client) {
  return Boolean(client.idCardFrontUrl && client.idCardBackUrl);
}

export default function ClientsPage() {
  const { clients, reservations, payments, createClient, updateClient, deleteClient: removeClient } = useData();
  const { profile } = useAuth();
  const { notify } = useApp();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formState, setFormState] = useState<ClientFormState>(buildInitialForm());
  const [formErrors, setFormErrors] = useState<ClientFormErrors>({});

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [frontRemoved, setFrontRemoved] = useState(false);
  const [backRemoved, setBackRemoved] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSide, setCameraSide] = useState<'front' | 'back'>('front');
  const [cameraError, setCameraError] = useState('');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const clientUsage = useMemo(() => {
    return clients.reduce<Record<string, { reservations: number; spent: number }>>((acc, client) => {
      const clientReservations = reservations.filter((reservation) => reservation.clientId === client.id);
      const reservationIds = new Set(clientReservations.map((reservation) => reservation.recordId || reservation.id));
      const reservationSpent = clientReservations.reduce((sum, reservation) => sum + (reservation.totalAmount ?? 0), 0);
      const paymentSpent = payments
        .filter((payment) => payment.clientId === client.id || (payment.reservationId ? reservationIds.has(payment.reservationId) : false))
        .reduce((sum, payment) => sum + payment.amount, 0);
      acc[client.id] = {
        reservations: clientReservations.length,
        spent: paymentSpent || reservationSpent || 0,
      };
      return acc;
    }, {});
  }, [clients, payments, reservations]);

  const enrichedClients = useMemo(() => {
    return clients.map((client) => ({
      ...client,
      computedReservations: clientUsage[client.id]?.reservations ?? 0,
      computedSpent: clientUsage[client.id]?.spent ?? 0,
    }));
  }, [clientUsage, clients]);

  const clientsStats = useMemo(() => {
    const total = clients.length;
    const withReservations = enrichedClients.filter((client) => client.computedReservations > 0).length;
    const totalSpent = enrichedClients.reduce((sum, client) => sum + client.computedSpent, 0);
    const withMissingDocs = clients.filter((client) => !hasDocs(client)).length;
    const newClients = clients.filter((client) => client.status === 'New').length;
    return { total, withReservations, totalSpent, withMissingDocs, newClients };
  }, [clients, enrichedClients]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedClients.filter((client) => {
      const searchHit =
        !q ||
        `${client.fullName} ${client.phone} ${client.email} ${client.cin} ${client.license} ${client.address}`.toLowerCase().includes(q);

      if (!searchHit) return false;

      if (filter === 'with-docs') return hasDocs(client);
      if (filter === 'missing-docs') return !hasDocs(client);
      if (filter === 'active') return client.computedReservations > 0;
      return true;
    });
  }, [enrichedClients, filter, query]);

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

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  function resetUploadState() {
    setFrontFile(null);
    setBackFile(null);
    setFrontPreview(null);
    setBackPreview(null);
    setFrontRemoved(false);
    setBackRemoved(false);
  }

  function openNewClient() {
    setEditingClient(null);
    setFormState(buildInitialForm());
    setFormErrors({});
    resetUploadState();
    setModalOpen(true);
  }

  function openEditClient(client: Client) {
    setEditingClient(client);
    setFormState(buildInitialForm(client));
    setFormErrors({});
    setFrontFile(null);
    setBackFile(null);
    setFrontPreview(client.idCardFrontUrl || null);
    setBackPreview(client.idCardBackUrl || null);
    setFrontRemoved(false);
    setBackRemoved(false);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  function validateClientForm(values: ClientFormState): ClientFormErrors {
    const nextErrors: ClientFormErrors = {};
    if (!sanitizeText(values.fullName, 120)) nextErrors.fullName = 'Le nom complet est obligatoire.';
    if (!normalizeText(values.phone, 24)) nextErrors.phone = 'Le téléphone est obligatoire.';
    if (values.email.trim() && !validateEmail(values.email)) nextErrors.email = 'Adresse email invalide.';
    if (values.phone.trim() && !validatePhone(values.phone)) nextErrors.phone = 'Numéro invalide.';
    return nextErrors;
  }

  async function uploadClientDocument(clientId: string, file: File, side: 'front' | 'back') {
    if (!supabase || !profile?.agencyId) return null;
    const filePath = safeStoragePath(profile.agencyId, `clients-${clientId}-${side}`, file.name || 'document.jpg');
    const { error: uploadError } = await supabase.storage.from(storageBuckets.clientDocuments).upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(storageBuckets.clientDocuments).getPublicUrl(filePath);
    return data.publicUrl;
  }

  function validateImage(file: File) {
    return validateFileUpload(file, {
      maxSizeMb: 5,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    });
  }

  function onPickDocument(
    event: ChangeEvent<HTMLInputElement>,
    side: 'front' | 'back',
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateImage(file);
    if (validationError) {
      notify({ title: 'Fichier invalide', message: validationError, type: 'warning' });
      event.target.value = '';
      return;
    }
    const localPreview = URL.createObjectURL(file);
    if (side === 'front') {
      setFrontFile(file);
      setFrontPreview(localPreview);
      setFrontRemoved(false);
    } else {
      setBackFile(file);
      setBackPreview(localPreview);
      setBackRemoved(false);
    }
    event.target.value = '';
  }

  async function openCamera(side: 'front' | 'back') {
    setCameraSide(side);
    setCapturedPreview(null);
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      notify({ title: 'Caméra indisponible', message: 'Ce navigateur ne supporte pas la caméra.', type: 'warning' });
      return;
    }
    try {
      setCameraLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {
          setCameraError('Autorisez l’accès à la caméra pour prendre une photo.');
        });
      });
    } catch {
      notify({ title: 'Caméra indisponible', message: 'Autorisez l’accès à la caméra pour prendre une photo.', type: 'warning' });
    } finally {
      setCameraLoading(false);
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCapturedPreview(null);
    setCameraError('');
  }

  function captureFromCamera() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    setCapturedPreview(canvas.toDataURL('image/jpeg', 0.92));
  }

  async function validateCapturedPhoto() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92));
    if (!blob) return;
    const file = new File([blob], `${cameraSide}-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const validationError = validateImage(file);
    if (validationError) {
      notify({ title: 'Fichier invalide', message: validationError, type: 'warning' });
      return;
    }
    const localPreview = URL.createObjectURL(file);
    if (cameraSide === 'front') {
      setFrontFile(file);
      setFrontPreview(localPreview);
      setFrontRemoved(false);
    } else {
      setBackFile(file);
      setBackPreview(localPreview);
      setBackRemoved(false);
    }
    closeCamera();
  }

  async function handleSaveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateClientForm(formState);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);

    try {
      const baseClient: Client = {
        id: editingClient?.id || `cli-${Date.now()}`,
        fullName: sanitizeText(formState.fullName, 120),
        phone: normalizeText(formState.phone, 24),
        email: normalizeText(formState.email, 254).toLowerCase(),
        cin: sanitizeText(formState.cin, 80),
        license: sanitizeText(formState.license, 80),
        address: sanitizeText(formState.address, 220),
        totalRentals: editingClient?.totalRentals || 0,
        totalSpent: editingClient?.totalSpent || 0,
        status: editingClient?.status || 'New',
        idCardFrontUrl: editingClient?.idCardFrontUrl,
        idCardBackUrl: editingClient?.idCardBackUrl,
        createdAt: editingClient?.createdAt,
      };

      let saved = editingClient ? await updateClient(baseClient) : await createClient(baseClient);

      let nextFrontUrl = frontRemoved ? null : (saved.idCardFrontUrl || null);
      let nextBackUrl = backRemoved ? null : (saved.idCardBackUrl || null);

      if (frontFile) {
        const uploadedFront = await uploadClientDocument(saved.id, frontFile, 'front');
        nextFrontUrl = uploadedFront || frontPreview || nextFrontUrl;
      }
      if (backFile) {
        const uploadedBack = await uploadClientDocument(saved.id, backFile, 'back');
        nextBackUrl = uploadedBack || backPreview || nextBackUrl;
      }

      if (nextFrontUrl !== saved.idCardFrontUrl || nextBackUrl !== saved.idCardBackUrl) {
        saved = await updateClient({
          ...saved,
          idCardFrontUrl: nextFrontUrl || undefined,
          idCardBackUrl: nextBackUrl || undefined,
        });
      }

      setModalOpen(false);
      notify({
        title: editingClient ? 'Client mis à jour' : 'Client ajouté',
        message: `${saved.fullName} a été enregistré avec succès.`,
        type: 'success',
      });
    } catch (error) {
      notify({
        title: 'Enregistrement impossible',
        message: error instanceof Error ? error.message : 'Réessayez dans un instant.',
        type: 'warning',
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteClient() {
    if (!clientToDelete) return;
    try {
      await removeClient(clientToDelete.id);
      notify({ title: 'Client supprimé', message: `${clientToDelete.fullName} a été retiré du CRM.`, type: 'warning' });
      setClientToDelete(null);
    } catch (error) {
      notify({
        title: 'Suppression impossible',
        message: error instanceof Error ? error.message : 'Réessayez plus tard.',
        type: 'warning',
      });
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="CRM"
        title="Clients"
        description="Gérez vos clients, leurs documents d’identité et leur historique de location."
        action={<Button icon={<UserPlus className="h-4 w-4" />} onClick={openNewClient}>Ajouter un client</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Total clients', value: String(clientsStats.total), helper: 'Clients enregistrés', icon: Users, tone: 'text-sky-200' },
          { label: 'Nouveaux clients', value: String(clientsStats.newClients), helper: 'Statut Nouveau', icon: UserPlus, tone: 'text-emerald-200' },
          { label: 'Avec réservations', value: String(clientsStats.withReservations), helper: 'Base active', icon: BadgeCheck, tone: 'text-gold-200' },
          { label: 'Total dépensé', value: formatMAD(clientsStats.totalSpent), helper: 'Paiements ou réservations', icon: Wallet, tone: 'text-violet-200' },
          { label: 'Docs manquants', value: String(clientsStats.withMissingDocs), helper: 'À compléter', icon: AlertTriangle, tone: 'text-amber-200' },
        ].map(({ label, value, helper, icon: Icon, tone }) => (
          <div
            key={label}
            className="min-h-[86px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.025] p-3 shadow-[0_14px_34px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.045)] light:bg-white sm:min-h-[116px] sm:p-4"
          >
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-carbon-500 sm:text-[11px] sm:tracking-[0.16em]">{label}</p>
                <p className="mt-1 truncate text-xl font-black text-white light:text-carbon-950 sm:mt-2 sm:text-2xl">{value}</p>
              </div>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 sm:h-10 sm:w-10 sm:rounded-2xl">
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${tone}`} />
              </span>
            </div>
            <p className="mt-1 truncate text-[10px] font-medium text-carbon-400 sm:mt-2 sm:text-xs">{helper}</p>
          </div>
        ))}
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block lg:min-w-[360px] lg:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 120))}
              placeholder="Rechercher nom, téléphone, email, CIN, permis..."
              className="form-control focus-ring h-10 w-full rounded-xl pl-10 pr-4 text-sm light:bg-white light:text-carbon-950"
            />
          </label>

          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {([
              ['all', 'Tous'],
              ['with-docs', 'Avec documents'],
              ['missing-docs', 'Documents manquants'],
              ['active', 'Clients actifs'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`focus-ring whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  filter === value
                    ? 'border-[#D4A017]/70 bg-[#D4A017]/20 text-gold-100'
                    : 'border-white/10 bg-white/5 text-carbon-200 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filteredClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun client trouvé"
          message={clients.length ? 'Aucun résultat pour ce filtre. Essayez une autre recherche.' : 'Ajoutez votre premier client pour commencer.'}
          action="Ajouter un client"
          onAction={openNewClient}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredClients.map((client) => {
            const documentsReady = hasDocs(client);
            return (
              <Card
                key={client.id}
                interactive
                className="group overflow-hidden border-white/10 bg-gradient-to-br from-[#131821] to-[#0b0f15] p-5 shadow-[0_10px_30px_rgba(0,0,0,.28)] transition-all hover:border-[#D4A017]/35"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="premium-avatar grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black text-carbon-950">
                      {client.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-white">{client.fullName}</p>
                      <p className="mt-0.5 text-xs text-carbon-500">Client depuis {formatClientSince(client.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{client.status}</Badge>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      documentsReady
                        ? 'border-emerald-300/35 bg-emerald-500/15 text-emerald-200'
                        : 'border-amber-300/35 bg-amber-500/15 text-amber-100'
                    }`}>
                      {documentsReady ? 'Documents complets' : 'Documents manquants'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-carbon-300 sm:grid-cols-2">
                  <p className="flex min-w-0 items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">{client.phone || '—'}</span></p>
                  <p className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">{client.email || '—'}</span></p>
                  <p className="flex min-w-0 items-center gap-2"><CreditCard className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">CIN/Passeport: {client.cin || '—'}</span></p>
                  <p className="flex min-w-0 items-center gap-2"><IdCard className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">Permis: {client.license || '—'}</span></p>
                  <p className="sm:col-span-2 flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">{client.address || 'Adresse non renseignée'}</span></p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-carbon-500">Réservations</p>
                    <p className="mt-1 text-xl font-semibold text-white">{client.computedReservations}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-carbon-500">Total dépensé</p>
                    <p className="mt-1 text-xl font-semibold text-white">{formatMAD(client.computedSpent)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" className="h-9 px-3" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEditClient(client)}>Modifier</Button>
                  <Link
                    to={`/clients/${client.id}`}
                    className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    <Eye className="h-4 w-4" />
                    Détails
                  </Link>
                  <Button variant="danger" className="h-9 px-3" icon={<Trash2 className="h-4 w-4" />} onClick={() => setClientToDelete(client)}>Supprimer</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} title={editingClient ? 'Modifier un client' : 'Ajouter un client'} onClose={closeModal}>
        <form className="relative space-y-6 pb-20" onSubmit={handleSaveClient}>
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gold-200">Informations personnelles</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Nom complet" required value={formState.fullName} onChange={(value) => setFormState((s) => ({ ...s, fullName: value }))} error={formErrors.fullName} />
              <InputField label="Téléphone" required value={formState.phone} onChange={(value) => setFormState((s) => ({ ...s, phone: value }))} error={formErrors.phone} />
              <InputField label="Email" type="email" value={formState.email} onChange={(value) => setFormState((s) => ({ ...s, email: value }))} error={formErrors.email} />
              <InputField label="Adresse" value={formState.address} onChange={(value) => setFormState((s) => ({ ...s, address: value }))} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gold-200">Documents</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="CIN/Passport" value={formState.cin} onChange={(value) => setFormState((s) => ({ ...s, cin: value }))} />
              <InputField label="Numéro de permis" value={formState.license} onChange={(value) => setFormState((s) => ({ ...s, license: value }))} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gold-200">Pièces d’identité</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <DocumentUploadBox
                title="Pièce d’identité recto"
                previewUrl={frontPreview}
                onPick={(event) => onPickDocument(event, 'front')}
                onCapture={() => openCamera('front')}
                onRemove={() => {
                  setFrontFile(null);
                  setFrontPreview(null);
                  setFrontRemoved(true);
                }}
              />
              <DocumentUploadBox
                title="Pièce d’identité verso"
                previewUrl={backPreview}
                onPick={(event) => onPickDocument(event, 'back')}
                onCapture={() => openCamera('back')}
                onRemove={() => {
                  setBackFile(null);
                  setBackPreview(null);
                  setBackRemoved(true);
                }}
              />
            </div>
            {!frontPreview || !backPreview ? (
              <p className="text-xs text-amber-200/90">Documents manquants: vous pouvez compléter recto/verso plus tard.</p>
            ) : null}
          </section>

          <div className="sticky bottom-0 left-0 right-0 -mx-4 border-t border-white/10 bg-[#0f141c]/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Annuler</Button>
              <Button type="submit" loading={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(clientToDelete)} title="Supprimer le client" onClose={() => setClientToDelete(null)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
            <p className="font-semibold text-rose-100">Cette action est sensible.</p>
            <p className="mt-2 text-sm text-carbon-300">Le client sera retiré du CRM. Vérifiez qu’aucune opération en cours ne dépend de ce dossier.</p>
          </div>
          <p className="text-sm text-carbon-300">Client: <strong>{clientToDelete?.fullName}</strong></p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setClientToDelete(null)}>Annuler</Button>
            <Button type="button" variant="danger" onClick={confirmDeleteClient}>Supprimer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={cameraOpen} onClose={closeCamera} title="Prendre une photo">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            {capturedPreview ? (
              <img src={capturedPreview} alt="Capture caméra" className="h-64 w-full object-cover sm:h-72" />
            ) : (
              <video ref={videoRef} className="h-64 w-full object-cover sm:h-72" playsInline muted />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          {cameraError ? <p className="text-xs text-amber-200">{cameraError}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeCamera}>
              Annuler
            </Button>
            {capturedPreview ? (
              <>
                <Button type="button" variant="secondary" onClick={() => setCapturedPreview(null)}>
                  Reprendre
                </Button>
                <Button type="button" onClick={validateCapturedPhoto}>
                  Valider
                </Button>
              </>
            ) : (
              <Button type="button" onClick={captureFromCamera} loading={cameraLoading}>
                Capturer
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  error?: string;
};

function InputField({ label, value, onChange, required, type = 'text', error }: InputFieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-carbon-200">
      <span>{label}{required ? ' *' : ''}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`form-control focus-ring w-full ${error ? 'border-rose-400/60 ring-1 ring-rose-400/35' : ''}`}
      />
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
    </label>
  );
}

type DocumentUploadBoxProps = {
  title: string;
  previewUrl: string | null;
  onPick: (event: ChangeEvent<HTMLInputElement>) => void;
  onCapture: () => void;
  onRemove: () => void;
};

function DocumentUploadBox({ title, previewUrl, onPick, onCapture, onRemove }: DocumentUploadBoxProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="mb-2 text-sm font-semibold text-white">{title}</p>
      {previewUrl ? (
        <div className="space-y-3">
          <img src={previewUrl} alt={title} className="h-40 w-full rounded-xl border border-white/10 object-cover" />
          <div className="flex flex-wrap gap-2">
            <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15">
              <Upload className="h-3.5 w-3.5" />
              Importer une image
              <input type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={onPick} />
            </label>
            <button
              type="button"
              onClick={onCapture}
              className="focus-ring inline-flex items-center gap-2 rounded-xl border border-gold-300/45 bg-gold-400/15 px-3 py-2 text-xs font-semibold text-gold-100 transition hover:bg-gold-400/25"
            >
              <Camera className="h-3.5 w-3.5" />
              Prendre une photo
            </button>
            <Button type="button" variant="danger" className="h-8 px-3 text-xs" icon={<X className="h-3.5 w-3.5" />} onClick={onRemove}>
              Retirer
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="focus-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/15 px-4 py-6 text-center transition hover:border-[#D4A017]/60 hover:bg-[#D4A017]/8">
            <FileImage className="h-6 w-6 text-gold-200" />
            <span className="text-sm font-semibold text-white">Importer une image</span>
            <span className="text-xs text-carbon-400">PNG, JPG ou WEBP · Max 5MB</span>
            <input type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={onPick} />
          </label>
          <button
            type="button"
            onClick={onCapture}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-gold-300/45 bg-gold-400/12 px-3 py-2 text-xs font-semibold text-gold-100 transition hover:bg-gold-400/22"
          >
            <Camera className="h-3.5 w-3.5" />
            Prendre une photo
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-carbon-500">
        <ShieldCheck className="h-3.5 w-3.5" />
        Document visible uniquement dans votre agence
      </div>
    </div>
  );
}
