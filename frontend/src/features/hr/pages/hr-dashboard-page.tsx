import React from 'react';
import {
  Users,
  UserCheck,
  CalendarDays,
  TrendingUp,
  Activity,
  Brain,
  ArrowUpRight,
  Briefcase,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useHrDashboard,
  useHrAnalytics,
  useHrRecommendations,
} from '../../../hooks/use-api';
import { PageHeader, StatCard } from '../../../components/shared/ui';

export const HrDashboardPage: React.FC = () => {
  const { data: dashboard, isLoading: dashboardLoading } = useHrDashboard();
  const { data: analytics, isLoading: analyticsLoading } = useHrAnalytics();
  const { data: recommendations, isLoading: recsLoading } = useHrRecommendations();

  const isLoading = dashboardLoading || analyticsLoading || recsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tableau de Bord RH" description="Indicateurs de performance et analyses capital humain" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl glass-panel animate-pulse p-6">
              <div className="h-4 bg-white/5 rounded w-1/2 mb-4" />
              <div className="h-8 bg-white/5 rounded w-3/4" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[350px] rounded-2xl glass-panel animate-pulse" />
          <div className="h-[350px] rounded-2xl glass-panel animate-pulse" />
        </div>
      </div>
    );
  }

  // Fallbacks if backend has empty responses
  const stats = dashboard ?? {
    totalEmployees: 0,
    activeEmployees: 0,
    newEmployees: 0,
    employeesOnLeave: 0,
    contractsExpiringSoon: 0,
    averageProductivity: 0,
    attendanceRate: 0,
    leaveRequestsPending: 0,
  };

  const recs = recommendations ?? [];

  // Analytical details
  const growth = analytics?.employeeGrowth ?? [];
  const deptDist = analytics?.departmentDistribution ?? [];
  const leaveStats = analytics?.leaveStatistics ?? [];
  const prodTrends = analytics?.productivityTrends ?? [];

  // Helper to color recommendations based on type
  const getRecStyles = (type: string) => {
    switch (type) {
      case 'BURNOUT_RISK':
        return {
          bg: 'bg-rose-500/10 border-rose-500/20',
          text: 'text-rose-400',
          badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          label: 'Risque Burnout',
        };
      case 'CONTRACT_RENEWAL':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20',
          text: 'text-amber-400',
          badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          label: 'Fin de Contrat',
        };
      case 'PROMOTION_CANDIDATE':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/20',
          text: 'text-emerald-400',
          badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          label: 'Promotion',
        };
      case 'LEAVE_NEEDED':
        return {
          bg: 'bg-indigo-500/10 border-indigo-500/20',
          text: 'text-indigo-400',
          badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          label: 'Congé Suggéré',
        };
      default:
        return {
          bg: 'bg-cyan-500/10 border-cyan-500/20',
          text: 'text-cyan-400',
          badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          label: 'Recrutement',
        };
    };
  };

  // Find max value in growth for SVG scaling
  const maxGrowthCount = Math.max(...growth.map(g => g.count), 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de Bord RH"
        description="Pilotage stratégique, alertes de cycle de vie et prévisions d'équipe"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Collaborateurs Actifs"
          value={`${stats.activeEmployees} / ${stats.totalEmployees}`}
          icon={<Users size={20} />}
          trend={`${stats.newEmployees} nouveau(x)`}
          trendUp
        />
        <StatCard
          label="Taux de Présence (Aujourd'hui)"
          value={`${stats.attendanceRate}%`}
          icon={<UserCheck size={20} />}
          trend="Présents ou remote"
          trendUp
        />
        <StatCard
          label="Productivité Moyenne"
          value={`${stats.averageProductivity} / 100`}
          icon={<TrendingUp size={20} />}
          trend="Sur base des tâches"
          trendUp
        />
        <StatCard
          label="Congés & Contrats"
          value={stats.leaveRequestsPending.toString()}
          icon={<CalendarDays size={20} />}
          trend={`${stats.employeesOnLeave} en congé`}
        />
      </div>

      {/* Recommendations & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recommendation Engine (AI Assistant) */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between col-span-1 lg:col-span-2 relative overflow-hidden">
          {/* Subtle light effect */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Brain size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Moteur de Recommandations RH <Sparkles size={13} className="text-indigo-400 animate-pulse" />
                </h3>
                <p className="text-xs text-muted-foreground">Analyses automatisées en temps réel sur l'effectif agence</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {recs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Activity size={24} className="text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-gray-400">Aucune alerte ou recommandation en suspens pour le moment.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">L'organisation fonctionne à sa capacité nominale.</p>
                </div>
              ) : (
                recs.map((rec, idx) => {
                  const style = getRecStyles(rec.type);
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all hover:bg-white/[0.02] ${style.bg}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${style.badge}`}>
                            {style.label}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {rec.employeeName}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300">
                          {rec.description}
                        </p>
                      </div>
                      <Link
                        to={rec.type === 'DEPARTMENT_UNDERSTAFFED' ? '/hr/departments' : `/hr/employees`}
                        className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white flex items-center gap-1 transition-all whitespace-nowrap"
                      >
                        Gérer <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Raccourcis Actions</h3>
            <p className="text-xs text-muted-foreground mb-4">Liens rapides d'administration RH</p>
            
            <div className="space-y-2">
              <Link
                to="/hr/employees"
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all text-xs font-medium text-gray-200 hover:text-white group"
              >
                <span className="flex items-center gap-2.5">
                  <Users size={16} className="text-indigo-400" />
                  Liste des employés
                </span>
                <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-white transition-colors" />
              </Link>
              <Link
                to="/hr/leave-requests"
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all text-xs font-medium text-gray-200 hover:text-white group"
              >
                <span className="flex items-center gap-2.5">
                  <CalendarDays size={16} className="text-pink-400" />
                  Demandes de Congé
                  {stats.leaveRequestsPending > 0 && (
                    <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" />
                  )}
                </span>
                <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-white transition-colors" />
              </Link>
              <Link
                to="/hr/org-chart"
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all text-xs font-medium text-gray-200 hover:text-white group"
              >
                <span className="flex items-center gap-2.5">
                  <Briefcase size={16} className="text-emerald-400" />
                  Organigramme Interactif
                </span>
                <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-white transition-colors" />
              </Link>
              <Link
                to="/hr/departments"
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all text-xs font-medium text-gray-200 hover:text-white group"
              >
                <span className="flex items-center gap-2.5">
                  <Activity size={16} className="text-cyan-400" />
                  Budgets & Départements
                </span>
                <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-white transition-colors" />
              </Link>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/5">
            <div className="flex gap-2 items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Clock size={11} /> Dev Server</span>
              <span className="font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">ONLINE</span>
            </div>
          </div>
        </div>

      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Growth Curve */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-xs font-bold text-white">Croissance de l'Effectif</h4>
              <p className="text-[10px] text-muted-foreground">Évolution des embauches sur les 6 derniers mois</p>
            </div>
          </div>

          {growth.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
              Données insuffisantes
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-48 w-full flex items-end justify-between gap-2 pt-4">
                {growth.map((g, idx) => {
                  const percent = maxGrowthCount > 0 ? (g.count / maxGrowthCount) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip */}
                      <span className="absolute -top-6 scale-0 group-hover:scale-100 transition-all bg-indigo-600 text-white font-mono text-[10px] px-2 py-0.5 rounded shadow">
                        {g.count} recrues
                      </span>
                      {/* Bar */}
                      <div
                        className="w-full bg-gradient-to-t from-indigo-500/30 to-indigo-500 rounded-t-lg transition-all duration-500 group-hover:bg-indigo-400"
                        style={{ height: `${percent}%`, minHeight: '6px' }}
                      />
                      {/* Label */}
                      <span className="text-[8px] text-gray-400 mt-2 truncate w-full text-center">
                        {g.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Productivity Trends */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div>
            <h4 className="text-xs font-bold text-white">Productivité Moyenne par Département</h4>
            <p className="text-[10px] text-muted-foreground">Moyenne des scores de performance</p>
          </div>

          <div className="mt-4 space-y-3">
            {prodTrends.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Aucune donnée de productivité
              </div>
            ) : (
              prodTrends.map((pt, idx) => {
                const colorClass =
                  pt.averageProductivity >= 90
                    ? 'bg-emerald-500'
                    : pt.averageProductivity >= 75
                    ? 'bg-indigo-500'
                    : 'bg-amber-500';

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-gray-300">{pt.departmentName}</span>
                      <span className="font-mono text-white font-bold">{pt.averageProductivity}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${colorClass}`}
                        style={{ width: `${pt.averageProductivity}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div>
            <h4 className="text-xs font-bold text-white">Répartition par Département</h4>
            <p className="text-[10px] text-muted-foreground">Effectifs par pôle opérationnel</p>
          </div>

          <div className="mt-4 space-y-3">
            {deptDist.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Aucune donnée disponible
              </div>
            ) : (
              deptDist.map((dd, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.01] border border-white/5">
                  <span className="text-xs font-medium text-gray-300">{dd.departmentName}</span>
                  <span className="text-xs font-bold text-white bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono">
                    {dd.count} collaborateurs
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leave Type Breakdown */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <div>
            <h4 className="text-xs font-bold text-white">Demandes de Congé par Type</h4>
            <p className="text-[10px] text-muted-foreground">Volume de demandes cumulées</p>
          </div>

          <div className="mt-4 space-y-2">
            {leaveStats.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Aucune demande enregistrée
              </div>
            ) : (
              leaveStats.map((stat, idx) => {
                const typeLabels: Record<string, string> = {
                  ANNUAL: 'Congés Annuels',
                  SICK: 'Maladie',
                  PARENTAL: 'Maternité/Paternité',
                  UNPAID: 'Sans Solde',
                  OTHER: 'Autres',
                };
                return (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-xl bg-white/[0.01] border border-white/5">
                    <span className="text-gray-300">{typeLabels[stat.type] ?? stat.type}</span>
                    <span className="font-mono text-white font-bold bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">
                      {stat.count} demandes
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
