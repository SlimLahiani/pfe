import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Target,
  Sparkles,
  Shield,
  Clock,
  Plus,
  FileText,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Check,
  X,
  RefreshCw,
  Loader2,
  Trash2,
  Download,
} from 'lucide-react';
import { useAuth } from '../../../context/auth-context';
import { StatCard, PageHeader } from '../../../components/shared/ui';
import {
  useReports,
  useReport,
  useCreateReport,
  useDeleteReport,
  useRunReport,
  useApproveReport,
  useRejectReport,
  useComparisonAnalytics,
  useCreateReportSchedule,
  useProjects,
  getReportPdfUrl,
  downloadPdf,
} from '../../../hooks/use-api';

const subTypesByReportType: Record<string, string[]> = {
  FINANCIAL: ['Flux de trésorerie', 'Revenus & Dépenses', 'Budget & Marge'],
  HR: ['Congés & Présences', 'Performances', 'Contrats & Recrutement'],
  PROJECT: ['Avancement général', 'Budget & Ressources', 'Tâches & Délais'],
  CRM: ['Pipeline Commercial', 'Génération de Leads'],
  MARKETING: ['ROI Publicitaire', 'Acquisition par Canaux'],
  SALES: ['Suivi des Devis', 'Entonnoir de Conversion'],
  PRODUCTIVITY: ['Performance Globale', 'Productivité Individuelle'],
};

