import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/auth-context';
import { UserDialog } from '../components/user-dialog';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  UserCheck, 
  UserX,
  Loader2,
  Eye,
  X,
  Mail,
  Phone,
  Building,
  Shield,
  Calendar,
  Download,
  RotateCcw
} from 'lucide-react';
import { exportToCSV } from '../../../lib/export-csv';
import { Pagination } from '../../../components/shared/ui';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roleId: string;
  role: Role;
  avatarUrl?: string | null;
  createdAt: string;
  employeeProfile?: {
    id: string;
    phone?: string | null;
    jobTitle?: string | null;
    departmentId?: string | null;
    department?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

const AVATAR_COLORS = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-pink-500 to-rose-600',
  'from-sky-500 to-cyan-600',
  'from-violet-500 to-purple-600',
];

const UserAvatar: React.FC<{ name: string; avatarUrl?: string | null; size?: 'sm' | 'lg' }> = ({ name, avatarUrl, size = 'sm' }) => {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const sizeClasses = size === 'lg' ? 'w-20 h-20 text-xl' : 'w-9 h-9 text-xs';
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${sizeClasses} rounded-full object-cover border border-white/10`} />;
  }

  return (
    <div className={`rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white ${sizeClasses} border border-white/10`}>
      {initials}
    </div>
  );
};

// ─── User Details Dialog ────────────────────────────────────────────────────────

const UserDetailsDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}> = ({ isOpen, onClose, user }) => {
  if (!isOpen || !user) return null;

  const fullName = `${user.firstName} ${user.lastName}`;
  const deptName = user.employeeProfile?.department?.name || '—';
  const jobTitle = user.employeeProfile?.jobTitle || '—';
  const phone = user.employeeProfile?.phone || '—';
  const dateCreated = new Date(user.createdAt).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-black/75 backdrop-blur-sm" />
      
      <div className="bg-[#16192a] w-full max-w-md rounded-2xl border border-white/5 shadow-2xl relative z-10 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Fiche du Personnel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Card Hero */}
          <div className="flex flex-col items-center text-center space-y-3">
            <UserAvatar name={fullName} avatarUrl={user.avatarUrl} size="lg" />
            <div>
              <h4 className="text-base font-bold text-white">{fullName}</h4>
              <p className="text-xs text-indigo-400 font-semibold mt-0.5">{jobTitle}</p>
            </div>
            {user.isActive ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <UserCheck size={11} /> Actif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20">
                <UserX size={11} /> Suspendu
              </span>
            )}
          </div>

          {/* Details list */}
          <div className="space-y-4 pt-2 border-t border-white/5">
            <div className="flex items-center gap-3 text-xs">
              <Mail size={15} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Adresse Email</p>
                <p className="text-white mt-0.5">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <Phone size={15} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Téléphone</p>
                <p className="text-white mt-0.5">{phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <Building size={15} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Département</p>
                <p className="text-white mt-0.5">{deptName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <Shield size={15} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Rôle du Système</p>
                <p className="text-white mt-0.5">{user.role.name} ({user.role.description || 'Accès Standard'})</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <Calendar size={15} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Enregistré le</p>
                <p className="text-white mt-0.5">{dateCreated}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/5 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/10 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export const UsersPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewedUser, setViewedUser] = useState<User | null>(null);

  // Queries
  const { data: users = [], isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ['users', showArchived],
    queryFn: async () => {
      const response = await api.get(`/users?showArchived=${showArchived}`);
      return response.data;
    },
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/users/roles/all');
      return response.data;
    },
    enabled: hasPermission('users:read'),
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.get('/users/departments/all');
      return response.data;
    },
    enabled: hasPermission('users:read'),
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Échec de l'archivage de l'utilisateur.");
    }
  });

  // Restore Mutation
  const restoreMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/users/${userId}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Échec de la restauration de l'utilisateur.");
    }
  });

  const handleDelete = (userId: string, name: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir archiver le compte de ${name} ? Son accès au système sera révoqué mais ses données seront conservées.`)) {
      deleteMutation.mutate(userId);
    }
  };

  const handleRestore = (userId: string, name: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir restaurer le compte de ${name} ?`)) {
      restoreMutation.mutate(userId);
    }
  };

  const openCreateDialog = () => {
    setSelectedUser(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const openViewDialog = (user: User) => {
    setViewedUser(user);
    setIsViewOpen(true);
  };

  const handleExportCSV = () => {
    const dataToExport = filteredUsers;
    const columns = [
      { header: 'Nom', key: 'firstName', transform: (_val: string, item: any) => `${item.firstName} ${item.lastName}` },
      { header: 'E-mail', key: 'email' },
      { header: 'Rôle', key: 'role.name' },
      { header: 'Département', key: 'employeeProfile.department.name' },
      { header: 'Poste', key: 'employeeProfile.jobTitle' },
      { header: 'Téléphone', key: 'employeeProfile.phone' },
      { header: 'Statut', key: 'isActive', transform: (val: boolean) => val ? 'Actif' : 'Suspendu' },
      { header: 'Créé le', key: 'createdAt', transform: (val: string) => new Date(val).toLocaleDateString() },
    ];
    exportToCSV(dataToExport, columns, `utilisateurs-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  // Client-side filtering
  const filteredUsers = users.filter((user) => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const email = user.email.toLowerCase();
    const roleName = user.role.name.toLowerCase();
    const deptName = (user.employeeProfile?.department?.name || '').toLowerCase();
    const jobTitle = (user.employeeProfile?.jobTitle || '').toLowerCase();
    const query = searchTerm.toLowerCase();

    const matchesSearch = 
      fullName.includes(query) || 
      email.includes(query) || 
      roleName.includes(query) ||
      deptName.includes(query) ||
      jobTitle.includes(query);
    
    if (statusFilter === 'ACTIVE') return matchesSearch && user.isActive;
    if (statusFilter === 'INACTIVE') return matchesSearch && !user.isActive;
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredUsers.length / limit);
  const paginatedUsers = filteredUsers.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Console de gestion du personnel</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configurez l'accès au système, attribuez des rôles et auditez les permissions.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-semibold active:scale-[0.98] transition-all"
          >
            <Download size={16} />
            Exporter CSV
          </button>
          {hasPermission('users:create') && (
            <button
              onClick={openCreateDialog}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-500/15 active:scale-[0.98] transition-all"
            >
              <Plus size={16} />
              Enregistrer un nouveau personnel
            </button>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        {/* Search bar */}
        <div className="w-full md:flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Rechercher par nom, email, rôle, département ou poste..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 glass-input text-xs border-white/10"
          />
        </div>

        {/* Archived checkbox */}
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
            className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0"
          />
          Afficher Archivés
        </label>

        {/* Status filters */}
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shrink-0 w-full md:w-auto">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => { setStatusFilter(filter); setPage(1); }}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                statusFilter === filter
                  ? 'bg-indigo-500 text-white shadow'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {filter === 'ALL' ? 'TOUS' : filter === 'ACTIVE' ? 'ACTIFS' : 'INACTIFS'}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
        {isUsersLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-indigo-400" size={32} />
            <p className="text-xs text-muted-foreground">Chargement des bases de données du registre...</p>
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p className="text-sm font-semibold">Aucun membre du personnel enregistré trouvé</p>
            <p className="text-xs mt-1">Essayez d'ajuster vos critères de recherche.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-muted-foreground tracking-wider bg-white/[0.01]">
                  <th className="px-6 py-4 w-12">Photo</th>
                  <th className="px-6 py-4">Nom Complet</th>
                  <th className="px-6 py-4">Adresse Email</th>
                  <th className="px-6 py-4">Rôle</th>
                  <th className="px-6 py-4">Département</th>
                  <th className="px-6 py-4">Créé le</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-200">
                {paginatedUsers.map((u) => {
                  const fullName = `${u.firstName} ${u.lastName}`;
                  const deptName = u.employeeProfile?.department?.name || '—';
                  const createdDate = new Date(u.createdAt).toLocaleDateString('fr-FR');

                  return (
                    <tr key={u.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-3">
                        <UserAvatar name={fullName} avatarUrl={u.avatarUrl} />
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {fullName}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {u.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase">
                          {u.role.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {deptName}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {createdDate}
                      </td>
                      <td className="px-6 py-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Suspendu
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5">
                        {showArchived || (u as any).isArchived ? (
                          <button
                            onClick={() => handleRestore(u.id, fullName)}
                            className="p-1.5 rounded-lg border border-white/5 hover:border-emerald-500/20 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all inline-flex items-center gap-1 text-[11px]"
                            title="Restaurer"
                          >
                            <RotateCcw size={13} /> Restaurer
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openViewDialog(u)}
                              className="p-1.5 rounded-lg border border-white/5 hover:border-white/20 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                              title="Fiche du Personnel"
                            >
                              <Eye size={13} />
                            </button>
                            {hasPermission('users:update') && (
                              <button
                                onClick={() => openEditDialog(u)}
                                className="p-1.5 rounded-lg border border-white/5 hover:border-white/20 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                                title="Modifier le Profil"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            {hasPermission('users:delete') && (
                              <button
                                onClick={() => handleDelete(u.id, fullName)}
                                className="p-1.5 rounded-lg border border-white/5 hover:border-red-500/20 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="Archiver l'Utilisateur"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={filteredUsers.length} limit={limit} onPageChange={setPage} />
      )}

      {/* Render edit/create dialog modal */}
      <UserDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        userToEdit={selectedUser}
        roles={roles}
        departments={departments}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />

      {/* Render details dialog modal */}
      <UserDetailsDialog
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        user={viewedUser}
      />
    </div>
  );
};
