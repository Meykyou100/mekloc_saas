import { useMemo, useState } from 'react';
import { CalendarClock, Camera, Car, CheckCircle2, ClipboardList, ImagePlus, ShieldAlert, Trash2, Wrench } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Field, SelectField, TextAreaField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import PlateNumber from '../components/ui/PlateNumber';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { formatMAD, type MaintenanceItem } from '../data/mockData';

const SERVICE_TYPES: MaintenanceItem['serviceType'][] = ['Vidange', 'Assurance', 'Visite technique', 'Pneus', 'Freins', 'Réparation', 'Autre'];
const STATUS_VALUES: MaintenanceItem['status'][] = ['Scheduled', 'Done', 'Due soon', 'Overdue'];
const statusLabels: Record<MaintenanceItem['status'], string> = {
  Scheduled: 'Planifié',
  Done: 'Terminé',
  'Due soon': 'Bientôt dû',
  Overdue: 'En retard',
};
type MaintenanceForm = Omit<MaintenanceItem, 'id' | 'vehicle' | 'currentMileage' | 'mileageAtService' | 'nextServiceMileage' | 'cost'> & {
  currentMileage: string;
  mileageAtService: string;
  nextServiceMileage: string;
  cost: string;
  details: Record<string, string | number | boolean | undefined>;
};

const detailLabels: Record<string, string> = {
  oilType: 'Type huile',
  oilFilterChanged: 'Filtre changé',
  oilMileage: 'Kilométrage vidange',
  nextOilMileage: 'Prochaine vidange km',
  nextOilDate: 'Prochaine vidange date',
  company: 'Compagnie',
  policyNumber: 'N° police',
  startDate: 'Date début',
  expirationDate: 'Date expiration',
  amount: 'Montant',
  insuranceDocumentUrl: 'Document assurance',
  center: 'Centre',
  visitDate: 'Date visite',
  result: 'Résultat',
  inspectionDocumentUrl: 'Document visite',
  tiresChanged: 'Pneus changés',
  tireBrand: 'Marque pneus',
  changeDate: 'Date changement',
  changeMileage: 'Kilométrage changement',
  nextCheckMileage: 'Prochain contrôle km',
  nextCheckDate: 'Prochain contrôle date',
  brakeItems: 'Intervention',
  interventionDate: 'Date intervention',
  interventionMileage: 'Kilométrage',
  nextCheck: 'Prochain contrôle',
  problem: 'Problème',
  partsChanged: 'Pièces changées',
  garage: 'Garage',
  warrantyUntil: 'Garantie jusqu’à',
  description: 'Description',
  date: 'Date',
};

function cleanDetails(details: MaintenanceForm['details']) {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  );
}

function formatDetailValue(value: string | number | boolean | undefined) {
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  return String(value ?? '');
}

