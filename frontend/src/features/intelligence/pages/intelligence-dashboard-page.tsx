import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  Users,
  DollarSign,
  UserPlus,
  ShieldAlert,
  Award,
  Sparkles,
  PieChart,
  Percent,
} from 'lucide-react';
import { PageHeader } from '../../../components/shared/ui';
import { api } from '../../../lib/api';

interface KPIAlert {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'danger';
}

interface FinancialTrend {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  profitMargin: number;
}

interface Financials {
  revenue: number;
  revenueGrowth: number;
  expenses: number;
  netProfit: number;
  profitMargin: number;
  unpaidAmount: number;
  overdueAmount: number;
}

interface ProjectRisk {
  id: string;
  name: string;
  clientName: string;
  budget: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  badgeColor: string;
  riskFactors: string[];
  advice: string;
  overdueTasksCount: number;
  missedMilestonesCount: number;
  taskActualHours: number;
  taskEstimatedHours: number;
}

interface EmployeeRank {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  activeTasksCount: number;
  completedTasksCount: number;
  overdueTasksCount: number;
  productivityScore: number;
}

interface LeadScore {
  id: string;
  companyName: string;
  contactName: string;
  estimatedValue: number;
  companySize: number;
  status: string;
  leadScore: number;
  priority: string;
  priorityColor: string;
}

interface ClientScore {
  id: string;
  companyName: string;
  industry: string;
  activeProjects: number;
  totalInvoices: number;
  overdueCount: number;
  healthScore: number;
  status: string;
  statusColor: string;
}

interface WorkloadSuggestion {
  userId: string;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  activeTasksCount: number;
  score: number;
  recommendationLabel: string;
}

interface SummaryData {
  financials: Financials;
  alerts: KPIAlert[];
  activeProjectsCount: number;
  highRiskProjectsCount: number;
  pendingDecisionsCount: number;
}

