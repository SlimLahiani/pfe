import React, { useState } from 'react';
import { useEmployees, type Employee } from '../../../hooks/use-api';
import { PageHeader } from '../../../components/shared/ui';
import { Network, Mail, Phone, Briefcase, MapPin } from 'lucide-react';

interface ChartNode {
  employee: Employee;
  manager?: Employee;
  subordinates: ChartNode[];
}

export const OrgChartPage: React.FC = () => {
  const { data, isLoading } = useEmployees({ limit: 100 });
  const [selectedNode, setSelectedNode] = useState<Employee | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Organigramme" description="Visualisation de la structure hiérarchique de l'agence" />
        <div className="h-96 rounded-2xl glass-panel animate-pulse flex items-center justify-center">
          <div className="text-xs text-muted-foreground">Chargement de la structure...</div>
        </div>
      </div>
    );
  }

  const employees = data?.data ?? [];

  // 1. Identify CEO (Root Node)
  // We look for job title containing 'Directeur Général' or 'Gérant', or role 'GERANT'
  const ceo = employees.find(
    (e) =>
      e.jobTitle?.toLowerCase().includes('général') ||
      e.jobTitle?.toLowerCase().includes('gerant') ||
      e.user?.email.startsWith('ceo')
  ) || employees[0];

  if (!ceo) {
    return (
      <div className="space-y-6">
        <PageHeader title="Organigramme" description="Visualisation de la structure hiérarchique de l'agence" />
        <div className="h-96 rounded-2xl glass-panel flex items-center justify-center text-center">
          <p className="text-sm text-gray-400">Aucun collaborateur trouvé pour générer l'organigramme.</p>
        </div>
      </div>
    );
  }

  // 2. Identify Department Managers
  // Managers are defined as profiles in a department having a senior title like "Directeur", "Responsable", or "Principal"
  // and who are NOT the CEO.
  const isManager = (emp: Employee) => {
    if (emp.id === ceo.id) return false;
    const title = emp.jobTitle?.toLowerCase() ?? '';
    return (
      title.includes('directeur') ||
      title.includes('responsable') ||
      title.includes('principal') ||
      title.includes('lead')
    );
  };

  const managers = employees.filter(isManager);

  // 3. Subordinates
  // For each manager, subordinates are employees in the same department who are NOT managers themselves.
  // For the CEO, subordinates are all Department Managers.
  const getSubordinates = (manager: Employee): Employee[] => {
    if (manager.id === ceo.id) {
      return managers;
    }
    if (!isManager(manager)) {
      return [];
    }
    // Return staff in the manager's department
    return employees.filter(
      (e) => e.departmentId === manager.departmentId && e.id !== manager.id && !isManager(e) && e.id !== ceo.id
    );
  };

  // Build tree structure
  const buildTree = (emp: Employee, parent?: Employee): ChartNode => {
    const subordinates = getSubordinates(emp);
    return {
      employee: emp,
      manager: parent,
      subordinates: subordinates.map((sub) => buildTree(sub, emp)),
    };
  };

  const tree = buildTree(ceo);

  const getDeptColor = (deptName?: string) => {
    const name = deptName?.toLowerCase() ?? '';
    if (name.includes('management') || name.includes('dir')) return 'from-rose-500/20 to-rose-600/20 text-rose-300 border-rose-500/30';
    if (name.includes('creative') || name.includes('design')) return 'from-purple-500/20 to-purple-600/20 text-purple-300 border-purple-500/30';
    if (name.includes('marketing') || name.includes('seo')) return 'from-cyan-500/20 to-cyan-600/20 text-cyan-300 border-cyan-500/30';
    if (name.includes('development') || name.includes('eng')) return 'from-indigo-500/20 to-indigo-600/20 text-indigo-300 border-indigo-500/30';
    if (name.includes('finance') || name.includes('ops')) return 'from-amber-500/20 to-amber-600/20 text-amber-300 border-amber-500/30';
    if (name.includes('resource') || name.includes('rh')) return 'from-pink-500/20 to-pink-600/20 text-pink-300 border-pink-500/30';
    return 'from-gray-500/20 to-gray-600/20 text-gray-300 border-gray-500/30';
  };

  const renderCard = (emp: Employee, size: 'large' | 'medium' | 'small' = 'medium') => {
    const colorStyle = getDeptColor(emp.department?.name);
    const initials = `${emp.user?.firstName[0]}${emp.user?.lastName[0]}`;

    return (
      <div
        onClick={() => setSelectedNode(emp)}
        className={`glass-panel bg-gradient-to-br border hover:scale-105 hover:shadow-xl hover:shadow-black/30 cursor-pointer transition-all duration-300 p-4 text-center rounded-2xl flex flex-col items-center justify-between w-56 select-none ${colorStyle}`}
      >
        <div className="relative mb-2">
          {emp.user?.avatarUrl ? (
            <img
              src={emp.user.avatarUrl}
              alt={`${emp.user.firstName} ${emp.user.lastName}`}
              className="w-12 h-12 rounded-full border-2 border-white/10 object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm">
              {initials}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-background bg-emerald-500" />
        </div>

        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-white truncate max-w-[190px]">
            {emp.user?.firstName} {emp.user?.lastName}
          </h4>
          <p className="text-[10px] text-gray-300 font-semibold truncate max-w-[190px]">
            {emp.jobTitle}
          </p>
          <span className="inline-block px-2 py-0.5 rounded-full text-[8px] font-bold bg-white/5 border border-white/5 mt-1 uppercase tracking-wide">
            {emp.department?.name ?? 'Non assigné'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organigramme"
        description="Visualisation structurelle et annuaire opérationnel des équipes"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Visual Tree */}
        <div className="lg:col-span-3 glass-panel p-6 rounded-2xl border border-white/10 overflow-x-auto min-h-[550px] flex flex-col items-center relative">
          
          <div className="absolute top-4 left-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Network size={14} className="text-indigo-400" />
            <span>Vue Hiérarchique de l'Agence</span>
          </div>

          <div className="flex flex-col items-center gap-12 mt-8 min-w-[800px]">
            
            {/* Level 1: CEO */}
            <div className="relative">
              {renderCard(tree.employee, 'large')}
              {/* Connector down to Managers */}
              {tree.subordinates.length > 0 && (
                <div className="absolute left-1/2 bottom-[-48px] w-0.5 h-12 bg-white/10 -translate-x-1/2" />
              )}
            </div>

            {/* Level 2: Managers */}
            <div className="relative flex justify-center gap-8 pt-4">
              
              {/* Horizontal connecting line over all managers */}
              {tree.subordinates.length > 1 && (
                <div className="absolute top-0 left-[12%] right-[12%] h-0.5 bg-white/10" />
              )}

              {tree.subordinates.map((managerNode, idx) => (
                <div key={managerNode.employee.id} className="relative flex flex-col items-center gap-8">
                  {/* Verticals from horizontal bar down to each manager */}
                  <div className="absolute top-[-16px] w-0.5 h-4 bg-white/10" />

                  {/* Render Manager Card */}
                  {renderCard(managerNode.employee)}

                  {/* Connector down to Staff */}
                  {managerNode.subordinates.length > 0 && (
                    <div className="absolute bottom-[-32px] w-0.5 h-8 bg-white/10" />
                  )}

                  {/* Level 3: Staff/Subordinates */}
                  {managerNode.subordinates.length > 0 && (
                    <div className="flex flex-col gap-3 pt-4 relative">
                      {managerNode.subordinates.map((staffNode) => (
                        <div key={staffNode.employee.id} className="flex flex-col items-center relative">
                          {renderCard(staffNode.employee, 'small')}
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              ))}
            </div>

          </div>

        </div>

        {/* Sidebar Info Panel */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 h-fit space-y-6">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-white/5">
                <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 mx-auto flex items-center justify-center font-bold text-xl text-indigo-300 mb-3">
                  {selectedNode.user?.firstName[0]}{selectedNode.user?.lastName[0]}
                </div>
                <h3 className="text-sm font-bold text-white">
                  {selectedNode.user?.firstName} {selectedNode.user?.lastName}
                </h3>
                <p className="text-xs text-indigo-400 font-semibold">{selectedNode.jobTitle}</p>
                <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-white/5 text-gray-300 border border-white/5">
                  {selectedNode.employeeCode}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs">
                  <Briefcase size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Département</p>
                    <p className="text-white font-medium">{selectedNode.department?.name ?? 'Non défini'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-xs">
                  <Mail size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Email</p>
                    <p className="text-white font-medium truncate max-w-[180px]">{selectedNode.user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <Phone size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Téléphone</p>
                    <p className="text-white font-medium">{selectedNode.phone ?? 'Non spécifié'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <MapPin size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Adresse</p>
                    <p className="text-white font-medium line-clamp-1">{selectedNode.address ?? 'Non spécifié'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Score Performance</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${selectedNode.performanceScore}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-bold text-white">{selectedNode.performanceScore}%</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedNode(null)}
                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white rounded-xl transition-all"
              >
                Fermer la fiche
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Network size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-xs font-semibold text-gray-300">Fiche Collaborateur</p>
              <p className="text-[10px] mt-1 max-w-[180px]">
                Cliquez sur une carte de l'organigramme pour afficher le détail de la fiche contact.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