export default function MaintenancePage() {
  const { vehicles, maintenance, createMaintenance, updateMaintenance, deleteMaintenance } = useData();
  const { notify } = useApp();
  const [open, setOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [form, setForm] = useState<MaintenanceForm>({
    vehicleId: '',
    plate: '',
    serviceType: 'Vidange',
    lastServiceDate: '',
    nextServiceDate: '',
    currentMileage: '',
    mileageAtService: '',
    nextServiceMileage: '',
    cost: '',
    providerName: '',
    status: 'Scheduled',
    notes: '',
    invoiceUrl: '',
    details: {},
  });

  const today = new Date();
  const smartItems = useMemo(() => maintenance.map((item) => {
    const vehicle = vehicles.find((v) => v.id === item.vehicleId);
    const vehicleMileage = vehicle?.mileage ?? item.currentMileage;
    const days = Math.ceil((new Date(item.nextServiceDate).getTime() - today.getTime()) / 86400000);
    const mileageDiff = item.nextServiceMileage - vehicleMileage;
    let status = item.status;
    if (status !== 'Done') {
      if (days < 0 || mileageDiff < 0) status = 'Overdue';
      else if (days <= 15 || mileageDiff <= 500) status = 'Due soon';
      else status = 'Scheduled';
    }
    return { ...item, currentMileage: vehicleMileage, status, plate: vehicle?.plate || item.plate };
  }), [maintenance, today, vehicles]);

  const filtered = selectedVehicleId === 'all' ? smartItems : smartItems.filter((i) => i.vehicleId === selectedVehicleId);
  const monthKey = new Date().toISOString().slice(0, 7);
  const insuranceReminders = smartItems.filter((i) => i.serviceType === 'Assurance' && i.status !== 'Done').length;
  const oilReminders = smartItems.filter((i) => i.serviceType === 'Vidange' && i.status !== 'Done').length;
  const inspectionReminders = smartItems.filter((i) => i.serviceType === 'Visite technique' && i.status !== 'Done').length;
  const monthlyCost = smartItems.filter((i) => i.lastServiceDate.startsWith(monthKey)).reduce((a, b) => a + b.cost, 0);
  const selectedFormVehicle = vehicles.find((v) => v.id === form.vehicleId);

  function openCreate() {
    setEditing(null);
    setForm({ vehicleId: '', plate: '', serviceType: 'Vidange', lastServiceDate: '', nextServiceDate: '', currentMileage: '', mileageAtService: '', nextServiceMileage: '', cost: '', providerName: '', status: 'Scheduled', notes: '', invoiceUrl: '', details: {} });
    setOpen(true);
  }
  function openEdit(item: MaintenanceItem) {
    setEditing(item);
    setForm({
      ...item,
      currentMileage: String(item.currentMileage ?? ''),
      mileageAtService: String(item.mileageAtService ?? ''),
      nextServiceMileage: String(item.nextServiceMileage ?? ''),
      cost: String(item.cost ?? ''),
      invoiceUrl: item.invoiceUrl || '',
      details: item.details || {},
    });
    setOpen(true);
  }
  function updateDetail(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, details: { ...current.details, [key]: value } }));
  }
  async function saveRecord() {
    const vehicle = vehicles.find((v) => v.id === form.vehicleId);
    if (!vehicle) return notify({ title: 'Véhicule obligatoire', message: 'Veuillez sélectionner un véhicule.', type: 'warning' });
    if (!form.serviceType) return notify({ title: 'Service obligatoire', message: 'Veuillez choisir un type de service.', type: 'warning' });
    const details = cleanDetails(form.details);
    if (!form.lastServiceDate || !form.nextServiceDate) return notify({ title: 'Dates obligatoires', message: 'Veuillez renseigner les dates de service.', type: 'warning' });
    if (new Date(form.nextServiceDate).getTime() < new Date(form.lastServiceDate).getTime()) {
      return notify({ title: 'Dates invalides', message: 'La prochaine échéance doit être après la dernière intervention.', type: 'warning' });
    }
    const cost = form.cost.trim() === '' ? Number.NaN : Number(form.cost);
    if (!Number.isFinite(cost) || cost <= 0) return notify({ title: 'Coût invalide', message: 'Veuillez saisir un coût positif.', type: 'warning' });
    if (form.serviceType === 'Assurance' && (!details.company || !details.policyNumber || !details.startDate || !details.expirationDate)) {
      return notify({ title: 'Assurance incomplète', message: 'Veuillez renseigner la compagnie, la police et les dates.', type: 'warning' });
    }
    if (form.serviceType === 'Visite technique' && (!details.center || !details.visitDate || !details.expirationDate || !details.result)) {
      return notify({ title: 'Visite incomplète', message: 'Veuillez renseigner le centre, les dates et le résultat.', type: 'warning' });
    }
    if (form.serviceType === 'Réparation' && !details.problem) {
      return notify({ title: 'Problème obligatoire', message: 'Veuillez décrire la réparation.', type: 'warning' });
    }
    if (form.serviceType === 'Autre' && !details.description) {
      return notify({ title: 'Description obligatoire', message: 'Veuillez décrire l’intervention.', type: 'warning' });
    }
    const currentMileage = form.currentMileage.trim() === '' ? vehicle.mileage : Number(form.currentMileage);
    const mileageAtService = form.mileageAtService.trim() === '' ? currentMileage : Number(form.mileageAtService);
    const nextServiceMileage = form.nextServiceMileage.trim() === '' ? mileageAtService : Number(form.nextServiceMileage);
    if (![currentMileage, mileageAtService, nextServiceMileage].every((value) => Number.isFinite(value) && value >= 0)) {
      return notify({ title: 'Kilométrage invalide', message: 'Veuillez vérifier les valeurs de kilométrage.', type: 'warning' });
    }
    const payload: MaintenanceItem = {
      id: editing?.id || `mnt-${Date.now()}`,
      vehicle: `${vehicle.brand} ${vehicle.model}`,
      ...form,
      currentMileage,
      mileageAtService,
      nextServiceMileage,
      cost,
      details,
      plate: vehicle.plate,
    };
    try {
      if (editing) await updateMaintenance(payload); else await createMaintenance(payload);
      notify({ title: editing ? 'Entretien mis à jour' : 'Entretien ajouté', message: 'La fiche entretien a été enregistrée.', type: 'success' });
      setOpen(false);
    } catch (error) {
      notify({ title: 'Action impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    }
  }

  function renderServiceDetails() {
    const details = form.details;
    if (form.serviceType === 'Vidange') {
      return <>
        <Field label="Type huile" value={String(details.oilType || '')} onChange={(e) => updateDetail('oilType', e.target.value)} />
        <SelectField label="Filtre changé" value={details.oilFilterChanged === false ? 'non' : 'oui'} onChange={(e) => updateDetail('oilFilterChanged', e.target.value === 'oui')}>
          <option value="oui">Oui</option>
          <option value="non">Non</option>
        </SelectField>
        <Field label="Kilométrage vidange" type="number" min="0" value={String(details.oilMileage || '')} onChange={(e) => updateDetail('oilMileage', e.target.value)} />
        <Field label="Prochaine vidange km" type="number" min="0" value={String(details.nextOilMileage || '')} onChange={(e) => updateDetail('nextOilMileage', e.target.value)} />
        <Field label="Prochaine vidange date" type="date" value={String(details.nextOilDate || '')} onChange={(e) => updateDetail('nextOilDate', e.target.value)} />
      </>;
    }
    if (form.serviceType === 'Assurance') {
      return <>
        <Field label="Compagnie *" value={String(details.company || '')} onChange={(e) => updateDetail('company', e.target.value)} />
        <Field label="N° police *" value={String(details.policyNumber || '')} onChange={(e) => updateDetail('policyNumber', e.target.value)} />
        <Field label="Date début *" type="date" value={String(details.startDate || '')} onChange={(e) => updateDetail('startDate', e.target.value)} />
        <Field label="Date expiration *" type="date" value={String(details.expirationDate || '')} onChange={(e) => updateDetail('expirationDate', e.target.value)} />
        <Field label="Montant" type="number" min="0" step="0.01" value={String(details.amount || '')} onChange={(e) => updateDetail('amount', e.target.value)} />
        <Field label="Document assurance" value={String(details.insuranceDocumentUrl || '')} placeholder="https://..." onChange={(e) => updateDetail('insuranceDocumentUrl', e.target.value)} />
      </>;
    }
    if (form.serviceType === 'Visite technique') {
      return <>
        <Field label="Centre *" value={String(details.center || '')} onChange={(e) => updateDetail('center', e.target.value)} />
        <Field label="Date visite *" type="date" value={String(details.visitDate || '')} onChange={(e) => updateDetail('visitDate', e.target.value)} />
        <Field label="Date expiration *" type="date" value={String(details.expirationDate || '')} onChange={(e) => updateDetail('expirationDate', e.target.value)} />
        <SelectField label="Résultat *" value={String(details.result || '')} onChange={(e) => updateDetail('result', e.target.value)}>
          <option value="">Choisir</option>
          <option value="valide">Valide</option>
          <option value="refusé">Refusé</option>
        </SelectField>
        <Field label="Document visite" value={String(details.inspectionDocumentUrl || '')} placeholder="https://..." onChange={(e) => updateDetail('inspectionDocumentUrl', e.target.value)} />
      </>;
    }
    if (form.serviceType === 'Pneus') {
      return <>
        <SelectField label="Pneus changés" value={String(details.tiresChanged || '')} onChange={(e) => updateDetail('tiresChanged', e.target.value)}>
          <option value="">Choisir</option>
          <option value="avant">Avant</option>
          <option value="arrière">Arrière</option>
          <option value="les 4">Les 4</option>
        </SelectField>
        <Field label="Marque pneus" value={String(details.tireBrand || '')} onChange={(e) => updateDetail('tireBrand', e.target.value)} />
        <Field label="Date changement" type="date" value={String(details.changeDate || '')} onChange={(e) => updateDetail('changeDate', e.target.value)} />
        <Field label="Kilométrage changement" type="number" min="0" value={String(details.changeMileage || '')} onChange={(e) => updateDetail('changeMileage', e.target.value)} />
        <Field label="Prochain contrôle km" type="number" min="0" value={String(details.nextCheckMileage || '')} onChange={(e) => updateDetail('nextCheckMileage', e.target.value)} />
        <Field label="Prochain contrôle date" type="date" value={String(details.nextCheckDate || '')} onChange={(e) => updateDetail('nextCheckDate', e.target.value)} />
      </>;
    }
    if (form.serviceType === 'Freins') {
      return <>
        <SelectField label="Plaquettes / disques / liquide" value={String(details.brakeItems || '')} onChange={(e) => updateDetail('brakeItems', e.target.value)}>
          <option value="">Choisir</option>
          <option value="plaquettes">Plaquettes</option>
          <option value="disques">Disques</option>
          <option value="liquide">Liquide</option>
          <option value="plaquettes et disques">Plaquettes et disques</option>
        </SelectField>
        <Field label="Date intervention" type="date" value={String(details.interventionDate || '')} onChange={(e) => updateDetail('interventionDate', e.target.value)} />
        <Field label="Kilométrage" type="number" min="0" value={String(details.interventionMileage || '')} onChange={(e) => updateDetail('interventionMileage', e.target.value)} />
        <Field label="Prochain contrôle" value={String(details.nextCheck || '')} onChange={(e) => updateDetail('nextCheck', e.target.value)} />
      </>;
    }
    if (form.serviceType === 'Réparation') {
      return <>
        <Field label="Problème *" value={String(details.problem || '')} onChange={(e) => updateDetail('problem', e.target.value)} />
        <Field label="Pièces changées" value={String(details.partsChanged || '')} onChange={(e) => updateDetail('partsChanged', e.target.value)} />
        <Field label="Garage" value={String(details.garage || '')} onChange={(e) => updateDetail('garage', e.target.value)} />
        <Field label="Coût" type="number" min="0" step="0.01" value={String(details.amount || '')} onChange={(e) => updateDetail('amount', e.target.value)} />
        <Field label="Garantie jusqu’à" type="date" value={String(details.warrantyUntil || '')} onChange={(e) => updateDetail('warrantyUntil', e.target.value)} />
      </>;
    }
    return <>
      <Field label="Description *" value={String(details.description || '')} onChange={(e) => updateDetail('description', e.target.value)} />
      <Field label="Date" type="date" value={String(details.date || '')} onChange={(e) => updateDetail('date', e.target.value)} />
      <Field label="Coût" type="number" min="0" step="0.01" value={String(details.amount || '')} onChange={(e) => updateDetail('amount', e.target.value)} />
    </>;
  }

  return <div>
    <PageHeader eyebrow="Opérations flotte" title="Entretien" description="Suivez les interventions, les coûts, les échéances et l’historique des véhicules." action={<Button onClick={openCreate}>Ajouter un entretien</Button>} />
    <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
      <Card className="min-h-[96px] bg-[linear-gradient(135deg,var(--app-card),var(--app-surface-soft))] p-3 sm:min-h-[104px] sm:p-4"><p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)] sm:text-xs">Rappels assurance</p><p className="mt-2 truncate text-2xl font-black text-[var(--app-text)] sm:text-2xl">{insuranceReminders}</p></Card>
      <Card className="min-h-[96px] bg-[linear-gradient(135deg,var(--app-card),var(--app-surface-soft))] p-3 sm:min-h-[104px] sm:p-4"><p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)] sm:text-xs">Rappels vidange</p><p className="mt-2 truncate text-2xl font-black text-[var(--app-text)] sm:text-2xl">{oilReminders}</p></Card>
      <Card className="min-h-[96px] bg-[linear-gradient(135deg,var(--app-card),var(--app-surface-soft))] p-3 sm:min-h-[104px] sm:p-4"><p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)] sm:text-xs">Visites techniques</p><p className="mt-2 truncate text-2xl font-black text-[var(--app-text)] sm:text-2xl">{inspectionReminders}</p></Card>
      <Card className="min-h-[96px] bg-[linear-gradient(135deg,var(--app-card),var(--app-gold-soft))] p-3 sm:min-h-[104px] sm:p-4"><p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)] sm:text-xs">Coût ce mois</p><p className="mt-2 truncate text-2xl font-black text-[var(--app-gold-text)] sm:text-2xl">{formatMAD(monthlyCost)}</p></Card>
    </div>
    <Card className="mt-6 p-4 sm:p-5">
      <div className="mb-4 grid gap-3 sm:flex sm:items-center sm:justify-between">
        <h2 className="font-semibold">Registre des entretiens</h2>
        <select className="form-control h-11 w-full sm:w-56" value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)}>
          <option value="all">Tous les véhicules</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model}</option>)}
        </select>
      </div>
      {!filtered.length ? <EmptyState icon={ClipboardList} title="Ajouter votre premier entretien" message="Une fois ajouté, les rappels et l’historique apparaîtront ici." action="Ajouter un entretien" onAction={openCreate} /> :
      <div className="grid gap-3">{filtered.map((item) => <div key={item.id} className="premium-surface rounded-2xl p-4">
        <div className="grid gap-3 sm:flex sm:items-start sm:justify-between sm:gap-4">
          <div><p className="font-semibold">{item.vehicle} {item.plate ? <>· <PlateNumber value={item.plate} /></> : ''}</p><p className="mt-1 text-sm text-carbon-400">{item.serviceType} · Dernière intervention : {item.lastServiceDate} · Prochaine échéance : {item.nextServiceDate}</p><p className="mt-1 text-sm text-carbon-400">Kilométrage {item.currentMileage.toLocaleString()} km · Prochain contrôle {item.nextServiceMileage.toLocaleString()} km</p></div>
          <div className="flex items-center justify-between gap-3 sm:block sm:text-right"><Badge>{item.status}</Badge><p className="font-semibold text-[var(--app-gold-text)] sm:mt-2">{formatMAD(item.cost)}</p></div>
        </div>
        {item.details && Object.keys(item.details).length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(item.details).filter(([, value]) => value !== '' && value !== undefined && value !== null).slice(0, 6).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--app-text-muted)]">{detailLabels[key] || key}</p>
                <p className="mt-1 truncate text-sm text-[var(--app-text-soft)]">{formatDetailValue(value)}</p>
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-sm text-carbon-400">{item.providerName || 'Prestataire non renseigné'}{item.notes ? ` · ${item.notes}` : ''}</p>
        <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
          <Button variant="ghost" className="w-full sm:w-auto" icon={<CalendarClock className="h-4 w-4" />} onClick={() => openEdit(item)}>Modifier</Button>
          <Button variant="ghost" className="w-full sm:w-auto" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => updateMaintenance({ ...item, status: 'Done', lastServiceDate: new Date().toISOString().slice(0, 10) })}>Marquer terminé</Button>
          <Button variant="ghost" className="w-full sm:w-auto" icon={<Trash2 className="h-4 w-4" />} onClick={async () => { if (!window.confirm('Supprimer cette fiche entretien ?')) return; await deleteMaintenance(item.id); notify({ title: 'Supprimé', message: 'La fiche entretien a été supprimée.', type: 'success' }); }}>Supprimer</Button>
        </div>
      </div>)}</div>}
    </Card>
    <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Modifier l’entretien' : 'Ajouter un entretien'}>
      <div className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1">
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Véhicule & service</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Véhicule *" value={form.vehicleId} onChange={(e) => setForm((c) => ({ ...c, vehicleId: e.target.value }))}><option value="">Choisir un véhicule</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}</SelectField>
            <SelectField label="Type de service *" value={form.serviceType} onChange={(e) => setForm((c) => ({ ...c, serviceType: e.target.value as MaintenanceItem['serviceType'], details: {} }))}>{SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}</SelectField>
          </div>
          {selectedFormVehicle ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3">
              <div className="grid h-14 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--app-surface)]">
                {selectedFormVehicle.imageUrl ? <img src={selectedFormVehicle.imageUrl} alt={`${selectedFormVehicle.brand} ${selectedFormVehicle.model}`} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <Car className="h-6 w-6 text-[var(--app-text-muted)]" />}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--app-text)]">{selectedFormVehicle.brand} {selectedFormVehicle.model}</p>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]"><PlateNumber value={selectedFormVehicle.plate} /> · {selectedFormVehicle.mileage.toLocaleString()} km</p>
              </div>
              <Badge>{selectedFormVehicle.status}</Badge>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Détails {form.serviceType}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {renderServiceDetails()}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Dates & kilométrage</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Dernière intervention *" type="date" value={form.lastServiceDate} onChange={(e) => setForm((c) => ({ ...c, lastServiceDate: e.target.value }))} />
            <Field label="Prochaine échéance *" type="date" value={form.nextServiceDate} onChange={(e) => setForm((c) => ({ ...c, nextServiceDate: e.target.value }))} />
            <Field label="Kilométrage actuel" type="number" min="0" value={form.currentMileage} onChange={(e) => setForm((c) => ({ ...c, currentMileage: e.target.value }))} />
            <Field label="Kilométrage intervention" type="number" min="0" value={form.mileageAtService} onChange={(e) => setForm((c) => ({ ...c, mileageAtService: e.target.value }))} />
            <Field label="Prochain kilométrage" type="number" min="0" value={form.nextServiceMileage} onChange={(e) => setForm((c) => ({ ...c, nextServiceMileage: e.target.value }))} />
            <SelectField label="Statut" value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as MaintenanceItem['status'] }))}>{STATUS_VALUES.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</SelectField>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Coût & garage</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Coût (MAD) *" type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm((c) => ({ ...c, cost: e.target.value }))} />
            <Field label="Garage / prestataire" value={form.providerName} onChange={(e) => setForm((c) => ({ ...c, providerName: e.target.value }))} />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Facture / photo</h3>
          <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-card)] p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-gold-300/25 bg-gold-400/15 text-[var(--app-gold-text)]">
                <ImagePlus className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-[var(--app-text)]">Justificatif optionnel</p>
                <p className="text-xs text-[var(--app-text-muted)]">Ajoutez un lien vers une facture ou une photo déjà hébergée.</p>
              </div>
              <Camera className="ml-auto h-5 w-5 text-[var(--app-text-muted)]" />
            </div>
            <Field label="Lien facture ou photo" value={form.invoiceUrl || ''} placeholder="https://..." onChange={(e) => setForm((c) => ({ ...c, invoiceUrl: e.target.value }))} />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Notes</h3>
          <TextAreaField label="Observations" value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} />
        </section>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button icon={<Wrench className="h-4 w-4" />} onClick={saveRecord}>{editing ? 'Mettre à jour' : 'Enregistrer'}</Button></div>
    </Modal>
  </div>;
}
