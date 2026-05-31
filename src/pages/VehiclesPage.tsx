import { AlertTriangle, Car, CheckCircle2, Edit3, Eye, Grid3X3, ImagePlus, List, Plus, Search, Trash2, Wrench } from 'lucide-react';
import { FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Field, SelectField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import PlateNumber from '../components/ui/PlateNumber';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatMAD, type DamageType, type Vehicle, type VehicleAccessories, type VehicleDamageMark, type VehicleStatus } from '../data/mockData';
import { safeStoragePath, validateFileUpload } from '../lib/security';
import { storageBuckets, supabase } from '../lib/supabase';

type VehicleFilterStatus = 'All' | VehicleStatus | 'Archived';
const vehicleStatuses: VehicleFilterStatus[] = ['All', 'Available', 'Rented', 'Maintenance', 'Unavailable', 'Archived'];
const vehicleWizardSteps = ['Identification', 'Technique', 'État', 'Photos', 'Validation'];
const vehicleBrandModels: Record<string, string[]> = {
  Dacia: ['Duster', 'Sandero', 'Logan', 'Dokker', 'Lodgy', 'Spring'],
  Renault: ['Clio 4', 'Clio 5', 'Megane', 'Captur', 'Kangoo', 'Express'],
  Peugeot: ['208', '308', '301', '2008', '3008', 'Partner', 'Expert'],
  Citroën: ['C3', 'C4', 'C-Elysée', 'Berlingo', 'C5 Aircross'],
  Hyundai: ['i10', 'i20', 'Accent', 'Tucson', 'Creta', 'Santa Fe'],
  Kia: ['Picanto', 'Rio', 'Sportage', 'Sorento'],
  Toyota: ['Yaris', 'Corolla', 'Prado', 'RAV4', 'Hilux', 'Land Cruiser'],
  Volkswagen: ['Golf 7', 'Golf 8', 'Polo', 'Tiguan', 'Passat', 'T-Roc'],
  Fiat: ['500', 'Tipo', 'Doblo', 'Panda'],
  Opel: ['Corsa', 'Astra', 'Mokka', 'Crossland', 'Grandland'],
  Ford: ['Fiesta', 'Focus', 'Kuga', 'Transit'],
  Nissan: ['Micra', 'Qashqai', 'Juke', 'X-Trail'],
  Seat: ['Ibiza', 'Leon', 'Arona', 'Ateca'],
  Skoda: ['Fabia', 'Octavia', 'Kodiaq'],
  Mercedes: ['Classe A', 'Classe C', 'GLA', 'GLC', 'Vito'],
  BMW: ['Série 1', 'Série 3', 'X1', 'X3', 'X5'],
  Audi: ['A1', 'A3', 'A4', 'Q3', 'Q5'],
  'Range Rover': ['Evoque', 'Sport', 'Velar'],
  Jeep: ['Renegade', 'Compass', 'Wrangler'],
};
const vehicleBrands = Object.keys(vehicleBrandModels);
const moroccanPlateLetters = ['أ', 'ب', 'د', 'هـ', 'ه', 'و', 'ط'];
const plateAllowedPattern = /^[0-9A-Za-z\u0600-\u06FF\s-]+$/;
const vehicleColorOptions = [
  { name: 'Rouge', swatch: '#c62828' },
  { name: 'Blanc', swatch: '#f8fafc' },
  { name: 'Noir', swatch: '#050505' },
  { name: 'Gris', swatch: '#8a8f98' },
  { name: 'Bleu', swatch: '#2563eb' },
  { name: 'Argent', swatch: '#c0c7d1' },
  { name: 'Beige', swatch: '#d6c3a5' },
  { name: 'Marron', swatch: '#7a4a2f' },
  { name: 'Vert', swatch: '#16803c' },
  { name: 'Orange', swatch: '#f97316' },
];
const quickVehicleColors = vehicleColorOptions.slice(0, 7);

type FormErrors = Partial<Record<'brand' | 'model' | 'plate' | 'year' | 'mileage' | 'city' | 'dailyPrice' | 'insuranceExpiry' | 'inspectionDate', string>>;
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
    plate: String(form.get('plate') || '').trim(),
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
    archivedAt: base?.archivedAt,
  };
}

function validateVehicle(vehicle: Vehicle): FormErrors {
  const errors: FormErrors = {};
  const currentYear = new Date().getFullYear();
  const isValidDate = (value: string) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
  if (!vehicle.brand) errors.brand = 'La marque est obligatoire.';
  if (!vehicle.model) errors.model = 'Le modèle est obligatoire.';
  if (!vehicle.plate) errors.plate = "L'immatriculation est obligatoire.";
  else if (!plateAllowedPattern.test(vehicle.plate)) errors.plate = 'Format matricule invalide. Exemple: 65528-أ-8 ou WW-123456';
  if (!vehicle.year || vehicle.year < 1980 || vehicle.year > currentYear + 1) errors.year = 'Année invalide.';
  if (!vehicle.mileage || vehicle.mileage < 0) errors.mileage = 'Le kilométrage doit être positif.';
  if (!vehicle.city) errors.city = 'La ville est obligatoire.';
  if (!vehicle.dailyPrice || vehicle.dailyPrice <= 0) errors.dailyPrice = 'Le prix / jour doit être supérieur à 0.';
  if (!vehicle.insuranceExpiry) errors.insuranceExpiry = "Date d’assurance obligatoire";
  else if (!isValidDate(vehicle.insuranceExpiry)) errors.insuranceExpiry = "Date d’assurance invalide";
  if (!vehicle.inspectionDate) errors.inspectionDate = 'Date de visite technique obligatoire';
  else if (!isValidDate(vehicle.inspectionDate)) errors.inspectionDate = 'Date de visite technique invalide';
  return errors;
}

