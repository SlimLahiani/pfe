import React, { useState } from 'react';
import { FileText, Download, Eye, Calendar, HardDrive } from 'lucide-react';
import { useDocuments, downloadPdf, type Document } from '../../../hooks/use-api';
import { api } from '../../../lib/api';
import {
  PageHeader, SearchInput, SelectFilter, DataTable, Pagination,
  Column, Dialog, Button, StatCard
} from '../../../components/shared/ui';

const ENTITY_TYPES = [
  { label: 'Factures', value: 'INVOICE' },
  { label: 'Devis', value: 'QUOTE' },
  { label: 'Fiches de Paie', value: 'PAYSLIP' },
  { label: 'Attestations de Travail', value: 'WORK_CERTIFICATE' },
  { label: 'Attestations de Salaire', value: 'SALARY_CERTIFICATE' },
  { label: 'Attestations de Stage', value: 'INTERNSHIP_CERTIFICATE' },
  { label: 'Contrats de Travail', value: 'EMPLOYMENT_CONTRACT' },
  { label: 'Approbations de Congé', value: 'LEAVE_APPROVAL' },
];

const formatBytes = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const getEntityLabel = (type?: string) => {
  if (!type) return 'Autre';
  const found = ENTITY_TYPES.find(t => t.value === type);
  return found ? found.label.replace(/s$/, '') : type.replace(/_/g, ' ');
};

export const DocumentsHistoryPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [previewingDoc, setPreviewingDoc] = useState<Document | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch only generated archived documents
  const { data, isLoading } = useDocuments({
    page,
    limit: 10,
    search,
    entityType: entityTypeFilter || undefined,
    isArchived: true,
  });

  const handlePreview = async (doc: Document) => {
    setPreviewLoading(true);
    setPreviewingDoc(doc);
    try {
      // Let's get the document details to find download url
      const docDetailRes = await api.get(`/documents/${doc.id}`);
      const downloadUrl = docDetailRes.data.url || `/documents/${docDetailRes.data.storedFileName}/download`;
      
      const response = await api.get(downloadUrl, { responseType: 'blob' });
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      setPreviewUrl(blobUrl);
      setPreviewTitle(doc.title);
    } catch (err) {
      console.error("Preview error:", err);
      alert('Erreur lors de la génération de l\'aperçu PDF.');
      setPreviewingDoc(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const docDetailRes = await api.get(`/documents/${doc.id}`);
      const downloadUrl = docDetailRes.data.url || `/documents/${docDetailRes.data.storedFileName}/download`;
      await downloadPdf(downloadUrl, doc.title);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  const columns: Column<Document>[] = [
    {
      key: 'title',
      header: 'Nom du Fichier',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="text-xl">📕</div>
          <div>
            <p className="font-semibold text-white text-sm">{(row as any).originalFileName || row.title}</p>
            <p className="text-xs text-muted-foreground font-mono">{(row as any).storedFileName || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'entityType',
      header: 'Type de Document',
      render: (row) => (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          {getEntityLabel((row as any).entityType)}
        </span>
      ),
    },
    {
      key: 'fileSize',
      header: 'Taille',
      render: (row) => formatBytes((row as any).size || (row as any).fileSize)
    },
    {
      key: 'createdAt',
      header: 'Généré le',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar size={13} />
          {new Date(row.createdAt).toLocaleString('fr-FR')}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handlePreview(row)}
            disabled={previewLoading && previewingDoc?.id === row.id}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white hover:text-indigo-400 border border-white/5 transition-all text-xs font-semibold flex items-center gap-1"
            title="Prévisualiser"
          >
            <Eye size={14} />
            <span>Aperçu</span>
          </button>
          <button
            onClick={() => handleDownload(row)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white hover:text-emerald-400 border border-white/5 transition-all text-xs font-semibold flex items-center gap-1"
            title="Télécharger"
          >
            <Download size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique des Documents"
        description="Consultez et prévisualisez tous les documents PDF officiels générés par l'application."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Documents Archivés"
          value={data?.total ?? 0}
          icon={<FileText size={20} />}
          colorClass="bg-indigo-500/10 text-indigo-400"
        />
        <StatCard
          label="Types de Document"
          value={ENTITY_TYPES.length}
          icon={<HardDrive size={20} />}
          colorClass="bg-purple-500/10 text-purple-400"
        />
        <StatCard
          label="Dernière Génération"
          value={data?.data && data.data.length > 0 ? new Date(data.data[0].createdAt).toLocaleDateString('fr-FR') : '—'}
          icon={<Calendar size={20} />}
          colorClass="bg-emerald-500/10 text-emerald-400"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Rechercher par nom de fichier..."
        />
        <SelectFilter
          value={entityTypeFilter}
          onChange={(v) => { setEntityTypeFilter(v); setPage(1); }}
          options={ENTITY_TYPES}
          placeholder="Tous les types"
        />
      </div>

      <DataTable<Document>
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Aucun document généré trouvé."
      />

      {data && data.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          total={data.total}
          limit={10}
          onPageChange={setPage}
        />
      )}

      {/* PDF Preview Modal */}
      <Dialog
        isOpen={!!previewUrl}
        onClose={() => {
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          setPreviewUrl(null);
          setPreviewingDoc(null);
        }}
        title={`Aperçu : ${previewTitle}`}
        size="lg"
      >
        <div className="space-y-4">
          {previewUrl && (
            <iframe
              src={previewUrl}
              title={previewTitle}
              className="w-full h-[650px] rounded-2xl border border-white/10 bg-[#0f0f13]"
            />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                }
                setPreviewUrl(null);
                setPreviewingDoc(null);
              }}
            >
              Fermer
            </Button>
            {previewingDoc && (
              <Button
                variant="primary"
                icon={<Download size={15} />}
                onClick={() => handleDownload(previewingDoc)}
              >
                Télécharger le PDF
              </Button>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};
