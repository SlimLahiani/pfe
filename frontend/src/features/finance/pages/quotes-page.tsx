import React, { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  ClipboardList, Plus, Trash2, Download, CheckCircle, XCircle, Edit,
  Clock, Send, FileText, Eye, ArrowRight, PlusCircle, Package, RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { useQuotes, useCreateQuote, useUpdateQuote, useDeleteQuote, useRestoreQuote, useConvertQuote, useClientsList, type Quote, downloadPdf } from '../../../hooks/use-api';
import { useAuth } from '../../../context/auth-context';
import { api } from '../../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import {
  PageHeader, SearchInput, SelectFilter, DataTable, Pagination,
  Column, StatusBadge, Dialog, FormField, Input, Button, StatCard, Select,
} from '../../../components/shared/ui';
import { exportToCSV } from '../../../lib/export-csv';

const QUOTE_STATUSES = [
  { label: 'Brouillon', value: 'DRAFT' },
  { label: "En attente d'approbation", value: 'PENDING_APPROVAL' },
  { label: 'Approuvé', value: 'APPROVED' },
  { label: 'Rejeté', value: 'REJECTED' },
  { label: 'Envoyé', value: 'SENT' },
  { label: 'Accepté', value: 'ACCEPTED' },
  { label: 'Expiré', value: 'EXPIRED' },
];

const STATUS_PIPELINE = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED'];

const fmt = (n: number) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' });

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface QuoteFormData {
  clientId: string;
  projectId?: string;
  validUntil: string;
  notes?: string;
  terms?: string;
  items: LineItem[];
}

// ─── Status Pipeline ──────────────────────────────────────────────────────────

