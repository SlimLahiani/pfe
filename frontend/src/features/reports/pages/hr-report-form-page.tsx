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
  useRunReport,
  getReportPdfUrl,
  getReportExcelUrl,
} from '../../../hooks/use-api';
import { useAuth } from '../../../context/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HrNotes {
  achievements: string;
  problems: string;
  risks: string;
  recommendations: string;
  improvementPlan: string;
  generalObservations: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

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

// ─── Notes Field ──────────────────────────────────────────────────────────────

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
        transition: 'border-color 0.2s',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
      onFocus={e => { if (!disabled) e.target.style.borderColor = '#4F46E5'; }}
      onBlur={e => { e.target.style.borderColor = '#30363d'; }}
    />
  </div>
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard = ({ label, value, color, icon }: { label: string; value: string | number; color?: string; icon?: string }) => (
  <div style={{
    background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
    border: '1px solid #30363d', borderRadius: 12, padding: '16px 18px',
    display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140,
    borderLeft: `3px solid ${color || '#4F46E5'}`,
  }}>
    {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
    <div style={{ fontSize: 22, fontWeight: 800, color: color || '#A78BFA' }}>{value}</div>
    <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, lineHeight: 1.3 }}>{label}</div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const HrReportFormPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: reportId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isEditing = !!reportId;

  // Queries
  const { data: existingReport, isLoading: reportLoading } = useReport(reportId);
  const { data: dynamicData, isLoading: dynamicLoading } = useReportData(reportId);

  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  const submitReport = useSubmitReport();
  const runReport = useRunReport();

  // Local state
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(lastOfMonth);
  const [reportName, setReportName] = useState(`Rapport RH — ${today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`);
  const [hrData, setHrData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [notes, setNotes] = useState<HrNotes>({
    achievements: '',
    problems: '',
    risks: '',
    recommendations: '',
    improvementPlan: '',
    generalObservations: '',
  });

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (existingReport) {
      setReportName(existingReport.name || existingReport.title || reportName);
      if (existingReport.periodStart) setPeriodStart(existingReport.periodStart.split('T')[0]);
      if (existingReport.periodEnd) setPeriodEnd(existingReport.periodEnd.split('T')[0]);
      if (existingReport.notes) setNotes(existingReport.notes as HrNotes);
      setSavedReportId(existingReport.id);
    }
  }, [existingReport]);

  useEffect(() => {
    if (dynamicData) {
      setHrData(dynamicData.data);
    } else if (existingReport?.data) {
      setHrData(existingReport.data);
    }
  }, [dynamicData, existingReport]);

  const workflowStatus = existingReport?.workflowStatus || 'DRAFT';
  const isLocked = workflowStatus !== 'DRAFT';

  // Autosave
  useEffect(() => {
    if (!isLocked && savedReportId) {
      autosaveTimer.current = setInterval(() => {
        handleSaveDraft(true);
      }, 30000);
      return () => clearInterval(autosaveTimer.current!);
    }
  }, [isLocked, savedReportId, notes, reportName, periodStart, periodEnd]);


  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleReturnToDraft = async () => {
    if (!activeId) return;
    try {
      setToast({ msg: 'Retour au statut DRAFT...', type: 'info' });
      await api.post(`/reports/${activeId}/return-to-draft`);
      queryClient.invalidateQueries({ queryKey: ['report', activeId] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setToast({ msg: 'Le rapport est à nouveau modifiable', type: 'success' });
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      setToast({ msg: e.response?.data?.message || 'Erreur', type: 'error' });
    }
  };
  const activeId = savedReportId || reportId;



  // ── Save Draft ──
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
        reportingPeriod: `${periodStart} → ${periodEnd}`,
      };

      // Sanitize payload: remove undefined/null
      const sanitizedPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, v]) => v !== undefined && v !== null)
      );

      console.log("Report Payload:", sanitizedPayload);

      if (currentId) {
        await updateReport.mutateAsync({ id: currentId, data: { ...sanitizedPayload, name: reportName } });
      } else {
        const newReport = await createReport.mutateAsync({
          name: reportName,
          type: 'HR',
          filters: { period: 'CUSTOM', periodStart, periodEnd },
          reportingPeriod: `${periodStart} → ${periodEnd}`,
          ...sanitizedPayload,
        });
        setSavedReportId(newReport.id);
        navigate(`/reports/${newReport.id}/edit`, { replace: true });
      }
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (!isAuto) setToast({ msg: 'Brouillon sauvegardé.', type: 'success' });
    } catch {
      if (!isAuto) showToast('Erreur lors de la sauvegarde.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Submit ──
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const currentId = activeId;
      if (!currentId) {
        showToast('Sauvegardez d\'abord le rapport avant de le soumettre.', 'error');
        setSubmitting(false);
        return;
      }
      // Make sure data is saved first
      await handleSaveDraft(false, currentId);
      // Run to generate stats snapshot
      if (hrData) {
        try { await runReport.mutateAsync(currentId); } catch { /* ignore */ }
      }
      await submitReport.mutateAsync(currentId);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['report', currentId] });
      setToast({ msg: 'Rapport soumis au directeur !', type: 'success' });
      setTimeout(() => navigate('/reports'), 1500);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Erreur lors de la soumission.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (reportLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#6B7280' }}>
        <div className="spinner" />
      </div>
    );
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
          {toast.type === 'success' ? '' : toast.type === 'error' ? '' : 'ℹ️'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => navigate('/reports')} style={{
          background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 16, padding: 0,
        }}>
          ← Retour aux rapports
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}></div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#F9FAFB' }}>
                {isEditing ? 'Modifier le Rapport RH' : 'Nouveau Rapport RH'}
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
              Rapport Ressources Humaines — Rédigé par{' '}
              <strong style={{ color: '#9CA3AF' }}>{user?.firstName} {user?.lastName}</strong>
            </p>
          </div>
          <StatusBadge status={workflowStatus} />
        </div>
      </div>

      {/* Rejection notice */}
      {workflowStatus === 'REJECTED' && existingReport?.comment && (
        <div style={{
          background: '#EF444415', border: '1px solid #EF444444', borderRadius: 12,
          padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}></span>
          <div>
            <div style={{ fontWeight: 700, color: '#EF4444', fontSize: 13, marginBottom: 4 }}>Rapport rejeté par la direction</div>
            <div style={{ fontSize: 13, color: '#FCA5A5' }}>{existingReport.comment}</div>
          </div>
        </div>
      )}

      {/* Approved notice */}
      {workflowStatus === 'APPROVED' && (
        <div style={{
          background: '#10B98115', border: '1px solid #10B98144', borderRadius: 12,
          padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <span style={{ fontSize: 20 }}></span>
          <div>
            <div style={{ fontWeight: 700, color: '#10B981', fontSize: 13, marginBottom: 4 }}>Rapport approuvé par la direction</div>
            {existingReport?.comment && <div style={{ fontSize: 13, color: '#6EE7B7' }}>{existingReport.comment}</div>}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <a href={getReportPdfUrl(activeId!)} target="_blank" rel="noreferrer" style={{
              padding: '8px 16px', borderRadius: 8, background: '#4F46E5', color: '#fff',
              fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}> PDF</a>
            <a href={getReportExcelUrl(activeId!)} target="_blank" rel="noreferrer" style={{
              padding: '8px 16px', borderRadius: 8, background: '#10B981', color: '#fff',
              fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}> Excel</a>
          </div>
        </div>
      )}

      {/* Report Name */}
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9CA3AF', marginBottom: 8 }}>
          Titre du rapport *
        </label>
        <input
          value={reportName}
          onChange={e => setReportName(e.target.value)}
          disabled={isLocked}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            background: isLocked ? '#0d1117' : '#161b22', border: '1.5px solid #30363d',
            color: '#F9FAFB', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Period selector */}
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#E5E7EB', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📅</span> Période du Rapport
        </h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Date de début</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} disabled={isLocked}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#161b22', border: '1.5px solid #30363d', color: '#E5E7EB', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Date de fin</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} disabled={isLocked}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#161b22', border: '1.5px solid #30363d', color: '#E5E7EB', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      {/* KPI Statistics panel */}
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        {hrData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <KpiCard label="Effectif Total" value={hrData.totalEmployees} icon="👥" color="#3B82F6" />
              <KpiCard label="Nouveaux Employés" value={hrData.newEmployees} icon="✨" color="#10B981" />
              <KpiCard label="Démissions/Départs" value={hrData.resignedEmployees} icon="📉" color="#EF4444" />
              <KpiCard label="Taux de Présence" value={`${hrData.averageAttendance}%`} icon="🕒" color="#F59E0B" />
              <KpiCard label="Congés en Attente" value={hrData.pendingLeaves} icon="🏖️" color="#8B5CF6" />
              <KpiCard label="Candidats Embauchés" value={hrData.candidatesHired} icon="🎯" color="#14B8A6" />
              <KpiCard label="Tâches Complétées" value={`${hrData.completedTasks} / ${hrData.totalTasks}`} icon="✅" color="#EC4899" />
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
          <span style={{ fontSize: 18 }}></span> Notes du Manager RH
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: '#6B7280' }}>
          {isLocked ? 'Lecture seule — le rapport est déjà soumis.' : 'Ces notes seront incluses dans le rapport soumis au directeur.'}
        </p>

        <NoteField label="Réalisations du mois" placeholder="Décrivez les principales réalisations RH de la période..."
          value={notes.achievements} onChange={v => setNotes(n => ({ ...n, achievements: v }))} disabled={isLocked} />
        <NoteField label="Problèmes identifiés" icon="️" placeholder="Problèmes, conflits ou incidents observés..."
          value={notes.problems} onChange={v => setNotes(n => ({ ...n, problems: v }))} disabled={isLocked} />
        <NoteField label="Risques RH" placeholder="Risques potentiels (surmenage, conflits, turnover élevé...)..."
          value={notes.risks} onChange={v => setNotes(n => ({ ...n, risks: v }))} disabled={isLocked} />
        <NoteField label="Recommandations" placeholder="Vos recommandations pour la direction..."
          value={notes.recommendations} onChange={v => setNotes(n => ({ ...n, recommendations: v }))} disabled={isLocked} />
        <NoteField label="Plan d'amélioration" placeholder="Actions prévues pour améliorer la performance RH..."
          value={notes.improvementPlan} onChange={v => setNotes(n => ({ ...n, improvementPlan: v }))} disabled={isLocked} />
        <NoteField label="Observations générales" placeholder="Toute autre observation ou commentaire..."
          value={notes.generalObservations} onChange={v => setNotes(n => ({ ...n, generalObservations: v }))} disabled={isLocked} />
      </div>

      {/* Action buttons */}
      {!isLocked && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => navigate('/reports')} style={{
            padding: '10px 20px', borderRadius: 10, background: '#161b22', border: '1px solid #30363d',
            color: '#9CA3AF', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>Annuler</button>
          <button onClick={() => handleSaveDraft()} disabled={saving} style={{
            padding: '10px 20px', borderRadius: 10, background: '#374151', border: 'none',
            color: '#F9FAFB', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {saving ? <><span className="spinner-sm" />Sauvegarde...</> : ' Sauvegarder'}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !hrData} style={{
            padding: '10px 24px', borderRadius: 10,
            background: (submitting || !hrData) ? '#374151' : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
            border: 'none', color: '#fff', cursor: (submitting || !hrData) ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: (!submitting && hrData) ? '0 4px 16px rgba(79,70,229,0.4)' : 'none',
          }}>
            {submitting ? <><span className="spinner-sm" />Soumission...</> : ' Soumettre au Directeur'}
          </button>
        </div>
      )}

      {isLocked && workflowStatus === 'SUBMITTED' && (
        <div style={{
          background: '#F59E0B15', border: '1px solid #F59E0B44', borderRadius: 12,
          padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <span style={{ fontSize: 20 }}>⏳</span>
          <div style={{ fontSize: 13, color: '#FCD34D' }}>
            Ce rapport a été soumis et est en attente d'examen par la direction. Vous serez notifié de la décision.
          </div>
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
          }}>Return to Draft</button>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .spinner { width: 32px; height: 32px; border: 3px solid #30363d; border-top-color: #7C3AED; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