const formatDate = (dateString?: string | Date) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roleName = user?.role ? (typeof user.role === 'string' ? user.role : (user.role as any).name || '') : '';
  const isCEO = roleName === 'GERANT';
  const isHrManager = roleName === 'RESPONSABLE_RH';
  const isFinanceManager = roleName === 'RESPONSABLE_FINANCIER';

  // State
  const [activeTab, setActiveTab] = useState<string>(isCEO ? 'compare' : 'my-reports');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewActionType, setReviewActionType] = useState<'approve' | 'reject'>('approve');
  const [reviewComment, setReviewComment] = useState('');
  
  // Create Report Form State
  const [newReportName, setNewReportName] = useState('');
  const [newReportType, setNewReportType] = useState<string>('');
  const [newReportSubType, setNewReportSubType] = useState('');
  const [newReportPeriod, setNewReportPeriod] = useState('June 2026');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Create Schedule Form State
  const [cronExpr, setCronExpr] = useState('0 9 * * 1'); // Every Monday at 9am
  const [recipientsStr, setRecipientsStr] = useState('');

  // Queries & Mutations
  const { data: reportsResponse, isLoading: isLoadingReports } = useReports({ limit: 100 });
  const reports = reportsResponse?.data ?? [];

  const { data: selectedReportDetail, isLoading: isLoadingDetail } = useReport(selectedReportId || undefined);
  const { data: projectsResponse } = useProjects({ limit: 100 });
  const projects = projectsResponse?.data ?? [];

  const { data: comparisonData, isLoading: isLoadingComparison } = useComparisonAnalytics({ enabled: isCEO });

  const createReportMutation = useCreateReport();
  const runReportMutation = useRunReport();
  const deleteReportMutation = useDeleteReport();
  const approveReportMutation = useApproveReport();
  const rejectReportMutation = useRejectReport();
  const createScheduleMutation = useCreateReportSchedule(selectedReportId || '');

  // Loading indicator for run/mutation actions
  const [isMutating, setIsMutating] = useState(false);

  // Allowed report types memo
  const allowedTypes = useMemo(() => {
    if (roleName === 'GERANT') {
      return ['FINANCIAL', 'HR', 'PROJECT', 'CRM', 'MARKETING', 'SALES', 'PRODUCTIVITY'];
    } else if (roleName === 'RESPONSABLE_RH') {
      return ['HR', 'PRODUCTIVITY'];
    } else if (roleName === 'RESPONSABLE_FINANCIER') {
      return ['FINANCIAL'];
    } else if (roleName === 'RESPONSABLE_MARKETING') {
      return ['MARKETING'];
    } else if (roleName === 'RESPONSABLE_VENTES') {
      return ['SALES'];
    } else if (roleName === 'CHEF_PROJET') {
      return ['PROJECT', 'PRODUCTIVITY'];
    } else if (roleName === 'SECRETAIRE') {
      return ['CRM', 'PROJECT'];
    }
    return [];
  }, [roleName]);

  // Set default report type in form on mount/role change
  useEffect(() => {
    if (allowedTypes.length > 0 && !newReportType) {
      setNewReportType(allowedTypes[0]);
    }
  }, [allowedTypes, newReportType]);

  // Set default sub-type based on report type selection
  useEffect(() => {
    if (newReportType) {
      const subs = subTypesByReportType[newReportType] ?? [];
      if (subs.length > 0) {
        setNewReportSubType(subs[0]);
      }
    }
  }, [newReportType]);

  // Handlers
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportName) return;
    setIsMutating(true);
    try {
      const result = await createReportMutation.mutateAsync({
        name: newReportName,
        type: newReportType,
        subType: newReportSubType,
        reportingPeriod: newReportPeriod,
        filters: selectedProjectId ? { projectId: selectedProjectId } : {},
      });

      // Automatically run report to build initial data and AI insights
      await runReportMutation.mutateAsync(result.id);
      
      setIsCreateModalOpen(false);
      setNewReportName('');
      setSelectedProjectId('');
    } catch (err) {
      console.error('Erreur lors de la création et exécution du rapport:', err);
    } finally {
      setIsMutating(false);
    }
  };

  const handleRunReport = async (id: string) => {
    setIsMutating(true);
    try {
      await runReportMutation.mutateAsync(id);
    } catch (err) {
      console.error("Erreur d'exécution du rapport:", err);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (confirm('Voulez-vous vraiment archiver ce rapport ?')) {
      setIsMutating(true);
      try {
        await deleteReportMutation.mutateAsync(id);
        if (selectedReportId === id) setSelectedReportId(null);
      } catch (err) {
        console.error('Erreur lors de la suppression:', err);
      } finally {
        setIsMutating(false);
      }
    }
  };

  const handleReviewReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportId) return;
    setIsMutating(true);
    try {
      if (reviewActionType === 'approve') {
        await approveReportMutation.mutateAsync({ id: selectedReportId, comment: reviewComment });
      } else {
        await rejectReportMutation.mutateAsync({ id: selectedReportId, reason: reviewComment });
      }
      setIsReviewModalOpen(false);
      setReviewComment('');
    } catch (err) {
      console.error('Erreur lors de la revue du rapport:', err);
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportId) return;
    setIsMutating(true);
    try {
      await createScheduleMutation.mutateAsync({
        cronExpr,
        recipients: recipientsStr.split(',').map(email => email.trim()).filter(Boolean),
        isActive: true,
      });
      setIsScheduleModalOpen(false);
      setCronExpr('0 9 * * 1');
      setRecipientsStr('');
    } catch (err) {
      console.error('Erreur lors de la planification:', err);
    } finally {
      setIsMutating(false);
    }
  };

  // Find latest approved report for AI insights tab (Managers)
  const latestApprovedReport = useMemo(() => {
    return reports.find(r => r.status === 'APPROVED' && r.aiInsights);
  }, [reports]);

  // Statistics memo
  const stats = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter(r => (r.workflowStatus === 'SUBMITTED') || r.status === 'PENDING_REVIEW').length;
    const approved = reports.filter(r => (r.workflowStatus === 'APPROVED') || r.status === 'APPROVED').length;
    const rejected = reports.filter(r => (r.workflowStatus === 'REJECTED') || r.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [reports]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Rapports d'Activité & Analyses IA"
          description={
            isCEO
              ? "Supervisez et comparez les performances des départements de l'agence"
              : `Générez et gérez les rapports d'activité pour le département ${roleName.replace('RESPONSABLE_', '')}`
          }
        />
        <div className="flex items-center gap-2 flex-wrap">
          {isHrManager && (
            <button
              onClick={() => navigate('/reports/new/hr')}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-600/20 cursor-pointer"
            >
              <Plus size={16} />
              Nouveau Rapport RH
            </button>
          )}
          {isFinanceManager && (
            <button
              onClick={() => navigate('/reports/new/finance')}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Plus size={16} />
              Nouveau Rapport Financier
            </button>
          )}
          {!isHrManager && !isFinanceManager && allowedTypes.length > 0 && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              <Plus size={16} />
              Générer un Rapport
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-6">
        {isCEO ? (
          <>
            <button
              onClick={() => setActiveTab('compare')}
              className={`pb-4 text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === 'compare' ? 'text-indigo-400' : 'text-muted-foreground hover:text-white'
              }`}
            >
              Tableau Comparatif
              {activeTab === 'compare' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('archive')}
              className={`pb-4 text-sm font-semibold transition-all relative flex items-center gap-2 cursor-pointer ${
                activeTab === 'archive' ? 'text-indigo-400' : 'text-muted-foreground hover:text-white'
              }`}
            >
              Rapports des Départements
              {stats.pending > 0 && (
                <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/30 animate-pulse font-bold">
                  {stats.pending} en attente
                </span>
              )}
              {activeTab === 'archive' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('my-reports')}
              className={`pb-4 text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === 'my-reports' ? 'text-indigo-400' : 'text-muted-foreground hover:text-white'
              }`}
            >
              Mes Rapports
              {activeTab === 'my-reports' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('ai-insights')}
              className={`pb-4 text-sm font-semibold transition-all relative flex items-center gap-2 cursor-pointer ${
                activeTab === 'ai-insights' ? 'text-indigo-400' : 'text-muted-foreground hover:text-white'
              }`}
            >
              <Sparkles size={14} className="text-indigo-400" />
              AI Insights du Département
              {activeTab === 'ai-insights' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          </>
        )}
      </div>

      {/* Tabs Content */}
      {isCEO && activeTab === 'compare' && (
        <div className="space-y-6">
          {/* Comparison Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              label="Rapports Soumis"
              value={stats.total}
              icon={<FileText size={20} />}
              colorClass="bg-blue-500/10 text-blue-400"
            />
            <StatCard
              label="En Attente de Revue"
              value={stats.pending}
              icon={<Clock size={20} />}
              colorClass="bg-amber-500/10 text-amber-400"
            />
            <StatCard
              label="Approuvés"
              value={stats.approved}
              icon={<Check size={20} />}
              colorClass="bg-emerald-500/10 text-emerald-400"
            />
          </div>

          {/* Department Performance Section */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-400" />
              Performances et Allocations Budgétaires
            </h3>

            {isLoadingComparison ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw size={24} className="text-indigo-400 animate-spin" />
              </div>
            ) : comparisonData && comparisonData.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Visual Bar Chart */}
                <div className="space-y-6 bg-white/5 p-6 rounded-xl border border-white/5">
                  <h4 className="text-sm font-semibold text-white mb-4">Taux d'Utilisation du Budget par Département</h4>
                  <div className="space-y-4">
                    {comparisonData.map((dept) => {
                      const util = dept.budgetUtilization;
                      let barColor = 'bg-emerald-500';
                      if (util >= 100) barColor = 'bg-red-500';
                      else if (util >= 80) barColor = 'bg-amber-500';

                      return (
                        <div key={dept.id} className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground font-medium">{dept.name}</span>
                            <span className="text-white font-bold">{util}% ({(dept.expenses || 0).toLocaleString()} / {(dept.budget || 0).toLocaleString()} TND)</span>
                          </div>
                          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.min(util, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* KPI Metrics List */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-white">Score de Productivité et Contribution</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {comparisonData.map((dept) => (
                      <div key={dept.id} className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2 flex flex-col justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{dept.name}</p>
                          <p className="text-lg font-bold text-white mt-1">Score : {dept.averageProductivity}%</p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Effectif : {dept.employeeCount}</span>
                          <span className="text-indigo-400 font-medium">Revenu : {(dept.revenueContribution || 0).toLocaleString()} TND</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">Aucune donnée disponible.</div>
            )}
          </div>
        </div>
      )}

      {/* Reports List / Archive view */}
      {((isCEO && activeTab === 'archive') || (!isCEO && activeTab === 'my-reports')) && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* List panel */}
          <div className="xl:col-span-2 space-y-4">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <FileText size={16} className="text-indigo-400" />
                Liste des Rapports
              </h3>

              {isLoadingReports ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={24} className="text-indigo-400 animate-spin" />
                </div>
              ) : reports.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <th className="pb-3 pr-4">Nom / Type</th>
                        <th className="pb-3 px-4">Période</th>
                        <th className="pb-3 px-4">Statut</th>
                        <th className="pb-3 px-4">Généré le</th>
                        <th className="pb-3 pl-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report) => {
                        const statusClass =
                          report.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : report.status === 'REJECTED'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse';

                        return (
                          <tr
                            key={report.id}
                            className={`border-b border-white/5 text-sm hover:bg-white/5 transition-all cursor-pointer ${
                              selectedReportId === report.id ? 'bg-indigo-500/10' : ''
                            }`}
                            onClick={() => setSelectedReportId(report.id)}
                          >
                            <td className="py-4 pr-4">
                              <p className="font-semibold text-white flex items-center gap-1.5">
                                {report.name}
                                {report.version > 1 && (
                                  <span className="text-[10px] text-muted-foreground bg-white/5 px-1 py-0.5 rounded border border-white/10">
                                    v{report.version}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {report.type} {report.subType ? `· ${report.subType}` : ''}
                              </p>
                            </td>
                            <td className="py-4 px-4 text-muted-foreground font-medium">{report.reportingPeriod || '-'}</td>
                            <td className="py-4 px-4">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${statusClass}`}>
                                {report.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-xs text-muted-foreground">{formatDate(report.createdAt)}</td>
                            <td className="py-4 pl-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadPdf(getReportPdfUrl(report.id), `${report.name}.pdf`);
                                  }}
                                  title="Exporter en PDF"
                                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-indigo-400 hover:bg-white/10 transition-all cursor-pointer"
                                >
                                  <Download size={14} />
                                </button>
                                <button
                                  onClick={() => handleRunReport(report.id)}
                                  title="Réexécuter et actualiser"
                                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-indigo-400 hover:bg-white/10 transition-all cursor-pointer"
                                >
                                  <RefreshCw size={14} />
                                </button>
                                {isCEO && (report.status === 'PENDING_REVIEW' || report.workflowStatus === 'SUBMITTED') && (
                                  <button
                                    onClick={() => {
                                      setSelectedReportId(report.id);
                                      setReviewActionType('approve');
                                      setIsReviewModalOpen(true);
                                    }}
                                    title="Revoir ce rapport"
                                    className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 transition-all cursor-pointer"
                                  >
                                    <Shield size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteReport(report.id)}
                                  title="Archiver"
                                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">Aucun rapport généré pour le moment.</div>
              )}
            </div>
          </div>

          {/* Details side panel */}
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-6 sticky top-6 space-y-6">
              {selectedReportId ? (
                isLoadingDetail ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw size={24} className="text-indigo-400 animate-spin" />
                  </div>
                ) : selectedReportDetail ? (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white">{selectedReportDetail.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Période : {selectedReportDetail.reportingPeriod}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => downloadPdf(getReportPdfUrl(selectedReportDetail.id), `${selectedReportDetail.name}.pdf`)}
                          title="Télécharger en PDF"
                          className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 transition-all cursor-pointer"
                        >
                          <Download size={14} />
                        </button>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            selectedReportDetail.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : selectedReportDetail.status === 'REJECTED'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {selectedReportDetail.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* CEO review block */}
                    {isCEO && (selectedReportDetail.status === 'PENDING_REVIEW' || selectedReportDetail.workflowStatus === 'SUBMITTED') && (
                      <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 space-y-3">
                        <p className="text-xs text-indigo-300 font-semibold">Validation du Rapport (Action CEO)</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedReportId(selectedReportDetail.id);
                              setReviewActionType('approve');
                              setIsReviewModalOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-2 rounded-lg transition-all cursor-pointer"
                          >
                            <ThumbsUp size={12} />
                            Approuver
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReportId(selectedReportDetail.id);
                              setReviewActionType('reject');
                              setIsReviewModalOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium text-xs py-2 rounded-lg transition-all cursor-pointer"
                          >
                            <ThumbsDown size={12} />
                            Rejeter
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Comment history if comment/reason exists */}
                    {selectedReportDetail.comment && (
                      <div className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          Commentaire Direction
                        </p>
                        <p className="text-xs text-white">{selectedReportDetail.comment}</p>
                      </div>
                    )}

                    {/* AI Insights display block */}
                    {selectedReportDetail.aiInsights ? (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Sparkles size={14} className="text-indigo-400" />
                              AI Analysis & Insights
                            </h4>
                            {selectedReportDetail.aiInsights.priorityLevel && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  selectedReportDetail.aiInsights.priorityLevel === 'HIGH'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : selectedReportDetail.aiInsights.priorityLevel === 'MEDIUM'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                }`}
                              >
                                Priorité {selectedReportDetail.aiInsights.priorityLevel}
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-indigo-200 italic">
                            "{selectedReportDetail.aiInsights.performanceSummary}"
                          </p>

                          <div className="space-y-2 pt-2 border-t border-white/5">
                            <div>
                              <p className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                                <Check size={10} className="text-emerald-400" /> Constats clés
                              </p>
                              <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5 mt-1">
                                {selectedReportDetail.aiInsights.keyFindings.map((f: string, i: number) => (
                                  <li key={i}>{f}</li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle size={10} className="text-red-400" /> Risques identifiés
                              </p>
                              <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5 mt-1">
                                {selectedReportDetail.aiInsights.risks.map((r: string, i: number) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                                <Target size={10} className="text-indigo-400" /> Opportunités
                              </p>
                              <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5 mt-1">
                                {selectedReportDetail.aiInsights.opportunities.map((o: string, i: number) => (
                                  <li key={i}>{o}</li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                                <TrendingUp size={10} className="text-emerald-400" /> Recommandations
                              </p>
                              <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5 mt-1">
                                {selectedReportDetail.aiInsights.recommendations.map((rec: string, i: number) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-center text-xs text-muted-foreground">
                        <Sparkles size={16} className="mx-auto text-indigo-400/50 mb-2" />
                        AI Insights non générés pour ce rapport. Veuillez exécuter le rapport.
                      </div>
                    )}

                    {/* Database Metrics Details Pane */}
                    {selectedReportDetail.data && (
                      <div className="space-y-3 pt-4 border-t border-white/10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Métriques Calculées</h4>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
                          {selectedReportDetail.type === 'FINANCIAL' && selectedReportDetail.data.summary && (
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Chiffre d'Affaires :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalRevenue?.toLocaleString()} TND</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Dépenses Opérationnelles :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalExpenses?.toLocaleString()} TND</span>
                              </div>
                              <div className="flex justify-between border-t border-white/5 pt-1.5">
                                <span>Bénéfice Net :</span>
                                <span className="font-bold text-emerald-400">{(selectedReportDetail.data.summary.totalRevenue - selectedReportDetail.data.summary.totalExpenses)?.toLocaleString()} TND</span>
                              </div>
                            </div>
                          )}

                          {selectedReportDetail.type === 'HR' && selectedReportDetail.data.summary && (
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Nombre d'Employés :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalEmployees}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Demandes de congé :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalLeaveRequests}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Contrats Actifs :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalActiveContracts}</span>
                              </div>
                            </div>
                          )}

                          {selectedReportDetail.type === 'PROJECT' && selectedReportDetail.data.summary && (
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Projets suivis :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalProjects}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Projets actifs :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.activeProjects}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Tâches totales :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalTasks}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Tâches terminées :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.doneTasks}</span>
                              </div>
                            </div>
                          )}

                          {selectedReportDetail.type === 'PRODUCTIVITY' && selectedReportDetail.data.summary && (
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Score Moyen :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.averageProductivityScore}/100</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Top Département :</span>
                                <span className="font-bold text-emerald-400">{selectedReportDetail.data.summary.highestProductiveDept || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Flop Département :</span>
                                <span className="font-bold text-amber-400">{selectedReportDetail.data.summary.lowestProductiveDept || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Collaborateurs :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalEmployees}</span>
                              </div>
                            </div>
                          )}

                          {selectedReportDetail.type === 'CRM' && selectedReportDetail.data.summary && (
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Nombre de leads :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalLeads}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Taux de conversion :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.conversionRate}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Nombre de clients :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalClients}</span>
                              </div>
                            </div>
                          )}

                          {selectedReportDetail.type === 'MARKETING' && selectedReportDetail.data.summary && (
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Prospects acquis :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalLeads}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Taux de conversion :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.conversionRate}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Valeur du pipeline :</span>
                                <span className="font-bold text-indigo-400">{selectedReportDetail.data.summary.totalPipelineValue?.toLocaleString()} TND</span>
                              </div>
                            </div>
                          )}

                          {selectedReportDetail.type === 'SALES' && selectedReportDetail.data.summary && (
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Devis rédigés :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.totalQuotes}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Devis approuvés :</span>
                                <span className="font-bold text-white">{selectedReportDetail.data.summary.approvedQuotes}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Pipeline Commercial :</span>
                                <span className="font-bold text-indigo-400">{selectedReportDetail.data.summary.totalPipeline?.toLocaleString()} TND</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Schedules inside report detail */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Planification (Schedules)</h4>
                        <button
                          onClick={() => setIsScheduleModalOpen(true)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                        >
                          Planifier
                        </button>
                      </div>

                      {selectedReportDetail.schedules && selectedReportDetail.schedules.length > 0 ? (
                        <div className="space-y-2">
                          {selectedReportDetail.schedules.map((sch) => (
                            <div key={sch.id} className="bg-white/5 border border-white/5 rounded-lg p-2.5 flex items-center justify-between text-xs">
                              <div>
                                <p className="text-white font-medium">Expression : {sch.cronExpr}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Destinataires : {sch.recipients.join(', ')}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${sch.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-muted-foreground'}`}>
                                {sch.isActive ? 'Actif' : 'Inactif'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Aucune planification programmée.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">Erreur lors de la lecture du rapport.</div>
                )
              ) : (
                <div className="text-center py-12 text-muted-foreground space-y-2">
                  <FileText size={24} className="mx-auto text-muted-foreground/30" />
                  <p className="text-xs">Sélectionnez un rapport dans la liste pour voir ses analyses IA et statistiques détaillées.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Insights Center (Tab for Managers) */}
      {!isCEO && activeTab === 'ai-insights' && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              AI Insights Récapitulatifs du Département
            </h3>

            {latestApprovedReport ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Glowing Performance Summary Header */}
                  <div className="p-6 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/20 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Sparkles size={120} className="text-indigo-400" />
                    </div>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Synthèse Générale IA
                    </span>
                    <h4 className="text-xl font-bold text-white mt-4 leading-relaxed">
                      "{latestApprovedReport.aiInsights?.performanceSummary}"
                    </h4>
                    <div className="flex items-center gap-2 mt-6 text-xs text-muted-foreground">
                      <span>Rapport associé : <span className="font-semibold text-white">{latestApprovedReport.name}</span></span>
                      <span>·</span>
                      <span>Validé le : {formatDate(latestApprovedReport.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Findings, Opportunities, Recommendations Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3">
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Check className="text-emerald-400" size={14} />
                        Constats Opérationnels
                      </p>
                      <ul className="space-y-2 text-xs text-white/90">
                        {latestApprovedReport.aiInsights?.keyFindings.map((f, i) => (
                          <li key={i} className="flex gap-2 items-start">
                            <span className="text-indigo-400 mt-1">•</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3">
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="text-indigo-400" size={14} />
                        Opportunités de croissance
                      </p>
                      <ul className="space-y-2 text-xs text-white/90">
                        {latestApprovedReport.aiInsights?.opportunities.map((o, i) => (
                          <li key={i} className="flex gap-2 items-start">
                            <span className="text-indigo-400 mt-1">•</span>
                            <span>{o}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="text-emerald-400" size={14} />
                      Feuille de route & Recommandations stratégiques
                    </p>
                    <ul className="space-y-2.5 text-xs text-white/90">
                      {latestApprovedReport.aiInsights?.recommendations.map((rec, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                          <div className="bg-indigo-500/10 text-indigo-400 font-bold w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] border border-indigo-500/20">
                            {i + 1}
                          </div>
                          <span className="mt-0.5">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Risks Side Bar */}
                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle size={16} />
                      Risques & Points de Vigilance
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Facteurs critiques nécessitant une attention immédiate pour éviter tout retard ou perte d'efficacité.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {latestApprovedReport.aiInsights?.risks.map((risk, idx) => (
                      <div key={idx} className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 items-start">
                        <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={14} />
                        <span className="text-xs text-red-200/90 leading-normal">{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground space-y-3">
                <Sparkles size={32} className="mx-auto text-indigo-500/30" />
                <p className="text-sm font-semibold text-white">Pas de synthèse validée disponible</p>
                <p className="text-xs max-w-md mx-auto">
                  Les analyses IA s'affichent ici dès que la direction (CEO) approuve l'un de vos rapports d'activité soumis.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE REPORT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white">Générer un Rapport d'Activité</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-muted-foreground hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Nom du rapport</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Rapport Financier - Juin 2026"
                  value={newReportName}
                  onChange={(e) => setNewReportName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Type de rapport</label>
                  <select
                    value={newReportType}
                    onChange={(e) => setNewReportType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                  >
                    {allowedTypes.map((t) => (
                      <option key={t} value={t} className="bg-zinc-900 text-white">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Sous-type</label>
                  <select
                    value={newReportSubType}
                    onChange={(e) => setNewReportSubType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                  >
                    {(subTypesByReportType[newReportType] ?? []).map((sub) => (
                      <option key={sub} value={sub} className="bg-zinc-900 text-white">
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Période du rapport</label>
                <select
                  value={newReportPeriod}
                  onChange={(e) => setNewReportPeriod(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="June 2026" className="bg-zinc-900 text-white">Juin 2026</option>
                  <option value="May 2026" className="bg-zinc-900 text-white">Mai 2026</option>
                  <option value="2026-Q2" className="bg-zinc-900 text-white">Deuxième Trimestre 2026</option>
                  <option value="2026-Q1" className="bg-zinc-900 text-white">Premier Trimestre 2026</option>
                </select>
              </div>

              {/* Project selector for PM role */}
              {newReportType === 'PROJECT' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Sélectionner un Projet</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="" className="bg-zinc-900 text-white">Tous les projets affectés</option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id} className="bg-zinc-900 text-white">
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-white/10 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 bg-white/5 border border-white/10 text-white text-xs font-semibold py-2 rounded-xl hover:bg-white/10 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-700/50 text-white text-xs font-semibold py-2 rounded-xl transition-all cursor-pointer"
                >
                  {isMutating && <Loader2 size={12} className="animate-spin" />}
                  Lancer le calcul
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SCHEDULE MODAL */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white">Planifier des exécutions régulières</h3>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-muted-foreground hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Fréquence (Expression Cron)</label>
                <select
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="0 9 * * 1" className="bg-zinc-900 text-white">Chaque Lundi à 09:00</option>
                  <option value="0 18 * * 5" className="bg-zinc-900 text-white">Chaque Vendredi à 18:00</option>
                  <option value="0 9 1 * *" className="bg-zinc-900 text-white">Le 1er de chaque mois à 09:00</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Destinataires (Séparés par des virgules)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ceo@agencyos.com, manager@agencyos.com"
                  value={recipientsStr}
                  onChange={(e) => setRecipientsStr(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="flex-1 bg-white/5 border border-white/10 text-white text-xs font-semibold py-2 rounded-xl hover:bg-white/10 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-700/50 text-white text-xs font-semibold py-2 rounded-xl transition-all cursor-pointer"
                >
                  {isMutating && <Loader2 size={12} className="animate-spin" />}
                  Programmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CEO REVIEW MODAL */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white">
                {reviewActionType === 'approve' ? 'Approuver le Rapport' : 'Rejeter pour révision'}
              </h3>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-muted-foreground hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReviewReport} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  {reviewActionType === 'approve' ? 'Commentaire de validation' : 'Motif de rejet'}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={
                    reviewActionType === 'approve'
                      ? 'Ex: Rapport validé. Trésorerie saine et objectifs atteints.'
                      : 'Ex: Veuillez recalculer en incluant les factures du dernier jalon.'
                  }
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="flex-1 bg-white/5 border border-white/10 text-white text-xs font-semibold py-2 rounded-xl hover:bg-white/10 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-white text-xs font-semibold py-2 rounded-xl transition-all cursor-pointer ${
                    reviewActionType === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-700/50'
                      : 'bg-red-600 hover:bg-red-700 disabled:bg-red-700/50'
                  }`}
                >
                  {isMutating && <Loader2 size={12} className="animate-spin" />}
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
