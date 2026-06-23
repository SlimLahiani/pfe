import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line,
} from 'recharts';

// ─── Theme colors ───────────────────────────────────────────────────────────

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#4f46e5'];
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#64748b', SENT: '#3b82f6', PAID: '#10b981', OVERDUE: '#ef4444',
  PARTIALLY_PAID: '#f59e0b', PENDING_APPROVAL: '#8b5cf6',
  PENDING: '#f59e0b', APPROVED: '#10b981', REJECTED: '#ef4444', REVIEWED: '#6366f1',
  TODO: '#64748b', IN_PROGRESS: '#3b82f6', IN_REVIEW: '#8b5cf6', DONE: '#10b981',
  BACKLOG: '#475569', CANCELLED: '#94a3b8',
  NEW: '#3b82f6', CONTACTED: '#8b5cf6', QUALIFIED: '#6366f1', WON: '#10b981', LOST: '#ef4444',
  PROPOSAL_SENT: '#f59e0b', NEGOTIATION: '#a78bfa',
  ACTIVE: '#10b981', PLANNING: '#3b82f6', ON_HOLD: '#f59e0b', COMPLETED: '#6366f1',
  CDI: '#10b981', CDD: '#3b82f6', FREELANCE: '#8b5cf6', INTERNSHIP: '#f59e0b', PART_TIME: '#64748b',
  ANNUAL: '#6366f1', SICK: '#ef4444', MATERNITY: '#ec4899', PATERNITY: '#8b5cf6', UNPAID: '#64748b', OTHER: '#94a3b8',
  APPLIED: '#3b82f6', INTERVIEWING: '#8b5cf6', OFFERED: '#f59e0b', HIRED: '#10b981',
  'Présent': '#10b981', 'En retard': '#f59e0b', 'Absent': '#ef4444',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/95 border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-sm">
      <p className="text-xs font-semibold text-white mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </div>
  );
};

const LABEL_STYLE = { fill: '#94a3b8', fontSize: 11 };
const GRID_STYLE = { stroke: 'rgba(255,255,255,0.05)' };

// ─── FINANCIAL CHARTS ───────────────────────────────────────────────────────

export const MonthlyTrendChart: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="h-[280px]">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="month" tick={LABEL_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={LABEL_STYLE} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#gradRevenue)" name="Revenus" />
        <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#gradExpenses)" name="Dépenses" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export const ProfitTrendChart: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="h-[240px]">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="month" tick={LABEL_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={LABEL_STYLE} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} name="Profit" />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export const StatusDistributionChart: React.FC<{ data: { status: string; count: number }[]; title?: string }> = ({ data, title }) => (
  <div className="h-[240px]">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          label={({ status, count }: any) => `${status} (${count})`}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

export const ExpenseCategoryChart: React.FC<{ data: { name: string; amount: number; count: number }[] }> = ({ data }) => (
  <div className="h-[280px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis type="number" tick={LABEL_STYLE} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
        <YAxis type="category" dataKey="name" tick={LABEL_STYLE} axisLine={false} tickLine={false} width={75} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="amount" fill="#8b5cf6" radius={[0, 6, 6, 0]} name="Montant (TND)" />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const TopClientsChart: React.FC<{ data: { name: string; revenue: number }[] }> = ({ data }) => (
  <div className="h-[240px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="name" tick={LABEL_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={LABEL_STYLE} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} name="Revenue (TND)" />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// ─── HR CHARTS ──────────────────────────────────────────────────────────────

export const DepartmentDistributionChart: React.FC<{ data: { name: string; count: number }[] }> = ({ data }) => (
  <div className="h-[260px]">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={80}
          paddingAngle={4}
          label={({ name, count }: any) => `${name} (${count})`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

export const LeaveTypeChart: React.FC<{ data: { type: string; count: number }[] }> = ({ data }) => (
  <div className="h-[240px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="type" tick={LABEL_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={LABEL_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" name="Demandes" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.type] || COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const AttendanceChart: React.FC<{ data: { status: string; count: number }[] }> = ({ data }) => (
  <div className="h-[200px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="status" tick={LABEL_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={LABEL_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" name="Jours" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// ─── PROJECT CHARTS ─────────────────────────────────────────────────────────

export const ProjectCompletionChart: React.FC<{ data: { name: string; completion: number; overdueTasks: number }[] }> = ({ data }) => (
  <div className="h-[280px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis type="number" domain={[0, 100]} tick={LABEL_STYLE} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={LABEL_STYLE} axisLine={false} tickLine={false} width={95} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="completion" fill="#6366f1" radius={[0, 6, 6, 0]} name="Avancement (%)" />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const TeamWorkloadChart: React.FC<{ data: { name: string; activeTasks: number; completedTasks: number }[] }> = ({ data }) => (
  <div className="h-[280px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.slice(0, 10)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="name" tick={LABEL_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={LABEL_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="activeTasks" stackId="a" fill="#f59e0b" name="En cours" radius={[0, 0, 0, 0]} />
        <Bar dataKey="completedTasks" stackId="a" fill="#10b981" name="Terminées" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// ─── CEO COMPARISON CHART ───────────────────────────────────────────────────

export const DepartmentComparisonChart: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="h-[300px]">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="name" tick={LABEL_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={LABEL_STYLE} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="employeeCount" fill="#6366f1" name="Effectif" radius={[4, 4, 0, 0]} />
        <Bar dataKey="averageProductivity" fill="#10b981" name="Productivité (%)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="budgetUtilization" fill="#f59e0b" name="Budget utilisé (%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);
