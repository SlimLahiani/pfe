import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Target, Plus, Trash2, Edit, RotateCcw, Download } from 'lucide-react';
import {
  useLeads, useCreateLead, useUpdateLead, useDeleteLead, useRestoreLead, type Lead,
} from '../../../hooks/use-api';
import { exportToCSV } from '../../../lib/export-csv';
import {
  PageHeader, SearchInput, SelectFilter, DataTable, Pagination,
  Column, StatusBadge, Dialog, FormField, Input, Select, Button, StatCard,
} from '../../../components/shared/ui';

const LEAD_STATUSES = [
  { label: 'Nouveau', value: 'NEW' },
  { label: 'Contacté', value: 'CONTACTED' },
  { label: 'Qualifié', value: 'QUALIFIED' },
  { label: 'Perdu', value: 'LOST' },
];

const LEAD_SOURCES = [
  { label: 'Site Web', value: 'WEBSITE' },
  { label: 'Recommandation', value: 'REFERRAL' },
  { label: 'LinkedIn', value: 'LINKEDIN' },
  { label: 'Prospection', value: 'COLD_OUTREACH' },
  { label: 'Autre', value: 'OTHER' },
];

interface LeadFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  status: string;
  source?: string;
}

export const LeadsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useLeads({
    page,
    limit: 10,
    search,
    status: statusFilter || undefined,
    isArchived: showArchived,
  });

  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const restoreLead = useRestoreLead();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LeadFormData>({
    defaultValues: { status: 'NEW' },
  });

  const openCreate = () => {
    setEditingLead(null);
    reset({ firstName: '', lastName: '', email: '', phone: '', company: '', status: 'NEW', source: '' });
    setDialogOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingLead(lead);
    reset({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone ?? '',
      company: lead.company ?? '',
      status: lead.status,
      source: lead.source ?? '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: LeadFormData) => {
    if (editingLead) {
      await updateLead.mutateAsync({ id: editingLead.id, data });
    } else {
      await createLead.mutateAsync(data as Omit<Lead, 'id' | 'createdAt'>);
    }
    setDialogOpen(false);
    reset();
  };

  const handleDelete = async (id: string) => {
    await deleteLead.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Prénom', key: 'firstName' },
      { header: 'Nom', key: 'lastName' },
      { header: 'E-mail', key: 'email' },
      { header: 'Entreprise', key: 'company' },
      { header: 'Source', key: 'source' },
      { header: 'Statut', key: 'status' },
      { header: 'Date de création', key: 'createdAt', transform: (val: string) => new Date(val).toLocaleDateString() },
    ];
    exportToCSV(dataToExport, columns, `leads-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Nom',
      render: (row) => (
        <div>
          <p className="font-semibold text-white">{row.firstName} {row.lastName}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    { key: 'company', header: 'Entreprise', render: (row) => row.company ?? '—' },
    { key: 'source', header: 'Source', render: (row) => row.source?.replace(/_/g, ' ') ?? '—' },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'createdAt',
      header: 'Créé le',
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
              onClick={(e) => { e.stopPropagation(); restoreLead.mutate(row.id); }}
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

  const stats = [
    { label: 'Total Leads', value: data?.total ?? 0, color: 'bg-indigo-500/10 text-indigo-400' },
    { label: 'Nouveau', value: '—', color: 'bg-blue-500/10 text-blue-400' },
    { label: 'Qualifié', value: '—', color: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Perdu', value: '—', color: 'bg-red-500/10 text-red-400' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pistes de prospects (Leads)"
        description="Gérez et suivez vos pistes de prospects dans le tunnel de vente"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Ajouter un lead
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={<Target size={20} />} colorClass={s.color} />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher des leads..." />
        <SelectFilter
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={LEAD_STATUSES}
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

      <DataTable<Lead>
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Aucun lead pour le moment. Ajoutez votre premier lead pour commencer."
      />

      {data && data.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          total={data.total}
          limit={10}
          onPageChange={setPage}
        />
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingLead ? 'Modifier le lead' : 'Nouveau lead'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prénom" required error={errors.firstName?.message}>
              <Input {...register('firstName', { required: 'Requis' })} placeholder="Jeanne" />
            </FormField>
            <FormField label="Nom" required error={errors.lastName?.message}>
              <Input {...register('lastName', { required: 'Requis' })} placeholder="Martin" />
            </FormField>
          </div>
          <FormField label="E-mail" required error={errors.email?.message}>
            <Input {...register('email', { required: 'Requis' })} type="email" placeholder="jeanne@example.com" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Téléphone">
              <Input {...register('phone')} placeholder="+216 20 000 000" />
            </FormField>
            <FormField label="Entreprise">
              <Input {...register('company')} placeholder="CREATIVART" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Statut" required>
              <Select {...register('status', { required: true })}>
                {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Source">
              <Select {...register('source')}>
                <option value="">Sélectionner la source</option>
                {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingLead ? 'Enregistrer' : 'Créer le lead'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Archiver le lead" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Êtes-vous sûr de vouloir archiver ce lead ? Vous pourrez le restaurer ultérieurement.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteLead.isPending} onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Archiver
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
