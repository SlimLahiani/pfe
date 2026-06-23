import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Building2, Plus, Trash2, Users, DollarSign, Target, Award, ChevronRight, RotateCcw, Download } from 'lucide-react';
import { useDepartments, useCreateDepartment, useDeleteDepartment, useRestoreDepartment, type Department } from '../../../hooks/use-api';
import {
  PageHeader, SearchInput, DataTable, Pagination,
  Column, Dialog, FormField, Input, Textarea, Button, StatCard,
} from '../../../components/shared/ui';
import { exportToCSV } from '../../../lib/export-csv';

interface DeptFormData {
  name: string;
  description?: string;
}

const DEPT_FALLBACK_BUDGETS: Record<string, number> = {
  'Management': 150000,
  'Creative & Design': 80000,
  'Digital Marketing': 60000,
  'Engineering & Development': 120000,
  'Finance & Operations': 45000,
  'Human Resources': 35000,
};

const DEPT_FALLBACK_KPIS: Record<string, string[]> = {
  'Management': ['Marge bénéficiaire > 20%', 'Satisfaction client > 92%'],
  'Creative & Design': ['Temps moyen de rendu graphique', 'Score qualité créative > 90%'],
  'Digital Marketing': ['Coût par lead (CPL) < 5 TND', 'Volume de trafic généré'],
  'Engineering & Development': ['Sprints complétés à 90%', 'Disponibilité prod > 99.9%'],
  'Finance & Operations': ['Marge de recouvrement > 96%', 'Délai paiement fournisseurs'],
  'Human Resources': ['Turn-over annuel < 7%', 'Délai recrutement < 30j'],
};

