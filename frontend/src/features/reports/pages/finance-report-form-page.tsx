import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  useReport,
  useCreateReport,
  useUpdateReport,
  useSubmitReport,
  useReportData,
} from '../../../hooks/use-api';
import { useAuth } from '../../../context/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinanceNotes {
  financialAnalysis: string;
  budgetIssues: string;
  risks: string;
  recommendations: string;
  plannedActions: string;
  generalObservations: string;
}

// ─── Helper Components ────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Brouillon', color: '#6B7280' },
    SUBMITTED: { label: 'En révision', color: '#F59E0B' },
    APPROVED: { label: 'Approuvé', color: '#10B981' },
    REJECTED: { label: 'Rejeté', color: '#EF4444' },
  };
  const c = config[status] || { label: status, color: '#6B7280' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
      borderRadius: 9999, fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
      background: c.color + '22', color: c.color, border: `1.5px solid ${c.color}44`,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
      {c.label.toUpperCase()}
    </span>
  );
};

const NoteField = ({
  label, icon, placeholder, value, onChange, disabled,
}: {
  label: string; icon?: string; placeholder: string;
  value: string; onChange: (v: string) => void; disabled?: boolean;
}) => (
  <div style={{ marginBottom: 20 }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#E5E7EB', marginBottom: 8 }}>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      {label}
    </label>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={4}
      style={{
        width: '100%', padding: '12px 14px', borderRadius: 10,
        background: disabled ? '#0d1117' : '#161b22', border: '1.5px solid #30363d',
        color: disabled ? '#6B7280' : '#E5E7EB', fontSize: 13, lineHeight: 1.6,
        resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
      onFocus={e => { if (!disabled) e.target.style.borderColor = '#10B981'; }}
      onBlur={e => { e.target.style.borderColor = '#30363d'; }}
    />
  </div>
);

const KpiCard = ({ label, value, color, icon, sub }: {
  label: string; value: string | number; color?: string; icon?: string; sub?: string;
}) => (
  <div style={{
    background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
    border: '1px solid #30363d', borderRadius: 12, padding: '16px 18px',
    display: 'flex', flexDirection: 'column', gap: 6,
    borderLeft: `3px solid ${color || '#10B981'}`,
  }}>
    {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
    <div style={{ fontSize: 20, fontWeight: 800, color: color || '#34D399' }}>{value}</div>
    <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, lineHeight: 1.3 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: '#4B5563' }}>{sub}</div>}
  </div>
);

const formatTND = (v: number) => {
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency',
    currency: 'TND',
  }).format(Number(v) || 0);
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const FinanceReportFormPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: reportId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isEditing = !!reportId;

  const { data: existingReport, isLoading: reportLoading } = useReport(reportId);
  const { data: dynamicData, isLoading: dynamicLoading } = useReportData(reportId);
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  const submitReport = useSubmitReport();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(lastOfMonth);
  const [reportName, setReportName] = useState(`Rapport Financier — ${today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`);
  const [finData, setFinData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [notes, setNotes] = useState<FinanceNotes>({
    financialAnalysis: '',
    budgetIssues: '',
    risks: '',
    recommendations: '',
    plannedActions: '',
    generalObservations: '',
  });

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (existingReport) {
      setReportName(existingReport.name || existingReport.title || reportName);
      if (existingReport.periodStart) setPeriodStart(existingReport.periodStart.split('T')[0]);
      if (existingReport.periodEnd) setPeriodEnd(existingReport.periodEnd.split('T')[0]);
      if (existingReport.notes) setNotes(existingReport.notes as FinanceNotes);
      setSavedReportId(existingReport.id);
    }
  }, [existingReport]);

  useEffect(() => {
    if (dynamicData) {
      setFinData(dynamicData.data);
    } else if (existingReport?.data) {
      setFinData(existingReport.data);
    }
  }, [dynamicData, existingReport]);

  const workflowStatus = existingReport?.workflowStatus || 'DRAFT';
  const isLocked = workflowStatus !== 'DRAFT';
  const activeId = savedReportId || reportId;

  // Autosave Draft
  useEffect(() => {
    if (!isLocked && activeId) {
      autosaveTimer.current = setInterval(() => {
        handleSaveDraft(true);
      }, 30000);
      return () => clearInterval(autosaveTimer.current!);
    }
  }, [isLocked, activeId, notes, reportName, periodStart, periodEnd]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleReturnToDraft = async () => {
    if (!activeId) return;
    try {
      showToast('Retour au statut DRAFT...', 'info');
      await api.post(`/reports/${activeId}/return-to-draft`);
      queryClient.invalidateQueries({ queryKey: ['report', activeId] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      showToast('Le rapport est à nouveau modifiable', 'success');
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Erreur', 'error');
    }
  };

  const handleSaveDraft = async (isAuto = false, idOverride?: string) => {
    if (isLocked && !isAuto) return;
    setSaving(true);
    try {
      const currentId = idOverride || activeId;
      const payload: any = {
        notes,
        periodStart,
        periodEnd,
        title: reportName,
        data: finData,
      };

      if (currentId) {
        await updateReport.mutateAsync({ id: currentId, data: { ...payload, name: reportName } });
      } else {
        const newReport = await createReport.mutateAsync({
          name: reportName,
          type: 'FINANCIAL',
          ...payload,
        });
        setSavedReportId(newReport.id);
        navigate(`/reports/${newReport.id}/edit`, { replace: true });
      }
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (!isAuto) showToast('Brouillon sauvegardé.', 'success');
    } catch {
      if (!isAuto) showToast('Erreur lors de la sauvegarde.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const currentId = activeId;
      if (!currentId) {
        showToast('Sauvegardez d\'abord le rapport.', 'error');
        setSubmitting(false);
        return;
      }
      await handleSaveDraft(false, currentId);
      await submitReport.mutateAsync(currentId);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      showToast('Rapport soumis au directeur !', 'success');
      setTimeout(() => navigate('/reports'), 1500);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Erreur lors de la soumission.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (reportLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#6B7280' }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px', fontFamily: '"Inter", system-ui, sans-serif' }}>
      
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13,
          background: toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#4F46E5',
          color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', animation: 'slideIn 0.3s ease',
        }}>
          {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => navigate('/reports')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 16, padding: 0 }}>
          ← Retour aux rapports
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#F9FAFB' }}>
              {isEditing ? 'Modifier le Rapport Financier' : 'Nouveau Rapport Financier'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
              Rédigé par <strong style={{ color: '#9CA3AF' }}>{user?.firstName} {user?.lastName}</strong>
            </p>
          </div>
          <StatusBadge status={workflowStatus} />
        </div>
      </div>

      {/* KPI Display */}
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        {finData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <KpiCard label="Revenu Total" value={formatTND(finData.totalRevenue)} icon="💰" color="#10B981" />
              <KpiCard label="Dépenses" value={formatTND(finData.totalExpenses)} icon="📉" color="#EF4444" />
              <KpiCard label="Profit Net" value={formatTND(finData.profit)} icon="📊" color="#3B82F6" />
              <KpiCard label="Marge Brute" value={`${finData.margin}%`} icon="📈" color="#8B5CF6" />
              <KpiCard label="Impayés" value={formatTND(finData.outstandingCash)} icon="⚠️" color="#F59E0B" />
              <KpiCard label="Devis Acceptés" value={`${finData.acceptedQuotes} / ${finData.totalQuotes}`} icon="📝" color="#14B8A6" />
              <KpiCard label="Factures Réglées" value={`${finData.paidInvoicesCount} / ${finData.paidInvoicesCount + finData.unpaidInvoicesCount}`} icon="✅" color="#EC4899" />
            </div>
          </div>
        ) : (
          <div style={{ color: '#6B7280', textAlign: 'center', padding: '40px 0' }}>
            {dynamicLoading ? 'Chargement des statistiques en cours...' : 'Veuillez enregistrer ce brouillon pour générer les statistiques.'}
          </div>
        )}
      </div>

      {/* Form Fields */}
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <input value={reportName} onChange={e => setReportName(e.target.value)} disabled={isLocked}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#161b22', border: '1.5px solid #30363d', color: '#F9FAFB', fontSize: 15, fontWeight: 700, marginBottom: 20 }} />
        
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Date de début</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} disabled={isLocked}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#161b22', border: '1.5px solid #30363d', color: '#E5E7EB', fontSize: 13 }} />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Date de fin</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} disabled={isLocked}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#161b22', border: '1.5px solid #30363d', color: '#E5E7EB', fontSize: 13 }} />
          </div>
        </div>
      </div>

      {/* KPI Statistics panel */}
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        {finData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <KpiCard label="Revenu Total" value={formatTND(finData.totalRevenue)} icon="💰" color="#10B981" />
              <KpiCard label="Dépenses Total" value={formatTND(finData.totalExpenses)} icon="💸" color="#EF4444" />
              <KpiCard label="Bénéfice Net" value={formatTND(finData.profit)} icon="📈" color="#3B82F6" />
              <KpiCard label="Marge Brute" value={`${finData.margin}%`} icon="📊" color="#8B5CF6" />
              <KpiCard label="Impayés (En attente)" value={formatTND(finData.outstandingCash)} icon="⚠️" color="#F59E0B" />
              <KpiCard label="Devis Acceptés" value={`${finData.acceptedQuotes} / ${finData.totalQuotes}`} icon="📝" color="#EC4899" />
              <KpiCard label="Factures Impayées" value={`${finData.unpaidInvoicesCount} (sur ${finData.paidInvoicesCount + finData.unpaidInvoicesCount})`} icon="⏳" color="#F43F5E" />
            </div>
          </div>
        ) : (
          <div style={{ color: '#6B7280', textAlign: 'center', padding: '40px 0' }}>
            {dynamicLoading ? 'Chargement des statistiques en cours...' : 'Veuillez enregistrer ce brouillon pour générer les statistiques.'}
          </div>
        )}
      </div>

      {/* Manager Notes */}
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#E5E7EB', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}></span> Notes du Manager Financier
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: '#6B7280' }}>
          {isLocked ? 'Lecture seule — le rapport est déjà soumis.' : 'Ces notes seront incluses dans le rapport soumis au directeur.'}
        </p>

        <NoteField label="Analyse Financière" placeholder="Commentez les résultats financiers de la période..."
          value={notes.financialAnalysis} onChange={v => setNotes(n => ({ ...n, financialAnalysis: v }))} disabled={isLocked} />
        <NoteField label="Problèmes Budgétaires" icon="️" placeholder="Dépassements budgétaires, anomalies, écarts détectés..."
          value={notes.budgetIssues} onChange={v => setNotes(n => ({ ...n, budgetIssues: v }))} disabled={isLocked} />
        <NoteField label="Risques Financiers" placeholder="Risques de trésorerie, de créances impayées, d'insolvabilité..."
          value={notes.risks} onChange={v => setNotes(n => ({ ...n, risks: v }))} disabled={isLocked} />
        <NoteField label="Recommandations" placeholder="Recommandations pour optimiser la performance financière..."
          value={notes.recommendations} onChange={v => setNotes(n => ({ ...n, recommendations: v }))} disabled={isLocked} />
        <NoteField label="Actions Planifiées" placeholder="Actions à entreprendre pour le prochain trimestre..."
          value={notes.plannedActions} onChange={v => setNotes(n => ({ ...n, plannedActions: v }))} disabled={isLocked} />
        <NoteField label="Observations Générales" placeholder="Toute autre observation ou commentaire pertinent..."
          value={notes.generalObservations} onChange={v => setNotes(n => ({ ...n, generalObservations: v }))} disabled={isLocked} />
      </div>

      {/* Actions */}
      {!isLocked && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => navigate('/reports')} style={{ padding: '10px 20px', borderRadius: 10, background: '#161b22', border: '1px solid #30363d', color: '#9CA3AF', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Annuler</button>
          <button onClick={() => handleSaveDraft()} disabled={saving} style={{ padding: '10px 20px', borderRadius: 10, background: '#374151', border: 'none', color: '#F9FAFB', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving ? <><span className="spinner-sm" />Sauvegarde...</> : ' Sauvegarder'}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !finData} style={{
            padding: '10px 24px', borderRadius: 10,
            background: (submitting || !finData) ? '#374151' : 'linear-gradient(135deg, #059669, #10B981)',
            border: 'none', color: '#fff', cursor: (submitting || !finData) ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: (!submitting && finData) ? '0 4px 16px rgba(16,185,129,0.4)' : 'none',
          }}>
            {submitting ? <><span className="spinner-sm" />Soumission...</> : ' Soumettre au Directeur'}
          </button>
        </div>
      )}

      {isLocked && workflowStatus === 'SUBMITTED' && (
        <div style={{ background: '#F59E0B15', border: '1px solid #F59E0B44', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#FCD34D' }}>Ce rapport a été soumis. En attente d'examen par la direction.</div>
        </div>
      )}

      {isLocked && workflowStatus === 'REJECTED' && (
        <div style={{
          background: '#EF444415', border: '1px solid #EF444444', borderRadius: 12,
          padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: 13, color: '#F87171' }}>
            Le rapport a été rejeté.
          </div>
          <button onClick={handleReturnToDraft} style={{
            padding: '8px 16px', borderRadius: 8, background: '#EF4444', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12
          }}>Retour au Brouillon</button>
        </div>
      )}

      <style>{`
        .spinner { width: 32px; height: 32px; border: 3px solid #30363d; border-top-color: #10B981; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
