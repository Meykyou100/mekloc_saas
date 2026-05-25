import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Camera,
  Car,
  Edit3,
  Eye,
  FileImage,
  Filter,
  LayoutDashboard,
  Mail,
  MapPin,
  MoreHorizontal,
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
    <div className="relative overflow-x-hidden pb-44 md:pb-8">
      <div className="pointer-events-none absolute right-[-18%] top-10 h-72 w-72 rounded-full bg-[#D4A017]/10 blur-3xl" />
      <div className="relative pt-4 md:hidden">
        <section className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-gold-200">CRM</p>
              <h1 className="mt-2 text-4xl font-black leading-none text-white">Clients</h1>
              <p className="mt-2 text-base leading-relaxed text-carbon-300">Gérez vos clients et leurs documents.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                aria-label="Filtres"
                className="focus-ring grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white shadow-[0_18px_42px_rgba(0,0,0,.25)]"
              >
                <Filter className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Ajouter un client"
                onClick={openNewClient}
                className="focus-ring grid h-14 w-14 place-items-center rounded-2xl bg-[#D4A017] text-black shadow-[0_18px_42px_rgba(212,160,23,.25)] transition hover:bg-[#f1c232]"
              >
                <UserPlus className="h-5 w-5" />
              </button>
            </div>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-carbon-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 120))}
              placeholder="Nom, téléphone, CIN, permis..."
              className="form-control focus-ring h-16 w-full rounded-3xl border-white/10 bg-white/[0.045] pl-12 pr-4 text-base text-white placeholder:text-carbon-500"
            />
          </label>

          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
            {[
              { label: 'Total clients', value: String(clientsStats.total), icon: Users, active: true, tone: 'text-gold-200', bg: 'bg-[#D4A017]/12' },
              { label: 'Nouveaux ce mois', value: String(clientsStats.newClients), icon: UserPlus, tone: 'text-emerald-200', bg: 'bg-emerald-500/12' },
              { label: 'Actifs', value: String(clientsStats.withReservations), icon: BadgeCheck, tone: 'text-sky-200', bg: 'bg-sky-500/12' },
              { label: 'Docs manquants', value: String(clientsStats.withMissingDocs), icon: AlertTriangle, tone: 'text-amber-200', bg: 'bg-amber-500/12' },
              { label: 'Total dépensé', value: formatMAD(clientsStats.totalSpent), icon: Wallet, tone: 'text-violet-200', bg: 'bg-violet-500/12' },
            ].map(({ label, value, icon: Icon, active, tone, bg }) => (
              <div
                key={label}
                className={`min-w-[138px] rounded-3xl border p-4 shadow-[0_18px_42px_rgba(0,0,0,.24)] ${
                  active
                    ? 'border-[#D4A017]/70 bg-[#D4A017]/12'
                    : 'border-white/10 bg-gradient-to-br from-zinc-950/95 to-zinc-900/60'
                }`}
              >
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${bg}`}>
                  <Icon className={`h-5 w-5 ${tone}`} />
                </span>
                <p className="mt-4 truncate text-2xl font-black text-white">{value}</p>
                <p className="mt-1 text-sm font-medium leading-snug text-carbon-300">{label}</p>
              </div>
            ))}
          </div>

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
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
                className={`focus-ring min-h-12 whitespace-nowrap rounded-2xl border px-5 text-sm font-bold transition ${
                  filter === value
                    ? 'border-[#D4A017]/70 bg-[#D4A017]/18 text-gold-100'
                    : 'border-white/10 bg-white/[0.04] text-carbon-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {clients.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,.30)]">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#D4A017]/25 bg-[#D4A017]/10 text-gold-200">
                <Users className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-2xl font-black text-white">Aucun client</h2>
              <p className="mt-2 text-sm text-carbon-400">Ajoutez votre premier client pour commencer.</p>
              <Button className="mt-5 w-full" icon={<UserPlus className="h-4 w-4" />} onClick={openNewClient}>Ajouter un client</Button>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-center">
              <Search className="mx-auto h-8 w-8 text-carbon-400" />
              <p className="mt-3 font-bold text-white">Aucun résultat</p>
              <p className="mt-1 text-sm text-carbon-400">Essayez une autre recherche ou un autre filtre.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClients.map((client) => {
                const documentsReady = hasDocs(client);
                return (
                  <article
                    key={client.id}
                    className="rounded-[28px] border border-white/10 bg-gradient-to-br from-zinc-950/95 to-zinc-900/60 p-5 shadow-[0_24px_60px_rgba(0,0,0,.30)] transition active:scale-[0.99]"
                    onClick={() => setMobileClientId(client.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-[#F5C542] to-[#B8870E] text-xl font-black text-black shadow-[0_0_30px_rgba(212,160,23,.20)]">
                        {clientInitials(client.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="truncate text-xl font-black text-white">{client.fullName}</h2>
                            <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-carbon-300">
                              <Phone className="h-4 w-4 shrink-0" />
                              <span className="truncate">{client.phone || 'Téléphone manquant'}</span>
                            </p>
                            <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-carbon-300">
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
                            className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-carbon-200"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${client.status === 'New' ? 'border-[#D4A017]/35 bg-[#D4A017]/12 text-gold-100' : 'border-emerald-300/25 bg-emerald-500/12 text-emerald-200'}`}>
                            {client.status === 'New' ? 'New' : 'Actif'}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${documentsReady ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-200' : 'border-amber-300/30 bg-amber-500/12 text-amber-100'}`}>
                            {documentsReady ? 'Docs complets' : 'Docs manquants'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                      <div>
                        <p className="text-lg font-black text-white">{formatMAD(client.computedSpent)}</p>
                        <p className="text-sm text-carbon-400">
                          {client.computedReservations} {client.computedReservations > 1 ? 'réservations' : 'réservation'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setMobileClientId(client.id)}
                        className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] text-sm font-bold text-white"
                      >
                        <Eye className="h-4 w-4" />
                        Voir
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditClient(client)}
                        className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] text-sm font-bold text-white"
                      >
                        <Edit3 className="h-4 w-4" />
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/reservations')}
                        className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/10 px-2 text-center text-sm font-bold text-gold-100"
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
          { label: 'Total clients', value: String(clientsStats.total), helper: 'Clients enregistrés', icon: Users, tone: 'text-gold-200', glow: 'from-[#D4A017]/18' },
          { label: 'Nouveaux clients', value: String(clientsStats.newClients), helper: 'Ce mois / statut nouveau', icon: UserPlus, tone: 'text-emerald-200', glow: 'from-emerald-400/14' },
          { label: 'Avec réservations', value: String(clientsStats.withReservations), helper: 'Historique actif', icon: BadgeCheck, tone: 'text-teal-200', glow: 'from-teal-400/14' },
          { label: 'Total dépensé', value: formatMAD(clientsStats.totalSpent), helper: 'Paiements ou réservations', icon: Wallet, tone: 'text-violet-200', glow: 'from-violet-400/14' },
          { label: 'Docs manquants', value: String(clientsStats.withMissingDocs), helper: 'À compléter', icon: AlertTriangle, tone: 'text-amber-200', glow: 'from-amber-400/14' },
        ].map(({ label, value, helper, icon: Icon, tone }) => (
          <div
            key={label}
            className="group relative min-h-[126px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950/90 to-black p-4 shadow-[0_18px_48px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition hover:border-[#D4A017]/35 light:bg-white"
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${label === 'Total clients' ? 'from-[#D4A017]/18' : label === 'Nouveaux clients' ? 'from-emerald-400/14' : label === 'Avec réservations' ? 'from-teal-400/14' : label === 'Total dépensé' ? 'from-violet-400/14' : 'from-amber-400/14'} to-transparent opacity-70`} />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-carbon-500">{label}</p>
                <p className="mt-3 truncate text-2xl font-black text-white light:text-carbon-950">{value}</p>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#D4A017]/20 bg-[#D4A017]/10 shadow-[0_0_28px_rgba(212,160,23,0.12)]">
                <Icon className={`h-5 w-5 ${tone}`} />
              </span>
            </div>
            <p className="relative mt-3 truncate text-xs font-medium text-carbon-400">{helper}</p>
          </div>
        ))}
      </div>

      <Card className="relative mb-5 border-white/10 bg-gradient-to-br from-zinc-950/90 to-black p-4 shadow-[0_18px_46px_rgba(0,0,0,.24)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block lg:min-w-[360px] lg:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 120))}
              placeholder="Rechercher nom, téléphone, email, CIN, permis..."
              className="form-control focus-ring h-12 w-full rounded-2xl border-white/10 bg-black/30 pl-10 pr-4 text-sm light:bg-white light:text-carbon-950"
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
                    ? 'border-[#D4A017]/70 bg-[#D4A017]/20 text-gold-100'
                    : 'border-white/10 bg-white/5 text-carbon-200 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="relative min-w-[170px]">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ClientSort)}
              className="form-control focus-ring h-12 w-full appearance-none rounded-2xl border-white/10 bg-black/30 pl-10 pr-4 text-sm font-semibold text-white light:bg-white light:text-carbon-950"
            >
              <option value="recent">Plus récent</option>
              <option value="name">Nom A-Z</option>
              <option value="spent">Dépense la plus élevée</option>
            </select>
          </label>
        </div>
      </Card>

      {clients.length === 0 ? (
        <Card className="relative overflow-hidden border-white/10 bg-gradient-to-br from-zinc-950 to-black p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-[#D4A017]/25 bg-[#D4A017]/10 text-gold-200">
            <Users className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-white">Aucun client pour le moment</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-carbon-400">Ajoutez votre premier client ou créez une réservation pour commencer à structurer votre CRM.</p>
          <Button className="mt-6" icon={<UserPlus className="h-4 w-4" />} onClick={openNewClient}>Ajouter un client</Button>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.42fr)_minmax(520px,0.58fr)]">
          <Card className="border-white/10 bg-gradient-to-br from-zinc-950/95 to-black p-0 shadow-[0_24px_70px_rgba(0,0,0,.30)]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-white">Clients ({filteredClients.length})</h2>
                  <p className="mt-1 text-xs text-carbon-500">Liste filtrée et triée</p>
                </div>
                <span className="rounded-full border border-[#D4A017]/30 bg-[#D4A017]/10 px-3 py-1 text-xs font-bold text-gold-100">{clientsStats.total} total</span>
              </div>
            </div>

            {filteredClients.length === 0 ? (
              <div className="p-6 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-carbon-300">
                  <Search className="h-5 w-5" />
                </div>
                <p className="mt-4 font-semibold text-white">Aucun résultat</p>
                <p className="mt-1 text-sm text-carbon-400">Essayez une autre recherche ou un autre filtre.</p>
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
                          : 'border-white/10 bg-white/[0.035] hover:border-[#D4A017]/25 hover:bg-white/[0.055]'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black ${isSelected ? 'bg-[#D4A017] text-black' : 'bg-white/10 text-white'}`}>
                          {clientInitials(client.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-white">{client.fullName}</p>
                              <p className="mt-0.5 truncate text-xs text-carbon-400">{client.phone || 'Téléphone manquant'}</p>
                              <p className="truncate text-xs text-carbon-500">{client.email || 'Email non renseigné'}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-black text-white">{client.computedReservations}</p>
                              <p className="text-[11px] text-carbon-500">Réservations</p>
                              <p className="mt-1 text-xs font-bold text-gold-100">{formatMAD(client.computedSpent)}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${client.status === 'New' ? 'border-[#D4A017]/35 bg-[#D4A017]/12 text-gold-100' : 'border-emerald-300/25 bg-emerald-500/12 text-emerald-200'}`}>
                              {client.status === 'New' ? 'New' : 'Actif'}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${documentsReady ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-200' : 'border-amber-300/30 bg-amber-500/12 text-amber-100'}`}>
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

          <Card className="min-h-[520px] border-white/10 bg-gradient-to-br from-zinc-950/95 via-[#10141c] to-black p-5 shadow-[0_24px_70px_rgba(0,0,0,.30)]">
            {selectedClient ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-[#F5C542] to-[#B8870E] text-2xl font-black text-black shadow-[0_0_38px_rgba(212,160,23,0.22)]">
                      {clientInitials(selectedClient.fullName)}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-black text-white">{selectedClient.fullName}</h2>
                      <p className="mt-1 text-sm text-carbon-400">Client depuis {formatClientSince(selectedClient.createdAt)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge>{selectedClient.status === 'New' ? 'New' : 'Actif'}</Badge>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${hasDocs(selectedClient) ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-200' : 'border-amber-300/30 bg-amber-500/12 text-amber-100'}`}>
                          {hasDocs(selectedClient) ? 'Documents complets' : 'Documents manquants'}
                        </span>
                        {selectedClient.computedReservations > 0 ? (
                          <span className="rounded-full border border-emerald-300/25 bg-emerald-500/12 px-3 py-1 text-xs font-bold text-emerald-200">Actif</span>
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
                      className="focus-ring inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                      Nouvelle réservation
                    </Link>
                    <Button variant="danger" className="h-10 px-4" icon={<Trash2 className="h-4 w-4" />} onClick={() => setClientToDelete(selectedClient)}>Supprimer</Button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gold-200">Coordonnées</p>
                    <div className="mt-4 space-y-3 text-sm text-carbon-200">
                      <p className="flex min-w-0 items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">{selectedClient.phone || '—'}</span></p>
                      <p className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">{selectedClient.email || '—'}</span></p>
                      <p className="flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">{selectedClient.address || 'Adresse non renseignée'}</span></p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gold-200">Documents d’identité</p>
                    <div className="mt-4 space-y-3 text-sm text-carbon-200">
                      <p className="flex items-center justify-between gap-3"><span className="text-carbon-500">CIN / Passeport</span><strong className="text-right text-white">{selectedClient.cin || '—'}</strong></p>
                      <p className="flex items-center justify-between gap-3"><span className="text-carbon-500">Permis</span><strong className="text-right text-white">{selectedClient.license || '—'}</strong></p>
                      <p className="flex items-center justify-between gap-3"><span className="text-carbon-500">Statut</span><strong className={hasDocs(selectedClient) ? 'text-emerald-200' : 'text-amber-100'}>{hasDocs(selectedClient) ? 'Complet' : 'À compléter'}</strong></p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gold-200">Activité</p>
                    <div className="mt-4 space-y-3 text-sm text-carbon-200">
                      <p className="flex items-center justify-between gap-3"><span className="text-carbon-500">Réservations</span><strong className="text-white">{selectedClient.computedReservations}</strong></p>
                      <p className="flex items-center justify-between gap-3"><span className="text-carbon-500">Total dépensé</span><strong className="text-white">{formatMAD(selectedClient.computedSpent)}</strong></p>
                      <p className="flex items-center justify-between gap-3"><span className="text-carbon-500">Dernière réservation</span><strong className="text-right text-white">{formatReservationDate(latestReservationByClient[selectedClient.id]?.pickupDate)}</strong></p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-gold-200">Résumé rapide</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: 'Réservations totales', value: String(selectedClient.computedReservations), icon: CalendarClock },
                      { label: 'Total dépensé', value: formatMAD(selectedClient.computedSpent), icon: Wallet },
                      { label: 'Dernière réservation', value: formatReservationDate(latestReservationByClient[selectedClient.id]?.pickupDate), icon: CalendarClock },
                      { label: 'Client depuis', value: formatClientSince(selectedClient.createdAt), icon: Users },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/10 text-gold-200">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">{value}</p>
                            <p className="mt-0.5 text-xs text-carbon-500">{label}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gold-200">Notes internes</p>
                    <Edit3 className="h-4 w-4 text-gold-200" />
                  </div>
                  <p className="mt-3 text-sm text-carbon-300">Aucune note interne.</p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[440px] flex-col items-center justify-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl border border-[#D4A017]/25 bg-[#D4A017]/10 text-gold-200">
                  <Users className="h-8 w-8" />
                </div>
                <h2 className="mt-5 text-2xl font-black text-white">Sélectionnez un client</h2>
                <p className="mt-2 max-w-sm text-sm text-carbon-400">Choisissez un client à gauche pour voir ses coordonnées, documents et activité.</p>
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
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[34px] border border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-950 p-5 shadow-[0_-24px_70px_rgba(0,0,0,.55)]">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/20" />
            <div className="flex items-start gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-[#F5C542] to-[#B8870E] text-2xl font-black text-black shadow-[0_0_38px_rgba(212,160,23,0.22)]">
                {clientInitials(mobileClientDetails.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-black leading-tight text-white">{mobileClientDetails.fullName}</h2>
                <p className="mt-1 text-sm text-carbon-400">Client depuis {formatClientSince(mobileClientDetails.createdAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{mobileClientDetails.status === 'New' ? 'New' : 'Actif'}</Badge>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${hasDocs(mobileClientDetails) ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-200' : 'border-amber-300/30 bg-amber-500/12 text-amber-100'}`}>
                    {hasDocs(mobileClientDetails) ? 'Documents complets' : 'Docs manquants'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setMobileClientId('')}
                className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-200">Coordonnées</p>
                <div className="mt-4 space-y-3 text-sm text-carbon-200">
                  <p className="flex min-w-0 items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">{mobileClientDetails.phone || '—'}</span></p>
                  <p className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">{mobileClientDetails.email || '—'}</span></p>
                  <p className="flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-gold-200" /><span className="truncate">{mobileClientDetails.address || 'Adresse non renseignée'}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-gold-200">Documents</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-carbon-500">CIN / Passeport</p>
                    <p className="font-bold text-white">{mobileClientDetails.cin || '—'}</p>
                    <p className="text-carbon-500">Permis</p>
                    <p className="font-bold text-white">{mobileClientDetails.license || '—'}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-gold-200">Activité</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-carbon-500">Réservations</p>
                    <p className="font-bold text-white">{mobileClientDetails.computedReservations}</p>
                    <p className="text-carbon-500">Total dépensé</p>
                    <p className="font-bold text-white">{formatMAD(mobileClientDetails.computedSpent)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-200">Résumé rapide</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Dernière réservation', value: formatReservationDate(latestReservationByClient[mobileClientDetails.id]?.pickupDate) },
                    { label: 'Client depuis', value: formatClientSince(mobileClientDetails.createdAt) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-sm font-black text-white">{item.value}</p>
                      <p className="mt-1 text-xs text-carbon-500">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-200">Notes internes</p>
                <p className="mt-3 text-sm text-carbon-300">Aucune note interne.</p>
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
                  className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-bold text-white"
                >
                  <Edit3 className="h-4 w-4" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/reservations')}
                  className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/10 text-sm font-bold text-gold-100"
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
                className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-500/10 text-sm font-bold text-rose-100"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer client
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {clients.length > 0 ? (
        <div className="fixed inset-x-4 bottom-24 z-40 md:hidden">
          <button
            type="button"
            onClick={openNewClient}
            className="focus-ring flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-[#D4A017] text-base font-black text-black shadow-[0_20px_50px_rgba(212,160,23,.30)] transition hover:bg-[#f1c232]"
          >
            <UserPlus className="h-5 w-5" />
            Ajouter un client
          </button>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/85 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {[
            { label: 'Tableau', icon: LayoutDashboard, path: '/dashboard' },
            { label: 'Réservations', icon: CalendarClock, path: '/reservations' },
            { label: 'Clients', icon: Users, path: '/clients', active: true },
            { label: 'Véhicules', icon: Car, path: '/vehicles' },
            { label: 'Plus', icon: MoreHorizontal, path: '/settings' },
          ].map(({ label, icon: Icon, path, active }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(path)}
              className={`focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition ${
                active ? 'text-gold-200' : 'text-carbon-400 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

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
