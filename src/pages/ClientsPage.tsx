import { BadgeCheck, CalendarClock, Edit3, Eye, Phone, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Field } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { formatMAD, type Client } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

export default function ClientsPage() {
  const { clients, createClient, updateClient, deleteClient: removeClient } = useData();
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const { notify } = useApp();

  const filteredClients = useMemo(() => {
    return clients.filter((client) =>
      `${client.fullName} ${client.phone} ${client.email} ${client.cin}`.toLowerCase().includes(query.toLowerCase()),
    );
  }, [clients, query]);

  function openNewClient() {
    setEditingClient(null);
    setModalOpen(true);
  }

  async function handleSaveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const client: Client = {
      id: editingClient?.id || `cli-${Date.now()}`,
      fullName: String(form.get('fullName')),
      phone: String(form.get('phone')),
      email: String(form.get('email')),
      cin: String(form.get('cin')),
      license: String(form.get('license')),
      address: String(form.get('address')),
      totalRentals: editingClient?.totalRentals || 0,
      totalSpent: editingClient?.totalSpent || 0,
      status: editingClient?.status || 'New',
    };
    try {
      if (editingClient) {
        await updateClient(client);
      } else {
        await createClient(client);
      }
      setModalOpen(false);
      notify({ title: editingClient ? 'Client updated' : 'Client added', message: `${client.fullName} is saved in CRM.`, type: 'success' });
    } catch (error) {
      notify({
        title: 'Client not saved',
        message: error instanceof Error ? error.message : 'Try again later.',
        type: 'warning',
      });
    }
  }

  async function deleteClient(client: Client) {
    try {
      await removeClient(client.id);
      notify({ title: 'Client removed', message: `${client.fullName} was deleted from CRM.`, type: 'warning' });
    } catch (error) {
      notify({
        title: 'Client not deleted',
        message: error instanceof Error ? error.message : 'Try again later.',
        type: 'warning',
      });
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="CRM"
        title="Clients"
        description="Search, manage, and review rental customers with CIN/passport and driving license details."
        action={<Button icon={<UserPlus className="h-4 w-4" />} onClick={openNewClient}>Add client</Button>}
      />

      <Card className="mb-5 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, phone, email, CIN/passport"
            className="form-control focus-ring h-10 w-full rounded-xl pl-10 pr-4 text-sm light:bg-white light:text-carbon-950"
          />
        </label>
      </Card>

      {filteredClients.length === 0 ? (
        <EmptyState icon={Users} title="No clients found" message="Add a new customer profile or adjust your search." action="Add client" onAction={openNewClient} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredClients.map((client) => (
            <Card key={client.id} interactive className="p-5">
              <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
                <div className="flex items-start gap-4">
                  <div className="premium-avatar grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-black text-carbon-950">
                    {client.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0 md:hidden">
                    <div className="mb-2"><Badge>{client.status}</Badge></div>
                    <h3 className="truncate text-lg font-semibold text-white light:text-carbon-950">{client.fullName}</h3>
                    <p className="mt-1 text-sm text-carbon-400">{client.phone}</p>
                  </div>
                </div>

                <div className="hidden min-w-0 md:block">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/clients/${client.id}`} className="truncate text-lg font-semibold text-white hover:text-gold-200 light:text-carbon-950">
                      {client.fullName}
                    </Link>
                    <Badge>{client.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-carbon-400 lg:grid-cols-2">
                    <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-gold-200" />{client.phone}</p>
                    <p className="truncate">{client.email}</p>
                    <p className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-carbon-300" />CIN {client.cin}</p>
                    <p>License {client.license}</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="premium-surface rounded-2xl p-3">
                      <p className="text-xs text-carbon-500">Reservations</p>
                      <p className="mt-1 text-xl font-semibold text-white light:text-carbon-950">{client.totalRentals}</p>
                    </div>
                    <div className="premium-surface rounded-2xl p-3">
                      <p className="text-xs text-carbon-500">Total spent</p>
                      <p className="mt-1 text-xl font-semibold text-white light:text-carbon-950">{formatMAD(client.totalSpent)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-carbon-500">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Customer since 2025 · Last reservation May 2026
                  </div>
                </div>

                <div className="flex gap-2 md:col-span-3">
                  <Button variant="secondary" className="h-9 px-3" icon={<Edit3 className="h-4 w-4" />} onClick={() => { setEditingClient(client); setModalOpen(true); }}>Edit</Button>
                  <Link
                    to={`/clients/${client.id}`}
                    className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/15 light:border-carbon-950/10 light:bg-carbon-950/5 light:text-carbon-950"
                  >
                    <Eye className="h-4 w-4" />
                    Details
                  </Link>
                  <Button variant="danger" className="h-9 px-3" icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteClient(client)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} title={editingClient ? 'Edit client' : 'Add client'} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSaveClient}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="fullName" defaultValue={editingClient?.fullName || ''} required />
            <Field label="Phone" name="phone" defaultValue={editingClient?.phone || '+212 6 '} required />
            <Field label="Email" name="email" type="email" defaultValue={editingClient?.email || ''} required />
            <Field label="CIN/Passport" name="cin" defaultValue={editingClient?.cin || ''} required />
            <Field label="Driving license number" name="license" defaultValue={editingClient?.license || ''} required />
            <Field label="Address" name="address" defaultValue={editingClient?.address || ''} required />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save client</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
