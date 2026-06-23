import React, { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  FileText, Plus, Trash2, DollarSign, Clock, CheckCircle, Download, Mail,
  XCircle, Send, Eye, PlusCircle, Package, ArrowRight, RotateCcw, Edit
} from 'lucide-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useRestoreInvoice, type Invoice, downloadPdf, useClientsList, useQuotes
} from '../../../hooks/use-api';
import { useAuth } from '../../../context/auth-context';
import { api } from '../../../lib/api';
import {
  PageHeader, SearchInput, SelectFilter, DataTable, Pagination,
  Column, StatusBadge, Dialog, FormField, Input, Button, StatCard, Select,
} from '../../../components/shared/ui';
import { exportToCSV } from '../../../lib/export-csv';

const INVOICE_STATUSES = [
  { label: 'Brouillon', value: 'DRAFT' },
  { label: "En attente d'approbation", value: 'PENDING_APPROVAL' },
  { label: 'Approuvée', value: 'APPROVED' },
  { label: 'Rejetée', value: 'REJECTED' },
  { label: 'Envoyée', value: 'SENT' },
  { label: 'Partiellement Payée', value: 'PARTIALLY_PAID' },
  { label: 'Payée', value: 'PAID' },
  { label: 'En retard', value: 'OVERDUE' },
  { label: 'Annulée', value: 'CANCELLED' },
];

const STATUS_PIPELINE = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PAID'];

const fmt = (n: number) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'TND' });

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface InvoiceFormData {
  clientId: string;
  quoteId?: string;
  dueDate: string;
  currency: string;
  notes?: string;
  terms?: string;
  items: LineItem[];
}

interface PaymentFormData {
  amount: number;
  method: string;
  paidAt: string;
  reference?: string;
  notes?: string;
}