export const DepartmentsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState<Department | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useDepartments({
    page,
    limit: 10,
    search,
    isArchived: showArchived,
  });
  const createDept = useCreateDepartment();
  const deleteDept = useDeleteDepartment();
  const restoreDept = useRestoreDepartment();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DeptFormData>();

  const onSubmit = async (formData: DeptFormData) => {
    await createDept.mutateAsync(formData);
    setCreateDialogOpen(false);
    reset();
  };

  const getManagerName = (row: Department) => {
    const employees = row.employees ?? [];
    if (employees.length === 0) return 'Non désigné';

    // Look for senior title
    const manager = employees.find(emp => {
      const title = emp.jobTitle?.toLowerCase() ?? '';
      return title.includes('directeur') || title.includes('responsable') || title.includes('principal') || title.includes('général');
    });

    if (manager) {
      return `${manager.user?.firstName} ${manager.user?.lastName}`;
    }
    return `${employees[0].user?.firstName} ${employees[0].user?.lastName}`;
  };

  const getManagerTitle = (row: Department) => {
    const employees = row.employees ?? [];
    if (employees.length === 0) return '';

    const manager = employees.find(emp => {
      const title = emp.jobTitle?.toLowerCase() ?? '';
      return title.includes('directeur') || title.includes('responsable') || title.includes('principal') || title.includes('général');
    });

    return manager?.jobTitle ?? employees[0].jobTitle ?? '';
  };

  const getAveragePerformance = (row: Department) => {
    const employees = row.employees ?? [];
    if (employees.length === 0) return 90; // Default fallback
    const total = employees.reduce((sum, e) => sum + (e.performanceScore ?? 100), 0);
    return Math.round(total / employees.length);
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Département', key: 'name' },
      { header: 'Description', key: 'description' },
      { header: 'Nombre d\'employés', key: 'employees.length', transform: (val: any, row: any) => row.employees?.length ?? 0 },
      { header: 'Budget Annuel (TND)', key: 'budget', transform: (val: any, row: any) => row.budget ? Number(row.budget) : (DEPT_FALLBACK_BUDGETS[row.name] ?? 40000) },
      { header: 'Date de création', key: 'createdAt', transform: (val: string) => new Date(val).toLocaleDateString() },
    ];
    exportToCSV(dataToExport, columns, `departements-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const columns: Column<Department>[] = [
    {
      key: 'name',
      header: 'Département',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Building2 size={14} className="text-purple-400" />
          </div>
          <div>
            <span className="font-semibold text-white text-sm block">{row.name}</span>
            <span className="text-[10px] text-muted-foreground line-clamp-1">{row.description ?? '—'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'manager',
      header: 'Responsable',
      render: (row) => {
        const name = getManagerName(row);
        const title = getManagerTitle(row);
        return (
          <div>
            <p className="font-medium text-white text-xs">{name}</p>
            {title && <p className="text-[10px] text-muted-foreground">{title}</p>}
          </div>
        );
      },
    },
    {
      key: 'members',
      header: 'Membres',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-xs text-gray-300">
          <Users size={12} className="text-gray-500" />
          {row.employees?.length ?? 0} collabs.
        </span>
      ),
    },
    {
      key: 'budget',
      header: 'Budget Annuel',
      render: (row) => {
        const val = row.budget ? Number(row.budget) : (DEPT_FALLBACK_BUDGETS[row.name] ?? 40000);
        return (
          <span className="font-mono text-xs text-emerald-400 font-bold">
            {val.toLocaleString('fr-FR')} TND
          </span>
        );
      },
    },
    {
      key: 'kpis',
      header: 'Indicateurs KPIs',
      render: (row) => {
        // Parse from JSON or use fallback
        let items: string[] = [];
        try {
          if (row.kpis) {
            items = typeof row.kpis === 'string' ? JSON.parse(row.kpis) : row.kpis;
          }
        } catch (e) {
          items = [];
        }
        if (items.length === 0) {
          items = DEPT_FALLBACK_KPIS[row.name] ?? ['Performance équipe'];
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {items.map((k, idx) => (
              <span key={idx} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[8px] text-gray-400 truncate max-w-[100px]" title={k}>
                {k}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'perf',
      header: 'Performance moyenne',
      render: (row) => {
        const perf = getAveragePerformance(row);
        const badgeColor = perf >= 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                           perf >= 75 ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                        'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
            <Award size={10} /> {perf}%
          </span>
        );
      },
    },
    {
      key: 'actions', header: '', className: 'w-24 text-right',
      render: (row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {((row as any).isArchived) ? (
            <button
              onClick={() => restoreDept.mutate(row.id)}
              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
              title="Restaurer"
            >
              <RotateCcw size={12} /> Restaurer
            </button>
          ) : (
            <>
              <button
                onClick={() => setDetailDialogOpen(row)}
                className="p-1 rounded-lg text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold flex items-center gap-1"
              >
                Membres <ChevronRight size={10} />
              </button>
              <button onClick={() => setDeleteConfirm(row.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
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
        title="Départements & Pôles"
        description="Pilotez la structure d'équipe de l'agence, les budgets de pôle et les objectifs de performance"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => { reset(); setCreateDialogOpen(true); }}>Ajouter un département</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Départements" value={data?.total ?? 0} icon={<Building2 size={20} />} colorClass="bg-purple-500/10 text-purple-400" />
        <StatCard label="Budget Total Alloué" value="510 000 TND" icon={<DollarSign size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="KPIs Remplis" value="84%" icon={<Target size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="Effectif Encadré" value="10 collaborateurs" icon={<Users size={20} />} colorClass="bg-pink-500/10 text-pink-400" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher des départements..." />
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

      <DataTable<Department>
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Aucun département créé pour le moment."
        onRowClick={(row) => setDetailDialogOpen(row)}
      />

      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={10} onPageChange={setPage} />
      )}

      {/* CREATE DIALOG */}
      <Dialog isOpen={createDialogOpen} onClose={() => setCreateDialogOpen(false)} title="Nouveau département" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Nom du département" required error={errors.name?.message}>
            <Input {...register('name', { required: 'Requis' })} placeholder="Ex: Studio Créatif" />
          </FormField>
          <FormField label="Description">
            <Textarea {...register('description')} placeholder="Aperçu des attributions du département..." rows={3} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting}>Créer le pôle</Button>
          </div>
        </form>
      </Dialog>

      {/* DETAIL DIALOG: ROSTER LIST */}
      <Dialog
        isOpen={!!detailDialogOpen}
        onClose={() => setDetailDialogOpen(null)}
        title={`Membres du Pôle — ${detailDialogOpen?.name}`}
        size="md"
      >
        {detailDialogOpen && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01]">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Description</span>
              <p className="text-xs text-white mt-1">{detailDialogOpen.description ?? "Pas de description fournie."}</p>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-indigo-400 uppercase font-bold">Annuaire des collaborateurs ({detailDialogOpen.employees?.length ?? 0})</span>
              <div className="divide-y divide-white/5 border border-white/5 bg-white/[0.01] rounded-xl">
                {detailDialogOpen.employees && detailDialogOpen.employees.length > 0 ? (
                  detailDialogOpen.employees.map(emp => (
                    <div key={emp.id} className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-xs text-indigo-300">
                        {emp.user?.firstName?.[0]}{emp.user?.lastName?.[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{emp.user?.firstName} {emp.user?.lastName}</p>
                        <p className="text-[10px] text-muted-foreground">{emp.jobTitle}</p>
                      </div>
                      <span className="ml-auto text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                        {emp.employeeCode}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Aucun collaborateur affecté à ce département pour l'instant.
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setDetailDialogOpen(null)}>Fermer l'annuaire</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* DELETE CONFIRM DIALOG */}
      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Archiver le département" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Êtes-vous sûr de vouloir archiver ce département ? Les employés ne seront pas supprimés et vous pourrez le restaurer ultérieurement.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteDept.isPending} onClick={() => deleteConfirm && deleteDept.mutateAsync(deleteConfirm).then(() => setDeleteConfirm(null))}>Archiver</Button>
        </div>
      </Dialog>
    </div>
  );
};
