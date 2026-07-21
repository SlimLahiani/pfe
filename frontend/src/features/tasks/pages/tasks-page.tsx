import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { CheckSquare, Plus, Trash2, Edit, AlertCircle, User, Folder, ListTodo, RotateCcw, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/auth-context';
import {
  useTasks, useCreateTask, useUpdateTask, useDeleteTask, useRestoreTask, type Task, useProjects
} from '../../../hooks/use-api';
import {
  PageHeader, SearchInput, SelectFilter, DataTable, Pagination,
  Column, StatusBadge, Dialog, FormField, Input, Select, Textarea, Button, StatCard, Tabs,
} from '../../../components/shared/ui';
import { exportToCSV } from '../../../lib/export-csv';

const TASK_STATUSES = [
  { label: 'À faire', value: 'TODO' },
  { label: 'En cours', value: 'IN_PROGRESS' },
  { label: 'En révision', value: 'IN_REVIEW' },
  { label: 'Fait', value: 'DONE' },
  { label: 'Bloqué', value: 'BLOCKED' },
];

const TASK_PRIORITIES = [
  { label: 'Basse', value: 'LOW' },
  { label: 'Moyenne', value: 'MEDIUM' },
  { label: 'Haute', value: 'HIGH' },
  { label: 'Critique', value: 'CRITICAL' },
];

interface TaskFormData {
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  projectId?: string;
  assigneeId?: string;
}

const KanbanColumn: React.FC<{
  title: string;
  statusValue: string;
  tasks: Task[];
  color: string;
  isEmployee?: boolean;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onDropTask: (taskId: string, targetStatus: string) => void;
}> = ({ title, statusValue, tasks, color, isEmployee, onEdit, onDelete, onRestore, onDropTask }) => {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) {
          onDropTask(taskId, statusValue);
        }
      }}
      className={`flex-1 min-w-[260px] bg-white/[0.01] border rounded-2xl p-4 flex flex-col max-h-[70vh] transition-all duration-200 ${
        isOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-white/[0.03]'
      }`}
    >
      <div className="flex items-center gap-2 mb-4 px-1 pb-2 border-b border-white/[0.05]">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">{title}</h4>
        <span className="ml-auto text-xs font-bold text-muted-foreground bg-white/5 px-2.5 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', task.id);
            }}
            className="glass-card rounded-xl p-4 group hover:border-white/15 hover:shadow-lg transition-all duration-150 relative cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-white leading-relaxed line-clamp-2">{task.title}</p>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {((task as any).isArchived) ? (
                  <button onClick={() => onRestore?.(task.id)} className="p-1 rounded hover:bg-white/5 text-emerald-400 hover:text-emerald-300 transition-colors" title="Restaurer">
                    <RotateCcw size={11} />
                  </button>
                ) : (
                  <>
                    <button onClick={() => onEdit(task)} className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-indigo-300 transition-colors">
                      <Edit size={11} />
                    </button>
                    {!isEmployee && (
                      <button onClick={() => onDelete(task.id)} className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-red-300 transition-colors">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {task.description && (
              <p className="text-[10px] text-muted-foreground/70 line-clamp-2 mt-1.5 leading-relaxed">{task.description}</p>
            )}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/[0.03]">
              <StatusBadge status={task.priority} />
              {task.dueDate && (
                <span className="text-[9px] text-muted-foreground/60 font-medium">
                  📅 {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
            {(task.project || task.assignee) && (
              <div className="flex items-center justify-between mt-2 pt-1">
                {task.project ? (
                  <span className="text-[9px] text-indigo-400 font-medium truncate max-w-[120px] flex items-center gap-1">
                    <Folder size={8} /> {task.project.name}
                  </span>
                ) : <div />}
                {task.assignee ? (
                  <span className="text-[9px] text-muted-foreground/80 font-semibold flex items-center gap-1 shrink-0">
                    <User size={8} /> {task.assignee.firstName} {task.assignee.lastName[0]}.
                  </span>
                ) : null}
              </div>
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="h-24 border border-dashed border-white/[0.03] rounded-xl flex items-center justify-center text-[10px] text-muted-foreground/45">
            Vide
          </div>
        )}
      </div>
    </div>
  );
};

export const TasksPage: React.FC = () => {
  const { user } = useAuth();
  const isEmployee = user?.role === 'COLLABORATEUR';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [myTasksOnly, setMyTasksOnly] = useState(isEmployee);
  const [viewMode, setViewMode] = useState('kanban');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch users & projects for dropdown lists
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-list-dropdown'],
    queryFn: async () => {
      const res = await api.get<{ data: any[] }>('/users');
      return res.data.data ?? [];
    },
  });

  const { data: projectsData } = useProjects({ limit: 100 });
  const projects = projectsData?.data ?? [];

  const { data, isLoading } = useTasks({
    page,
    limit: 50,
    search,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    assigneeId: myTasksOnly ? user?.id : undefined,
    isArchived: showArchived,
  });

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TaskFormData>({
    defaultValues: { status: 'TODO', priority: 'MEDIUM' },
  });

  // Sync role to myTasksOnly toggle
  useEffect(() => {
    if (user) {
      setMyTasksOnly(user.role === 'COLLABORATEUR');
    }
  }, [user]);

  const openCreate = () => {
    setEditingTask(null);
    reset({
      title: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: '',
      projectId: '',
      assigneeId: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    reset({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      projectId: task.projectId ?? '',
      assigneeId: (task as any).assigneeId ?? (task as any).assignee?.id ?? '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (formData: TaskFormData) => {
    // Map empty string ids to undefined
    const cleanData = {
      ...formData,
      projectId: formData.projectId || undefined,
      assigneeId: formData.assigneeId || undefined,
    };

    if (editingTask) {
      await updateTask.mutateAsync({ id: editingTask.id, data: cleanData });
    } else {
      await createTask.mutateAsync(cleanData as Omit<Task, 'id' | 'createdAt'>);
    }
    setDialogOpen(false);
    reset();
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Tâche', key: 'title' },
      { header: 'Description', key: 'description' },
      { header: 'Statut', key: 'status' },
      { header: 'Priorité', key: 'priority' },
      { header: 'Projet', key: 'project.name' },
      { header: 'Assigné à', key: 'assignee.firstName', transform: (val: any, row: any) => row.assignee ? `${row.assignee.firstName} ${row.assignee.lastName}` : '' },
      { header: 'Date d\'échéance', key: 'dueDate', transform: (val: string) => val ? new Date(val).toLocaleDateString() : '' },
      { header: 'Date de création', key: 'createdAt', transform: (val: string) => new Date(val).toLocaleDateString() },
    ];
    exportToCSV(dataToExport, columns, `taches-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const tasks = data?.data ?? [];
  const byStatus = (status: string) => tasks.filter((t) => t.status === status);

  const handleDropTask = React.useCallback(async (taskId: string, targetStatus: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    try {
      await updateTask.mutateAsync({
        id: taskId,
        data: {
          title: task.title,
          description: task.description ?? undefined,
          status: targetStatus,
          priority: task.priority,
          dueDate: task.dueDate ? task.dueDate.split('T')[0] : undefined,
          projectId: task.projectId ?? undefined,
          assigneeId: (task as any).assigneeId ?? (task as any).assignee?.id ?? undefined,
        } as any,
      });
    } catch (err) {
      console.error('[Tasks] Failed to update status on drop:', err);
    }
  }, [tasks, updateTask]);

  const columns: Column<Task>[] = [
    {
      key: 'title',
      header: 'Tâche',
      render: (row) => (
        <div>
          <p className="font-semibold text-white text-sm">{row.title}</p>
          {row.project && <p className="text-xs text-muted-foreground mt-0.5">{row.project.name}</p>}
        </div>
      ),
    },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'priority', header: 'Priorité', render: (row) => <StatusBadge status={row.priority} /> },
    {
      key: 'assignee',
      header: 'Assigné à',
      render: (row) => row.assignee ? (
        <span className="text-xs text-gray-300 font-medium">{row.assignee.firstName} {row.assignee.lastName}</span>
      ) : (
        <span className="text-xs text-muted-foreground/60">—</span>
      ),
    },
    { key: 'dueDate', header: "Date d'échéance", render: (row) => row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—' },
    {
      key: 'actions', header: '', className: 'w-24',
      render: (row) => (
        <div className="flex gap-2">
          {((row as any).isArchived) ? (
            <button
              onClick={(e) => { e.stopPropagation(); restoreTask.mutate(row.id); }}
              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
              title="Restaurer"
            >
              <RotateCcw size={14} /> Restaurer
            </button>
          ) : (
            <>
              <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"><Edit size={14} /></button>
              {!isEmployee && (
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(row.id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tâches"
        description="Suivez et gérez les flux de travail de l'équipe et les éléments du projet"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            {!isEmployee && <Button icon={<Plus size={16} />} onClick={openCreate}>Nouvelle tâche</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total des Tâches" value={data?.total ?? 0} icon={<ListTodo size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="À faire" value={byStatus('TODO').length} icon={<CheckSquare size={20} />} colorClass="bg-gray-500/10 text-gray-400" />
        <StatCard label="En cours" value={byStatus('IN_PROGRESS').length} icon={<CheckSquare size={20} />} colorClass="bg-blue-500/10 text-blue-400" />
        <StatCard label="Terminées" value={byStatus('DONE').length} icon={<CheckSquare size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="Bloquées" value={byStatus('BLOCKED').length} icon={<AlertCircle size={20} />} colorClass="bg-red-500/10 text-red-400" />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/[0.02] border border-white/[0.04] p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher des tâches..." />
          <SelectFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={TASK_STATUSES} placeholder="Tous les statuts" />
          <SelectFilter value={priorityFilter} onChange={(v) => { setPriorityFilter(v); setPage(1); }} options={TASK_PRIORITIES} placeholder="Toutes les priorités" />
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
              className="rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            Afficher Archivés
          </label>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={myTasksOnly}
              onChange={(e) => { setMyTasksOnly(e.target.checked); setPage(1); }}
              className="rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            Mes tâches uniquement
          </label>
          <Tabs
            tabs={[{ label: 'Kanban', value: 'kanban' }, { label: 'Tableau', value: 'table' }]}
            active={viewMode}
            onChange={setViewMode}
          />
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-1 min-w-[260px] space-y-3">
                <div className="h-6 bg-white/5 rounded w-24 animate-pulse mb-3" />
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="glass-card rounded-xl p-4 h-28 animate-pulse" />
                ))}
              </div>
            ))
          ) : (
            <>
              <KanbanColumn title="À faire" statusValue="TODO" tasks={byStatus('TODO')} color="bg-gray-400" isEmployee={isEmployee} onEdit={openEdit} onDelete={(id) => setDeleteConfirm(id)} onRestore={(id) => restoreTask.mutate(id)} onDropTask={handleDropTask} />
              <KanbanColumn title="En cours" statusValue="IN_PROGRESS" tasks={byStatus('IN_PROGRESS')} color="bg-blue-400" isEmployee={isEmployee} onEdit={openEdit} onDelete={(id) => setDeleteConfirm(id)} onRestore={(id) => restoreTask.mutate(id)} onDropTask={handleDropTask} />
              <KanbanColumn title="En révision" statusValue="IN_REVIEW" tasks={byStatus('IN_REVIEW')} color="bg-purple-400" isEmployee={isEmployee} onEdit={openEdit} onDelete={(id) => setDeleteConfirm(id)} onRestore={(id) => restoreTask.mutate(id)} onDropTask={handleDropTask} />
              <KanbanColumn title="Fait" statusValue="DONE" tasks={byStatus('DONE')} color="bg-emerald-400" isEmployee={isEmployee} onEdit={openEdit} onDelete={(id) => setDeleteConfirm(id)} onRestore={(id) => restoreTask.mutate(id)} onDropTask={handleDropTask} />
              <KanbanColumn title="Bloqué" statusValue="BLOCKED" tasks={byStatus('BLOCKED')} color="bg-red-400" isEmployee={isEmployee} onEdit={openEdit} onDelete={(id) => setDeleteConfirm(id)} onRestore={(id) => restoreTask.mutate(id)} onDropTask={handleDropTask} />
            </>
          )}
        </div>
      ) : (
        <>
          <DataTable<Task>
            columns={columns}
            data={tasks}
            isLoading={isLoading}
            keyExtractor={(row) => row.id}
            emptyMessage="Aucune tâche trouvée."
          />
          {data && data.totalPages > 1 && (
            <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={50} onPageChange={setPage} />
          )}
        </>
      )}

      {/* Task Dialog */}
      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title={editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Titre de la tâche" required error={errors.title?.message}>
            <Input {...register('title', { required: 'Requis' })} placeholder="Conception de la maquette de la page d'accueil" disabled={isEmployee} />
          </FormField>
          <FormField label="Description">
            <Textarea {...register('description')} placeholder="Détails de la tâche et exigences..." rows={3} disabled={isEmployee} />
          </FormField>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Projet">
              <Select {...register('projectId')} disabled={isEmployee}>
                <option value="">Aucun projet</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Assigné à">
              <Select {...register('assigneeId')} disabled={isEmployee}>
                <option value="">Non assigné</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Statut" required>
              <Select {...register('status', { required: true })}>
                {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Priorité" required>
              <Select {...register('priority', { required: true })} disabled={isEmployee}>
                {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField label="Date d'échéance">
            <Input {...register('dueDate')} type="date" disabled={isEmployee} />
          </FormField>
          
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingTask ? 'Enregistrer' : 'Créer la tâche'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Archiver la tâche" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Êtes-vous sûr de vouloir archiver cette tâche ? Vous pourrez la restaurer ultérieurement.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteTask.isPending} onClick={() => deleteConfirm && deleteTask.mutateAsync(deleteConfirm).then(() => setDeleteConfirm(null))}>
            Archiver
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
