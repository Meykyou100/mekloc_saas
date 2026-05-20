import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Download,
  FileSignature,
  FileText,
  Landmark,
  MessageCircle,
  PenLine,
  RefreshCcw,
  Sparkles,
  UserRound,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { SelectField, TextAreaField } from '../components/ui/Form';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatMAD, type Client, type Vehicle } from '../data/mockData';
import { buildWhatsAppReminderUrl } from '../lib/assistantDuJour';
import { getNotificationPreferences } from '../lib/notificationPreferences';
import { supabase } from '../lib/supabase';

const templates = ['Standard location', 'Véhicule premium', 'Compte entreprise'];

const defaultTerms = [
  'Le locataire reconnaît avoir reçu le véhicule en bon état de fonctionnement.',
  'Le locataire s’engage à restituer le véhicule dans le même état.',
  'Toute infraction, amende ou dommage reste à la charge du locataire.',
  "Le véhicule ne doit pas être utilisé hors des conditions autorisées par l’agence.",
  'Le retard de restitution peut entraîner des frais supplémentaires.',
];

const contractBorder = '#d08a2f';

const accessoryLabels: Record<string, string> = {
  roue_secours: 'Roue de secours',
  cric: 'Cric',
  poste_radio: 'Poste radio',
  batterie: 'Batterie',
  allume_cigare: 'Allume cigare',
  siege_enfant: 'Siège enfant',
  porte_bagage: 'Porte bagage',
  triangle: 'Triangle',
  gilet: 'Gilet',
  documents_vehicule: 'Documents véhicule',
};

const damageTypeLabels: Record<string, string> = {
  rayure: 'R',
  cassure: 'C',
  eclat: 'E',
  bosse: 'B',
  peinture: 'P',
  autre: 'A',
};

const zoneCoords: Record<string, { x: number; y: number }> = {
  avant: { x: 296, y: 228 },
  arriere: { x: 296, y: 148 },
  capot: { x: 296, y: 214 },
  coffre: { x: 296, y: 162 },
  porte_gauche: { x: 270, y: 188 },
  porte_droite: { x: 322, y: 188 },
  aile_gauche: { x: 257, y: 204 },
  aile_droite: { x: 335, y: 204 },
  parechoc_avant: { x: 296, y: 236 },
  parechoc_arriere: { x: 296, y: 140 },
};

