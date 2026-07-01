import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/auth-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  useProjects,
  useTasks,
  useInvoices,
  useQuotes,
  useEmployees,
  useLeaveRequests,
  useCalendarEvents,
  useLeads,
  useClients,
  useFinanceDashboard,
  useHrDashboard
} from '../../../hooks/use-api';
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  DollarSign, 
  FileCheck,
  Calendar as CalendarIcon,
  Clock,
  Zap,
  CheckCircle,
  AlertCircle,
  FileText,
  UserCheck,
  Plus
} from 'lucide-react';

export const DashboardOverview: React.FC = () => {
  const { user } = useAuth();

  const { data: usersData = [] } = useQuery<any[]>({
    queryKey: ['users-dashboard-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: !!user,
  });

  const { data: onlineStats } = useQuery<{ onlineCount: number; onlineUserIds: string[] }>({
    queryKey: ['online-stats-dashboard'],
    queryFn: async () => {
      const res = await api.get('/users/online/stats');
      return res.data;
    },
    refetchInterval: 15000,
    enabled: !!user,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 18) return 'Bonjour';
    return 'Bonsoir';
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(Number(val) || 0) + ' TND';
  };

  // 1. CEO Dashboard
  const CEODashboard = () => {
    const { data: financeData } = useFinanceDashboard();
    const { data: hrData } = useHrDashboard();
    const { data: projects } = useProjects({ limit: 100 });
    const { data: quotes } = useQuotes({ limit: 100 });
    const { data: invoices } = useInvoices({ limit: 100 });

    const totalRevenue = financeData?.totalRevenue ?? 0;
    const totalExpenses = financeData?.totalExpenses ?? 0;
    const netProfit = financeData?.netProfit ?? 0;

    const pendingLeaves = hrData?.leaveRequestsPending ?? 0;
    const pendingQuotes = financeData?.pendingQuotes ?? 0;
    // Note: pending approvals from financeData represents quote + invoice pending approvals
    const pendingInvoices = (financeData?.pendingApprovals ?? 0) - pendingQuotes;
    const totalPendingApprovals = pendingLeaves + Math.max(0, pendingQuotes) + Math.max(0, pendingInvoices);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <DollarSign size={20} />
              </div>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Actif
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Chiffre d'Affaires</p>
            <h3 className="text-2xl font-bold text-white mt-1 truncate">{formatCurrency(totalRevenue)}</h3>
          </div>

          <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                <DollarSign size={20} />
              </div>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                Dépenses
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Dépenses Approuvées</p>
            <h3 className="text-2xl font-bold text-white mt-1 truncate">{formatCurrency(totalExpenses)}</h3>
          </div>

          <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Profit
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Bénéfice Net</p>
            <h3 className="text-2xl font-bold text-white mt-1 truncate">{formatCurrency(netProfit)}</h3>
          </div>

          <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                <Users size={20} />
              </div>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                Effectif
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Membres de l'Équipe</p>
            <h3 className="text-2xl font-bold text-white mt-1">{(hrData?.totalEmployees ?? 0)} Collaborateurs</h3>
          </div>
        </div>

        {/* User Statistics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Users size={20} />
              </div>
              <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                Total
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total des Utilisateurs</p>
            <h3 className="text-2xl font-bold text-white mt-1">{usersData.length} Utilisateurs</h3>
          </div>

          <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <UserCheck size={20} />
              </div>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Actifs
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Utilisateurs Actifs</p>
            <h3 className="text-2xl font-bold text-white mt-1">{usersData.filter((u: any) => u.isActive).length} Actifs</h3>
          </div>

          <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                <Zap size={20} className="animate-pulse" />
              </div>
              <span className="text-xs font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                En ligne
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Utilisateurs Connectés</p>
            <h3 className="text-2xl font-bold text-white mt-1">{onlineStats?.onlineCount ?? 0} En ligne</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-base font-bold text-white">Aperçu Général de l'Activité</h4>
              <span className="text-xs text-muted-foreground">CREATIVART</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 bg-white/5 rounded-xl text-center">
                <p className="text-xs text-muted-foreground font-medium">Projets Actifs</p>
                <p className="text-2xl font-extrabold text-white mt-1">{projects?.total ?? 0}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl text-center">
                <p className="text-xs text-muted-foreground font-medium">Devis Soumis</p>
                <p className="text-2xl font-extrabold text-white mt-1">{quotes?.total ?? 0}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl text-center">
                <p className="text-xs text-muted-foreground font-medium">Factures Total</p>
                <p className="text-2xl font-extrabold text-white mt-1">{invoices?.total ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h4 className="text-base font-bold text-white mb-4">Décisions en Attente ({totalPendingApprovals})</h4>
              <div className="space-y-3">
                {pendingLeaves > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                    <UserCheck size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-white">Congés en attente</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{pendingLeaves} demande(s) de congé à valider.</p>
                    </div>
                  </div>
                )}
                {pendingQuotes > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                    <FileText size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-white">Devis en attente</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{pendingQuotes} devis en attente d'approbation.</p>
                    </div>
                  </div>
                )}
                {pendingInvoices > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-purple-500/5 rounded-xl border border-purple-500/10">
                    <FileCheck size={16} className="text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-white">Factures en attente</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{pendingInvoices} facture(s) en attente d'approbation.</p>
                    </div>
                  </div>
                )}
                {totalPendingApprovals === 0 && (
                  <p className="text-xs text-muted-foreground py-6 text-center">Aucune décision en attente pour le moment.</p>
                )}
              </div>
            </div>
            <Link to="/decision-center" className="w-full text-center bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold py-2.5 rounded-xl mt-4 transition-colors block">
              Aller au Centre de Décisions
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // 2. SECRETARY Dashboard
  const SecretaryDashboard = () => {
    const { data: leads } = useLeads({ limit: 100 });
    const { data: clients } = useClients({ limit: 100 });
    const { data: quotes } = useQuotes({ limit: 100 });
    const { data: invoices } = useInvoices({ limit: 100 });
    const { data: events } = useCalendarEvents({ limit: 100 });

    const pendingQuotes = (quotes?.data ?? []).filter(q => q.status === 'PENDING_APPROVAL');
    const pendingInvoices = (invoices?.data ?? []).filter(i => i.status === 'PENDING_APPROVAL');
    const activeClientsCount = clients?.total ?? 0;
    const newLeadsCount = (leads?.data ?? []).filter(l => l.status === 'NEW').length;

    // Filter events for today onwards
    const todayStr = new Date().toDateString();
    const upcomingEvents = (events?.data ?? []).filter(evt => new Date(evt.startTime).toDateString() === todayStr);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit mb-4">
              <Users size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Clients Actifs</p>
            <h3 className="text-2xl font-bold text-white mt-1">{activeClientsCount} Clients</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit mb-4">
              <Zap size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Nouvelles Pistes</p>
            <h3 className="text-2xl font-bold text-white mt-1">{newLeadsCount} Leads</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-4">
              <FileText size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Devis en Attente</p>
            <h3 className="text-2xl font-bold text-white mt-1">{pendingQuotes.length} Devis</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-pink-500/10 text-pink-400 rounded-xl w-fit mb-4">
              <FileCheck size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Factures en Attente</p>
            <h3 className="text-2xl font-bold text-white mt-1">{pendingInvoices.length} Factures</h3>
          </div>
        </div>

        {/* Employee Management Statistics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Users size={20} />
              </div>
              <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                Total
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total des Employés</p>
            <h3 className="text-2xl font-bold text-white mt-1">{usersData.length} Employés</h3>
          </div>

          <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <UserCheck size={20} />
              </div>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Nouveaux
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Nouveaux Employés (30j)</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {usersData.filter((u: any) => {
                const diff = Date.now() - new Date(u.createdAt).getTime();
                return diff < 30 * 24 * 3600 * 1000;
              }).length} Nouveaux
            </h3>
          </div>

          <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                <Clock size={20} />
              </div>
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                En attente
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Comptes Suspendus / En attente</p>
            <h3 className="text-2xl font-bold text-white mt-1">{usersData.filter((u: any) => !u.isActive).length} Suspendus</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 lg:col-span-2">
            <h4 className="text-base font-bold text-white mb-4">Raccourcis Secrétariat</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <Link to="/finance/quotes" className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all text-center flex flex-col items-center justify-center gap-2">
                <Plus size={20} className="text-indigo-400" />
                <span className="text-xs font-bold text-white">Nouveau Devis</span>
              </Link>
              <Link to="/finance/invoices" className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all text-center flex flex-col items-center justify-center gap-2">
                <Plus size={20} className="text-purple-400" />
                <span className="text-xs font-bold text-white">Nouvelle Facture</span>
              </Link>
              <Link to="/crm/leads" className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all text-center flex flex-col items-center justify-center gap-2">
                <Plus size={20} className="text-emerald-400" />
                <span className="text-xs font-bold text-white">Nouvelle Piste</span>
              </Link>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h4 className="text-base font-bold text-white mb-4">Réunions d'Aujourd'hui</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {upcomingEvents.map(evt => (
                <div key={evt.id} className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <CalendarIcon size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-white">{evt.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(evt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {upcomingEvents.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Aucun briefing planifié aujourd'hui.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 3. HR MANAGER Dashboard
  const HRManagerDashboard = () => {
    const { data: hrData } = useHrDashboard();
    const { data: leaveRequests } = useLeaveRequests({ limit: 100 });

    const pendingLeaves = (leaveRequests?.data ?? []).filter(l => l.status === 'PENDING' || l.status === 'REVIEWED');
    const totalEmployeesCount = hrData?.totalEmployees ?? 0;
    const activeEmployeesCount = hrData?.activeEmployees ?? 0;
    const attendanceRate = hrData?.attendanceRate ?? 100;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-4">
              <Users size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Collaborateurs Actifs</p>
            <h3 className="text-2xl font-bold text-white mt-1">{activeEmployeesCount} / {totalEmployeesCount} Employés</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit mb-4">
              <Clock size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Demandes de Congé en Attente</p>
            <h3 className="text-2xl font-bold text-white mt-1">{hrData?.leaveRequestsPending ?? pendingLeaves.length} Demandes</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-4">
              <FileCheck size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taux de Présence</p>
            <h3 className="text-2xl font-bold text-white mt-1">{attendanceRate}% Présents</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 lg:col-span-2">
            <h4 className="text-base font-bold text-white mb-4">Congés en attente de revue RH</h4>
            <div className="space-y-3">
              {pendingLeaves.map(leave => (
                <div key={leave.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <div>
                    <p className="text-xs font-bold text-white">
                      {leave.employee?.user?.firstName} {leave.employee?.user?.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Type: {leave.type} · Du {new Date(leave.startDate).toLocaleDateString()} au {new Date(leave.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Link to="/hr/leave-requests" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                    Revoir
                  </Link>
                </div>
              ))}
              {pendingLeaves.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Aucune demande en attente pour le moment.</p>
              )}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h4 className="text-base font-bold text-white mb-4">Actions RH</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configurez de nouvelles fiches d'employés, suivez les demandes d'absence et générez les contrats de travail dans la section RH.
              </p>
            </div>
            <div className="space-y-2 mt-6">
              <Link to="/hr/employees" className="w-full text-center bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors block">
                Nouveau Collaborateur
              </Link>
              <Link to="/hr/leave-requests" className="w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors block">
                Voir tous les congés
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 4. FINANCE MANAGER Dashboard
  const FinanceManagerDashboard = () => {
    const { data: financeData } = useFinanceDashboard();
    const { data: invoices } = useInvoices({ limit: 100 });

    const totalRevenue = financeData?.totalRevenue ?? 0;
    const outstandingRevenue = financeData?.outstandingInvoices?.amount ?? 0;
    const cashFlow = financeData?.netProfit ?? 0;

    const overdueRevenue = (invoices?.data ?? [])
      .filter(inv => inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + Number(inv.total ?? inv.totalAmount ?? 0), 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-4">
              <DollarSign size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Recouvrement Réalisé</p>
            <h3 className="text-xl font-bold text-white mt-1 truncate">{formatCurrency(totalRevenue)}</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit mb-4">
              <Clock size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Créances Clients</p>
            <h3 className="text-xl font-bold text-white mt-1 truncate">{formatCurrency(outstandingRevenue)}</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl w-fit mb-4">
              <AlertCircle size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Factures En Retard</p>
            <h3 className="text-xl font-bold text-white mt-1 truncate">{formatCurrency(overdueRevenue)}</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-4">
              <TrendingUp size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Trésorerie Estative</p>
            <h3 className="text-xl font-bold text-white mt-1 truncate">{formatCurrency(cashFlow)}</h3>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h4 className="text-base font-bold text-white mb-4">Facturation Récente</h4>
          <div className="space-y-3">
            {(invoices?.data ?? []).slice(0, 5).map(inv => (
              <div key={inv.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                <div>
                  <p className="text-xs font-bold text-white">{inv.client?.companyName ?? inv.client?.name ?? 'Client Inconnu'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">#Facture {inv.reference ?? inv.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-white">{formatCurrency(Number(inv.total ?? inv.totalAmount ?? 0))}</p>
                  <span className="text-[9px] text-indigo-400 font-semibold">{inv.status}</span>
                </div>
              </div>
            ))}
            {(invoices?.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Aucune facture récente.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 5. EMPLOYEE Dashboard
  const EmployeeDashboard = () => {
    const { data: tasks } = useTasks({ limit: 100 });
    const { data: projects } = useProjects({ limit: 100 });
    const { data: leaveRequests } = useLeaveRequests({ limit: 100 });
    const { data: events } = useCalendarEvents({ limit: 100 });

    const todoTasks = (tasks?.data ?? []).filter(t => t.status === 'TODO');
    const inProgressTasks = (tasks?.data ?? []).filter(t => t.status === 'IN_PROGRESS');
    const completedTasksCount = (tasks?.data ?? []).filter(t => t.status === 'COMPLETED').length;

    const myProjects = projects?.data ?? [];

    const todayStr = new Date().toDateString();
    const todayEvents = (events?.data ?? []).filter(evt => new Date(evt.startTime).toDateString() === todayStr);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit mb-4">
              <Clock size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tâches en Cours</p>
            <h3 className="text-2xl font-bold text-white mt-1">{inProgressTasks.length} Tâches</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-4">
              <Briefcase size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Mes Projets</p>
            <h3 className="text-2xl font-bold text-white mt-1">{myProjects.length} Projets</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-4">
              <CheckCircle size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tâches Complétées</p>
            <h3 className="text-2xl font-bold text-white mt-1">{completedTasksCount} Tâches</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-pink-500/10 text-pink-400 rounded-xl w-fit mb-4">
              <CalendarIcon size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Briefings Aujourd'hui</p>
            <h3 className="text-2xl font-bold text-white mt-1">{todayEvents.length} Réunions</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 lg:col-span-2">
            <h4 className="text-base font-bold text-white mb-4">Mes Tâches Actives</h4>
            <div className="space-y-3">
              {[...inProgressTasks, ...todoTasks].slice(0, 5).map(task => (
                <div key={task.id} className="flex justify-between items-center p-3.5 bg-white/5 rounded-xl border border-white/5">
                  <div>
                    <h5 className="text-xs font-bold text-white">{task.title}</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Projet: {task.project?.name ?? 'Aucun'} · Échéance: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Non définie'}
                    </p>
                  </div>
                  <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-semibold uppercase">
                    {task.status}
                  </span>
                </div>
              ))}
              {inProgressTasks.length === 0 && todoTasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Toutes les tâches sont terminées ! 🎉</p>
              )}
            </div>
            <Link to="/tasks" className="w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold py-2.5 rounded-xl mt-4 transition-colors block">
              Voir Toutes Mes Tâches
            </Link>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h4 className="text-base font-bold text-white mb-4">Statut Mes Demandes de Congé</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {(leaveRequests?.data ?? []).slice(0, 4).map(leave => (
                <div key={leave.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">{leave.type}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                      leave.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      leave.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {leave.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Du {new Date(leave.startDate).toLocaleDateString()} au {new Date(leave.endDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {(leaveRequests?.data ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Aucune demande soumise.</p>
              )}
            </div>
            <Link to="/hr/leave-requests" className="w-full text-center bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold py-2.5 rounded-xl mt-4 transition-colors block">
              Nouvelle Demande de Congé
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // 6. MARKETING MANAGER Dashboard
  const MarketingManagerDashboard = () => {
    const { data: leads } = useLeads({ limit: 100 });
    const { data: projects } = useProjects({ limit: 100 });

    const totalLeads = leads?.total ?? 0;
    const newLeads = (leads?.data ?? []).filter(l => l.status === 'NEW').length;
    const qualifiedLeads = (leads?.data ?? []).filter(l => l.status === 'QUALIFIED').length;
    
    const conversionRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit mb-4">
              <Users size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Leads</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totalLeads} Pistes</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit mb-4">
              <Clock size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Nouveaux Leads</p>
            <h3 className="text-2xl font-bold text-white mt-1">{newLeads} Nouveaux</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-4">
              <TrendingUp size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taux de Conversion</p>
            <h3 className="text-2xl font-bold text-white mt-1">{conversionRate}%</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-4">
              <Briefcase size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Campagnes Actives</p>
            <h3 className="text-2xl font-bold text-white mt-1">{projects?.total ?? 0} Projets</h3>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h4 className="text-base font-bold text-white mb-4">Leads Récents</h4>
          <div className="space-y-3">
            {(leads?.data ?? []).slice(0, 5).map(lead => (
              <div key={lead.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                <div>
                  <p className="text-xs font-bold text-white">{lead.company || `${lead.firstName} ${lead.lastName}`}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Source: {lead.source || 'Inconnue'}</p>
                </div>
                <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  {lead.status}
                </span>
              </div>
            ))}
            {(leads?.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Aucun lead trouvé.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 7. SALES MANAGER Dashboard
  const SalesManagerDashboard = () => {
    const { data: leads } = useLeads({ limit: 100 });
    const { data: quotes } = useQuotes({ limit: 100 });

    const totalLeads = leads?.total ?? 0;
    const totalQuotes = quotes?.total ?? 0;
    const approvedQuotesCount = (quotes?.data ?? []).filter(q => q.status === 'APPROVED' || q.status === 'ACCEPTED').length;
    
    const pipelineValue = (leads?.data ?? []).reduce((sum, l) => sum + Number((l as any).estimatedValue || 0), 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-4">
              <DollarSign size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valeur du Pipeline</p>
            <h3 className="text-xl font-bold text-white mt-1 truncate">{formatCurrency(pipelineValue)}</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit mb-4">
              <FileText size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Devis</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totalQuotes} Devis</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-4">
              <FileCheck size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Devis Approuvés / Acceptés</p>
            <h3 className="text-2xl font-bold text-white mt-1">{approvedQuotesCount} Devis</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit mb-4">
              <Users size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pistes CRM</p>
            <h3 className="text-2xl font-bold text-white mt-1">{totalLeads} Leads</h3>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h4 className="text-base font-bold text-white mb-4">Devis Récents</h4>
          <div className="space-y-3">
            {(quotes?.data ?? []).slice(0, 5).map(quote => (
              <div key={quote.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                <div>
                  <p className="text-xs font-bold text-white">{quote.client?.companyName ?? 'Client Inconnu'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Réf: {quote.reference}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-white">{formatCurrency(Number(quote.total))}</p>
                  <span className="text-[9px] text-indigo-400 font-semibold">{quote.status}</span>
                </div>
              </div>
            ))}
            {(quotes?.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Aucun devis trouvé.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 8. PROJECT MANAGER Dashboard
  const ProjectManagerDashboard = () => {
    const { data: projects } = useProjects({ limit: 100 });
    const { data: tasks } = useTasks({ limit: 100 });
    const { data: employees } = useEmployees({ limit: 100 });

    const activeProjects = (projects?.data ?? []).filter(p => p.status === 'ACTIVE');
    const pendingTasks = (tasks?.data ?? []).filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS');
    const completedTasks = (tasks?.data ?? []).filter(t => t.status === 'DONE' || t.status === 'COMPLETED');

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit mb-4">
              <Briefcase size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Projets Actifs</p>
            <h3 className="text-2xl font-bold text-white mt-1">{activeProjects.length} Projets</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit mb-4">
              <Clock size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tâches en Cours</p>
            <h3 className="text-2xl font-bold text-white mt-1">{pendingTasks.length} Tâches</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-4">
              <CheckCircle size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tâches Terminées</p>
            <h3 className="text-2xl font-bold text-white mt-1">{completedTasks.length} Tâches</h3>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-4">
              <Users size={20} />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Équipe Projet</p>
            <h3 className="text-2xl font-bold text-white mt-1">{employees?.total ?? 0} Membres</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 lg:col-span-2">
            <h4 className="text-base font-bold text-white mb-4">Projets en Cours</h4>
            <div className="space-y-3">
              {activeProjects.slice(0, 5).map(project => (
                <div key={project.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <div>
                    <h5 className="text-xs font-bold text-white">{project.name}</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Budget: {formatCurrency(Number(project.budget || 0))}</p>
                  </div>
                  <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-semibold uppercase">
                    {project.status}
                  </span>
                </div>
              ))}
              {activeProjects.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Aucun projet actif.</p>
              )}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h4 className="text-base font-bold text-white mb-4">Charge de travail équipe</h4>
            <div className="space-y-3">
              {(employees?.data ?? []).slice(0, 5).map(emp => {
                const empTasks = (tasks?.data ?? []).filter(t => t.assignee?.id === emp.userId && t.status !== 'DONE' && t.status !== 'COMPLETED').length;
                return (
                  <div key={emp.id} className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-xs font-bold text-white">{emp.user?.firstName} {emp.user?.lastName}</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${
                      empTasks > 4 ? 'bg-rose-500/10 text-rose-400' : empTasks > 2 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {empTasks} tâches
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-white/5 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight animate-fade-in">
            {getGreeting()}, {user?.firstName}!
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Bienvenue sur votre portail d'entreprise CREATIVART. Voici l'aperçu de vos activités.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-gray-200">
            {user?.role ? (typeof user.role === 'string' ? user.role : (user.role as any).name || '').replace(/_/g, ' ') : ''} · Connecté
          </span>
        </div>
      </div>

      {/* Render matching dashboard for the role */}
      {user?.role === 'GERANT' && <CEODashboard />}
      {user?.role === 'SECRETAIRE' && <SecretaryDashboard />}
      {user?.role === 'RESPONSABLE_RH' && <HRManagerDashboard />}
      {user?.role === 'RESPONSABLE_FINANCIER' && <FinanceManagerDashboard />}
      {user?.role === 'RESPONSABLE_MARKETING' && <MarketingManagerDashboard />}
      {user?.role === 'RESPONSABLE_VENTES' && <SalesManagerDashboard />}
      {user?.role === 'RESPONSABLE_OPERATIONS' && <ProjectManagerDashboard />}
      {user?.role === 'CHEF_PROJET' && <ProjectManagerDashboard />}
      {user?.role === 'CHEF_EQUIPE' && <ProjectManagerDashboard />}
      {user?.role === 'COLLABORATEUR' && <EmployeeDashboard />}
      {user?.role === 'STAGIAIRE' && <EmployeeDashboard />}
    </div>
  );
};
