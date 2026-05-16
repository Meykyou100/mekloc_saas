import { BellRing, Building2, Camera, FileSignature, Globe2, Loader2, MessageCircle, Percent, Save, ShieldCheck, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { normalizeText, sanitizeText, validateEmail, validateFileUpload, validatePhone } from '../lib/security';
import { uploadAgencyLogo } from '../lib/storage';
import { supabase } from '../lib/supabase';

function extractErrorMessage(error: unknown) {
  if (!error) return 'Réessayez.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const maybe = error as { message?: unknown; details?: unknown; hint?: unknown };
    const msg = typeof maybe.message === 'string' ? maybe.message : '';
    const details = typeof maybe.details === 'string' ? maybe.details : '';
    const hint = typeof maybe.hint === 'string' ? maybe.hint : '';
    return [msg, details, hint].filter(Boolean).join(' · ') || 'Réessayez.';
  }
  return 'Réessayez.';
}

function extractMissingColumnName(message: string) {
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];
  const postgresMatch = message.match(/column ["']?([a-zA-Z0-9_]+)["']? does not exist/i);
  if (postgresMatch?.[1]) return postgresMatch[1];
  return null;
}

export default function SettingsPage() {
  const { notify } = useApp();
  const { agencyId, isSupabaseEnabled, profile, signOut, deleteAccountWithPassword, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState('Général');
  const tabs = ['Général', 'Contrats', 'Facturation', 'Abonnement', 'Équipe', 'Notifications'];
  const agency = profile?.agency;
  const billingStatusFr =
    agency?.billingStatus === 'trial' ? 'Essai' :
    agency?.billingStatus === 'paid' ? 'Payé' :
    agency?.billingStatus === 'unpaid' ? 'Non payé' :
    agency?.billingStatus === 'overdue' ? 'En retard' : 'Annulé';
  const billingTypeFr = (agency as { billingType?: 'monthly' | 'annual' } | null)?.billingType === 'annual' ? 'Annuel' : 'Mensuel';
  const nextPaymentDate = agency?.nextPaymentDueDate || null;
  const endDate = agency?.subscriptionEndDate || null;
  const now = new Date();
  const nextDiff = nextPaymentDate ? Math.ceil((new Date(nextPaymentDate).getTime() - now.getTime()) / 86400000) : null;
  const endDiff = endDate ? Math.ceil((new Date(endDate).getTime() - now.getTime()) / 86400000) : null;
  const contactPhone = '212762971653';
  const contactEmail = 'younesmekki100@gmail.com';
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [agencyName, setAgencyName] = useState(profile?.agency?.name || '');
  const [agencyEmail, setAgencyEmail] = useState(profile?.email || '');
  const [agencyPhone, setAgencyPhone] = useState(profile?.phone || '');
  const [agencyAddress, setAgencyAddress] = useState('');
  const [logoFileName, setLogoFileName] = useState('');
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [logoPreviewBroken, setLogoPreviewBroken] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [rawLogoUrl, setRawLogoUrl] = useState('');
  const [cropScale, setCropScale] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [cropApplying, setCropApplying] = useState(false);
  const cropFrameRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
  const hasChanges = useMemo(() => {
    const baseName = profile?.agency?.name || '';
    const baseEmail = profile?.agency?.email || profile?.email || '';
    const basePhone = profile?.agency?.phone || profile?.phone || '';
    const baseAddress = profile?.agency?.address || '';
    const baseLogo = profile?.agency?.logoUrl || '';
    return (
      agencyName !== baseName ||
      agencyEmail !== baseEmail ||
      agencyPhone !== basePhone ||
      agencyAddress !== baseAddress ||
      logoPreviewUrl !== baseLogo ||
      Boolean(pendingLogoFile)
    );
  }, [agencyAddress, agencyEmail, agencyName, agencyPhone, logoPreviewUrl, pendingLogoFile, profile?.agency?.address, profile?.agency?.email, profile?.agency?.logoUrl, profile?.agency?.name, profile?.agency?.phone, profile?.email, profile?.phone]);
  useEffect(() => {
    setAgencyName(profile?.agency?.name || '');
    setAgencyEmail(profile?.agency?.email || profile?.email || '');
    setAgencyPhone(profile?.agency?.phone || profile?.phone || '');
    setAgencyAddress(profile?.agency?.address || '');
    setLogoPreviewUrl(profile?.agency?.logoUrl || '');
    setPendingLogoFile(null);
    setLogoFileName('');
    setSaveState('idle');
    setLogoPreviewBroken(false);
  }, [profile?.agency?.address, profile?.agency?.email, profile?.agency?.logoUrl, profile?.agency?.name, profile?.agency?.phone, profile?.email, profile?.phone]);

  useEffect(() => {
    setLogoPreviewBroken(false);
  }, [logoPreviewUrl]);

  useEffect(() => {
    if (!hasChanges) {
      if (saveState !== 'saving') setSaveState('idle');
      return;
    }
    if (saveState !== 'saving') setSaveState('dirty');
  }, [hasChanges, saveState]);
  function downloadBillingReceipt() {
    const lines = [
      'Recu abonnement MekLoc',
      `Agence: ${agency?.name || 'Agence'}`,
      `Plan: ${(agency?.plan || 'starter').toUpperCase()}`,
      `Statut paiement: ${billingStatusFr}`,
      `Date: ${new Date().toLocaleDateString('fr-MA')}`,
      `Prochain paiement: ${agency?.nextPaymentDueDate || '-'}`,
      `Fin abonnement: ${agency?.subscriptionEndDate || '-'}`,
    ];
    const textStream = lines.map((line, i) => `BT /F1 11 Tf 50 ${780 - i * 18} Td (${line.replace(/[()\\]/g, '')}) Tj ET`).join('\n');
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
    a.download = `recu-abonnement-${(agency?.name || 'mekloc').replace(/\s+/g, '-').toLowerCase()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    notify({ title: 'Reçu PDF', message: 'Le reçu PDF a été téléchargé.', type: 'success' });
  }

  async function handleLogoUpload(file: File | undefined) {
    if (!file) return;
    const validation = validateFileUpload(file, {
      maxSizeMb: 3,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    });
    if (validation) {
      notify({ title: 'Fichier non autorisé', message: validation, type: 'warning' });
      return;
    }
    setLogoFileName(file.name);
    const localPreview = URL.createObjectURL(file);
    setRawLogoUrl(localPreview);
    setPendingLogoFile(file);
    setCropScale(1);
    setCropX(0);
    setCropY(0);
    setCropOpen(true);
  }

  async function handleRemoveLogo() {
    setLogoFileName('');
    setLogoPreviewUrl('');
    setPendingLogoFile(null);
    if (!isSupabaseEnabled || !agencyId || !supabase) {
      notify({ title: 'Logo supprimé', message: 'Suppression locale effectuée.', type: 'success' });
      setSaveState('dirty');
      return;
    }
    try {
      setLogoUploading(true);
      const previousPath = profile?.agency?.logoPath;
      if (previousPath) {
        await supabase.storage.from('logos').remove([previousPath]);
      }
      const { error } = await supabase.from('agencies').update({ logo_path: null, logo_url: null }).eq('id', agencyId);
      if (error) throw error;
      await refreshProfile();
      notify({ title: 'Logo supprimé', message: 'Le logo agence a été retiré.', type: 'success' });
      setSaveState('saved');
    } catch (error) {
      notify({ title: 'Suppression impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setLogoUploading(false);
    }
  }

  function handleCropPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!cropFrameRef.current) return;
    const rect = cropFrameRef.current.getBoundingClientRect();
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: cropX,
      offsetY: cropY,
    };
    setDragging(true);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      setDragging(false);
      dragStartRef.current = null;
    }
  }

  function handleCropPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !dragStartRef.current) return;
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    setCropX(dragStartRef.current.offsetX + dx);
    setCropY(dragStartRef.current.offsetY + dy);
  }

  function handleCropPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    setDragging(false);
    dragStartRef.current = null;
  }

  async function applyLogoCrop() {
    if (!pendingLogoFile || !rawLogoUrl || !cropFrameRef.current) return;
    setCropApplying(true);
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = rawLogoUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Image invalide.'));
      });
      const size = 600;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas indisponible');
      context.fillStyle = '#111315';
      context.fillRect(0, 0, size, size);
      const frameRect = cropFrameRef.current.getBoundingClientRect();
      const baseScale = Math.min(frameRect.width / image.width, frameRect.height / image.height);
      const finalScale = baseScale * cropScale;
      const drawWidth = image.width * finalScale * (size / frameRect.width);
      const drawHeight = image.height * finalScale * (size / frameRect.height);
      const drawX = (size - drawWidth) / 2 + (cropX * size) / frameRect.width;
      const drawY = (size - drawHeight) / 2 + (cropY * size) / frameRect.height;
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((out) => resolve(out), 'image/png', 0.95));
      if (!blob) throw new Error('Impossible de traiter le logo.');
      const file = new File([blob], `logo-cropped-${Date.now()}.png`, { type: 'image/png' });
      setPendingLogoFile(file);
      setLogoPreviewUrl(URL.createObjectURL(blob));
      setCropOpen(false);
      if (rawLogoUrl) URL.revokeObjectURL(rawLogoUrl);
      setRawLogoUrl('');
      notify({ title: 'Logo ajusté', message: 'Cliquez sur Enregistrer pour confirmer.', type: 'info' });
    } catch (error) {
      notify({ title: 'Ajustement impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setCropApplying(false);
    }
  }

  function resetCropView() {
    setCropScale(1);
    setCropX(0);
    setCropY(0);
  }

  async function handleSaveSettings() {
    if (!isSupabaseEnabled || !agencyId || !profile?.id) {
      notify({ title: 'Paramètres enregistrés', message: 'Mode démonstration actif.', type: 'success' });
      return;
    }
    try {
      const safeAgencyName = sanitizeText(agencyName, 100);
      const safeAgencyAddress = sanitizeText(agencyAddress, 220);
      const safeAgencyPhone = normalizeText(agencyPhone, 20);
      const safeAgencyEmail = normalizeText(agencyEmail, 254).toLowerCase();

      if (!safeAgencyName) {
        notify({ title: 'Champ obligatoire', message: "Le nom de l’agence est obligatoire.", type: 'warning' });
        return;
      }
      if (safeAgencyEmail && !validateEmail(safeAgencyEmail)) {
        notify({ title: 'Email invalide', message: 'Veuillez vérifier votre adresse email.', type: 'warning' });
        return;
      }
      if (safeAgencyPhone && !validatePhone(safeAgencyPhone)) {
        notify({ title: 'Numéro invalide', message: 'Veuillez vérifier votre numéro WhatsApp.', type: 'warning' });
        return;
      }

      setSettingsSaving(true);
      setSaveState('saving');
      if (!supabase) throw new Error('Supabase non configuré');
      if (pendingLogoFile && agencyId) {
        await uploadAgencyLogo(agencyId, pendingLogoFile);
      }
      const agencyPayload: Record<string, unknown> = {
        name: safeAgencyName,
        address: safeAgencyAddress || null,
        phone: safeAgencyPhone || null,
        email: safeAgencyEmail || null,
      };
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { error: agencyErr } = await supabase.from('agencies').update(agencyPayload).eq('id', agencyId);
        if (!agencyErr) break;
        const missingColumn = extractMissingColumnName(agencyErr.message || '');
        if (!missingColumn || !(missingColumn in agencyPayload)) throw agencyErr;
        delete agencyPayload[missingColumn];
        if (Object.keys(agencyPayload).length === 0) throw agencyErr;
      }

      let profileErr: { message?: string } | null = null;
      const profilePayload: Record<string, unknown> = {
        email: safeAgencyEmail,
        phone: safeAgencyPhone,
        full_name: profile.fullName,
      };
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const profileUpdate = await supabase.from('users_profiles').update(profilePayload).eq('id', profile.id);
        profileErr = profileUpdate.error;
        if (!profileErr) break;
        const missingColumn = extractMissingColumnName(profileErr.message || '');
        if (!missingColumn || !(missingColumn in profilePayload)) break;
        delete profilePayload[missingColumn];
        if (Object.keys(profilePayload).length === 0) break;
      }
      if (profileErr && !/permission denied|row-level security/i.test(profileErr.message || '')) throw profileErr;
      await refreshProfile();
      setPendingLogoFile(null);
      setLogoFileName('');

      notify({ title: 'Paramètres enregistrés', message: 'Profil agence mis à jour.', type: 'success' });
      setSaveState('saved');
    } catch (error) {
      notify({ title: 'Enregistrement impossible', message: extractErrorMessage(error), type: 'warning' });
      setSaveState('dirty');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleLogout() {
    await signOut();
    navigate('/auth');
  }

  async function handleDeleteAccount() {
    if (!deletePassword) return;
    try {
      await deleteAccountWithPassword(deletePassword);
      notify({ title: 'Compte supprimé', message: 'Votre compte a été supprimé avec succès.', type: 'success' });
      setDeleteOpen(false);
      setDeletePassword('');
      navigate('/auth');
    } catch (error) {
      notify({ title: 'Suppression impossible', message: extractErrorMessage(error), type: 'warning' });
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Paramètres"
        description="Configurez le profil agence, les contrats, la devise, la fiscalité, WhatsApp et les rôles."
        action={<div className="flex gap-2"><Button icon={settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} onClick={handleSaveSettings} loading={settingsSaving} disabled={!hasChanges && !settingsSaving}>{settingsSaving ? 'Enregistrement...' : 'Enregistrer'}</Button><Button variant="secondary" onClick={handleLogout}>Déconnexion</Button></div>}
      />
      <div className="mb-3">
        {saveState === 'dirty' ? <p className="text-sm text-gold-200">Modifications non enregistrées</p> : null}
        {saveState === 'saved' ? <p className="text-sm text-emerald-300">Enregistré</p> : null}
      </div>

      <Card className="mb-6 p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              className={`focus-ring rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === item ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:bg-white/10 light:text-carbon-700'}`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'Général' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Profil agence</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de l’agence" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
              <Field label="Numéro WhatsApp" value={agencyPhone} onChange={(e) => setAgencyPhone(e.target.value)} />
              <Field label="Email" value={agencyEmail} onChange={(e) => setAgencyEmail(e.target.value)} />
              <Field label="Adresse" value={agencyAddress} onChange={(e) => setAgencyAddress(e.target.value)} placeholder="Adresse agence" />
            </div>
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-dashed border-gold-300/30 bg-gold-400/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold-400 text-carbon-950">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-white light:text-carbon-950">Logo agence</p>
                  <p className="text-sm text-carbon-400">PNG, JPG, ou SVG pour contrats et factures.</p>
                  {logoFileName ? <p className="mt-1 text-xs text-gold-200">{logoFileName}</p> : null}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-carbon-900">
                  {logoPreviewUrl && !logoPreviewBroken ? (
                    <img
                      src={logoPreviewUrl}
                      alt="Logo agence"
                      className="h-full w-full object-contain"
                      onError={() => setLogoPreviewBroken(true)}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-sm font-black text-gold-200">M</div>
                  )}
                </div>
              </div>
              <input
                ref={logoInputRef}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={(event) => handleLogoUpload(event.target.files?.[0])}
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => logoInputRef.current?.click()} loading={logoUploading}>
                  {logoPreviewUrl ? 'Modifier le logo' : 'Choisir le logo'}
                </Button>
                {logoPreviewUrl ? (
                  <Button type="button" variant="danger" onClick={handleRemoveLogo} loading={logoUploading}>
                    Supprimer le logo
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <Globe2 className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Paramètres de devise</h2>
            </div>
            <div className="grid gap-4">
              <SelectField label="Devise" defaultValue="MAD">
                <option>MAD</option>
                <option>EUR</option>
                <option>USD</option>
              </SelectField>
              <SelectField label="Format numérique" defaultValue="fr-MA">
                <option>fr-MA</option>
                <option>ar-MA</option>
              </SelectField>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'Contrats' ? (
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <FileSignature className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Paramètres contrats</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Langue contrat par défaut" defaultValue="Français">
              <option>Français</option>
              <option>العربية</option>
            </SelectField>
            <SelectField label="Règle de caution" defaultValue="Fixe">
              <option>Fixe</option>
              <option>Pourcentage</option>
              <option>Catégorie véhicule</option>
            </SelectField>
            <Field label="Caution par défaut" defaultValue="4000" type="number" />
            <Field label="Frais retard / heure" defaultValue="150" type="number" />
          </div>
        </Card>
      ) : null}

      {tab === 'Facturation' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <Percent className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Paramètres fiscaux</h2>
            </div>
            <div className="grid gap-4">
              <Field label="Taux TVA" defaultValue="20" type="number" />
              <SelectField label="Affichage taxe facture" defaultValue="Incluse">
                <option>Incluse</option>
                <option>Exclue</option>
              </SelectField>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Facturation abonnement</h2>
            </div>
            <div className="grid gap-4">
              <SelectField label="Plan actuel" defaultValue="Pro">
                <option>Gratuit</option>
                <option>Pro</option>
                <option>Business</option>
              </SelectField>
              <SelectField label="Méthode de paiement" defaultValue="Virement bancaire">
                <option>Espèces</option>
                <option>Virement bancaire</option>
                <option>Carte</option>
              </SelectField>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'Abonnement' ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold text-white light:text-carbon-950">Abonnement</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Plan actuel</p><p className="mt-1 font-semibold capitalize">{agency?.plan || 'starter'}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Prix</p><p className="mt-1 font-semibold">{agency?.monthlyPrice ? `${agency.monthlyPrice} MAD / mois` : '99 MAD / mois'}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Type facturation</p><p className="mt-1 font-semibold">{billingTypeFr}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Statut paiement</p><p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${agency?.billingStatus === 'paid' ? 'bg-emerald-400/15 text-emerald-200' : agency?.billingStatus === 'trial' ? 'bg-sky-400/15 text-sky-200' : agency?.billingStatus === 'overdue' ? 'bg-orange-400/15 text-orange-200' : agency?.billingStatus === 'unpaid' ? 'bg-rose-400/15 text-rose-200' : 'bg-slate-400/15 text-slate-200'}`}>{billingStatusFr}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Dernier paiement</p><p className="mt-1 font-semibold">{agency?.lastPaymentDate || '—'}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Prochain paiement</p><p className="mt-1 font-semibold">{agency?.nextPaymentDueDate || '—'}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Fin d’abonnement</p><p className="mt-1 font-semibold">{agency?.subscriptionEndDate || '—'}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Méthode de paiement</p><p className="mt-1 font-semibold">{agency?.paymentMethod || 'other'}</p></div>
            </div>
            {agency?.paymentNotes ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-carbon-300">Notes paiement: {agency.paymentNotes}</p> : null}
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold text-white light:text-carbon-950">Alertes abonnement</h2>
            <div className="grid gap-3">
              {nextDiff !== null && nextDiff >= 0 && nextDiff <= 7 ? <p className="rounded-2xl border border-gold-300/25 bg-gold-400/10 p-3 text-sm text-gold-100">Votre abonnement expire bientôt. Prochain paiement le {nextPaymentDate}.</p> : null}
              {agency?.billingStatus === 'unpaid' ? <p className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm text-rose-100">Votre paiement est en attente. Merci de régulariser votre abonnement.</p> : null}
              {agency?.billingStatus === 'overdue' ? <p className="rounded-2xl border border-orange-300/25 bg-orange-400/10 p-3 text-sm text-orange-100">Votre abonnement est en retard. Contactez MekLoc pour éviter la suspension.</p> : null}
              {endDiff !== null && endDiff < 0 ? <p className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm text-rose-100">Votre abonnement a expiré.</p> : null}
            </div>
            <div className="mt-5 grid gap-2">
              <Button type="button" onClick={() => window.open(`https://wa.me/${contactPhone}`, '_blank', 'noopener,noreferrer')}>Contacter MekLoc sur WhatsApp</Button>
              <Button type="button" variant="secondary" onClick={() => window.location.href = '/pricing'}>Voir les plans</Button>
              <Button type="button" variant="secondary" onClick={downloadBillingReceipt}>Télécharger reçu</Button>
              <Button type="button" variant="secondary" onClick={() => window.location.href = `mailto:${contactEmail}?subject=Contact%20MekLoc`}>Contacter MekLoc par email</Button>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'Équipe' ? (
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <UsersRound className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Gestion équipe</h2>
            </div>
            <div className="premium-surface rounded-2xl p-4 text-sm text-carbon-300">
              Gestion d’équipe avancée bientôt disponible.
            </div>
          </Card>
      ) : null}

      {tab === 'Notifications' ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <BellRing className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Préférences notifications</h2>
            </div>
            <div className="grid gap-4">
              <Field label="Numéro WhatsApp" defaultValue={agencyPhone || '+212 6 00 00 00 00'} />
              <SelectField label="Heure rappel par défaut" defaultValue="09:00">
                <option>09:00</option>
                <option>12:00</option>
                <option>18:00</option>
              </SelectField>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Automatisation WhatsApp</h2>
            </div>
            <div className="grid gap-3">
              {['Confirmation réservation', 'Rappel paiement', 'Rappel retour', 'Envoi contrat'].map((item) => (
                <div key={item} className="premium-surface flex items-center justify-between rounded-2xl p-4">
                  <div>
                    <p className="font-bold text-white light:text-carbon-950">{item}</p>
                    <p className="text-sm text-carbon-400">Bientôt disponible.</p>
                  </div>
                  <button disabled className="h-6 w-11 cursor-not-allowed rounded-full bg-gold-400/20 p-1 opacity-70">
                    <span className="block h-4 w-4 rounded-full bg-gold-300" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-semibold text-white light:text-carbon-950">Sécurité du compte</h2>
        <p className="mt-2 text-sm text-carbon-400">Vous pouvez vous déconnecter ou supprimer définitivement votre compte.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleLogout}>Déconnexion</Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>Supprimer mon compte</Button>
        </div>
      </Card>
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Supprimer mon compte">
        <div className="space-y-4">
          <p className="text-sm text-carbon-400">Cette action est définitive. Confirmez votre mot de passe pour supprimer votre compte.</p>
          <Field label="Mot de passe" name="deletePassword" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button type="button" variant="danger" onClick={handleDeleteAccount}>Confirmer la suppression</Button>
          </div>
        </div>
      </Modal>

      <Modal open={cropOpen} onClose={() => { setCropOpen(false); if (rawLogoUrl) URL.revokeObjectURL(rawLogoUrl); setRawLogoUrl(''); }} title="Ajuster le logo">
        <div className="space-y-4">
          <p className="text-sm text-carbon-300">Ajustez votre logo pour qu’il apparaisse correctement dans MekLoc, les contrats et les factures.</p>
          <div
            ref={cropFrameRef}
            onPointerDown={handleCropPointerDown}
            onPointerMove={handleCropPointerMove}
            onPointerUp={handleCropPointerUp}
            onPointerCancel={handleCropPointerUp}
            className="relative mx-auto grid h-72 w-full max-w-md touch-none place-items-center overflow-hidden rounded-3xl border border-white/10 bg-[#0e1218]"
          >
            {rawLogoUrl ? (
              <img
                src={rawLogoUrl}
                alt="Prévisualisation logo"
                className="pointer-events-none max-h-none max-w-none select-none"
                style={{
                  transform: `translate(${cropX}px, ${cropY}px) scale(${cropScale})`,
                  width: '86%',
                  height: '86%',
                  objectFit: 'contain',
                }}
              />
            ) : null}
            <div className="pointer-events-none absolute inset-5 rounded-3xl border-2 border-gold-300/70 shadow-[0_0_0_9999px_rgba(0,0,0,.35)]" />
          </div>
          <label className="grid gap-2 text-sm text-carbon-300">
            Zoom
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.01}
              value={cropScale}
              onChange={(event) => setCropScale(Number(event.target.value))}
              className="w-full accent-[#D4A017]"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setCropOpen(false)}>Annuler</Button>
            <Button type="button" variant="secondary" onClick={resetCropView}>Réinitialiser</Button>
            <Button type="button" onClick={applyLogoCrop} loading={cropApplying}>Valider le logo</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
