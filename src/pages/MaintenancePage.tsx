import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ClipboardList, ShieldAlert, Trash2, Wrench } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Field, SelectField, TextAreaField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { formatMAD, type MaintenanceItem } from '../data/mockData';

const SERVICE_TYPES: MaintenanceItem['serviceType'][] = ['Vidange', 'Assurance', 'Visite technique', 'Pneus', 'Freins', 'Réparation', 'Autre'];
const STATUS_VALUES: MaintenanceItem['status'][] = ['Scheduled', 'Done', 'Due soon', 'Overdue'];

export default function MaintenancePage() {
  const { vehicles, maintenance, createMaintenance, updateMaintenance, deleteMaintenance } = useData();
  const { notify } = useApp();
  const [open, setOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [form, setForm] = useState<Omit<MaintenanceItem, 'id' | 'vehicle'>>({
    vehicleId: '',
    plate: '',
    serviceType: 'Vidange',
    lastServiceDate: '',
    nextServiceDate: '',
    currentMileage: 0,
    mileageAtService: 0,
    nextServiceMileage: 0,
    cost: 0,
    providerName: '',
    status: 'Scheduled',
    notes: '',
    invoiceUrl: '',
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

  function openCreate() {
    setEditing(null);
    setForm({ vehicleId: '', plate: '', serviceType: 'Vidange', lastServiceDate: '', nextServiceDate: '', currentMileage: 0, mileageAtService: 0, nextServiceMileage: 0, cost: 0, providerName: '', status: 'Scheduled', notes: '', invoiceUrl: '' });
    setOpen(true);
  }
  function openEdit(item: MaintenanceItem) {
    setEditing(item);
    setForm({ ...item, invoiceUrl: item.invoiceUrl || '' });
    setOpen(true);
  }
  async function saveRecord() {
    const vehicle = vehicles.find((v) => v.id === form.vehicleId);
    if (!vehicle) return notify({ title: 'Vehicle required', message: 'Please select a vehicle.', type: 'warning' });
    const payload: MaintenanceItem = { id: editing?.id || `mnt-${Date.now()}`, vehicle: `${vehicle.brand} ${vehicle.model}`, ...form, plate: vehicle.plate };
    try {
      if (editing) await updateMaintenance(payload); else await createMaintenance(payload);
      notify({ title: editing ? 'Record updated' : 'Record created', message: 'Maintenance record saved successfully.', type: 'success' });
      setOpen(false);
    } catch (error) {
      notify({ title: 'Action failed', message: error instanceof Error ? error.message : 'Try again.', type: 'warning' });
    }
  }

  return <div>
    <PageHeader eyebrow="Opérations flotte" title="Entretien" description="Suivez les interventions, les coûts, les échéances et l’historique des véhicules." action={<Button onClick={openCreate}>Ajouter un entretien</Button>} />
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="p-4"><p className="text-xs text-carbon-400">Insurance reminders</p><p className="mt-2 text-2xl font-bold">{insuranceReminders}</p></Card>
      <Card className="p-4"><p className="text-xs text-carbon-400">Oil change reminders</p><p className="mt-2 text-2xl font-bold">{oilReminders}</p></Card>
      <Card className="p-4"><p className="text-xs text-carbon-400">Technical inspections</p><p className="mt-2 text-2xl font-bold">{inspectionReminders}</p></Card>
      <Card className="p-4"><p className="text-xs text-carbon-400">Cost this month</p><p className="mt-2 text-2xl font-bold text-gold-200">{formatMAD(monthlyCost)}</p></Card>
    </div>
    <Card className="mt-6 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Registre des entretiens</h2>
        <select className="form-control w-56" value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)}>
          <option value="all">Tous les véhicules</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model}</option>)}
        </select>
      </div>
      {!filtered.length ? <EmptyState icon={ClipboardList} title="Ajouter votre premier entretien" message="Une fois ajouté, les rappels et l’historique apparaîtront ici." action="Ajouter un entretien" onAction={openCreate} /> :
      <div className="grid gap-3">{filtered.map((item) => <div key={item.id} className="premium-surface rounded-2xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div><p className="font-semibold">{item.vehicle} {item.plate ? `· ${item.plate}` : ''}</p><p className="mt-1 text-sm text-carbon-400">{item.serviceType} · Last: {item.lastServiceDate} · Next: {item.nextServiceDate}</p><p className="mt-1 text-sm text-carbon-400">Mileage {item.currentMileage.toLocaleString()} km · Next at {item.nextServiceMileage.toLocaleString()} km</p></div>
          <div className="text-right"><Badge>{item.status}</Badge><p className="mt-2 font-semibold text-gold-200">{formatMAD(item.cost)}</p></div>
        </div>
        <p className="mt-2 text-sm text-carbon-400">{item.providerName || 'No provider'}{item.notes ? ` · ${item.notes}` : ''}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" icon={<CalendarClock className="h-4 w-4" />} onClick={() => openEdit(item)}>Edit</Button>
          <Button variant="ghost" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => updateMaintenance({ ...item, status: 'Done', lastServiceDate: new Date().toISOString().slice(0, 10) })}>Mark as done</Button>
          <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={async () => { if (!window.confirm('Delete this maintenance record?')) return; await deleteMaintenance(item.id); notify({ title: 'Deleted', message: 'Maintenance record removed.', type: 'success' }); }}>Delete</Button>
        </div>
      </div>)}</div>}
    </Card>
    <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Modifier l’entretien' : 'Ajouter un entretien'}>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="Véhicule" value={form.vehicleId} onChange={(e) => setForm((c) => ({ ...c, vehicleId: e.target.value }))}><option value="">Choisir un véhicule</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}</SelectField>
        <SelectField label="Service type" value={form.serviceType} onChange={(e) => setForm((c) => ({ ...c, serviceType: e.target.value as MaintenanceItem['serviceType'] }))}>{SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}</SelectField>
        <Field label="Last service date" type="date" value={form.lastServiceDate} onChange={(e) => setForm((c) => ({ ...c, lastServiceDate: e.target.value }))} />
        <Field label="Next service date" type="date" value={form.nextServiceDate} onChange={(e) => setForm((c) => ({ ...c, nextServiceDate: e.target.value }))} />
        <Field label="Current mileage" type="number" value={form.currentMileage} onChange={(e) => setForm((c) => ({ ...c, currentMileage: Number(e.target.value) }))} />
        <Field label="Mileage at service" type="number" value={form.mileageAtService} onChange={(e) => setForm((c) => ({ ...c, mileageAtService: Number(e.target.value) }))} />
        <Field label="Next service mileage" type="number" value={form.nextServiceMileage} onChange={(e) => setForm((c) => ({ ...c, nextServiceMileage: Number(e.target.value) }))} />
        <Field label="Cost (MAD)" type="number" value={form.cost} onChange={(e) => setForm((c) => ({ ...c, cost: Number(e.target.value) }))} />
        <Field label="Garage / provider" value={form.providerName} onChange={(e) => setForm((c) => ({ ...c, providerName: e.target.value }))} />
        <SelectField label="Status" value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as MaintenanceItem['status'] }))}>{STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}</SelectField>
        <div className="md:col-span-2"><TextAreaField label="Notes" value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} /></div>
        <div className="md:col-span-2"><Field label="Invoice/photo upload placeholder (URL)" value={form.invoiceUrl || ''} onChange={(e) => setForm((c) => ({ ...c, invoiceUrl: e.target.value }))} /></div>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button icon={<Wrench className="h-4 w-4" />} onClick={saveRecord}>{editing ? 'Mettre à jour' : 'Enregistrer'}</Button></div>
    </Modal>
  </div>;
}