const StatusPipeline: React.FC<{ currentStatus: string }> = ({ currentStatus }) => {
  const currentIndex = STATUS_PIPELINE.indexOf(currentStatus);
  return (
    <div className="flex items-center gap-1">
      {STATUS_PIPELINE.map((step, i) => {
        const isActive = i <= currentIndex;
        const isCurrent = step === currentStatus;
        const label = QUOTE_STATUSES.find(s => s.value === step)?.label ?? step;
        return (
          <React.Fragment key={step}>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
              isCurrent
                ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30'
                : isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-white/5 text-muted-foreground/40'
            }`}>
              {isActive && i < currentIndex && <CheckCircle size={10} />}
              {label}
            </div>
            {i < STATUS_PIPELINE.length - 1 && (
              <ArrowRight size={10} className={isActive ? 'text-emerald-400/40' : 'text-white/10'} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Quote Detail Dialog ──────────────────────────────────────────────────────

const QuoteDetailDialog: React.FC<{ quote: Quote | null; onClose: () => void }> = ({ quote, onClose }) => {
  if (!quote) return null;
  const items = (quote as any).items ?? [];
  const subtotal = Number((quote as any).subtotal ?? 0);
  const taxRate = Number((quote as any).taxRate ?? 19);
  const taxAmount = Number((quote as any).taxAmount ?? 0);
  const total = Number((quote as any).total ?? quote.totalAmount ?? 0);

  return (
    <Dialog isOpen={true} onClose={onClose} title={`Devis ${(quote as any).reference ?? quote.quoteNumber}`} size="lg">
      <div className="space-y-5">
        {/* Status Pipeline */}
        <StatusPipeline currentStatus={quote.status} />

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">Client</p>
            <p className="text-sm font-bold text-white">{(quote.client as any)?.companyName ?? '—'}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">Créé par</p>
            <p className="text-sm font-bold text-white">
              {(quote as any).createdBy ? `${(quote as any).createdBy.firstName} ${(quote as any).createdBy.lastName}` : '—'}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">Valide jusqu'au</p>
            <p className="text-sm font-bold text-white">
              {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('fr-FR') : '—'}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">Statut</p>
            <StatusBadge status={quote.status} />
          </div>
        </div>

        {/* Line Items */}
        {items.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
              <Package size={12} className="text-indigo-400" /> Lignes du Devis
            </h4>
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5">
                    <th className="text-left p-2.5 text-muted-foreground font-medium">Description</th>
                    <th className="text-right p-2.5 text-muted-foreground font-medium w-20">Qté</th>
                    <th className="text-right p-2.5 text-muted-foreground font-medium w-28">P.U.</th>
                    <th className="text-right p-2.5 text-muted-foreground font-medium w-20">Remise</th>
                    <th className="text-right p-2.5 text-muted-foreground font-medium w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="p-2.5 text-white">{item.description}</td>
                      <td className="p-2.5 text-right text-white">{Number(item.quantity)}</td>
                      <td className="p-2.5 text-right text-white">{fmt(Number(item.unitPrice))}</td>
                      <td className="p-2.5 text-right text-muted-foreground">{Number(item.discount)}%</td>
                      <td className="p-2.5 text-right font-bold text-white">{fmt(Number(item.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Sous-total HT</span>
              <span className="text-white font-medium">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">TVA ({taxRate}%)</span>
              <span className="text-white font-medium">{fmt(taxAmount)}</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between">
              <span className="text-sm font-bold text-white">Total TTC</span>
              <span className="text-lg font-black text-indigo-400">{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {(quote as any).notes && (
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Notes</p>
            <p className="text-xs text-white whitespace-pre-wrap">{(quote as any).notes}</p>
          </div>
        )}
      </div>
    </Dialog>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Quotes Page
// ═══════════════════════════════════════════════════════════════════════════════

export const QuotesPage: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isCEO = user?.role === 'GERANT';
  const isFinanceManager = user?.role === 'RESPONSABLE_FINANCIER';
  const canCreate = isCEO || user?.role === 'SECRETAIRE' || isFinanceManager;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);

  const { data, isLoading } = useQuotes({
    page,
    limit: 10,
    search,
    status: statusFilter || undefined,
    isArchived: showArchived,
  });
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();
  const restoreQuote = useRestoreQuote();
  const convertQuote = useConvertQuote();
  const { data: clientsData } = useClientsList();

  const clients = clientsData?.data ?? [];

  const { register, handleSubmit, reset, control, watch, formState: { errors, isSubmitting } } = useForm<QuoteFormData>({
    defaultValues: {
      clientId: '',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [{ description: '', quantity: 1, unitPrice: 0, discount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  // Calculate totals
  const { subtotal, taxAmount, total } = useMemo(() => {
    const sub = (watchedItems ?? []).reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const disc = Number(item.discount) || 0;
      return sum + qty * price * (1 - disc / 100);
    }, 0);
    const tax = sub * 0.19;
    return { subtotal: sub, taxAmount: tax, total: sub + tax };
  }, [watchedItems]);

  const doAction = async (action: string, id: string, body?: Record<string, any>) => {
    setActionLoading(id + action);
    try {
      await api.patch(`/finance/quotes/${id}/${action}`, body ?? {});
      qc.invalidateQueries({ queryKey: ['quotes'] });
    } finally {
      setActionLoading(null);
    }
  };

  const onSubmit = async (formData: QuoteFormData) => {
    if (editingQuote) {
      await updateQuote.mutateAsync({ id: editingQuote.id, data: formData });
    } else {
      await createQuote.mutateAsync(formData);
    }
    setDialogOpen(false);
    reset();
    setEditingQuote(null);
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Devis', key: 'reference' },
      { header: 'Client', key: 'client.companyName' },
      { header: 'Statut', key: 'status' },
      { header: 'Montant TTC', key: 'total' },
      { header: 'Validité', key: 'validUntil', transform: (val: string) => val ? new Date(val).toLocaleDateString('fr-FR') : '' },
      { header: 'Date de création', key: 'createdAt', transform: (val: string) => new Date(val).toLocaleDateString('fr-FR') },
    ];
    exportToCSV(dataToExport, columns, `devis-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const viewDetail = async (quote: Quote) => {
    try {
      const res = await api.get(`/finance/quotes/${quote.id}`);
      setDetailQuote(res.data as Quote);
    } catch {
      setDetailQuote(quote);
    }
  };

  const quotes = data?.data ?? [];
  const pendingApproval = quotes.filter(q => q.status === 'PENDING_APPROVAL').length;
  const approved = quotes.filter(q => q.status === 'APPROVED').length;
  const totalValue = quotes.reduce((s, q) => s + Number((q as any).total ?? q.totalAmount ?? 0), 0);

  const columns: Column<Quote>[] = [
    {
      key: 'quoteNumber',
      header: 'Devis',
      render: (row) => (
        <div>
          <p className="font-mono font-semibold text-white text-sm">{(row as any).reference ?? row.quoteNumber}</p>
          {(row as any).client && <p className="text-xs text-muted-foreground mt-0.5">{(row as any).client.companyName}</p>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Statut',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'totalAmount',
      header: 'Montant TTC',
      render: (row) => (
        <span className="font-bold text-white">
          {fmt(Number((row as any).total ?? row.totalAmount ?? 0))}
        </span>
      ),
    },
    {
      key: 'validUntil',
      header: "Validité",
      render: (row) => {
        const d = row.validUntil;
        if (!d) return '—';
        const date = new Date(d);
        const isExpired = date < new Date();
        return (
          <span className={isExpired ? 'text-red-400' : 'text-muted-foreground'}>
            {date.toLocaleDateString('fr-FR')}
            {isExpired && <span className="text-[9px] ml-1">(expiré)</span>}
          </span>
        );
      },
    },
    { key: 'createdAt', header: 'Créé le', render: (row) => new Date(row.createdAt).toLocaleDateString('fr-FR') },
    {
      key: 'actions', header: '', className: 'w-52',
      render: (row) => (
        <div className="flex items-center gap-1 flex-wrap">
          {((row as any).isArchived) ? (
            <button
              title="Restaurer"
              onClick={(e) => { e.stopPropagation(); restoreQuote.mutate(row.id); }}
              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
            >
              <RotateCcw size={14} /> Restaurer
            </button>
          ) : (
            <>
              {/* View Detail */}
              <button
                title="Voir le détail"
                onClick={(e) => { e.stopPropagation(); viewDetail(row); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
              >
                <Eye size={14} />
              </button>

              {/* Edit Quote */}
              {row.status === 'DRAFT' && canCreate && (
                <button
                  title="Modifier le devis"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingQuote(row);
                    reset({
                      clientId: row.clientId,
                      projectId: row.projectId || '',
                      validUntil: row.validUntil ? new Date(row.validUntil).toISOString().split('T')[0] : '',
                      notes: row.notes || '',
                      terms: row.terms || '',
                      items: (row as any).items ? (row as any).items.map((item: any) => ({
                        description: item.description,
                        quantity: Number(item.quantity),
                        unitPrice: Number(item.unitPrice),
                        discount: Number(item.discount || 0),
                      })) : [{ description: '', quantity: 1, unitPrice: 0, discount: 0 }],
                    });
                    setDialogOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                >
                  <Edit size={14} />
                </button>
              )}

              {/* Submit for approval */}
              {row.status === 'DRAFT' && canCreate && (
                <button
                  title="Soumettre pour approbation"
                  onClick={(e) => { e.stopPropagation(); doAction('submit', row.id); }}
                  disabled={actionLoading === row.id + 'submit'}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                >
                  <Clock size={14} />
                </button>
              )}

              {/* CEO: Approve */}
              {isCEO && row.status === 'PENDING_APPROVAL' && (
                <>
                  <button
                    title="Approuver le devis"
                    onClick={(e) => { e.stopPropagation(); doAction('approve', row.id); }}
                    disabled={actionLoading === row.id + 'approve'}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                  >
                    <CheckCircle size={14} />
                  </button>
                  <button
                    title="Rejeter le devis"
                    onClick={(e) => { e.stopPropagation(); setRejectDialog({ id: row.id }); setRejectReason(''); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    <XCircle size={14} />
                  </button>
                </>
              )}

              {/* Send reminder */}
              {(row.status === 'APPROVED' || row.status === 'SENT') && (
                <button
                  title="Envoyer au client"
                  onClick={(e) => { e.stopPropagation(); api.post(`/finance/quotes/${row.id}/reminder`); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                >
                  <Send size={14} />
                </button>
              )}

              {/* Convert to Invoice */}
              {(row.status === 'APPROVED' || row.status === 'SENT' || row.status === 'ACCEPTED') && !(row as any).invoice && (
                <button
                  title="Convertir en Facture"
                  onClick={(e) => { e.stopPropagation(); convertQuote.mutate(row.id); }}
                  disabled={convertQuote.isPending}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={14} className={convertQuote.isPending ? 'animate-spin' : ''} />
                </button>
              )}

              {/* PDF */}
              <button
                title="Télécharger PDF"
                onClick={(e) => { e.stopPropagation(); downloadPdf(`/finance/quotes/${row.id}/pdf`, `devis-${row.id}.pdf`); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
              >
                <Download size={14} />
              </button>

              {/* Delete */}
              {row.status === 'DRAFT' && (isCEO || isFinanceManager) && (
                <button
                  title="Archiver"
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
        title="Gestion des Devis"
        description="Créez, suivez et approuvez les devis commerciaux avec calculs automatiques"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            {canCreate && <Button icon={<Plus size={16} />} onClick={() => { setEditingQuote(null); reset({ clientId: '', projectId: '', validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: '', terms: '', items: [{ description: '', quantity: 1, unitPrice: 0, discount: 0 }] }); setDialogOpen(true); }}>Nouveau Devis</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Devis" value={data?.total ?? 0} icon={<ClipboardList size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="En attente d'approbation" value={pendingApproval} icon={<Clock size={20} />} colorClass="bg-amber-500/10 text-amber-400" />
        <StatCard label="Approuvés" value={approved} icon={<CheckCircle size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="Valeur Totale" value={fmt(totalValue)} icon={<FileText size={20} />} colorClass="bg-purple-500/10 text-purple-400" />
      </div>

      {/* CEO: Pending approval banner */}
      {isCEO && pendingApproval > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Clock size={16} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            <span className="font-bold">{pendingApproval}</span> devis en attente de votre approbation.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher des devis..." />
        <SelectFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={QUOTE_STATUSES} placeholder="Tous les statuts" />
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

      <DataTable<Quote>
        columns={columns}
        data={quotes}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Aucun devis trouvé. Créez votre premier devis."
        onRowClick={(row) => viewDetail(row)}
      />

      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={10} onPageChange={setPage} />
      )}

      {/* ─── Create Quote Dialog ──────────────────────────────────────────── */}
      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title={editingQuote ? "Modifier le Devis" : "Nouveau Devis"} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Section 1: Client & Dates */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Informations Générales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Client" required error={errors.clientId?.message}>
                <Select {...register('clientId', { required: 'Sélectionnez un client' })}>
                  <option value="">— Sélectionner un client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Valide jusqu'au" required>
                <Input {...register('validUntil', { required: true })} type="date" />
              </FormField>
            </div>
          </div>

          {/* Section 2: Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Lignes du Devis</h4>
              <button
                type="button"
                onClick={() => append({ description: '', quantity: 1, unitPrice: 0, discount: 0 })}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <PlusCircle size={14} /> Ajouter une ligne
              </button>
            </div>

            <div className="border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5">
                    <th className="text-left p-2.5 text-muted-foreground font-medium">Description</th>
                    <th className="text-right p-2.5 text-muted-foreground font-medium w-20">Qté</th>
                    <th className="text-right p-2.5 text-muted-foreground font-medium w-28">P.U. (TND)</th>
                    <th className="text-right p-2.5 text-muted-foreground font-medium w-20">Remise %</th>
                    <th className="text-right p-2.5 text-muted-foreground font-medium w-28">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {fields.map((field, i) => {
                    const item = watchedItems?.[i];
                    const qty = Number(item?.quantity) || 0;
                    const price = Number(item?.unitPrice) || 0;
                    const disc = Number(item?.discount) || 0;
                    const lineTotal = qty * price * (1 - disc / 100);
                    return (
                      <tr key={field.id}>
                        <td className="p-1.5">
                          <input
                            {...register(`items.${i}.description`, { required: true })}
                            placeholder="Service ou produit"
                            className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            {...register(`items.${i}.quantity`, { valueAsNumber: true, min: 1 })}
                            type="number"
                            min="1"
                            className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-right focus:border-indigo-500 outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            {...register(`items.${i}.unitPrice`, { valueAsNumber: true, min: 0 })}
                            type="number"
                            step="0.001"
                            min="0"
                            className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-right focus:border-indigo-500 outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            {...register(`items.${i}.discount`, { valueAsNumber: true, min: 0, max: 100 })}
                            type="number"
                            min="0"
                            max="100"
                            className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-right focus:border-indigo-500 outline-none"
                          />
                        </td>
                        <td className="p-1.5 text-right">
                          <span className="font-bold text-white text-xs">{fmt(lineTotal)}</span>
                        </td>
                        <td className="p-1.5">
                          {fields.length > 1 && (
                            <button type="button" onClick={() => remove(i)} className="p-1 text-gray-500 hover:text-red-400">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Totals */}
          <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Sous-total HT</span>
                <span className="text-white font-medium">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">TVA (19%)</span>
                <span className="text-white font-medium">{fmt(taxAmount)}</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between">
                <span className="text-sm font-bold text-white">Total TTC</span>
                <span className="text-lg font-black text-indigo-400">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Notes">
              <textarea
                {...register('notes')}
                rows={2}
                placeholder="Notes internes..."
                className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
              />
            </FormField>
            <FormField label="Conditions">
              <textarea
                {...register('terms')}
                rows={2}
                placeholder="Conditions de paiement..."
                className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting}>Créer le Devis</Button>
          </div>
        </form>
      </Dialog>

      {/* ─── Quote Detail Dialog ──────────────────────────────────────────── */}
      <QuoteDetailDialog quote={detailQuote} onClose={() => setDetailQuote(null)} />

      {/* ─── Delete Dialog ────────────────────────────────────────────────── */}
      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Archiver le Devis" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Êtes-vous sûr de vouloir archiver ce devis ? Vous pourrez le restaurer ultérieurement.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteQuote.isPending}
            onClick={() => deleteConfirm && deleteQuote.mutateAsync(deleteConfirm).then(() => setDeleteConfirm(null))}>
            Archiver
          </Button>
        </div>
      </Dialog>

      {/* ─── Reject Dialog ────────────────────────────────────────────────── */}
      <Dialog isOpen={!!rejectDialog} onClose={() => setRejectDialog(null)} title="Rejeter le Devis" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Veuillez fournir un motif pour le rejet de ce devis.</p>
          <Input
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Motif de rejet (facultatif)"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejectDialog(null)}>Annuler</Button>
            <Button variant="danger"
              isLoading={!!(rejectDialog && actionLoading === rejectDialog.id + 'reject')}
              onClick={async () => {
                if (!rejectDialog) return;
                await doAction('reject', rejectDialog.id, { reason: rejectReason });
                setRejectDialog(null);
              }}>
              Rejeter le Devis
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
