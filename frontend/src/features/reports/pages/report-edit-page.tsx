import React from 'react';
import { useParams } from 'react-router-dom';
import { useReport } from '../../../hooks/use-api';
import { HrReportFormPage } from './hr-report-form-page';
import { FinanceReportFormPage } from './finance-report-form-page';

export const ReportEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading, error } = useReport(id);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#6B7280' }}>
        <div className="spinner" />
        <span style={{ marginLeft: 12 }}>Chargement du rapport...</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#EF4444' }}>
        <h3>Erreur</h3>
        <p>Impossible de charger le rapport ou rapport introuvable.</p>
      </div>
    );
  }

  if (report.type === 'HR') {
    return <HrReportFormPage />;
  }

  if (report.type === 'FINANCIAL') {
    return <FinanceReportFormPage />;
  }

  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#EF4444' }}>
      <h3>Type de rapport non supporté</h3>
      <p>Le type de rapport "{report.type}" n'est pas géré par l'éditeur.</p>
    </div>
  );
};
