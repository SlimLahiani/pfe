import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  UserCheck,
  Plus,
  Trash2,
  Download,
  Award,
  FileText,
  Layers,
  Clock,
  TrendingUp,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useRestoreEmployee,
  useEmployeeAttendance,
  usePayslips,
  useCreatePayslip,
  useEmployeeHistory,
  useAddHistoryEvent,
  useOnboardingTasks,
  useToggleOnboardingTask,
  useEmployeeSalaries,
  useCreateSalary,
  downloadPdf,
  type Employee,
} from '../../../hooks/use-api';
import {
  PageHeader,
  SearchInput,
  SelectFilter,
  DataTable,
  Pagination,
  Column,
  StatusBadge,
  Dialog,
  FormField,
  Input,
  Select,
  Button,
  StatCard,
} from '../../../components/shared/ui';
import { exportToCSV } from '../../../lib/export-csv';
import { useAuth } from '../../../context/auth-context';

const EMPLOYEE_STATUSES = [
  { label: 'Actif', value: 'ACTIVE' },
  { label: 'En congé', value: 'ON_LEAVE' },
  { label: 'Licencié', value: 'TERMINATED' },
];

const LIFECYCLE_STAGES = [
  { label: 'Candidat / Recrutement', value: 'CANDIDATE' },
  { label: 'Intégration / Onboarding', value: 'ONBOARDING' },
  { label: 'Titulaire / Actif', value: 'ACTIVE' },
  { label: 'Sortie / Exit en cours', value: 'EXIT' },
];

interface EmployeeFormData {
  userId: string;
  employeeCode: string;
  jobTitle?: string;
  hireDate?: string;
  status: string;
  nationalId?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  emergencyContact?: string;
}

interface NewSalaryFormData {
  amount: number;
  effectiveFrom: string;
  note?: string;
}

interface NewPayslipFormData {
  month: number;
  year: number;
  bonuses?: number;
  deductions?: number;
  notes?: string;
}

interface NewEventFormData {
  eventType: string;
  title: string;
  description?: string;
  notes?: string;
}

