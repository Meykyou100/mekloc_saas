import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Camera,
  Download,
  Edit3,
  Eye,
  FileImage,
  FileText,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatMAD, type Client } from '../data/mockData';
import { getClientPaymentBalance } from '../lib/paymentBalance';
import {
  getClientDocumentDownload,
  getClientDocumentKind,
  resolveClientDocumentUrl,
  type ClientDocumentKind,
} from '../lib/clientDocuments';
import { normalizeText, safeStoragePath, sanitizeText, validateEmail, validateFileUpload, validatePhone } from '../lib/security';
import { storageBuckets, supabase } from '../lib/supabase';

type ClientFilter = 'all' | 'with-docs' | 'missing-docs' | 'active' | 'new';
type ClientSort = 'recent' | 'name' | 'spent';

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

function clientInitials(name?: string) {
  const parts = (name || 'Client').trim().split(/\s+/).filter(Boolean);
  return parts.map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'CL';
}

function formatReservationDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClientsPage() {
  const { clients, reservations, payments, createClient, updateClient, deleteClient: removeClient } = useData();
  const { profile } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [sort, setSort] = useState<ClientSort>('recent');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [mobileClientId, setMobileClientId] = useState('');
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
  const [documentAction, setDocumentAction] = useState<'front-view' | 'front-download' | 'back-view' | 'back-download' | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const documentResolveRef = useRef(0);

  const clientUsage = useMemo(() => {
    return clients.reduce<Record<string, { reservations: number; spent: number; paid: number; remaining: number }>>((acc, client) => {
      const clientReservations = reservations.filter((reservation) => reservation.clientId === client.id);
      const reservationIds = new Set(clientReservations.map((reservation) => reservation.recordId || reservation.id));
      const reservationSpent = clientReservations.reduce((sum, reservation) => sum + (reservation.totalAmount ?? 0), 0);
      const paymentSpent = payments
        .filter((payment) => payment.clientId === client.id || (payment.reservationId ? reservationIds.has(payment.reservationId) : false))
        .reduce((sum, payment) => sum + payment.amount, 0);
      const paymentBalance = getClientPaymentBalance(client.id, reservations, payments);
      acc[client.id] = {
        reservations: clientReservations.length,
        spent: paymentSpent || reservationSpent || 0,
        paid: paymentBalance.paid,
        remaining: paymentBalance.remaining,
      };
      return acc;
    }, {});
  }, [clients, payments, reservations]);

  const enrichedClients = useMemo(() => {
    return clients.map((client) => ({
      ...client,
      computedReservations: clientUsage[client.id]?.reservations ?? 0,
      computedSpent: clientUsage[client.id]?.spent ?? 0,
      computedPaid: clientUsage[client.id]?.paid ?? 0,
      computedRemaining: clientUsage[client.id]?.remaining ?? 0,
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
    const filtered = enrichedClients.filter((client) => {
      const searchHit =
        !q ||
        `${client.fullName} ${client.phone} ${client.email} ${client.cin} ${client.license} ${client.address}`.toLowerCase().includes(q);

      if (!searchHit) return false;

      if (filter === 'with-docs') return hasDocs(client);
      if (filter === 'missing-docs') return !hasDocs(client);
      if (filter === 'active') return client.computedReservations > 0;
      if (filter === 'new') return client.status === 'New';
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.fullName.localeCompare(b.fullName, 'fr');
      if (sort === 'spent') return b.computedSpent - a.computedSpent;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [enrichedClients, filter, query, sort]);

  const latestReservationByClient = useMemo(() => {
    return reservations.reduce<Record<string, (typeof reservations)[number]>>((acc, reservation) => {
      const current = acc[reservation.clientId];
      const currentTime = new Date(current?.returnDate || current?.pickupDate || 0).getTime();
      const nextTime = new Date(reservation.returnDate || reservation.pickupDate || 0).getTime();
      if (!current || nextTime > currentTime) acc[reservation.clientId] = reservation;
      return acc;
    }, {});
  }, [reservations]);

  const selectedClient = useMemo(() => {
    return filteredClients.find((client) => client.id === selectedClientId) || filteredClients[0] || null;
  }, [filteredClients, selectedClientId]);

  const mobileClientDetails = useMemo(() => {
    return enrichedClients.find((client) => client.id === mobileClientId) || null;
  }, [enrichedClients, mobileClientId]);

  useEffect(() => {
    if (!filteredClients.length) {
      if (selectedClientId) setSelectedClientId('');
      return;
    }
    if (!filteredClients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(filteredClients[0].id);
    }
  }, [filteredClients, selectedClientId]);

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
    const resolveId = documentResolveRef.current + 1;
    documentResolveRef.current = resolveId;
    setEditingClient(client);
    setFormState(buildInitialForm(client));
    setFormErrors({});
    setFrontFile(null);
    setBackFile(null);
    setFrontPreview(null);
    setBackPreview(null);
    setFrontRemoved(false);
    setBackRemoved(false);
    setModalOpen(true);

    void Promise.all([
      resolveClientDocumentUrl(client.idCardFrontUrl),
      resolveClientDocumentUrl(client.idCardBackUrl),
    ]).then(([frontUrl, backUrl]) => {
      if (documentResolveRef.current !== resolveId) return;
      setFrontPreview(frontUrl);
      setBackPreview(backUrl);
    });
  }

  function closeModal() {
    if (saving) return;
    documentResolveRef.current += 1;
    setModalOpen(false);
  }

  async function viewDocument(side: 'front' | 'back') {
    const previewUrl = side === 'front' ? frontPreview : backPreview;
    const storedUrl = side === 'front' ? editingClient?.idCardFrontUrl : editingClient?.idCardBackUrl;
    const action = `${side}-view` as const;
    const openedWindow = window.open('about:blank', '_blank');
    if (openedWindow) openedWindow.opener = null;
    setDocumentAction(action);

    try {
      const resolvedUrl = previewUrl || await resolveClientDocumentUrl(storedUrl);
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
    const file = side === 'front' ? frontFile : backFile;
    const storedUrl = side === 'front' ? editingClient?.idCardFrontUrl : editingClient?.idCardBackUrl;
    const action = `${side}-download` as const;
    setDocumentAction(action);

    try {
      let blob: Blob;
      let filename: string;
      if (file) {
        blob = file;
        filename = file.name || `piece-identite-${side}.jpg`;
      } else if (storedUrl) {
        ({ blob, filename } = await getClientDocumentDownload(storedUrl));
      } else {
        throw new Error('Document indisponible.');
      }

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
    <div className="relative overflow-x-hidden pb-[calc(92px+env(safe-area-inset-bottom))] md:pb-8">
      <div className="pointer-events-none absolute right-[-24%] top-8 h-48 w-48 rounded-full bg-[#D4A017]/8 blur-3xl" />
      <div className="relative md:hidden">
        <section className="space-y-2.5">
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.22)]">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--app-gold-text)]">CRM</p>
                <h1 className="mt-0.5 text-2xl font-black leading-none text-[var(--app-text)]">Clients</h1>
                <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">Gérez vos clients et leurs documents.</p>
              </div>
              <button
                type="button"
                onClick={openNewClient}
                className="focus-ring inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#D4A017] px-3 text-xs font-black text-black shadow-[0_12px_28px_rgba(212,160,23,.18)] transition hover:bg-[#f1c232]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Ajouter
              </button>
            </div>
          </div>

          <div className="no-scrollbar relative -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {[
              { label: 'Clients', value: String(clientsStats.total), helper: 'Enregistrés', icon: Users, tone: 'text-[var(--app-gold-text)]', glow: 'from-[#D4A017]/18' },
              { label: 'Nouveaux', value: String(clientsStats.newClients), helper: 'Ce mois', icon: UserPlus, tone: 'text-emerald-700 dark:text-emerald-200', glow: 'from-emerald-400/14' },
              { label: 'Actifs', value: String(clientsStats.withReservations), helper: 'Avec réserv.', icon: BadgeCheck, tone: 'text-sky-700 dark:text-sky-200', glow: 'from-sky-400/14' },
              { label: 'Docs', value: String(clientsStats.withMissingDocs), helper: 'Manquants', icon: AlertTriangle, tone: 'text-amber-700 dark:text-amber-200', glow: 'from-amber-400/14' },
              { label: 'Dépensé', value: formatMAD(clientsStats.totalSpent), helper: 'Total', icon: Wallet, tone: 'text-violet-700 dark:text-violet-200', glow: 'from-violet-400/14' },
            ].map(({ label, value, helper, icon: Icon, tone, glow }) => (
              <div
                key={label}
                className="group relative min-h-[108px] min-w-[132px] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.05)] transition hover:border-[#D4A017]/35"
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${glow} to-transparent opacity-80`} />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase leading-3 tracking-[0.12em] text-[var(--app-text-muted)]">{label}</p>
                    <p className="mt-2 truncate text-[1.45rem] font-black leading-none text-[var(--app-text)]">{value}</p>
                  </div>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[14px] border border-[#D4A017]/20 bg-[#D4A017]/10 shadow-[0_0_20px_rgba(212,160,23,0.10)]">
                    <Icon className={`h-3.5 w-3.5 ${tone}`} />
                  </span>
                </div>
                <div className="relative mt-2">
                  <p className="truncate text-[11px] font-medium text-[var(--app-text-muted)]">{helper}</p>
                  <span className="mt-1.5 block h-1 w-12 rounded-full bg-gradient-to-r from-[#D4A017]/70 via-white/20 to-transparent" />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.22)]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, 120))}
                placeholder="Nom, téléphone, CIN..."
                className="form-control focus-ring h-10 w-full rounded-xl border-[var(--app-border)] bg-[var(--app-surface-soft)] pl-10 pr-4 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
              />
            </label>
            <div className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
              {([
                ['all', 'Tous'],
                ['active', 'Actifs'],
                ['with-docs', 'Avec docs'],
                ['missing-docs', 'Docs manquants'],
                ['new', 'Nouveaux'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`focus-ring h-9 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition ${
                    filter === value
                      ? 'border-[#D4A017]/70 bg-[#D4A017]/18 text-[var(--app-gold-text)]'
                      : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="relative mt-2 block">
              <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as ClientSort)}
                className="form-control focus-ring h-10 w-full rounded-xl border-[var(--app-border)] bg-[var(--app-input)] pl-10 pr-4 text-sm font-semibold text-[var(--app-text)]"
              >
                <option value="recent">Plus récent</option>
                <option value="name">Nom A-Z</option>
                <option value="spent">Dépense la plus élevée</option>
              </select>
            </label>
          </div>

          {clients.length === 0 ? (
            <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,.30)]">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#D4A017]/25 bg-[#D4A017]/10 text-[var(--app-gold-text)]">
                <Users className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-2xl font-black text-[var(--app-text)]">Aucun client</h2>
              <p className="mt-2 text-sm text-[var(--app-text-muted)]">Ajoutez votre premier client pour commencer.</p>
              <Button className="mt-5 w-full" icon={<UserPlus className="h-4 w-4" />} onClick={openNewClient}>Ajouter un client</Button>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-6 text-center">
              <Search className="mx-auto h-8 w-8 text-[var(--app-text-muted)]" />
              <p className="mt-3 font-bold text-[var(--app-text)]">Aucun résultat</p>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Essayez une autre recherche ou un autre filtre.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClients.map((client) => {
                const documentsReady = hasDocs(client);
                return (
                  <article
                    key={client.id}
                    className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_18px_44px_rgba(0,0,0,.26)] transition active:scale-[0.99]"
                    onClick={() => setMobileClientId(client.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#F5C542] to-[#B8870E] text-base font-black text-black shadow-[0_0_24px_rgba(212,160,23,.16)]">
                        {clientInitials(client.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="truncate text-base font-black text-[var(--app-text)]">{client.fullName}</h2>
                            <p className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[var(--app-text-soft)]">
                              <Phone className="h-4 w-4 shrink-0" />
                              <span className="truncate">{client.phone || 'Téléphone manquant'}</span>
                            </p>
                            <p className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[var(--app-text-soft)]">
                              <Mail className="h-4 w-4 shrink-0" />
                              <span className="truncate">{client.email || 'Email non renseigné'}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Actions client"
                            onClick={(event) => {
                              event.stopPropagation();
                              setMobileClientId(client.id);
                            }}
                            className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${client.status === 'New' ? 'border-[#D4A017]/35 bg-[#D4A017]/12 text-[var(--app-gold-text)]' : 'border-emerald-300/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200'}`}>
                            {client.status === 'New' ? 'New' : 'Actif'}
                          </span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${documentsReady ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200' : 'border-amber-300/30 bg-amber-500/12 text-amber-700 dark:text-amber-100'}`}>
                            {documentsReady ? 'Docs complets' : 'Docs manquants'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-4 border-t border-[var(--app-border)] pt-3">
                      <div>
                        <p className="text-base font-black text-[var(--app-text)]">{formatMAD(client.computedSpent)}</p>
                        <p className="text-xs text-[var(--app-text-muted)]">
                          {client.computedReservations} {client.computedReservations > 1 ? 'réservations' : 'réservation'}
                        </p>
                        <p className={`mt-1 text-xs font-black ${client.computedRemaining > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-200'}`}>
                          Reste: {formatMAD(client.computedRemaining)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setMobileClientId(client.id)}
                        className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-sm font-bold text-[var(--app-text)]"
                      >
                        <Eye className="h-4 w-4" />
                        Voir
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditClient(client)}
                        className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-sm font-bold text-[var(--app-text)]"
                      >
                        <Edit3 className="h-4 w-4" />
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/reservations')}
                        className="focus-ring col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/10 px-2 text-center text-sm font-bold text-[var(--app-gold-text)]"
                      >
                        <CalendarClock className="h-4 w-4" />
                        Réserver
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="hidden md:block">
      <PageHeader
        eyebrow="CRM"
        title="Clients"
        description="Gérez vos clients, leurs documents d’identité et leur historique de location."
        action={<Button className="rounded-2xl shadow-[0_0_30px_rgba(212,160,23,0.18)]" icon={<UserPlus className="h-4 w-4" />} onClick={openNewClient}>Ajouter un client</Button>}
      />

      <div className="relative mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Total clients', value: String(clientsStats.total), helper: 'Clients enregistrés', icon: Users, tone: 'text-[var(--app-gold-text)]', glow: 'from-[#D4A017]/18' },
          { label: 'Nouveaux clients', value: String(clientsStats.newClients), helper: 'Ce mois / statut nouveau', icon: UserPlus, tone: 'text-emerald-700 dark:text-emerald-200', glow: 'from-emerald-400/14' },
          { label: 'Avec réservations', value: String(clientsStats.withReservations), helper: 'Historique actif', icon: BadgeCheck, tone: 'text-teal-700 dark:text-teal-200', glow: 'from-teal-400/14' },
          { label: 'Total dépensé', value: formatMAD(clientsStats.totalSpent), helper: 'Paiements ou réservations', icon: Wallet, tone: 'text-violet-700 dark:text-violet-200', glow: 'from-violet-400/14' },
          { label: 'Docs manquants', value: String(clientsStats.withMissingDocs), helper: 'À compléter', icon: AlertTriangle, tone: 'text-amber-700 dark:text-amber-200', glow: 'from-amber-400/14' },
        ].map(({ label, value, helper, icon: Icon, tone }) => (
          <div
            key={label}
            className="group relative min-h-[126px] overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_18px_48px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition hover:border-[#D4A017]/35 "
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${label === 'Total clients' ? 'from-[#D4A017]/18' : label === 'Nouveaux clients' ? 'from-emerald-400/14' : label === 'Avec réservations' ? 'from-teal-400/14' : label === 'Total dépensé' ? 'from-violet-400/14' : 'from-amber-400/14'} to-transparent opacity-70`} />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-[var(--app-text-muted)]">{label}</p>
                <p className="mt-3 truncate text-2xl font-black text-[var(--app-text)] ">{value}</p>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 shadow-[0_0_28px_rgba(212,160,23,0.12)]">
                <Icon className={`h-5 w-5 ${tone}`} />
              </span>
            </div>
            <p className="relative mt-3 truncate text-xs font-medium text-[var(--app-text-muted)]">{helper}</p>
          </div>
        ))}
      </div>

      <Card className="relative mb-5 border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_18px_46px_rgba(0,0,0,.24)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block lg:min-w-[360px] lg:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 120))}
              placeholder="Rechercher nom, téléphone, email, CIN, permis..."
              className="form-control focus-ring h-12 w-full rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] pl-10 pr-4 text-sm  "
            />
          </label>

          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {([
              ['all', 'Tous'],
              ['with-docs', 'Avec documents'],
              ['missing-docs', 'Documents manquants'],
              ['active', 'Clients actifs'],
              ['new', 'Nouveaux'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`focus-ring whitespace-nowrap rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  filter === value
                    ? 'border-[#D4A017]/70 bg-[#D4A017]/20 text-[var(--app-gold-text)]'
                    : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] hover:bg-[var(--app-surface-soft)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="relative min-w-[170px]">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ClientSort)}
              className="form-control focus-ring h-12 w-full appearance-none rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] pl-10 pr-4 text-sm font-semibold text-[var(--app-text)]  "
            >
              <option value="recent">Plus récent</option>
              <option value="name">Nom A-Z</option>
              <option value="spent">Dépense la plus élevée</option>
            </select>
          </label>
        </div>
      </Card>

      {clients.length === 0 ? (
        <Card className="relative overflow-hidden border-[var(--app-border)] bg-[var(--app-card)] p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-[#D4A017]/25 bg-[#D4A017]/10 text-[var(--app-gold-text)]">
            <Users className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-[var(--app-text)]">Aucun client pour le moment</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--app-text-muted)]">Ajoutez votre premier client ou créez une réservation pour commencer à structurer votre CRM.</p>
          <Button className="mt-6" icon={<UserPlus className="h-4 w-4" />} onClick={openNewClient}>Ajouter un client</Button>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.42fr)_minmax(520px,0.58fr)]">
          <Card className="border-[var(--app-border)] bg-[var(--app-card)] p-0 shadow-[0_24px_70px_rgba(0,0,0,.30)]">
            <div className="border-b border-[var(--app-border)] px-5 py-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-[var(--app-text)]">Clients ({filteredClients.length})</h2>
                  <p className="mt-1 text-xs text-[var(--app-text-muted)]">Liste filtrée et triée</p>
                </div>
                <span className="rounded-full border border-[#D4A017]/30 bg-[#D4A017]/10 px-3 py-1 text-xs font-bold text-[var(--app-gold-text)]">{clientsStats.total} total</span>
              </div>
            </div>

            {filteredClients.length === 0 ? (
              <div className="p-6 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]">
                  <Search className="h-5 w-5" />
                </div>
                <p className="mt-4 font-semibold text-[var(--app-text)]">Aucun résultat</p>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">Essayez une autre recherche ou un autre filtre.</p>
              </div>
            ) : (
              <div className="max-h-[720px] space-y-2 overflow-y-auto p-3">
                {filteredClients.map((client) => {
                  const documentsReady = hasDocs(client);
                  const isSelected = selectedClient?.id === client.id;
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                      className={`focus-ring w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-[#D4A017]/70 bg-[#D4A017]/10 shadow-[0_0_34px_rgba(212,160,23,0.10)]'
                          : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] hover:border-[#D4A017]/25 hover:bg-[var(--app-surface-soft)]'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black ${isSelected ? 'bg-[#D4A017] text-black' : 'bg-[var(--app-surface-soft)] text-[var(--app-text)]'}`}>
                          {clientInitials(client.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-[var(--app-text)]">{client.fullName}</p>
                              <p className="mt-0.5 truncate text-xs text-[var(--app-text-muted)]">{client.phone || 'Téléphone manquant'}</p>
                              <p className="truncate text-xs text-[var(--app-text-muted)]">{client.email || 'Email non renseigné'}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-black text-[var(--app-text)]">{client.computedReservations}</p>
                              <p className="text-[11px] text-[var(--app-text-muted)]">Réservations</p>
                              <p className="mt-1 text-xs font-bold text-[var(--app-gold-text)]">{formatMAD(client.computedSpent)}</p>
                              <p className={`mt-1 text-[11px] font-bold ${client.computedRemaining > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-200'}`}>Reste {formatMAD(client.computedRemaining)}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${client.status === 'New' ? 'border-[#D4A017]/35 bg-[#D4A017]/12 text-[var(--app-gold-text)]' : 'border-emerald-300/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200'}`}>
                              {client.status === 'New' ? 'New' : 'Actif'}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${documentsReady ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200' : 'border-amber-300/30 bg-amber-500/12 text-amber-700 dark:text-amber-100'}`}>
                              {documentsReady ? 'Docs complets' : 'Docs manquants'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="min-h-[420px] border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-[0_24px_70px_rgba(0,0,0,.30)]">
            {selectedClient ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-[#F5C542] to-[#B8870E] text-2xl font-black text-black shadow-[0_0_38px_rgba(212,160,23,0.22)]">
                      {clientInitials(selectedClient.fullName)}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-black text-[var(--app-text)]">{selectedClient.fullName}</h2>
                      <p className="mt-1 text-sm text-[var(--app-text-muted)]">Client depuis {formatClientSince(selectedClient.createdAt)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge>{selectedClient.status === 'New' ? 'New' : 'Actif'}</Badge>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${hasDocs(selectedClient) ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200' : 'border-amber-300/30 bg-amber-500/12 text-amber-700 dark:text-amber-100'}`}>
                          {hasDocs(selectedClient) ? 'Documents complets' : 'Documents manquants'}
                        </span>
                        {selectedClient.computedReservations > 0 ? (
                          <span className="rounded-full border border-emerald-300/25 bg-emerald-500/12 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-200">Actif</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link
                      to={`/clients/${selectedClient.id}`}
                      className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-4 text-sm font-black text-black transition hover:bg-[#f1c232]"
                    >
                      <Eye className="h-4 w-4" />
                      Voir profil
                    </Link>
                    <Button variant="secondary" className="h-10 px-4" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEditClient(selectedClient)}>Modifier</Button>
                    <Link
                      to="/reservations"
                      className="focus-ring inline-flex h-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-soft)]"
                    >
                      Nouvelle réservation
                    </Link>
                    <Button variant="danger" className="h-10 px-4" icon={<Trash2 className="h-4 w-4" />} onClick={() => setClientToDelete(selectedClient)}>Supprimer</Button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Coordonnées</p>
                    <div className="mt-4 space-y-3 text-sm text-[var(--app-text-soft)]">
                      <p className="flex min-w-0 items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-[var(--app-gold-text)]" /><span className="truncate">{selectedClient.phone || '—'}</span></p>
                      <p className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-[var(--app-gold-text)]" /><span className="truncate">{selectedClient.email || '—'}</span></p>
                      <p className="flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-[var(--app-gold-text)]" /><span className="truncate">{selectedClient.address || 'Adresse non renseignée'}</span></p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Documents d’identité</p>
                    <div className="mt-4 space-y-3 text-sm text-[var(--app-text-soft)]">
                      <p className="flex items-center justify-between gap-3"><span className="text-[var(--app-text-muted)]">CIN / Passeport</span><strong className="text-right text-[var(--app-text)]">{selectedClient.cin || '—'}</strong></p>
                      <p className="flex items-center justify-between gap-3"><span className="text-[var(--app-text-muted)]">Permis</span><strong className="text-right text-[var(--app-text)]">{selectedClient.license || '—'}</strong></p>
                      <p className="flex items-center justify-between gap-3"><span className="text-[var(--app-text-muted)]">Statut</span><strong className={hasDocs(selectedClient) ? 'text-emerald-700 dark:text-emerald-200' : 'text-amber-700 dark:text-amber-100'}>{hasDocs(selectedClient) ? 'Complet' : 'À compléter'}</strong></p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Activité</p>
                    <div className="mt-4 space-y-3 text-sm text-[var(--app-text-soft)]">
                      <p className="flex items-center justify-between gap-3"><span className="text-[var(--app-text-muted)]">Réservations</span><strong className="text-[var(--app-text)]">{selectedClient.computedReservations}</strong></p>
                      <p className="flex items-center justify-between gap-3"><span className="text-[var(--app-text-muted)]">Total dépensé</span><strong className="text-[var(--app-text)]">{formatMAD(selectedClient.computedSpent)}</strong></p>
                      <p className="flex items-center justify-between gap-3"><span className="text-[var(--app-text-muted)]">Reste à payer</span><strong className={selectedClient.computedRemaining > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-200'}>{formatMAD(selectedClient.computedRemaining)}</strong></p>
                      <p className="flex items-center justify-between gap-3"><span className="text-[var(--app-text-muted)]">Dernière réservation</span><strong className="text-right text-[var(--app-text)]">{formatReservationDate(latestReservationByClient[selectedClient.id]?.pickupDate)}</strong></p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Résumé rapide</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: 'Réservations totales', value: String(selectedClient.computedReservations), icon: CalendarClock },
                      { label: 'Total dépensé', value: formatMAD(selectedClient.computedSpent), icon: Wallet },
                      { label: 'Reste à payer', value: formatMAD(selectedClient.computedRemaining), icon: Wallet },
                      { label: 'Dernière réservation', value: formatReservationDate(latestReservationByClient[selectedClient.id]?.pickupDate), icon: CalendarClock },
                      { label: 'Client depuis', value: formatClientSince(selectedClient.createdAt), icon: Users },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-gold-text)]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[var(--app-text)]">{value}</p>
                            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{label}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Notes internes</p>
                    <Edit3 className="h-4 w-4 text-[var(--app-gold-text)]" />
                  </div>
                  <p className="mt-3 text-sm text-[var(--app-text-soft)]">Aucune note interne.</p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl border border-[#D4A017]/25 bg-[#D4A017]/10 text-[var(--app-gold-text)]">
                  <Users className="h-8 w-8" />
                </div>
                <h2 className="mt-5 text-2xl font-black text-[var(--app-text)]">Sélectionnez un client</h2>
                <p className="mt-2 max-w-sm text-sm text-[var(--app-text-muted)]">Choisissez un client à gauche pour voir ses coordonnées, documents et activité.</p>
              </div>
            )}
          </Card>
        </div>
      )}
      </div>

      {mobileClientDetails ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fermer les détails"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMobileClientId('')}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[34px] border border-[var(--app-border)] bg-[var(--app-modal)] p-5 shadow-[0_-24px_70px_rgba(0,0,0,.55)]">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/20" />
            <div className="flex items-start gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-[#F5C542] to-[#B8870E] text-2xl font-black text-black shadow-[0_0_38px_rgba(212,160,23,0.22)]">
                {clientInitials(mobileClientDetails.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-black leading-tight text-[var(--app-text)]">{mobileClientDetails.fullName}</h2>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">Client depuis {formatClientSince(mobileClientDetails.createdAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{mobileClientDetails.status === 'New' ? 'New' : 'Actif'}</Badge>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${hasDocs(mobileClientDetails) ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200' : 'border-amber-300/30 bg-amber-500/12 text-amber-700 dark:text-amber-100'}`}>
                    {hasDocs(mobileClientDetails) ? 'Documents complets' : 'Docs manquants'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setMobileClientId('')}
                className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Coordonnées</p>
                <div className="mt-4 space-y-3 text-sm text-[var(--app-text-soft)]">
                  <p className="flex min-w-0 items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-[var(--app-gold-text)]" /><span className="truncate">{mobileClientDetails.phone || '—'}</span></p>
                  <p className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-[var(--app-gold-text)]" /><span className="truncate">{mobileClientDetails.email || '—'}</span></p>
                  <p className="flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-[var(--app-gold-text)]" /><span className="truncate">{mobileClientDetails.address || 'Adresse non renseignée'}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--app-gold-text)]">Documents</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-[var(--app-text-muted)]">CIN / Passeport</p>
                    <p className="font-bold text-[var(--app-text)]">{mobileClientDetails.cin || '—'}</p>
                    <p className="text-[var(--app-text-muted)]">Permis</p>
                    <p className="font-bold text-[var(--app-text)]">{mobileClientDetails.license || '—'}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--app-gold-text)]">Activité</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-[var(--app-text-muted)]">Réservations</p>
                    <p className="font-bold text-[var(--app-text)]">{mobileClientDetails.computedReservations}</p>
                    <p className="text-[var(--app-text-muted)]">Total dépensé</p>
                    <p className="font-bold text-[var(--app-text)]">{formatMAD(mobileClientDetails.computedSpent)}</p>
                    <p className="text-[var(--app-text-muted)]">Reste à payer</p>
                    <p className={`font-bold ${mobileClientDetails.computedRemaining > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-200'}`}>{formatMAD(mobileClientDetails.computedRemaining)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Résumé rapide</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Dernière réservation', value: formatReservationDate(latestReservationByClient[mobileClientDetails.id]?.pickupDate) },
                    { label: 'Client depuis', value: formatClientSince(mobileClientDetails.createdAt) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                      <p className="text-sm font-black text-[var(--app-text)]">{item.value}</p>
                      <p className="mt-1 text-xs text-[var(--app-text-muted)]">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Notes internes</p>
                <p className="mt-3 text-sm text-[var(--app-text-soft)]">Aucune note interne.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    openEditClient(mobileClientDetails);
                    setMobileClientId('');
                  }}
                  className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-sm font-bold text-[var(--app-text)]"
                >
                  <Edit3 className="h-4 w-4" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/reservations')}
                  className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/10 text-sm font-bold text-[var(--app-gold-text)]"
                >
                  <CalendarClock className="h-4 w-4" />
                  Réserver
                </button>
              </div>
              <Link
                to={`/clients/${mobileClientDetails.id}`}
                onClick={() => setMobileClientId('')}
                className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#D4A017] text-sm font-black text-black transition hover:bg-[#f1c232]"
              >
                <Eye className="h-4 w-4" />
                Voir profil
              </Link>
              <button
                type="button"
                onClick={() => {
                  setClientToDelete(mobileClientDetails);
                  setMobileClientId('');
                }}
                className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-500/10 text-sm font-bold text-[var(--app-danger)]"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer client
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={modalOpen}
        title={editingClient ? 'Modifier un client' : 'Ajouter un client'}
        subtitle="Enregistrez un client et ses documents."
        onClose={closeModal}
        panelClassName="sm:max-w-4xl lg:max-h-[92dvh]"
        bodyClassName="p-0 sm:p-0"
      >
        <form className="grid min-h-full grid-rows-[1fr_auto]" onSubmit={handleSaveClient}>
          <div className="grid gap-4 overflow-y-auto px-4 py-4 pb-6 sm:px-6 sm:py-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Informations personnelles</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Nom complet" required value={formState.fullName} onChange={(value) => setFormState((s) => ({ ...s, fullName: value }))} error={formErrors.fullName} />
              <InputField label="Téléphone" required value={formState.phone} onChange={(value) => setFormState((s) => ({ ...s, phone: value }))} error={formErrors.phone} />
              <InputField label="Email" type="email" value={formState.email} onChange={(value) => setFormState((s) => ({ ...s, email: value }))} error={formErrors.email} />
              <InputField label="Adresse" value={formState.address} onChange={(value) => setFormState((s) => ({ ...s, address: value }))} />
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Documents</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="CIN/Passport" value={formState.cin} onChange={(value) => setFormState((s) => ({ ...s, cin: value }))} />
              <InputField label="Numéro de permis" value={formState.license} onChange={(value) => setFormState((s) => ({ ...s, license: value }))} />
            </div>
          </section>

          <section className="rounded-3xl border border-gold-300/15 bg-[var(--app-card)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] lg:col-span-2">
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Pièces d’identité</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DocumentUploadBox
                title="Pièce d’identité recto"
                previewUrl={frontPreview}
                documentSource={frontFile?.name || (frontRemoved ? null : editingClient?.idCardFrontUrl)}
                mimeType={frontFile?.type}
                onPick={(event) => onPickDocument(event, 'front')}
                onCapture={() => openCamera('front')}
                onView={() => viewDocument('front')}
                onDownload={() => downloadDocument('front')}
                viewLoading={documentAction === 'front-view'}
                downloadLoading={documentAction === 'front-download'}
                onRemove={() => {
                  setFrontFile(null);
                  setFrontPreview(null);
                  setFrontRemoved(true);
                }}
              />
              <DocumentUploadBox
                title="Pièce d’identité verso"
                previewUrl={backPreview}
                documentSource={backFile?.name || (backRemoved ? null : editingClient?.idCardBackUrl)}
                mimeType={backFile?.type}
                onPick={(event) => onPickDocument(event, 'back')}
                onCapture={() => openCamera('back')}
                onView={() => viewDocument('back')}
                onDownload={() => downloadDocument('back')}
                viewLoading={documentAction === 'back-view'}
                downloadLoading={documentAction === 'back-download'}
                onRemove={() => {
                  setBackFile(null);
                  setBackPreview(null);
                  setBackRemoved(true);
                }}
              />
            </div>
            {!(frontPreview || (!frontRemoved && editingClient?.idCardFrontUrl)) || !(backPreview || (!backRemoved && editingClient?.idCardBackUrl)) ? (
              <p className="text-xs text-amber-700 dark:text-amber-200/90">Documents manquants: vous pouvez compléter recto/verso plus tard.</p>
            ) : null}
          </section>

          </div>
          <div className="sticky bottom-0 left-0 right-0 border-t border-[var(--app-border)] bg-[var(--app-modal)]/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur sm:px-6 sm:pb-3">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
              <Button type="button" variant="secondary" className="h-11 rounded-xl" onClick={closeModal} disabled={saving}>Annuler</Button>
              <Button type="submit" className="h-11 rounded-xl" loading={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(clientToDelete)} title="Supprimer le client" onClose={() => setClientToDelete(null)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
            <p className="font-semibold text-[var(--app-danger)]">Cette action est sensible.</p>
            <p className="mt-2 text-sm text-[var(--app-text-soft)]">Le client sera retiré du CRM. Vérifiez qu’aucune opération en cours ne dépend de ce dossier.</p>
          </div>
          <p className="text-sm text-[var(--app-text-soft)]">Client: <strong>{clientToDelete?.fullName}</strong></p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setClientToDelete(null)}>Annuler</Button>
            <Button type="button" variant="danger" onClick={confirmDeleteClient}>Supprimer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={cameraOpen} onClose={closeCamera} title="Prendre une photo">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card-soft)]">
            {capturedPreview ? (
              <img src={capturedPreview} alt="Capture caméra" loading="lazy" decoding="async" className="h-64 w-full object-cover sm:h-72" />
            ) : (
              <video ref={videoRef} className="h-64 w-full object-cover sm:h-72" playsInline muted />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          {cameraError ? <p className="text-xs text-amber-700 dark:text-amber-200">{cameraError}</p> : null}
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
    <label className="grid gap-2 text-sm font-medium text-[var(--app-text-soft)]">
      <span>{label}{required ? ' *' : ''}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`form-control focus-ring min-h-11 w-full rounded-2xl bg-[var(--app-input)] ${error ? 'border-rose-400/60 ring-1 ring-rose-400/35' : ''}`}
      />
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
    </label>
  );
}

type DocumentUploadBoxProps = {
  title: string;
  previewUrl: string | null;
  documentSource?: string | null;
  mimeType?: string;
  onPick: (event: ChangeEvent<HTMLInputElement>) => void;
  onCapture: () => void;
  onView: () => void;
  onDownload: () => void;
  onRemove: () => void;
  viewLoading?: boolean;
  downloadLoading?: boolean;
};

function DocumentUploadBox({
  title,
  previewUrl,
  documentSource,
  mimeType,
  onPick,
  onCapture,
  onView,
  onDownload,
  onRemove,
  viewLoading,
  downloadLoading,
}: DocumentUploadBoxProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const hasDocument = Boolean(previewUrl || documentSource);
  const documentKind = getClientDocumentKind(documentSource || previewUrl, mimeType);
  const showImage = hasDocument && documentKind === 'image' && Boolean(previewUrl) && !imageBroken;

  useEffect(() => {
    setImageLoaded(false);
    setImageBroken(false);
  }, [previewUrl]);

  return (
    <div className="min-w-0 rounded-3xl border border-gold-300/15 bg-[var(--app-surface-soft)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
      <p className="mb-1 text-sm font-black text-[var(--app-text)]">{title}</p>
      <p className="mb-3 text-xs text-[var(--app-text-muted)]">Importez une image nette ou prenez une photo.</p>
      {hasDocument ? (
        <div className="space-y-3">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[var(--app-border)] bg-black/20">
            {showImage ? (
              <img
                src={previewUrl || ''}
                alt={title}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageBroken(true)}
                className={`absolute inset-0 h-full w-full object-contain transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            ) : null}
            {!showImage || !imageLoaded ? (
              <DocumentPlaceholder kind={documentKind} available />
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" className="h-10 min-w-0 rounded-xl px-2 text-xs" icon={<Eye className="h-3.5 w-3.5" />} loading={viewLoading} onClick={onView}>
              Voir
            </Button>
            <Button type="button" variant="secondary" className="h-10 min-w-0 rounded-xl border-gold-300/30 px-2 text-xs text-[var(--app-gold-text)]" icon={<Download className="h-3.5 w-3.5" />} loading={downloadLoading} onClick={onDownload}>
              Télécharger
            </Button>
            <label className="focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 text-xs font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-soft)]">
              <Upload className="h-3.5 w-3.5" />
              Importer
              <input type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={onPick} />
            </label>
            <button
              type="button"
              onClick={onCapture}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gold-300/45 bg-gold-400/15 px-3 text-xs font-semibold text-[var(--app-gold-text)] transition hover:bg-gold-400/25"
            >
              <Camera className="h-3.5 w-3.5" />
              Photo
            </button>
            <Button type="button" variant="danger" className="col-span-2 h-10 rounded-xl px-3 text-xs" icon={<X className="h-3.5 w-3.5" />} onClick={onRemove}>
              Retirer
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="focus-ring flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gold-300/30 bg-[var(--app-surface-soft)] px-4 py-6 text-center transition hover:border-[#D4A017]/70 hover:bg-[#D4A017]/8">
            <DocumentPlaceholder kind="image" />
            <span className="text-sm font-semibold text-[var(--app-text)]">Aucun document</span>
            <span className="text-xs font-semibold text-[var(--app-gold-text)]">Importer une image</span>
            <span className="text-xs text-[var(--app-text-muted)]">PNG, JPG ou WEBP · Max 5MB</span>
            <input type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={onPick} />
          </label>
          <button
            type="button"
            onClick={onCapture}
            className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold-300/45 bg-gold-400/12 px-3 text-xs font-semibold text-[var(--app-gold-text)] transition hover:bg-gold-400/22"
          >
            <Camera className="h-3.5 w-3.5" />
            Prendre une photo
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
        <ShieldCheck className="h-3.5 w-3.5" />
        Document visible uniquement dans votre agence
      </div>
    </div>
  );
}

function DocumentPlaceholder({ kind, available = false }: { kind: ClientDocumentKind; available?: boolean }) {
  const Icon = kind === 'image' ? FileImage : FileText;
  return (
    <div className="grid h-full w-full place-items-center px-4 text-center">
      <div>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-[var(--app-gold-text)]">
          <Icon className="h-5 w-5" />
        </span>
        {available ? (
          <>
            <p className="mt-3 text-sm font-bold text-[var(--app-text)]">Document disponible</p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              {kind === 'pdf' ? 'Fichier PDF' : kind === 'image' ? 'Aperçu en cours de chargement' : 'Fichier joint'}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