export default function VehiclesPage() {
  const { vehicles, reservations, contracts, payments, maintenance, createVehicle, updateVehicle, deleteVehicle: removeVehicle } = useData();
  const { agencyId } = useAuth();
  const { notify } = useApp();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<VehicleFilterStatus>('All');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [modalOpen, setModalOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [damageMarks, setDamageMarks] = useState<VehicleDamageMark[]>([]);
  const [accessoryDraft, setAccessoryDraft] = useState<VehicleAccessories>({});
  const [damageZone, setDamageZone] = useState<VehicleDamageMark['zone']>('avant');
  const [damageType, setDamageType] = useState<DamageType>('rayure');
  const [damageNote, setDamageNote] = useState('');
  const [vehicleBrandDraft, setVehicleBrandDraft] = useState('');
  const [vehicleModelDraft, setVehicleModelDraft] = useState('');
  const [vehiclePlateDraft, setVehiclePlateDraft] = useState('');
  const [vehicleColorDraft, setVehicleColorDraft] = useState('');
  const [vehicleYearDraft, setVehicleYearDraft] = useState('2024');
  const [vehicleMileageDraft, setVehicleMileageDraft] = useState('0');
  const [vehicleFuelDraft, setVehicleFuelDraft] = useState('Diesel');
  const [vehicleTransmissionDraft, setVehicleTransmissionDraft] = useState('Automatic');
  const [vehicleCityDraft, setVehicleCityDraft] = useState('');
  const [vehicleStatusDraft, setVehicleStatusDraft] = useState<VehicleStatus>('Available');
  const [vehicleDailyPriceDraft, setVehicleDailyPriceDraft] = useState('0');
  const [vehicleInsuranceDraft, setVehicleInsuranceDraft] = useState('');
  const [vehicleInspectionDraft, setVehicleInspectionDraft] = useState('');
  const [vehicleWizardStep, setVehicleWizardStep] = useState(0);
  const [brandSelectorOpen, setBrandSelectorOpen] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [brandSelectorSearch, setBrandSelectorSearch] = useState('');
  const [modelSelectorSearch, setModelSelectorSearch] = useState('');
  const [colorSuggestionsOpen, setColorSuggestionsOpen] = useState(false);
  const [highlightedColorIndex, setHighlightedColorIndex] = useState(0);
  const selectedBrandModels = vehicleBrandModels[vehicleBrandDraft] || [];
  const filteredBrandOptions = useMemo(() => {
    const q = brandSelectorSearch.trim().toLowerCase();
    const allBrands = vehicleBrands.filter((brand) => !q || brand.toLowerCase().includes(q));
    if (q && !allBrands.some((brand) => brand.toLowerCase() === q)) return [...allBrands, brandSelectorSearch.trim()].filter(Boolean);
    return allBrands;
  }, [brandSelectorSearch]);
  const filteredModelOptions = useMemo(() => {
    const q = modelSelectorSearch.trim().toLowerCase();
    const baseModels = selectedBrandModels.length ? selectedBrandModels : vehicles.filter((vehicle) => vehicle.brand === vehicleBrandDraft).map((vehicle) => vehicle.model);
    const uniqueModels = Array.from(new Set(baseModels));
    const matches = uniqueModels.filter((model) => !q || model.toLowerCase().includes(q));
    if (q && !matches.some((model) => model.toLowerCase() === q)) return [...matches, modelSelectorSearch.trim()].filter(Boolean);
    return matches;
  }, [modelSelectorSearch, selectedBrandModels, vehicleBrandDraft, vehicles]);
  const normalizedQuery = useMemo(() => debouncedQuery.trim().toLowerCase(), [debouncedQuery]);
  const colorSuggestions = useMemo(() => {
    const q = vehicleColorDraft.trim().toLowerCase();
    if (!q) return vehicleColorOptions;
    return vehicleColorOptions.filter((color) => color.name.toLowerCase().includes(q));
  }, [vehicleColorDraft]);

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const haystack = `${vehicle.brand} ${vehicle.model} ${vehicle.plate} ${vehicle.city}`.toLowerCase();
        const archiveHit = status === 'Archived' ? Boolean(vehicle.archivedAt) : !vehicle.archivedAt;
        return haystack.includes(normalizedQuery) && archiveHit && (status === 'All' || status === 'Archived' || vehicle.status === status);
      }),
    [normalizedQuery, status, vehicles],
  );

  const stats = useMemo(() => {
    const activeVehicles = vehicles.filter((vehicle) => !vehicle.archivedAt);
    const total = activeVehicles.length;
    const available = activeVehicles.filter((v) => v.status === 'Available').length;
    const rented = activeVehicles.filter((v) => v.status === 'Rented').length;
    const maintenance = activeVehicles.filter((v) => v.status === 'Maintenance' || v.status === 'Unavailable').length;
    const archived = vehicles.filter((vehicle) => vehicle.archivedAt).length;
    const avgPrice = total ? Math.round(activeVehicles.reduce((sum, v) => sum + v.dailyPrice, 0) / total) : 0;
    return { total, available, rented, maintenance, archived, avgPrice };
  }, [vehicles]);

  const vehicleStatCards = [
    { label: 'Total', value: String(stats.total), tone: 'text-[var(--app-text)]', helper: 'Véhicules actifs', icon: Car, accent: 'from-gold-400/16' },
    { label: 'Disponibles', value: String(stats.available), tone: 'text-emerald-300 light:text-emerald-700', helper: 'Prêts à louer', icon: CheckCircle2, accent: 'from-emerald-400/14' },
    { label: 'Loués', value: String(stats.rented), tone: 'text-sky-300 light:text-sky-700', helper: 'En circulation', icon: Car, accent: 'from-sky-400/14' },
    { label: 'Maintenance', value: String(stats.maintenance), tone: 'text-amber-300 light:text-amber-700', helper: 'À suivre', icon: Wrench, accent: 'from-amber-400/14' },
    { label: 'Prix moyen / jour', value: formatMAD(stats.avgPrice), tone: 'text-[var(--app-gold-text)]', helper: `Archivés: ${stats.archived}`, icon: AlertTriangle, accent: 'from-violet-400/14' },
  ];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery((current) => (current === query ? current : query));
    }, 160);
    return () => window.clearTimeout(timer);
  }, [query]);

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
    setAccessoryDraft({});
    setDamageZone('avant');
    setDamageType('rayure');
    setDamageNote('');
    setVehicleBrandDraft('');
    setVehicleModelDraft('');
    setVehiclePlateDraft('');
    setVehicleColorDraft('');
    setVehicleYearDraft('2024');
    setVehicleMileageDraft('0');
    setVehicleFuelDraft('Diesel');
    setVehicleTransmissionDraft('Automatic');
    setVehicleCityDraft('');
    setVehicleStatusDraft('Available');
    setVehicleDailyPriceDraft('0');
    setVehicleInsuranceDraft('');
    setVehicleInspectionDraft('');
    setVehicleWizardStep(0);
    setBrandSelectorOpen(false);
    setModelSelectorOpen(false);
    setBrandSelectorSearch('');
    setModelSelectorSearch('');
    setColorSuggestionsOpen(false);
    setHighlightedColorIndex(0);
    setModalOpen(true);
  }

  function openEditVehicle(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setImageFile(null);
    setImagePreview(vehicle.imageUrl || '');
    setErrors({});
    setDamageMarks(vehicle.damageMarks || []);
    setAccessoryDraft(vehicle.accessories || {});
    setDamageZone('avant');
    setDamageType('rayure');
    setDamageNote('');
    setVehicleBrandDraft(vehicle.brand);
    setVehicleModelDraft(vehicle.model);
    setVehiclePlateDraft(vehicle.plate);
    setVehicleColorDraft(vehicle.vehicleColor || '');
    setVehicleYearDraft(String(vehicle.year || 2024));
    setVehicleMileageDraft(String(vehicle.mileage || 0));
    setVehicleFuelDraft(vehicle.fuel || 'Diesel');
    setVehicleTransmissionDraft(vehicle.transmission || 'Automatic');
    setVehicleCityDraft(vehicle.city || '');
    setVehicleStatusDraft(vehicle.status);
    setVehicleDailyPriceDraft(String(vehicle.dailyPrice || 0));
    setVehicleInsuranceDraft(vehicle.insuranceExpiry || '');
    setVehicleInspectionDraft(vehicle.inspectionDate || '');
    setVehicleWizardStep(0);
    setBrandSelectorOpen(false);
    setModelSelectorOpen(false);
    setBrandSelectorSearch('');
    setModelSelectorSearch('');
    setColorSuggestionsOpen(false);
    setHighlightedColorIndex(0);
    setModalOpen(true);
  }

  function insertPlateLetter(letter: string) {
    setVehiclePlateDraft((current) => {
      const value = current.trim();
      const parts = value.split('-').map((part) => part.trim());
      if (/^W/i.test(parts[0] || '')) return value || letter;
      if (parts.length >= 3) return `${parts[0]}-${letter}-${parts.slice(2).join('-')}`;
      const numberGroups = value.match(/\d+/g);
      if (numberGroups && numberGroups.length >= 2) return `${numberGroups[0]}-${letter}-${numberGroups[1]}`;
      if (numberGroups?.[0]) return `${numberGroups[0]}-${letter}-`;
      return letter;
    });
  }

  function applyPlateFormat(format: 'morocco' | 'ww') {
    setVehiclePlateDraft((current) => {
      const value = current.trim();
      if (format === 'ww') {
        const digits = value.match(/\d+/g)?.join('') || '';
        return digits ? `WW-${digits}` : 'WW-';
      }
      const numberGroups = value.match(/\d+/g) || [];
      const arabicLetter = value.match(/[\u0600-\u06FF]/)?.[0] || 'أ';
      if (numberGroups.length >= 2) return `${numberGroups[0]}-${arabicLetter}-${numberGroups[1]}`;
      if (numberGroups[0]) return `${numberGroups[0]}-${arabicLetter}-`;
      return `65528-${arabicLetter}-8`;
    });
  }

  function selectVehicleColor(color: string) {
    setVehicleColorDraft(color);
    setColorSuggestionsOpen(false);
    setHighlightedColorIndex(0);
  }

  function handleColorKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!colorSuggestionsOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setColorSuggestionsOpen(true);
      return;
    }
    if (!colorSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedColorIndex((current) => (current + 1) % colorSuggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedColorIndex((current) => (current - 1 + colorSuggestions.length) % colorSuggestions.length);
    } else if (event.key === 'Enter' && colorSuggestionsOpen) {
      event.preventDefault();
      selectVehicleColor(colorSuggestions[highlightedColorIndex]?.name || vehicleColorDraft);
    } else if (event.key === 'Escape') {
      setColorSuggestionsOpen(false);
    }
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
    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.values(nextErrors)[0];
      notify({ title: 'Champ obligatoire', message: firstError || 'Vérifiez les informations du véhicule.', type: 'warning' });
      return;
    }

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
      if (import.meta.env.DEV) console.error('Vehicle save failed', error);
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

  function vehicleHasLinkedRecords(vehicle: Vehicle) {
    const linkedReservations = reservations.filter((item) => item.vehicleId === vehicle.id).length;
    const linkedContracts = contracts.filter((item) => item.vehicleId === vehicle.id).length;
    const linkedPayments = payments.filter((item) => item.vehicleId === vehicle.id).length;
    const linkedMaintenance = maintenance.filter((item) => item.vehicleId === vehicle.id).length;
    return linkedReservations + linkedContracts + linkedPayments + linkedMaintenance > 0;
  }

  async function confirmDeleteVehicle() {
    if (!vehicleToDelete) return;
    const hasLinkedRecords = vehicleHasLinkedRecords(vehicleToDelete);
    try {
      await removeVehicle(vehicleToDelete.id);
      notify({
        title: hasLinkedRecords ? 'Véhicule archivé' : 'Véhicule supprimé',
        message: hasLinkedRecords ? `${vehicleToDelete.plate} est masqué de la liste normale.` : `${vehicleToDelete.plate} a été retiré du parc.`,
        type: hasLinkedRecords ? 'success' : 'warning',
      });
      setVehicleToDelete(null);
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
    <div className="overflow-x-hidden pb-[calc(108px+env(safe-area-inset-bottom))] md:pb-6">
      <div className="mb-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.22)] md:hidden">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--app-gold-text)]">PARC AUTOMOBILE</p>
            <h1 className="mt-0.5 text-2xl font-black leading-none text-[var(--app-text)]">Véhicules</h1>
            <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">Gérez vos véhicules, disponibilité et tarification.</p>
          </div>
          <button
            type="button"
            onClick={openNewVehicle}
            className="focus-ring inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#D4A017] px-3 text-xs font-black text-black shadow-[0_12px_28px_rgba(212,160,23,.18)] transition hover:bg-[#f1c232]"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>
      </div>

      <div className="hidden md:block">
        <PageHeader
          eyebrow="Parc automobile"
          title="Véhicules"
          description="Gérez vos véhicules, leur disponibilité, documents et tarification."
          action={
            <Button
              className="h-12 rounded-2xl px-5 shadow-[0_0_34px_rgba(212,160,23,0.18)]"
              icon={<Plus className="h-4 w-4" />}
              onClick={openNewVehicle}
            >
              Ajouter un véhicule
            </Button>
          }
        />
      </div>

      <div className="no-scrollbar -mx-4 mb-2.5 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:mb-5 xl:grid-cols-5">
        {vehicleStatCards.map(({ label, value, tone, helper, icon: Icon, accent }) => (
          <div
            key={label}
            className="relative min-h-[108px] min-w-[132px] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_14px_36px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.05)] sm:min-w-0 sm:p-4 md:min-h-[118px]"
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accent} to-transparent`} />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-2 md:gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[10px] font-black uppercase leading-3 tracking-[0.12em] text-[var(--app-text-muted)] md:leading-4">{label}</p>
                  <p className={`mt-2 truncate text-[1.35rem] font-black leading-none sm:text-2xl ${tone}`}>{value}</p>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[14px] border border-[#D4A017]/20 bg-[#D4A017]/10 text-[var(--app-gold-text)] shadow-[0_0_20px_rgba(212,160,23,0.10)] md:h-9 md:w-9">
                  <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </span>
              </div>
              <p className="mt-2 truncate text-[11px] font-semibold text-[var(--app-text-muted)] md:mt-3">{helper}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="mb-3 rounded-3xl border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[0_18px_46px_rgba(0,0,0,.24)] md:mb-5 md:p-4">
        <div className="grid gap-2.5 md:gap-3 xl:grid-cols-[minmax(260px,1fr)_auto_auto] xl:items-center">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 120))}
              placeholder="Rechercher marque, modèle, immatriculation, ville"
              className="form-control h-10 w-full rounded-xl border-[var(--app-border)] bg-[var(--app-input)] pl-10 pr-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.035)] md:h-12 md:rounded-2xl"
            />
          </label>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {vehicleStatuses.map((item) => (
              <button
                key={item}
                className={`focus-ring h-9 shrink-0 whitespace-nowrap rounded-xl px-3 text-xs font-black transition md:h-10 md:text-sm ${
                  status === item ? 'bg-gold-400 text-carbon-950 shadow-[0_10px_22px_rgba(212,160,23,.14)]' : 'border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] hover:bg-[var(--app-gold-soft)]'
                }`}
                onClick={() => setStatus(item)}
              >
                {item === 'All' ? 'Tous' : item === 'Archived' ? 'Archivés' : item}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-1 md:flex md:rounded-2xl">
            <button className={`focus-ring grid h-9 min-w-0 place-items-center rounded-lg md:h-10 md:rounded-xl ${view === 'grid' ? 'bg-gold-400 text-carbon-950' : 'text-[var(--app-text-soft)]'}`} onClick={() => setView('grid')} aria-label="Vue cartes"><Grid3X3 className="h-4 w-4" /></button>
            <button className={`focus-ring grid h-9 min-w-0 place-items-center rounded-lg md:h-10 md:rounded-xl ${view === 'table' ? 'bg-gold-400 text-carbon-950' : 'text-[var(--app-text-soft)]'}`} onClick={() => setView('table')} aria-label="Vue tableau"><List className="h-4 w-4" /></button>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {filteredVehicles.map((vehicle) => {
            const insuranceExpired = isDateExpired(vehicle.insuranceExpiry);
            const inspectionExpired = isDateExpired(vehicle.inspectionDate);
            const insuranceSoon = !insuranceExpired && isDateSoon(vehicle.insuranceExpiry, 30);
            const inspectionSoon = !inspectionExpired && isDateSoon(vehicle.inspectionDate, 30);
            return (
              <Card key={vehicle.id} interactive className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-0 shadow-[0_14px_38px_rgba(0,0,0,.30),inset_0_1px_0_rgba(255,255,255,.04)] transition-all hover:border-[#D4A017]/35">
                <div className="vehicle-visual relative aspect-[16/8.6] w-full overflow-hidden bg-[var(--app-surface-soft)] md:aspect-[16/10]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.14),transparent_58%)]" />
                  <div className="absolute inset-x-0 top-0 z-[1] h-24 bg-gradient-to-b from-black/70 via-black/28 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-black/65 via-black/12 to-transparent" />
                  <div className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
                    <Badge>{vehicle.archivedAt ? 'Archivé' : vehicle.status}</Badge>
                  </div>
                  <span className="absolute right-3 top-3 z-10 inline-flex max-w-[72%] items-center rounded-full border border-yellow-500/30 bg-[var(--app-card)] px-3 py-1.5 text-xs font-semibold text-[var(--app-gold-text)] shadow-lg backdrop-blur sm:right-4 sm:top-4">
                    <PlateNumber value={vehicle.plate} className="max-w-full truncate" />
                  </span>
                  {vehicle.imageUrl ? (
                    <img
                      src={vehicle.imageUrl}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="grid h-24 w-36 place-items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-[0_18px_45px_rgba(0,0,0,.18)] sm:h-28 sm:w-40">
                        <Car className="h-16 w-16 text-[var(--app-text-muted)]" strokeWidth={1.4} />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-[var(--app-text)] drop-shadow sm:text-xl">{vehicle.brand} {vehicle.model}</p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-[var(--app-text-soft)]">{vehicle.city || 'Ville non renseignée'} · {vehicle.year || '—'}</p>
                    </div>
                    <p className="shrink-0 rounded-full border border-[#D4A017]/25 bg-[#D4A017]/15 px-2.5 py-1 text-xs font-black text-[var(--app-gold-text)]">{formatMAD(vehicle.dailyPrice)}</p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-3.5 md:p-5">
                  <Link to={`/vehicles/${vehicle.id}`} className="block">
                    <h3 className="truncate text-base font-black text-[var(--app-text)] hover:text-[var(--app-gold-text)] md:text-xl">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                  </Link>
                  <p className="mt-1 truncate text-xs text-[var(--app-text-muted)] md:text-sm">{vehicle.city || '—'} · {vehicle.year || '—'} · {vehicle.mileage.toLocaleString()} km</p>

                  <div className="mt-3 grid grid-cols-2 gap-2 md:mt-4 md:gap-2.5">
                    <div className="min-w-0 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2.5 md:p-3">
                      <p className="text-xs text-[var(--app-text-muted)]">Prix / jour</p>
                      <p className="mt-1 truncate text-sm font-black text-[var(--app-gold-text)] md:text-base">{formatMAD(vehicle.dailyPrice)}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2.5 md:p-3">
                      <p className="text-xs text-[var(--app-text-muted)]">Kilométrage</p>
                      <p className="mt-1 truncate text-sm font-bold text-[var(--app-text)] md:text-base">{vehicle.mileage.toLocaleString()} km</p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2.5 text-xs md:mt-4 md:gap-2 md:p-3 md:text-sm">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="truncate text-[var(--app-text-muted)]">Expiration assurance</span>
                      <span className={`${insuranceExpired ? 'text-red-300 light:text-red-700' : insuranceSoon ? 'text-amber-300 light:text-amber-700' : 'text-[var(--app-text-soft)]'} shrink-0 font-semibold`}>{vehicle.insuranceExpiry || '—'}</span>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="truncate text-[var(--app-text-muted)]">Visite technique</span>
                      <span className={`${inspectionExpired ? 'text-red-300 light:text-red-700' : inspectionSoon ? 'text-amber-300 light:text-amber-700' : 'text-[var(--app-text-soft)]'} shrink-0 font-semibold`}>{vehicle.inspectionDate || '—'}</span>
                    </div>
                    {(insuranceExpired || inspectionExpired || insuranceSoon || inspectionSoon) && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(insuranceExpired || inspectionExpired) ? <Badge><AlertTriangle className="mr-1 h-3 w-3" /> Expiré</Badge> : null}
                        {(insuranceSoon || inspectionSoon) ? <Badge><Wrench className="mr-1 h-3 w-3" /> Bientôt</Badge> : null}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:mt-5">
                    <Button variant="secondary" className="h-10 min-w-0 rounded-xl px-2 text-xs sm:h-10" icon={<Edit3 className="h-4 w-4 shrink-0" />} onClick={() => openEditVehicle(vehicle)}>Modifier</Button>
                    <Link to={`/vehicles/${vehicle.id}`} className="min-w-0"><Button variant="secondary" className="h-10 w-full min-w-0 rounded-xl px-2 text-xs sm:h-10" icon={<Eye className="h-4 w-4 shrink-0" />}>Détails</Button></Link>
                    <Button variant="danger" className="col-span-2 h-10 min-w-0 rounded-xl px-2 text-xs sm:col-span-1 sm:h-10" icon={<Trash2 className="h-4 w-4 shrink-0" />} onClick={() => setVehicleToDelete(vehicle)}>Supprimer</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden rounded-3xl border-[var(--app-border)] bg-[var(--app-card)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-[var(--app-border)] text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
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
              <tbody className="divide-y divide-[var(--app-border)]">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-[var(--app-surface-soft)]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {vehicle.imageUrl ? (
                          <div className="grid h-10 w-12 place-items-center rounded-lg bg-[var(--app-surface-soft)]">
                            <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} loading="lazy" decoding="async" className="h-8 w-11 object-contain" />
                          </div>
                        ) : (
                          <div className="grid h-10 w-12 place-items-center rounded-lg bg-[var(--app-surface-soft)]"><Car className="h-4 w-4 text-[var(--app-text-muted)]" /></div>
                        )}
                        <Link to={`/vehicles/${vehicle.id}`} className="font-semibold hover:text-[var(--app-gold-text)]">{vehicle.brand} {vehicle.model}</Link>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--app-text-soft)]"><PlateNumber value={vehicle.plate} /></td>
                    <td className="px-5 py-4 text-[var(--app-text-soft)]">{vehicle.city}</td>
                    <td className="px-5 py-4 text-[var(--app-text-soft)]">{vehicle.year}</td>
                    <td className="px-5 py-4 text-[var(--app-text-soft)]">{vehicle.mileage.toLocaleString()} km</td>
                    <td className="px-5 py-4 font-semibold text-[var(--app-gold-text)]">{formatMAD(vehicle.dailyPrice)}</td>
                    <td className="px-5 py-4 text-[var(--app-text-muted)]">Ass. {vehicle.insuranceExpiry || '—'} · V.T. {vehicle.inspectionDate || '—'}</td>
                    <td className="px-5 py-4"><Badge>{vehicle.archivedAt ? 'Archivé' : vehicle.status}</Badge></td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-9 rounded-xl px-3" onClick={() => openEditVehicle(vehicle)}>Modifier</Button>
                        <Button variant="danger" className="h-9 rounded-xl px-3" onClick={() => setVehicleToDelete(vehicle)}>Supprimer</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        title={editingVehicle ? 'Modifier un véhicule' : 'Ajouter un véhicule'}
        subtitle="Ajoutez un véhicule à votre flotte."
        onClose={() => setModalOpen(false)}
        panelClassName="sm:max-w-5xl lg:max-h-[92dvh]"
        bodyClassName="p-0 sm:p-0"
      >
        <form className="grid min-h-full grid-rows-[auto_1fr_auto]" onSubmit={handleSaveVehicle} noValidate>
          <div className="border-b border-[var(--app-border)] bg-[var(--app-modal)]/95 px-3 py-2.5 sm:px-6">
            <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-0 sm:overflow-visible sm:px-0">
              {vehicleWizardSteps.map((step, index) => (
                <button
                  key={step}
                  type="button"
                  className="group relative min-w-[82px] px-0.5 text-center sm:min-w-0"
                  onClick={() => setVehicleWizardStep(index)}
                >
                  {index > 0 ? <span className={`absolute left-0 top-3.5 h-px w-1/2 ${vehicleWizardStep >= index ? 'bg-gold-400/80' : 'bg-[var(--app-surface-soft)]'}`} /> : null}
                  {index < vehicleWizardSteps.length - 1 ? <span className={`absolute right-0 top-3.5 h-px w-1/2 ${vehicleWizardStep > index ? 'bg-gold-400/80' : 'bg-[var(--app-surface-soft)]'}`} /> : null}
                  <span className={`relative mx-auto grid h-7 w-7 place-items-center rounded-full border text-[11px] font-black transition sm:h-8 sm:w-8 sm:text-xs ${
                    vehicleWizardStep === index
                      ? 'border-gold-300 bg-gold-400 text-carbon-950 shadow-[0_0_22px_rgba(212,160,23,.24)]'
                      : vehicleWizardStep > index
                        ? 'border-gold-300/45 bg-gold-400/12 text-[var(--app-gold-text)]'
                        : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-muted)] group-hover:text-[var(--app-text-soft)]'
                  }`}>
                    {vehicleWizardStep > index ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className={`mt-1 block truncate text-[8.5px] font-black uppercase tracking-[0.06em] sm:text-[10px] ${vehicleWizardStep === index ? 'text-[var(--app-gold-text)]' : 'text-[var(--app-text-muted)]'}`}>
                    {step}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto px-3 py-3 pb-6 sm:px-6 sm:py-5">
          <section className={`${vehicleWizardStep === 0 ? 'block' : 'hidden'} rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] sm:rounded-3xl sm:p-4`}>
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Identification</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <PremiumVehicleSelector
                  label="Marque *"
                  value={vehicleBrandDraft}
                  placeholder="Choisir ou saisir une marque"
                  open={brandSelectorOpen}
                  search={brandSelectorSearch}
                  options={filteredBrandOptions}
                  onOpenChange={setBrandSelectorOpen}
                  onSearchChange={setBrandSelectorSearch}
                  onSelect={(brand) => {
                    setVehicleBrandDraft(brand);
                    setVehicleModelDraft('');
                    setBrandSelectorOpen(false);
                    setBrandSelectorSearch('');
                  }}
                />
                <input type="hidden" name="brand" value={vehicleBrandDraft} required />
                {errors.brand ? <p className="mt-1 text-xs text-red-300">{errors.brand}</p> : null}
              </div>
              <div>
                <PremiumVehicleSelector
                  label="Modèle *"
                  value={vehicleModelDraft}
                  placeholder={selectedBrandModels.length ? 'Choisir ou saisir un modèle' : 'Saisir un modèle'}
                  open={modelSelectorOpen}
                  search={modelSelectorSearch}
                  options={filteredModelOptions}
                  onOpenChange={setModelSelectorOpen}
                  onSearchChange={setModelSelectorSearch}
                  onSelect={(model) => {
                    setVehicleModelDraft(model);
                    setModelSelectorOpen(false);
                    setModelSelectorSearch('');
                  }}
                />
                <input type="hidden" name="model" value={vehicleModelDraft} required />
                {selectedBrandModels.length ? <p className="mt-1 text-xs text-[var(--app-text-muted)]">{selectedBrandModels.length} modèles courants disponibles.</p> : null}
                {errors.model ? <p className="mt-1 text-xs text-red-300">{errors.model}</p> : null}
              </div>
              <div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--app-text-soft)] light:text-carbon-700">Immatriculation *</span>
                  <input
                    className="form-control plate-number w-full"
                    dir="ltr"
                    style={{ direction: 'ltr', unicodeBidi: 'plaintext', textAlign: 'left' }}
                    name="plate"
                    value={vehiclePlateDraft}
                    onChange={(event) => setVehiclePlateDraft(event.target.value)}
                    placeholder="Ex: 65528-أ-8 ou WW-123456"
                    required
                  />
                </label>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">Format Maroc : numéro - lettre arabe - code ville.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--app-text-muted)]">Format</span>
                  <button
                    type="button"
                    className="h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 text-xs font-bold text-[var(--app-text)] transition hover:border-gold-300/40 hover:bg-gold-400/15 hover:text-[var(--app-gold-text)]"
                    onClick={() => applyPlateFormat('morocco')}
                  >
                    Maroc
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 text-xs font-bold text-[var(--app-text)] transition hover:border-gold-300/40 hover:bg-gold-400/15 hover:text-[var(--app-gold-text)]"
                    onClick={() => applyPlateFormat('ww')}
                  >
                    WW
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs font-semibold text-[var(--app-text-muted)]">Lettre</span>
                  {moroccanPlateLetters.map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      className="grid h-9 min-w-9 place-items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-2 text-sm font-bold text-[var(--app-text)] transition hover:border-gold-300/40 hover:bg-gold-400/15 hover:text-[var(--app-gold-text)]"
                      onClick={() => insertPlateLetter(letter)}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
                {errors.plate ? <p className="mt-1 text-xs text-red-300">{errors.plate}</p> : null}
              </div>
              <div>
                <Field label="Année *" name="year" type="number" value={vehicleYearDraft} onChange={(event) => setVehicleYearDraft(event.target.value)} required />
                {errors.year ? <p className="mt-1 text-xs text-red-300">{errors.year}</p> : null}
              </div>
            </div>
          </section>

          <section className={`${vehicleWizardStep === 1 ? 'block' : 'hidden'} rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] sm:rounded-3xl sm:p-4`}>
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Informations techniques</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="Kilométrage *" name="mileage" type="number" value={vehicleMileageDraft} onChange={(event) => setVehicleMileageDraft(event.target.value)} required />
                {errors.mileage ? <p className="mt-1 text-xs text-red-300">{errors.mileage}</p> : null}
              </div>
              <SelectField label="Carburant" name="fuel" value={vehicleFuelDraft} onChange={(event) => setVehicleFuelDraft(event.target.value)}>
                <option>Diesel</option><option>Petrol</option><option>Hybrid</option><option>Electric</option>
              </SelectField>
              <SelectField label="Transmission" name="transmission" value={vehicleTransmissionDraft} onChange={(event) => setVehicleTransmissionDraft(event.target.value)}>
                <option>Automatic</option><option>Manual</option>
              </SelectField>
              <SelectField label="Statut" name="status" value={vehicleStatusDraft} onChange={(event) => setVehicleStatusDraft(event.target.value as VehicleStatus)}>
                <option>Available</option><option>Rented</option><option>Maintenance</option><option>Unavailable</option>
              </SelectField>
              <label className="grid gap-2 text-sm font-medium text-[var(--app-text-soft)] light:text-carbon-700">
                <span>Ville</span>
                <input
                  className="form-control focus-ring h-11 w-full text-base sm:text-sm"
                  name="city"
                  value={vehicleCityDraft}
                  onChange={(event) => setVehicleCityDraft(event.target.value)}
                  placeholder="Ex: Casablanca, Marrakech, Fès"
                  required
                />
                {errors.city ? <p className="mt-1 text-xs text-red-300">{errors.city}</p> : null}
              </label>
              <div className="relative">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--app-text-soft)] light:text-carbon-700">Couleur du véhicule</span>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-[var(--app-border)]"
                      style={{ backgroundColor: vehicleColorOptions.find((color) => color.name.toLowerCase() === vehicleColorDraft.trim().toLowerCase())?.swatch || 'transparent' }}
                    />
                    <input
                      className="form-control w-full pl-10"
                      name="vehicleColor"
                      value={vehicleColorDraft}
                      onChange={(event) => {
                        setVehicleColorDraft(event.target.value);
                        setColorSuggestionsOpen(true);
                        setHighlightedColorIndex(0);
                      }}
                      onFocus={() => setColorSuggestionsOpen(true)}
                      onBlur={() => window.setTimeout(() => setColorSuggestionsOpen(false), 140)}
                      onKeyDown={handleColorKeyDown}
                      placeholder="Ex: Blanc, Noir, Gris"
                      autoComplete="off"
                    />
                  </div>
                </label>
                {colorSuggestionsOpen && colorSuggestions.length ? (
                  <div className="absolute left-0 right-0 top-[74px] z-40 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-2xl backdrop-blur">
                    {colorSuggestions.slice(0, 8).map((color, index) => (
                      <button
                        key={color.name}
                        type="button"
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                          highlightedColorIndex === index ? 'bg-gold-400/15 text-[var(--app-gold-text)]' : 'text-[var(--app-text-soft)] hover:bg-[var(--app-surface-soft)]'
                        }`}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setHighlightedColorIndex(index)}
                        onClick={() => selectVehicleColor(color.name)}
                      >
                        <span className="h-4 w-4 rounded-full border border-[var(--app-border)]" style={{ backgroundColor: color.swatch }} />
                        <span className="font-semibold">{color.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quickVehicleColors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition ${
                        vehicleColorDraft.trim().toLowerCase() === color.name.toLowerCase()
                          ? 'border-gold-300/45 bg-gold-400/15 text-[var(--app-gold-text)]'
                          : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] hover:border-gold-300/25 hover:bg-[var(--app-gold-soft)]'
                      }`}
                      onClick={() => selectVehicleColor(color.name)}
                    >
                      <span className="h-3 w-3 rounded-full border border-[var(--app-border)]" style={{ backgroundColor: color.swatch }} />
                      {color.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={`${vehicleWizardStep === 2 ? 'block' : 'hidden'} rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] sm:rounded-3xl sm:p-4`}>
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">État du véhicule</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {accessoryItems.map((item) => (
                <label key={item.key} className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name={`acc_${item.key}`}
                    checked={Boolean(accessoryDraft[item.key])}
                    onChange={(event) => setAccessoryDraft((current) => ({ ...current, [item.key]: event.target.checked }))}
                    className="h-4 w-4 accent-[#D4A017]"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--app-text-muted)]">Dommages (zone + type)</p>
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
                  <p className="text-xs text-[var(--app-text-muted)]">Aucun dommage signalé.</p>
                ) : (
                  damageMarks.map((mark) => (
                    <div key={mark.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm">
                      <span className="min-w-0">
                        {damageZones.find((z) => z.value === mark.zone)?.label || mark.zone} · {damageTypes.find((t) => t.value === mark.type)?.label || mark.type}
                        {mark.note ? ` · ${mark.note}` : ''}
                      </span>
                      <Button type="button" variant="danger" className="h-9 rounded-xl px-2.5 text-xs" onClick={() => removeDamageMark(mark.id)}>Retirer</Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className={`${vehicleWizardStep === 4 ? 'block' : 'hidden'} rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] sm:rounded-3xl sm:p-4`}>
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Tarification & documents</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="Prix / jour *" name="dailyPrice" type="number" value={vehicleDailyPriceDraft} onChange={(event) => setVehicleDailyPriceDraft(event.target.value)} required />
                {errors.dailyPrice ? <p className="mt-1 text-xs text-red-300">{errors.dailyPrice}</p> : null}
              </div>
              <div>
                <Field label="Expiration assurance *" name="insuranceExpiry" type="date" value={vehicleInsuranceDraft} onChange={(event) => setVehicleInsuranceDraft(event.target.value)} required />
                {errors.insuranceExpiry ? <p className="mt-1 text-xs text-red-300">{errors.insuranceExpiry}</p> : null}
              </div>
              <div>
                <Field label="Visite technique *" name="inspectionDate" type="date" value={vehicleInspectionDraft} onChange={(event) => setVehicleInspectionDraft(event.target.value)} required />
                {errors.inspectionDate ? <p className="mt-1 text-xs text-red-300">{errors.inspectionDate}</p> : null}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-gold-300/15 bg-[var(--app-card)] p-3 sm:p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Récapitulatif final</p>
                  <h4 className="mt-1 truncate text-lg font-black text-[var(--app-text)]">{vehicleBrandDraft || 'Marque'} {vehicleModelDraft || 'Modèle'}</h4>
                  <p className="mt-1 truncate text-sm text-[var(--app-text-muted)]"><PlateNumber value={vehiclePlateDraft || '—'} /> · {vehicleYearDraft || 'Année'}</p>
                </div>
                <Badge>{vehicleStatusDraft}</Badge>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <VehicleRecapLine label="Kilométrage" value={`${Number(vehicleMileageDraft || 0).toLocaleString()} km`} />
                <VehicleRecapLine label="Carburant" value={vehicleFuelDraft || '—'} />
                <VehicleRecapLine label="Transmission" value={vehicleTransmissionDraft || '—'} />
                <VehicleRecapLine label="Ville" value={vehicleCityDraft || '—'} />
                <VehicleRecapLine label="Couleur" value={vehicleColorDraft || '—'} />
                <VehicleRecapLine label="Prix / jour" value={formatMAD(Number(vehicleDailyPriceDraft || 0))} />
                <VehicleRecapLine label="Équipements" value={`${accessoryItems.filter((item) => accessoryDraft[item.key]).length} sélectionné(s)`} />
                <VehicleRecapLine label="Dommages" value={damageMarks.length ? `${damageMarks.length} signalé(s)` : 'Aucun'} />
                <VehicleRecapLine label="Photo" value={imagePreview ? 'Photo ajoutée' : 'Aucune photo'} />
              </div>
            </div>
          </section>

          <section className={`${vehicleWizardStep === 3 ? 'block' : 'hidden'} rounded-2xl border border-gold-300/15 bg-[var(--app-card)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] sm:rounded-3xl sm:p-4`}>
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Photo du véhicule</h3>
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-6 text-center transition hover:border-gold-300/50 hover:bg-[var(--app-surface-soft)]">
              <ImagePlus className="h-6 w-6 text-[var(--app-gold-text)]" />
              <p className="mt-2 text-sm font-semibold">Ajouter une image depuis la galerie</p>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">PNG, JPG, WEBP</p>
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
                  <img src={imagePreview} alt="Aperçu véhicule" loading="lazy" decoding="async" className="aspect-[16/10] w-full rounded-2xl object-cover" />
                  <button
                    type="button"
                    className="focus-ring absolute right-2 top-2 min-h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-xs font-semibold text-[var(--app-text)] backdrop-blur"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(editingVehicle?.imageUrl || '');
                    }}
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <div className="grid h-32 place-items-center rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] text-sm text-[var(--app-text-muted)]">
                  Aucune image sélectionnée
                </div>
              )}
            </div>
          </section>

          </div>
          <div className="sticky bottom-0 border-t border-[var(--app-border)] bg-[var(--app-modal)]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur sm:px-6 sm:pb-3">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
              {vehicleWizardStep === 0 ? (
                <Button type="button" variant="secondary" className="h-11 rounded-xl" onClick={() => setModalOpen(false)}>Annuler</Button>
              ) : (
                <Button type="button" variant="secondary" className="h-11 rounded-xl" disabled={saving} onClick={() => setVehicleWizardStep((step) => Math.max(0, step - 1))}>Retour</Button>
              )}
              {vehicleWizardStep < vehicleWizardSteps.length - 1 ? (
                <Button type="button" className="h-11 rounded-xl" disabled={saving} onClick={() => setVehicleWizardStep((step) => Math.min(vehicleWizardSteps.length - 1, step + 1))}>
                  Continuer
                </Button>
              ) : (
                <Button type="submit" className="h-11 rounded-xl" loading={saving} icon={!saving ? <CheckCircle2 className="h-4 w-4" /> : undefined}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(vehicleToDelete)} title={vehicleToDelete && vehicleHasLinkedRecords(vehicleToDelete) ? 'Archiver le véhicule' : 'Supprimer le véhicule'} onClose={() => setVehicleToDelete(null)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
            <p className="font-semibold text-rose-100 light:text-rose-700">
              {vehicleToDelete && vehicleHasLinkedRecords(vehicleToDelete) ? 'Ce véhicule est lié à des opérations existantes.' : 'Cette suppression est définitive.'}
            </p>
            <p className="mt-2 text-sm text-[var(--app-text-soft)]">
              {vehicleToDelete && vehicleHasLinkedRecords(vehicleToDelete)
                ? 'Il sera archivé et masqué de la liste normale, tout en restant visible dans les anciens contrats et réservations.'
                : 'Le véhicule sera retiré du parc si aucun contrat, paiement, entretien ou réservation ne le bloque.'}
            </p>
          </div>
          <p className="text-sm text-[var(--app-text-soft)]">Véhicule: <strong>{vehicleToDelete?.brand} {vehicleToDelete?.model}</strong></p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVehicleToDelete(null)}>Annuler</Button>
            <Button type="button" variant="danger" onClick={confirmDeleteVehicle}>
              {vehicleToDelete && vehicleHasLinkedRecords(vehicleToDelete) ? 'Archiver véhicule' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PremiumVehicleSelector({
  label,
  value,
  placeholder,
  open,
  search,
  options,
  onOpenChange,
  onSearchChange,
  onSelect,
}: {
  label: string;
  value: string;
  placeholder: string;
  open: boolean;
  search: string;
  options: string[];
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="mb-2 block text-sm font-semibold text-[var(--app-text-soft)] light:text-carbon-700">{label}</span>
      <button
        type="button"
        className={`focus-ring flex h-11 w-full items-center justify-between gap-3 rounded-2xl border px-3 text-left text-sm transition ${
          open ? 'border-gold-300/45 bg-gold-400/10 text-[var(--app-gold-text)]' : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text)] hover:border-gold-300/25'
        }`}
        onClick={() => onOpenChange(!open)}
      >
        <span className={value ? 'truncate font-semibold text-[var(--app-text)]' : 'truncate text-[var(--app-text-muted)]'}>{value || placeholder}</span>
        <Search className="h-4 w-4 shrink-0 text-[var(--app-gold-text)]" />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[74px] z-50 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-2xl backdrop-blur">
          <div className="border-b border-[var(--app-border)] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
              <input
                className="form-control h-10 w-full rounded-xl pl-9 text-sm"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Rechercher ou saisir..."
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {options.length ? options.map((option) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold transition ${
                    selected ? 'bg-gold-400 text-carbon-950' : 'text-[var(--app-text-soft)] hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]'
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(option)}
                >
                  <span className="truncate">{option}</span>
                  {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                </button>
              );
            }) : (
              <button
                type="button"
                className="min-h-11 w-full rounded-xl px-3 text-left text-sm font-semibold text-[var(--app-gold-text)] hover:bg-gold-400/10"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => search.trim() && onSelect(search.trim())}
              >
                Utiliser “{search.trim() || 'valeur personnalisée'}”
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VehicleRecapLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2">
      <span className="text-[var(--app-text-muted)]">{label}</span>
      <strong className="min-w-0 truncate text-right text-[var(--app-text)]">{value}</strong>
    </div>
  );
}
