import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Download,
  Eye,
  FileSignature,
  FileText,
  MessageCircle,
  PenLine,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ContractPdfTemplate, { type ContractPdfData } from '../components/contracts/ContractPdfTemplate';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatMAD, type Client, type Contract, type Vehicle } from '../data/mockData';
import { buildWhatsAppReminderUrl } from '../lib/assistantDuJour';
import { getNotificationPreferences } from '../lib/notificationPreferences';
import { getReservationPaymentSummary } from '../lib/paymentBalance';
import { supabase } from '../lib/supabase';

const templates = ['Standard location', 'Véhicule premium', 'Compte entreprise'];

const defaultTerms = [
  'Le locataire reconnaît avoir reçu le véhicule en bon état de fonctionnement.',
  'Le locataire s’engage à restituer le véhicule dans le même état.',
  'Toute infraction, amende ou dommage reste à la charge du locataire.',
  "Le véhicule ne doit pas être utilisé hors des conditions autorisées par l’agence.",
  'Le retard de restitution peut entraîner des frais supplémentaires.',
];

function statusLabel(status: string) {
  if (status === 'Signed') return 'Signé';
  if (status === 'Downloaded') return 'Généré';
  if (status === 'Sent') return 'Envoyé';
  if (status === 'Cancelled') return 'Annulé';
  return 'Brouillon';
}

function normalizeArchiveStatus(status: string) {
  if (status === 'Signed') return 'Signé';
  if (status === 'Downloaded') return 'Généré';
  if (status === 'Sent') return 'Envoyé';
  if (status === 'Cancelled') return 'Annulé';
  return 'Brouillon';
}

function getDiffDays(from: string, to: string) {
  const fromDate = new Date(from).getTime();
  const toDate = new Date(to).getTime();
  if (Number.isNaN(fromDate) || Number.isNaN(toDate)) return 1;
  return Math.max(1, Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)));
}

