import { BellRing, Building2, Camera, FileSignature, Globe2, MessageCircle, Percent, Save, ShieldCheck, UsersRound } from 'lucide-react';
import { useRef, useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField } from '../components/ui/Form';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { uploadAgencyLogo } from '../lib/storage';

export default function SettingsPage() {
  const { notify } = useApp();
  const { agencyId, isSupabaseEnabled } = useAuth();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState('Général');
  const tabs = ['Général', 'Contrats', 'Facturation', 'Équipe', 'Notifications'];

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

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Paramètres"
        description="Configurez le profil agence, les contrats, la devise, la fiscalité, WhatsApp et les rôles."
        action={<Button icon={<Save className="h-4 w-4" />} onClick={() => notify({ title: 'Paramètres enregistrés', message: 'Les réglages de votre espace ont été mis à jour.', type: 'success' })}>Enregistrer</Button>}
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
    </div>
  );
}
