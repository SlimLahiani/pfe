import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Printer, Sparkles, AlertTriangle, TrendingUp, Target,
  Check, FileText, RefreshCw, ThumbsUp, ThumbsDown, Clock,
  Users, DollarSign, Briefcase, BarChart3,
} from 'lucide-react';
import { useAuth } from '../../../context/auth-context';
import { StatCard } from '../../../components/shared/ui';
import {
  useReport, useRunReport, useApproveReport, useRejectReport,
} from '../../../hooks/use-api';
import {
  MonthlyTrendChart, ProfitTrendChart, StatusDistributionChart,
  ExpenseCategoryChart, TopClientsChart,
  DepartmentDistributionChart, LeaveTypeChart, AttendanceChart,
  ProjectCompletionChart, TeamWorkloadChart,
} from '../components/report-charts';
import '../print-report.css';

const formatDate = (d?: string | Date) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatCurrency = (v: number) => `${v.toLocaleString()} TND`;

export const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleName = user?.role ? (typeof user.role === 'string' ? user.role : (user.role as any).name || '') : '';
  const isCEO = roleName === 'GERANT';
  const printRef = useRef<HTMLDivElement>(null);

  const { data: report, isLoading } = useReport(id);
  const runMutation = useRunReport();
  const approveMutation = useApproveReport();
  const rejectMutation = useRejectReport();

  const [reviewComment, setReviewComment] = React.useState('');
  const [showReviewModal, setShowReviewModal] = React.useState<'approve' | 'reject' | null>(null);

  const handlePrint = () => window.print();

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!id) return;
    if (action === 'approve') {
      await approveMutation.mutateAsync({ id, comment: reviewComment });
    } else {
      await rejectMutation.mutateAsync({ id, reason: reviewComment });
    }
    setShowReviewModal(null);
    setReviewComment('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw size={28} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-3">
        <FileText size={32} className="text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm">Rapport introuvable.</p>
        <button onClick={() => navigate('/reports')} className="text-indigo-400 text-sm font-semibold hover:underline cursor-pointer">
          ← Retour aux rapports
        </button>
      </div>
    );
  }

  const data = report.data as any;
  const ai = report.aiInsights as any;
  const summary = data?.summary;
  const charts = data?.charts;

  const statusClass = report.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : report.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

  return (
    <div className="report-print-container space-y-6" ref={printRef}>
      {/* ─── Print-only Header ───────────────────────────────────────────── */}
      <div className="report-print-header">
        <div>
          <p className="report-print-company">CREATIVART</p>
          <h1>{report.name}</h1>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Type : {report.type} {report.subType ? `· ${report.subType}` : ''} · Période : {report.reportingPeriod || '-'}
          </p>
        </div>
        <div className="report-meta" style={{ textAlign: 'right' }}>
          <p>Généré le : {formatDate(report.updatedAt)}</p>
          <p>Par : {report.createdBy?.firstName} {report.createdBy?.lastName}</p>
          <p>Statut : {report.status}</p>
          <p>Version : v{report.version}</p>
        </div>
      </div>

      {/* ─── Screen Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="p-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 transition-all cursor-pointer">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              {report.name}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${statusClass}`}>
                {report.status.replace('_', ' ')}
              </span>
              {report.version > 1 && (
                <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded border border-white/10">v{report.version}</span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {report.type} {report.subType ? `· ${report.subType}` : ''} · Période : {report.reportingPeriod || '-'} · Par {report.createdBy?.firstName} {report.createdBy?.lastName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => id && runMutation.mutateAsync(id)} disabled={runMutation.isPending}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50">
            <RefreshCw size={13} className={runMutation.isPending ? 'animate-spin' : ''} /> Recalculer
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer">
            <Printer size={13} /> Exporter PDF
          </button>
          {isCEO && report.status === 'PENDING_REVIEW' && (
            <>
              <button onClick={() => setShowReviewModal('approve')}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer">
                <ThumbsUp size={13} /> Approuver
              </button>
              <button onClick={() => setShowReviewModal('reject')}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer">
                <ThumbsDown size={13} /> Rejeter
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── CEO Comment ──────────────────────────────────────────────────── */}
      {report.comment && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 no-print">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Commentaire Direction</p>
          <p className="text-sm text-white">{report.comment}</p>
        </div>
      )}

      {/* ─── No Data State ───────────────────────────────────────────────── */}
      {!data && (
        <div className="text-center py-16 text-muted-foreground space-y-3">
          <BarChart3 size={32} className="mx-auto text-indigo-500/30" />
          <p className="text-sm font-semibold text-white">Aucune donnée générée</p>
          <p className="text-xs">Cliquez sur "Recalculer" pour générer les métriques du rapport.</p>
        </div>
      )}

      {/* ─── FINANCIAL REPORT ────────────────────────────────────────────── */}
      {data && report.type === 'FINANCIAL' && (
        <>
          {/* Print KPIs */}
          <div className="report-print-kpis">
            <div className="report-print-kpi"><div className="kpi-value">{formatCurrency(summary.totalRevenue)}</div><div className="kpi-label">Chiffre d'Affaires</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{formatCurrency(summary.totalExpenses)}</div><div className="kpi-label">Dépenses</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{formatCurrency(summary.netProfit)}</div><div className="kpi-label">Bénéfice Net</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{summary.profitMargin}%</div><div className="kpi-label">Marge Nette</div></div>
          </div>

          {/* Screen KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <StatCard label="Chiffre d'Affaires" value={formatCurrency(summary.totalRevenue)} icon={<DollarSign size={18} />} colorClass="bg-emerald-500/10 text-emerald-400" />
            <StatCard label="Dépenses" value={formatCurrency(summary.totalExpenses)} icon={<TrendingUp size={18} />} colorClass="bg-red-500/10 text-red-400" />
            <StatCard label="Bénéfice Net" value={formatCurrency(summary.netProfit)} icon={<Target size={18} />} colorClass="bg-indigo-500/10 text-indigo-400" />
            <StatCard label="Marge Nette" value={`${summary.profitMargin}%`} icon={<BarChart3 size={18} />} colorClass="bg-purple-500/10 text-purple-400" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <StatCard label="Factures" value={summary.invoiceCount} icon={<FileText size={18} />} colorClass="bg-blue-500/10 text-blue-400" />
            <StatCard label="Payées" value={summary.paidInvoices} icon={<Check size={18} />} colorClass="bg-emerald-500/10 text-emerald-400" />
            <StatCard label="En Retard" value={summary.overdueInvoices} icon={<AlertTriangle size={18} />} colorClass="bg-red-500/10 text-red-400" />
            <StatCard label="Conv. Devis" value={`${summary.quoteConversionRate}%`} icon={<TrendingUp size={18} />} colorClass="bg-amber-500/10 text-amber-400" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {charts?.monthlyTrend?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-indigo-400" /> Tendance Revenus vs Dépenses (6 mois)
                </h3>
                <MonthlyTrendChart data={charts.monthlyTrend} />
              </div>
            )}
            {charts?.monthlyTrend?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 size={14} className="text-indigo-400" /> Évolution du Profit
                </h3>
                <ProfitTrendChart data={charts.monthlyTrend} />
              </div>
            )}
            {charts?.invoiceStatusDist?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <FileText size={14} className="text-indigo-400" /> Répartition des Factures
                </h3>
                <StatusDistributionChart data={charts.invoiceStatusDist} />
              </div>
            )}
            {charts?.expenseByCategory?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <DollarSign size={14} className="text-indigo-400" /> Dépenses par Catégorie
                </h3>
                <ExpenseCategoryChart data={charts.expenseByCategory} />
              </div>
            )}
            {charts?.topClients?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6 xl:col-span-2">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Users size={14} className="text-indigo-400" /> Top Clients par Revenu
                </h3>
                <TopClientsChart data={charts.topClients} />
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── HR REPORT ───────────────────────────────────────────────────── */}
      {data && report.type === 'HR' && (
        <>
          <div className="report-print-kpis">
            <div className="report-print-kpi"><div className="kpi-value">{summary.totalEmployees}</div><div className="kpi-label">Employés</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{summary.activeEmployees}</div><div className="kpi-label">Actifs</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{summary.attendanceRate}%</div><div className="kpi-label">Taux Présence</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{formatCurrency(summary.totalPayroll)}</div><div className="kpi-label">Masse Salariale</div></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <StatCard label="Total Employés" value={summary.totalEmployees} icon={<Users size={18} />} colorClass="bg-indigo-500/10 text-indigo-400" />
            <StatCard label="Actifs" value={summary.activeEmployees} icon={<Check size={18} />} colorClass="bg-emerald-500/10 text-emerald-400" />
            <StatCard label="Congés en Attente" value={summary.pendingLeaveRequests} icon={<Clock size={18} />} colorClass="bg-amber-500/10 text-amber-400" />
            <StatCard label="Taux Présence" value={`${summary.attendanceRate}%`} icon={<BarChart3 size={18} />} colorClass="bg-blue-500/10 text-blue-400" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <StatCard label="Contrats Actifs" value={summary.totalActiveContracts} icon={<FileText size={18} />} colorClass="bg-purple-500/10 text-purple-400" />
            <StatCard label="Postes Ouverts" value={summary.openVacancies} icon={<Briefcase size={18} />} colorClass="bg-pink-500/10 text-pink-400" />
            <StatCard label="Demandes Congé" value={summary.totalLeaveRequests} icon={<TrendingUp size={18} />} colorClass="bg-cyan-500/10 text-cyan-400" />
            <StatCard label="Masse Salariale" value={formatCurrency(summary.totalPayroll)} icon={<DollarSign size={18} />} colorClass="bg-emerald-500/10 text-emerald-400" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {charts?.departmentDistribution?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Users size={14} className="text-indigo-400" /> Répartition par Département
                </h3>
                <DepartmentDistributionChart data={charts.departmentDistribution} />
              </div>
            )}
            {charts?.leaveByType?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Clock size={14} className="text-indigo-400" /> Congés par Type
                </h3>
                <LeaveTypeChart data={charts.leaveByType} />
              </div>
            )}
            {charts?.leaveByStatus?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <FileText size={14} className="text-indigo-400" /> Congés par Statut
                </h3>
                <StatusDistributionChart data={charts.leaveByStatus} />
              </div>
            )}
            {charts?.attendanceSummary?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 size={14} className="text-indigo-400" /> Résumé Présence
                </h3>
                <AttendanceChart data={charts.attendanceSummary} />
              </div>
            )}
            {charts?.contractByType?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Briefcase size={14} className="text-indigo-400" /> Types de Contrats
                </h3>
                <StatusDistributionChart data={charts.contractByType.map((c: any) => ({ status: c.type, count: c.count }))} />
              </div>
            )}
            {charts?.candidatesByStatus?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Target size={14} className="text-indigo-400" /> Pipeline Recrutement
                </h3>
                <StatusDistributionChart data={charts.candidatesByStatus.map((c: any) => ({ status: c.status, count: c.count }))} />
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── PROJECT REPORT ──────────────────────────────────────────────── */}
      {data && report.type === 'PROJECT' && (
        <>
          <div className="report-print-kpis">
            <div className="report-print-kpi"><div className="kpi-value">{summary.totalProjects}</div><div className="kpi-label">Projets</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{summary.completionRate}%</div><div className="kpi-label">Avancement</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{summary.overdueTasks}</div><div className="kpi-label">Tâches en Retard</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{summary.delayedProjectsCount}</div><div className="kpi-label">Projets en Retard</div></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <StatCard label="Projets" value={summary.totalProjects} icon={<Briefcase size={18} />} colorClass="bg-indigo-500/10 text-indigo-400" />
            <StatCard label="Actifs" value={summary.activeProjects} icon={<TrendingUp size={18} />} colorClass="bg-emerald-500/10 text-emerald-400" />
            <StatCard label="Avancement" value={`${summary.completionRate}%`} icon={<BarChart3 size={18} />} colorClass="bg-blue-500/10 text-blue-400" />
            <StatCard label="Tâches Terminées" value={`${summary.doneTasks}/${summary.totalTasks}`} icon={<Check size={18} />} colorClass="bg-purple-500/10 text-purple-400" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <StatCard label="En cours" value={summary.inProgressTasks} icon={<RefreshCw size={18} />} colorClass="bg-amber-500/10 text-amber-400" />
            <StatCard label="En Retard" value={summary.overdueTasks} icon={<AlertTriangle size={18} />} colorClass="bg-red-500/10 text-red-400" />
            <StatCard label="Jalons Terminés" value={`${summary.completedMilestones}/${summary.totalMilestones}`} icon={<Target size={18} />} colorClass="bg-cyan-500/10 text-cyan-400" />
            <StatCard label="Projets Retardés" value={summary.delayedProjectsCount} icon={<Clock size={18} />} colorClass="bg-red-500/10 text-red-400" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {charts?.projectProgress?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6 xl:col-span-2">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 size={14} className="text-indigo-400" /> Avancement par Projet
                </h3>
                <ProjectCompletionChart data={charts.projectProgress} />
              </div>
            )}
            {charts?.taskStatusDist?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <FileText size={14} className="text-indigo-400" /> Distribution des Tâches
                </h3>
                <StatusDistributionChart data={charts.taskStatusDist} />
              </div>
            )}
            {charts?.teamWorkload?.length > 0 && (
              <div className="report-print-section glass-card rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Users size={14} className="text-indigo-400" /> Charge de Travail Équipe
                </h3>
                <TeamWorkloadChart data={charts.teamWorkload} />
              </div>
            )}
          </div>

          {/* Delayed projects table */}
          {charts?.delayedProjects?.length > 0 && (
            <div className="report-print-section glass-card rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" /> Projets en Retard
              </h3>
              <div className="overflow-x-auto">
                <table className="report-print-table w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="pb-3 pr-4">Projet</th>
                      <th className="pb-3 px-4">Client</th>
                      <th className="pb-3 px-4">Avancement</th>
                      <th className="pb-3 px-4">Tâches en retard</th>
                      <th className="pb-3 pl-4">Budget utilisé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charts.delayedProjects.map((p: any) => (
                      <tr key={p.id} className="border-b border-white/5 text-sm">
                        <td className="py-3 pr-4 font-semibold text-white">{p.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{p.client}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${p.completion >= 70 ? 'bg-emerald-500' : p.completion >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${p.completion}%` }} />
                            </div>
                            <span className="text-xs text-white font-semibold">{p.completion}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-red-400 font-bold">{p.overdueTasks}</td>
                        <td className="py-3 pl-4 text-muted-foreground">{p.budgetUtilization}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── PRODUCTIVITY REPORT ─────────────────────────────────────────── */}
      {data && (report.type as string) === 'PRODUCTIVITY' && summary && (
        <>
          <div className="report-print-kpis">
            <div className="report-print-kpi"><div className="kpi-value">{summary.averageProductivityScore}/100</div><div className="kpi-label">Score Moyen</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{summary.highestProductiveDept || '-'}</div><div className="kpi-label">Top Département</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{summary.lowestProductiveDept || '-'}</div><div className="kpi-label">Flop Département</div></div>
            <div className="report-print-kpi"><div className="kpi-value">{summary.totalEmployees}</div><div className="kpi-label">Collaborateurs</div></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <StatCard label="Score Moyen" value={`${summary.averageProductivityScore}/100`} icon={<BarChart3 size={18} />} colorClass="bg-indigo-500/10 text-indigo-400" />
            <StatCard label="Top Département" value={summary.highestProductiveDept || '-'} icon={<TrendingUp size={18} />} colorClass="bg-emerald-500/10 text-emerald-400" />
            <StatCard label="Flop Département" value={summary.lowestProductiveDept || '-'} icon={<AlertTriangle size={18} />} colorClass="bg-red-500/10 text-red-400" />
            <StatCard label="Collaborateurs" value={summary.totalEmployees} icon={<Users size={18} />} colorClass="bg-blue-500/10 text-blue-400" />
          </div>

          {charts?.employeeScores?.length > 0 && (
            <div className="report-print-section glass-card rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Users size={14} className="text-indigo-400" /> Top 10 Collaborateurs par Score de Productivité
              </h3>
              <div className="space-y-4">
                {charts.employeeScores.map((emp: any) => {
                  let barColor = 'bg-emerald-500';
                  if (emp.productivityScore < 60) barColor = 'bg-red-500';
                  else if (emp.productivityScore < 80) barColor = 'bg-amber-500';

                  return (
                    <div key={emp.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white font-semibold">{emp.name} ({emp.department})</span>
                        <span className="text-muted-foreground">
                          Score : <strong className="text-white">{emp.productivityScore}%</strong> (Tâches : {emp.completedTasks}/{emp.totalTasks} | Présence : {emp.attendanceRate}% | Projets : {emp.projectsCount})
                        </span>
                      </div>
                      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${emp.productivityScore}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── CRM / MARKETING / SALES – Generic metrics display ──────────── */}
      {data && ['CRM', 'MARKETING', 'SALES'].includes(report.type) && summary && (
        <div className="space-y-6">
          <div className="report-print-kpis">
            {Object.entries(summary).map(([key, val]) => (
              <div className="report-print-kpi" key={key}>
                <div className="kpi-value">{typeof val === 'number' ? val.toLocaleString() : String(val)}</div>
                <div className="kpi-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            {Object.entries(summary).map(([key, val]) => (
              <StatCard key={key}
                label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                value={typeof val === 'number' ? val.toLocaleString() : String(val)}
                icon={<BarChart3 size={18} />}
                colorClass="bg-indigo-500/10 text-indigo-400"
              />
            ))}
          </div>
          {charts && Object.entries(charts).map(([chartKey, chartData]) => {
            if (!Array.isArray(chartData) || chartData.length === 0) return null;
            const firstItem = chartData[0] as Record<string, any>;
            if ('status' in firstItem && 'count' in firstItem) {
              return (
                <div key={chartKey} className="report-print-section glass-card rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white mb-4">{chartKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</h3>
                  <StatusDistributionChart data={chartData as any} />
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* ─── AI INSIGHTS ─────────────────────────────────────────────────── */}
      {ai && (
        <div className="report-print-section report-print-insights">
          <div className="glass-card rounded-2xl p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400" /> Analyse IA & Recommandations
              </h3>
              {ai.priorityLevel && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                  ai.priorityLevel === 'HIGH' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : ai.priorityLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  Priorité {ai.priorityLevel}
                </span>
              )}
            </div>

            <p className="text-sm text-indigo-200 italic mb-6 border-l-2 border-indigo-500 pl-4">
              "{ai.performanceSummary}"
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="insight-category text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Check size={12} className="text-emerald-400" /> Constats Clés
                </p>
                <ul className="space-y-1.5">
                  {ai.keyFindings?.map((f: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-indigo-400 mt-0.5">•</span>{f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <p className="insight-category text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-red-400" /> Risques Identifiés
                </p>
                <ul className="space-y-1.5">
                  {ai.risks?.map((r: string, i: number) => (
                    <li key={i} className="text-xs text-red-300/80 flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">⚠</span>{r}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <p className="insight-category text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Target size={12} className="text-indigo-400" /> Opportunités
                </p>
                <ul className="space-y-1.5">
                  {ai.opportunities?.map((o: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-indigo-400 mt-0.5">→</span>{o}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <p className="insight-category text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-emerald-400" /> Recommandations
                </p>
                <ul className="space-y-1.5">
                  {ai.recommendations?.map((r: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <div className="bg-indigo-500/20 text-indigo-400 w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold border border-indigo-500/30 mt-0.5">
                        {i + 1}
                      </div>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Print Footer ────────────────────────────────────────────────── */}
      <div className="report-print-footer">
        <span>CREATIVART - Rapport Confidentiel</span>
        <span>Généré le {new Date().toLocaleDateString('fr-FR')} | AgencyOS v2.0</span>
      </div>

      {/* ─── Review Modal ────────────────────────────────────────────────── */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="glass-card w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-4">
            <h3 className="text-base font-bold text-white">
              {showReviewModal === 'approve' ? 'Approuver le Rapport' : 'Rejeter le Rapport'}
            </h3>
            <textarea
              rows={4}
              required
              placeholder={showReviewModal === 'approve' ? 'Commentaire de validation...' : 'Motif de rejet...'}
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowReviewModal(null)} className="flex-1 bg-white/5 border border-white/10 text-white text-xs font-semibold py-2 rounded-xl hover:bg-white/10 cursor-pointer">
                Annuler
              </button>
              <button
                onClick={() => handleReview(showReviewModal)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className={`flex-1 text-white text-xs font-semibold py-2 rounded-xl transition-all cursor-pointer ${
                  showReviewModal === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