function formatDateFr(date: string) {
  if (!date) return 'Non renseigné';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' });
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function normalizeLoose(value?: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type PdfLogoAsset = {
  dataUrl: string;
  width: number;
  height: number;
};

function measureDataUrlImage(dataUrl: string): Promise<PdfLogoAsset | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        dataUrl,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function loadLogoForPdf(logoUrl: string): Promise<PdfLogoAsset | null> {
  try {
    const response = await fetch(logoUrl, { mode: 'cors', cache: 'force-cache' });
    if (response.ok) {
      const dataUrl = await blobToDataUrl(await response.blob());
      if (dataUrl) {
        const measured = await measureDataUrlImage(dataUrl);
        if (measured) return measured;
      }
    }
  } catch {
    // Fall back to image decoding below; some signed storage URLs reject fetch but still load in an <img>.
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve({
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = logoUrl;
  });
}

const A4_SOURCE_WIDTH = 794;
const A4_SOURCE_HEIGHT = 1123;

type SecondDriver = {
  enabled: boolean;
  firstName: string;
  lastName: string;
  birthDate: string;
  nationality: string;
  idNumber: string;
  licenseNumber: string;
  phone: string;
  address: string;
};

const emptySecondDriver: SecondDriver = {
  enabled: false,
  firstName: '',
  lastName: '',
  birthDate: '',
  nationality: '',
  idNumber: '',
  licenseNumber: '',
  phone: '',
  address: '',
};

function secondDriverValue(value: string) {
  return value.trim() || '—';
}

function serializeSecondDriverForContract(secondDriver: SecondDriver) {
  if (!secondDriver.enabled) return '';
  const rows = [
    ['Nom', secondDriver.lastName],
    ['Prénom', secondDriver.firstName],
    ['Date de naissance', secondDriver.birthDate],
    ['Nationalité', secondDriver.nationality],
    ['CIN/Passeport', secondDriver.idNumber],
    ['Permis N°', secondDriver.licenseNumber],
    ['Téléphone', secondDriver.phone],
    ['Adresse', secondDriver.address],
  ];
  return [
    '',
    '[2EME_CONDUCTEUR]',
    ...rows.map(([label, value]) => `${label}: ${secondDriverValue(value)}`),
    '[/2EME_CONDUCTEUR]',
  ].join('\n');
}

function parseSecondDriverFromContractTerms(terms: string) {
  const start = terms.indexOf('[2EME_CONDUCTEUR]');
  const end = terms.indexOf('[/2EME_CONDUCTEUR]');
  if (start < 0 || end < 0 || end <= start) {
    return { cleanTerms: terms, secondDriver: emptySecondDriver };
  }

  const block = terms.slice(start + '[2EME_CONDUCTEUR]'.length, end);
  const cleanTerms = `${terms.slice(0, start)}${terms.slice(end + '[/2EME_CONDUCTEUR]'.length)}`.trim();
  const values = new Map<string, string>();
  const labelPattern = /(Nom|Prénom|Prenom|Date de naissance|Nationalité|Nationalite|CIN\/Passeport|Permis N°|Permis N|Téléphone|Telephone|Adresse)\s*:/gi;
  const matches = Array.from(block.matchAll(labelPattern));
  matches.forEach((match, index) => {
    const label = String(match[1] || '').trim().toLowerCase();
    const valueStart = (match.index || 0) + match[0].length;
    const nextStart = matches[index + 1]?.index ?? block.length;
    const value = block.slice(valueStart, nextStart).replace(/\s+/g, ' ').trim();
    values.set(label, value === '—' ? '' : value);
  });

  return {
    cleanTerms,
    secondDriver: {
      enabled: true,
      lastName: values.get('nom') || '',
      firstName: values.get('prénom') || values.get('prenom') || '',
      birthDate: values.get('date de naissance') || '',
      nationality: values.get('nationalité') || values.get('nationalite') || '',
      idNumber: values.get('cin/passeport') || '',
      licenseNumber: values.get('permis n°') || values.get('permis n') || '',
      phone: values.get('téléphone') || values.get('telephone') || '',
      address: values.get('adresse') || '',
    },
  };
}

type LooseRecord = Record<string, unknown>;

function readString(source: unknown, keys: string[]) {
  if (!source || typeof source !== 'object') return '';
  const record = source as LooseRecord;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function readNumber(source: unknown, keys: string[]) {
  if (!source || typeof source !== 'object') return undefined;
  const record = source as LooseRecord;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return undefined;
}

function splitClientName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return {
    firstName: parts.slice(1).join(' '),
    lastName: parts[0],
  };
}

function createPdfCaptureSource(source: HTMLElement, logoDataUrl?: string | null) {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${A4_SOURCE_WIDTH}px`;
  host.style.background = '#ffffff';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  host.style.fontSynthesis = 'none';

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.style.width = `${A4_SOURCE_WIDTH}px`;
  clone.style.minHeight = '0';
  clone.style.height = 'auto';
  clone.style.transform = 'none';
  clone.style.transformOrigin = 'top left';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  clone.style.margin = '0';
  clone.style.background = '#ffffff';
  clone.style.setProperty('-webkit-font-smoothing', 'antialiased');

  if (logoDataUrl) {
    const logoImages = clone.querySelectorAll<HTMLImageElement>('img[data-pdf-logo="agency"]');
    logoImages.forEach((logoImage) => {
      logoImage.src = logoDataUrl;
      logoImage.removeAttribute('crossorigin');
      logoImage.decoding = 'sync';
    });
  }

  host.appendChild(clone);
  document.body.appendChild(host);
  return {
    element: clone,
    cleanup: () => host.remove(),
  };
}

export default function ContractsPage() {
  const [searchParams] = useSearchParams();
  const { clients, vehicles, reservations, contracts, payments, createContract, deleteContract } = useData();
  const { agencyId, profile } = useAuth();
  const { notify } = useApp();

  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const [template, setTemplate] = useState(templates[0]);
  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [reservationSearch, setReservationSearch] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState('Tous');
  const [archivePreviewContract, setArchivePreviewContract] = useState<Contract | null>(null);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [deletingContract, setDeletingContract] = useState(false);
  const [pendingArchiveDownloadId, setPendingArchiveDownloadId] = useState<string | null>(null);
  const [terms, setTerms] = useState(defaultTerms.join('\n'));
  const [secondDriver, setSecondDriver] = useState<SecondDriver>(emptySecondDriver);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [, setIsMobilePreview] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewMaxHeight, setPreviewMaxHeight] = useState(560);
  const [logoBroken, setLogoBroken] = useState(false);

  const [agencyMeta, setAgencyMeta] = useState<{
    address?: string;
    phone?: string;
    email?: string;
    logo_path?: string;
    logo_url?: string;
    ice?: string;
    rc?: string;
    settings?: Record<string, unknown> | null;
  }>({});
  const [logoPublicUrl, setLogoPublicUrl] = useState<string | null>(null);

  useEffect(() => {
    const fromReservation = searchParams.get('reservation');
    if (fromReservation && reservations.some((item) => item.id === fromReservation)) {
      setReservationId(fromReservation);
    }
  }, [reservations, searchParams]);

  const selectedReservation = useMemo(
    () => reservations.find((item) => item.id === reservationId),
    [reservationId, reservations],
  );

  useEffect(() => {
    const updatePreviewScale = () => {
      const viewport = previewViewportRef.current;
      if (!viewport) return;
      const isMobile = window.innerWidth < 768;
      setIsMobilePreview(isMobile);
      const nextMaxHeight = Math.max(isMobile ? 520 : 620, window.innerHeight - 260);
      setPreviewMaxHeight(nextMaxHeight);
      const availableWidth = Math.max(240, viewport.clientWidth - (isMobile ? 28 : 56));
      const widthScale = availableWidth / A4_SOURCE_WIDTH;
      const minScale = isMobile ? 0.34 : 0.42;
      const maxScale = isMobile ? 0.68 : 0.74;
      setPreviewScale(Math.max(minScale, Math.min(maxScale, widthScale)));
    };

    updatePreviewScale();
    window.addEventListener('resize', updatePreviewScale);
    return () => window.removeEventListener('resize', updatePreviewScale);
  }, [selectedReservation]);

  function fitPreviewToStudio() {
    const viewport = previewViewportRef.current;
    if (!viewport) return;
    const isMobile = window.innerWidth < 768;
    const nextMaxHeight = Math.max(isMobile ? 520 : 620, window.innerHeight - 260);
    const availableWidth = Math.max(240, viewport.clientWidth - (isMobile ? 28 : 56));
    const widthScale = availableWidth / A4_SOURCE_WIDTH;
    const minScale = isMobile ? 0.34 : 0.42;
    const maxScale = isMobile ? 0.68 : 0.74;
    setPreviewMaxHeight(nextMaxHeight);
    setPreviewScale(Math.max(minScale, Math.min(maxScale, widthScale)));
  }

  function nudgePreviewScale(delta: number) {
    setPreviewScale((current) => Math.max(0.34, Math.min(0.82, Number((current + delta).toFixed(2)))));
  }

  useEffect(() => {
    if (!selectedReservation) return;
    setArchivePreviewContract(null);
    setClientId(selectedReservation.clientId);
    setVehicleId(selectedReservation.vehicleId);
  }, [selectedReservation]);

  useEffect(() => {
    async function loadAgencyMeta() {
      if (!agencyId || !supabase) {
        setLogoPublicUrl(null);
        return;
      }
      const { data } = await supabase
        .from('agencies')
        .select('address,phone,email,logo_path,logo_url,ice,rc,settings')
        .eq('id', agencyId)
        .maybeSingle();
      if (!data) return;
      setAgencyMeta(data);
      if (data.logo_path) {
        const candidateBuckets = ['logos', 'agency-assets'];
        let resolvedLogo: string | null = null;
        for (const bucket of candidateBuckets) {
          const signed = await supabase.storage.from(bucket).createSignedUrl(data.logo_path, 60 * 60);
          if (!signed.error && signed.data?.signedUrl) {
            resolvedLogo = signed.data.signedUrl;
            break;
          }
        }
        setLogoPublicUrl(resolvedLogo || (data as { logo_url?: string | null }).logo_url || null);
      } else if ((data as { logo_url?: string | null }).logo_url) {
        setLogoPublicUrl((data as { logo_url?: string | null }).logo_url || null);
      } else {
        setLogoPublicUrl(null);
      }
    }
    loadAgencyMeta();
  }, [agencyId]);

  const emptyClient: Client = {
    id: '',
    fullName: '',
    phone: '',
    email: '',
    cin: '',
    license: '',
    address: '',
    totalRentals: 0,
    totalSpent: 0,
    status: 'New',
  };

  const emptyVehicle: Vehicle = {
    id: '',
    brand: '',
    model: '',
    plate: '',
    year: 0,
    mileage: 0,
    fuel: '',
    transmission: '',
    dailyPrice: 0,
    status: 'Unavailable',
    insuranceExpiry: '',
    inspectionDate: '',
    city: '',
    revenue: 0,
  };

  const matchedClientByReservation = useMemo(() => {
    if (!selectedReservation?.client) return undefined;
    const reservationClient = normalizeLoose(selectedReservation.client);
    return clients.find((item) => {
      const fullName = normalizeLoose(item.fullName);
      return fullName === reservationClient || fullName.includes(reservationClient) || reservationClient.includes(fullName);
    });
  }, [clients, selectedReservation?.client]);

  const matchedVehicleByReservation = useMemo(() => {
    if (!selectedReservation?.vehicle) return undefined;
    const reservationVehicle = selectedReservation.vehicle.trim().toLowerCase();
    return vehicles.find((item) => `${item.brand} ${item.model}`.trim().toLowerCase() === reservationVehicle);
  }, [selectedReservation?.vehicle, vehicles]);

  const client = useMemo(() => {
    const resolved =
      clients.find((item) => item.id === clientId) ||
      clients.find((item) => item.id === selectedReservation?.clientId) ||
      matchedClientByReservation ||
      null;

    if (resolved) return resolved;

    if (selectedReservation?.client?.trim()) {
      return {
        ...emptyClient,
        fullName: selectedReservation.client.trim(),
      };
    }

    return emptyClient;
  }, [clientId, clients, matchedClientByReservation, selectedReservation?.clientId]);

  useEffect(() => {
    if (!selectedReservation || clientId) return;
    if (selectedReservation.clientId && clients.some((item) => item.id === selectedReservation.clientId)) {
      setClientId(selectedReservation.clientId);
      return;
    }
    if (!selectedReservation.client?.trim()) return;
    const reservationClient = normalizeLoose(selectedReservation.client);
    const matched = clients.find((item) => {
      const fullName = normalizeLoose(item.fullName);
      return fullName === reservationClient || fullName.includes(reservationClient) || reservationClient.includes(fullName);
    });
    if (matched) setClientId(matched.id);
  }, [clientId, clients, selectedReservation]);

  const vehicle = useMemo(() => {
    return (
      vehicles.find((item) => item.id === vehicleId) ||
      vehicles.find((item) => item.id === selectedReservation?.vehicleId) ||
      matchedVehicleByReservation ||
      emptyVehicle
    );
  }, [matchedVehicleByReservation, selectedReservation?.vehicleId, vehicleId, vehicles]);

  const effectiveClientId = client.id || selectedReservation?.clientId || '';
  const effectiveVehicleId = vehicle.id || selectedReservation?.vehicleId || '';

  const pickupDate = selectedReservation?.pickupDate || archivePreviewContract?.pickupDate || '';
  const returnDate = selectedReservation?.returnDate || archivePreviewContract?.returnDate || '';
  const pickupTime = selectedReservation?.pickupTime || '';
  const returnTime = selectedReservation?.returnTime || '';
  const rentalDays = getDiffDays(pickupDate, returnDate);
  const totalAmount = selectedReservation?.totalAmount || archivePreviewContract?.totalAmount || vehicle.dailyPrice * rentalDays;
  const deposit = selectedReservation?.deposit ?? 0;
  const damageMarks = vehicle.damageMarks || [];
  const hasPreviewSource = Boolean(selectedReservation || archivePreviewContract);

  const contractReference = useMemo(() => {
    return archivePreviewContract?.contractNumber || selectedReservation?.id || `CONTRAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  }, [archivePreviewContract?.contractNumber, selectedReservation?.id]);

  const stats = useMemo(() => {
    return {
      total: contracts.length,
      drafts: contracts.filter((item) => item.status === 'Draft').length,
      last: contracts[0]?.contractNumber || 'Aucun',
      readyReservations: reservations.filter((item) => item.status === 'Confirmed' || item.status === 'Active').length,
    };
  }, [contracts, reservations]);

  const effectiveLogoUrl = logoPublicUrl || agencyMeta.logo_url || null;

  const selectedReservationPaymentSummary = useMemo(() => (
    selectedReservation ? getReservationPaymentSummary(selectedReservation, payments) : null
  ), [payments, selectedReservation]);
  const selectedReservationPayments = selectedReservationPaymentSummary?.relatedPayments || [];
  const paidAmount = selectedReservationPaymentSummary?.paid || 0;

  const clientNameParts = useMemo(() => splitClientName(client.fullName || selectedReservation?.client || ''), [client.fullName, selectedReservation?.client]);

  const contractPdfData = useMemo<ContractPdfData>(() => {
    const agencySource = agencyMeta as LooseRecord;
    const agencySettings = (agencyMeta.settings || {}) as LooseRecord;
    const clientSource = client as unknown as LooseRecord;
    const vehicleSource = vehicle as unknown as LooseRecord;
    const reservationSource = selectedReservation as unknown as LooseRecord | undefined;
    const paidFromReservation = readNumber(reservationSource, ['paidAmount', 'paid_amount', 'amountPaid', 'amount_paid']);
    const effectivePaidAmount = paidAmount || paidFromReservation || 0;
    const effectiveDeposit =
      readNumber(reservationSource, ['deposit', 'depositAmount', 'deposit_amount', 'caution']) ??
      deposit;
    const damageSummary = damageMarks
      .map((mark) => [mark.zone, mark.type, mark.note].filter(Boolean).join(' · '))
      .join(' | ');

    return {
      agency: {
        name: profile?.agency?.name || 'MekLoc Agency',
        address: agencyMeta.address || '',
        phone: agencyMeta.phone || profile?.phone || '',
        email: agencyMeta.email || profile?.email || '',
        logoUrl: effectiveLogoUrl,
        rc: agencyMeta.rc || '',
        ifNumber: readString(agencySource, ['if', 'if_number', 'fiscal_id', 'tax_id']) || readString(agencySettings, ['if', 'if_number', 'fiscal_id', 'tax_id']),
        ice: agencyMeta.ice || '',
        cnss: readString(agencySource, ['cnss', 'cnss_number']) || readString(agencySettings, ['cnss', 'cnss_number']),
      },
      reservation: {
        pickupDate: formatDateFr(pickupDate),
        pickupTime,
        returnDate: formatDateFr(returnDate),
        returnTime,
        rentalDays,
        pickupLocation: selectedReservation?.pickupLocation || selectedReservation?.city || '',
        returnLocation: selectedReservation?.returnLocation || selectedReservation?.city || '',
        agentName: profile?.fullName || profile?.email || '',
      },
      client: {
        fullName: client.fullName || selectedReservation?.client || '',
        firstName: readString(clientSource, ['firstName', 'first_name']) || clientNameParts.firstName,
        lastName: readString(clientSource, ['lastName', 'last_name']) || clientNameParts.lastName,
        birthDate: readString(clientSource, ['birthDate', 'birth_date', 'dateOfBirth', 'date_of_birth']),
        nationality: readString(clientSource, ['nationality', 'nationalite']),
        address: client.address || '',
        phone: client.phone || '',
        email: client.email || '',
        idNumber: client.cin || '',
        licenseNumber: client.license || '',
        licenseIssuedAt: readString(clientSource, ['licenseIssuedAt', 'license_issued_at', 'licenseIssueDate', 'license_issue_date']),
        licenseExpiresAt: readString(clientSource, ['licenseExpiresAt', 'license_expires_at', 'licenseExpiryDate', 'license_expiry_date']),
      },
      secondDriver,
      vehicle: {
        brand: vehicle.brand || selectedReservation?.vehicle || '',
        model: vehicle.model || '',
        plate: vehicle.plate || '',
        mileageOut: selectedReservation?.mileageOut ?? (vehicle.mileage || ''),
        mileageReturn: readString(reservationSource, ['mileageReturn', 'mileage_return', 'mileageIn', 'mileage_in']),
        fuelLevel: selectedReservation?.fuelLevelOut || readString(vehicleSource, ['fuelLevel', 'fuel_level']) || vehicle.fuel,
        insuranceAllRisk: null,
        franchise: readNumber(reservationSource, ['franchise']) ?? readNumber(vehicleSource, ['franchise']),
        observations: selectedReservation?.notes || '',
        damageObservations: damageSummary,
        papers: {
          registrationCard: Boolean(vehicle.accessories?.documents_vehicule),
          technicalInspection: Boolean(vehicle.inspectionDate),
          insurance: Boolean(vehicle.insuranceExpiry),
          vignette: false,
          circulationAuthorization: false,
        },
      },
      payment: {
        totalAmount,
        paidAmount: effectivePaidAmount,
        remainingAmount: Math.max(0, (totalAmount || 0) - effectivePaidAmount),
        deposit: effectiveDeposit,
        method: selectedReservationPayments[0]?.method || readString(reservationSource, ['paymentMethod', 'payment_method', 'method']),
      },
      contract: {
        reference: contractReference,
        date: new Date().toLocaleDateString('fr-MA'),
      },
    };
  }, [
    agencyMeta,
    client,
    clientNameParts.firstName,
    clientNameParts.lastName,
    contractReference,
    damageMarks,
    deposit,
    effectiveLogoUrl,
    paidAmount,
    pickupDate,
    pickupTime,
    profile?.agency?.name,
    profile?.email,
    profile?.fullName,
    profile?.phone,
    rentalDays,
    returnDate,
    returnTime,
    secondDriver,
    selectedReservation,
    selectedReservationPayments,
    totalAmount,
    vehicle,
  ]);

  useEffect(() => {
    setLogoBroken(false);
  }, [effectiveLogoUrl]);

  const checklist = [
    { label: 'Client sélectionné', ok: Boolean(client.id) },
    { label: 'Véhicule sélectionné', ok: Boolean(vehicle.id) },
    { label: 'Réservation sélectionnée', ok: Boolean(selectedReservation?.id) },
    { label: 'Logo agence présent', ok: Boolean(effectiveLogoUrl && !logoBroken) },
  ];

  const contractFileName = `contract-location-${sanitizeFileName(client.fullName || 'client')}-${sanitizeFileName(vehicle.plate || 'vehicule')}-${new Date().toISOString().slice(0, 10)}.pdf`;

  function getMissingContractFields(mode: 'preview' | 'generate') {
    const missing: string[] = [];
    const hasClientData = Boolean(client.fullName?.trim() || selectedReservation?.client?.trim());
    const hasVehicleData = Boolean(vehicle.brand?.trim() || vehicle.model?.trim() || selectedReservation?.vehicle?.trim());

    if (mode === 'preview' && !hasPreviewSource) missing.push('réservation ou contrat archivé');
    if (mode === 'generate' && !selectedReservation?.id) missing.push('réservation source');
    if (mode === 'generate' ? !effectiveClientId && !hasClientData : !hasClientData) missing.push('nom du client');
    if (!client.phone?.trim()) missing.push('téléphone du client');
    if (mode === 'generate' ? !effectiveVehicleId && !hasVehicleData : !hasVehicleData) missing.push('véhicule');
    if (!vehicle.plate?.trim()) missing.push('immatriculation du véhicule');
    if (!pickupDate) missing.push('date de départ');
    if (!returnDate) missing.push('date de retour');
    if (!totalAmount || totalAmount <= 0) missing.push('montant total');
    if (!profile?.agency?.name?.trim()) missing.push('nom de l’agence');

    return missing;
  }

  function ensureRequiredData(mode: 'preview' | 'generate' = 'preview') {
    const missing = getMissingContractFields(mode);
    if (missing.length) {
      notify({
        title: 'Données à compléter',
        message: `Champs manquants: ${missing.join(', ')}. Corrigez ces informations avant de générer le PDF.`,
        type: 'warning',
      });
      return false;
    }
    return true;
  }

  async function waitForImagesToLoad(container: HTMLElement) {
    const images = Array.from(container.querySelectorAll('img'));
    if (!images.length) return;
    await Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete && image.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            image.addEventListener('load', done, { once: true });
            image.addEventListener('error', done, { once: true });
            if ('decode' in image) {
              image.decode().then(done).catch(done);
            }
          }),
      ),
    );
  }

  async function captureContractPages(source: HTMLElement) {
    let logoAsset: PdfLogoAsset | null = null;
    if (effectiveLogoUrl && !logoBroken) {
      logoAsset = await loadLogoForPdf(effectiveLogoUrl);
    }

    const captureSource = createPdfCaptureSource(source, logoAsset?.dataUrl);
    try {
      await waitForImagesToLoad(captureSource.element);
      await document.fonts?.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const pages = Array.from(captureSource.element.querySelectorAll<HTMLElement>('.contract-pdf-page'));
      const captureTargets = pages.length ? pages : [captureSource.element];
      const scale = Math.min(Math.max(window.devicePixelRatio || 3, 3), 4);
      const canvases: HTMLCanvasElement[] = [];

      for (const page of captureTargets) {
        page.style.margin = '0';
        page.style.boxShadow = 'none';
        page.style.borderRadius = '0';
        canvases.push(await html2canvas(page, {
          width: A4_SOURCE_WIDTH,
          height: A4_SOURCE_HEIGHT,
          windowWidth: A4_SOURCE_WIDTH,
          windowHeight: A4_SOURCE_HEIGHT,
          scale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
        }));
      }

      return canvases;
    } finally {
      captureSource.cleanup();
    }
  }

  async function downloadContractPreview() {
    if (!ensureRequiredData('preview')) return;
    if (!previewRef.current) {
      notify({ title: 'Téléchargement impossible', message: 'Aperçu du contrat introuvable.', type: 'warning' });
      return;
    }
    try {
      setDownloadingPdf(true);
      const canvases = await captureContractPages(previewRef.current);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      canvases.forEach((canvas, index) => {
        if (index > 0) pdf.addPage();
        const imageData = canvas.toDataURL('image/png');
        pdf.addImage(imageData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'NONE');
      });

      pdf.save(contractFileName);
      notify({ title: 'Téléchargement lancé', message: 'Le contrat PDF a été généré.', type: 'success' });
    } catch (error) {
      notify({
        title: 'Téléchargement impossible',
        message: error instanceof Error ? error.message : 'Réessayez.',
        type: 'warning',
      });
    } finally {
      setDownloadingPdf(false);
    }
  }

  useEffect(() => {
    if (searchParams.get('download') === '1' && reservationId && client.id && vehicle.id) {
      downloadContractPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, reservationId, client.id, vehicle.id]);

  async function handleGenerateContract() {
    if (!ensureRequiredData('generate')) return;

    try {
      setGenerating(true);
      const cleanTerms = terms.trim() || defaultTerms.join('\n');
      const secondDriverTerms = serializeSecondDriverForContract(secondDriver);
      await createContract({
        id: `ctr-${Date.now()}`,
        contractNumber: `CTR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        client: client.fullName,
        clientId: effectiveClientId,
        vehicle: `${vehicle.brand} ${vehicle.model}`,
        vehicleId: effectiveVehicleId,
        template,
        pickupDate,
        returnDate,
        totalAmount,
        terms: `${cleanTerms}${secondDriverTerms}`,
        status: 'Draft',
      });
      notify({ title: 'Contrat généré', message: 'Le contrat a été enregistré dans la base de données.', type: 'success' });
    } catch (error) {
      notify({
        title: 'Contrat non généré',
        message: error instanceof Error ? error.message : 'Réessayez dans quelques instants.',
        type: 'warning',
      });
    } finally {
      setGenerating(false);
    }
  }

  const contractWhatsAppUrl = buildWhatsAppReminderUrl({
    kind: 'contract',
    phone: client.phone,
    clientName: client.fullName,
    vehicle: `${vehicle.brand} ${vehicle.model}`,
    date: pickupDate,
  });

  const previewStatus = contracts[0]?.status || 'Draft';
  const notificationPreferences = getNotificationPreferences(profile?.agency?.settings);
  const activeStep = hasPreviewSource ? (secondDriver.enabled ? 3 : 2) : 1;
  const filteredReservations = useMemo(() => {
    const query = reservationSearch.trim().toLowerCase();
    if (!query) return reservations;
    return reservations.filter((item) =>
      `${item.id} ${item.client} ${item.vehicle} ${item.status}`.toLowerCase().includes(query)
    );
  }, [reservationSearch, reservations]);

  const archiveFilters = ['Tous', 'Brouillon', 'Généré', 'Envoyé', 'Signé', 'Annulé'];
  const filteredContracts = useMemo(() => {
    const query = archiveSearch.trim().toLowerCase();
    return contracts.filter((contract) => {
      const label = normalizeArchiveStatus(contract.status);
      const matchesStatus = archiveStatusFilter === 'Tous' || label === archiveStatusFilter;
      const matchesQuery = !query || `${contract.contractNumber} ${contract.client} ${contract.vehicle} ${contract.template}`.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [archiveSearch, archiveStatusFilter, contracts]);

  function getArchiveClient(contract: Contract) {
    return clients.find((item) => item.id === contract.clientId);
  }

  function getArchiveWhatsappUrl(contract: Contract) {
    const archiveClient = getArchiveClient(contract);
    const phone = archiveClient?.phone?.replace(/\D/g, '');
    if (!phone) return '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(`Bonjour, voici votre contrat de location MekLoc: ${contract.contractNumber}.`)}`;
  }

  function resumeSavedContract(contractId: string) {
    const contract = contracts.find((item) => item.id === contractId);
    if (!contract) return;
    setArchivePreviewContract(contract);
    setClientId(contract.clientId);
    setVehicleId(contract.vehicleId);
    setTemplate(contract.template);
    const parsedContractTerms = parseSecondDriverFromContractTerms(contract.terms || defaultTerms.join('\n'));
    setTerms(parsedContractTerms.cleanTerms || defaultTerms.join('\n'));
    setSecondDriver(parsedContractTerms.secondDriver);
    const matchingReservation = reservations.find((item) =>
      item.clientId === contract.clientId &&
      item.vehicleId === contract.vehicleId &&
      item.pickupDate === contract.pickupDate &&
      item.returnDate === contract.returnDate
    );
    if (matchingReservation) {
      setReservationId(matchingReservation.id);
    } else {
      setReservationId('');
    }
    notify({
      title: 'Contrat chargé',
      message: matchingReservation
        ? 'Le contrat sauvegardé a été rechargé dans le générateur.'
        : 'Le contrat archivé est chargé dans l’aperçu.',
      type: 'success',
    });
  }

  function downloadSavedContract(contractId: string) {
    resumeSavedContract(contractId);
    setPendingArchiveDownloadId(contractId);
  }

  useEffect(() => {
    if (!pendingArchiveDownloadId || archivePreviewContract?.id !== pendingArchiveDownloadId) return;
    const timer = window.setTimeout(() => {
      downloadContractPreview().finally(() => setPendingArchiveDownloadId(null));
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivePreviewContract, pendingArchiveDownloadId, client.id, vehicle.id]);

  async function confirmDeleteContract() {
    if (!contractToDelete) return;
    try {
      setDeletingContract(true);
      await deleteContract(contractToDelete.id);
      if (archivePreviewContract?.id === contractToDelete.id) {
        setArchivePreviewContract(null);
        setReservationId('');
      }
      notify({ title: 'Contrat supprimé', message: 'Le contrat a été retiré des archives.', type: 'success' });
      setContractToDelete(null);
    } catch (error) {
      notify({
        title: 'Suppression impossible',
        message: error instanceof Error ? error.message : 'Réessayez dans quelques instants.',
        type: 'warning',
      });
    } finally {
      setDeletingContract(false);
    }
  }

  return (
    <div className="relative overflow-x-hidden pb-[calc(108px+env(safe-area-inset-bottom))] md:pb-28">
      <div className="pointer-events-none absolute -right-20 top-6 h-48 w-48 rounded-full bg-gold-400/10 blur-3xl md:-right-24 md:top-10 md:h-80 md:w-80" />
      <div className="pointer-events-none absolute left-1/3 top-80 hidden h-72 w-72 rounded-full bg-gold-400/5 blur-3xl md:block" />
      <div className="relative mb-3 rounded-2xl border border-[var(--app-border)] bg-[radial-gradient(circle_at_top_right,rgba(227,177,23,.16),transparent_36%),linear-gradient(135deg,rgba(12,17,24,.96),rgba(2,3,5,.98))] p-3 shadow-[0_18px_50px_rgba(0,0,0,.26),inset_0_1px_0_rgba(255,255,255,.04)] md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">DOCUMENTS</p>
            <h1 className="mt-0.5 text-2xl font-black leading-none text-[var(--app-text)]">Contrats</h1>
            <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">Créez, vérifiez et exportez vos contrats de location.</p>
          </div>
          <Button className="h-11 shrink-0 rounded-2xl px-3 text-xs shadow-[0_14px_34px_rgba(227,177,23,.16)]" icon={<Download className="h-4 w-4" />} onClick={downloadContractPreview} loading={downloadingPdf} disabled={!hasPreviewSource}>
            PDF
          </Button>
        </div>
      </div>
      <div className="relative hidden md:block">
        <PageHeader
          eyebrow="DOCUMENTS"
          title="Contrats"
          description="Créez, vérifiez et exportez vos contrats de location."
          action={(
            <div className="hidden md:block">
              <Button className="h-11 rounded-2xl px-5 shadow-[0_14px_34px_rgba(227,177,23,.18)]" icon={<Download className="h-4 w-4" />} onClick={downloadContractPreview} loading={downloadingPdf} disabled={!hasPreviewSource}>
                {downloadingPdf ? 'Préparation...' : 'Télécharger PDF'}
              </Button>
            </div>
          )}
        />
      </div>

      <div className="no-scrollbar relative -mx-4 mb-3 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:mb-6 xl:grid-cols-4">
        {[
          { label: 'Contrats générés', value: String(stats.total), helper: 'Total enregistré', icon: FileSignature, tone: 'gold' },
          { label: 'Brouillons', value: String(stats.drafts), helper: 'En préparation', icon: PenLine, tone: 'violet' },
          { label: 'Dernier contrat', value: stats.last, helper: 'Référence récente', icon: Sparkles, tone: 'teal' },
          { label: 'Réservations prêtes', value: String(stats.readyReservations), helper: 'Confirmées ou actives', icon: CheckCircle2, tone: 'blue' },
        ].map(({ label, value, helper, icon: Icon, tone }) => (
          <div
            key={label}
            className="group relative min-h-[106px] min-w-[138px] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_18px_48px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.04)] transition duration-300 hover:-translate-y-0.5 hover:border-gold-300/30 hover:shadow-[0_28px_80px_rgba(0,0,0,.34),0_0_34px_rgba(227,177,23,.08)]  md:min-h-[96px] md:min-w-0 md:rounded-3xl md:p-4"
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 ${
              tone === 'violet'
                ? 'bg-violet-300/60'
                : tone === 'teal'
                  ? 'bg-emerald-300/60'
                  : tone === 'blue'
                    ? 'bg-sky-300/60'
                    : 'bg-gold-300/70'
            }`} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase leading-3 tracking-[0.12em] text-[var(--app-text-muted)]">{label}</p>
                <p className="mt-2 truncate text-[1.35rem] font-black leading-none text-[var(--app-text)]  md:text-2xl">{value}</p>
              </div>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border md:h-10 md:w-10 md:rounded-2xl ${
                tone === 'violet'
                  ? 'border-violet-300/20 bg-violet-400/10 text-violet-700 dark:text-violet-200'
                  : tone === 'teal'
                    ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200'
                    : tone === 'blue'
                      ? 'border-sky-300/20 bg-sky-400/10 text-sky-700 dark:text-sky-200'
                      : 'border-gold-300/25 bg-gold-400/12 text-[var(--app-gold-text)]'
              } shadow-[0_0_24px_rgba(227,177,23,.08)]`}>
                <Icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
              </span>
            </div>
            <p className="mt-2 truncate text-[11px] text-[var(--app-text-muted)] md:text-xs">{helper}</p>
          </div>
        ))}
      </div>

      <div className="relative mb-3 max-w-full overflow-x-auto rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] md:mb-6 md:p-2">
        <div className="flex min-w-max items-center gap-2 lg:min-w-0 lg:justify-between">
          {['Réservation', 'Données', '2ème conducteur', 'Aperçu', 'Export'].map((label, index) => {
            const step = index + 1;
            const isActive = activeStep === step;
            const isDone = activeStep > step;
            return (
              <div key={label} className={`relative shrink-0 rounded-xl border px-2 py-2 transition duration-300 md:rounded-2xl md:px-3 md:py-2.5 lg:flex-1 ${isActive ? 'border-gold-300/50 bg-gold-400/15 text-[var(--app-gold-text)] shadow-[0_0_24px_rgba(227,177,23,.10)]' : isDone ? 'border-emerald-400/20 bg-emerald-400/5 text-[var(--app-text-soft)]' : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-muted)]'}`}>
                <div className="flex items-center gap-2 md:gap-2.5">
                  <span className={`grid h-7 w-7 place-items-center rounded-full border text-[11px] font-black transition md:h-8 md:w-8 md:text-xs ${isActive ? 'border-gold-300 bg-gold-400 text-[#101820]' : isDone ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-700 dark:text-emerald-200' : 'border-[var(--app-border)] bg-[var(--app-surface-soft)]'}`}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : step}
                  </span>
                  <div>
                    <p className="whitespace-nowrap text-[11px] font-black sm:text-sm">{label}</p>
                    <p className="hidden whitespace-nowrap text-[10px] opacity-70 sm:block">{step === 1 ? 'Sélectionnez' : step === 5 ? 'Génération' : step === 3 ? 'Optionnel' : 'Vérification'}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative grid gap-3 md:gap-5 xl:grid-cols-[320px_minmax(420px,1fr)] 2xl:grid-cols-[320px_minmax(420px,1fr)_minmax(440px,0.85fr)]">
        <Card className="border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_24px_80px_rgba(0,0,0,.30),inset_0_1px_0_rgba(255,255,255,.04)] md:p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]">
          <div className="mb-3 flex items-center justify-between gap-3 md:mb-4">
            <div>
              <h2 className="font-black text-[var(--app-text)] ">Réservations validées</h2>
              <p className="text-xs text-[var(--app-text-muted)]">{filteredReservations.length} réservation{filteredReservations.length > 1 ? 's' : ''}</p>
            </div>
            <Badge>{reservations.length}</Badge>
          </div>
          <label className="relative mb-3 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
            <input
              className="form-control h-11 rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] pl-10 text-sm"
              placeholder="Rechercher une réservation..."
              value={reservationSearch}
              onChange={(event) => setReservationSearch(event.target.value)}
            />
          </label>
          <div className="space-y-2.5 overflow-y-auto pr-1 md:space-y-3 xl:max-h-[calc(100vh-15rem)]">
            {filteredReservations.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--app-border)] p-4 text-sm text-[var(--app-text-muted)]">Aucune réservation trouvée.</p>
            ) : filteredReservations.map((item) => {
              const selected = item.id === reservationId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReservationId(item.id)}
                  className={`group w-full rounded-2xl border p-3 text-left transition duration-300 md:rounded-3xl md:p-4 ${selected ? 'border-gold-300/60 bg-[linear-gradient(135deg,rgba(227,177,23,.14),rgba(255,255,255,.035))] shadow-[0_0_34px_rgba(212,160,23,.14)]' : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] hover:-translate-y-0.5 hover:border-gold-300/25 hover:bg-[var(--app-surface-soft)]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base font-black text-[var(--app-text)] md:text-lg">{item.id}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${selected ? 'border-emerald-300/25 bg-emerald-400/15 text-emerald-700 dark:text-emerald-200' : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]'}`}>{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-soft)]">{item.client}</p>
                  <p className="mt-1 text-sm text-[var(--app-text-muted)]">{item.vehicle}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-2.5 py-1 text-xs text-[var(--app-text-muted)] md:mt-3">
                    <CalendarDays className="h-3.5 w-3.5 text-[var(--app-gold-text)]" />
                    {formatDateFr(item.pickupDate)} → {formatDateFr(item.returnDate)}
                  </p>
                </button>
              );
            })}
          </div>
          <a href="/reservations" className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--app-text-soft)] transition hover:border-gold-300/30 hover:bg-gold-400/10 hover:text-[var(--app-gold-text)]">
            Voir toutes les réservations
          </a>
        </Card>

        <div className="space-y-3 md:space-y-4">
          <Card className="border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_24px_80px_rgba(0,0,0,.26),inset_0_1px_0_rgba(255,255,255,.04)] md:p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-[var(--app-gold-text)]">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Résumé de location</p>
                <p className="text-xs text-[var(--app-text-muted)]">Données reprises depuis la réservation.</p>
              </div>
            </div>
            {selectedReservation ? (
              <div className="grid gap-3">
                <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-input)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-[var(--app-text)]">{selectedReservation.client}</p>
                      <p className="mt-1 text-sm text-[var(--app-text-muted)]">{selectedReservation.vehicle}</p>
                    </div>
                    <Badge>{selectedReservation.status}</Badge>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm text-[var(--app-text-soft)]">{formatDateFr(pickupDate)} → {formatDateFr(returnDate)}</div>
                  <div className="rounded-2xl border border-gold-300/15 bg-gold-400/[0.06] p-3 text-sm font-semibold text-[var(--app-gold-text)]">{formatMAD(totalAmount)} · Caution {formatMAD(deposit)}</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--app-text-muted)]">Sélectionnez une réservation à gauche.</p>
            )}
          </Card>

          <Card className="border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_24px_80px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.04)] md:p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-[var(--app-gold-text)]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Préparation PDF</p>
                <p className="text-xs text-[var(--app-text-muted)]">Vérifiez les données essentielles avant l’export.</p>
              </div>
            </div>
            <div className="grid gap-2">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-input)] px-3 py-2 text-sm">
                  <span className="font-semibold text-[var(--app-text-soft)]">{item.label}</span>
                  <span className={item.ok ? 'font-black text-emerald-700 dark:text-emerald-300' : 'font-black text-amber-700 dark:text-amber-300'}>
                    {item.ok ? 'OK' : 'À compléter'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-2xl border border-gold-300/15 bg-gold-400/[0.06] px-4 py-3 text-xs text-[var(--app-text-soft)]">
              <p><span className="text-[var(--app-text-muted)]">Référence:</span> <span className="font-semibold text-[var(--app-text)]">{contractReference}</span></p>
              <p className="mt-1"><span className="text-[var(--app-text-muted)]">Date:</span> <span className="font-semibold text-[var(--app-text)]">{new Date().toLocaleDateString('fr-MA')}</span></p>
            </div>
          </Card>

          <Card className="border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_24px_80px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.04)] md:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-[var(--app-gold-text)]">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">2ème conducteur</p>
                  <p className="text-xs text-[var(--app-text-muted)]">Optionnel, affiché dans le PDF.</p>
                </div>
              </div>
              {secondDriver.enabled ? (
                <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setSecondDriver(emptySecondDriver)}>Retirer</Button>
              ) : (
                <Button type="button" className="h-8 px-3 text-xs" onClick={() => setSecondDriver((current) => ({ ...current, enabled: true }))}>Ajouter un 2ème conducteur</Button>
              )}
            </div>
            {secondDriver.enabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="form-control rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] text-base sm:text-sm" placeholder="Nom" value={secondDriver.lastName} onChange={(event) => setSecondDriver((current) => ({ ...current, lastName: event.target.value }))} />
                <input className="form-control rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] text-base sm:text-sm" placeholder="Prénom" value={secondDriver.firstName} onChange={(event) => setSecondDriver((current) => ({ ...current, firstName: event.target.value }))} />
                <input className="form-control rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] text-base sm:text-sm" placeholder="CIN / Passeport" value={secondDriver.idNumber} onChange={(event) => setSecondDriver((current) => ({ ...current, idNumber: event.target.value }))} />
                <input className="form-control rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] text-base sm:text-sm" placeholder="Permis N°" value={secondDriver.licenseNumber} onChange={(event) => setSecondDriver((current) => ({ ...current, licenseNumber: event.target.value }))} />
                <input className="form-control rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] text-base sm:text-sm" placeholder="Téléphone" value={secondDriver.phone} onChange={(event) => setSecondDriver((current) => ({ ...current, phone: event.target.value }))} />
                <input className="form-control rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] text-base sm:text-sm" placeholder="Date de naissance" value={secondDriver.birthDate} onChange={(event) => setSecondDriver((current) => ({ ...current, birthDate: event.target.value }))} />
                <input className="form-control rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] text-base sm:text-sm" placeholder="Nationalité" value={secondDriver.nationality} onChange={(event) => setSecondDriver((current) => ({ ...current, nationality: event.target.value }))} />
                <input className="form-control rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] text-base sm:text-sm" placeholder="Adresse" value={secondDriver.address} onChange={(event) => setSecondDriver((current) => ({ ...current, address: event.target.value }))} />
              </div>
            ) : (
              <p className="text-sm text-[var(--app-text-muted)]">Optionnel. Les champs vides afficheront “—” dans le contrat.</p>
            )}
          </Card>
        </div>

        <div className="min-w-0 rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-2 shadow-[0_30px_90px_rgba(0,0,0,.42),0_0_38px_rgba(227,177,23,.06)] sm:p-3 xl:col-span-2 2xl:sticky 2xl:top-24 2xl:col-span-1 2xl:self-start">
          <div className="mb-2 flex flex-col gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 text-sm text-[var(--app-text-soft)]">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/12 text-[var(--app-gold-text)] shadow-[0_0_28px_rgba(227,177,23,.10)]">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-[var(--app-text)] ">Aperçu du contrat</p>
                <p className="text-xs text-[var(--app-text-muted)]">Document final avec logo agence.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Badge>{statusLabel(previewStatus)}</Badge>
              <div className="flex shrink-0 items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-input)] p-1">
                <button type="button" className="grid h-8 w-8 place-items-center rounded-xl text-[var(--app-text-soft)] transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]" onClick={() => nudgePreviewScale(-0.08)} aria-label="Zoom arrière">
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-xl text-[var(--app-text-soft)] transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]" onClick={() => nudgePreviewScale(0.08)} aria-label="Zoom avant">
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button type="button" className="h-8 rounded-xl px-3 text-xs font-semibold text-[var(--app-text-soft)] transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]" onClick={fitPreviewToStudio}>
                  Fit
                </button>
              </div>
              <Button className="h-9 shrink-0 rounded-2xl px-3 text-xs" icon={<Download className="h-4 w-4" />} onClick={downloadContractPreview} loading={downloadingPdf} disabled={!hasPreviewSource}>
                Télécharger
              </Button>
            </div>
          </div>

          {!hasPreviewSource ? (
            <div className="grid min-h-[520px] place-items-center rounded-3xl border border-dashed border-[var(--app-border)] bg-[radial-gradient(circle_at_top,rgba(212,160,23,.12),transparent_34%),linear-gradient(135deg,#111722,#06090d)] p-6 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-gold-300/25 bg-gold-400/12 text-[var(--app-gold-text)] shadow-[0_0_34px_rgba(227,177,23,.14)]">
                  <FileSignature className="h-7 w-7" />
                </div>
                <h3 className="mt-5 text-lg font-black text-[var(--app-text)]">Sélectionnez une réservation</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
                  Sélectionnez une réservation pour générer un contrat.
                </p>
              </div>
            </div>
          ) : (
            <div
              ref={previewViewportRef}
              className="max-h-[calc(100vh-260px)] overflow-auto rounded-3xl bg-[radial-gradient(circle_at_top,rgba(212,160,23,.12),transparent_30%),linear-gradient(135deg,#111722,#070b10)] p-5 sm:p-6"
              style={{ maxHeight: `${previewMaxHeight}px` }}
            >
            <div
              className="relative mx-auto"
              style={{
                width: A4_SOURCE_WIDTH * previewScale,
                height: ((A4_SOURCE_HEIGHT * 2) + 18) * previewScale,
              }}
            >
              <div
                ref={previewRef}
                className="absolute left-0 top-0 origin-top-left"
                style={{ transform: `scale(${previewScale})` }}
              >
                <ContractPdfTemplate
                  data={contractPdfData}
                  logoBroken={logoBroken}
                  onLogoError={() => setLogoBroken(true)}
                />
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-3xl border border-gold-300/15 bg-[linear-gradient(135deg,rgba(227,177,23,.10),rgba(255,255,255,.035),rgba(0,0,0,.20))] p-3 shadow-[0_20px_70px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.04)] md:mt-5 md:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/12 text-[var(--app-gold-text)]">
              <CircleAlert className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-[var(--app-text)]">Bon à savoir</p>
              <p className="mt-1 text-sm leading-6 text-[var(--app-text-soft)]">Vérifiez soigneusement toutes les informations avant de générer le contrat.</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--app-text-soft)] sm:flex">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            PDF prêt après validation
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_20px_70px_rgba(0,0,0,.26),inset_0_1px_0_rgba(255,255,255,.04)] md:mt-5 md:grid-cols-3 md:gap-3 md:p-4">
        <Button type="button" className="h-11 md:h-12" icon={<FileSignature className="h-4 w-4" />} onClick={handleGenerateContract} loading={generating} disabled={!selectedReservation}>
          Générer contrat
        </Button>
        <Button type="button" variant="secondary" className="h-11 md:h-12" icon={<Download className="h-4 w-4" />} onClick={downloadContractPreview} loading={downloadingPdf} disabled={!hasPreviewSource}>
          Télécharger PDF
        </Button>
        {!notificationPreferences.contractSending ? (
          <Button type="button" variant="secondary" className="h-11 md:h-12" disabled>
            WhatsApp désactivé
          </Button>
        ) : contractWhatsAppUrl ? (
          <a href={contractWhatsAppUrl} target="_blank" rel="noreferrer" className="block">
            <Button type="button" variant="secondary" className="h-11 w-full md:h-12" icon={<MessageCircle className="h-4 w-4" />}>
              Envoyer WhatsApp
            </Button>
          </a>
        ) : (
          <Button type="button" variant="secondary" className="h-11 md:h-12" disabled>
            Téléphone manquant
          </Button>
        )}
      </div>

      <Card className="mt-4 border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[0_20px_70px_rgba(0,0,0,.24)] md:mt-6 md:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between md:mb-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Archives</p>
            <h2 className="mt-1 text-lg font-black text-[var(--app-text)]  md:text-xl">Archives des contrats</h2>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">Retrouvez, téléchargez ou renvoyez vos anciens contrats générés.</p>
          </div>
          <Badge>{contracts.length} contrat{contracts.length > 1 ? 's' : ''}</Badge>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
            <input
              className="form-control h-11 pl-10 text-sm"
              placeholder="Rechercher par client, véhicule, référence…"
              value={archiveSearch}
              onChange={(event) => setArchiveSearch(event.target.value)}
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {archiveFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setArchiveStatusFilter(filter)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition ${
                  archiveStatusFilter === filter
                    ? 'border-gold-300/50 bg-gold-400/15 text-[var(--app-gold-text)]'
                    : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] hover:border-gold-300/25 hover:text-[var(--app-text)]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {contracts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] p-6 text-center">
            <p className="text-sm text-[var(--app-text-muted)]">Aucun contrat enregistré pour le moment.</p>
            <Button type="button" className="mt-4" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Créer un contrat
            </Button>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] p-6 text-sm text-[var(--app-text-muted)]">
            Aucun contrat ne correspond à votre recherche.
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredContracts.map((contract) => {
              const archiveWhatsappUrl = getArchiveWhatsappUrl(contract);
              return (
              <div key={contract.id} className="grid gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 transition hover:border-yellow-500/20 md:p-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-black text-[var(--app-text)] ">{contract.contractNumber}</p>
                    <Badge>{statusLabel(contract.status)}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-[var(--app-text-muted)]">{contract.client || 'Client non renseigné'} · {contract.vehicle || 'Véhicule non renseigné'}</p>
                  <p className="mt-1 text-xs text-[var(--app-text-muted)]">Créé le {formatDateFr(contract.pickupDate)}</p>
                </div>
                <div className="grid gap-1 text-sm text-[var(--app-text-soft)] sm:grid-cols-3 lg:grid-cols-1">
                  <p>{formatDateFr(contract.pickupDate)} → {formatDateFr(contract.returnDate)}</p>
                  <p className="font-semibold text-[var(--app-gold-text)]">{formatMAD(contract.totalAmount || 0)}</p>
                  <p className="text-[var(--app-text-muted)]">{contract.template}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button type="button" variant="secondary" className="h-9 px-3 text-xs" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => resumeSavedContract(contract.id)}>
                    Aperçu
                  </Button>
                  <Button type="button" variant="secondary" className="h-9 px-3 text-xs" icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadSavedContract(contract.id)} loading={pendingArchiveDownloadId === contract.id}>
                    PDF
                  </Button>
                  {archiveWhatsappUrl ? (
                    <a href={archiveWhatsappUrl} target="_blank" rel="noreferrer">
                      <Button type="button" variant="secondary" className="h-9 px-3 text-xs" icon={<MessageCircle className="h-3.5 w-3.5" />}>
                        WhatsApp
                      </Button>
                    </a>
                  ) : (
                    <Button type="button" variant="secondary" className="h-9 px-3 text-xs" disabled title="Téléphone manquant">
                      Téléphone manquant
                    </Button>
                  )}
                  <Button type="button" variant="danger" className="h-9 px-3 text-xs" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setContractToDelete(contract)}>
                    Supprimer
                  </Button>
                </div>
              </div>
            );})}
          </div>
        )}
      </Card>

      <Modal open={Boolean(contractToDelete)} title="Supprimer ce contrat ?" onClose={() => setContractToDelete(null)}>
        <div className="space-y-5">
          <p className="text-sm leading-6 text-[var(--app-text-soft)]">
            Cette action retirera le contrat de vos archives. Assurez-vous d’avoir téléchargé une copie si nécessaire.
          </p>
          {contractToDelete ? (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <p className="font-black text-[var(--app-text)]">{contractToDelete.contractNumber}</p>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">{contractToDelete.client} · {contractToDelete.vehicle}</p>
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setContractToDelete(null)}>
              Annuler
            </Button>
            <Button type="button" variant="danger" icon={<Trash2 className="h-4 w-4" />} loading={deletingContract} onClick={confirmDeleteContract}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
