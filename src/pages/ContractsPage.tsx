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

  const contractFileName = `contrat-location-${sanitizeFileName(client.fullName || 'client')}-${sanitizeFileName(vehicle.plate || 'vehicule')}-${new Date().toISOString().slice(0, 10)}.pdf`;

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

  function buildPdfTextLines() {
    const lines: string[] = [];
    lines.push('CONTRAT DE LOCATION DE VÉHICULE');
    lines.push(`Référence: ${contractReference}`);
    lines.push(`Date: ${new Date().toLocaleDateString('fr-MA')}`);
    lines.push('');
    lines.push(`Agence: ${profile?.agency?.name || 'MekLoc Agency'}`);
    lines.push(`Adresse: ${agencyMeta.address || 'Non renseigné'}`);
    lines.push(`Téléphone: ${agencyMeta.phone || profile?.phone || 'Non renseigné'}`);
    lines.push(`Email: ${agencyMeta.email || profile?.email || 'Non renseigné'}`);
    lines.push(`ICE / RC: ${agencyMeta.ice || 'Non renseigné'} / ${agencyMeta.rc || 'Non renseigné'}`);
    lines.push('');
    lines.push('CLIENT');
    lines.push(`Nom: ${client.fullName || 'Non renseigné'}`);
    lines.push(`Téléphone: ${client.phone || 'Non renseigné'}`);
    lines.push(`Email: ${client.email || 'Non renseigné'}`);
    lines.push(`CIN/Passeport: ${client.cin || 'Non renseigné'}`);
    lines.push(`Permis: ${client.license || 'Non renseigné'}`);
    lines.push(`Adresse: ${client.address || 'Non renseigné'}`);
    lines.push('');
    lines.push('VÉHICULE');
    lines.push(`Marque/Modèle: ${vehicle.brand || 'Non renseigné'} ${vehicle.model || ''}`.trim());
    lines.push(`Immatriculation: ${vehicle.plate || 'Non renseigné'}`);
    lines.push(`Année: ${vehicle.year || 'Non renseigné'}`);
    lines.push(`Carburant: ${vehicle.fuel || 'Non renseigné'}`);
    lines.push(`Transmission: ${vehicle.transmission || 'Non renseigné'}`);
    lines.push(`Kilométrage départ: ${selectedReservation?.mileageOut ?? 'Non renseigné'}`);
    lines.push(`Kilométrage retour: Non renseigné`);
    lines.push('');
    lines.push('LOCATION');
    lines.push(`Date départ: ${formatDateFr(pickupDate)}`);
    lines.push(`Date retour: ${formatDateFr(returnDate)}`);
    lines.push(`Lieu départ: ${selectedReservation?.pickupLocation || 'Non renseigné'}`);
    lines.push(`Lieu retour: ${selectedReservation?.returnLocation || 'Non renseigné'}`);
    lines.push(`Nombre de jours: ${rentalDays}`);
    lines.push(`Prix journalier: ${formatMAD(vehicle.dailyPrice || 0)}`);
    lines.push(`Montant total: ${formatMAD(totalAmount || 0)}`);
    lines.push(`Caution: ${formatMAD(deposit || 0)}`);
    lines.push(`Statut paiement: ${selectedReservation?.status || 'Non renseigné'}`);
    lines.push('');
    lines.push('CONDITIONS GÉNÉRALES');
    const termsList = terms.trim() ? terms.trim().split('\n').filter(Boolean) : defaultTerms;
    termsList.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
    lines.push('');
    lines.push('Signature agence: _______________________');
    lines.push('Signature client: _______________________');
    lines.push(`Fait à ${vehicle.city || 'Non renseigné'}, le ${new Date().toLocaleDateString('fr-MA')}`);
    lines.push('');
    lines.push(`Généré par MekLoc · ${contractReference}`);
    return lines;
  }

  function downloadContractPreview() {
    if (!ensureRequiredData()) return;

    const escapePdf = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const lines = buildPdfTextLines();
    const content: string[] = [];

    let y = 800;
    const lineHeight = 15;
    for (const line of lines) {
      const safeLine = line.length > 112 ? `${line.slice(0, 109)}...` : line;
      content.push(`BT /F1 11 Tf 48 ${y} Td (${escapePdf(safeLine)}) Tj ET`);
      y -= lineHeight;
      if (y < 44) break;
    }

    const stream = content.join('\n');
    const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000117 00000 n
0000000243 00000 n
000000${(260 + stream.length).toString().padStart(10, '0')} 00000 n
trailer << /Root 1 0 R /Size 6 >>
startxref
0
%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
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
                Fait à {vehicle.city || 'Non renseigné'}, le {new Date().toLocaleDateString('fr-MA')}
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
