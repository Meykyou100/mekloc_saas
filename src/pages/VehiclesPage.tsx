import { AlertTriangle, Car, CheckCircle2, Edit3, Eye, Grid3X3, ImagePlus, List, Plus, Search, Trash2, Wrench } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Field, SelectField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatMAD, type DamageType, type Vehicle, type VehicleAccessories, type VehicleDamageMark, type VehicleStatus } from '../data/mockData';
import { safeStoragePath, validateFileUpload } from '../lib/security';
import { storageBuckets, supabase } from '../lib/supabase';

const vehicleStatuses: Array<'All' | VehicleStatus> = ['All', 'Available', 'Rented', 'Maintenance', 'Unavailable'];

type FormErrors = Partial<Record<'brand' | 'model' | 'plate' | 'year' | 'mileage' | 'dailyPrice', string>>;
const accessoryItems: Array<{ key: keyof VehicleAccessories; label: string }> = [
  { key: 'roue_secours', label: 'Roue de secours' },
  { key: 'cric', label: 'Cric' },
  { key: 'poste_radio', label: 'Poste radio' },
  { key: 'batterie', label: 'Batterie' },
  { key: 'allume_cigare', label: 'Allume cigare' },
  { key: 'siege_enfant', label: 'Siège enfant' },
  { key: 'porte_bagage', label: 'Porte bagage' },
  { key: 'triangle', label: 'Triangle' },
  { key: 'gilet', label: 'Gilet' },
  { key: 'documents_vehicule', label: 'Documents véhicule' },
];

const damageZones: Array<{ value: VehicleDamageMark['zone']; label: string }> = [
  { value: 'avant', label: 'Avant' },
  { value: 'arriere', label: 'Arrière' },
  { value: 'porte_gauche', label: 'Porte gauche' },
  { value: 'porte_droite', label: 'Porte droite' },
  { value: 'capot', label: 'Capot' },
  { value: 'coffre', label: 'Coffre' },
  { value: 'aile_gauche', label: 'Aile gauche' },
  { value: 'aile_droite', label: 'Aile droite' },
  { value: 'parechoc_avant', label: 'Pare-choc avant' },
  { value: 'parechoc_arriere', label: 'Pare-choc arrière' },
];

const damageTypes: Array<{ value: DamageType; label: string }> = [
  { value: 'rayure', label: 'Rayure' },
  { value: 'cassure', label: 'Cassure' },
  { value: 'eclat', label: 'Éclat' },
  { value: 'bosse', label: 'Bosse' },
  { value: 'peinture', label: 'Peinture' },
  { value: 'autre', label: 'Autre' },
];

