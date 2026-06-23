import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FileText, Plus, Trash2, Download, FolderOpen, RotateCcw, Edit } from 'lucide-react';
import { useDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument, useRestoreDocument, type Document, downloadPdf } from '../../../hooks/use-api';
import {
  PageHeader, SearchInput, SelectFilter, DataTable, Pagination,
  Column, Dialog, FormField, Input, Select, Button, StatCard, Tabs,
} from '../../../components/shared/ui';
import { exportToCSV } from '../../../lib/export-csv';

const DOC_TYPES = [
  { label: 'Document employé', value: 'EMPLOYEE' },
  { label: 'Document client', value: 'CLIENT' },
  { label: 'Contrat', value: 'CONTRACT' },
  { label: 'Financier', value: 'FINANCIAL' },
  { label: 'RNE', value: 'RNE' },
  { label: 'MF', value: 'MF' },
  { label: 'Autre', value: 'OTHER' },
];

interface DocFormData {
  title: string;
  type: string;
  fileUrl?: string;
}

const formatBytes = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return '📄';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('image')) return '🖼️';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  return '📄';
};

export const DocumentsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useDocuments({
    page,
    limit: 12,
    search,
    type: typeFilter || undefined,
    isArchived: showArchived,
  });
  
  const createDocument = useCreateDocument();
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const restoreDocument = useRestoreDocument();
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DocFormData>({
    defaultValues: { type: 'OTHER' },
  });

  const onSubmit = async (formData: DocFormData) => {
    if (editingDocument) {
      await updateDocument.mutateAsync({ id: editingDocument.id, data: formData });
    } else {
      await createDocument.mutateAsync(formData);
    }
    setDialogOpen(false);
    reset();
    setEditingDocument(null);
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columnsToExport = [
      { header: 'Titre', key: 'title' },
      { header: 'Type', key: 'type' },
      { header: 'Taille', key: 'size', transform: (val?: number) => formatBytes(val) },
      { header: 'Lien', key: 'url' },
      { header: 'Créé le', key: 'createdAt', transform: (val: string) => new Date(val).toLocaleDateString() },
      { header: 'Mis à jour le', key: 'updatedAt', transform: (val: string) => new Date(val).toLocaleDateString() },
    ];
    exportToCSV(dataToExport, columnsToExport, `documents-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const columns: Column<Document>[] = [
    {
      key: 'title',
      header: 'Document',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="text-xl">{getFileIcon(row.mimeType)}</div>
          <div>
            <p className="font-semibold text-white text-sm">{row.title}</p>
            <p className="text-xs text-muted-foreground">{row.mimeType ?? 'Type inconnu'}</p>
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Catégorie', render: (row) => <span className="text-xs text-muted-foreground">{row.type.replace(/_/g, ' ')}</span> },
    { key: 'fileSize', header: 'Taille', render: (row) => formatBytes(row.size || row.fileSize) },
    { key: 'updatedAt', header: 'Modifié le', render: (row) => new Date(row.updatedAt).toLocaleDateString() },
    {
      key: 'actions', header: '', className: 'w-24',
      render: (row) => {
        const downloadUrl = row.url || row.fileUrl;
        return (
          <div className="flex gap-2">
            {((row as any).isArchived) ? (
              <button
                onClick={(e) => { e.stopPropagation(); restoreDocument.mutate(row.id); }}
                className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
                title="Restaurer"
              >
                <RotateCcw size={14} /> Restaurer
              </button>
            ) : (
              <>
                {downloadUrl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadPdf(downloadUrl, row.title); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                    title="Télécharger"
                  >
                    <Download size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDocument(row);
                    reset({
                      title: row.title,
                      type: row.type,
                      fileUrl: row.url || row.fileUrl || '',
                    });
                    setDialogOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                  title="Modifier"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(row.id); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  title="Archiver"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Bibliothèque de documents centralisée pour tous les fichiers de l'agence"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => { setEditingDocument(null); reset({ title: '', type: 'OTHER', fileUrl: '' }); setDialogOpen(true); }}>
              Téléverser un document
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total des Documents" value={data?.total ?? 0} icon={<FileText size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="Catégories" value={DOC_TYPES.length} icon={<FolderOpen size={20} />} colorClass="bg-purple-500/10 text-purple-400" />
        <StatCard label="Ce Mois-ci" value="—" icon={<FileText size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 items-center">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher des documents..." />
          <SelectFilter value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={DOC_TYPES} placeholder="Tous les types" />
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
              className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0"
            />
            Afficher Archivés
          </label>
          
          <Tabs
            tabs={[{ label: 'Tableau', value: 'table' }, { label: 'Grille', value: 'grid' }]}
            active={viewMode}
            onChange={setViewMode}
          />
        </div>
      </div>

      {viewMode === 'table' ? (
        <DataTable<Document>
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          emptyMessage="Aucun document trouvé."
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="glass-card rounded-2xl p-4 h-32 animate-pulse" />)
            : data?.data.map((doc) => (
                <div key={doc.id} className="glass-card rounded-2xl p-4 group hover:border-white/15 flex flex-col gap-3 relative">
                  <div className="text-3xl text-center py-2">{getFileIcon(doc.mimeType)}</div>
                  <div className="text-center">
                    <p className="font-semibold text-white text-xs line-clamp-2">{doc.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatBytes(doc.size || doc.fileSize)}</p>
                  </div>
                  <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {((doc as any).isArchived) ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); restoreDocument.mutate(doc.id); }}
                        className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
                        title="Restaurer"
                      >
                        <RotateCcw size={13} />
                      </button>
                    ) : (
                      <>
                        {(doc.url || doc.fileUrl) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadPdf(doc.url || doc.fileUrl || '', doc.title); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                            title="Télécharger"
                          >
                            <Download size={13} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDocument(doc);
                            reset({
                              title: doc.title,
                              type: doc.type,
                              fileUrl: doc.url || doc.fileUrl || '',
                            });
                            setDialogOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                          title="Modifier"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(doc.id); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                          title="Archiver"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={12} onPageChange={setPage} />
      )}

      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title={editingDocument ? "Modifier le document" : "Téléverser / Lier un document"} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Titre du document" required error={errors.title?.message}>
            <Input {...register('title', { required: 'Requis' })} placeholder="Rapport financier Q2" />
          </FormField>
          <FormField label="Catégorie" required>
            <Select {...register('type', { required: true })}>
              {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </FormField>
          <FormField label="URL du fichier">
            <Input {...register('fileUrl')} type="url" placeholder="https://drive.google.com/..." />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" isLoading={isSubmitting}>Enregistrer le document</Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer le document" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Supprimer définitivement ce document ?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteDocument.isPending} onClick={() => deleteConfirm && deleteDocument.mutateAsync(deleteConfirm).then(() => setDeleteConfirm(null))}>Supprimer</Button>
        </div>
      </Dialog>
    </div>
  );
};
