import React from 'react';
import { Briefcase, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export const CampaignsPage: React.FC = () => {
  const mockCampaigns = [
    { id: 1, name: 'Cyberpunk Sneaker Launch', client: 'Aero Apparel', status: 'Active', progress: 75 },
    { id: 2, name: 'SaaS Automation Campaign', client: 'FlowStack', status: 'Review', progress: 95 },
    { id: 3, name: 'Sustainable Soda Launch', client: 'GreenBubbles', status: 'Planning', progress: 15 },
  ];

  const statusLabelMap: Record<string, string> = {
    Active: 'Actif',
    Review: 'Revue',
    Planning: 'Planification',
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white">Campagnes Actives de l'Agence</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Aperçu des campagnes marketing des clients et des jalons créatifs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mockCampaigns.map((camp) => (
          <div key={camp.id} className="glass-card rounded-2xl p-6 flex flex-col justify-between min-h-[180px]">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                  <Briefcase size={12} />
                  {camp.client}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  camp.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                  camp.status === 'Review' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' :
                  'bg-white/5 text-muted-foreground border border-white/5'
                }`}>
                  {camp.status === 'Active' && <CheckCircle2 size={10} />}
                  {camp.status === 'Review' && <Clock size={10} />}
                  {camp.status === 'Planning' && <AlertCircle size={10} />}
                  {statusLabelMap[camp.status] ?? camp.status}
                </span>
              </div>
              <h4 className="text-base font-bold text-white mb-4">{camp.name}</h4>
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-medium">
                <span>Progression de la phase</span>
                <span>{camp.progress}%</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${camp.progress}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