export const EmployeesPage: React.FC = () => {
  const { user } = useAuth();
  const isHRorCEO = user?.role === 'GERANT' || user?.role === 'RESPONSABLE_RH';
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  
  // Modals / Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Inside Folder Tab
  const [folderTab, setFolderTab] = useState<'fiche' | 'onboarding' | 'payroll' | 'career' | 'attendance'>('fiche');

  // API Hooks
  const { data, isLoading } = useEmployees({
    page,
    limit: 10,
    search,
    status: statusFilter || undefined,
    isArchived: showArchived,
  });
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const restoreEmployee = useRestoreEmployee();
  const { data: usersList = [] } = useQuery<any[]>({
    queryKey: ['users-list-hr'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    }
  });

  // Create/Edit employee form
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EmployeeFormData>({
    defaultValues: { status: 'ACTIVE' },
  });

  // Folder sub-queries (dynamic hook wrappers)
  const empId = detailDialogOpen?.id ?? '';
  const { data: attendance } = useEmployeeAttendance(empId);
  const { data: payslips } = usePayslips(empId);
  const { data: history } = useEmployeeHistory(empId);
  const { data: onboarding } = useOnboardingTasks(empId);
  const { data: salaries } = useEmployeeSalaries(empId);

  // Sub-forms mutations
  const createPayslip = useCreatePayslip(empId);
  const addHistory = useAddHistoryEvent(empId);
  const toggleOnboarding = useToggleOnboardingTask(empId);
  const createSalary = useCreateSalary(empId);

  // Sub-forms hook states
  const { register: regSal, handleSubmit: handleSalSubmit, reset: resetSalForm } = useForm<NewSalaryFormData>();
  const { register: regPay, handleSubmit: handlePaySubmit, reset: resetPayForm } = useForm<NewPayslipFormData>({
    defaultValues: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
  });
  const { register: regEv, handleSubmit: handleEvSubmit, reset: resetEvForm } = useForm<NewEventFormData>({
    defaultValues: { eventType: 'PROMOTION' },
  });

  const openCreate = () => {
    reset({ userId: '', employeeCode: '', jobTitle: '', hireDate: '', status: 'ACTIVE', nationalId: '', phone: '', address: '', dateOfBirth: '', emergencyContact: '' });
    setCreateDialogOpen(true);
  };

  const onSubmit = async (formData: EmployeeFormData) => {
    // Standard create
    await createEmployee.mutateAsync(formData);
    setCreateDialogOpen(false);
    reset();
  };

  // Onboarding progress calculation
  const totalTasks = onboarding?.length ?? 0;
  const completedTasks = onboarding?.filter(t => t.isCompleted).length ?? 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleDownloadDoc = (docType: string, filename: string) => {
    if (!detailDialogOpen) return;
    downloadPdf(`/hr/employees/${detailDialogOpen.id}/generate-pdf/${docType}`, filename);
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Prénom', key: 'user.firstName' },
      { header: 'Nom', key: 'user.lastName' },
      { header: 'E-mail', key: 'user.email' },
      { header: 'Matricule', key: 'employeeCode' },
      { header: 'Poste', key: 'jobTitle' },
      { header: 'Département', key: 'department.name' },
      { header: 'Statut', key: 'status' },
      { header: 'Cycle de vie', key: 'lifecycleStage' },
    ];
    exportToCSV(dataToExport, columns, `collaborateurs-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const columns: Column<Employee>[] = [
    {
      key: 'user',
      header: 'Employé',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">
            {row.user?.firstName?.[0]}{row.user?.lastName?.[0]}
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{row.user?.firstName} {row.user?.lastName}</p>
            <p className="text-xs text-muted-foreground">{row.user?.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'employeeCode', header: 'Matricule', render: (row) => <span className="font-mono text-xs text-indigo-300">{row.employeeCode}</span> },
    { key: 'jobTitle', header: 'Poste', render: (row) => row.jobTitle ?? '—' },
    { key: 'department', header: 'Département', render: (row) => row.department?.name ?? '—' },
    { key: 'lifecycleStage', header: 'Étape de vie', render: (row) => (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300 capitalize">
        {row.lifecycleStage.toLowerCase()}
      </span>
    )},
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: '', className: 'w-24 text-right',
      render: (row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {((row as any).isArchived) ? (
            isHRorCEO && (
              <button
                onClick={() => restoreEmployee.mutate(row.id)}
                className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
                title="Restaurer"
              >
                <RotateCcw size={12} /> Restaurer
              </button>
            )
          ) : (
            <>
              <button
                onClick={() => setDetailDialogOpen(row)}
                className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors text-xs font-bold flex items-center gap-1 border border-indigo-500/20"
              >
                Fiche <ChevronRight size={12} />
              </button>
              {isHRorCEO && (
                <button
                  onClick={() => setDeleteConfirm(row.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
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
        title="Dossiers Collaborateurs"
        description="Gestion complète du cycle de vie des collaborateurs, pointages, salaires et documents officiels"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            {isHRorCEO && <Button icon={<Plus size={16} />} onClick={openCreate}>Nouveau collaborateur</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Dossiers RH" value={data?.total ?? 0} icon={<UserCheck size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="Intégrations en cours" value={(data?.data ?? []).filter(e => e.lifecycleStage === 'ONBOARDING').length} icon={<Layers size={20} />} colorClass="bg-pink-500/10 text-pink-400" />
        <StatCard label="Membres actifs" value={(data?.data ?? []).filter(e => e.status === 'ACTIVE').length} icon={<UserCheck size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher par nom, matricule ou poste..." />
        <SelectFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={EMPLOYEE_STATUSES} placeholder="Tous les statuts" />
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

      <DataTable<Employee>
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Aucun collaborateur trouvé."
        onRowClick={(row) => setDetailDialogOpen(row)}
      />

      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={10} onPageChange={setPage} />
      )}

      {/* CREATE NEW EMPLOYEE DIALOG */}
      <Dialog isOpen={createDialogOpen} onClose={() => setCreateDialogOpen(false)} title="Créer un nouveau dossier collaborateur">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Utilisateur" required error={errors.userId?.message}>
            <Select {...register('userId', { required: 'Requis' })}>
              <option value="">Sélectionner un utilisateur...</option>
              {usersList.filter((u: any) => !u.employeeProfile).map((u: any) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Matricule RH" required error={errors.employeeCode?.message}>
              <Input {...register('employeeCode', { required: 'Requis' })} placeholder="EMP-011" />
            </FormField>
            <FormField label="Poste agence">
              <Input {...register('jobTitle')} placeholder="Lead Developer" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date d'embauche">
              <Input {...register('hireDate')} type="date" />
            </FormField>
            <FormField label="Statut initial">
              <Select {...register('status')}>
                {EMPLOYEE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting}>Initialiser dossier</Button>
          </div>
        </form>
      </Dialog>

      {/* COMPREHENSIVE TABBED DETAIL DRAWER (FOLDER) */}
      <Dialog
        isOpen={!!detailDialogOpen}
        onClose={() => setDetailDialogOpen(null)}
        title={`Dossier Personnel — ${detailDialogOpen?.user?.firstName} ${detailDialogOpen?.user?.lastName}`}
        size="lg"
      >
        {detailDialogOpen && (
          <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
            
            {/* Sidebar Folder Tab Selectors */}
            <div className="w-full lg:w-48 flex flex-col space-y-1 border-r border-white/5 pr-4 shrink-0">
              <button
                onClick={() => setFolderTab('fiche')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center gap-2 ${
                  folderTab === 'fiche' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <UserCheck size={14} /> Fiche & Attestations
              </button>
              <button
                onClick={() => setFolderTab('onboarding')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center gap-2 ${
                  folderTab === 'onboarding' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Layers size={14} /> Lifecycle & Onboarding
              </button>
              <button
                onClick={() => setFolderTab('payroll')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center gap-2 ${
                  folderTab === 'payroll' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <DollarSign size={14} /> Paie & Rémunération
              </button>
              <button
                onClick={() => setFolderTab('career')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center gap-2 ${
                  folderTab === 'career' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <TrendingUp size={14} /> Parcours & Carrière
              </button>
              <button
                onClick={() => setFolderTab('attendance')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center gap-2 ${
                  folderTab === 'attendance' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Clock size={14} /> Emargements & Présences
              </button>
            </div>

            {/* Folder Tab Content Area */}
            <div className="flex-1 min-w-0 space-y-4">
              
              {/* TAB 1: FICHE */}
              {folderTab === 'fiche' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 p-4 rounded-xl border border-white/5 bg-white/[0.01]">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Matricule</p>
                      <p className="text-xs text-white font-mono">{detailDialogOpen.employeeCode}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Poste actuel</p>
                      <p className="text-xs text-white">{detailDialogOpen.jobTitle ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Département</p>
                      <p className="text-xs text-white">{detailDialogOpen.department?.name ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Date de naissance</p>
                      <p className="text-xs text-white">
                        {detailDialogOpen.dateOfBirth ? new Date(detailDialogOpen.dateOfBirth).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Numéro CIN</p>
                      <p className="text-xs text-white font-mono">{detailDialogOpen.nationalId ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Téléphone</p>
                      <p className="text-xs text-white font-mono">{detailDialogOpen.phone ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Adresse</p>
                      <p className="text-xs text-white col-span-2">{detailDialogOpen.address ?? '—'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-white">Édition de documents légaux (PDF)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button
                        onClick={() => handleDownloadDoc('work-certificate', `attestation-travail-${detailDialogOpen.employeeCode}.pdf`)}
                        className="py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 flex items-center justify-center gap-2 text-xs font-bold"
                      >
                        <Download size={14} /> Attestation de travail
                      </Button>
                      <Button
                        onClick={() => handleDownloadDoc('salary-certificate', `attestation-salaire-${detailDialogOpen.employeeCode}.pdf`)}
                        className="py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 flex items-center justify-center gap-2 text-xs font-bold"
                      >
                        <Award size={14} /> Attestation de Salaire
                      </Button>
                      <Button
                        onClick={() => handleDownloadDoc('contract', `contrat-travail-${detailDialogOpen.employeeCode}.pdf`)}
                        className="py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 flex items-center justify-center gap-2 text-xs font-bold"
                      >
                        <FileText size={14} /> Contrat de travail
                      </Button>
                      <Button
                        onClick={() => handleDownloadDoc('internship-certificate', `attestation-stage-${detailDialogOpen.employeeCode}.pdf`)}
                        className="py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 flex items-center justify-center gap-2 text-xs font-bold"
                      >
                        <ShieldCheck size={14} /> Certificat de Stage
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ONBOARDING */}
              {folderTab === 'onboarding' && (
                <div className="space-y-6">
                  {/* Progress tracker */}
                  <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-white">Progression de l'onboarding</span>
                      <span className="font-mono text-indigo-400 font-bold">{progressPercent}% ({completedTasks}/{totalTasks} tâches)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>

                  {/* Lifecycle stage transition */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white">Étape de cycle de vie</h4>
                    <div className="flex flex-wrap gap-2">
                      {LIFECYCLE_STAGES.map(stage => {
                        const isCurrent = detailDialogOpen.lifecycleStage === stage.value;
                        return (
                          <button
                            key={stage.value}
                            onClick={async () => {
                              await updateEmployee.mutateAsync({ id: detailDialogOpen.id, data: { lifecycleStage: stage.value } });
                              setDetailDialogOpen({ ...detailDialogOpen, lifecycleStage: stage.value });
                              qc.invalidateQueries({ queryKey: ['employees'] });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                              isCurrent
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                                : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'
                            }`}
                          >
                            {stage.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-white">Liste des tâches d'intégration</h4>
                    <div className="divide-y divide-white/5 border border-white/5 rounded-xl bg-white/[0.01]">
                      {onboarding && onboarding.length > 0 ? (
                        onboarding.map(t => (
                          <div key={t.id} className="flex items-center gap-3 p-3">
                            <input
                              type="checkbox"
                              checked={t.isCompleted}
                              onChange={(e) => toggleOnboarding.mutate({ taskId: t.id, isCompleted: e.target.checked })}
                              className="rounded border-white/10 text-indigo-600 focus:ring-0 bg-transparent"
                            />
                            <span className={`text-xs ${t.isCompleted ? 'line-through text-muted-foreground' : 'text-gray-200'}`}>
                              {t.taskName}
                            </span>
                            {t.completedAt && (
                              <span className="ml-auto text-[9px] text-muted-foreground">
                                Complétée le {new Date(t.completedAt).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          Aucune tâche d'onboarding définie pour ce profil.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PAYROLL */}
              {folderTab === 'payroll' && (
                <div className="space-y-6">
                  
                  {/* Grid layout with forms and history */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Left column: Salaries & Payroll slips lists */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-white">Historique de salaire (TND)</h4>
                        <div className="divide-y divide-white/5 border border-white/5 bg-white/[0.01] rounded-xl text-xs max-h-40 overflow-y-auto mt-2">
                          {salaries && salaries.length > 0 ? (
                            salaries.map(s => (
                              <div key={s.id} className="flex justify-between items-center p-3">
                                <div>
                                  <p className="font-semibold text-white font-mono">{Number(s.amount).toFixed(3)} TND</p>
                                  <p className="text-[10px] text-muted-foreground">Depuis {new Date(s.effectiveFrom).toLocaleDateString('fr-FR')}</p>
                                </div>
                                <span className="text-[10px] text-gray-400 italic truncate max-w-[120px]">{s.note ?? '—'}</span>
                              </div>
                            ))
                          ) : (
                            <p className="p-4 text-center text-xs text-muted-foreground">Aucun salaire enregistré.</p>
                          )}
                        </div>
                      </div>

                      {/* Salary Form */}
                      <form onSubmit={handleSalSubmit(async (d) => {
                        await createSalary.mutateAsync(d);
                        resetSalForm();
                      })} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-3">
                        <span className="text-[10px] text-indigo-400 uppercase font-bold">Ajuster le salaire</span>
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Montant brut (TND)">
                            <Input type="number" step="0.001" {...regSal('amount', { required: true })} />
                          </FormField>
                          <FormField label="Date d'effet">
                            <Input type="date" {...regSal('effectiveFrom', { required: true })} />
                          </FormField>
                        </div>
                        <FormField label="Note explicative">
                          <Input {...regSal('note')} placeholder="Ex. Augmentation annuelle" />
                        </FormField>
                        <Button type="submit" className="w-full py-2 text-xs">Ajuster le salaire</Button>
                      </form>
                    </div>

                    {/* Right column: Create slip form */}
                    <div className="space-y-4">
                      <form onSubmit={handlePaySubmit(async (d) => {
                        await createPayslip.mutateAsync(d);
                        resetPayForm();
                      })} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-3">
                        <span className="text-[10px] text-indigo-400 uppercase font-bold">Émettre un bulletin de salaire</span>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Mois (1-12)">
                            <Input type="number" min={1} max={12} {...regPay('month', { required: true })} />
                          </FormField>
                          <FormField label="Année">
                            <Input type="number" {...regPay('year', { required: true })} />
                          </FormField>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Primes (TND)">
                            <Input type="number" step="0.001" {...regPay('bonuses')} placeholder="0.000" />
                          </FormField>
                          <FormField label="Déductions (TND)">
                            <Input type="number" step="0.001" {...regPay('deductions')} placeholder="0.000" />
                          </FormField>
                        </div>

                        <FormField label="Note additionnelle">
                          <Input {...regPay('notes')} placeholder="Notes complémentaires..." />
                        </FormField>

                        <Button type="submit" className="w-full py-2 text-xs">Générer Bulletin</Button>
                      </form>
                    </div>

                  </div>

                  {/* Bulletins Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white">Bulletins de salaire émis</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-muted-foreground">
                            <th className="py-2">Période</th>
                            <th className="py-2">Base (TND)</th>
                            <th className="py-2">Primes</th>
                            <th className="py-2">Déductions</th>
                            <th className="py-2 font-bold">Net (TND)</th>
                            <th className="py-2 text-right">Télécharger</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-200">
                          {payslips && payslips.length > 0 ? (
                            payslips.map(p => (
                              <tr key={p.id} className="hover:bg-white/[0.01]">
                                <td className="py-2 font-semibold">Mois {p.month} / {p.year}</td>
                                <td className="py-2 font-mono">{Number(p.baseSalary).toFixed(3)}</td>
                                <td className="py-2 font-mono text-emerald-400">+{Number(p.bonuses).toFixed(3)}</td>
                                <td className="py-2 font-mono text-rose-400">-{Number(p.deductions).toFixed(3)}</td>
                                <td className="py-2 font-mono text-white font-bold">{Number(p.netSalary).toFixed(3)}</td>
                                <td className="py-2 text-right">
                                  <button
                                    onClick={() => downloadPdf(`/hr/payslips/${p.id}/pdf`, `bulletin-${p.month}-${p.year}.pdf`)}
                                    className="p-1 rounded bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/25 text-indigo-400 transition-all"
                                  >
                                    <Download size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-muted-foreground">Aucun bulletin de paie mensuel émis.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 4: CAREER TIMELINE */}
              {folderTab === 'career' && (
                <div className="space-y-6">
                  
                  {/* Timeline listing */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-white">Parcours professionnel de l'employé</h4>
                    
                    <div className="relative border-l border-white/5 pl-4 ml-2 space-y-6 max-h-64 overflow-y-auto">
                      {history && history.length > 0 ? (
                        history.map(ev => (
                          <div key={ev.id} className="relative">
                            {/* Dot indicator */}
                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-background" />
                            <span className="text-[9px] text-muted-foreground font-mono block">
                              {new Date(ev.eventDate).toLocaleDateString('fr-FR')}
                            </span>
                            <span className="text-xs font-semibold text-white block mt-0.5">
                              {ev.title}
                            </span>
                            <p className="text-xs text-gray-300">
                              {ev.description}
                            </p>
                            {ev.notes && (
                              <p className="text-[10px] text-muted-foreground italic mt-0.5">
                                Notes: {ev.notes}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground py-4">Aucun événement de carrière répertorié.</p>
                      )}
                    </div>
                  </div>

                  {/* Add history form */}
                  <form onSubmit={handleEvSubmit(async (d) => {
                    await addHistory.mutateAsync(d);
                    resetEvForm();
                  })} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-3">
                    <span className="text-[10px] text-indigo-400 uppercase font-bold">Enregistrer une promotion / modification de poste</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Type d'événement">
                        <Select {...regEv('eventType')}>
                          <option value="PROMOTION">Promotion</option>
                          <option value="STAGE_CHANGE">Changement d'étape cycle de vie</option>
                          <option value="SALARY_CHANGE">Revue de Salaire</option>
                          <option value="DEPARTMENT_CHANGE">Mutation Département</option>
                        </Select>
                      </FormField>
                      <FormField label="Titre de l'événement">
                        <Input {...regEv('title', { required: true })} placeholder="Ex: Promotion Directeur de Projet" />
                      </FormField>
                    </div>

                    <FormField label="Description détaillée">
                      <Input {...regEv('description')} placeholder="Ex: Evolution de poste suite à évaluation annuelle..." />
                    </FormField>

                    <FormField label="Notes internes">
                      <Input {...regEv('notes')} placeholder="Notes confidentielles..." />
                    </FormField>

                    <Button type="submit" className="w-full py-2 text-xs">Enregistrer Événement</Button>
                  </form>

                </div>
              )}

              {/* TAB 5: ATTENDANCE */}
              {folderTab === 'attendance' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white">Rapport des pointages journaliers</h4>
                  
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-muted-foreground font-semibold">
                          <th className="py-2">Date</th>
                          <th className="py-2">Check-in (Entrée)</th>
                          <th className="py-2">Check-out (Sortie)</th>
                          <th className="py-2">Heures cumulées</th>
                          <th className="py-2">Heures Supp.</th>
                          <th className="py-2">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-200">
                        {attendance && attendance.length > 0 ? (
                          attendance.map(rec => (
                            <tr key={rec.id} className="hover:bg-white/[0.01]">
                              <td className="py-2">{new Date(rec.date).toLocaleDateString('fr-FR')}</td>
                              <td className="py-2 font-mono text-gray-300">
                                {rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="py-2 font-mono text-gray-300">
                                {rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="py-2 font-mono">{Number(rec.hoursWorked ?? 0).toFixed(2)} h</td>
                              <td className="py-2 font-mono text-emerald-400">+{Number(rec.overtime ?? 0).toFixed(2)} h</td>
                              <td className="py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                                  rec.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  rec.status === 'LATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  rec.status === 'REMOTE' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                  'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                }`}>
                                  {rec.status === 'PRESENT' ? 'Présent' :
                                   rec.status === 'LATE' ? 'En retard' :
                                   rec.status === 'REMOTE' ? 'Télétravail' : 'Absent'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-muted-foreground">Aucun émargement enregistré.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}
      </Dialog>

      {/* DELETE CONFIRM DIALOG */}
      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Archiver le collaborateur" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Êtes-vous sûr de vouloir archiver ce dossier collaborateur ? Vous pourrez le restaurer ultérieurement.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteEmployee.isPending} onClick={() => deleteConfirm && deleteEmployee.mutateAsync(deleteConfirm).then(() => setDeleteConfirm(null))}>Archiver</Button>
        </div>
      </Dialog>
    </div>
  );
};