function statusLabel(status: string) {
  if (status === 'Signed') return 'Finalisé';
  if (status === 'Downloaded') return 'Téléchargé';
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

function extractAgencyCityFromAddress(address?: string) {
  if (!address) return '';
  const cleaned = address.trim();
  if (!cleaned) return '';
  const commaParts = cleaned.split(',').map((part) => part.trim()).filter(Boolean);
  if (commaParts.length > 1) return commaParts[commaParts.length - 1];
  const dashParts = cleaned.split('-').map((part) => part.trim()).filter(Boolean);
  if (dashParts.length > 1) return dashParts[dashParts.length - 1];
  return cleaned;
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

function escapePdfWinAnsi(value: string) {
  const text = String(value ?? '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–|—/g, '-');

  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code === 40 || code === 41 || code === 92) {
      out += `\\${String(code).padStart(3, '0')}`;
      continue;
    }
    if (code < 32 || code > 126) {
      const byte = code <= 255 ? code : 63;
      out += `\\${byte.toString(8).padStart(3, '0')}`;
      continue;
    }
    out += text[i];
  }
  return `(${out})`;
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

function createPdfCaptureSource(source: HTMLElement, logoDataUrl?: string | null) {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${A4_SOURCE_WIDTH}px`;
  host.style.background = '#ffffff';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.style.width = `${A4_SOURCE_WIDTH}px`;
  clone.style.minHeight = `${A4_SOURCE_HEIGHT}px`;
  clone.style.height = 'auto';
  clone.style.transform = 'none';
  clone.style.transformOrigin = 'top left';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  clone.style.margin = '0';
  clone.style.background = '#ffffff';

  if (logoDataUrl) {
    const logoImage = clone.querySelector<HTMLImageElement>('img[data-pdf-logo="agency"]');
    if (logoImage) {
      logoImage.src = logoDataUrl;
      logoImage.removeAttribute('crossorigin');
    }
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
  const { clients, vehicles, reservations, contracts, createContract } = useData();
  const { agencyId, profile } = useAuth();
  const { notify } = useApp();

  const previewRef = useRef<HTMLElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const [template, setTemplate] = useState(templates[0]);
  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [terms, setTerms] = useState(defaultTerms.join('\n'));
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
  }>({});
  const [logoPublicUrl, setLogoPublicUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId && clients[0]) setClientId(clients[0].id);
    if (!vehicleId && vehicles[0]) setVehicleId(vehicles[0].id);
    if (!reservationId && reservations[0]) setReservationId(reservations[0].id);
  }, [clientId, clients, reservationId, reservations, vehicleId, vehicles]);

  useEffect(() => {
    const fromReservation = searchParams.get('reservation');
    if (fromReservation && reservations.some((item) => item.id === fromReservation)) {
      setReservationId(fromReservation);
    }
  }, [reservations, searchParams]);

  useEffect(() => {
    const updatePreviewScale = () => {
      const viewport = previewViewportRef.current;
      if (!viewport) return;
      const isMobile = window.innerWidth < 768;
      setIsMobilePreview(isMobile);
      const nextMaxHeight = Math.max(isMobile ? 460 : 620, window.innerHeight - 220);
      setPreviewMaxHeight(nextMaxHeight);
      const availableWidth = Math.max(220, viewport.clientWidth - (isMobile ? 12 : 48));
      const widthScale = availableWidth / A4_SOURCE_WIDTH;
      const heightScale = (nextMaxHeight - 36) / A4_SOURCE_HEIGHT;
      const minScale = isMobile ? 0.38 : 0.58;
      setPreviewScale(Math.max(minScale, Math.min(1, widthScale, heightScale)));
    };

    updatePreviewScale();
    window.addEventListener('resize', updatePreviewScale);
    return () => window.removeEventListener('resize', updatePreviewScale);
  }, []);

  function fitPreviewToStudio() {
    const viewport = previewViewportRef.current;
    if (!viewport) return;
    const isMobile = window.innerWidth < 768;
    const nextMaxHeight = Math.max(isMobile ? 460 : 620, window.innerHeight - 220);
    const availableWidth = Math.max(220, viewport.clientWidth - (isMobile ? 12 : 48));
    const widthScale = availableWidth / A4_SOURCE_WIDTH;
    const heightScale = (nextMaxHeight - 36) / A4_SOURCE_HEIGHT;
    const minScale = isMobile ? 0.38 : 0.58;
    setPreviewMaxHeight(nextMaxHeight);
    setPreviewScale(Math.max(minScale, Math.min(1, widthScale, heightScale)));
  }

  function nudgePreviewScale(delta: number) {
    setPreviewScale((current) => Math.max(0.38, Math.min(1.15, Number((current + delta).toFixed(2)))));
  }

  const selectedReservation = useMemo(
    () => reservations.find((item) => item.id === reservationId),
    [reservationId, reservations],
  );

  useEffect(() => {
    if (!selectedReservation) return;
    setClientId(selectedReservation.clientId);
    setVehicleId(selectedReservation.vehicleId);
  }, [selectedReservation]);

  useEffect(() => {
    async function loadAgencyMeta() {
      if (!agencyId || !supabase) {
        setLogoPublicUrl(profile?.agency?.logoUrl || null);
        return;
      }
      const { data } = await supabase
        .from('agencies')
        .select('address,phone,email,logo_path,logo_url,ice,rc')
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
        setLogoPublicUrl(resolvedLogo || (data as { logo_url?: string | null }).logo_url || profile?.agency?.logoUrl || null);
      } else if ((data as { logo_url?: string | null }).logo_url) {
        setLogoPublicUrl((data as { logo_url?: string | null }).logo_url || null);
      } else {
        setLogoPublicUrl(profile?.agency?.logoUrl || null);
      }
    }
    loadAgencyMeta();
  }, [agencyId, profile?.agency?.logoUrl]);

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

  const pickupDate = selectedReservation?.pickupDate || '';
  const returnDate = selectedReservation?.returnDate || '';
  const pickupTime = selectedReservation?.pickupTime || '';
  const returnTime = selectedReservation?.returnTime || '';
  const rentalDays = getDiffDays(pickupDate, returnDate);
  const totalAmount = selectedReservation?.totalAmount || vehicle.dailyPrice * rentalDays;
  const deposit = selectedReservation?.deposit ?? 0;
  const accessories = vehicle.accessories || {};
  const damageMarks = vehicle.damageMarks || [];

  const contractReference = useMemo(() => {
    return selectedReservation?.id || `CONTRAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  }, [selectedReservation?.id]);

  const signatureCity = useMemo(() => {
    return extractAgencyCityFromAddress(agencyMeta.address) || 'Non renseigné';
  }, [agencyMeta.address]);

  const stats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const thisMonth = contracts.filter((item) => {
      const raw = item.contractNumber.split('-').slice(-1)[0];
      if (!raw || raw.length < 4) return false;
      return true;
    }).length;
    return {
      total: contracts.length,
      drafts: contracts.filter((item) => item.status === 'Draft').length,
      thisMonth,
      last: contracts[0]?.contractNumber || 'Aucun',
    };
  }, [contracts]);

  const effectiveLogoUrl = profile?.agency?.logoUrl || logoPublicUrl || null;

  useEffect(() => {
    setLogoBroken(false);
  }, [effectiveLogoUrl]);

  const checklist = [
    { label: 'Client sélectionné', ok: Boolean(client.id) },
    { label: 'Véhicule sélectionné', ok: Boolean(vehicle.id) },
    { label: 'Réservation sélectionnée', ok: Boolean(selectedReservation?.id) },
    { label: 'Conditions ajoutées', ok: Boolean(terms.trim()) },
    { label: 'Logo agence présent', ok: Boolean(effectiveLogoUrl && !logoBroken) },
  ];

  const contractFileName = `contract-location-${sanitizeFileName(client.fullName || 'client')}-${sanitizeFileName(vehicle.plate || 'vehicule')}-${new Date().toISOString().slice(0, 10)}.pdf`;

  function ensureRequiredData(mode: 'preview' | 'generate' = 'preview') {
    const hasClientData = Boolean(client.fullName?.trim() || selectedReservation?.client?.trim());
    const hasVehicleData = Boolean(
      vehicle.brand?.trim() ||
      vehicle.model?.trim() ||
      selectedReservation?.vehicle?.trim(),
    );

    if (mode === 'generate' ? !effectiveClientId : !hasClientData) {
      notify({ title: 'Données manquantes', message: 'Veuillez sélectionner un client.', type: 'warning' });
      return false;
    }
    if (mode === 'generate' ? !effectiveVehicleId : !hasVehicleData) {
      notify({ title: 'Données manquantes', message: 'Veuillez sélectionner un véhicule.', type: 'warning' });
      return false;
    }
    if (!selectedReservation?.id) {
      notify({ title: 'Données manquantes', message: 'Veuillez sélectionner une réservation source.', type: 'warning' });
      return false;
    }
    if (!pickupDate || !returnDate) {
      notify({ title: 'Données manquantes', message: 'Veuillez choisir les dates de location.', type: 'warning' });
      return false;
    }
    if (!terms.trim()) {
      notify({ title: 'Données manquantes', message: 'Veuillez renseigner les conditions générales.', type: 'warning' });
      return false;
    }
    if (mode === 'generate' && !selectedReservation?.pickupLocation) {
      notify({ title: 'Données manquantes', message: 'Veuillez indiquer le lieu de prise en charge.', type: 'warning' });
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

  async function captureContractCanvas(source: HTMLElement) {
    let logoAsset: PdfLogoAsset | null = null;
    if (effectiveLogoUrl && !logoBroken) {
      logoAsset = await loadLogoForPdf(effectiveLogoUrl);
    }

    const captureSource = createPdfCaptureSource(source, logoAsset?.dataUrl);
    try {
      await waitForImagesToLoad(captureSource.element);
      await document.fonts?.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      return await html2canvas(captureSource.element, {
        width: A4_SOURCE_WIDTH,
        height: Math.max(A4_SOURCE_HEIGHT, captureSource.element.scrollHeight),
        windowWidth: A4_SOURCE_WIDTH,
        windowHeight: Math.max(A4_SOURCE_HEIGHT, captureSource.element.scrollHeight),
        scale: Math.min(Math.max(window.devicePixelRatio || 2, 2), 2.5),
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });
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
      const canvas = await captureContractCanvas(previewRef.current);
      const imageData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const sourcePageRatio = A4_SOURCE_HEIGHT / A4_SOURCE_WIDTH;
      const renderedRatio = canvas.height / canvas.width;

      if (renderedRatio <= sourcePageRatio + 0.025) {
        pdf.addImage(imageData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      } else {
        const imageWidth = pdfWidth;
        const imageHeight = (canvas.height * imageWidth) / canvas.width;
        let heightLeft = imageHeight;
        let position = 0;
        pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 1) {
          position = heightLeft - imageHeight;
          pdf.addPage();
          pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight, undefined, 'FAST');
          heightLeft -= pdfHeight;
        }
      }

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
        terms: terms.trim() || defaultTerms.join(' '),
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

  return (
    <div>
      <PageHeader
        eyebrow="DOCUMENTS"
        title="Contrats"
        description="Contract Studio pour préparer, prévisualiser et exporter vos contrats de location."
        action={(
          <div className="hidden md:block">
            <Button icon={<Download className="h-4 w-4" />} onClick={downloadContractPreview} loading={downloadingPdf}>
              {downloadingPdf ? 'Préparation...' : 'Télécharger PDF'}
            </Button>
          </div>
        )}
      />

      <div className="mb-3 md:hidden">
        <Button className="w-full" icon={<Download className="h-4 w-4" />} onClick={downloadContractPreview} loading={downloadingPdf}>
          {downloadingPdf ? 'Préparation du PDF...' : 'Télécharger PDF'}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Contrats', value: String(stats.total), helper: 'Total généré', icon: FileSignature },
          { label: 'Brouillons', value: String(stats.drafts), helper: 'En préparation', icon: FileText },
          { label: 'Ce mois', value: String(stats.thisMonth), helper: 'Période actuelle', icon: CalendarDays },
          { label: 'Dernier', value: stats.last, helper: 'Référence récente', icon: Sparkles },
        ].map(({ label, value, helper, icon: Icon }) => (
          <div key={label} className="min-h-[82px] rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] light:bg-white sm:min-h-[104px] sm:px-4">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-carbon-400 sm:text-xs sm:tracking-[0.14em]">{label}</p>
              <Icon className="h-3.5 w-3.5 shrink-0 text-gold-300 sm:h-4 sm:w-4" />
            </div>
            <p className="mt-1 truncate text-lg font-black text-white light:text-carbon-950 sm:mt-2 sm:text-xl">{value}</p>
            <p className="mt-1 truncate text-[10px] text-carbon-500 sm:text-xs">{helper}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
        <Card className="overflow-hidden border-white/10 bg-[#0c1118] p-0 shadow-[0_24px_70px_rgba(0,0,0,.32)] xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
          <div className="border-b border-white/10 bg-gradient-to-br from-gold-400/12 via-white/[0.055] to-white/[0.015] p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-gold-300/20 bg-gold-400/10 p-3 text-gold-200">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white light:text-carbon-950">Contract Studio</h2>
                <p className="text-sm leading-5 text-carbon-400">Assistant compact de génération.</p>
              </div>
            </div>
          </div>

          <div className="max-h-none space-y-4 overflow-y-auto p-5 xl:max-h-[calc(100vh-18rem)]">
            <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-gold-200">1. Modèle</p>
              <SelectField label="Type de modèle" value={template} onChange={(event) => setTemplate(event.target.value)}>
                {templates.map((item) => <option key={item}>{item}</option>)}
              </SelectField>
              <p className="mt-2 text-xs text-carbon-500">Langue: Français · Format: A4 portrait</p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-gold-200">2. Client & véhicule</p>
              <div className="grid gap-3">
                <SelectField label="Client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                  {clients.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
                </SelectField>
                <SelectField label="Véhicule" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
                  {vehicles.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model}</option>)}
                </SelectField>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-gold-200">3. Réservation</p>
              <SelectField label="Réservation" value={reservationId} onChange={(event) => setReservationId(event.target.value)}>
                {reservations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {item.client} · {item.pickupDate}{item.pickupTime ? ` ${item.pickupTime}` : ''} → {item.returnDate}{item.returnTime ? ` ${item.returnTime}` : ''}
                  </option>
                ))}
              </SelectField>
              <p className="mt-2 text-xs text-carbon-500">Le contrat reprend automatiquement les dates, lieux et tarifs.</p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-gold-200">4. Conditions</p>
              <TextAreaField
                label="Texte des conditions"
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                className="min-h-28"
              />
              <p className="mt-2 text-xs text-carbon-500">Laissez ce texte clair et précis. Il sera inclus dans le PDF final.</p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-gold-200">5. Génération</p>
              <div className="grid gap-2">
                {checklist.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs">
                    <span className="text-carbon-200">{item.label}</span>
                    {item.ok ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> OK</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-200"><CircleAlert className="h-3.5 w-3.5" /> À vérifier</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 border-t border-white/10 bg-carbon-950/95 p-5 backdrop-blur-xl light:bg-white/95">
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {!notificationPreferences.contractSending ? (
                <Button type="button" variant="secondary" disabled>
                  WhatsApp désactivé
                </Button>
              ) : contractWhatsAppUrl ? (
                <a href={contractWhatsAppUrl} target="_blank" rel="noreferrer" className="block">
                  <Button type="button" variant="secondary" className="w-full" icon={<MessageCircle className="h-4 w-4" />}>
                    Envoyer WhatsApp
                  </Button>
                </a>
              ) : (
                <Button type="button" variant="secondary" disabled>
                  Téléphone manquant
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => notify({ title: 'Aperçu mis à jour', message: 'Le document à droite reflète vos sélections.', type: 'info' })}>
                Aperçu
              </Button>
              <Button type="button" variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => setTerms(defaultTerms.join('\n'))}>
                Réinitialiser
              </Button>
              <Button type="button" icon={<FileSignature className="h-4 w-4" />} onClick={handleGenerateContract} loading={generating}>
                {generating ? 'Génération...' : 'Générer contrat'}
              </Button>
            </div>
          </div>
        </Card>

        <div className="min-w-0 rounded-3xl border border-white/10 bg-[#070b10] p-3 shadow-[0_24px_80px_rgba(0,0,0,.45)] sm:p-5">
          <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 text-sm text-carbon-300">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold-400/12 text-gold-200">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-white light:text-carbon-950">Studio aperçu A4</p>
                <p className="text-xs text-carbon-500">Prévisualisation centrée avec logo agence.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{statusLabel(previewStatus)}</Badge>
              <div className="flex items-center rounded-xl border border-white/10 bg-black/20 p-1">
                <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-carbon-300 hover:bg-white/10 hover:text-white" onClick={() => nudgePreviewScale(-0.08)} aria-label="Zoom arrière">
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-carbon-300 hover:bg-white/10 hover:text-white" onClick={() => nudgePreviewScale(0.08)} aria-label="Zoom avant">
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button type="button" className="h-8 rounded-lg px-3 text-xs font-semibold text-carbon-300 hover:bg-white/10 hover:text-white" onClick={fitPreviewToStudio}>
                  Fit
                </button>
              </div>
              <Button className="h-9 px-3 text-xs" icon={<Download className="h-4 w-4" />} onClick={downloadContractPreview} loading={downloadingPdf}>
                Télécharger
              </Button>
            </div>
          </div>

          <div
            ref={previewViewportRef}
            className="overflow-auto rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(212,160,23,.12),transparent_34%),#10151d] p-3 sm:p-6"
            style={{ maxHeight: `${previewMaxHeight}px` }}
          >
            <div
              className="mx-auto origin-top"
              style={{ width: A4_SOURCE_WIDTH, transform: `scale(${previewScale})`, height: A4_SOURCE_HEIGHT * previewScale }}
            >
              <article ref={previewRef} className="mx-auto w-[794px] min-h-[1123px] rounded-xl border border-[#e8e8e8] bg-white px-8 py-7 text-[#1c2330] shadow-[0_16px_40px_rgba(15,23,42,.12)]">
              <header className="flex items-start justify-between gap-5 border-b border-[#e8edf4] pb-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#dce4ef] bg-white p-1.5 shadow-sm">
                    {effectiveLogoUrl && !logoBroken ? (
                      <img
                        src={effectiveLogoUrl}
                        alt={`${profile?.agency?.name || 'Agence'} logo`}
                        crossOrigin="anonymous"
                        data-pdf-logo="agency"
                        className="h-full w-full object-contain"
                        onError={() => setLogoBroken(true)}
                      />
                    ) : (
                      <Building2 className="h-7 w-7 text-[#9aa3b2]" />
                    )}
                  </div>
                  <div className="max-w-[330px] pt-1">
                    <p className="text-lg font-black leading-tight">{profile?.agency?.name || 'MekLoc Agency'}</p>
                    <p className="mt-1 text-sm leading-5 text-[#5e697a]">{agencyMeta.address || 'Adresse non renseignée'}</p>
                    <p className="text-sm leading-5 text-[#5e697a]">{agencyMeta.phone || profile?.phone || 'Téléphone non renseigné'} · {agencyMeta.email || profile?.email || 'Email non renseigné'}</p>
                  </div>
                </div>
                <div className="max-w-[320px] text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#a58b3f]">Contrat</p>
                  <h1 className="mt-1 text-xl font-black leading-tight">CONTRAT DE LOCATION DE VÉHICULE</h1>
                  <p className="mt-1 text-sm text-[#5e697a]">Réf: {contractReference}</p>
                  <p className="text-sm text-[#5e697a]">Date: {new Date().toLocaleDateString('fr-MA')}</p>
                </div>
              </header>

              <section className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoBlock
                  icon={<Landmark className="h-4 w-4 text-[#a58b3f]" />}
                  title="Agence"
                  rows={[
                    ['Nom agence', profile?.agency?.name || 'Non renseigné'],
                    ['Adresse', agencyMeta.address || 'Non renseigné'],
                    ['Téléphone', agencyMeta.phone || profile?.phone || 'Non renseigné'],
                    ['Email', agencyMeta.email || profile?.email || 'Non renseigné'],
                    ['ICE / RC', `${agencyMeta.ice || 'Non renseigné'} / ${agencyMeta.rc || 'Non renseigné'}`],
                  ]}
                />
                <InfoBlock
                  icon={<UserRound className="h-4 w-4 text-[#a58b3f]" />}
                  title="Locataire"
                  rows={[
                    ['Nom complet', client.fullName || 'Non renseigné'],
                    ['Téléphone', client.phone || 'Non renseigné'],
                    ['Email', client.email || 'Non renseigné'],
                    ['CIN/Passport', client.cin || 'Non renseigné'],
                    ['Numéro permis', client.license || 'Non renseigné'],
                    ['Adresse', client.address || 'Non renseigné'],
                    ['Documents identité', client.idCardFrontUrl && client.idCardBackUrl ? 'Complets' : 'Manquants'],
                  ]}
                />
              </section>

              <section className="mt-3 rounded-xl border p-3.5" style={{ borderColor: contractBorder }}>
                <p className="text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: contractBorder }}>2ème conducteur</p>
                <div className="mt-2 grid gap-1.5 text-[13px] text-[#334155] md:grid-cols-2">
                  <p>Nom: —</p><p>Prénom: —</p>
                  <p>Date de naissance: —</p><p>Nationalité: —</p>
                  <p>CIN/Passport: —</p><p>Permis N°: —</p>
                  <p>Adresse: —</p><p>Téléphone: —</p>
                </div>
              </section>

              <section className="mt-3 grid gap-3 md:grid-cols-2">
                <InfoBlock
                  icon={<Building2 className="h-4 w-4 text-[#a58b3f]" />}
                  title="Véhicule"
                  rows={[
                    ['Marque + modèle', `${vehicle.brand || 'Non renseigné'} ${vehicle.model || ''}`.trim()],
                    ['Immatriculation', vehicle.plate || 'Non renseigné'],
                    ['Couleur', vehicle.vehicleColor || 'Non renseigné'],
                    ['Année', String(vehicle.year || 'Non renseigné')],
                    ['Carburant', vehicle.fuel || 'Non renseigné'],
                    ['Transmission', vehicle.transmission || 'Non renseigné'],
                    ['Kilométrage départ', String(selectedReservation?.mileageOut ?? 'Non renseigné')],
                    ['Kilométrage retour', 'Non renseigné'],
                  ]}
                />
                <InfoBlock
                  icon={<CalendarDays className="h-4 w-4 text-[#a58b3f]" />}
                  title="Départ / Retour"
                  rows={[
                    ['Date de départ', formatDateFr(pickupDate)],
                    ['Date de retour', formatDateFr(returnDate)],
                    ['Retour réel', '—'],
                    ['Heure départ', pickupTime || '—'],
                    ['Heure retour', returnTime || '—'],
                    ['Lieu départ', selectedReservation?.pickupLocation || 'Non renseigné'],
                    ['Lieu retour', selectedReservation?.returnLocation || 'Non renseigné'],
                  ]}
                />
              </section>

              <section className="mt-3 rounded-xl border p-3.5" style={{ borderColor: contractBorder }}>
                <p className="text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: contractBorder }}>Montants</p>
                <div className="mt-2 grid gap-1.5 text-[13px] text-[#334155] md:grid-cols-2">
                  <p>Nombre de jours: <span className="font-semibold">{rentalDays}</span></p>
                  <p>Prix / 24h: <span className="font-semibold">{formatMAD(vehicle.dailyPrice || 0)}</span></p>
                  <p>Prix total: <span className="font-semibold">{formatMAD(totalAmount || 0)}</span></p>
                  <p>Caution: <span className="font-semibold">{formatMAD(deposit || 0)}</span></p>
                  <p>Franchise d’assurance: <span className="font-semibold">—</span></p>
                  <p>Mode de règlement: <span className="font-semibold">—</span></p>
                  <p>Payé par: <span className="font-semibold">{client.fullName || 'Non renseigné'}</span></p>
                  <p>Statut paiement: <span className="font-semibold">{selectedReservation?.status || 'Non renseigné'}</span></p>
                </div>
              </section>

              <section className="mt-3 rounded-xl border border-[#e8edf4] p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6b7280]">Conditions générales</p>
                <div className="mt-2 space-y-1.5 text-[13px] leading-5 text-[#2f3a4b]">
                  {(terms.trim() ? terms.split('\n').filter(Boolean) : defaultTerms).map((item, index) => (
                    <p key={`${item}-${index}`}>{index + 1}. {item}</p>
                  ))}
                </div>
              </section>

              <section className="mt-3 rounded-xl border border-[#e8edf4] p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6b7280]">Accessoires véhicule</p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {Object.entries(accessoryLabels).map(([key, label]) => (
                    <p key={key} className="text-[13px] text-[#334155]">
                      {accessories[key as keyof typeof accessories] ? '☑' : '☐'} {label}
                    </p>
                  ))}
                </div>
              </section>

              <section className="mt-3 rounded-xl border border-[#e8edf4] p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6b7280]">Schéma des dommages</p>
                <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                  <svg viewBox="0 0 120 220" className="h-48 w-full max-w-[180px] rounded-lg border border-[#dbe3ee] bg-[#f8fafc]">
                    <rect x="48" y="20" width="24" height="180" rx="8" fill="#fff" stroke="#334155" strokeWidth="1.2" />
                    <rect x="40" y="48" width="40" height="124" rx="8" fill="none" stroke="#64748b" strokeWidth="1" />
                    <line x1="48" y1="108" x2="72" y2="108" stroke="#64748b" strokeWidth="1" />
                    <rect x="33" y="56" width="7" height="24" fill="none" stroke="#64748b" />
                    <rect x="80" y="56" width="7" height="24" fill="none" stroke="#64748b" />
                    <rect x="33" y="140" width="7" height="24" fill="none" stroke="#64748b" />
                    <rect x="80" y="140" width="7" height="24" fill="none" stroke="#64748b" />
                    {damageMarks.map((mark) => {
                      const coords: Record<string, { x: number; y: number }> = {
                        avant: { x: 60, y: 24 },
                        arriere: { x: 60, y: 196 },
                        capot: { x: 60, y: 42 },
                        coffre: { x: 60, y: 178 },
                        porte_gauche: { x: 45, y: 110 },
                        porte_droite: { x: 75, y: 110 },
                        aile_gauche: { x: 40, y: 62 },
                        aile_droite: { x: 80, y: 62 },
                        parechoc_avant: { x: 60, y: 16 },
                        parechoc_arriere: { x: 60, y: 204 },
                      };
                      const point = coords[mark.zone] || { x: 60, y: 110 };
                      return (
                        <text key={mark.id} x={point.x} y={point.y} textAnchor="middle" fill="#dc2626" fontSize="10" fontWeight="700">
                          {damageTypeLabels[mark.type] || 'A'}
                        </text>
                      );
                    })}
                  </svg>
                  <div className="space-y-1.5 text-[13px] text-[#334155]">
                    {damageMarks.length === 0 ? (
                      <p>Aucun dommage signalé au départ.</p>
                    ) : (
                      damageMarks.map((mark) => (
                        <p key={mark.id}>
                          {mark.zone} · {damageTypeLabels[mark.type] || 'A'} {mark.note ? `· ${mark.note}` : ''}
                        </p>
                      ))
                    )}
                    <p className="pt-2 text-xs text-[#64748b]">Légende: R=Rayure, C=Cassure, E=Éclat, B=Bosse, P=Peinture, A=Autre</p>
                  </div>
                </div>
              </section>

              <section className="mt-4 grid gap-3 md:grid-cols-2">
                <SignatureBox title="Signature agence" />
                <SignatureBox title="Signature client" />
              </section>

              <section className="mt-3 rounded-xl border border-[#e8edf4] p-3 text-sm text-[#3f4b5d]">
                Fait à {signatureCity}, le {new Date().toLocaleDateString('fr-MA')}
              </section>

              <footer className="mt-4 border-t border-[#e8edf4] pt-3 text-xs text-[#778396]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Contrat généré par MekLoc</span>
                  <span>{contractReference}</span>
                  <span>Page 1/1</span>
                </div>
              </footer>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-xl border bg-[#fffdf8] p-3.5" style={{ borderColor: contractBorder }}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: contractBorder }}>{title}</p>
      </div>
      <div className="space-y-1.5">
        {rows.map(([label, value]) => (
          <p key={`${label}-${value}`} className="flex justify-between gap-3 text-[13px] leading-5 text-[#334155]">
            <span className="text-[#64748b]">{label}</span>
            <span className="text-right font-semibold">{value || 'Non renseigné'}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function SignatureBox({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#cfd7e3] p-3.5">
      <PenLine className="mb-10 h-5 w-5 text-[#94a3b8]" />
      <p className="text-sm font-semibold text-[#334155]">{title}</p>
    </div>
  );
}
