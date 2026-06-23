import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, AlertTriangle, Sparkles, Brain, CheckCircle2,
  Clock, ArrowUpRight, PhoneCall, Mail, Percent, Landmark
} from 'lucide-react';
import { api } from '../../../lib/api';
import { PageHeader, StatCard, Button } from '../../../components/shared/ui';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend
} from 'recharts';

interface KPIResponse {
  kpis: {
    totalSentCount: number;
    totalInvoiced: number;
    totalCollected: number;
    totalUnpaid: number;
    openRate: number;
    clickRate: number;
    avgPaymentDelay: number;
  };
  topClients: Array<{ name: string; total: number }>;
  worstOverdueClients: Array<{ name: string; total: number }>;
}

interface CashflowItem {
  month: string;
  revenue: number;
  expenses: number;
  cashflow: number;
}

interface AIInsight {
  topic: string;
  value: string;
  description: string;
}

interface AIAlert {
  type: string;
  message: string;
}

interface AISuggestion {
  action: string;
  invoiceId: string;
  clientName: string;
  reference: string;
  message: string;
}

interface AIInsightsResponse {
  insights: AIInsight[];
  alerts: AIAlert[];
  suggestions: AISuggestion[];
  summary: {
    totalOverdue: number;
    riskClientsCount: number;
    forecastNextMonthCashflow: number;
  };
}

const fmt = (n: number) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' });

