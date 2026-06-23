import React from 'react';
import {
  TrendingUp, TrendingDown, FileText, Clock,
  AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight, Users, BarChart3,
  PieChart, Activity, CreditCard, Wallet,
} from 'lucide-react';
import {
  useFinanceDashboard, useRevenueTrend, useCashFlow, useInvoiceAging,
  useTopClients, useExpenseBreakdown,
} from '../../../hooks/use-api';

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'TND', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtFull = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'TND' });

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KPICard: React.FC<{
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  colorClass: string;
}> = ({ label, value, subtitle, icon, trend, colorClass }) => (
  <div className="glass-card rounded-2xl p-5 group hover:scale-[1.02] transition-all duration-300">
    <div className="flex items-start justify-between mb-3">
      <div className={`p-2.5 rounded-xl ${colorClass}`}>
        {icon}
      </div>
      {trend && (
        <div className={`flex items-center gap-0.5 text-xs font-bold ${
          trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
        }`}>
          {trend === 'up' ? <ArrowUpRight size={12} /> : trend === 'down' ? <ArrowDownRight size={12} /> : null}
        </div>
      )}
    </div>
    <p className="text-2xl font-black text-white tracking-tight">{value}</p>
    <p className="text-xs text-muted-foreground mt-1">{label}</p>
    {subtitle && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{subtitle}</p>}
  </div>
);

// ─── Mini Bar Chart (Pure CSS) ────────────────────────────────────────────────

const MiniBarChart: React.FC<{
  data: { label: string; value: number }[];
  maxValue: number;
  color: string;
}> = ({ data, maxValue, color }) => (
  <div className="flex items-end gap-1 h-32">
    {data.map((d, i) => {
      const height = maxValue > 0 ? Math.max((d.value / maxValue) * 100, 2) : 2;
      return (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
          <div className="relative w-full flex justify-center">
            <div
              className="w-full max-w-[24px] rounded-t-md transition-all duration-500 ease-out opacity-70 group-hover/bar:opacity-100"
              style={{ height: `${height}%`, backgroundColor: color, minHeight: '2px' }}
            />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover/bar:block bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-10 font-mono">
              {fmt(d.value)}
            </div>
          </div>
          <span className="text-[8px] text-muted-foreground/60 truncate w-full text-center">{d.label}</span>
        </div>
      );
    })}
  </div>
);

// ─── Cash Flow Chart ──────────────────────────────────────────────────────────