// ─── Status Pipeline ──────────────────────────────────────────────────────────
const StatusPipeline: React.FC<{ currentStatus: string }> = ({ currentStatus }) => {
  const displayStatus = currentStatus === 'PARTIALLY_PAID' || currentStatus === 'OVERDUE' ? 'SENT' : currentStatus;
  const currentIndex = STATUS_PIPELINE.indexOf(displayStatus);
  return (
    <div className="flex items-center gap-1">
      {STATUS_PIPELINE.map((step, i) => {
        const isActive = i <= currentIndex || (step === 'PAID' && currentStatus === 'PAID');
        const isCurrent = step === displayStatus || (step === 'PAID' && currentStatus === 'PAID');
        const label = INVOICE_STATUSES.find(s => s.value === step)?.label ?? step;
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

// ─── Invoice Detail Dialog ───────────────────────────────────────────────────
const InvoiceDetailDialog: React.FC<{
  invoice: Invoice | null;
  onClose: () => void;
  onRecordPayment: (invoice: Invoice) => void;
  onSend: (id: string) => Promise<void>;
  onReminder: (id: string) => Promise<void>;
  onDownload: (invoice: Invoice) => Promise<void>;
  canCreate: boolean;
  canApprove: boolean;
}> = ({ invoice, onClose, onRecordPayment, onSend, onReminder, onDownload, canCreate, canApprove }) => {
  if (!invoice) return null;

  const [emailHistory, setEmailHistory] = React.useState<any[]>([]);
  const [emailTracking, setEmailTracking] = React.useState<any>(null);

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const [histRes, trackRes] = await Promise.all([
          api.get(`/finance/invoices/${invoice.id}/email-history`),
          api.get(`/finance/invoices/${invoice.id}/tracking`)
        ]);
        setEmailHistory(histRes.data);
        setEmailTracking(trackRes.data);
      } catch (err) {
        console.error("Failed to fetch invoice history/tracking:", err);
      }
    };
    fetchHistory();
  }, [invoice.id]);

  const items = invoice.items ?? [];
  const payments = invoice.payments ?? [];
  const subtotal = Number(invoice.subtotal ?? 0);
  const taxRate = Number(invoice.taxRate ?? 19);
  const taxAmount = Number(invoice.taxAmount ?? 0);
  const total = Number(invoice.total ?? invoice.totalAmount ?? 0);
  const paidAmount = Number(invoice.paidAmount ?? 0);
  const remaining = total - paidAmount;
  const progressPercent = total > 0 ? Math.min((paidAmount / total) * 100, 100) : 0;

  const getMethodLabel = (m: string) => {
    switch (m) {
      case 'BANK_TRANSFER': return 'Virement Bancaire';
      case 'CASH': return 'Espèces';
      case 'CHECK': return 'Chèque';
      case 'CREDIT_CARD': return 'Carte Bancaire';
      default: return 'Autre';
    }
  };

  const isSentOrOverdue = ['SENT', 'OVERDUE', 'PARTIALLY_PAID'].includes(invoice.status);

  return (
    <Dialog isOpen={true} onClose={onClose} title={`Facture ${invoice.reference ?? invoice.invoiceNumber}`} size="lg">
      <div className="space-y-5">
        {/* Actions Bar */}
        <div className="flex flex-wrap gap-2 pb-4 border-b border-white/10">
          <button
            onClick={async () => {
              try {
                const response = await api.get(`/finance/invoices/${invoice.id}/preview`, { responseType: 'blob' });
                const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, '_blank');
              } catch (err) {
                console.error("Preview error:", err);
                alert("Erreur lors de la prévisualisation de la facture.");
              }
            }}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"
          >
            <Eye size={14} /> Prévisualiser
          </button>
          
          <button
            onClick={() => onDownload(invoice)}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"
          >
            <Download size={14} /> Télécharger PDF
          </button>

          {invoice.status === 'APPROVED' && canCreate && (
            <button
              onClick={() => onSend(invoice.id)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all shadow-lg shadow-indigo-500/25"
            >
              <Send size={14} /> Envoyer la Facture
            </button>
          )}

          {isSentOrOverdue && canCreate && (
            <>
              <button
                onClick={() => onSend(invoice.id)}
                className="flex items-center gap-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
              >
                <Send size={14} /> Renvoyer
              </button>
              
              <button
                onClick={() => onReminder(invoice.id)}
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all shadow-lg shadow-amber-500/25"
              >
                <Mail size={14} /> Envoyer Relance
              </button>
            </>
          )}
        </div>

        {/* Status Pipeline */}
        <StatusPipeline currentStatus={invoice.status} />

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">Client</p>
            <p className="text-sm font-bold text-white">{invoice.client?.companyName ?? invoice.client?.name ?? '—'}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">Émise le</p>
            <p className="text-sm font-bold text-white">
              {invoice.issueDate || invoice.issuedDate ? new Date(invoice.issueDate || invoice.issuedDate!).toLocaleDateString('fr-FR') : '—'}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">Échéance</p>
            <p className="text-sm font-bold text-white">
              {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-FR') : '—'}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">Statut</p>
            <StatusBadge status={invoice.status} />
          </div>
        </div>

        {/* Payment Progress Bar */}
        {['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].includes(invoice.status) && (
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Suivi du Paiement</span>
              <span className="text-white">{progressPercent.toFixed(1)}% payé ({fmt(paidAmount)} / {fmt(total)})</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {remaining > 0 && (
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-red-400 font-bold">Reste à payer : {fmt(remaining)}</span>
                <button
                  onClick={() => onRecordPayment(invoice)}
                  className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <DollarSign size={12} /> Enregistrer un paiement
                </button>
              </div>
            )}
          </div>
        )}

        {/* Email Tracking Timeline */}
        {emailTracking && emailHistory.length > 0 && (
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Historique & Suivi des Relances</h4>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>Ouvertures : <b className="text-emerald-400">{emailTracking.summary.totalOpened}</b> ({emailTracking.summary.openedRate.toFixed(0)}%)</span>
                <span>Clics : <b className="text-indigo-400">{emailTracking.summary.totalClicked}</b> ({emailTracking.summary.clickedRate.toFixed(0)}%)</span>
              </div>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {emailHistory.map((log: any) => (
                <div key={log.id} className="relative pl-6 pb-2 border-l border-white/10 last:border-0 last:pb-0">
                  <div className={`absolute left-0 top-1.5 w-2 h-2 rounded-full -translate-x-[5px] ${
                    log.status === 'FAILED' ? 'bg-red-500' : log.status === 'OPENED' || log.status === 'CLICKED' ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`} />
                  
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-white">{log.subject}</p>
                      <p className="text-[10px] text-muted-foreground">Destinataire : {log.recipientName} ({log.recipientEmail})</p>
                      
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          log.status === 'FAILED' ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-300'
                        }`}>
                          {log.status}
                        </span>
                        {log.openedAt && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                            Ouvert le {new Date(log.openedAt).toLocaleString('fr-FR')}
                          </span>
                        )}
                        {log.clickedAt && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">
                            Cliqué le {new Date(log.clickedAt).toLocaleString('fr-FR')}
                          </span>
                        )}
                        {log.errorMessage && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                            {log.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Line Items */}
        {items.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
              <Package size={12} className="text-indigo-400" /> Prestations
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

        {/* Payments History */}
        {payments.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
              <DollarSign size={12} className="text-emerald-400" /> Historique des Paiements
            </h4>
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5">
                    <th className="text-left p-2.5 text-muted-foreground font-medium">Date</th>
                    <th className="text-left p-2.5 text-muted-foreground font-medium">Méthode</th>
                    <th className="text-left p-2.5 text-muted-foreground font-medium">Référence</th>
                    <th className="text-right p-2.5 text-muted-foreground font-medium w-28">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="p-2.5 text-white">{new Date(p.paidAt).toLocaleDateString('fr-FR')}</td>
                      <td className="p-2.5 text-white">{getMethodLabel(p.method)}</td>
                      <td className="p-2.5 text-muted-foreground font-mono">{p.reference ?? '—'}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-400">{fmt(Number(p.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes & Terms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {invoice.notes && (
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-1">Notes</p>
              <p className="text-xs text-white whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-1">Conditions de Règlement</p>
              <p className="text-xs text-white whitespace-pre-wrap">{invoice.terms}</p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Invoices Page
// ═══════════════════════════════════════════════════════════════════════════════
export const InvoicesPage: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isCEO = user?.role === 'GERANT';
  const isFinanceManager = user?.role === 'RESPONSABLE_FINANCIER';
  const canCreate = isCEO || user?.role === 'SECRETAIRE' || isFinanceManager;
  const canApprove = isCEO || isFinanceManager;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Load backend data
  const { data, isLoading } = useInvoices({
    page,
    limit: 10,
    search,
    status: statusFilter || undefined,
    isArchived: showArchived,
  });
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const restoreInvoice = useRestoreInvoice();

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Facture #', key: 'invoiceNumber' },
      { header: 'Client', key: 'client.companyName' },
      { header: 'Statut', key: 'status' },
      { header: 'Montant TTC', key: 'total' },
      { header: 'Montant Payé', key: 'paidAmount' },
      { header: 'Date d\'émission', key: 'issueDate', transform: (val: string) => val ? new Date(val).toLocaleDateString('fr-FR') : '' },
      { header: 'Échéance', key: 'dueDate', transform: (val: string) => val ? new Date(val).toLocaleDateString('fr-FR') : '' },
    ];
    exportToCSV(dataToExport, columns, `factures-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };
  const { data: clientsData } = useClientsList();
  const { data: quotesData } = useQuotes({ limit: 100 });

  const clients = clientsData?.data ?? [];
  // Only offer quotes that are APPROVED or ACCEPTED and don't have an invoice yet (or we can let user choose)
  const quotes = useMemo(() => {
    return (quotesData?.data ?? []).filter(q => ['APPROVED', 'ACCEPTED'].includes(q.status) && !q.invoice);
  }, [quotesData]);

  // Invoice creation form setup
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<InvoiceFormData>({
    defaultValues: {
      clientId: '',
      currency: 'TND',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [{ description: '', quantity: 1, unitPrice: 0, discount: 0 }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');
  const selectedQuoteId = watch('quoteId');

  // Load items from selected quote
  React.useEffect(() => {
    if (selectedQuoteId) {
      const loadQuoteDetails = async () => {
        try {
          const res = await api.get(`/finance/quotes/${selectedQuoteId}`);
          const quoteDetail = res.data;
          setValue('clientId', quoteDetail.clientId);
          setValue('notes', quoteDetail.notes ?? '');
          setValue('terms', quoteDetail.terms ?? '');
          if (quoteDetail.items && quoteDetail.items.length > 0) {
            replace(quoteDetail.items.map((item: any) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              discount: Number(item.discount),
            })));
          }
        } catch (err) {
          console.error('Error fetching quote details', err);
        }
      };
      loadQuoteDetails();
    }
  }, [selectedQuoteId, setValue, replace]);

  // Auto-calculate subtotal, tax amount, total
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

  // Payment Recording Form Setup
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({
    amount: 0,
    method: 'BANK_TRANSFER',
    paidAt: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  });

  const addPaymentMutation = useMutation({
    mutationFn: async ({ invoiceId, payment }: { invoiceId: string; payment: PaymentFormData }) => {
      const res = await api.post(`/finance/invoices/${invoiceId}/payments`, payment);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      // If detail view is open, refresh its data too
      if (detailInvoice) {
        api.get(`/finance/invoices/${detailInvoice.id}`).then(res => {
          setDetailInvoice(res.data);
        });
      }
    },
  });

  const doAction = async (action: string, id: string, body?: Record<string, any>) => {
    setActionLoading(id + action);
    try {
      await api.patch(`/finance/invoices/${id}/${action}`, body ?? {});
      qc.invalidateQueries({ queryKey: ['invoices'] });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendReminder = async (id: string) => {
    setActionLoading(id + 'reminder');
    try {
      await api.post(`/finance/invoices/${id}/reminder`);
      qc.invalidateQueries({ queryKey: ['invoices'] });
    } finally {
      setActionLoading(null);
    }
  };

  const onSubmit = async (formData: InvoiceFormData) => {
    if (editingInvoice) {
      await updateInvoice.mutateAsync({ id: editingInvoice.id, data: formData });
    } else {
      await createInvoice.mutateAsync(formData);
    }
    setDialogOpen(false);
    reset();
    setEditingInvoice(null);
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      await downloadPdf(`/finance/invoices/${invoice.id}/pdf`, `facture-${invoice.invoiceNumber || invoice.reference}.pdf`);
    } catch {
      // silently fail
    } finally {
      setDownloadingId(null);
    }
  };

  const viewDetail = async (invoice: Invoice) => {
    try {
      const res = await api.get(`/finance/invoices/${invoice.id}`);
      setDetailInvoice(res.data as Invoice);
    } catch {
      setDetailInvoice(invoice);
    }
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    await addPaymentMutation.mutateAsync({
      invoiceId: paymentInvoice.id,
      payment: paymentForm,
    });
    setPaymentInvoice(null);
  };

  const invoices = data?.data ?? [];
  const totalRevenue = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + Number(i.total ?? i.totalAmount ?? 0), 0);
  const pendingAmount = invoices.filter(i => ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status)).reduce((sum, i) => sum + (Number(i.total ?? i.totalAmount ?? 0) - Number(i.paidAmount ?? 0)), 0);
  const overdueCount = invoices.filter(i => i.status === 'OVERDUE').length;
  const pendingApproval = invoices.filter(i => i.status === 'PENDING_APPROVAL').length;

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Facture #',
      render: (row) => (
        <div>
          <p className="font-mono font-semibold text-white text-sm">{row.invoiceNumber ?? row.reference}</p>
          {row.client && <p className="text-xs text-muted-foreground mt-0.5">{row.client.companyName ?? row.client.name}</p>}
        </div>
      ),
    },
    { key: 'status', header: 'Statut', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'totalAmount',
      header: 'Montant TTC',
      render: (row) => (
        <span className="font-bold text-white">
          {fmt(Number(row.total ?? row.totalAmount ?? 0))}
        </span>
      ),
    },
    {
      key: 'paidAmount',
      header: 'Paiement',
      render: (row) => {
        const tot = Number(row.total ?? row.totalAmount ?? 0);
        const paid = Number(row.paidAmount ?? 0);
        const pct = tot > 0 ? Math.min((paid / tot) * 100, 100) : 0;
        return (
          <div className="w-32">
            <div className="flex justify-between text-[10px] mb-1 font-medium">
              <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
              <span className="text-white">{fmt(paid)}</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    { key: 'issueDate', header: 'Émise le', render: (row) => row.issueDate || row.issuedDate ? new Date(row.issueDate || row.issuedDate!).toLocaleDateString('fr-FR') : '—' },
    { key: 'dueDate', header: 'Échéance', render: (row) => row.dueDate ? new Date(row.dueDate).toLocaleDateString('fr-FR') : '—' },
    {
      key: 'actions', header: '', className: 'w-56',
      render: (row) => (
        <div className="flex items-center gap-1 flex-wrap">
          {((row as any).isArchived) ? (
            <button
              title="Restaurer"
              onClick={(e) => { e.stopPropagation(); restoreInvoice.mutate(row.id); }}
              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
            >
              <RotateCcw size={14} /> Restaurer
            </button>
          ) : (
            <>
              {/* Detail View */}
              <button
                title="Voir le détail"
                onClick={(e) => { e.stopPropagation(); viewDetail(row); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
              >
                <Eye size={14} />
              </button>

              {/* Record Payment */}
          {['APPROVED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(row.status) && (
            <button
              title="Enregistrer un paiement"
              onClick={(e) => {
                e.stopPropagation();
                setPaymentInvoice(row);
                setPaymentForm({
                  amount: Number(row.total ?? row.totalAmount ?? 0) - Number(row.paidAmount ?? 0),
                  method: 'BANK_TRANSFER',
                  paidAt: new Date().toISOString().split('T')[0],
                  reference: '',
                  notes: '',
                });
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
              <DollarSign size={14} />
            </button>
          )}

          {/* Edit Invoice */}
          {row.status === 'DRAFT' && canCreate && (
            <button
              title="Modifier la facture"
              onClick={(e) => {
                e.stopPropagation();
                setEditingInvoice(row);
                reset({
                  clientId: row.clientId,
                  quoteId: row.quoteId || '',
                  dueDate: row.dueDate ? new Date(row.dueDate).toISOString().split('T')[0] : '',
                  currency: row.currency || 'TND',
                  notes: row.notes || '',
                  terms: row.terms || '',
                  items: row.items ? row.items.map((item: any) => ({
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

          {/* CEO/Finance Manager: Approve/Reject */}
          {canApprove && row.status === 'PENDING_APPROVAL' && (
            <>
              <button
                title="Approuver la facture"
                onClick={(e) => { e.stopPropagation(); doAction('approve', row.id); }}
                disabled={actionLoading === row.id + 'approve'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
              >
                <CheckCircle size={14} />
              </button>
              <button
                title="Rejeter la facture"
                onClick={(e) => { e.stopPropagation(); setRejectDialog({ id: row.id }); setRejectReason(''); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <XCircle size={14} />
              </button>
            </>
          )}

          {/* Send (approved invoices) */}
          {row.status === 'APPROVED' && (
            <button
              title="Envoyer au client"
              onClick={(e) => { e.stopPropagation(); handleSendReminder(row.id); }}
              disabled={actionLoading === row.id + 'reminder'}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          )}

          {/* Send reminder */}
          {(row.status === 'SENT' || row.status === 'OVERDUE') && (
            <button
              title="Envoyer un rappel"
              onClick={(e) => { e.stopPropagation(); handleSendReminder(row.id); }}
              disabled={actionLoading === row.id + 'reminder'}
              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
            >
              <Mail size={14} />
            </button>
          )}

          {/* Download PDF */}
          <button
            title="Télécharger PDF"
            onClick={(e) => { e.stopPropagation(); handleDownloadPdf(row); }}
            disabled={downloadingId === row.id}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
          >
            <Download size={14} />
          </button>

          {/* Delete (Draft only) */}
          {row.status === 'DRAFT' && (isCEO || isFinanceManager) && (
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
        title="Gestion des Factures"
        description="Gérez la facturation, suivez les encaissements et les relances clients"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            {canCreate && <Button icon={<Plus size={16} />} onClick={() => { setEditingInvoice(null); reset({ clientId: '', quoteId: '', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], currency: 'TND', notes: '', terms: '', items: [{ description: '', quantity: 1, unitPrice: 0, discount: 0 }] }); setDialogOpen(true); }}>Nouvelle Facture</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Factures" value={data?.total ?? 0} icon={<FileText size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="Revenu Encaissé" value={fmt(totalRevenue)} icon={<DollarSign size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="Reste à Recouvrer" value={fmt(pendingAmount)} icon={<Clock size={20} />} colorClass="bg-amber-500/10 text-amber-400" />
        <StatCard label="Factures en Retard" value={overdueCount} icon={<CheckCircle size={20} />} colorClass="bg-red-500/10 text-red-400" />
      </div>

      {/* CEO/Finance Manager Alert for pending approvals */}
      {canApprove && pendingApproval > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Clock size={16} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            <span className="font-bold">{pendingApproval}</span> facture(s) en attente de votre approbation.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher des factures..." />
        <SelectFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={INVOICE_STATUSES} placeholder="Tous les statuts" />
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

      <DataTable<Invoice>
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Aucune facture trouvée."
        onRowClick={(row) => viewDetail(row)}
      />

      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={10} onPageChange={setPage} />
      )}

      {/* Create Dialog */}
      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title={editingInvoice ? "Modifier la Facture" : "Nouvelle Facture"} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Section 1: Quote Import & Client Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Informations Générales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Créer à partir d'un Devis (Optionnel)">
                <Select {...register('quoteId')}>
                  <option value="">— Sélectionner un devis —</option>
                  {quotes.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.reference} — {q.client?.companyName} ({fmt(Number(q.total ?? q.totalAmount ?? 0))})
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Client" required error={errors.clientId?.message}>
                <Select {...register('clientId', { required: 'Sélectionnez un client' })} disabled={!!selectedQuoteId}>
                  <option value="">— Sélectionner un client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Date d'échéance" required error={errors.dueDate?.message}>
                <Input {...register('dueDate', { required: 'Requis' })} type="date" />
              </FormField>
              <FormField label="Devise">
                <Select {...register('currency')} disabled={!!selectedQuoteId}>
                  <option value="TND">Dinar Tunisien (TND)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="USD">Dollar US (USD)</option>
                </Select>
              </FormField>
            </div>
          </div>

          {/* Section 2: Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Prestations</h4>
              {!selectedQuoteId && (
                <button
                  type="button"
                  onClick={() => append({ description: '', quantity: 1, unitPrice: 0, discount: 0 })}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <PlusCircle size={14} /> Ajouter une ligne
                </button>
              )}
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
                    {!selectedQuoteId && <th className="w-10"></th>}
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
                            disabled={!!selectedQuoteId}
                            placeholder="Description de la prestation"
                            className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            {...register(`items.${i}.quantity`, { valueAsNumber: true, min: 1 })}
                            disabled={!!selectedQuoteId}
                            type="number"
                            min="1"
                            className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-right focus:border-indigo-500 outline-none disabled:opacity-50"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            {...register(`items.${i}.unitPrice`, { valueAsNumber: true, min: 0 })}
                            disabled={!!selectedQuoteId}
                            type="number"
                            step="0.001"
                            min="0"
                            className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-right focus:border-indigo-500 outline-none disabled:opacity-50"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            {...register(`items.${i}.discount`, { valueAsNumber: true, min: 0, max: 100 })}
                            disabled={!!selectedQuoteId}
                            type="number"
                            min="0"
                            max="100"
                            className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-right focus:border-indigo-500 outline-none disabled:opacity-50"
                          />
                        </td>
                        <td className="p-1.5 text-right">
                          <span className="font-bold text-white text-xs">{fmt(lineTotal)}</span>
                        </td>
                        {!selectedQuoteId && (
                          <td className="p-1.5">
                            {fields.length > 1 && (
                              <button type="button" onClick={() => remove(i)} className="p-1 text-gray-500 hover:text-red-400">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Totals Summary */}
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
                placeholder="Notes à afficher sur la facture..."
                className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
              />
            </FormField>
            <FormField label="Conditions de paiement">
              <textarea
                {...register('terms')}
                rows={2}
                placeholder="Ex. Règlement à réception, virement sous 30 jours..."
                className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting}>Créer la Facture</Button>
          </div>
        </form>
      </Dialog>

      {/* Invoice Detail Dialog */}
      {detailInvoice && (
        <InvoiceDetailDialog
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
          onRecordPayment={(inv) => {
            setPaymentInvoice(inv);
            setPaymentForm({
              amount: Number(inv.total ?? inv.totalAmount ?? 0) - Number(inv.paidAmount ?? 0),
              method: 'BANK_TRANSFER',
              paidAt: new Date().toISOString().split('T')[0],
              reference: '',
              notes: '',
            });
          }}
          onSend={async (id) => {
            setActionLoading(id + 'send');
            try {
              await api.post(`/finance/invoices/${id}/send`);
              qc.invalidateQueries({ queryKey: ['invoices'] });
              const res = await api.get(`/finance/invoices/${id}`);
              setDetailInvoice(res.data);
            } catch (err) {
              console.error(err);
            } finally {
              setActionLoading(null);
            }
          }}
          onReminder={async (id) => {
            setActionLoading(id + 'reminder');
            try {
              await api.post(`/finance/invoices/${id}/reminder`);
              qc.invalidateQueries({ queryKey: ['invoices'] });
              const res = await api.get(`/finance/invoices/${id}`);
              setDetailInvoice(res.data);
            } catch (err) {
              console.error(err);
            } finally {
              setActionLoading(null);
            }
          }}
          onDownload={handleDownloadPdf}
          canCreate={canCreate}
          canApprove={canApprove}
        />
      )}

      {/* Record Payment Dialog */}
      <Dialog isOpen={!!paymentInvoice} onClose={() => setPaymentInvoice(null)} title="Enregistrer un Paiement" size="sm">
        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Saisissez les détails du paiement reçu pour la facture <span className="font-bold text-white">{paymentInvoice?.reference ?? paymentInvoice?.invoiceNumber}</span>.
          </p>

          <FormField label="Montant Reçu (TND)" required>
            <Input
              type="number"
              step="0.001"
              min="0.01"
              max={paymentInvoice ? Number(paymentInvoice.total ?? paymentInvoice.totalAmount ?? 0) - Number(paymentInvoice.paidAmount ?? 0) : undefined}
              value={paymentForm.amount}
              onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
              required
            />
          </FormField>

          <FormField label="Moyen de Paiement" required>
            <Select
              value={paymentForm.method}
              onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
            >
              <option value="BANK_TRANSFER">Virement Bancaire</option>
              <option value="CHECK">Chèque</option>
              <option value="CASH">Espèces</option>
              <option value="CREDIT_CARD">Carte Bancaire</option>
              <option value="OTHER">Autre</option>
            </Select>
          </FormField>

          <FormField label="Date de Paiement" required>
            <Input
              type="date"
              value={paymentForm.paidAt}
              onChange={e => setPaymentForm({ ...paymentForm, paidAt: e.target.value })}
              required
            />
          </FormField>

          <FormField label="Référence de Transaction">
            <Input
              placeholder="Ex. N° chèque, N° virement..."
              value={paymentForm.reference}
              onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })}
            />
          </FormField>

          <FormField label="Notes">
            <Input
              placeholder="Notes optionnelles..."
              value={paymentForm.notes}
              onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setPaymentInvoice(null)}>Annuler</Button>
            <Button type="submit" isLoading={addPaymentMutation.isPending}>Enregistrer</Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Archiver la Facture" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Êtes-vous sûr de vouloir archiver cette facture ? Vous pourrez la restaurer ultérieurement.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteInvoice.isPending} onClick={() => deleteConfirm && deleteInvoice.mutateAsync(deleteConfirm).then(() => setDeleteConfirm(null))}>Archiver</Button>
        </div>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog isOpen={!!rejectDialog} onClose={() => setRejectDialog(null)} title="Rejeter la Facture" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Veuillez fournir un motif pour le rejet de cette facture.</p>
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
              Rejeter la Facture
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
