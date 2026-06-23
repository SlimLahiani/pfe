import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/auth-context';
import { useSocket } from '../../hooks/use-socket';
import { useNotifications, useMarkNotificationRead } from '../../hooks/use-api';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  DollarSign,
  FileText,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Bell,
  CheckSquare,
  UserCheck,
  Calendar,
  BarChart3,
  Target,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Check,
  Info,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  permission: string | null;
  roles?: string[];
  children?: { label: string; path: string; permission?: string | null; roles?: string[] }[];
}

// ─── Notification Panel ───────────────────────────────────────────────────────

const NotificationIcon: React.FC<{ type: string }> = ({ type }) => {
  const t = type?.toUpperCase();
  if (t?.includes('SUCCESS') || t?.includes('PAID')) return <CheckCircle2 size={14} className="text-emerald-400" />;
  if (t?.includes('WARN') || t?.includes('OVERDUE')) return <AlertTriangle size={14} className="text-amber-400" />;
  return <Info size={14} className="text-indigo-400" />;
};

const NotificationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data, isLoading } = useNotifications({ limit: 20 });
  const markRead = useMarkNotificationRead();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const notifications = data?.data ?? [];
  const unread = notifications.filter((n) => !n.isRead);

  return (
    <div
      ref={panelRef}
      className="absolute top-12 right-0 w-80 z-50 glass-panel rounded-2xl shadow-2xl shadow-black/40 border border-white/10 overflow-hidden animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-indigo-400" />
          <span className="text-sm font-bold text-white">Notifications</span>
          {unread.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
              {unread.length}
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => unread.forEach((n) => markRead.mutate(n.id))}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
          >
            <Check size={11} />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse">
              <div className="h-3 bg-white/5 rounded w-3/4 mb-2" />
              <div className="h-2.5 bg-white/5 rounded w-full" />
            </div>
          ))
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell size={24} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Aucune notification</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.isRead && markRead.mutate(notif.id)}
              className={cn(
                'flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.03]',
                !notif.isRead && 'bg-indigo-500/[0.04]'
              )}
            >
              <div className="mt-0.5 shrink-0">
                <NotificationIcon type={notif.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold truncate', notif.isRead ? 'text-gray-400' : 'text-white')}>
                  {notif.title}
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{notif.body}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">
                  {new Date(notif.createdAt).toLocaleString()}
                </p>
              </div>
              {!notif.isRead && (
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Dashboard Layout ─────────────────────────────────────────────────────────

export const DashboardLayout: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: any) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('notification', handleNewNotification);
    socket.on('notification_created', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('notification_created', handleNewNotification);
    };
  }, [socket, queryClient]);

  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['CRM', 'Projets']);
  const [notifOpen, setNotifOpen] = useState(false);

  // Notification count for badge
  const { data: notifData } = useNotifications({ limit: 50 });
  const unreadCount = (notifData?.data ?? []).filter((n) => !n.isRead).length;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const isEmployeeOrIntern = user && ['COLLABORATEUR', 'STAGIAIRE', 'CHEF_PROJET', 'CHEF_EQUIPE'].includes(user.role);

  const navItems: NavItem[] = [
    {
      label: 'Aperçu',
      path: '/',
      icon: <LayoutDashboard size={18} />,
      permission: null,
    },
    {
      label: 'Décisions IA',
      path: '/decision-center',
      icon: <Sparkles size={18} />,
      permission: null,
      roles: ['GERANT', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER'],
    },
    {
      label: 'Intelligence IA',
      path: '/intelligence',
      icon: <Brain size={18} />,
      permission: null,
      roles: ['GERANT', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER'],
    },
    {
      label: 'CRM',
      icon: <Target size={18} />,
      permission: 'crm:read',
      roles: ['GERANT', 'SECRETAIRE', 'RESPONSABLE_MARKETING', 'RESPONSABLE_VENTES', 'RESPONSABLE_FINANCIER'],
      children: [
        { label: 'Pistes', path: '/crm/leads', roles: ['GERANT', 'RESPONSABLE_MARKETING', 'RESPONSABLE_VENTES'] },
        { label: 'Clients', path: '/crm/clients', roles: ['GERANT', 'SECRETAIRE', 'RESPONSABLE_MARKETING', 'RESPONSABLE_VENTES', 'RESPONSABLE_FINANCIER'] },
      ],
    },
    {
      label: isEmployeeOrIntern ? 'Mes Projets' : 'Projets',
      path: isEmployeeOrIntern ? '/projects' : undefined,
      icon: <Briefcase size={18} />,
      permission: 'projects:read',
      roles: ['GERANT', 'SECRETAIRE', 'COLLABORATEUR', 'CHEF_PROJET', 'CHEF_EQUIPE', 'RESPONSABLE_OPERATIONS', 'RESPONSABLE_MARKETING'],
      children: isEmployeeOrIntern ? undefined : [
        { label: 'Tous les projets', path: '/projects' },
      ],
    },
    {
      label: isEmployeeOrIntern ? 'Mes Tâches' : 'Tâches',
      path: '/tasks',
      icon: <CheckSquare size={18} />,
      permission: 'tasks:read',
      roles: ['GERANT', 'SECRETAIRE', 'COLLABORATEUR', 'CHEF_PROJET', 'CHEF_EQUIPE', 'RESPONSABLE_OPERATIONS', 'RESPONSABLE_MARKETING', 'STAGIAIRE'],
    },
    {
      label: 'Messagerie',
      path: '/chat',
      icon: <MessageSquare size={18} />,
      permission: null,
    },
    {
      label: 'Finance',
      icon: <DollarSign size={18} />,
      permission: 'finance:read',
      roles: ['GERANT', 'RESPONSABLE_FINANCIER', 'SECRETAIRE'],
      children: [
        { label: 'Tableau de Bord', path: '/financials', roles: ['GERANT', 'RESPONSABLE_FINANCIER'] },
        { label: 'Analytique & IA', path: '/finance/analytics', roles: ['GERANT', 'RESPONSABLE_FINANCIER'] },
        { label: 'Devis', path: '/finance/quotes', roles: ['GERANT', 'RESPONSABLE_FINANCIER', 'SECRETAIRE'] },
        { label: 'Factures', path: '/finance/invoices', roles: ['GERANT', 'RESPONSABLE_FINANCIER', 'SECRETAIRE'] },
        { label: 'Dépenses', path: '/finance/expenses', roles: ['GERANT', 'RESPONSABLE_FINANCIER'] },
      ],
    },
    {
      label: isEmployeeOrIntern ? 'Portail RH' : 'RH',
      icon: <UserCheck size={18} />,
      permission: null,
      roles: ['GERANT', 'RESPONSABLE_RH', 'COLLABORATEUR', 'STAGIAIRE', 'CHEF_PROJET', 'CHEF_EQUIPE'],
      children: isEmployeeOrIntern ? [
        { label: 'Mon Profil', path: '/hr/portal', roles: ['GERANT', 'COLLABORATEUR', 'STAGIAIRE', 'CHEF_PROJET', 'CHEF_EQUIPE'] },
        { label: 'Mes Congés', path: '/hr/leave-requests', roles: ['GERANT', 'COLLABORATEUR', 'STAGIAIRE', 'CHEF_PROJET', 'CHEF_EQUIPE'] },
      ] : [
        { label: 'Tableau de Bord', path: '/hr/dashboard', roles: ['GERANT', 'RESPONSABLE_RH'] },
        { label: 'Employés', path: '/hr/employees', roles: ['GERANT', 'RESPONSABLE_RH', 'CHEF_EQUIPE', 'CHEF_PROJET', 'RESPONSABLE_OPERATIONS'] },
        { label: 'Départements', path: '/hr/departments', roles: ['GERANT', 'RESPONSABLE_RH'] },
        { label: 'Demandes de congé', path: '/hr/leave-requests', roles: ['GERANT', 'RESPONSABLE_RH'] },
        { label: 'Organigramme', path: '/hr/org-chart', roles: ['GERANT', 'RESPONSABLE_RH'] },
        { label: 'Recrutement', path: '/hr/recruitment', roles: ['GERANT', 'RESPONSABLE_RH'] },
      ],
    },
    {
      label: isEmployeeOrIntern ? 'Mes Documents' : 'Documents',
      icon: <FileText size={18} />,
      permission: 'documents:read',
      roles: ['GERANT', 'SECRETAIRE', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER', 'CHEF_PROJET', 'COLLABORATEUR'],
      children: [
        { label: isEmployeeOrIntern ? 'Tous mes documents' : 'Tous les documents', path: '/documents' },
        { label: 'Historique des PDF', path: '/documents/history' },
      ],
    },
    {
      label: 'Calendrier',
      path: '/calendar',
      icon: <Calendar size={18} />,
      permission: null,
      roles: ['GERANT', 'SECRETAIRE', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER', 'CHEF_PROJET', 'CHEF_EQUIPE', 'COLLABORATEUR', 'RESPONSABLE_MARKETING', 'RESPONSABLE_OPERATIONS'],
    },
    {
      label: 'Rapports',
      path: '/reports',
      icon: <BarChart3 size={18} />,
      permission: 'reports:read',
      roles: ['GERANT', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER', 'RESPONSABLE_MARKETING', 'RESPONSABLE_VENTES', 'CHEF_PROJET', 'CHEF_EQUIPE', 'RESPONSABLE_OPERATIONS'],
    },
    {
      label: 'Administration',
      path: '/users',
      icon: <Users size={18} />,
      permission: 'users:read',
      roles: ['GERANT'],
    },
  ];

  const filteredNavItems = navItems
    .filter((item) => {
      const permOk = !item.permission || hasPermission(item.permission);
      const roleOk = !item.roles || (user && item.roles.includes(user.role));
      return permOk && roleOk;
    })
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter((child) => {
            const childPermOk = !child.permission || hasPermission(child.permission);
            const childRoleOk = !child.roles || (user && child.roles.includes(user.role));
            return childPermOk && childRoleOk;
          }),
        };
      }
      return item;
    });

  const isChildActive = (children?: { path: string }[]) =>
    children?.some((c) => location.pathname === c.path) ?? false;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-64 bg-card/40 backdrop-blur-xl border-r border-white/5 z-40 transition-transform duration-300 lg:translate-x-0 lg:static lg:flex lg:flex-col',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              C
            </div>
            <span className="font-extrabold text-white text-lg tracking-wide">
              CREATIV<span className="text-indigo-400">ART</span>
            </span>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {filteredNavItems.map((item) => {
            if (item.children) {
              const isExpanded = expandedGroups.includes(item.label);
              const hasActiveChild = isChildActive(item.children);
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                      hasActiveChild
                        ? 'text-indigo-300 bg-indigo-500/5'
                        : 'text-muted-foreground hover:text-white hover:bg-white/5'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className={hasActiveChild ? 'text-indigo-400' : 'text-gray-500'}>
                        {item.icon}
                      </span>
                      {item.label}
                    </span>
                    {isExpanded
                      ? <ChevronDown size={14} className="text-gray-500" />
                      : <ChevronRight size={14} className="text-gray-500" />
                    }
                  </button>
                  {isExpanded && (
                    <div className="ml-8 mt-0.5 space-y-0.5 border-l border-white/5 pl-3">
                      {item.children.map((child) => {
                        const isActive = location.pathname === child.path;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={() => setIsSidebarOpen(false)}
                            className={cn(
                              'flex items-center py-2 px-2 rounded-lg text-xs font-medium transition-all duration-150',
                              isActive
                                ? 'text-indigo-300 bg-indigo-500/10'
                                : 'text-muted-foreground hover:text-white hover:bg-white/5'
                            )}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = location.pathname === item.path;
            const isChatItem = item.path === '/chat';
            return (
              <Link
                key={item.path}
                to={item.path!}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-300'
                    : 'text-muted-foreground hover:text-white hover:bg-white/5',
                  isChatItem && 'mt-1'
                )}
              >
                <span className={isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'}>
                  {item.icon}
                </span>
                {item.label}
                {isChatItem && isConnected && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 bg-white/[0.01] shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-indigo-300 font-bold text-sm">
              {user?.firstName[0]}{user?.lastName[0]}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mt-0.5 uppercase tracking-wide">
                {user?.role ? (typeof user.role === 'string' ? user.role : (user.role as any).name || '').replace(/_/g, ' ') : ''}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-200 hover:text-red-100 border border-red-500/20 transition-all duration-200"
          >
            <LogOut size={14} />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main Work Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-card/25 backdrop-blur-md sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1 text-muted-foreground hover:text-white focus:outline-none"
            >
              <Menu size={24} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300',
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              )}
            >
              {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span className="hidden sm:inline">
                {isConnected ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((p) => !p)}
                className="relative p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 border border-white/5 transition-colors"
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-indigo-500 border-2 border-background text-white text-[9px] font-bold flex items-center justify-center px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
            </div>

            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-indigo-300 text-xs font-bold">
              {user?.firstName[0]}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto animate-fade-in">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