const CashFlowChart: React.FC<{
  data: { month: string; revenue: number; expenses: number; net: number }[];
}> = ({ data }) => {
  const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.expenses)), 1);
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-36">
        {data.map((d, i) => {
          const revH = Math.max((d.revenue / maxVal) * 100, 1);
          const expH = Math.max((d.expenses / maxVal) * 100, 1);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
              <div className="flex gap-px items-end w-full justify-center" style={{ height: '100%' }}>
                <div
                  className="w-[8px] rounded-t-sm transition-all duration-500 opacity-70 group-hover/bar:opacity-100"
                  style={{ height: `${revH}%`, backgroundColor: '#22c55e', minHeight: '1px' }}
                />
                <div
                  className="w-[8px] rounded-t-sm transition-all duration-500 opacity-70 group-hover/bar:opacity-100"
                  style={{ height: `${expH}%`, backgroundColor: '#ef4444', minHeight: '1px' }}
                />
              </div>
              <span className="text-[7px] text-muted-foreground/50 truncate w-full text-center">{d.month}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-muted-foreground">Revenus</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[10px] text-muted-foreground">Dépenses</span>
        </div>
      </div>
    </div>
  );
};

// ─── Aging Chart ──────────────────────────────────────────────────────────────

const AgingChart: React.FC<{ data: { label: string; amount: number; count: number; color: string }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="space-y-3">
      {/* Horizontal stacked bar */}
      <div className="h-6 rounded-full overflow-hidden flex bg-white/5">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.amount / total) * 100 : 25;
          return pct > 0 ? (
            <div
              key={i}
              className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${pct}%`, backgroundColor: d.color }}
              title={`${d.label}: ${fmtFull(d.amount)}`}
            />
          ) : null;
        })}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="ml-auto font-bold text-white">{fmt(d.amount)}</span>
            <span className="text-muted-foreground/50 text-[10px]">({d.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Expense Breakdown ────────────────────────────────────────────────────────

const ExpensePieChart: React.FC<{ categories: { categoryName: string; total: number; percentage: number }[] }> = ({ categories }) => {
  const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#60a5fa', '#34d399', '#fbbf24'];
  return (
    <div className="space-y-2">
      {categories.slice(0, 6).map((cat, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate max-w-[140px]">{cat.categoryName}</span>
            <span className="font-bold text-white">{fmt(cat.total)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${cat.percentage}%`, backgroundColor: colors[i % colors.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Top Clients ──────────────────────────────────────────────────────────────

const TopClientsList: React.FC<{ clients: { companyName: string; totalPaid: number; invoiceCount: number }[] }> = ({ clients }) => {
  const maxPaid = Math.max(...clients.map(c => c.totalPaid), 1);
  return (
    <div className="space-y-3">
      {clients.map((client, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white">
                {i + 1}
              </div>
              <span className="text-xs font-medium text-white truncate max-w-[140px]">{client.companyName}</span>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-white">{fmt(client.totalPaid)}</p>
              <p className="text-[9px] text-muted-foreground">{client.invoiceCount} facture(s)</p>
            </div>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
              style={{ width: `${(client.totalPaid / maxPaid) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {clients.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Aucun client avec paiement</p>
      )}
    </div>
  );
};

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-white/5 rounded-xl ${className}`} />
);

// ═══════════════════════════════════════════════════════════════════════════════
// Main Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

export const FinancialsPage: React.FC = () => {
  const { data: kpi, isLoading: kpiLoading } = useFinanceDashboard();
  const { data: revenue } = useRevenueTrend();
  const { data: cashflow } = useCashFlow();
  const { data: aging } = useInvoiceAging();
  const { data: topClients } = useTopClients();
  const { data: expBreakdown } = useExpenseBreakdown();

  if (kpiLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const revenueChartData = (revenue ?? []).map(r => ({ label: r.month, value: r.revenue }));
  const maxRevenue = Math.max(...revenueChartData.map(d => d.value), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
            <BarChart3 size={20} className="text-indigo-400" />
          </div>
          Tableau de Bord Financier
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Vue d'ensemble en temps réel de la performance financière de l'agence
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Revenus Totaux"
          value={fmt(kpi?.totalRevenue ?? 0)}
          icon={<TrendingUp size={18} />}
          colorClass="bg-emerald-500/10 text-emerald-400"
          trend="up"
        />
        <KPICard
          label="Dépenses Totales"
          value={fmt(kpi?.totalExpenses ?? 0)}
          icon={<TrendingDown size={18} />}
          colorClass="bg-red-500/10 text-red-400"
          trend="down"
        />
        <KPICard
          label="Bénéfice Net"
          value={fmt(kpi?.netProfit ?? 0)}
          icon={<Wallet size={18} />}
          colorClass={(kpi?.netProfit ?? 0) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}
          trend={(kpi?.netProfit ?? 0) >= 0 ? 'up' : 'down'}
        />
        <KPICard
          label="Flux de Trésorerie Mensuel"
          value={fmt(kpi?.monthlyCashFlow ?? 0)}
          icon={<Activity size={18} />}
          colorClass="bg-indigo-500/10 text-indigo-400"
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Factures Impayées"
          value={kpi?.outstandingInvoices.count ?? 0}
          subtitle={fmtFull(kpi?.outstandingInvoices.amount ?? 0)}
          icon={<FileText size={18} />}
          colorClass="bg-amber-500/10 text-amber-400"
        />
        <KPICard
          label="Devis en Attente"
          value={kpi?.pendingQuotes ?? 0}
          icon={<Clock size={18} />}
          colorClass="bg-purple-500/10 text-purple-400"
        />
        <KPICard
          label="Factures en Retard"
          value={kpi?.overdueInvoices ?? 0}
          icon={<AlertTriangle size={18} />}
          colorClass="bg-red-500/10 text-red-400"
        />
        <KPICard
          label="Taux de Recouvrement"
          value={`${kpi?.collectionRate ?? 0}%`}
          subtitle={`${kpi?.paidInvoices ?? 0} / ${kpi?.totalInvoices ?? 0} factures`}
          icon={<CheckCircle size={18} />}
          colorClass="bg-emerald-500/10 text-emerald-400"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <TrendingUp size={14} className="text-emerald-400" />
                Tendance des Revenus
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">12 derniers mois</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-emerald-400">{fmt(kpi?.totalRevenue ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground">Total cumulé</p>
            </div>
          </div>
          <MiniBarChart data={revenueChartData} maxValue={maxRevenue} color="#22c55e" />
        </div>

        {/* Cash Flow */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Activity size={14} className="text-indigo-400" />
                Flux de Trésorerie
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Revenus vs Dépenses</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-black ${(kpi?.monthlyCashFlow ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(kpi?.monthlyCashFlow ?? 0)}
              </p>
              <p className="text-[10px] text-muted-foreground">Ce mois</p>
            </div>
          </div>
          {cashflow && <CashFlowChart data={cashflow} />}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Aging */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-4">
            <CreditCard size={14} className="text-amber-400" />
            Échéancier des Factures
          </h3>
          {aging && <AgingChart data={aging} />}
        </div>

        {/* Expense Breakdown */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <PieChart size={14} className="text-purple-400" />
              Répartition des Dépenses
            </h3>
            <span className="text-xs font-bold text-red-400">{fmt(expBreakdown?.grandTotal ?? 0)}</span>
          </div>
          {expBreakdown && <ExpensePieChart categories={expBreakdown.categories} />}
          {expBreakdown && expBreakdown.categories.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Aucune dépense enregistrée</p>
          )}
        </div>

        {/* Top Clients */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-4">
            <Users size={14} className="text-indigo-400" />
            Top Clients par Revenu
          </h3>
          {topClients && <TopClientsList clients={topClients} />}
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="glass-card rounded-2xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-lg font-black text-white">{kpi?.totalInvoices ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Total Factures</p>
          </div>
          <div>
            <p className="text-lg font-black text-emerald-400">{kpi?.paidInvoices ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Factures Payées</p>
          </div>
          <div>
            <p className="text-lg font-black text-amber-400">{kpi?.pendingApprovals ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Approbations en Attente</p>
          </div>
          <div>
            <p className="text-lg font-black text-indigo-400">{fmt(kpi?.monthlyRevenue ?? 0)}</p>
            <p className="text-[10px] text-muted-foreground">Revenus ce Mois</p>
          </div>
        </div>
      </div>
    </div>
  );
};
