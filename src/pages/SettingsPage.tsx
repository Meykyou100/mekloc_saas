import { BellRing, Building2, Camera, FileSignature, Globe2, MessageCircle, Percent, Save, ShieldCheck, UsersRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { uploadAgencyLogo } from '../lib/storage';

export default function SettingsPage() {
  const { notify } = useApp();
  const { agencyId, isSupabaseEnabled, profile, signOut, deleteAccountWithPassword } = useAuth();
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
    if (!isSupabaseEnabled || !agencyId) {
      notify({ title: 'Logo selected', message: 'Supabase is not configured, so this stays in demo mode.', type: 'info' });
      return;
    }

    try {
      await uploadAgencyLogo(agencyId, file);
      notify({ title: 'Logo uploaded', message: 'The agency logo was saved in Supabase Storage.', type: 'success' });
    } catch (error) {
      notify({
        title: 'Logo not uploaded',
        message: error instanceof Error ? error.message : 'Try again later.',
        type: 'warning',
      });
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
      notify({ title: 'Suppression impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Paramètres"
        description="Configurez le profil agence, les contrats, la devise, la fiscalité, WhatsApp et les rôles."
        action={<div className="flex gap-2"><Button icon={<Save className="h-4 w-4" />} onClick={() => notify({ title: 'Paramètres enregistrés', message: 'Les réglages de votre espace ont été mis à jour.', type: 'success' })}>Enregistrer</Button><Button variant="secondary" onClick={handleLogout}>Déconnexion</Button></div>}
      />

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
              <h2 className="font-semibold text-white light:text-carbon-950">Agency profile</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Agency name" defaultValue="Atlas Rent Marrakech" />
              <Field label="WhatsApp number" defaultValue="+212 6 00 00 00 00" />
              <Field label="Email" defaultValue="hello@atlasrent.ma" />
              <Field label="Address" defaultValue="Av. Mohammed VI, Marrakech" />
            </div>
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-dashed border-gold-300/30 bg-gold-400/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold-400 text-carbon-950">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-white light:text-carbon-950">Upload logo UI</p>
                  <p className="text-sm text-carbon-400">PNG, JPG, or SVG for contracts and invoices.</p>
                </div>
              </div>
              <input
                ref={logoInputRef}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(event) => handleLogoUpload(event.target.files?.[0])}
              />
              <Button type="button" variant="secondary" onClick={() => logoInputRef.current?.click()}>Choose logo</Button>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <Globe2 className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Currency settings</h2>
            </div>
            <div className="grid gap-4">
              <SelectField label="Currency" defaultValue="MAD">
                <option>MAD</option>
                <option>EUR</option>
                <option>USD</option>
              </SelectField>
              <SelectField label="Number format" defaultValue="en-MA">
                <option>en-MA</option>
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
            <h2 className="font-semibold text-white light:text-carbon-950">Contract settings</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Default contract language" defaultValue="Français">
              <option>Français</option>
              <option>العربية</option>
            </SelectField>
            <SelectField label="Deposit rule" defaultValue="Fixed">
              <option>Fixed</option>
              <option>Percentage</option>
              <option>Vehicle category</option>
            </SelectField>
            <Field label="Default deposit" defaultValue="4000" type="number" />
            <Field label="Late return fee / hour" defaultValue="150" type="number" />
          </div>
        </Card>
      ) : null}

      {tab === 'Facturation' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <Percent className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Tax settings</h2>
            </div>
            <div className="grid gap-4">
              <Field label="VAT rate" defaultValue="20" type="number" />
              <SelectField label="Invoice tax display" defaultValue="Inclusive">
                <option>Inclusive</option>
                <option>Exclusive</option>
              </SelectField>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Subscription billing</h2>
            </div>
            <div className="grid gap-4">
              <SelectField label="Current plan" defaultValue="Pro">
                <option>Free</option>
                <option>Pro</option>
                <option>Business</option>
              </SelectField>
              <SelectField label="Payment method" defaultValue="Bank transfer">
                <option>Cash</option>
                <option>Bank transfer</option>
                <option>Card</option>
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
              <h2 className="font-semibold text-white light:text-carbon-950">Team management</h2>
            </div>
            <div className="grid gap-3">
              {[
                ['Mekki Admin', 'Admin'],
                ['Nadia Operations', 'Manager'],
                ['Karim Desk', 'Staff'],
              ].map(([name, role]) => (
                <div key={name} className="premium-surface flex items-center justify-between rounded-2xl p-4">
                  <div>
                    <p className="font-bold text-white light:text-carbon-950">{name}</p>
                    <p className="text-sm text-carbon-400">{role}</p>
                  </div>
                  <SelectField label="Role" defaultValue={role} className="min-w-32">
                    <option>Admin</option>
                    <option>Manager</option>
                    <option>Staff</option>
                  </SelectField>
                </div>
              ))}
            </div>
          </Card>
      ) : null}

      {tab === 'Notifications' ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <BellRing className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Notification preferences</h2>
            </div>
            <div className="grid gap-4">
              <Field label="WhatsApp number" defaultValue="+212 6 00 00 00 00" />
              <SelectField label="Default reminder time" defaultValue="09:00">
                <option>09:00</option>
                <option>12:00</option>
                <option>18:00</option>
              </SelectField>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">WhatsApp automation placeholder</h2>
            </div>
            <div className="grid gap-3">
              {['Reservation confirmation', 'Payment reminder', 'Return reminder', 'Send contract'].map((item) => (
                <div key={item} className="premium-surface flex items-center justify-between rounded-2xl p-4">
                  <div>
                    <p className="font-bold text-white light:text-carbon-950">{item}</p>
                    <p className="text-sm text-carbon-400">Template ready for future WhatsApp API connection.</p>
                  </div>
                  <button className="h-6 w-11 rounded-full bg-gold-400/30 p-1">
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
    </div>
  );
}
