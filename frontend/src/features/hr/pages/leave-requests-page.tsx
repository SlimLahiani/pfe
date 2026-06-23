import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CalendarClock, Plus, Check, X, Download, ShieldCheck, Clock, CheckCircle, RotateCcw, Trash2, Edit } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLeaveRequests, useCreateLeaveRequest, useUpdateLeaveRequest, useDeleteLeaveRequest, useRestoreLeaveRequest, type LeaveRequest, downloadPdf } from '../../../hooks/use-api';
import {
  PageHeader, SearchInput, SelectFilter, DataTable, Pagination,
  Column, StatusBadge, Dialog, FormField, Input, Select, Textarea, Button, StatCard,
} from '../../../components/shared/ui';
import { useAuth } from '../../../context/auth-context';
import { api } from '../../../lib/api';
import { exportToCSV } from '../../../lib/export-csv';

const LEAVE_TYPES = [
  { label: 'Congé annuel', value: 'ANNUAL' },
  { label: 'Congé maladie', value: 'SICK' },
  { label: 'Congé maternité/paternité', value: 'PARENTAL' },
  { label: 'Congé sans solde', value: 'UNPAID' },
  { label: 'Autre', value: 'OTHER' },
];

const LEAVE_STATUSES = [
  { label: 'En attente', value: 'PENDING' },
  { label: 'Revu par RH', value: 'REVIEWED' },
  { label: 'Approuvé', value: 'APPROVED' },
  { label: 'Rejeté', value: 'REJECTED' },
];

interface LeaveFormData {
  startDate: string;
  endDate: string;
  type: string;
  reason?: string;
}