export const IntelligenceDashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [trends, setTrends] = useState<FinancialTrend[]>([]);
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [employees, setEmployees] = useState<EmployeeRank[]>([]);
  const [clients, setClients] = useState<ClientScore[]>([]);
  const [leads, setLeads] = useState<LeadScore[]>([]);
  
  // Smart Task Assignment state
  const [activeProjectsList, setActiveProjectsList] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [suggestions, setSuggestions] = useState<WorkloadSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, finRes, riskRes, empRes, partRes] = await Promise.all([
        api.get('/intelligence/summary'),
        api.get('/intelligence/financial-health'),
        api.get('/intelligence/project-risks'),
        api.get('/intelligence/employee-analytics'),
        api.get('/intelligence/client-lead-scores'),
      ]);

      setSummary(sumRes.data);
      setTrends(finRes.data.trends || []);
      setRisks(riskRes.data || []);
      setEmployees(empRes.data || []);
      setClients(partRes.data.clients || []);
      setLeads(partRes.data.leads || []);

      // Derive active projects list for assignment dropdown
      const activeProjs = riskRes.data.map((p: any) => ({ id: p.id, name: p.name }));
      setActiveProjectsList(activeProjs);
      if (activeProjs.length > 0) {
        setSelectedProjectId(activeProjs[0].id);
      }
    } catch (e) {
      console.error('Error fetching intelligence dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch task assignment suggestions whenever selected project changes
  useEffect(() => {
    if (!selectedProjectId) return;

    const fetchSuggestions = async () => {
      setSuggestionsLoading(true);
      try {
        const res = await api.get(`/intelligence/assignment-suggestions?projectId=${selectedProjectId}`);
        setSuggestions(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setSuggestionsLoading(false);
      }
    };

    fetchSuggestions();
  }, [selectedProjectId]);

  if (loading || !summary) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground animate-pulse font-medium font-outfit">Compilation de l'Intelligence d'Affaires...</p>
        </div>
      </div>
    );
  }

  // Find max values in trends for scaling SVG chart
  const maxVal = Math.max(
    ...trends.map((t) => Math.max(t.revenue, t.expenses, 1000)),
  ) * 1.1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intelligence d'Entreprise CREATIVART"
        description="Analyses stratégiques, détection proactive des risques opérationnels et recommandations de charge de travail."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Revenu Mensuel</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg"><TrendingUp size={16} /></div>
          </div>
          <h3 className="text-2xl font-bold text-white font-mono">{summary.financials.revenue.toLocaleString()} TND</h3>
          <p className="text-[10px] text-emerald-400 mt-2 flex items-center gap-1 font-medium">
            <span>+{summary.financials.revenueGrowth.toFixed(1)}%</span>
            <span className="text-muted-foreground">vs mois précédent</span>
          </p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dépenses Mensuelles</span>
            <div className="p-2 bg-red-500/10 text-red-400 rounded-lg"><Percent size={16} /></div>
          </div>
          <h3 className="text-2xl font-bold text-white font-mono">{summary.financials.expenses.toLocaleString()} TND</h3>
          <p className="text-[10px] text-muted-foreground mt-2">Dépenses validées et réglées</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Marge Bénéficiaire</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><PieChart size={16} /></div>
          </div>
          <h3 className="text-2xl font-bold text-white font-mono">{summary.financials.profitMargin.toFixed(1)}%</h3>
          <p className="text-[10px] text-emerald-400 mt-2 flex items-center gap-1 font-medium">
            <span>Marge cible : &gt; 15%</span>
          </p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Restes à Recouvrer</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg"><DollarSign size={16} /></div>
          </div>
          <h3 className="text-2xl font-bold text-white font-mono">{summary.financials.unpaidAmount.toLocaleString()} TND</h3>
          <p className="text-[10px] text-red-400 mt-2 font-medium">
            Factures impayées & retards
          </p>
        </div>
      </div>

      {/* Grid: Alert Panel & Financial Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Alerts Panel */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-amber-400" size={18} />
              <h4 className="font-bold text-white text-base">Alertes & Indicateurs de Risque</h4>
            </div>

            {summary.alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle className="text-emerald-400 mb-2" size={32} />
                <p className="text-xs text-white font-medium">Santé financière optimale</p>
                <p className="text-[10px] text-muted-foreground">Aucune anomalie ou dépassement détecté.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-xl border flex gap-3 ${
                      alert.type === 'danger'
                        ? 'bg-red-500/5 border-red-500/20 text-red-400'
                        : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                    }`}
                  >
                    <ShieldAlert className="shrink-0 mt-0.5" size={16} />
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wide">{alert.title}</h5>
                      <p className="text-[11px] mt-0.5 leading-relaxed font-medium">{alert.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-white/5 pt-4 mt-6">
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex gap-2 text-indigo-300">
              <Lightbulb size={16} className="shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed">
                <strong>Conseil IA :</strong> Surveillez le taux de recouvrement en envoyant des relances automatiques depuis le module Finance.
              </p>
            </div>
          </div>
        </div>

        {/* Financial Trends Custom SVG Line Chart */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white text-base">Tendances Financières (Dinars Tunisiens - TND)</h4>
            <div className="flex gap-4 text-[10px] font-semibold">
              <span className="flex items-center gap-1.5 text-indigo-400"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>Revenus</span>
              <span className="flex items-center gap-1.5 text-red-400"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Dépenses</span>
            </div>
          </div>

          {/* Simple custom SVG Line/Area graph */}
          <div className="relative w-full h-[180px] mt-4 bg-white/[0.01] rounded-xl border border-white/5 p-2">
            <svg viewBox="0 0 500 180" className="w-full h-full overflow-visible">
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

              {/* Draw Revenue line */}
              {trends.length > 1 && (
                <path
                  d={trends
                    .map((t, idx) => {
                      const x = (idx / (trends.length - 1)) * 480 + 10;
                      const y = 160 - (t.revenue / maxVal) * 140;
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="3"
                  className="drop-shadow-[0_2px_8px_rgba(129,140,248,0.3)] animate-pulse-glow"
                />
              )}

              {/* Draw Expenses line */}
              {trends.length > 1 && (
                <path
                  d={trends
                    .map((t, idx) => {
                      const x = (idx / (trends.length - 1)) * 480 + 10;
                      const y = 160 - (t.expenses / maxVal) * 140;
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="2.5"
                  className="drop-shadow-[0_2px_8px_rgba(248,113,113,0.3)]"
                />
              )}

              {/* Dots on points */}
              {trends.map((t, idx) => {
                const x = (idx / (trends.length - 1)) * 480 + 10;
                const yRev = 160 - (t.revenue / maxVal) * 140;
                const yExp = 160 - (t.expenses / maxVal) * 140;
                return (
                  <g key={idx}>
                    <circle cx={x} cy={yRev} r="4" fill="#818cf8" className="cursor-pointer hover:r-6" />
                    <circle cx={x} cy={yExp} r="3" fill="#f87171" />
                  </g>
                );
              })}
            </svg>

            {/* Labels */}
            <div className="flex justify-between px-2 text-[9px] text-muted-foreground mt-2 font-mono">
              {trends.map((t, idx) => (
                <span key={idx}>{t.month}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Project Risks & Smart Assignment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Risk Cards */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white text-base">Risques Projets & Alertes Calendrier</h4>
            <span className="text-xs text-muted-foreground">Projets actifs</span>
          </div>

          <div className="space-y-4">
            {risks.map((project) => (
              <div key={project.id} className="border border-white/5 rounded-xl p-4 bg-white/[0.01]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h5 className="text-sm font-bold text-white">{project.name}</h5>
                    <p className="text-xs text-muted-foreground">{project.clientName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Niveau Risque :</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-${project.badgeColor}-500/10 border-${project.badgeColor}-500/20 text-${project.badgeColor}-400`}>
                      {project.riskLevel}
                    </span>
                  </div>
                </div>

                {/* Risk details */}
                {project.riskFactors.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {project.riskFactors.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-red-400">
                        <AlertTriangle size={12} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Advice block */}
                <div className="bg-white/5 border border-white/5 rounded-lg p-2.5 mt-3 flex gap-2 items-start text-xs text-gray-300">
                  <Lightbulb size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed font-medium">{project.advice}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Task Assignment suggestion */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="text-indigo-400" size={18} />
              <h4 className="font-bold text-white text-base">Assignation Intelligente</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Sélectionnez un projet pour évaluer les membres d'équipe disponibles selon leur charge de travail active.
            </p>

            <div className="space-y-4">
              {/* Dropdown */}
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full glass-input px-3 py-2 text-xs text-white"
              >
                <option value="">-- Sélectionner un Projet --</option>
                {activeProjectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Suggestion list */}
              {suggestionsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
              ) : suggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Aucune recommandation disponible.</p>
              ) : (
                <div className="space-y-2.5">
                  {suggestions.slice(0, 3).map((s) => (
                    <div key={s.userId} className="flex justify-between items-center border border-white/5 rounded-xl p-3 bg-white/[0.01]">
                      <div>
                        <div className="text-xs font-semibold text-white">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground">{s.jobTitle} ({s.department})</div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          s.recommendationLabel === 'Idéal'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : s.recommendationLabel === 'Surchargé'
                            ? 'bg-red-500/10 border-red-500/20 text-red-400'
                            : 'bg-white/5 border-white/10 text-gray-300'
                        }`}>
                          {s.recommendationLabel}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-1">{s.activeTasksCount} tâche(s) active(s)</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 mt-6">
            <span className="text-[10px] text-muted-foreground italic">
              * Algorithme basé sur la charge de travail active et la correspondance de compétences.
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Employee Productivity & Partner Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Productivity Rankings */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="flex items-center gap-2">
            <Award className="text-yellow-400 animate-pulse" size={18} />
            <h4 className="font-bold text-white text-base">Productivité Collaborateurs</h4>
          </div>

          <div className="space-y-3">
            {employees.slice(0, 5).map((emp, index) => (
              <div key={emp.id} className="flex justify-between items-center border border-white/5 rounded-xl p-3 bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-indigo-400 font-mono">#{index + 1}</span>
                  <div>
                    <h5 className="text-xs font-bold text-white">{emp.name}</h5>
                    <p className="text-[10px] text-muted-foreground">{emp.jobTitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-400 font-mono">{emp.productivityScore} / 100</span>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{emp.completedTasksCount} complétées</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Client & Lead Scores */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 lg:col-span-2 space-y-6">
          {/* Section A: Leads Chauffants */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="text-indigo-400" size={16} />
              <h4 className="font-bold text-white text-sm">Notation Leads (Opportunités)</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-muted-foreground pb-2">
                    <th className="py-2 font-medium">Société</th>
                    <th className="py-2 font-medium">Taille</th>
                    <th className="py-2 font-medium">Budget estimé</th>
                    <th className="py-2 font-medium text-right">Lead Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 3).map((lead) => (
                    <tr key={lead.id} className="border-b border-white/5 text-gray-300">
                      <td className="py-2.5 font-semibold text-white">{lead.companyName}</td>
                      <td className="py-2.5">{lead.companySize} emp.</td>
                      <td className="py-2.5 font-mono text-indigo-300">{lead.estimatedValue.toLocaleString()} TND</td>
                      <td className="py-2.5 text-right font-bold text-emerald-400 font-mono">{lead.leadScore} / 100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Client Health */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <Users className="text-indigo-400" size={16} />
              <h4 className="font-bold text-white text-sm">Indice de Santé Clients</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-muted-foreground pb-2">
                    <th className="py-2 font-medium">Client</th>
                    <th className="py-2 font-medium">Projets</th>
                    <th className="py-2 font-medium">Factures Impayées</th>
                    <th className="py-2 font-medium text-right">Santé Financière</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b border-white/5 text-gray-300">
                      <td className="py-2.5 font-semibold text-white">{client.companyName}</td>
                      <td className="py-2.5">{client.activeProjects} actif(s)</td>
                      <td className="py-2.5 font-mono">{client.overdueCount > 0 ? <span className="text-red-400 font-bold">{client.overdueCount} en retard</span> : <span className="text-emerald-400 font-medium">Aucune</span>}</td>
                      <td className="py-2.5 text-right font-bold font-mono text-emerald-400">{client.healthScore} / 100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
