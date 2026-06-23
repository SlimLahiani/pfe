import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Receipt, Plus, Trash2, Edit, CheckCircle, XCircle, FileText, Upload, DollarSign, FolderOpen, Clock, RotateCcw, Download } from 'lucide-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, useRestoreExpense, useExpenseCategories, useExpenseBreakdown, type Expense
} from '../../../hooks/use-api';
import { useAuth } from '../../../context/auth-context';
import { api } from '../../../lib/api';
import {
  PageHeader, SearchInput, SelectFilter, DataTable, Pagination,
  Column, StatusBadge, Dialog, FormField, Input, Select, Button, StatCard,
} from '../../../components/shared/ui';
import { exportToCSV } from '../../../lib/export-csv';

const EXPENSE_STATUSES = [
  { label: 'En attente', value: 'PENDING' },
  { label: 'Approuvée', value: 'APPROVED' },
  { label: 'Rejetée', value: 'REJECTED' },
];

const fmt = (n: number) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' });

interface ExpenseFormData {
  categoryId: string;
  description: string;
  amount: number;
  expenseDate: string;
  notes?: string;
}

export const ExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isCEO = user?.role === 'GERANT';
  const isFinanceManager = user?.role === 'RESPONSABLE_FINANCIER';
  const canApprove = isCEO || isFinanceManager;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // File upload state for receipt
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);

  // Load queries
  const { data, isLoading } = useExpenses({
    page,
    limit: 10,
    search,
    status: statusFilter || undefined,
    isArchived: showArchived,
  });
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const restoreExpense = useRestoreExpense();
  const { data: categories } = useExpenseCategories();
  const { data: breakdownData } = useExpenseBreakdown();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ExpenseFormData>({
    defaultValues: { amount: 0, expenseDate: new Date().toISOString().split('T')[0] },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setReceiptUrl(res.data.url);
      setReceiptName(res.data.name);
    } catch (err) {
      console.error('File upload failed', err);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const approveExpenseMutation = useMutation({
    mutationFn: async ({ expenseId, isApproved }: { expenseId: string; isApproved: boolean }) => {
      const res = await api.patch(`/finance/expenses/${expenseId}/approve`, { isApproved });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-expense-breakdown'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
  });

  const onSubmit = async (formData: ExpenseFormData) => {
    if (editingExpense) {
      await updateExpense.mutateAsync({
        id: editingExpense.id,
        data: {
          ...formData,
          receiptUrl: receiptUrl || undefined,
        },
      });
    } else {
      await createExpense.mutateAsync({
        ...formData,
        receiptUrl: receiptUrl || undefined,
      });
    }
    setDialogOpen(false);
    reset();
    setReceiptUrl(null);
    setReceiptName(null);
    setEditingExpense(null);
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Description', key: 'description' },
      { header: 'Catégorie', key: 'category.name' },
      { header: 'Statut', key: 'status' },
      { header: 'Montant (TND)', key: 'amount' },
      { header: 'Date', key: 'expenseDate', transform: (val: string, row: any) => new Date(val || row.date).toLocaleDateString('fr-FR') },
      { header: 'Soumis par', key: 'submittedBy.firstName', transform: (val: any, row: any) => row.submittedBy ? `${row.submittedBy.firstName} ${row.submittedBy.lastName}` : '' },
    ];
    exportToCSV(dataToExport, columns, `depenses-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const expenses = data?.data ?? [];
  const totalSpend = expenses.filter(e => e.status === 'APPROVED').reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const pendingCount = expenses.filter(e => e.status === 'PENDING').length;
  const pendingAmount = expenses.filter(e => e.status === 'PENDING').reduce((s, e) => s + Number(e.amount ?? 0), 0);

  const columns: Column<Expense>[] = [
    {
      key: 'description',
      header: 'Dépense',
      render: (row) => (
        <div>
          <p className="font-semibold text-white">{row.description}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {row.category?.name ?? 'Sans catégorie'}
            {row.submittedBy && ` • Soumis par ${row.submittedBy.firstName} ${row.submittedBy.lastName}`}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'amount',
      header: 'Montant',
      render: (row) => (
        <span className="font-bold text-red-400">-{fmt(Number(row.amount ?? 0))}</span>
      ),
    },
    {
      key: 'expenseDate',
      header: 'Date',
      render: (row) => new Date(row.expenseDate || row.date).toLocaleDateString('fr-FR'),
    },
    {
      key: 'receiptUrl',
      header: 'Justificatif',
      render: (row) => (
        row.receiptUrl ? (
          <a
            href={row.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            <FileText size={12} /> Voir
          </a>
        ) : (
          <span className="text-xs text-muted-foreground/60">Aucun</span>
        )
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (row) => (
        <div className="flex items-center gap-1">
          {((row as any).isArchived) ? (
            <button
              title="Restaurer"
              onClick={(e) => { e.stopPropagation(); restoreExpense.mutate(row.id); }}
              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
            >
              <RotateCcw size={14} /> Restaurer
            </button>
          ) : (
            <>
              {/* Approval Actions */}
              {row.status === 'PENDING' && canApprove && (
                <>
                  <button
                    title="Approuver la dépense"
                    onClick={(e) => { e.stopPropagation(); approveExpenseMutation.mutate({ expenseId: row.id, isApproved: true }); }}
                    disabled={approveExpenseMutation.isPending}
                    className="p-1 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                  >
                    <CheckCircle size={14} />
                  </button>
                  <button
                    title="Rejeter la dépense"
                    onClick={(e) => { e.stopPropagation(); approveExpenseMutation.mutate({ expenseId: row.id, isApproved: false }); }}
                    disabled={approveExpenseMutation.isPending}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    <XCircle size={14} />
                  </button>
                </>
              )}

              {/* Edit Action */}
              {row.status === 'PENDING' && (canApprove || (row as any).submittedById === user?.id) && (
                <button
                  title="Modifier"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingExpense(row);
                    reset({
                      categoryId: row.categoryId,
                      description: row.description,
                      amount: Number(row.amount),
                      expenseDate: new Date(row.expenseDate || (row as any).date).toISOString().split('T')[0],
                      notes: row.notes || '',
                    });
                    setReceiptUrl(row.receiptUrl || null);
                    setReceiptName(row.receiptUrl ? 'Justificatif existant' : null);
                    setDialogOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                >
                  <Edit size={14} />
                </button>
              )}

              {/* Delete Action */}
              {row.status === 'PENDING' && canApprove && (
                <button
                  title="Supprimer"
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(row.id); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Dépenses"
        description="Gerez, soumettez et validez les frais d'exploitation de l'agence"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => { setEditingExpense(null); reset({ amount: 0, expenseDate: new Date().toISOString().split('T')[0], categoryId: '', description: '', notes: '' }); setReceiptUrl(null); setReceiptName(null); setDialogOpen(true); }}>Enregistrer une Dépense</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Dépenses" value={data?.total ?? 0} icon={<Receipt size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="Approuvées (Payé)" value={fmt(totalSpend)} icon={<CheckCircle size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="En Attente (Nombre)" value={pendingCount} icon={<Clock size={20} />} colorClass="bg-amber-500/10 text-amber-400" />
        <StatCard label="En Attente (Volume)" value={fmt(pendingAmount)} icon={<DollarSign size={20} />} colorClass="bg-rose-500/10 text-rose-400" />
      </div>

      {/* CEO pending approvals banner */}
      {canApprove && pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Clock size={16} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            Il y a <span className="font-bold">{pendingCount}</span> dépense(s) en attente de validation.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Expenses List Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher des dépenses..." />
            <SelectFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={EXPENSE_STATUSES} placeholder="Tous les statuts" />
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

          <DataTable<Expense>
            columns={columns}
            data={expenses}
            isLoading={isLoading}
            keyExtractor={(row) => row.id}
            emptyMessage="Aucune dépense enregistrée."
          />

          {data && data.totalPages > 1 && (
            <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={10} onPageChange={setPage} />
          )}
        </div>

        {/* Analytics Breakdown Sidebar Card */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-5 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderOpen size={16} className="text-indigo-400" /> Ventilation par Catégorie
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Dépenses réelles approuvées</p>
          </div>

          {breakdownData && breakdownData.categories && breakdownData.categories.length > 0 ? (
            <div className="space-y-4">
              {breakdownData.categories.map((c) => (
                <div key={c.categoryId} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-white">{c.categoryName}</span>
                    <span className="text-muted-foreground">{fmt(c.total)} ({c.percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="border-t border-white/10 pt-3 flex justify-between text-xs font-bold">
                <span className="text-white">Total Approuvé</span>
                <span className="text-indigo-400">{fmt(breakdownData.grandTotal)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">Aucune dépense approuvée pour le moment.</p>
          )}
        </div>
      </div>

      {/* Save Expense Dialog */}
      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title={editingExpense ? "Modifier la Dépense" : "Enregistrer une Dépense"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Description" required error={errors.description?.message}>
            <Input {...register('description', { required: 'Requis' })} placeholder="Ex. Hébergement AWS, Achat Fournitures de bureau..." />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Catégorie" required error={errors.categoryId?.message}>
              <Select {...register('categoryId', { required: 'Sélectionnez une catégorie' })}>
                <option value="">— Sélectionner —</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Date de la Dépense" required>
              <Input {...register('expenseDate', { required: true })} type="date" />
            </FormField>
          </div>

          <FormField label="Montant (TND)" required error={errors.amount?.message}>
            <Input {...register('amount', { required: 'Requis', valueAsNumber: true, min: 0.01 })} type="number" step="0.001" placeholder="0.000" />
          </FormField>

          {/* File Upload Button for Receipt */}
          <FormField label="Reçu / Justificatif (PDF, Image)">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition-colors">
                <Upload size={14} />
                {uploadingReceipt ? 'Téléchargement...' : 'Sélectionner un fichier'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadingReceipt}
                />
              </label>
              {receiptName && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={receiptName}>
                  {receiptName}
                </span>
              )}
            </div>
          </FormField>

          <FormField label="Notes / Justification additionnelle">
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Notes optionnelles..."
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting} disabled={uploadingReceipt}>Enregistrer la Dépense</Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Archiver la Dépense" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Êtes-vous sûr de vouloir archiver cette dépense ? Vous pourrez la restaurer ultérieurement.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteExpense.isPending} onClick={() => deleteConfirm && deleteExpense.mutateAsync(deleteConfirm).then(() => setDeleteConfirm(null))}>Archiver</Button>
        </div>
      </Dialog>
    </div>
  );
};