export const LeaveRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isHR = user?.role === 'RESPONSABLE_RH';
  const isCEO = user?.role === 'GERANT';
  const isAdmin = user?.role === 'ADMIN';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);

  const { data, isLoading } = useLeaveRequests({
    page,
    limit: 10,
    search,
    status: statusFilter || undefined,
    isArchived: showArchived,
  });
  const createLeave = useCreateLeaveRequest();
  const updateLeave = useUpdateLeaveRequest();
  const deleteLeave = useDeleteLeaveRequest();
  const restoreLeave = useRestoreLeaveRequest();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LeaveFormData>({
    defaultValues: { type: 'ANNUAL' },
  });

  const onSubmit = async (formData: LeaveFormData) => {
    if (editingLeave) {
      await updateLeave.mutateAsync({ id: editingLeave.id, data: formData });
    } else {
      await createLeave.mutateAsync(formData);
    }
    setDialogOpen(false);
    reset();
    setEditingLeave(null);
  };

  const doReview = async (id: string, status: string, reviewNote?: string) => {
    setActionLoading(id + status);
    try {
      await api.patch(`/hr/leave-requests/${id}/review`, { status, reviewNote });
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Collaborateur', key: 'employee.user.firstName', transform: (val: any, row: any) => row.employee?.user ? `${row.employee.user.firstName} ${row.employee.user.lastName}` : '' },
      { header: 'Type', key: 'type' },
      { header: 'Début', key: 'startDate', transform: (val: string) => new Date(val).toLocaleDateString('fr-FR') },
      { header: 'Fin', key: 'endDate', transform: (val: string) => new Date(val).toLocaleDateString('fr-FR') },
      { header: 'Jours', key: 'days' },
      { header: 'Statut', key: 'status' },
      { header: 'Motif', key: 'reason' },
    ];
    exportToCSV(dataToExport, columns, `conges-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const requests = data?.data ?? [];
  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const reviewedCount = requests.filter(r => r.status === 'REVIEWED').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employee',
      header: 'Employé',
      render: (row) => (
        <span className="font-semibold text-white text-sm">
          {row.employee?.user?.firstName} {row.employee?.user?.lastName}
        </span>
      ),
    },
    { key: 'type', header: 'Type', render: (row) => <span className="text-sm text-gray-200">{row.type.replace(/_/g, ' ')}</span> },
    {
      key: 'period',
      header: 'Période',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.startDate).toLocaleDateString('fr-FR')} — {new Date(row.endDate).toLocaleDateString('fr-FR')} ({Number((row as any).days ?? 0)} jours)
        </span>
      ),
    },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-48',
      render: (row) => (
        <div className="flex gap-1 flex-wrap">
          {((row as any).isArchived) ? (
            <button
              onClick={(e) => { e.stopPropagation(); restoreLeave.mutate(row.id); }}
              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
              title="Restaurer"
            >
              <RotateCcw size={14} /> Restaurer
            </button>
          ) : (
            <>
              {row.status === 'APPROVED' && (
                <button
                  title="Télécharger le PDF d'approbation"
                  onClick={(e) => { e.stopPropagation(); downloadPdf(`/hr/leave-requests/${row.id}/pdf`, `leave-approval-${row.id}.pdf`); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                >
                  <Download size={14} />
                </button>
              )}

              {/* Edit leave request */}
              {row.status === 'PENDING' && (row.requestedById === user?.id || isHR || isCEO) && (
                <button
                  title="Modifier la demande"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingLeave(row);
                    reset({
                      startDate: new Date(row.startDate).toISOString().split('T')[0],
                      endDate: new Date(row.endDate).toISOString().split('T')[0],
                      type: row.type,
                      reason: row.reason || '',
                    });
                    setDialogOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                >
                  <Edit size={14} />
                </button>
              )}

              {/* HR Manager action: Mark as reviewed */}
              {isHR && row.status === 'PENDING' && (
                <button
                  onClick={(e) => { e.stopPropagation(); doReview(row.id, 'REVIEWED'); }}
                  disabled={actionLoading === row.id + 'REVIEWED'}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                  title="Marquer comme revu"
                >
                  <ShieldCheck size={14} />
                </button>
              )}

              {/* CEO / Admin Action: Approve / Reject */}
              {(isCEO || isAdmin) && (row.status === 'PENDING' || row.status === 'REVIEWED') && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); doReview(row.id, 'APPROVED'); }}
                    disabled={actionLoading === row.id + 'APPROVED'}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                    title="Approuver"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRejectDialog({ id: row.id }); setRejectReason(''); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    title="Rejeter"
                  >
                    <X size={14} />
                  </button>
                </>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); if (confirm('Êtes-vous sûr de vouloir archiver cette demande ?')) deleteLeave.mutate(row.id); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                title="Archiver"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes de Congé"
        description="Gerez et suivez les congés des employés et les flux d'approbation"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => { setEditingLeave(null); reset({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' }); setDialogOpen(true); }}>Demander un congé</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total des Demandes" value={data?.total ?? 0} icon={<CalendarClock size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="Attente Revue RH" value={pendingCount} icon={<Clock size={20} />} colorClass="bg-amber-500/10 text-amber-400" />
        <StatCard label="Revues (Attente PDG)" value={reviewedCount} icon={<ShieldCheck size={20} />} colorClass="bg-purple-500/10 text-purple-400" />
        <StatCard label="Approuvées" value={approvedCount} icon={<CheckCircle size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
      </div>

      {/* Interactive alert for HR Managers */}
      {isHR && pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Clock size={16} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            Vous avez <span className="font-bold">{pendingCount}</span> demande{pendingCount > 1 ? 's' : ''} de congé en attente de votre revue RH.
          </p>
        </div>
      )}

      {/* Interactive alert for CEO */}
      {isCEO && reviewedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <ShieldCheck size={16} className="text-purple-400 shrink-0" />
          <p className="text-sm text-purple-300">
            Il y a <span className="font-bold">{reviewedCount}</span> demande{reviewedCount > 1 ? 's' : ''} de congé revues par les RH en attente de votre décision finale.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher des demandes..." />
        <SelectFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={LEAVE_STATUSES} placeholder="Tous les statuts" />
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none cursor-pointer sm:ml-auto">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
            className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0"
          />
          Afficher Archivés
        </label>
      </div>

      <DataTable<LeaveRequest>
        columns={columns}
        data={requests}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Aucune demande de congé trouvée."
      />

      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={10} onPageChange={setPage} />
      )}

      {/* Request Leave Dialog */}
      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title={editingLeave ? "Modifier la demande de congé" : "Demander un congé"} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Type de congé" required>
            <Select {...register('type', { required: true })}>
              {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date de début" required error={errors.startDate?.message}>
              <Input {...register('startDate', { required: 'Requis' })} type="date" />
            </FormField>
            <FormField label="Date de fin" required error={errors.endDate?.message}>
              <Input {...register('endDate', { required: 'Requis' })} type="date" />
            </FormField>
          </div>
          <FormField label="Motif">
            <Textarea {...register('reason')} placeholder="Détails supplémentaires..." rows={3} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting}>Soumettre la demande</Button>
          </div>
        </form>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog isOpen={!!rejectDialog} onClose={() => setRejectDialog(null)} title="Rejeter la demande de congé" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Fournissez un motif pour le rejet de cette demande de congé.</p>
          <Input
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Note de rejet (facultatif)"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejectDialog(null)}>Annuler</Button>
            <Button variant="danger"
              isLoading={!!(rejectDialog && actionLoading === rejectDialog.id + 'REJECTED')}
              onClick={async () => {
                if (!rejectDialog) return;
                await doReview(rejectDialog.id, 'REJECTED', rejectReason);
                setRejectDialog(null);
              }}>
              Rejeter la demande
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
