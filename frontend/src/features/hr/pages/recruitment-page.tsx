import React, { useState } from 'react';
import {
  Briefcase,
  UserPlus,
  Download,
  Trash2,
  RotateCcw,
  Plus,
  Users,
  Mail,
  Phone,
} from 'lucide-react';
import {
  useVacancies,
  useCreateVacancy,
  useUpdateVacancy,
  useDeleteVacancy,
  useRestoreVacancy,
  useCandidates,
  useCreateCandidate,
  useUpdateCandidate,
  useDeleteCandidate,
  useRestoreCandidate,
  useDepartments,
  JobVacancy,
  Candidate,
} from '../../../hooks/use-api';
import {
  PageHeader,
  Tabs,
  Button,
  DataTable,
  Pagination,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  StatusBadge,
  SearchInput,
  SelectFilter,
} from '../../../components/shared/ui';
import { exportToCSV } from '../../../lib/export-csv';

export const RecruitmentPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('vacancies');

  // Search & Filter state for Vacancies
  const [vacancySearch, setVacancySearch] = useState('');
  const [vacancyDeptFilter, setVacancyDeptFilter] = useState('');
  const [vacancyStatusFilter, setVacancyStatusFilter] = useState('');
  const [vacancyPage, setVacancyPage] = useState(1);
  const [vacancyShowArchived, setVacancyShowArchived] = useState(false);

  // Search & Filter state for Candidates
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateVacancyFilter, setCandidateVacancyFilter] = useState('');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState('');
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateShowArchived, setCandidateShowArchived] = useState(false);

  // Modals state
  const [isVacancyModalOpen, setIsVacancyModalOpen] = useState(false);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);

  // Selected for edits
  const [selectedVacancy, setSelectedVacancy] = useState<JobVacancy | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Form states
  const [vacancyForm, setVacancyForm] = useState({
    title: '',
    departmentId: '',
    description: '',
    requirements: '',
    salaryRange: '',
    status: 'OPEN',
  });

  const [candidateForm, setCandidateForm] = useState({
    vacancyId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    resumeUrl: '',
    status: 'APPLIED',
    notes: '',
  });

  // Queries
  const { data: deptsData } = useDepartments({ limit: 100 });
  const departments = deptsData?.data ?? [];

  const { data: vacanciesListData } = useVacancies({ limit: 100 });
  const allVacanciesList = vacanciesListData?.data ?? [];

  const { data: vacanciesData, isLoading: isLoadingVacancies } = useVacancies({
    page: vacancyPage,
    limit: 10,
    search: vacancySearch,
    departmentId: vacancyDeptFilter || undefined,
    status: vacancyStatusFilter || undefined,
    isArchived: vacancyShowArchived,
  });

  const { data: candidatesData, isLoading: isLoadingCandidates } = useCandidates({
    page: candidatePage,
    limit: 10,
    search: candidateSearch,
    vacancyId: candidateVacancyFilter || undefined,
    status: candidateStatusFilter || undefined,
    isArchived: candidateShowArchived,
  });

  // Mutations
  const createVacancy = useCreateVacancy();
  const updateVacancy = useUpdateVacancy();
  const deleteVacancy = useDeleteVacancy();
  const restoreVacancy = useRestoreVacancy();

  const createCandidate = useCreateCandidate();
  const updateCandidate = useUpdateCandidate();
  const deleteCandidate = useDeleteCandidate();
  const restoreCandidate = useRestoreCandidate();

  // Vacancy Handlers
  const handleOpenVacancyModal = (vacancy?: JobVacancy) => {
    if (vacancy) {
      setSelectedVacancy(vacancy);
      setVacancyForm({
        title: vacancy.title,
        departmentId: vacancy.departmentId ?? '',
        description: vacancy.description ?? '',
        requirements: vacancy.requirements ?? '',
        salaryRange: vacancy.salaryRange ?? '',
        status: vacancy.status,
      });
    } else {
      setSelectedVacancy(null);
      setVacancyForm({
        title: '',
        departmentId: '',
        description: '',
        requirements: '',
        salaryRange: '',
        status: 'OPEN',
      });
    }
    setIsVacancyModalOpen(true);
  };

  const handleSaveVacancy = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVacancy) {
      updateVacancy.mutate(
        { id: selectedVacancy.id, data: vacancyForm },
        {
          onSuccess: () => {
            setIsVacancyModalOpen(false);
          },
        }
      );
    } else {
      createVacancy.mutate(vacancyForm, {
        onSuccess: () => {
          setIsVacancyModalOpen(false);
        },
      });
    }
  };

  const handleDeleteVacancy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Voulez-vous archiver cette offre d\'emploi ?')) {
      deleteVacancy.mutate(id);
    }
  };

  const handleRestoreVacancy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    restoreVacancy.mutate(id);
  };

  // Candidate Handlers
  const handleOpenCandidateModal = (candidate?: Candidate) => {
    if (candidate) {
      setSelectedCandidate(candidate);
      setCandidateForm({
        vacancyId: candidate.vacancyId ?? '',
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone ?? '',
        resumeUrl: candidate.resumeUrl ?? '',
        status: candidate.status,
        notes: candidate.notes ?? '',
      });
    } else {
      setSelectedCandidate(null);
      setCandidateForm({
        vacancyId: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        resumeUrl: '',
        status: 'APPLIED',
        notes: '',
      });
    }
    setIsCandidateModalOpen(true);
  };

  const handleSaveCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCandidate) {
      updateCandidate.mutate(
        { id: selectedCandidate.id, data: candidateForm },
        {
          onSuccess: () => {
            setIsCandidateModalOpen(false);
          },
        }
      );
    } else {
      createCandidate.mutate(candidateForm, {
        onSuccess: () => {
          setIsCandidateModalOpen(false);
        },
      });
    }
  };

  const handleDeleteCandidate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Voulez-vous archiver cette candidature ?')) {
      deleteCandidate.mutate(id);
    }
  };

  const handleRestoreCandidate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    restoreCandidate.mutate(id);
  };

  const handleUpdateCandidateStatus = (candidateId: string, status: string) => {
    updateCandidate.mutate({ id: candidateId, data: { status } });
  };

  // CSV Exports
  const handleExportVacancies = () => {
    const dataToExport = vacanciesData?.data ?? [];
    const columns = [
      { header: 'Titre', key: 'title' },
      { header: 'Département', key: 'department.name' },
      { header: 'Statut', key: 'status' },
      { header: 'Rémunération', key: 'salaryRange' },
      { header: 'Candidats', key: '_count.candidates' },
      { header: 'Date de création', key: 'createdAt', transform: (val: string) => new Date(val).toLocaleDateString() },
    ];
    exportToCSV(dataToExport, columns, `offres-emploi-${vacancyShowArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  const handleExportCandidates = () => {
    const dataToExport = candidatesData?.data ?? [];
    const columns = [
      { header: 'Prénom', key: 'firstName' },
      { header: 'Nom', key: 'lastName' },
      { header: 'E-mail', key: 'email' },
      { header: 'Téléphone', key: 'phone' },
      { header: 'Poste visé', key: 'vacancy.title' },
      { header: 'Statut', key: 'status' },
      { header: 'Notes', key: 'notes' },
      { header: 'Date de postulation', key: 'createdAt', transform: (val: string) => new Date(val).toLocaleDateString() },
    ];
    exportToCSV(dataToExport, columns, `candidats-${candidateShowArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  // Tab configurations
  const tabs = [
    { label: 'Offres d\'Emploi', value: 'vacancies' },
    { label: 'Candidats', value: 'candidates' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recrutement & Talent Acquisition"
        description="Gérez vos offres d'emploi actives et suivez le pipeline des candidats du premier screening jusqu'à l'offre d'embauche."
        actions={
          <div className="flex gap-2">
            {activeTab === 'vacancies' ? (
              <>
                <Button variant="secondary" onClick={handleExportVacancies} icon={<Download size={14} />}>
                  Exporter CSV
                </Button>
                <Button variant="primary" onClick={() => handleOpenVacancyModal()} icon={<Plus size={14} />}>
                  Nouvelle Offre
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={handleExportCandidates} icon={<Download size={14} />}>
                  Exporter CSV
                </Button>
                <Button variant="primary" onClick={() => handleOpenCandidateModal()} icon={<UserPlus size={14} />}>
                  Ajouter Candidat
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {/* Filters and Toggle Archived */}
        {activeTab === 'vacancies' ? (
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={vacancySearch} onChange={setVacancySearch} placeholder="Rechercher une offre..." />
            <SelectFilter
              value={vacancyDeptFilter}
              onChange={setVacancyDeptFilter}
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
              placeholder="Tous les départements"
            />
            <SelectFilter
              value={vacancyStatusFilter}
              onChange={setVacancyStatusFilter}
              options={[
                { label: 'Ouvert (OPEN)', value: 'OPEN' },
                { label: 'Fermé (CLOSED)', value: 'CLOSED' },
                { label: 'Brouillon (DRAFT)', value: 'DRAFT' },
              ]}
              placeholder="Tous les statuts"
            />
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                checked={vacancyShowArchived}
                onChange={(e) => {
                  setVacancyShowArchived(e.target.checked);
                  setVacancyPage(1);
                }}
                className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0"
              />
              Afficher Archivées
            </label>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={candidateSearch} onChange={setCandidateSearch} placeholder="Rechercher un candidat..." />
            <SelectFilter
              value={candidateVacancyFilter}
              onChange={setCandidateVacancyFilter}
              options={allVacanciesList.map((v) => ({ label: v.title, value: v.id }))}
              placeholder="Tous les postes"
            />
            <SelectFilter
              value={candidateStatusFilter}
              onChange={setCandidateStatusFilter}
              options={[
                { label: 'Nouveau (APPLIED)', value: 'APPLIED' },
                { label: 'Screening (SCREENING)', value: 'SCREENING' },
                { label: 'Entretien (INTERVIEW)', value: 'INTERVIEW' },
                { label: 'Offre formulée (OFFER)', value: 'OFFER' },
                { label: 'Embauché (HIRED)', value: 'HIRED' },
                { label: 'Rejeté (REJECTED)', value: 'REJECTED' },
              ]}
              placeholder="Tous les statuts"
            />
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                checked={candidateShowArchived}
                onChange={(e) => {
                  setCandidateShowArchived(e.target.checked);
                  setCandidatePage(1);
                }}
                className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0"
              />
              Afficher Archivées
            </label>
          </div>
        )}
      </div>

      {activeTab === 'vacancies' ? (
        <div className="space-y-4">
          <DataTable<JobVacancy>
            isLoading={isLoadingVacancies}
            data={vacanciesData?.data ?? []}
            keyExtractor={(v) => v.id}
            onRowClick={(v) => handleOpenVacancyModal(v)}
            emptyMessage="Aucune offre d'emploi trouvée."
            columns={[
              {
                key: 'title',
                header: 'Poste / Titre',
                render: (v) => (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <Briefcase size={14} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{v.title}</p>
                      <p className="text-[10px] text-muted-foreground">Créé le {new Date(v.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'department',
                header: 'Département',
                render: (v) => <span className="text-gray-300">{v.department?.name || 'Aucun'}</span>,
              },
              {
                key: 'salaryRange',
                header: 'Rémunération',
                render: (v) => <span className="text-gray-300 font-medium">{v.salaryRange || 'Non spécifié'}</span>,
              },
              {
                key: 'candidates',
                header: 'Candidatures',
                render: (v) => (
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <Users size={12} />
                    <span className="font-semibold">{(v as any)._count?.candidates ?? 0}</span>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Statut',
                render: (v) => <StatusBadge status={v.status} />,
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (v) => (
                  <div className="flex items-center gap-1.5">
                    {v.isArchived ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => handleRestoreVacancy(v.id, e)}
                        icon={<RotateCcw size={12} />}
                      >
                        Restaurer
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => handleDeleteVacancy(v.id, e)}
                        icon={<Trash2 size={12} />}
                      >
                        Archiver
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          {vacanciesData && (
            <Pagination
              page={vacancyPage}
              totalPages={vacanciesData.totalPages}
              total={vacanciesData.total}
              limit={vacanciesData.limit}
              onPageChange={setVacancyPage}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable<Candidate>
            isLoading={isLoadingCandidates}
            data={candidatesData?.data ?? []}
            keyExtractor={(c) => c.id}
            onRowClick={(c) => handleOpenCandidateModal(c)}
            emptyMessage="Aucun candidat trouvé."
            columns={[
              {
                key: 'name',
                header: 'Candidat',
                render: (c) => (
                  <div>
                    <p className="font-semibold text-white">
                      {c.firstName} {c.lastName}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail size={10} /> {c.email}
                      </span>
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={10} /> {c.phone}
                        </span>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: 'vacancy',
                header: 'Poste visé',
                render: (c) => (
                  <div>
                    <p className="text-gray-300 font-medium">{c.vacancy?.title || 'Non spécifié'}</p>
                    <p className="text-[10px] text-muted-foreground">{c.vacancy?.department?.name || ''}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Statut du pipeline',
                render: (c) => (
                  <select
                    value={c.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateCandidateStatus(c.id, e.target.value)}
                    className="glass-input text-xs px-2 py-1 bg-background appearance-none pr-6 max-w-[150px]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                  >
                    <option value="APPLIED">Postulé (APPLIED)</option>
                    <option value="SCREENING">Screening</option>
                    <option value="INTERVIEW">Entretien</option>
                    <option value="OFFER">Offre formulée</option>
                    <option value="HIRED">Embauché</option>
                    <option value="REJECTED">Rejeté</option>
                  </select>
                ),
              },
              {
                key: 'notes',
                header: 'Notes / Commentaires',
                render: (c) => (
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={c.notes || ''}>
                    {c.notes || 'Pas de note.'}
                  </p>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (c) => (
                  <div className="flex items-center gap-1.5">
                    {c.isArchived ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => handleRestoreCandidate(c.id, e)}
                        icon={<RotateCcw size={12} />}
                      >
                        Restaurer
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => handleDeleteCandidate(c.id, e)}
                        icon={<Trash2 size={12} />}
                      >
                        Archiver
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          {candidatesData && (
            <Pagination
              page={candidatePage}
              totalPages={candidatesData.totalPages}
              total={candidatesData.total}
              limit={candidatesData.limit}
              onPageChange={setCandidatePage}
            />
          )}
        </div>
      )}

      {/* Vacancy Dialog */}
      <Dialog
        isOpen={isVacancyModalOpen}
        onClose={() => setIsVacancyModalOpen(false)}
        title={selectedVacancy ? 'Modifier l\'offre d\'emploi' : 'Créer une nouvelle offre d\'emploi'}
        size="md"
      >
        <form onSubmit={handleSaveVacancy} className="space-y-4">
          <FormField label="Intitulé du poste" required>
            <Input
              value={vacancyForm.title}
              onChange={(e) => setVacancyForm({ ...vacancyForm, title: e.target.value })}
              placeholder="ex: Lead Developer React"
              required
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Département" required>
              <Select
                value={vacancyForm.departmentId}
                onChange={(e) => setVacancyForm({ ...vacancyForm, departmentId: e.target.value })}
                required
              >
                <option value="">Sélectionner...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Fourchette Salariale">
              <Input
                value={vacancyForm.salaryRange}
                onChange={(e) => setVacancyForm({ ...vacancyForm, salaryRange: e.target.value })}
                placeholder="ex: 3500 - 4500 TND"
              />
            </FormField>
          </div>

          <FormField label="Statut de l'offre">
            <Select
              value={vacancyForm.status}
              onChange={(e) => setVacancyForm({ ...vacancyForm, status: e.target.value })}
            >
              <option value="OPEN">Ouvert (OPEN)</option>
              <option value="CLOSED">Fermé (CLOSED)</option>
              <option value="DRAFT">Brouillon (DRAFT)</option>
            </Select>
          </FormField>

          <FormField label="Description du poste">
            <Textarea
              value={vacancyForm.description}
              onChange={(e) => setVacancyForm({ ...vacancyForm, description: e.target.value })}
              placeholder="Décrivez les missions et le contexte du poste..."
              rows={3}
            />
          </FormField>

          <FormField label="Exigences & Compétences">
            <Textarea
              value={vacancyForm.requirements}
              onChange={(e) => setVacancyForm({ ...vacancyForm, requirements: e.target.value })}
              placeholder="ex: Expérience React 3 ans, TypeScript, esprit d'équipe..."
              rows={3}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsVacancyModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" isLoading={createVacancy.isPending || updateVacancy.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Candidate Dialog */}
      <Dialog
        isOpen={isCandidateModalOpen}
        onClose={() => setIsCandidateModalOpen(false)}
        title={selectedCandidate ? 'Modifier la fiche candidat' : 'Ajouter un nouveau candidat'}
        size="md"
      >
        <form onSubmit={handleSaveCandidate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Prénom" required>
              <Input
                value={candidateForm.firstName}
                onChange={(e) => setCandidateForm({ ...candidateForm, firstName: e.target.value })}
                placeholder="Prénom"
                required
              />
            </FormField>

            <FormField label="Nom" required>
              <Input
                value={candidateForm.lastName}
                onChange={(e) => setCandidateForm({ ...candidateForm, lastName: e.target.value })}
                placeholder="Nom"
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="E-mail" required>
              <Input
                type="email"
                value={candidateForm.email}
                onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                placeholder="candidat@email.com"
                required
              />
            </FormField>

            <FormField label="Téléphone">
              <Input
                value={candidateForm.phone}
                onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                placeholder="+216 ..."
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Poste concerné" required>
              <Select
                value={candidateForm.vacancyId}
                onChange={(e) => setCandidateForm({ ...candidateForm, vacancyId: e.target.value })}
                required
              >
                <option value="">Associer à une offre...</option>
                {allVacanciesList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Statut du pipeline">
              <Select
                value={candidateForm.status}
                onChange={(e) => setCandidateForm({ ...candidateForm, status: e.target.value })}
              >
                <option value="APPLIED">Postulé (APPLIED)</option>
                <option value="SCREENING">Screening</option>
                <option value="INTERVIEW">Entretien</option>
                <option value="OFFER">Offre formulée</option>
                <option value="HIRED">Embauché</option>
                <option value="REJECTED">Rejeté</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Lien du CV (Google Drive, Dropbox, etc.)">
            <Input
              value={candidateForm.resumeUrl}
              onChange={(e) => setCandidateForm({ ...candidateForm, resumeUrl: e.target.value })}
              placeholder="https://..."
            />
          </FormField>

          <FormField label="Notes & Feedback">
            <Textarea
              value={candidateForm.notes}
              onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })}
              placeholder="Notes d'entretien, points forts, compétences techniques..."
              rows={4}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCandidateModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" isLoading={createCandidate.isPending || updateCandidate.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
