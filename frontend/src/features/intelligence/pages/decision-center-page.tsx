import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Check,
  X,
  FileCheck,
  DollarSign,
  AlertTriangle,
  Lightbulb,
  Calendar,
  Layers,
  Clock,
} from 'lucide-react';
import { PageHeader } from '../../../components/shared/ui';
import { api } from '../../../lib/api';

interface Recommendation {
  decision: 'APPROVE' | 'WARN' | 'REJECT';
  reason: string;
  warningLevel: 'success' | 'warning' | 'danger';
}

interface LeaveRequestDecision {
  id: string;
  employeeName: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  currentBalance: number;
  recommendation: Recommendation;
}

interface QuoteDecision {
  id: string;
  reference: string;
  clientName: string;
  projectName: string;
  validUntil: string;
  total: number;
  avgDiscount: number;
  estimatedMargin: number;
  recommendation: Recommendation;
}

interface InvoiceDecision {
  id: string;
  reference: string;
  clientName: string;
  dueDate: string;
  total: number;
  overdueCount: number;
  recommendation: Recommendation;
}

interface DecisionCenterData {
  leaveRequests: LeaveRequestDecision[];
  quotes: QuoteDecision[];
  invoices: InvoiceDecision[];
}

export const DecisionCenterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leaves' | 'quotes' | 'invoices'>('leaves');
  const [data, setData] = useState<DecisionCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; type: 'quote' | 'invoice' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/intelligence/decision-center');
      setData(res.data);
    } catch (e) {
      console.error('Error fetching decision center data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApproveLeave = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/hr/leave-requests/${id}/review`, { status: 'APPROVED', reviewNote: 'Approuvé via le Centre de Décision IA.' });
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectLeave = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/hr/leave-requests/${id}/review`, { status: 'REJECTED', reviewNote: 'Rejeté via le Centre de Décision IA.' });
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveQuote = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/finance/quotes/${id}/approve`);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectQuote = async (id: string, reason: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/finance/quotes/${id}/reject`, { reason });
      setRejectDialog(null);
      setRejectReason('');
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveInvoice = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/finance/invoices/${id}/approve`);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectInvoice = async (id: string, reason: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/finance/invoices/${id}/reject`, { reason });
      setRejectDialog(null);
      setRejectReason('');
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const getRecBg = (level: string) => {
    if (level === 'danger') return 'bg-red-500/5 border-red-500/20 text-red-400';
    if (level === 'warning') return 'bg-amber-500/5 border-amber-500/20 text-amber-400';
    return 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400';
  };

  const getDecisionBadge = (level: string, decision: string) => {
    const base = 'px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border uppercase';
    if (level === 'danger') return `${base} bg-red-500/10 border-red-500/20 text-red-400`;
    if (level === 'warning') return `${base} bg-amber-500/10 border-amber-500/20 text-amber-400`;
    return `${base} bg-emerald-500/10 border-emerald-500/20 text-emerald-400`;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground animate-pulse font-medium">Chargement des données de décision...</p>
        </div>
      </div>
    );
  }

  const leavesCount = data?.leaveRequests?.length || 0;
  const quotesCount = data?.quotes?.length || 0;
  const invoicesCount = data?.invoices?.length || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centre de Décision Executive"
        description="Pôle d'approbation centralisé enrichi par l'intelligence analytique de CREATIVART pour simplifier les workflows."
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => setActiveTab('leaves')}
          className={`glass-card rounded-2xl p-6 text-left transition-all duration-300 border ${
            activeTab === 'leaves' ? 'border-indigo-500 bg-indigo-500/5 shadow-indigo-500/5' : 'border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            <div className={`p-3 rounded-xl ${activeTab === 'leaves' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-gray-400'}`}>
              <CalendarClock size={24} />
            </div>
            {leavesCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {leavesCount} en attente
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Demandes de Congé</p>
          <h3 className="text-2xl font-bold text-white mt-1">Congés & Absences</h3>
        </button>

        <button
          onClick={() => setActiveTab('quotes')}
          className={`glass-card rounded-2xl p-6 text-left transition-all duration-300 border ${
            activeTab === 'quotes' ? 'border-indigo-500 bg-indigo-500/5 shadow-indigo-500/5' : 'border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            <div className={`p-3 rounded-xl ${activeTab === 'quotes' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-gray-400'}`}>
              <FileCheck size={24} />
            </div>
            {quotesCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {quotesCount} en attente
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Validation de Devis</p>
          <h3 className="text-2xl font-bold text-white mt-1">Devis & Propositions</h3>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`glass-card rounded-2xl p-6 text-left transition-all duration-300 border ${
            activeTab === 'invoices' ? 'border-indigo-500 bg-indigo-500/5 shadow-indigo-500/5' : 'border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            <div className={`p-3 rounded-xl ${activeTab === 'invoices' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-gray-400'}`}>
              <DollarSign size={24} />
            </div>
            {invoicesCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {invoicesCount} en attente
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Validation Factures</p>
          <h3 className="text-2xl font-bold text-white mt-1">Facturation & Flux</h3>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="glass-card rounded-2xl p-6 min-h-[400px]">
        {/* Tab 1: Leaves */}
        {activeTab === 'leaves' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-white">Demandes de Congé en attente</h4>
              <span className="text-xs text-muted-foreground">{leavesCount} demande(s) trouvée(s)</span>
            </div>

            {leavesCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-muted-foreground mb-4">
                  <Check size={24} />
                </div>
                <p className="text-white font-medium">Toutes les demandes ont été traitées !</p>
                <p className="text-xs text-muted-foreground mt-1">Aucune demande de congé en attente d'approbation.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data?.leaveRequests.map((request) => (
                  <div key={request.id} className="border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all bg-white/[0.01]">
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                      {/* Left Block: Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-white text-base">{request.employeeName}</span>
                          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase font-mono">
                            {request.department}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Layers size={14} className="text-indigo-400" />
                            <span>Type : <strong className="text-gray-200">{request.leaveType}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-indigo-400" />
                            <span>Période : <strong className="text-gray-200">{new Date(request.startDate).toLocaleDateString('fr-FR')} au {new Date(request.endDate).toLocaleDateString('fr-FR')}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock size={14} className="text-indigo-400" />
                            <span>Durée : <strong className="text-gray-200">{request.days} jours</strong></span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 italic mt-2 bg-white/5 p-2.5 rounded-lg border border-white/5">
                          &ldquo; {request.reason} &rdquo;
                        </p>
                      </div>

                      {/* Right Block: Recommendation & Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col justify-between items-end gap-4 min-w-[280px]">
                        {/* IA Box */}
                        <div className={`w-full border rounded-xl p-3.5 flex gap-3 items-start ${getRecBg(request.recommendation.warningLevel)}`}>
                          <Lightbulb className="shrink-0 mt-0.5" size={16} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider">Conseil IA</span>
                              <span className={getDecisionBadge(request.recommendation.warningLevel, request.recommendation.decision)}>
                                {request.recommendation.decision}
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed font-medium">{request.recommendation.reason}</p>
                          </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2 w-full justify-end">
                          <button
                            onClick={() => handleRejectLeave(request.id)}
                            disabled={actionLoading === request.id}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-xs py-2 px-4 rounded-xl border border-red-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <X size={14} /> Refuser
                          </button>
                          <button
                            onClick={() => handleApproveLeave(request.id)}
                            disabled={actionLoading === request.id}
                            className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold text-xs py-2 px-4 rounded-xl border border-emerald-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-emerald-500/5"
                          >
                            <Check size={14} /> Approuver
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Quotes */}
        {activeTab === 'quotes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-white">Devis en attente d'approbation</h4>
              <span className="text-xs text-muted-foreground">{quotesCount} devis en attente</span>
            </div>

            {quotesCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-muted-foreground mb-4">
                  <Check size={24} />
                </div>
                <p className="text-white font-medium">Tous les devis ont été validés !</p>
                <p className="text-xs text-muted-foreground mt-1">Aucune proposition commerciale en attente.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data?.quotes.map((quote) => (
                  <div key={quote.id} className="border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all bg-white/[0.01]">
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                      {/* Left Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-indigo-400 font-mono text-sm">{quote.reference}</span>
                          <span className="font-semibold text-white text-base">{quote.clientName}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          <div>Projet : <strong className="text-gray-200">{quote.projectName}</strong></div>
                          <div>Montant : <strong className="text-indigo-300 font-bold">{quote.total.toLocaleString()} TND</strong> <span className="text-[10px] text-gray-500">(19% TVA incl.)</span></div>
                          <div>Valide jusqu'au : <strong className="text-gray-200">{new Date(quote.validUntil).toLocaleDateString('fr-FR')}</strong></div>
                          <div>Marge brute : <strong className="text-emerald-400 font-mono">{quote.estimatedMargin.toFixed(1)}%</strong></div>
                        </div>
                      </div>

                      {/* Right IA Recommendation & Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col justify-between items-end gap-4 min-w-[320px]">
                        {/* IA Box */}
                        <div className={`w-full border rounded-xl p-3.5 flex gap-3 items-start ${getRecBg(quote.recommendation.warningLevel)}`}>
                          <Lightbulb className="shrink-0 mt-0.5" size={16} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider">Conseil IA</span>
                              <span className={getDecisionBadge(quote.recommendation.warningLevel, quote.recommendation.decision)}>
                                {quote.recommendation.decision}
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed font-medium">{quote.recommendation.reason}</p>
                          </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2 w-full justify-end">
                          <button
                            onClick={() => setRejectDialog({ id: quote.id, type: 'quote' })}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-xs py-2 px-4 rounded-xl border border-red-500/20 transition-all flex items-center gap-1.5"
                          >
                            <X size={14} /> Rejeter
                          </button>
                          <button
                            onClick={() => handleApproveQuote(quote.id)}
                            disabled={actionLoading === quote.id}
                            className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold text-xs py-2 px-4 rounded-xl border border-emerald-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-emerald-500/5"
                          >
                            <Check size={14} /> Valider
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Invoices */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-white">Factures en attente d'approbation</h4>
              <span className="text-xs text-muted-foreground">{invoicesCount} facture(s) en attente</span>
            </div>

            {invoicesCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-muted-foreground mb-4">
                  <Check size={24} />
                </div>
                <p className="text-white font-medium">Toutes les factures ont été approuvées !</p>
                <p className="text-xs text-muted-foreground mt-1">Aucune facture en attente de validation.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data?.invoices.map((invoice) => (
                  <div key={invoice.id} className="border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all bg-white/[0.01]">
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                      {/* Left Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-indigo-400 font-mono text-sm">{invoice.reference}</span>
                          <span className="font-semibold text-white text-base">{invoice.clientName}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          <div>Montant Total : <strong className="text-indigo-300 font-bold">{invoice.total.toLocaleString()} TND</strong></div>
                          <div>Échéance : <strong className="text-gray-200">{new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</strong></div>
                          <div>Retards de paiement historiques :{' '}
                            {invoice.overdueCount > 0 ? (
                              <span className="text-red-400 font-bold font-mono">{invoice.overdueCount} facture(s)</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold">Aucun retard</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right IA Recommendation & Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col justify-between items-end gap-4 min-w-[320px]">
                        {/* IA Box */}
                        <div className={`w-full border rounded-xl p-3.5 flex gap-3 items-start ${getRecBg(invoice.recommendation.warningLevel)}`}>
                          <Lightbulb className="shrink-0 mt-0.5" size={16} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider">Conseil IA</span>
                              <span className={getDecisionBadge(invoice.recommendation.warningLevel, invoice.recommendation.decision)}>
                                {invoice.recommendation.decision}
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed font-medium">{invoice.recommendation.reason}</p>
                          </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2 w-full justify-end">
                          <button
                            onClick={() => setRejectDialog({ id: invoice.id, type: 'invoice' })}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-xs py-2 px-4 rounded-xl border border-red-500/20 transition-all flex items-center gap-1.5"
                          >
                            <X size={14} /> Rejeter
                          </button>
                          <button
                            onClick={() => handleApproveInvoice(invoice.id)}
                            disabled={actionLoading === invoice.id}
                            className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold text-xs py-2 px-4 rounded-xl border border-emerald-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-emerald-500/5"
                          >
                            <Check size={14} /> Valider
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 border-red-500/20 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold text-white">Motif de Rejet</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Veuillez saisir la raison pour laquelle vous rejetez cette pièce commerciale. Elle sera notifiée à l'émetteur.
            </p>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none mb-6 placeholder-gray-500"
              placeholder="Ex: Marge brute insuffisante ou conditions de paiement non conformes..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRejectDialog(null); setRejectReason(''); }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs py-2 px-4 rounded-xl transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (rejectDialog.type === 'quote') {
                    handleRejectQuote(rejectDialog.id, rejectReason);
                  } else {
                    handleRejectInvoice(rejectDialog.id, rejectReason);
                  }
                }}
                disabled={!rejectReason.trim()}
                className="bg-red-500/20 hover:bg-red-500/35 border border-red-500/30 text-red-400 font-semibold text-xs py-2 px-4 rounded-xl transition-all disabled:opacity-50"
              >
                Confirmer le Rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
