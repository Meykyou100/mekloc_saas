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
        .select('address,phone,email,logo_path,ice,rc')
        .eq('id', agencyId)
        .maybeSingle();
      if (!data) return;
      setAgencyMeta(data);
      if (data.logo_path) {
        const { data: logoData } = supabase.storage.from('logos').getPublicUrl(data.logo_path);
        setLogoPublicUrl(logoData.publicUrl || null);
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

  const client = useMemo(() => clients.find((item) => item.id === clientId) || emptyClient, [clientId, clients]);
  const vehicle = useMemo(() => vehicles.find((item) => item.id === vehicleId) || emptyVehicle, [vehicleId, vehicles]);

  const pickupDate = selectedReservation?.pickupDate || '';
  const returnDate = selectedReservation?.returnDate || '';
  const rentalDays = getDiffDays(pickupDate, returnDate);
  const totalAmount = selectedReservation?.totalAmount || vehicle.dailyPrice * rentalDays;
  const deposit = selectedReservation?.deposit ?? 0;

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

  function ensureRequiredData(forGenerate = false) {
    if (!client.id) {
      notify({ title: 'Données manquantes', message: 'Veuillez sélectionner un client.', type: 'warning' });
      return false;
    }
    if (!vehicle.id) {
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
    if (forGenerate && !selectedReservation?.pickupLocation) {
      notify({ title: 'Données manquantes', message: 'Veuillez indiquer le lieu de prise en charge.', type: 'warning' });
      return false;
    }
    return true;
  }

  function downloadContractPreview() {
    if (!ensureRequiredData()) return;

    const termsList = terms.trim() ? terms.trim().split('\n').filter(Boolean) : defaultTerms;
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 36;
    const lineHeight = 14;
    const sectionGap = 12;
    const boxPad = 10;
    const contentWidth = pageWidth - margin * 2;
    const gold = '0.73 0.62 0.28 rg';
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
    const addText = (text: string, x: number, yPos: number, size = 11, color = dark, bold = false) => {
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
      const titleHeight = 16;
      const rowHeight = 13;
      const boxHeight = boxPad * 2 + titleHeight + rows.length * rowHeight + 8;
      ensureSpace(boxHeight + sectionGap);
      y -= boxHeight;
      addRaw('q 0.93 0.94 0.97 RG 1 w');
      addRaw(`${margin} ${y} ${contentWidth} ${boxHeight} re S`);
      addRaw('Q');
      addText(title, margin + boxPad, y + boxHeight - 18, 10, muted, true);
      let rowY = y + boxHeight - 34;
      rows.forEach(([label, value]) => {
        addText(label, margin + boxPad, rowY, 9, muted, false);
        addText(value || 'Non renseigné', margin + boxPad + 165, rowY, 9, dark, true);
        rowY -= rowHeight;
      });
      y -= sectionGap;
    };

    // Header
    ensureSpace(110);
    addText(profile?.agency?.name || 'MekLoc Agency', margin, y - 6, 16, dark, true);
    addText(`Adresse: ${agencyMeta.address || 'Non renseigné'}`, margin, y - 24, 9, muted);
    addText(`Téléphone: ${agencyMeta.phone || profile?.phone || 'Non renseigné'} · Email: ${agencyMeta.email || profile?.email || 'Non renseigné'}`, margin, y - 38, 9, muted);
    addText(`ICE/RC: ${agencyMeta.ice || 'Non renseigné'} / ${agencyMeta.rc || 'Non renseigné'}`, margin, y - 52, 9, muted);
    addText('CONTRAT DE LOCATION DE VÉHICULE', margin, y - 78, 16, dark, true);
    addText(`Référence: ${contractReference}`, margin, y - 96, 10, muted, true);
    addText(`Date: ${new Date().toLocaleDateString('fr-MA')}`, pageWidth - margin - 120, y - 96, 10, muted, true);
    y -= 112;
    addRule();
    y -= 14;

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

    addSection('Informations du véhicule', [
      ['Marque + modèle', `${vehicle.brand || 'Non renseigné'} ${vehicle.model || ''}`.trim()],
      ['Immatriculation', vehicle.plate || 'Non renseigné'],
      ['Année', String(vehicle.year || 'Non renseigné')],
      ['Carburant', vehicle.fuel || 'Non renseigné'],
      ['Transmission', vehicle.transmission || 'Non renseigné'],
      ['Kilométrage départ', String(selectedReservation?.mileageOut ?? 'Non renseigné')],
      ['Kilométrage retour', 'Non renseigné'],
    ]);

    addSection('Location', [
      ['Date de départ', formatDateFr(pickupDate)],
      ['Date de retour', formatDateFr(returnDate)],
      ['Lieu départ', selectedReservation?.pickupLocation || 'Non renseigné'],
      ['Lieu retour', selectedReservation?.returnLocation || 'Non renseigné'],
      ['Nombre de jours', String(rentalDays)],
      ['Prix journalier', formatMAD(vehicle.dailyPrice || 0)],
      ['Montant total', formatMAD(totalAmount || 0)],
      ['Caution', formatMAD(deposit || 0)],
      ['Statut paiement', selectedReservation?.status || 'Non renseigné'],
    ]);

    // Conditions
    const conditionLines: string[] = [];
    termsList.forEach((item, index) => {
      wrapText(`${index + 1}. ${item}`, 95).forEach((line) => conditionLines.push(line));
    });
    const conditionsHeight = Math.max(90, boxPad * 2 + 16 + conditionLines.length * 12 + 6);
    ensureSpace(conditionsHeight + sectionGap);
    y -= conditionsHeight;
    addRaw('q 0.93 0.94 0.97 RG 1 w');
    addRaw(`${margin} ${y} ${contentWidth} ${conditionsHeight} re S`);
    addRaw('Q');
    addText('Conditions générales', margin + boxPad, y + conditionsHeight - 18, 10, muted, true);
    let conditionY = y + conditionsHeight - 34;
    conditionLines.forEach((line) => {
      addText(line, margin + boxPad, conditionY, 9, dark);
      conditionY -= 12;
    });
    y -= sectionGap;

    // Signatures
    const signHeight = 82;
    ensureSpace(signHeight + 46);
    y -= signHeight;
    const signWidth = (contentWidth - 10) / 2;
    addRaw('q 0.80 0.84 0.90 RG 1 w');
    addRaw(`${margin} ${y} ${signWidth} ${signHeight} re S`);
    addRaw(`${margin + signWidth + 10} ${y} ${signWidth} ${signHeight} re S`);
    addRaw('Q');
    addText('Signature agence', margin + 12, y + 16, 10, dark, true);
    addText('Signature client', margin + signWidth + 22, y + 16, 10, dark, true);
    y -= 34;
    addText(`Fait à ${signatureCity}, le ${new Date().toLocaleDateString('fr-MA')}`, margin, y + 10, 10, muted);
    y -= 16;
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
    const contentIds = pages.map(() => nextId++);
    const pageObjectIds = pages.map(() => nextId++);
    const maxId = nextId - 1;
    const objects = new Array<string>(maxId + 1);

    objects[CATALOG_ID] = `${CATALOG_ID} 0 obj\n<< /Type /Catalog /Pages ${PAGES_ID} 0 R >>\nendobj`;
    objects[PAGES_ID] = `${PAGES_ID} 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>\nendobj`;
    objects[FONT_REGULAR_ID] = `${FONT_REGULAR_ID} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`;
    objects[FONT_BOLD_ID] = `${FONT_BOLD_ID} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`;

    pages.forEach((commands, index) => {
      const stream = commands.join('\n');
      const contentId = contentIds[index];
      const pageId = pageObjectIds[index];
      objects[contentId] = `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`;
      objects[pageId] = `${pageId} 0 obj\n<< /Type /Page /Parent ${PAGES_ID} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${FONT_REGULAR_ID} 0 R /F2 ${FONT_BOLD_ID} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`;
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
    if (!ensureRequiredData(true)) return;

    try {
      setGenerating(true);
      await createContract({
        id: `ctr-${Date.now()}`,
        contractNumber: `CTR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        client: client.fullName,
        clientId: client.id,
        vehicle: `${vehicle.brand} ${vehicle.model}`,
        vehicleId: vehicle.id,
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
                  title="Informations de l’agence"
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
                  title="Informations du client"
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

              <section className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoBlock
                  icon={<Building2 className="h-4 w-4 text-[#a58b3f]" />}
                  title="Informations du véhicule"
                  rows={[
                    ['Marque + modèle', `${vehicle.brand || 'Non renseigné'} ${vehicle.model || ''}`.trim()],
                    ['Immatriculation', vehicle.plate || 'Non renseigné'],
                    ['Année', String(vehicle.year || 'Non renseigné')],
                    ['Carburant', vehicle.fuel || 'Non renseigné'],
                    ['Transmission', vehicle.transmission || 'Non renseigné'],
                    ['Kilométrage départ', String(selectedReservation?.mileageOut ?? 'Non renseigné')],
                    ['Kilométrage retour', 'Non renseigné'],
                  ]}
                />
                <InfoBlock
                  icon={<CalendarDays className="h-4 w-4 text-[#a58b3f]" />}
                  title="Détails de la réservation"
                  rows={[
                    ['Date de départ', formatDateFr(pickupDate)],
                    ['Date de retour', formatDateFr(returnDate)],
                    ['Heure départ/retour', 'Non renseigné'],
                    ['Lieu départ', selectedReservation?.pickupLocation || 'Non renseigné'],
                    ['Lieu retour', selectedReservation?.returnLocation || 'Non renseigné'],
                    ['Nombre de jours', String(rentalDays)],
                    ['Prix journalier', formatMAD(vehicle.dailyPrice || 0)],
                    ['Montant total', formatMAD(totalAmount || 0)],
                    ['Caution', formatMAD(deposit || 0)],
                    ['Statut paiement', selectedReservation?.status || 'Non renseigné'],
                  ]}
                />
              </section>

              <section className="mt-5 rounded-xl border border-[#e8edf4] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6b7280]">Conditions générales</p>
                <div className="mt-2 space-y-2 text-sm leading-6 text-[#2f3a4b]">
                  {(terms.trim() ? terms.split('\n').filter(Boolean) : defaultTerms).map((item, index) => (
                    <p key={`${item}-${index}`}>{index + 1}. {item}</p>
                  ))}
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
    <div className="rounded-xl border border-[#e8edf4] p-4">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6b7280]">{title}</p>
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
