import { Building2, Download, FileSignature, PenLine, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { SelectField, TextAreaField } from '../components/ui/Form';
import PageHeader from '../components/ui/PageHeader';
import { formatMAD, type Client, type Vehicle } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';

const templates = ['Standard rental', 'Luxury vehicle', 'Corporate account'];

export default function ContractsPage() {
  const { clients, vehicles, reservations, createContract } = useData();
  const { agencyId, profile } = useAuth();
  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [template, setTemplate] = useState(templates[0]);
  const [reservationId, setReservationId] = useState('');
  const [agencyMeta, setAgencyMeta] = useState<{
    address?: string;
    phone?: string;
    email?: string;
    logo_path?: string;
    ice?: string;
    rc?: string;
  }>({});
  const [logoPublicUrl, setLogoPublicUrl] = useState<string | null>(null);
  const { notify } = useApp();

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
      if (data) {
        setAgencyMeta(data);
        if (data.logo_path) {
          const { data: logoData } = supabase.storage.from('agency-logos').getPublicUrl(data.logo_path);
          setLogoPublicUrl(logoData.publicUrl);
        } else {
          setLogoPublicUrl(null);
        }
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
    year: 2026,
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
  const pickupDate = selectedReservation?.pickupDate || '2026-05-15';
  const returnDate = selectedReservation?.returnDate || '2026-05-19';
  const rentalDays = Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / (1000 * 60 * 60 * 24)));
  const totalAmount = selectedReservation?.totalAmount || vehicle.dailyPrice * rentalDays;
  const generatedAt = new Date().toLocaleDateString('fr-MA');
  const contractReference = `CONTRAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

  function sanitizeFileName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  const contractFileName = `contrat-location-${sanitizeFileName(client.fullName || 'client')}-${sanitizeFileName(vehicle.plate || 'vehicule')}-${new Date().toISOString().slice(0, 10)}.pdf`;

  function ensureRequiredData() {
    if (!client.id) {
      notify({
        title: 'Données manquantes',
        message: 'Veuillez sélectionner un client.',
        type: 'warning',
      });
      return false;
    }
    if (!vehicle.id) {
      notify({
        title: 'Données manquantes',
        message: 'Veuillez sélectionner un véhicule.',
        type: 'warning',
      });
      return false;
    }
    if (!pickupDate || !returnDate) {
      notify({
        title: 'Données manquantes',
        message: 'Veuillez choisir les dates de location.',
        type: 'warning',
      });
      return false;
    }
    if (!selectedReservation?.pickupLocation) {
      notify({
        title: 'Données manquantes',
        message: 'Veuillez indiquer le lieu de prise en charge.',
        type: 'warning',
      });
      return false;
    }
    return true;
  }

  async function downloadContractPreview() {
    if (!ensureRequiredData()) return;
    const escapePdf = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    let y = 800;
    const lines: string[] = [];
    const drawText = (text: string, x: number, fontSize = 11) => {
      lines.push(`BT /F1 ${fontSize} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET`);
      y -= fontSize + 5;
    };
    const drawSection = (title: string) => {
      lines.push(`0.2 0.2 0.2 RG 40 ${y + 6} 515 1 re S`);
      drawText(title.toUpperCase(), 42, 12);
      y -= 2;
    };

    drawText('CONTRAT DE LOCATION', 360, 16);
    drawText(`Référence: ${contractReference}`, 360, 10);
    drawText(`Date: ${generatedAt}`, 360, 10);
    y += 22;
    lines.push(`0.85 0.85 0.85 RG 40 ${y - 22} 120 46 re S`);
    drawText(logoPublicUrl ? 'LOGO AGENCE' : 'LOGO', 80, 10);
    y -= 24;

    drawSection("Informations de l'agence");
    drawText(`Nom: ${profile?.agency?.name || 'MekLoc Agency'}`, 46);
    drawText(`Adresse: ${agencyMeta.address || '—'}`, 46);
    drawText(`Téléphone: ${agencyMeta.phone || profile?.phone || '—'}`, 46);
    drawText(`Email: ${agencyMeta.email || profile?.email || '—'}`, 46);
    drawText(`ICE / RC: ${agencyMeta.ice || '-'} / ${agencyMeta.rc || '-'}`, 46);
    y -= 8;

    drawSection('Informations du client');
    drawText(`Nom: ${client.fullName}`, 46);
    drawText(`Téléphone: ${client.phone || '—'}`, 46);
    drawText(`Email: ${client.email || '—'}`, 46);
    drawText(`CIN / Passeport: ${client.cin || '—'}`, 46);
    drawText(`Permis: ${client.license || '—'}`, 46);
    drawText(`Adresse: ${client.address || '—'}`, 46);
    y -= 8;

    drawSection('Informations du véhicule');
    drawText(`Véhicule: ${vehicle.brand} ${vehicle.model}`, 46);
    drawText(`Immatriculation: ${vehicle.plate || '—'}`, 46);
    drawText(`Année: ${vehicle.year || '—'}`, 46);
    drawText(`Kilométrage: ${vehicle.mileage?.toLocaleString('fr-FR') || '0'} km`, 46);
    drawText(`Carburant / Transmission: ${vehicle.fuel || '—'} / ${vehicle.transmission || '—'}`, 46);
    y -= 8;

    drawSection('Détails de la location');
    drawText(`Date de départ: ${pickupDate}`, 46);
    drawText(`Date de retour: ${returnDate}`, 46);
    drawText(`Durée: ${rentalDays} jour(s)`, 46);
    drawText(`Prix journalier: ${formatMAD(vehicle.dailyPrice)}`, 46);
    drawText(`Montant total: ${formatMAD(totalAmount)}`, 46);
    drawText(`Caution: ${formatMAD(4000)}`, 46);
    y -= 8;

    drawSection('Conditions générales');
    [
      "Le locataire reconnaît avoir reçu le véhicule en bon état de fonctionnement.",
      'Il s’engage à le restituer dans le même état.',
      'Le locataire est responsable des amendes et dommages.',
      'Tout retard peut entraîner des frais supplémentaires.',
      'Toute prolongation doit être approuvée par l’agence.',
    ].forEach((line) => drawText(`• ${line}`, 46, 10));

    y -= 8;
    lines.push(`0.7 0.7 0.7 RG 40 ${y - 42} 240 40 re S`);
    lines.push(`0.7 0.7 0.7 RG 315 ${y - 42} 240 40 re S`);
    drawText("Signature de l'agence", 46, 10);
    drawText('Signature du client', 321, 10);
    y -= 16;
    drawText(`${profile?.agency?.name || 'MekLoc'} · ${agencyMeta.phone || profile?.phone || '-'} · ${agencyMeta.email || profile?.email || '-'}`, 46, 9);
    drawText('Contrat généré par MekLoc', 46, 9);

    const stream = lines.join('\n');
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
    if (!client.id || !vehicle.id) {
      notify({ title: 'Données manquantes', message: 'Veuillez sélectionner un client et un véhicule avant de générer le contrat.', type: 'warning' });
      return;
    }

    try {
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
        terms:
          "Le locataire reconnaît avoir reçu le véhicule en bon état de fonctionnement et s’engage à le restituer dans le même état.",
        status: 'Draft',
      });
      notify({ title: 'Contrat généré', message: 'Le contrat a été enregistré dans la base de données.', type: 'success' });
    } catch (error) {
      notify({
        title: 'Contrat non généré',
        message: error instanceof Error ? error.message : 'Réessayez dans quelques instants.',
        type: 'warning',
      });
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Documents"
        title="Contrats"
        description="Générez un contrat professionnel avec les données réelles de l’agence, du client et du véhicule."
        action={
          <Button
            icon={<Download className="h-4 w-4" />}
            onClick={downloadContractPreview}
          >
            Télécharger PDF
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-gold-400/10 p-3 text-gold-200">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white light:text-carbon-950">Générateur de contrat</h2>
              <p className="text-sm text-carbon-400">Sélectionnez client et véhicule, puis générez votre contrat A4.</p>
            </div>
          </div>
          <div className="grid gap-4">
            <SelectField label="Modèle de contrat" value={template} onChange={(event) => setTemplate(event.target.value)}>
              {templates.map((item) => <option key={item}>{item}</option>)}
            </SelectField>
            <p className="text-sm text-carbon-400">Langue du contrat: Français</p>
            <SelectField label="Client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              {clients.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </SelectField>
            <SelectField label="Véhicule" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              {vehicles.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model}</option>)}
            </SelectField>
            <SelectField label="Réservation source" value={reservationId} onChange={(event) => setReservationId(event.target.value)}>
              {reservations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} · {item.client} · {item.pickupDate} → {item.returnDate}
                </option>
              ))}
            </SelectField>
            <TextAreaField
              label="Conditions générales"
              defaultValue="Le locataire reconnaît avoir reçu le véhicule en bon état de fonctionnement et s’engage à le restituer dans le même état."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => notify({ title: 'Aperçu prêt', message: 'Le panneau de droite représente le rendu du contrat PDF.', type: 'info' })}>Aperçu</Button>
              <Button type="button" icon={<FileSignature className="h-4 w-4" />} onClick={handleGenerateContract}>Générer contrat</Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden bg-white text-carbon-950 light:border-carbon-950/10">
          <div className="border-b border-carbon-950/10 bg-carbon-950 px-6 py-5 text-white">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold-300/25 bg-gold-400/10 text-gold-200">
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-black">Aperçu Contrat A4</p>
                  <p className="text-xs text-carbon-400">{template} · Contrat professionnel</p>
                </div>
              </div>
              <span className="rounded-full bg-gold-400 px-3 py-1 text-xs font-black text-carbon-950">Draft</span>
            </div>
          </div>
          {!client.id || !vehicle.id ? (
            <div className="p-8">
              <div className="rounded-2xl border border-dashed border-carbon-300/70 bg-carbon-50 p-8 text-center">
                <p className="text-base font-semibold text-carbon-900">Aperçu indisponible</p>
                <p className="mt-2 text-sm text-carbon-600">Veuillez sélectionner un client et un véhicule avant de générer le contrat.</p>
              </div>
            </div>
          ) : (
          <div className="space-y-6 p-6">
            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-carbon-500">Informations de l’agence</h3>
              <div className="rounded-xl border border-carbon-950/10 p-4">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-carbon-950/20 text-xs font-bold text-carbon-500">
                  {logoPublicUrl ? <img src={logoPublicUrl} alt="Logo agence" className="h-full w-full rounded-2xl object-contain" /> : 'LOGO'}
                </div>
                <p className="font-bold">{profile?.agency?.name || 'MekLoc Agency'}</p>
                <p className="text-sm text-carbon-600">{agencyMeta.address || 'Adresse non renseignée'}</p>
                  <p className="text-sm text-carbon-600">{agencyMeta.phone || profile?.phone || 'Téléphone non renseigné'} · {agencyMeta.email || profile?.email || 'Email non renseigné'}</p>
                  <p className="mt-1 text-xs text-carbon-500">Référence: {selectedReservation?.id || contractReference}</p>
              </div>
            </section>
            <div className="grid gap-4 md:grid-cols-2">
              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-carbon-500">Informations du client</h3>
                <div className="rounded-xl border border-carbon-950/10 p-4 text-sm">
                  <p className="font-bold text-carbon-950">{client.fullName}</p>
                  <p>{client.phone}</p>
                  <p>{client.cin}</p>
                  <p>Permis: {client.license}</p>
                </div>
              </section>
              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-carbon-500">Informations du véhicule</h3>
                <div className="rounded-xl border border-carbon-950/10 p-4 text-sm">
                  <p className="font-bold text-carbon-950">{vehicle.brand} {vehicle.model}</p>
                  <p>Plaque: {vehicle.plate}</p>
                  <p>{vehicle.year} · {vehicle.fuel} · {vehicle.transmission}</p>
                  <p>Kilométrage: {vehicle.mileage.toLocaleString()} km</p>
                  <p>Sortie km: {selectedReservation?.mileageOut || '—'} · Carburant: {selectedReservation?.fuelLevelOut || '—'}</p>
                </div>
              </section>
            </div>
            <section className="grid gap-4 md:grid-cols-3">
              {[
                ['Date de départ', pickupDate],
                ['Date de retour', returnDate],
                ['Prix journalier', formatMAD(vehicle.dailyPrice)],
                ['Lieu départ', selectedReservation?.pickupLocation || '—'],
                ['Lieu retour', selectedReservation?.returnLocation || '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-carbon-950/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-carbon-500">{label}</p>
                  <p className="mt-1 font-black">{value}</p>
                </div>
              ))}
            </section>
            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-carbon-500">Conditions générales</h3>
              <p className="rounded-xl border border-carbon-950/10 p-4 text-sm leading-6 text-carbon-700">
                {'Le locataire reconnaît avoir reçu le véhicule en bon état de fonctionnement et s’engage à le restituer dans le même état. Toute prolongation doit être approuvée par l’agence.'}
              </p>
            </section>
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-dashed border-carbon-950/30 p-5">
                <PenLine className="mb-10 h-5 w-5 text-carbon-500" />
                <p className="text-sm font-bold">Signature du client</p>
              </div>
              <div className="rounded-xl border border-dashed border-carbon-950/30 p-5">
                <PenLine className="mb-10 h-5 w-5 text-carbon-500" />
                <p className="text-sm font-bold">Signature de l’agence</p>
              </div>
            </section>
            <div className="flex flex-wrap gap-3 border-t border-carbon-950/10 pt-4">
              <Button type="button" variant="secondary" onClick={() => { setClientId(''); setVehicleId(''); }}>Modifier</Button>
              <Button type="button" icon={<Download className="h-4 w-4" />} onClick={downloadContractPreview}>Télécharger PDF</Button>
            </div>
          </div>
          )}
        </Card>
      </div>
    </div>
  );
}
  const [searchParams] = useSearchParams();
