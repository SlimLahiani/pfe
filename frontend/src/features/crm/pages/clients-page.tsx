import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Users, Plus, Trash2, Edit, RotateCcw, Download } from 'lucide-react';
import {
  useClients, useCreateClient, useUpdateClient, useDeleteClient, useRestoreClient, type Client,
} from '../../../hooks/use-api';
import { exportToCSV } from '../../../lib/export-csv';
import {
  PageHeader, SearchInput, SelectFilter, DataTable, Pagination,
  Column, StatusBadge, Dialog, FormField, Input, Select, Button, StatCard,
} from '../../../components/shared/ui';

const CLIENT_STATUSES = [
  { label: 'Actif', value: 'ACTIVE' },
  { label: 'Inactif', value: 'INACTIVE' },
];

const INDUSTRIES = [
  { label: 'Technologie', value: 'TECHNOLOGY' },
  { label: 'Santé', value: 'HEALTHCARE' },
  { label: 'Finance', value: 'FINANCE' },
  { label: 'Commerce de détail', value: 'RETAIL' },
  { label: 'Industrie / Production', value: 'MANUFACTURING' },
  { label: 'Autre', value: 'OTHER' },
];

interface ClientFormData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  status: string;
}

export const ClientsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useClients({
    page,
    limit: 10,
    search,
    status: statusFilter || undefined,
    isArchived: showArchived,
  });

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const restoreClient = useRestoreClient();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClientFormData>({
    defaultValues: { status: 'ACTIVE' },
  });

  const openCreate = () => {
    setEditingClient(null);
    reset({ name: '', email: '', phone: '', address: '', industry: '', status: 'ACTIVE' });
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    reset({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      address: client.address ?? '',
      industry: client.industry ?? '',
      status: client.status,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: ClientFormData) => {
    if (editingClient) {
      await updateClient.mutateAsync({ id: editingClient.id, data });
    } else {
      await createClient.mutateAsync(data as Omit<Client, 'id' | 'createdAt'>);
    }
    setDialogOpen(false);
    reset();
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Nom', key: 'name' },
      { header: 'E-mail', key: 'email' },
      { header: 'Téléphone', key: 'phone' },
      { header: 'Secteur', key: 'industry' },
      { header: 'Statut', key: 'status' },
      { header: 'Date de création', key: 'createdAt', transform: (val: string) => new Date(val).toLocaleDateString() },
    ];
    exportToCSV(dataToExport, columns, `clients-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Client',
      render: (row) => (
        <div>
          <p className="font-semibold text-white">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.email ?? '—'}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Téléphone', render: (row) => row.phone ?? '—' },
    { key: 'industry', header: 'Secteur', render: (row) => row.industry?.replace(/_/g, ' ') ?? '—' },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'createdAt',
      header: 'Membre depuis',
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (row) => (
        <div className="flex items-center gap-2">
          {((row as any).isArchived) ? (
            <button
              onClick={(e) => { e.stopPropagation(); restoreClient.mutate(row.id); }}
              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
              title="Restaurer"
            >
              <RotateCcw size={14} /> Restaurer
            </button>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
              >
                <Edit size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(row.id); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Gérez vos comptes clients actifs et vos contacts"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Ajouter un client
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total des Clients" value={data?.total ?? 0} icon={<Users size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="Actifs" value="—" icon={<Users size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="Inactifs" value="—" icon={<Users size={20} />} colorClass="bg-gray-500/10 text-gray-400" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher des clients..." />
        <SelectFilter
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={CLIENT_STATUSES}
          placeholder="Tous les statuts"
        />
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none cursor-pointer sm:ml-auto">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
            className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0"
          />
          Afficher Archivés
        </label>
      </div>

      <DataTable<Client>
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Aucun client pour le moment."
      />

      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={10} onPageChange={setPage} />
      )}

      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title={editingClient ? 'Modifier le client' : 'Nouveau client'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Nom de l'entreprise" required error={errors.name?.message}>
            <Input {...register('name', { required: 'Requis' })} placeholder="Exemple Corp" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="E-mail">
              <Input {...register('email')} type="email" placeholder="contact@acme.com" />
            </FormField>
            <FormField label="Téléphone">
              <Input {...register('phone')} placeholder="+216 20 000 000" />
            </FormField>
          </div>
          <FormField label="Adresse">
            <Input {...register('address')} placeholder="123 Rue de la Liberté, Tunis, Tunisie" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Secteur d'activité">
              <Select {...register('industry')}>
                <option value="">Sélectionner le secteur</option>
                {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Statut" required>
              <Select {...register('status', { required: true })}>
                {CLIENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingClient ? 'Enregistrer' : 'Créer le client'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Archiver le client" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Êtes-vous sûr de vouloir archiver ce client ? Vous pourrez le restaurer ultérieurement.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteClient.isPending} onClick={() => deleteConfirm && deleteClient.mutateAsync(deleteConfirm).then(() => setDeleteConfirm(null))}>
            Archiver
          </Button>
        </div>
      </Dialog>
    </div>
  );
};

