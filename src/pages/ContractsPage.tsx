import { Building2, Download, FileSignature, FileText, PenLine, Printer, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { SelectField, TextAreaField } from '../components/ui/Form';
import PageHeader from '../components/ui/PageHeader';
import { formatMAD, type Client, type Vehicle } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

const templates = ['Standard rental', 'Luxury vehicle', 'Corporate account'];

export default function ContractsPage() {
  const { clients, vehicles, createContract } = useData();
  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [template, setTemplate] = useState(templates[0]);
  const { notify } = useApp();

  useEffect(() => {
    if (!clientId && clients[0]) setClientId(clients[0].id);
    if (!vehicleId && vehicles[0]) setVehicleId(vehicles[0].id);
  }, [clientId, clients, vehicleId, vehicles]);

  const emptyClient: Client = {
    id: '',
    fullName: 'No client selected',
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
    brand: 'No',
    model: 'vehicle selected',
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
  const contractFileName = `contrat-${client.fullName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;

  function downloadContractPreview() {
    const lines = [
      'Contrat de location MekLoc',
      `Client: ${client.fullName}`,
      `Véhicule: ${vehicle.brand} ${vehicle.model}`,
      `Plaque: ${vehicle.plate || '-'}`,
      `Date: ${new Date().toLocaleDateString('fr-MA')}`,
    ];
    const textStream = lines
      .map((line, i) => `BT /F1 12 Tf 50 ${780 - i * 20} Td (${line.replace(/[()\\]/g, '')}) Tj ET`)
      .join('\n');
    const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${textStream.length} >> stream
${textStream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000243 00000 n 
000000${(260 + textStream.length).toString().padStart(10, '0')} 00000 n 
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

  async function handleGenerateContract() {
    if (!client.id || !vehicle.id) {
      notify({ title: 'Missing contract data', message: 'Add at least one client and vehicle first.', type: 'warning' });
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
        pickupDate: '2026-05-15',
        returnDate: '2026-05-19',
        totalAmount: vehicle.dailyPrice * 4,
        terms:
          'The renter accepts full responsibility for traffic fines, fuel level, insurance excess, late returns, and vehicle condition at handoff.',
        status: 'Draft',
      });
      notify({ title: 'Contract generated', message: 'The contract was saved to the backend data layer.', type: 'success' });
    } catch (error) {
      notify({
        title: 'Contract not generated',
        message: error instanceof Error ? error.message : 'Try again later.',
        type: 'warning',
      });
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Documents"
        title="Contracts"
        description="Generate rental contracts with agency, client, vehicle, pricing, terms, and signature sections."
        action={
          <Button
            icon={<Download className="h-4 w-4" />}
            onClick={downloadContractPreview}
          >
            Télécharger PDF
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-gold-400/10 p-3 text-gold-200">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white light:text-carbon-950">Contract generator</h2>
              <p className="text-sm text-carbon-400">Choose a template and preview the final structure.</p>
            </div>
          </div>
          <div className="grid gap-4">
            <SelectField label="Contract template" value={template} onChange={(event) => setTemplate(event.target.value)}>
              {templates.map((item) => <option key={item}>{item}</option>)}
            </SelectField>
            <p className="text-sm text-carbon-400">Langue du contrat: Français</p>
            <SelectField label="Client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              {clients.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </SelectField>
            <SelectField label="Vehicle" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              {vehicles.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model}</option>)}
            </SelectField>
            <TextAreaField
              label="Terms and conditions"
              defaultValue="The renter accepts full responsibility for traffic fines, fuel level, insurance excess, late returns, and vehicle condition at handoff."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Aperçu impression</Button>
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
                  <p className="font-black">Contrat de location MekLoc</p>
                  <p className="text-xs text-carbon-400">Logo agence · {template} · PDF preview</p>
                </div>
              </div>
              <span className="rounded-full bg-gold-400 px-3 py-1 text-xs font-black text-carbon-950">Draft</span>
            </div>
          </div>
          <div className="space-y-6 p-6">
            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-carbon-500">Agency info</h3>
              <div className="rounded-xl border border-carbon-950/10 p-4">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-carbon-950/20 text-xs font-bold text-carbon-500">
                  LOGO
                </div>
                <p className="font-bold">Atlas Rent Marrakech</p>
                <p className="text-sm text-carbon-600">Av. Mohammed VI, Marrakech · +212 6 00 00 00 00</p>
              </div>
            </section>
            <div className="grid gap-4 md:grid-cols-2">
              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-carbon-500">Client info</h3>
                <div className="rounded-xl border border-carbon-950/10 p-4 text-sm">
                  <p className="font-bold text-carbon-950">{client.fullName}</p>
                  <p>{client.phone}</p>
                  <p>{client.cin}</p>
                  <p>License: {client.license}</p>
                </div>
              </section>
              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-carbon-500">Vehicle info</h3>
                <div className="rounded-xl border border-carbon-950/10 p-4 text-sm">
                  <p className="font-bold text-carbon-950">{vehicle.brand} {vehicle.model}</p>
                  <p>Plate: {vehicle.plate}</p>
                  <p>{vehicle.year} · {vehicle.fuel} · {vehicle.transmission}</p>
                  <p>Mileage: {vehicle.mileage.toLocaleString()} km</p>
                </div>
              </section>
            </div>
            <section className="grid gap-4 md:grid-cols-3">
              {[
                ['Pickup date', '2026-05-15'],
                ['Return date', '2026-05-19'],
                ['Daily price', formatMAD(vehicle.dailyPrice)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-carbon-950/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-carbon-500">{label}</p>
                  <p className="mt-1 font-black">{value}</p>
                </div>
              ))}
            </section>
            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-carbon-500">Terms and conditions</h3>
              <p className="rounded-xl border border-carbon-950/10 p-4 text-sm leading-6 text-carbon-700">
                {'Le locataire accepte la responsabilite des amendes, du niveau de carburant, de la franchise assurance, des retards et de l etat du vehicule au retour. Toute prolongation doit etre approuvee par l agence.'}
              </p>
            </section>
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-dashed border-carbon-950/30 p-5">
                <PenLine className="mb-10 h-5 w-5 text-carbon-500" />
                <p className="text-sm font-bold">Client signature</p>
              </div>
              <div className="rounded-xl border border-dashed border-carbon-950/30 p-5">
                <PenLine className="mb-10 h-5 w-5 text-carbon-500" />
                <p className="text-sm font-bold">Agency signature</p>
              </div>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}
