import { Car, Edit3, Eye, Grid3X3, List, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Field, SelectField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { formatMAD, type Vehicle, type VehicleStatus } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

const vehicleStatuses: Array<'All' | VehicleStatus> = ['All', 'Available', 'Rented', 'Maintenance', 'Unavailable'];

export default function VehiclesPage() {
  const { vehicles, createVehicle, updateVehicle, deleteVehicle: removeVehicle } = useData();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | VehicleStatus>('All');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const { notify } = useApp();

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const haystack = `${vehicle.brand} ${vehicle.model} ${vehicle.plate} ${vehicle.city}`.toLowerCase();
      return haystack.includes(query.toLowerCase()) && (status === 'All' || vehicle.status === status);
    });
  }, [query, status, vehicles]);

  function openNewVehicle() {
    setEditingVehicle(null);
    setModalOpen(true);
  }

  function openEditVehicle(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setModalOpen(true);
  }

  async function handleSaveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const vehicle: Vehicle = {
      id: editingVehicle?.id || `veh-${Date.now()}`,
      brand: String(form.get('brand')),
      model: String(form.get('model')),
      plate: String(form.get('plate')),
      year: Number(form.get('year')),
      mileage: Number(form.get('mileage')),
      fuel: String(form.get('fuel')),
      transmission: String(form.get('transmission')),
      dailyPrice: Number(form.get('dailyPrice')),
      status: String(form.get('status')) as VehicleStatus,
      insuranceExpiry: String(form.get('insuranceExpiry')),
      inspectionDate: String(form.get('inspectionDate')),
      city: String(form.get('city')),
      revenue: editingVehicle?.revenue || 0,
    };

    try {
      if (editingVehicle) {
        await updateVehicle(vehicle);
      } else {
        await createVehicle(vehicle);
      }
      setModalOpen(false);
      notify({
        title: editingVehicle ? 'Vehicle updated' : 'Vehicle added',
        message: `${vehicle.brand} ${vehicle.model} is now in the fleet list.`,
        type: 'success',
      });
    } catch (error) {
      notify({
        title: 'Vehicle not saved',
        message: error instanceof Error ? error.message : 'Try again later.',
        type: 'warning',
      });
    }
  }

  async function deleteVehicle(vehicle: Vehicle) {
    try {
      await removeVehicle(vehicle.id);
      notify({ title: 'Vehicle removed', message: `${vehicle.plate} was deleted from the fleet list.`, type: 'warning' });
    } catch (error) {
      notify({
        title: 'Vehicle not deleted',
        message: error instanceof Error ? error.message : 'Try again later.',
        type: 'warning',
      });
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Fleet"
        title="Vehicles"
        description="Track availability, pricing, mileage, documents, and service readiness for every vehicle."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={openNewVehicle}>Add vehicle</Button>}
      />

      <Card className="mb-5 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search brand, model, plate, or city"
              className="form-control focus-ring h-10 w-full rounded-xl pl-10 pr-4 text-sm light:bg-white light:text-carbon-950"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {vehicleStatuses.map((item) => (
              <button
                key={item}
                className={`focus-ring rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  status === item ? 'bg-gold-400 text-carbon-950' : 'border border-white/10 bg-white/[0.04] text-carbon-300 hover:bg-white/10 light:text-carbon-700'
                }`}
                onClick={() => setStatus(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
            <button
              className={`focus-ring grid h-9 w-10 place-items-center rounded-lg ${view === 'grid' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300'}`}
              onClick={() => setView('grid')}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              className={`focus-ring grid h-9 w-10 place-items-center rounded-lg ${view === 'table' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300'}`}
              onClick={() => setView('table')}
              aria-label="Table view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {filteredVehicles.length === 0 ? (
        <EmptyState icon={Car} title="No vehicles found" message="Try a different search or add a new fleet vehicle." action="Add vehicle" onAction={openNewVehicle} />
      ) : view === 'grid' ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <Card key={vehicle.id} interactive className="overflow-hidden">
              <div className="vehicle-visual relative h-44 p-5">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.08),transparent_46%,rgba(0,0,0,.32))]" />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex justify-between gap-3">
                    <Badge>{vehicle.status}</Badge>
                    <span className="rounded-full bg-carbon-950/70 px-3 py-1 text-xs font-bold text-gold-200">{vehicle.plate}</span>
                  </div>
                  <div className="ml-auto grid h-24 w-32 place-items-center rounded-[2rem] border border-white/10 bg-carbon-950/35 text-white/75 shadow-2xl">
                    <Car className="h-16 w-16" strokeWidth={1.3} />
                  </div>
                </div>
              </div>
              <div className="p-5">
                <Link to={`/vehicles/${vehicle.id}`} className="block">
                  <h3 className="text-xl font-black text-white hover:text-gold-200 light:text-carbon-950">
                    {vehicle.brand} {vehicle.model}
                  </h3>
                </Link>
                <p className="mt-1 text-sm text-carbon-400">{vehicle.city} · {vehicle.year} · {vehicle.mileage.toLocaleString()} km</p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="premium-surface rounded-2xl p-3">
                    <p className="text-carbon-500">Daily price</p>
                    <p className="mt-1 font-bold text-white light:text-carbon-950">{formatMAD(vehicle.dailyPrice)}</p>
                  </div>
                  <div className="premium-surface rounded-2xl p-3">
                    <p className="text-carbon-500">Mileage</p>
                    <p className="mt-1 font-bold text-white light:text-carbon-950">{vehicle.mileage.toLocaleString()} km</p>
                  </div>
                </div>
                <div className="premium-surface mt-4 grid gap-2 rounded-2xl p-3 text-sm text-carbon-400">
                  <p className="flex justify-between gap-3">Insurance <span className="font-semibold text-carbon-200 light:text-carbon-800">{vehicle.insuranceExpiry}</span></p>
                  <p className="flex justify-between gap-3">Inspection <span className="font-semibold text-carbon-200 light:text-carbon-800">{vehicle.inspectionDate}</span></p>
                </div>
                <div className="mt-5 grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Button variant="secondary" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEditVehicle(vehicle)}>Edit</Button>
                  <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={() => undefined}>
                    <Link to={`/vehicles/${vehicle.id}`}>Details</Link>
                  </Button>
                  <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteVehicle(vehicle)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-carbon-500">
                <tr>
                  <th className="px-5 py-4">Vehicle</th>
                  <th className="px-5 py-4">Plate</th>
                  <th className="px-5 py-4">Year</th>
                  <th className="px-5 py-4">Mileage</th>
                  <th className="px-5 py-4">Fuel</th>
                  <th className="px-5 py-4">Daily price</th>
                  <th className="px-5 py-4">Documents</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-white/[0.035]">
                    <td className="px-5 py-4 font-bold text-white light:text-carbon-950">
                      <Link to={`/vehicles/${vehicle.id}`}>{vehicle.brand} {vehicle.model}</Link>
                    </td>
                    <td className="px-5 py-4 text-carbon-300">{vehicle.plate}</td>
                    <td className="px-5 py-4 text-carbon-300">{vehicle.year}</td>
                    <td className="px-5 py-4 text-carbon-300">{vehicle.mileage.toLocaleString()} km</td>
                    <td className="px-5 py-4 text-carbon-300">{vehicle.fuel}</td>
                    <td className="px-5 py-4 text-carbon-100 light:text-carbon-900">{formatMAD(vehicle.dailyPrice)}</td>
                    <td className="px-5 py-4 text-carbon-400">Ins. {vehicle.insuranceExpiry} · Insp. {vehicle.inspectionDate}</td>
                    <td className="px-5 py-4"><Badge>{vehicle.status}</Badge></td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-9 px-3" onClick={() => openEditVehicle(vehicle)}>Edit</Button>
                        <Button variant="danger" className="h-9 px-3" onClick={() => deleteVehicle(vehicle)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} title={editingVehicle ? 'Edit vehicle' : 'Add vehicle'} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSaveVehicle}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand" name="brand" defaultValue={editingVehicle?.brand || 'Toyota'} required />
            <Field label="Model" name="model" defaultValue={editingVehicle?.model || 'Prado'} required />
            <Field label="Plate number" name="plate" defaultValue={editingVehicle?.plate || '1200-Z-6'} required />
            <Field label="Year" name="year" type="number" defaultValue={editingVehicle?.year || 2024} required />
            <Field label="Mileage" name="mileage" type="number" defaultValue={editingVehicle?.mileage || 12000} required />
            <SelectField label="Fuel type" name="fuel" defaultValue={editingVehicle?.fuel || 'Diesel'}>
              <option>Diesel</option>
              <option>Petrol</option>
              <option>Hybrid</option>
              <option>Electric</option>
            </SelectField>
            <SelectField label="Transmission" name="transmission" defaultValue={editingVehicle?.transmission || 'Automatic'}>
              <option>Automatic</option>
              <option>Manual</option>
            </SelectField>
            <Field label="Daily price" name="dailyPrice" type="number" defaultValue={editingVehicle?.dailyPrice || 950} required />
            <SelectField label="Status" name="status" defaultValue={editingVehicle?.status || 'Available'}>
              <option>Available</option>
              <option>Rented</option>
              <option>Maintenance</option>
              <option>Unavailable</option>
            </SelectField>
            <Field label="City" name="city" defaultValue={editingVehicle?.city || 'Marrakech'} required />
            <Field label="Insurance expiry" name="insuranceExpiry" type="date" defaultValue={editingVehicle?.insuranceExpiry || '2026-09-20'} required />
            <Field label="Technical inspection date" name="inspectionDate" type="date" defaultValue={editingVehicle?.inspectionDate || '2026-08-20'} required />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save vehicle</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
