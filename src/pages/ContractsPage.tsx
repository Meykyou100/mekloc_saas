import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Download,
  FileSignature,
  FileText,
  Landmark,
  PenLine,
  RefreshCcw,
  Sparkles,
  UserRound,
  Wand2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { SelectField, TextAreaField } from '../components/ui/Form';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatMAD, type Client, type Vehicle } from '../data/mockData';
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
  bytes: Uint8Array;
  width: number;
  height: number;
};

async function loadLogoForPdf(logoUrl: string): Promise<PdfLogoAsset | null> {
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
        const base64 = dataUrl.split(',')[1] || '';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        resolve({
          bytes,
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

export default function ContractsPage() {
  const [searchParams] = useSearchParams();
  const { clients, vehicles, reservations, contracts, createContract } = useData();
  const { agencyId, profile } = useAuth();
  const { notify } = useApp();

  const [template, setTemplate] = useState(templates[0]);
  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [terms, setTerms] = useState(defaultTerms.join('\n'));
  const [generating, setGenerating] = useState(false);

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
      if (!agencyId || !supabase) return;
      const { data } = await supabase
        .from('agencies')
        .select('address,phone,email,logo_path,logo_url,ice,rc')
        .eq('id', agencyId)
        .maybeSingle();
      if (!data) return;
      setAgencyMeta(data);
      if ((data as { logo_url?: string | null }).logo_url) {
        setLogoPublicUrl((data as { logo_url?: string | null }).logo_url || null);
      } else if (data.logo_path) {
        const signed = await supabase.storage.from('logos').createSignedUrl(data.logo_path, 60 * 60);
        if (!signed.error && signed.data?.signedUrl) {
          setLogoPublicUrl(signed.data.signedUrl);
        } else {
          const { data: logoData } = supabase.storage.from('logos').getPublicUrl(data.logo_path);
          setLogoPublicUrl(logoData.publicUrl || null);
        }
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
    const reservationClient = selectedReservation.client.trim().toLowerCase();
    return clients.find((item) => item.fullName.trim().toLowerCase() === reservationClient);
  }, [clients, selectedReservation?.client]);

  const matchedVehicleByReservation = useMemo(() => {
    if (!selectedReservation?.vehicle) return undefined;
    const reservationVehicle = selectedReservation.vehicle.trim().toLowerCase();
    return vehicles.find((item) => `${item.brand} ${item.model}`.trim().toLowerCase() === reservationVehicle);
  }, [selectedReservation?.vehicle, vehicles]);

  const client = useMemo(() => {
    return (
      clients.find((item) => item.id === clientId) ||
      clients.find((item) => item.id === selectedReservation?.clientId) ||
      matchedClientByReservation ||
      emptyClient
    );
  }, [clientId, clients, matchedClientByReservation, selectedReservation?.clientId]);

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

  const checklist = [
    { label: 'Client sélectionné', ok: Boolean(client.id) },
    { label: 'Véhicule sélectionné', ok: Boolean(vehicle.id) },
    { label: 'Réservation sélectionnée', ok: Boolean(selectedReservation?.id) },
    { label: 'Conditions ajoutées', ok: Boolean(terms.trim()) },
    { label: 'Logo agence présent', ok: Boolean(logoPublicUrl) },
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

  async function downloadContractPreview() {
    if (!ensureRequiredData('preview')) return;

    const logoAsset = logoPublicUrl ? await loadLogoForPdf(logoPublicUrl) : null;

    const termsList = terms.trim() ? terms.trim().split('\n').filter(Boolean) : defaultTerms;
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 24;
    const sectionGap = 6;
    const boxPad = 6;
    const contentWidth = pageWidth - margin * 2;
    const gold = '0.82 0.54 0.18 rg';
    const muted = '0.35 0.40 0.47 rg';
    const dark = '0.12 0.15 0.2 rg';

    const pages: string[][] = [[]];
    let pageIndex = 0;
    let y = pageHeight - margin;

    const addRaw = (command: string) => pages[pageIndex].push(command);
    const newPage = () => {
      pages.push([]);
      pageIndex += 1;
      y = pageHeight - margin;
    };
    const ensureSpace = (height: number) => {
      if (y - height < margin) newPage();
    };
    const addText = (text: string, x: number, yPos: number, size = 9.5, color = dark, bold = false) => {
      addRaw(`q ${color}`);
      addRaw(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${yPos.toFixed(2)} Tm ${escapePdfWinAnsi(text)} Tj ET`);
      addRaw('Q');
    };
    const wrapText = (text: string, maxChars: number) => {
      const words = text.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let current = '';
      words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars) {
          if (current) lines.push(current);
          current = word;
        } else {
          current = next;
        }
      });
      if (current) lines.push(current);
      return lines.length ? lines : [''];
    };
    const addRule = () => {
      addRaw('q 0.90 0.92 0.95 RG 0.8 w');
      addRaw(`${margin} ${y} m ${pageWidth - margin} ${y} l S`);
      addRaw('Q');
    };
    const addSection = (title: string, rows: [string, string][]) => {
      const titleHeight = 12;
      const rowHeight = 10;
      const boxHeight = boxPad * 2 + titleHeight + rows.length * rowHeight + 4;
      ensureSpace(boxHeight + sectionGap);
      y -= boxHeight;
      addRaw('q 0.82 0.54 0.18 RG 1 w');
      addRaw(`${margin} ${y} ${contentWidth} ${boxHeight} re S`);
      addRaw('Q');
      addText(title, margin + boxPad, y + boxHeight - 14, 8.5, gold, true);
      let rowY = y + boxHeight - 24;
      rows.forEach(([label, value]) => {
        addText(label, margin + boxPad, rowY, 8, muted, false);
        addText(value || 'Non renseigné', margin + boxPad + 145, rowY, 8, dark, true);
        rowY -= rowHeight;
      });
      y -= sectionGap;
    };

    // Header
    ensureSpace(78);
    const logoX = margin;
    const logoY = y - 38;
    const logoW = 36;
    const logoH = 36;
    addRaw('q 0.92 0.93 0.95 RG 0.8 w');
    addRaw(`${logoX} ${logoY} ${logoW} ${logoH} re S`);
    addRaw('Q');
    if (!logoAsset) {
      addText('M', logoX + 13, logoY + 12, 16, '0.55 0.58 0.64 rg', true);
    }
    addText(profile?.agency?.name || 'MekLoc Agency', margin, y - 4, 12, dark, true);
    addText(`Adresse: ${agencyMeta.address || 'Non renseigné'}`, margin, y - 16, 8, muted);
    addText(`Tél: ${agencyMeta.phone || profile?.phone || 'Non renseigné'} · Email: ${agencyMeta.email || profile?.email || 'Non renseigné'}`, margin, y - 28, 8, muted);
    addText('CONTRAT DE LOCATION', margin, y - 46, 13, dark, true);
    addText(`Référence: ${contractReference}`, margin, y - 60, 8.5, muted, true);
    addText(`Date: ${new Date().toLocaleDateString('fr-MA')}`, pageWidth - margin - 105, y - 60, 8.5, muted, true);
    y -= 72;
    addRule();
    y -= 8;

    addSection('Informations de l’agence', [
      ['Nom agence', profile?.agency?.name || 'Non renseigné'],
      ['Adresse', agencyMeta.address || 'Non renseigné'],
      ['Téléphone', agencyMeta.phone || profile?.phone || 'Non renseigné'],
      ['Email', agencyMeta.email || profile?.email || 'Non renseigné'],
      ['ICE / RC', `${agencyMeta.ice || 'Non renseigné'} / ${agencyMeta.rc || 'Non renseigné'}`],
    ]);

    addSection('Informations du client', [
      ['Nom complet', client.fullName || 'Non renseigné'],
      ['Téléphone', client.phone || 'Non renseigné'],
      ['Email', client.email || 'Non renseigné'],
      ['CIN/Passport', client.cin || 'Non renseigné'],
      ['Numéro de permis', client.license || 'Non renseigné'],
      ['Adresse', client.address || 'Non renseigné'],
    ]);

    addSection('2ème conducteur', [
      ['Nom', '—'],
      ['Prénom', '—'],
      ['CIN/Passport', '—'],
      ['Téléphone', '—'],
    ]);

    addSection('Informations du véhicule', [
      ['Marque + modèle', `${vehicle.brand || 'Non renseigné'} ${vehicle.model || ''}`.trim()],
      ['Immatriculation', vehicle.plate || 'Non renseigné'],
      ['Couleur', vehicle.vehicleColor || 'Non renseigné'],
      ['Année', String(vehicle.year || 'Non renseigné')],
      ['Carburant', vehicle.fuel || 'Non renseigné'],
      ['Transmission', vehicle.transmission || 'Non renseigné'],
      ['Kilométrage départ', String(selectedReservation?.mileageOut ?? 'Non renseigné')],
      ['Kilométrage retour', 'Non renseigné'],
    ]);

    // Accessoires
    const accessoryPresent = Object.entries(accessoryLabels)
      .filter(([key]) => accessories[key as keyof typeof accessories])
      .map(([, label]) => label)
      .join(', ');
    const accessoryMissing = Object.entries(accessoryLabels)
      .filter(([key]) => !accessories[key as keyof typeof accessories])
      .map(([, label]) => label)
      .join(', ');
    addSection('Accessoires véhicule', [
      ['Présents', accessoryPresent || 'Aucun'],
      ['Manquants', accessoryMissing || 'Aucun'],
    ]);

    addSection('Départ / Retour', [
      ['Date de départ', formatDateFr(pickupDate)],
      ['Date de retour', formatDateFr(returnDate)],
      ['Retour réel', '—'],
      ['Heure départ', '—'],
      ['Heure retour', '—'],
      ['Lieu départ', selectedReservation?.pickupLocation || 'Non renseigné'],
      ['Lieu retour', selectedReservation?.returnLocation || 'Non renseigné'],
    ]);

    addSection('Montants', [
      ['Nombre de jours', String(rentalDays)],
      ['Prix journalier', formatMAD(vehicle.dailyPrice || 0)],
      ['Montant total', formatMAD(totalAmount || 0)],
      ['Caution', formatMAD(deposit || 0)],
      ['Franchise assurance', '—'],
      ['Mode de règlement', '—'],
      ['Payé par', client.fullName || 'Non renseigné'],
      ['Statut paiement', selectedReservation?.status || 'Non renseigné'],
    ]);

    // Conditions
    const conditionLines: string[] = [];
    termsList.forEach((item, index) => {
      wrapText(`${index + 1}. ${item}`, 95).forEach((line) => conditionLines.push(line));
    });
    const trimmedConditionLines = conditionLines.slice(0, 7);
    const conditionsHeight = Math.max(58, boxPad * 2 + 12 + trimmedConditionLines.length * 9 + 4);
    ensureSpace(conditionsHeight + sectionGap);
    y -= conditionsHeight;
    addRaw('q 0.82 0.54 0.18 RG 1 w');
    addRaw(`${margin} ${y} ${contentWidth} ${conditionsHeight} re S`);
    addRaw('Q');
    addText('Conditions générales', margin + boxPad, y + conditionsHeight - 14, 8.5, gold, true);
    let conditionY = y + conditionsHeight - 22;
    trimmedConditionLines.forEach((line) => {
      addText(line, margin + boxPad, conditionY, 7.7, dark);
      conditionY -= 9;
    });
    y -= sectionGap;

    // Schéma dommages
    const damageHeight = 96;
    ensureSpace(damageHeight + sectionGap);
    y -= damageHeight;
    addRaw('q 0.93 0.94 0.97 RG 1 w');
    addRaw(`${margin} ${y} ${contentWidth} ${damageHeight} re S`);
    addRaw('Q');
    addText('Schéma des dommages', margin + boxPad, y + damageHeight - 14, 8.5, gold, true);
    // top-view car
    addRaw('q 0.20 0.24 0.31 RG 1 w');
    addRaw('286 162 20 48 re S');
    addRaw('278 170 36 34 re S');
    addRaw('286 186 20 1 re S');
    addRaw('272 172 6 10 re S');
    addRaw('314 172 6 10 re S');
    addRaw('272 192 6 10 re S');
    addRaw('314 192 6 10 re S');
    addRaw('Q');
    if (damageMarks.length === 0) {
      addText('Aucun dommage signalé au départ.', 340, 188, 9, muted);
    } else {
      damageMarks.forEach((mark) => {
        const pos = zoneCoords[mark.zone] || { x: 296, y: 188 };
        addText(damageTypeLabels[mark.type] || 'A', pos.x, pos.y, 10, '0.86 0.18 0.18 rg', true);
      });
      const notes = damageMarks
        .map((mark) => `${mark.zone}: ${damageTypeLabels[mark.type] || 'A'}${mark.note ? ` (${mark.note})` : ''}`)
        .slice(0, 5);
      let noteY = 196;
      notes.forEach((note) => {
        addText(note, 340, noteY, 7.5, muted);
        noteY -= 8;
      });
    }
    addText('Légende: R Rayure | C Cassure | E Éclat | B Bosse | P Peinture | A Autre', margin + boxPad, y + 8, 7.2, muted);
    y -= sectionGap;

    // Signatures
    const signHeight = 54;
    ensureSpace(signHeight + 32);
    y -= signHeight;
    const signWidth = (contentWidth - 10) / 2;
    addRaw('q 0.82 0.54 0.18 RG 1 w');
    addRaw(`${margin} ${y} ${signWidth} ${signHeight} re S`);
    addRaw(`${margin + signWidth + 10} ${y} ${signWidth} ${signHeight} re S`);
    addRaw('Q');
    addText('Signature agence', margin + 12, y + 10, 8.5, dark, true);
    addText('Signature client', margin + signWidth + 22, y + 10, 8.5, dark, true);
    y -= 20;
    addText(`Fait à ${signatureCity}, le ${new Date().toLocaleDateString('fr-MA')}`, margin, y + 8, 8.2, muted);
    y -= 10;
    addRule();
    y -= 16;

    // Footer per-page
    pages.forEach((commands, idx) => {
      const footerY = 28;
      commands.push(`q ${gold}`);
      commands.push(`BT /F2 9 Tf 1 0 0 1 ${margin.toFixed(2)} ${footerY.toFixed(2)} Tm ${escapePdfWinAnsi('Document généré par MekLoc')} Tj ET`);
      commands.push('Q');
      commands.push(`q ${muted}`);
      commands.push(`BT /F1 9 Tf 1 0 0 1 ${(pageWidth / 2 - 40).toFixed(2)} ${footerY.toFixed(2)} Tm ${escapePdfWinAnsi(contractReference)} Tj ET`);
      commands.push(`BT /F1 9 Tf 1 0 0 1 ${(pageWidth - margin - 55).toFixed(2)} ${footerY.toFixed(2)} Tm ${escapePdfWinAnsi(`Page ${idx + 1}/${pages.length}`)} Tj ET`);
      commands.push('Q');
    });

    // Assemble PDF
    const CATALOG_ID = 1;
    const PAGES_ID = 2;
    const FONT_REGULAR_ID = 3;
    const FONT_BOLD_ID = 4;

    let nextId = 5;
    const LOGO_IMAGE_ID = logoAsset ? nextId++ : null;
    const contentIds = pages.map(() => nextId++);
    const pageObjectIds = pages.map(() => nextId++);
    const maxId = nextId - 1;
    const objects = new Array<string>(maxId + 1);

    objects[CATALOG_ID] = `${CATALOG_ID} 0 obj\n<< /Type /Catalog /Pages ${PAGES_ID} 0 R >>\nendobj`;
    objects[PAGES_ID] = `${PAGES_ID} 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>\nendobj`;
    objects[FONT_REGULAR_ID] = `${FONT_REGULAR_ID} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`;
    objects[FONT_BOLD_ID] = `${FONT_BOLD_ID} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`;
    if (logoAsset && LOGO_IMAGE_ID) {
      objects[LOGO_IMAGE_ID] =
        `${LOGO_IMAGE_ID} 0 obj\n` +
        `<< /Type /XObject /Subtype /Image /Width ${logoAsset.width} /Height ${logoAsset.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoAsset.bytes.length} >>\n` +
        `stream\n${Array.from(logoAsset.bytes, (b) => String.fromCharCode(b)).join('')}\nendstream\nendobj`;
    }

    pages.forEach((commands, index) => {
      if (index === 0 && logoAsset && LOGO_IMAGE_ID) {
        const imgW = 36;
        const imgH = 36;
        const imgX = margin;
        const imgY = pageHeight - margin - 38;
        commands.unshift('Q');
        commands.unshift('/ImLogo Do');
        commands.unshift(`${imgW} 0 0 ${imgH} ${imgX} ${imgY} cm`);
        commands.unshift('q');
      }
      const stream = commands.join('\n');
      const contentId = contentIds[index];
      const pageId = pageObjectIds[index];
      objects[contentId] = `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`;
      const xObjectRef = logoAsset && LOGO_IMAGE_ID ? ` /XObject << /ImLogo ${LOGO_IMAGE_ID} 0 R >>` : '';
      objects[pageId] =
        `${pageId} 0 obj\n` +
        `<< /Type /Page /Parent ${PAGES_ID} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
        `/Resources << /Font << /F1 ${FONT_REGULAR_ID} 0 R /F2 ${FONT_BOLD_ID} 0 R >>${xObjectRef} >> ` +
        `/Contents ${contentId} 0 R >>\nendobj`;
    });

    let pdfBody = '%PDF-1.7\n';
    const offsets: number[] = new Array(maxId + 1).fill(0);
    for (let id = 1; id <= maxId; id += 1) {
      offsets[id] = pdfBody.length;
      pdfBody += `${objects[id]}\n`;
    }
    const xrefStart = pdfBody.length;
    pdfBody += `xref\n0 ${maxId + 1}\n`;
    pdfBody += '0000000000 65535 f \n';
    for (let id = 1; id <= maxId; id += 1) {
      pdfBody += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    pdfBody += `trailer\n<< /Size ${maxId + 1} /Root ${CATALOG_ID} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const blob = new Blob([pdfBody], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = contractFileName;
    a.click();
    URL.revokeObjectURL(url);
    notify({ title: 'Téléchargement lancé', message: 'Le contrat PDF a été généré.', type: 'success' });
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

  const previewStatus = contracts[0]?.status || 'Draft';

  return (
    <div>
      <PageHeader
        eyebrow="Documents"
        title="Contrats"
        description="Créez des contrats de location professionnels avec vos données agence, client et véhicule."
        action={<Button icon={<Download className="h-4 w-4" />} onClick={downloadContractPreview}>Télécharger PDF</Button>}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contrats générés" value={String(stats.total)} trend="Historique total" icon={FileSignature} />
        <StatCard label="Brouillons" value={String(stats.drafts)} trend="En préparation" icon={FileText} />
        <StatCard label="Contrats ce mois" value={String(stats.thisMonth)} trend="Période actuelle" icon={CalendarDays} />
        <StatCard label="Dernier contrat" value={stats.last} trend="Référence récente" icon={Sparkles} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.74fr_1.26fr]">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-gold-400/10 p-3 text-gold-200">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white light:text-carbon-950">Éditeur de contrat</h2>
              <p className="text-sm text-carbon-400">Configurez les données puis générez un contrat prêt à signer.</p>
            </div>
          </div>

          <div className="grid gap-5">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-wide text-gold-200">Modèle</p>
              <SelectField label="Type de modèle" value={template} onChange={(event) => setTemplate(event.target.value)}>
                {templates.map((item) => <option key={item}>{item}</option>)}
              </SelectField>
              <p className="mt-2 text-xs text-carbon-500">Langue: Français · Format: A4 portrait</p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-wide text-gold-200">Sélection client / véhicule</p>
              <div className="grid gap-4">
                <SelectField label="Client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                  {clients.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
                </SelectField>
                <SelectField label="Véhicule" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
                  {vehicles.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model}</option>)}
                </SelectField>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-wide text-gold-200">Réservation source</p>
              <SelectField label="Réservation" value={reservationId} onChange={(event) => setReservationId(event.target.value)}>
                {reservations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {item.client} · {item.pickupDate} → {item.returnDate}
                  </option>
                ))}
              </SelectField>
              <p className="mt-2 text-xs text-carbon-500">Le contrat reprend automatiquement les dates, lieux et tarifs.</p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-wide text-gold-200">Conditions générales</p>
              <TextAreaField
                label="Texte des conditions"
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                className="min-h-36"
              />
              <p className="mt-2 text-xs text-carbon-500">Laissez ce texte clair et précis. Il sera inclus dans le PDF final.</p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-wide text-gold-200">Checklist de complétude</p>
              <div className="grid gap-2">
                {checklist.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm">
                    <span className="text-carbon-200">{item.label}</span>
                    {item.ok ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> OK</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-200"><CircleAlert className="h-4 w-4" /> À vérifier</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
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

        <div className="rounded-3xl border border-white/10 bg-[#090d13] p-4 shadow-[0_24px_80px_rgba(0,0,0,.45)]">
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-carbon-300">
              <FileText className="h-4 w-4 text-gold-200" />
              Aperçu A4 prêt à imprimer
            </div>
            <Badge>{statusLabel(previewStatus)}</Badge>
          </div>

          <div className="max-h-[78vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6">
            <article className="mx-auto w-full max-w-[794px] min-h-[1123px] rounded-xl border border-[#e8e8e8] bg-white p-6 text-[#1c2330] shadow-[0_16px_40px_rgba(15,23,42,.12)] sm:p-8">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8edf4] pb-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-[#e6ebf2] bg-[#f8fafc]">
                    {logoPublicUrl ? (
                      <img src={logoPublicUrl} alt="Logo agence" className="h-full w-full object-contain" />
                    ) : (
                      <Building2 className="h-7 w-7 text-[#9aa3b2]" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-bold">{profile?.agency?.name || 'MekLoc Agency'}</p>
                    <p className="text-sm text-[#5e697a]">{agencyMeta.address || 'Adresse non renseignée'}</p>
                    <p className="text-sm text-[#5e697a]">{agencyMeta.phone || profile?.phone || 'Téléphone non renseigné'} · {agencyMeta.email || profile?.email || 'Email non renseigné'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#a58b3f]">Contrat</p>
                  <h1 className="mt-1 text-xl font-black">CONTRAT DE LOCATION DE VÉHICULE</h1>
                  <p className="mt-1 text-sm text-[#5e697a]">Réf: {contractReference}</p>
                  <p className="text-sm text-[#5e697a]">Date: {new Date().toLocaleDateString('fr-MA')}</p>
                </div>
              </header>

              <section className="mt-5 grid gap-4 md:grid-cols-2">
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

              <section className="mt-4 rounded-xl border p-4" style={{ borderColor: contractBorder }}>
                <p className="text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: contractBorder }}>2ème conducteur</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm text-[#334155]">
                  <p>Nom: —</p><p>Prénom: —</p>
                  <p>Date de naissance: —</p><p>Nationalité: —</p>
                  <p>CIN/Passport: —</p><p>Permis N°: —</p>
                  <p>Adresse: —</p><p>Téléphone: —</p>
                </div>
              </section>

              <section className="mt-4 grid gap-4 md:grid-cols-2">
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
                    ['Heure départ', '—'],
                    ['Heure retour', '—'],
                    ['Lieu départ', selectedReservation?.pickupLocation || 'Non renseigné'],
                    ['Lieu retour', selectedReservation?.returnLocation || 'Non renseigné'],
                  ]}
                />
              </section>

              <section className="mt-4 rounded-xl border p-4" style={{ borderColor: contractBorder }}>
                <p className="text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: contractBorder }}>Montants</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm text-[#334155]">
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

              <section className="mt-5 rounded-xl border border-[#e8edf4] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6b7280]">Conditions générales</p>
                <div className="mt-2 space-y-2 text-sm leading-6 text-[#2f3a4b]">
                  {(terms.trim() ? terms.split('\n').filter(Boolean) : defaultTerms).map((item, index) => (
                    <p key={`${item}-${index}`}>{index + 1}. {item}</p>
                  ))}
                </div>
              </section>

              <section className="mt-4 rounded-xl border border-[#e8edf4] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6b7280]">Accessoires véhicule</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Object.entries(accessoryLabels).map(([key, label]) => (
                    <p key={key} className="text-sm text-[#334155]">
                      {accessories[key as keyof typeof accessories] ? '☑' : '☐'} {label}
                    </p>
                  ))}
                </div>
              </section>

              <section className="mt-4 rounded-xl border border-[#e8edf4] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6b7280]">Schéma des dommages</p>
                <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                  <svg viewBox="0 0 120 220" className="h-52 w-full max-w-[180px] rounded-lg border border-[#dbe3ee] bg-[#f8fafc]">
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
                  <div className="space-y-2 text-sm text-[#334155]">
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

              <section className="mt-5 grid gap-4 md:grid-cols-2">
                <SignatureBox title="Signature agence" />
                <SignatureBox title="Signature client" />
              </section>

              <section className="mt-4 rounded-xl border border-[#e8edf4] p-4 text-sm text-[#3f4b5d]">
                Fait à {signatureCity}, le {new Date().toLocaleDateString('fr-MA')}
              </section>

              <footer className="mt-6 border-t border-[#e8edf4] pt-3 text-xs text-[#778396]">
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
    <div className="rounded-xl border p-4" style={{ borderColor: contractBorder }}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: contractBorder }}>{title}</p>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <p key={`${label}-${value}`} className="flex justify-between gap-3 text-sm text-[#334155]">
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
    <div className="rounded-xl border border-dashed border-[#cfd7e3] p-4">
      <PenLine className="mb-12 h-5 w-5 text-[#94a3b8]" />
      <p className="text-sm font-semibold text-[#334155]">{title}</p>
    </div>
  );
}