function isDateExpired(date?: string) {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function isDateSoon(date?: string, days = 30) {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const limit = new Date();
  limit.setDate(now.getDate() + days);
  return d >= now && d <= limit;
}

function normalizeVehicleForm(form: FormData, base?: Vehicle): Vehicle {
  const accessories: VehicleAccessories = {};
  accessoryItems.forEach(({ key }) => {
    accessories[key] = form.get(`acc_${key}`) === 'on';
  });
  const damageMarksRaw = String(form.get('damageMarks') || '[]');
  let damageMarks: VehicleDamageMark[] = [];
  try {
    damageMarks = JSON.parse(damageMarksRaw) as VehicleDamageMark[];
  } catch {
    damageMarks = [];
  }
  return {
    id: base?.id || `veh-${Date.now()}`,
    brand: String(form.get('brand') || '').trim(),
    model: String(form.get('model') || '').trim(),
    plate: String(form.get('plate') || '').trim().toUpperCase(),
    year: Number(form.get('year') || 0),
    mileage: Number(form.get('mileage') || 0),
    fuel: String(form.get('fuel') || ''),
    transmission: String(form.get('transmission') || ''),
    dailyPrice: Number(form.get('dailyPrice') || 0),
    status: String(form.get('status')) as VehicleStatus,
    insuranceExpiry: String(form.get('insuranceExpiry') || ''),
    inspectionDate: String(form.get('inspectionDate') || ''),
    city: String(form.get('city') || '').trim(),
    revenue: base?.revenue || 0,
    imagePath: base?.imagePath,
    imageUrl: base?.imageUrl,
    vehicleColor: String(form.get('vehicleColor') || '').trim(),
    accessories,
    damageMarks,
  };
}

function validateVehicle(vehicle: Vehicle): FormErrors {
  const errors: FormErrors = {};
  const currentYear = new Date().getFullYear();
  if (!vehicle.brand) errors.brand = 'La marque est obligatoire.';
  if (!vehicle.model) errors.model = 'Le modèle est obligatoire.';
  if (!vehicle.plate) errors.plate = "L'immatriculation est obligatoire.";
  if (!vehicle.year || vehicle.year < 1980 || vehicle.year > currentYear + 1) errors.year = 'Année invalide.';
  if (!vehicle.mileage || vehicle.mileage < 0) errors.mileage = 'Le kilométrage doit être positif.';
  if (!vehicle.dailyPrice || vehicle.dailyPrice <= 0) errors.dailyPrice = 'Le prix / jour doit être supérieur à 0.';
  return errors;
}

export default function VehiclesPage() {
  const { vehicles, createVehicle, updateVehicle, deleteVehicle: removeVehicle } = useData();
  const { agencyId } = useAuth();
  const { notify } = useApp();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | VehicleStatus>('All');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [damageMarks, setDamageMarks] = useState<VehicleDamageMark[]>([]);
  const [damageZone, setDamageZone] = useState<VehicleDamageMark['zone']>('avant');
  const [damageType, setDamageType] = useState<DamageType>('rayure');
  const [damageNote, setDamageNote] = useState('');

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const haystack = `${vehicle.brand} ${vehicle.model} ${vehicle.plate} ${vehicle.city}`.toLowerCase();
        return haystack.includes(query.toLowerCase()) && (status === 'All' || vehicle.status === status);
      }),
    [query, status, vehicles],
  );

  const stats = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter((v) => v.status === 'Available').length;
    const rented = vehicles.filter((v) => v.status === 'Rented').length;
    const maintenance = vehicles.filter((v) => v.status === 'Maintenance' || v.status === 'Unavailable').length;
    const avgPrice = total ? Math.round(vehicles.reduce((sum, v) => sum + v.dailyPrice, 0) / total) : 0;
    return { total, available, rented, maintenance, avgPrice };
  }, [vehicles]);

  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalOpen]);

  function openNewVehicle() {
    setEditingVehicle(null);
    setImageFile(null);
    setImagePreview('');
    setErrors({});
    setDamageMarks([]);
    setDamageZone('avant');
    setDamageType('rayure');
    setDamageNote('');
    setModalOpen(true);
  }

  function openEditVehicle(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setImageFile(null);
    setImagePreview(vehicle.imageUrl || '');
    setErrors({});
    setDamageMarks(vehicle.damageMarks || []);
    setDamageZone('avant');
    setDamageType('rayure');
    setDamageNote('');
    setModalOpen(true);
  }

  async function uploadVehicleImage(vehicleId: string, file: File) {
    if (!supabase || !agencyId) return null;
    const validation = validateFileUpload(file, {
      maxSizeMb: 5,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    });
    if (validation) throw new Error(validation);
    const filePath = safeStoragePath(agencyId, `vehicles-${vehicleId}`, file.name || 'photo.jpg');
    const { error: uploadError } = await supabase.storage.from(storageBuckets.vehicleImages).upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(storageBuckets.vehicleImages).getPublicUrl(filePath);
    return { imageUrl: data.publicUrl, imagePath: filePath };
  }

  async function handleSaveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set('damageMarks', JSON.stringify(damageMarks));
    const vehicle = normalizeVehicleForm(form, editingVehicle || undefined);
    const nextErrors = validateVehicle(vehicle);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      if (imageFile) {
        const uploaded = await uploadVehicleImage(vehicle.id, imageFile);
        if (uploaded) {
          vehicle.imageUrl = uploaded.imageUrl;
          vehicle.imagePath = uploaded.imagePath;
        }
      }

      if (editingVehicle) {
        await updateVehicle(vehicle);
      } else {
        await createVehicle(vehicle);
      }

      setModalOpen(false);
      setImageFile(null);
      setImagePreview('');
      setErrors({});
      setDamageMarks([]);
      notify({
        title: editingVehicle ? 'Véhicule modifié' : 'Véhicule ajouté',
        message: `${vehicle.brand} ${vehicle.model} est bien enregistré.`,
        type: 'success',
      });
    } catch (error) {
      notify({
        title: 'Enregistrement impossible',
        message: error instanceof Error ? error.message : 'Réessayez.',
        type: 'warning',
      });
    } finally {
      setSaving(false);
    }
  }

  function addDamageMark() {
    setDamageMarks((prev) => [
      ...prev,
      { id: `dmg-${Date.now()}`, zone: damageZone, type: damageType, note: damageNote.trim() || undefined },
    ]);
    setDamageNote('');
  }

  function removeDamageMark(id: string) {
    setDamageMarks((prev) => prev.filter((item) => item.id !== id));
  }

  async function deleteVehicle(vehicle: Vehicle) {
    try {
      await removeVehicle(vehicle.id);
      notify({ title: 'Véhicule supprimé', message: `${vehicle.plate} a été retiré du parc.`, type: 'warning' });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Vehicle delete failed', error);
      notify({
        title: 'Suppression impossible',
        message: error instanceof Error ? error.message : 'Réessayez plus tard.',
        type: 'warning',
      });
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Parc automobile"
        title="Véhicules"
        description="Gérez vos véhicules, leur disponibilité, documents et tarification."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={openNewVehicle}>Ajouter un véhicule</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-carbon-500">Total</p><p className="mt-2 text-2xl font-black">{stats.total}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-carbon-500">Disponibles</p><p className="mt-2 text-2xl font-black text-emerald-300">{stats.available}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-carbon-500">Loués</p><p className="mt-2 text-2xl font-black text-sky-300">{stats.rented}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-carbon-500">Maintenance / indispo</p><p className="mt-2 text-2xl font-black text-amber-300">{stats.maintenance}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-carbon-500">Prix moyen / jour</p><p className="mt-2 text-2xl font-black text-gold-200">{formatMAD(stats.avgPrice)}</p></Card>
      </div>

      <Card className="mb-5 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 120))}
              placeholder="Rechercher marque, modèle, immatriculation, ville"
              className="form-control h-10 w-full rounded-xl pl-10 pr-4 text-sm"
            />
          </label>
          <div className="no-scrollbar flex overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {vehicleStatuses.map((item) => (
              <button
                key={item}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  status === item ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:bg-white/10'
                }`}
                onClick={() => setStatus(item)}
              >
                {item === 'All' ? 'Tous' : item}
              </button>
            ))}
          </div>
          <div className="ml-auto flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button className={`grid h-9 w-10 place-items-center rounded-lg ${view === 'grid' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300'}`} onClick={() => setView('grid')}><Grid3X3 className="h-4 w-4" /></button>
            <button className={`grid h-9 w-10 place-items-center rounded-lg ${view === 'table' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300'}`} onClick={() => setView('table')}><List className="h-4 w-4" /></button>
          </div>
        </div>
      </Card>

      {filteredVehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="Aucun véhicule trouvé"
          message="Aucun résultat avec ces filtres. Essayez une autre recherche ou ajoutez un véhicule."
          action="Ajouter un véhicule"
          onAction={openNewVehicle}
        />
      ) : view === 'grid' ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => {
            const insuranceExpired = isDateExpired(vehicle.insuranceExpiry);
            const inspectionExpired = isDateExpired(vehicle.inspectionDate);
            const insuranceSoon = !insuranceExpired && isDateSoon(vehicle.insuranceExpiry, 30);
            const inspectionSoon = !inspectionExpired && isDateSoon(vehicle.inspectionDate, 30);
            return (
              <Card key={vehicle.id} interactive className="group flex h-full flex-col overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="vehicle-visual relative h-48 w-full overflow-hidden rounded-t-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 md:h-52">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.14),transparent_58%)]" />
                  <div className="absolute inset-x-0 top-0 z-[1] h-20 bg-gradient-to-b from-black/55 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                  <div className="absolute left-4 top-4 z-10">
                    <Badge>{vehicle.status}</Badge>
                  </div>
                  <span className="absolute right-4 top-4 z-10 max-w-[46%] truncate rounded-full border border-gold-300/30 bg-carbon-950/85 px-3 py-1 text-xs font-bold text-gold-200 shadow-lg backdrop-blur">
                    {vehicle.plate}
                  </span>
                  {vehicle.imageUrl ? (
                    <img
                      src={vehicle.imageUrl}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="h-full w-full rounded-t-2xl object-cover object-center transition-transform duration-300 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="grid h-28 w-40 place-items-center rounded-2xl border border-white/15 bg-carbon-950/30 shadow-[0_18px_45px_rgba(0,0,0,.28)]">
                        <Car className="h-16 w-16 text-white/75" strokeWidth={1.4} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <Link to={`/vehicles/${vehicle.id}`} className="block">
                    <h3 className="text-xl font-black text-white hover:text-gold-200">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                  </Link>
                  <p className="mt-1 text-sm text-carbon-400">{vehicle.city || '—'} · {vehicle.year || '—'} · {vehicle.mileage.toLocaleString()} km</p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs text-carbon-500">Prix / jour</p>
                      <p className="mt-1 text-base font-black text-gold-200">{formatMAD(vehicle.dailyPrice)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs text-carbon-500">Kilométrage</p>
                      <p className="mt-1 text-base font-bold">{vehicle.mileage.toLocaleString()} km</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-carbon-400">Expiration assurance</span>
                      <span className={`${insuranceExpired ? 'text-red-300' : insuranceSoon ? 'text-amber-300' : 'text-carbon-200'} font-semibold`}>{vehicle.insuranceExpiry || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-carbon-400">Visite technique</span>
                      <span className={`${inspectionExpired ? 'text-red-300' : inspectionSoon ? 'text-amber-300' : 'text-carbon-200'} font-semibold`}>{vehicle.inspectionDate || '—'}</span>
                    </div>
                    {(insuranceExpired || inspectionExpired || insuranceSoon || inspectionSoon) && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(insuranceExpired || inspectionExpired) ? <Badge><AlertTriangle className="mr-1 h-3 w-3" /> Expiré</Badge> : null}
                        {(insuranceSoon || inspectionSoon) ? <Badge><Wrench className="mr-1 h-3 w-3" /> Bientôt</Badge> : null}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <Button variant="secondary" className="h-10 px-2 text-xs" icon={<Edit3 className="h-4 w-4" />} onClick={() => openEditVehicle(vehicle)}>Modifier</Button>
                    <Link to={`/vehicles/${vehicle.id}`}><Button variant="secondary" className="h-10 w-full px-2 text-xs" icon={<Eye className="h-4 w-4" />}>Détails</Button></Link>
                    <Button variant="danger" className="h-10 px-2 text-xs" icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteVehicle(vehicle)}>Supprimer</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-carbon-500">
                <tr>
                  <th className="px-5 py-4">Véhicule</th>
                  <th className="px-5 py-4">Immatriculation</th>
                  <th className="px-5 py-4">Ville</th>
                  <th className="px-5 py-4">Année</th>
                  <th className="px-5 py-4">Km</th>
                  <th className="px-5 py-4">Prix / jour</th>
                  <th className="px-5 py-4">Documents</th>
                  <th className="px-5 py-4">Statut</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-white/[0.035]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {vehicle.imageUrl ? (
                          <div className="grid h-10 w-12 place-items-center rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-950">
                            <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} className="h-8 w-11 object-contain" />
                          </div>
                        ) : (
                          <div className="grid h-10 w-12 place-items-center rounded-lg bg-white/5"><Car className="h-4 w-4 text-carbon-400" /></div>
                        )}
                        <Link to={`/vehicles/${vehicle.id}`} className="font-semibold hover:text-gold-200">{vehicle.brand} {vehicle.model}</Link>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-carbon-300">{vehicle.plate}</td>
                    <td className="px-5 py-4 text-carbon-300">{vehicle.city}</td>
                    <td className="px-5 py-4 text-carbon-300">{vehicle.year}</td>
                    <td className="px-5 py-4 text-carbon-300">{vehicle.mileage.toLocaleString()} km</td>
                    <td className="px-5 py-4 font-semibold text-gold-200">{formatMAD(vehicle.dailyPrice)}</td>
                    <td className="px-5 py-4 text-carbon-400">Ass. {vehicle.insuranceExpiry || '—'} · V.T. {vehicle.inspectionDate || '—'}</td>
                    <td className="px-5 py-4"><Badge>{vehicle.status}</Badge></td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-9 px-3" onClick={() => openEditVehicle(vehicle)}>Modifier</Button>
                        <Button variant="danger" className="h-9 px-3" onClick={() => deleteVehicle(vehicle)}>Supprimer</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} title={editingVehicle ? 'Modifier un véhicule' : 'Ajouter un véhicule'} onClose={() => setModalOpen(false)}>
        <form className="grid gap-5" onSubmit={handleSaveVehicle}>
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-carbon-400">Identification</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="Marque *" name="brand" defaultValue={editingVehicle?.brand || ''} required />
                {errors.brand ? <p className="mt-1 text-xs text-red-300">{errors.brand}</p> : null}
              </div>
              <div>
                <Field label="Modèle *" name="model" defaultValue={editingVehicle?.model || ''} required />
                {errors.model ? <p className="mt-1 text-xs text-red-300">{errors.model}</p> : null}
              </div>
              <div>
                <Field label="Immatriculation *" name="plate" defaultValue={editingVehicle?.plate || ''} required />
                {errors.plate ? <p className="mt-1 text-xs text-red-300">{errors.plate}</p> : null}
              </div>
              <div>
                <Field label="Année *" name="year" type="number" defaultValue={editingVehicle?.year || 2024} required />
                {errors.year ? <p className="mt-1 text-xs text-red-300">{errors.year}</p> : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-carbon-400">Informations techniques</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="Kilométrage *" name="mileage" type="number" defaultValue={editingVehicle?.mileage || 0} required />
                {errors.mileage ? <p className="mt-1 text-xs text-red-300">{errors.mileage}</p> : null}
              </div>
              <SelectField label="Carburant" name="fuel" defaultValue={editingVehicle?.fuel || 'Diesel'}>
                <option>Diesel</option><option>Petrol</option><option>Hybrid</option><option>Electric</option>
              </SelectField>
              <SelectField label="Transmission" name="transmission" defaultValue={editingVehicle?.transmission || 'Automatic'}>
                <option>Automatic</option><option>Manual</option>
              </SelectField>
              <SelectField label="Statut" name="status" defaultValue={editingVehicle?.status || 'Available'}>
                <option>Available</option><option>Rented</option><option>Maintenance</option><option>Unavailable</option>
              </SelectField>
              <Field label="Ville" name="city" defaultValue={editingVehicle?.city || ''} required />
              <Field label="Couleur du véhicule" name="vehicleColor" defaultValue={editingVehicle?.vehicleColor || ''} placeholder="Ex: Blanc, Noir, Gris" />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-carbon-400">État du véhicule</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {accessoryItems.map((item) => (
                <label key={item.key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name={`acc_${item.key}`}
                    defaultChecked={Boolean(editingVehicle?.accessories?.[item.key])}
                    className="h-4 w-4 accent-[#D4A017]"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-xs font-semibold text-carbon-400">Dommages (zone + type)</p>
              <div className="grid gap-2 sm:grid-cols-4">
                <SelectField label="Zone" value={damageZone} onChange={(e) => setDamageZone(e.target.value as VehicleDamageMark['zone'])}>
                  {damageZones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                </SelectField>
                <SelectField label="Type" value={damageType} onChange={(e) => setDamageType(e.target.value as DamageType)}>
                  {damageTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </SelectField>
                <Field label="Note" value={damageNote} onChange={(e) => setDamageNote(e.target.value)} placeholder="Optionnel" />
                <div className="flex items-end">
                  <Button type="button" variant="secondary" className="w-full" onClick={addDamageMark}>Ajouter</Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {damageMarks.length === 0 ? (
                  <p className="text-xs text-carbon-500">Aucun dommage signalé.</p>
                ) : (
                  damageMarks.map((mark) => (
                    <div key={mark.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                      <span>
                        {damageZones.find((z) => z.value === mark.zone)?.label || mark.zone} · {damageTypes.find((t) => t.value === mark.type)?.label || mark.type}
                        {mark.note ? ` · ${mark.note}` : ''}
                      </span>
                      <Button type="button" variant="danger" className="h-8 px-2 text-xs" onClick={() => removeDamageMark(mark.id)}>Retirer</Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-carbon-400">Tarification & documents</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="Prix / jour *" name="dailyPrice" type="number" defaultValue={editingVehicle?.dailyPrice || 0} required />
                {errors.dailyPrice ? <p className="mt-1 text-xs text-red-300">{errors.dailyPrice}</p> : null}
              </div>
              <Field label="Expiration assurance" name="insuranceExpiry" type="date" defaultValue={editingVehicle?.insuranceExpiry || ''} />
              <Field label="Visite technique" name="inspectionDate" type="date" defaultValue={editingVehicle?.inspectionDate || ''} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-carbon-400">Photo du véhicule</h3>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-6 text-center transition hover:border-gold-300/50 hover:bg-white/[0.04]">
              <ImagePlus className="h-6 w-6 text-gold-200" />
              <p className="mt-2 text-sm font-semibold">Ajouter une image depuis la galerie</p>
              <p className="mt-1 text-xs text-carbon-400">PNG, JPG, WEBP</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setImageFile(file);
                  if (file) setImagePreview(URL.createObjectURL(file));
                }}
              />
            </label>

            <div className="mt-3">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Aperçu véhicule" className="h-40 w-full rounded-xl object-cover sm:h-52" />
                  <button
                    type="button"
                    className="focus-ring absolute right-2 top-2 rounded-lg bg-carbon-950/80 px-2 py-1 text-xs text-white"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(editingVehicle?.imageUrl || '');
                    }}
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <div className="grid h-28 place-items-center rounded-xl border border-dashed border-white/20 text-sm text-carbon-400">
                  Aucune image sélectionnée
                </div>
              )}
            </div>
          </section>

          <div className="sticky bottom-0 -mx-4 mt-2 border-t border-white/10 bg-carbon-950/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-5 sm:px-5">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button type="submit" loading={saving} icon={!saving ? <CheckCircle2 className="h-4 w-4" /> : undefined}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