export const FinanceAnalyticsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Queries
  const { data: kpisData, isLoading: loadingKpis } = useQuery<KPIResponse>({
    queryKey: ['finance-analytics-kpis'],
    queryFn: async () => {
      const res = await api.get('/finance/analytics-dashboard/kpis');
      return res.data;
    }
  });

  const { data: cashflowData, isLoading: loadingCashflow } = useQuery<CashflowItem[]>({
    queryKey: ['finance-analytics-cashflow'],
    queryFn: async () => {
      const res = await api.get('/finance/analytics-dashboard/cashflow');
      return res.data;
    }
  });

  const { data: aiData, isLoading: loadingAi } = useQuery<AIInsightsResponse>({
    queryKey: ['finance-analytics-ai'],
    queryFn: async () => {
      const res = await api.get('/finance/analytics-dashboard/ai-insights');
      return res.data;
    }
  });

  // Action mutation
  const sendReminderMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      await api.post(`/finance/invoices/${invoiceId}/reminder`);
    },
    onSuccess: () => {
      alert("L'e-mail de relance a été envoyé avec succès !");
      queryClient.invalidateQueries({ queryKey: ['finance-analytics-ai'] });
      queryClient.invalidateQueries({ queryKey: ['finance-analytics-kpis'] });
    },
    onError: (err: any) => {
      alert(`Erreur lors de l'envoi de la relance : ${err.message || "Erreur inconnue"}`);
    }
  });

  const isLoading = loadingKpis || loadingCashflow || loadingAi;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Chargement des données analytiques...</p>
        </div>
      </div>
    );
  }

  const kpis = kpisData?.kpis;
  const topClients = kpisData?.topClients ?? [];
  const worstOverdue = kpisData?.worstOverdueClients ?? [];
  const cashflow = cashflowData ?? [];
  const ai = aiData;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytique Financière & IA"
        description="Pilotez votre performance financière, suivez les flux de trésorerie et laissez l'IA vous guider"
      />

      {/* Financial KPIs grid */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Facturé"
            value={fmt(kpis.totalInvoiced)}
            icon={<Landmark size={20} />}
            colorClass="bg-indigo-500/10 text-indigo-400"
          />
          <StatCard
            label="Encaissé"
            value={fmt(kpis.totalCollected)}
            icon={<CheckCircle2 size={20} />}
            colorClass="bg-emerald-500/10 text-emerald-400"
          />
          <StatCard
            label="Reste à Recouvrer"
            value={fmt(kpis.totalUnpaid)}
            icon={<Clock size={20} />}
            colorClass="bg-red-500/10 text-red-400"
          />
          <StatCard
            label="Délai Moyen de Paiement"
            value={`${kpis.avgPaymentDelay} Jours`}
            icon={<TrendingUp size={20} />}
            colorClass="bg-amber-500/10 text-amber-400"
          />
        </div>
      )}

      {/* AI Finance Assistant Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-indigo-950/40 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden shadow-2xl shadow-indigo-950/40">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain size={20} className="text-indigo-400" />
              <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase">Assistant IA Finance</span>
              <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-2 py-0.5 rounded-full font-bold">PRO</span>
            </div>
            <h2 className="text-xl font-extrabold text-white">Analyse Prédictive de Trésorerie</h2>
            <p className="text-xs text-muted-foreground max-w-2xl">
              L'IA CREATIVART analyse en continu l'historique de vos facturations, le comportement de paiement de vos clients, et les tendances de dépenses pour vous proposer des optimisations directes.
            </p>
          </div>
          {ai && (
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 shrink-0 text-center md:text-left min-w-[200px]">
              <p className="text-[10px] text-muted-foreground">Prévision Trésorerie M+1</p>
              <p className="text-lg font-black text-emerald-400 mt-1">{fmt(ai.summary.forecastNextMonthCashflow)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Calculé sur la tendance trimestrielle</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold text-white">Évolution de la Trésorerie</h3>
                <p className="text-[11px] text-muted-foreground">Comparatif Revenus vs Dépenses par mois</p>
              </div>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflow} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
                  <XAxis dataKey="month" stroke="#ffffff50" fontSize={10} tickLine={false} />
                  <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} tickFormatter={(v) => `${v/1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                    itemStyle={{ fontSize: '11px' }}
                    formatter={(value: any) => [fmt(Number(value)), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" name="Revenus Encaissés" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                  <Area type="monotone" name="Dépenses Approuvées" dataKey="expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Email metrics & delivery tracking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">Performance de Communication</h3>
              {kpis && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Taux d'ouverture E-mails</p>
                      <p className="text-lg font-bold text-white mt-1">{kpis.openRate.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                      <Percent size={18} />
                    </div>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${kpis.openRate}%` }} />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Taux de clic sur lien</p>
                      <p className="text-lg font-bold text-white mt-1">{kpis.clickRate.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                      <ArrowUpRight size={18} />
                    </div>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${kpis.clickRate}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-3">Top Clients Facturés</h3>
              <div className="space-y-3">
                {topClients.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune donnée disponible</p>
                ) : (
                  topClients.map((c, i) => (
                    <div key={i} className="flex justify-between items-center p-2 rounded-lg hover:bg-white/5 transition-colors">
                      <div>
                        <p className="text-xs font-semibold text-white">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">Client principal {i + 1}</p>
                      </div>
                      <span className="text-xs font-bold text-indigo-300">{fmt(c.total)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Recommendations Panel */}
        <div className="space-y-6">
          {/* AI Insights cards */}
          {ai && (
            <div className="bg-gradient-to-b from-indigo-950/20 to-transparent border border-indigo-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-indigo-400" />
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest">IA Recommandations</h3>
              </div>

              <div className="space-y-4">
                {/* Insights Summary Cards */}
                {ai.insights.map((ins, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase">{ins.topic}</p>
                    <p className="text-base font-bold text-white mt-0.5">{ins.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{ins.description}</p>
                  </div>
                ))}

                {/* Alerts Section */}
                {ai.alerts.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Alertes de Risques</p>
                    {ai.alerts.map((al, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                        <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-red-200 leading-tight">{al.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions Suggestions */}
                {ai.suggestions.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Actions Suggérées</p>
                    {ai.suggestions.map((sug, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2.5">
                        <div className="flex justify-between items-start">
                          <p className="text-[11px] font-bold text-white">{sug.clientName}</p>
                          <span className="text-[9px] text-muted-foreground font-mono">{sug.reference}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">{sug.message}</p>
                        
                        <div className="flex gap-2">
                          {sug.action === 'AUTO_REMINDER' || sug.action === 'MANUAL_REMINDER' ? (
                            <Button
                              size="sm"
                              variant="primary"
                              className="w-full text-[10px] h-7 px-2.5 rounded-lg flex items-center justify-center gap-1 shadow-lg shadow-indigo-500/25"
                              onClick={() => sendReminderMutation.mutate(sug.invoiceId)}
                              isLoading={sendReminderMutation.isPending && sendReminderMutation.variables === sug.invoiceId}
                            >
                              <Mail size={11} /> Lancer la relance par e-mail
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full text-[10px] h-7 px-2.5 rounded-lg flex items-center justify-center gap-1"
                              onClick={() => window.open(`tel:${sug.message}`, '_self')}
                            >
                              <PhoneCall size={11} /> Appeler le client
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {ai.alerts.length === 0 && ai.suggestions.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    Aucun risque ou retard de paiement détecté par l'IA actuellement. Excellent travail !
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Worst Overdue Clients list */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-400" />
              Retards Cumulés
            </h3>
            <div className="space-y-3">
              {worstOverdue.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun retard de paiement en cours</p>
              ) : (
                worstOverdue.map((c, i) => (
                  <div key={i} className="flex justify-between items-center p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <div>
                      <p className="text-xs font-semibold text-white">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">Total en retard</p>
                    </div>
                    <span className="text-xs font-bold text-red-400">{fmt(c.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
