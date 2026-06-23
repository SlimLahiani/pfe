import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Briefcase, Plus, Trash2, Edit, Calendar, RotateCcw, Download } from 'lucide-react';
import {
  useProjects, useCreateProject, useUpdateProject, useDeleteProject, useRestoreProject, type Project,
} from '../../../hooks/use-api';
import { exportToCSV } from '../../../lib/export-csv';
import {
  PageHeader, SearchInput, SelectFilter, DataTable, Pagination,
  Column, StatusBadge, Dialog, FormField, Input, Select, Textarea, Button, StatCard, Tabs,
} from '../../../components/shared/ui';

const PROJECT_STATUSES = [
  { label: 'Planification', value: 'PLANNING' },
  { label: 'En cours', value: 'ACTIVE' },
  { label: 'En pause', value: 'ON_HOLD' },
  { label: 'Terminé', value: 'COMPLETED' },
];

const PROJECT_PRIORITIES = [
  { label: 'Basse', value: 'LOW' },
  { label: 'Moyenne', value: 'MEDIUM' },
  { label: 'Haute', value: 'HIGH' },
  { label: 'Urgente', value: 'URGENT' },
];

interface ProjectFormData {
  name: string;
  description?: string;
  status: string;
  priority: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
}

const ProjectCard: React.FC<{ project: Project; onEdit: () => void; onDelete: () => void; onRestore?: () => void }> = ({
  project, onEdit, onDelete, onRestore,
}) => (
  <div className="glass-card rounded-2xl p-5 group">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h4 className="font-bold text-white text-sm">{project.name}</h4>
        {project.client && (
          <p className="text-xs text-muted-foreground mt-0.5">{project.client.name}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {((project as any).isArchived) ? (
          <button onClick={onRestore} className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors" title="Restaurer">
            <RotateCcw size={13} />
          </button>
        ) : (
          <>
            <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors">
              <Edit size={13} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
    {project.description && (
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
    )}
    <div className="flex items-center justify-between">
      <StatusBadge status={project.status} />
      <StatusBadge status={project.priority} />
    </div>
    {project.endDate && (
      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
        <Calendar size={12} />
        Échéance le {new Date(project.endDate).toLocaleDateString()}
      </div>
    )}
  </div>
);

export const ProjectsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useProjects({
    page,
    limit: 12,
    search,
    status: statusFilter || undefined,
    isArchived: showArchived,
  });

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const restoreProject = useRestoreProject();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProjectFormData>({
    defaultValues: { status: 'PLANNING', priority: 'MEDIUM' },
  });

  const openCreate = () => {
    setEditingProject(null);
    reset({ name: '', description: '', status: 'PLANNING', priority: 'MEDIUM' });
    setDialogOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    reset({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
      priority: project.priority,
      startDate: project.startDate ? project.startDate.split('T')[0] : '',
      endDate: project.endDate ? project.endDate.split('T')[0] : '',
      budget: project.budget ?? undefined,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (formData: ProjectFormData) => {
    if (editingProject) {
      await updateProject.mutateAsync({ id: editingProject.id, data: formData });
    } else {
      await createProject.mutateAsync(formData as Omit<Project, 'id' | 'createdAt'>);
    }
    setDialogOpen(false);
    reset();
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Projet', key: 'name' },
      { header: 'Client', key: 'client.name' },
      { header: 'Statut', key: 'status' },
      { header: 'Priorité', key: 'priority' },
      { header: 'Date d\'échéance', key: 'endDate', transform: (val: string) => val ? new Date(val).toLocaleDateString() : '' },
      { header: 'Budget (TND)', key: 'budget' },
      { header: 'Date de création', key: 'createdAt', transform: (val: string) => new Date(val).toLocaleDateString() },
    ];
    exportToCSV(dataToExport, columns, `projets-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const columns: Column<Project>[] = [
    {
      key: 'name',
      header: 'Projet',
      render: (row) => (
        <div>
          <p className="font-semibold text-white">{row.name}</p>
          {row.client && <p className="text-xs text-muted-foreground">{row.client.name}</p>}
        </div>
      ),
    },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'priority', header: 'Priorité', render: (row) => <StatusBadge status={row.priority} /> },
    {
      key: 'endDate',
      header: "Date d'échéance",
      render: (row) => row.endDate ? new Date(row.endDate).toLocaleDateString() : '—',
    },
    {
      key: 'budget',
      header: 'Budget',
      render: (row) => row.budget ? `${row.budget.toLocaleString('fr-FR')} TND` : '—',
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (row) => (
        <div className="flex items-center gap-2">
          {((row as any).isArchived) ? (
            <button
              onClick={(e) => { e.stopPropagation(); restoreProject.mutate(row.id); }}
              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
              title="Restaurer"
            >
              <RotateCcw size={14} /> Restaurer
            </button>
          ) : (
            <>
              <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors">
                <Edit size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(row.id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
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
        title="Projets"
        description="Suivez toutes les campagnes des clients actifs et les initiatives internes"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            <Button icon={<Plus size={16} />} onClick={openCreate}>Nouveau projet</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total des Projets" value={data?.total ?? 0} icon={<Briefcase size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="En cours" value={data?.stats?.ACTIVE ?? 0} icon={<Briefcase size={20} />} colorClass="bg-blue-500/10 text-blue-400" />
        <StatCard label="Terminés" value={data?.stats?.COMPLETED ?? 0} icon={<Briefcase size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="En pause" value={data?.stats?.ON_HOLD ?? 0} icon={<Briefcase size={20} />} colorClass="bg-amber-500/10 text-amber-400" />
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 items-center">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher des projets..." />
          <SelectFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={PROJECT_STATUSES} placeholder="Tous les statuts" />
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
              className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0"
            />
            Afficher Archivés
          </label>
        </div>
        <Tabs
          tabs={[{ label: 'Tableau', value: 'table' }, { label: 'Cartes', value: 'cards' }]}
          active={viewMode}
          onChange={setViewMode}
        />
      </div>

      {viewMode === 'table' ? (
        <DataTable<Project>
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          emptyMessage="Aucun projet trouvé."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card rounded-2xl p-5 animate-pulse h-36" />
              ))
            : data?.data.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onEdit={() => openEdit(project)}
                  onDelete={() => setDeleteConfirm(project.id)}
                  onRestore={() => restoreProject.mutate(project.id)}
                />
              ))
          }
        </div>
      )}

      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={12} onPageChange={setPage} />
      )}

      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title={editingProject ? 'Modifier le projet' : 'Nouveau projet'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Nom du projet" required error={errors.name?.message}>
            <Input {...register('name', { required: 'Requis' })} placeholder="Campagne de lancement d'été" />
          </FormField>
          <FormField label="Description">
            <Textarea {...register('description')} placeholder="Aperçu du projet et objectifs..." rows={3} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Statut" required>
              <Select {...register('status', { required: true })}>
                {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Priorité" required>
              <Select {...register('priority', { required: true })}>
                {PROJECT_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date de début">
              <Input {...register('startDate')} type="date" />
            </FormField>
            <FormField label="Date de fin">
              <Input {...register('endDate')} type="date" />
            </FormField>
          </div>
          <FormField label="Budget (TND)">
            <Input {...register('budget', { valueAsNumber: true })} type="number" placeholder="50000" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingProject ? 'Enregistrer' : 'Créer le projet'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Archiver le projet" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Êtes-vous sûr de vouloir archiver ce projet ? Vous pourrez le restaurer ultérieurement.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteProject.isPending} onClick={() => deleteConfirm && deleteProject.mutateAsync(deleteConfirm).then(() => setDeleteConfirm(null))}>
            Archiver
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
