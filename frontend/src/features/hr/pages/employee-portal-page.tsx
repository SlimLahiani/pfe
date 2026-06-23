import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Clock,
  User,
  Calendar,
  FileText,
  Play,
  Square,
  Plus,
  Download,
  Upload,
  Save,
  Phone,
  MapPin,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/auth-context';
import {
  useEmployees,
  useMyAttendance,
  useCheckIn,
  useCheckOut,
  useLeaveRequests,
  useCreateLeaveRequest,
  usePayslips,
  useUpdateEmployee,
  downloadPdf,
} from '../../../hooks/use-api';
import { PageHeader, Button, FormField, Input, Select, Textarea } from '../../../components/shared/ui';

interface ProfileFormData {
  phone: string;
  address: string;
}

interface LeaveFormData {
  startDate: string;
  endDate: string;
  type: string;
  reason?: string;
}

const LEAVE_TYPES = [
  { label: 'Congé annuel', value: 'ANNUAL' },
  { label: 'Congé maladie', value: 'SICK' },
  { label: 'Congé maternité/paternité', value: 'PARENTAL' },
  { label: 'Congé sans solde', value: 'UNPAID' },
  { label: 'Autre', value: 'OTHER' },
];

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const EmployeePortalPage: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'clock' | 'profile' | 'leaves' | 'payslips'>('clock');
  
  // Timer for active check-in
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Queries
  const { data: employeesData } = useEmployees({ limit: 100 });
  const { data: attendanceData, refetch: refetchAttendance } = useMyAttendance();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  // Find own employee profile
  const myProfile = (employeesData?.data ?? []).find(e => e.userId === user?.id);

  // Leave Requests Query
  const { data: leavesData } = useLeaveRequests({ page: 1, limit: 50 });
  const myLeaves = (leavesData?.data ?? []).filter(lr => lr.employeeId === myProfile?.id);
  const createLeave = useCreateLeaveRequest();

  // Payslips Query
  const { data: payslipsData } = usePayslips(myProfile?.id ?? '');
  
  // Mutations
  const updateProfileMutation = useUpdateEmployee();

  // Forms
  const { register: regProfile, handleSubmit: handleProfileSubmit, setValue: setProfileValue, formState: { isSubmitting: isProfileSaving } } = useForm<ProfileFormData>();
  const { register: regLeave, handleSubmit: handleLeaveSubmit, reset: resetLeaveForm, formState: { isSubmitting: isLeaveSubmitting } } = useForm<LeaveFormData>({
    defaultValues: { type: 'ANNUAL' },
  });

  // Prepopulate profile form when loaded
  useEffect(() => {
    if (myProfile) {
      setProfileValue('phone', myProfile.phone ?? '');
      setProfileValue('address', myProfile.address ?? '');
    }
  }, [myProfile, setProfileValue]);

  // Attendance state
  const todayRecord = attendanceData && attendanceData.length > 0 ? attendanceData[0] : null;
  const isCheckedIn = todayRecord && todayRecord.checkIn && !todayRecord.checkOut;

  // Active clock timer
  useEffect(() => {
    let interval: any;
    if (isCheckedIn && todayRecord?.checkIn) {
      const checkInTime = new Date(todayRecord.checkIn).getTime();
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - checkInTime) / 1000);
        setTimerSeconds(elapsed > 0 ? elapsed : 0);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isCheckedIn, todayRecord]);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Profile save handler
  const onProfileSave = async (formData: ProfileFormData) => {
    if (!myProfile) return;
    await updateProfileMutation.mutateAsync({
      id: myProfile.id,
      data: {
        phone: formData.phone,
        address: formData.address,
      },
    });
    qc.invalidateQueries({ queryKey: ['employees'] });
  };

  // Leave request handler
  const onLeaveSubmit = async (formData: LeaveFormData) => {
    if (!myProfile) return;
    await createLeave.mutateAsync(formData);
    qc.invalidateQueries({ queryKey: ['leave-requests'] });
    resetLeaveForm();
  };

  // Check In Handler
  const handleCheckIn = async () => {
    await checkInMutation.mutateAsync();
    refetchAttendance();
  };

  // Check Out Handler
  const handleCheckOut = async () => {
    await checkOutMutation.mutateAsync();
    refetchAttendance();
  };

  // Leave balances
  const balances = myProfile?.leaveBalances ?? [];
  const annualBalance = Number(balances.find((b: any) => b.leaveType === 'ANNUAL')?.totalDays ?? 26);
  const annualUsed = Number(balances.find((b: any) => b.leaveType === 'ANNUAL')?.usedDays ?? 0);
  const sickBalance = Number(balances.find((b: any) => b.leaveType === 'SICK')?.totalDays ?? 10);
  const sickUsed = Number(balances.find((b: any) => b.leaveType === 'SICK')?.usedDays ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portail RH Collaborateur"
        description={`Bienvenue, ${user?.firstName} ${user?.lastName} — Gérer vos émargements, congés et documents`}
      />

      {/* Tabs */}
      <div className="flex border-b border-white/5 space-x-6 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('clock')}
          className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'clock'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <Clock size={16} /> Émargement
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <User size={16} /> Mon Profil
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'leaves'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <Calendar size={16} /> Mes Congés
        </button>
        <button
          onClick={() => setActiveTab('payslips')}
          className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'payslips'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <FileText size={16} /> Fiches de Paie
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'clock' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Clock In / Out Console */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center space-y-6">
            <div>
              <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider">Feuille de présence agence</span>
              <h3 className="text-lg font-bold text-white mt-1">Enregistrement d'activité</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="w-48 h-48 rounded-full bg-white/[0.01] border-2 border-white/5 flex flex-col items-center justify-center relative shadow-inner">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Durée de service</span>
              <span className="font-mono text-2xl font-black text-white mt-1">
                {isCheckedIn ? formatTimer(timerSeconds) : '00:00:00'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/5 text-gray-300 border border-white/5 mt-2 uppercase">
                {isCheckedIn ? 'Actif' : 'Arrêté'}
              </span>
            </div>

            <div className="flex gap-4 w-full">
              {!isCheckedIn ? (
                <Button
                  onClick={handleCheckIn}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 border-0"
                >
                  <Play size={16} fill="white" /> Signaler Arrivée
                </Button>
              ) : (
                <Button
                  onClick={handleCheckOut}
                  className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-500/10 border-0"
                >
                  <Square size={16} fill="white" /> Signaler Départ
                </Button>
              )}
            </div>

            {/* Note */}
            <p className="text-[10px] text-muted-foreground">
              Note: Tout retard de pointage après 9h15 est automatiquement marqué dans votre historique.
            </p>
          </div>

          {/* Clock History */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Historique des émargements</h3>
              <p className="text-xs text-muted-foreground mb-4">Vos pointages d'activité récents</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-muted-foreground font-semibold">
                      <th className="py-2">Date</th>
                      <th className="py-2">Arrivée</th>
                      <th className="py-2">Départ</th>
                      <th className="py-2">Durée cumulée</th>
                      <th className="py-2">Heures Supp.</th>
                      <th className="py-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-200">
                    {attendanceData && attendanceData.length > 0 ? (
                      attendanceData.map((rec) => (
                        <tr key={rec.id} className="hover:bg-white/[0.01]">
                          <td className="py-2">{new Date(rec.date).toLocaleDateString('fr-FR')}</td>
                          <td className="py-2 font-mono text-gray-300">
                            {rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-2 font-mono text-gray-300">
                            {rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-2 font-mono">{Number(rec.hoursWorked ?? 0).toFixed(2)} h</td>
                          <td className="py-2 font-mono text-emerald-400">+{Number(rec.overtime ?? 0).toFixed(2)} h</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                              rec.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              rec.status === 'LATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              rec.status === 'REMOTE' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                              'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {rec.status === 'PRESENT' ? 'Présent' :
                               rec.status === 'LATE' ? 'En retard' :
                               rec.status === 'REMOTE' ? 'Télétravail' : 'Absent'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          Aucun émargement enregistré dans l'historique.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Card: Personal info read-only */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="text-center pb-4 border-b border-white/5">
              <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 mx-auto flex items-center justify-center font-bold text-xl text-indigo-300 mb-3">
                {user?.firstName[0]}{user?.lastName[0]}
              </div>
              <h3 className="text-sm font-bold text-white">{user?.firstName} {user?.lastName}</h3>
              <p className="text-xs text-indigo-400 font-semibold">{myProfile?.jobTitle}</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-white/5 text-gray-300 border border-white/5 uppercase font-mono">
                {myProfile?.employeeCode}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase font-bold">Département</p>
                <p className="text-xs text-white font-medium">{myProfile?.department?.name ?? 'Management'}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase font-bold">Date d'embauche</p>
                <p className="text-xs text-white font-medium">
                  {myProfile?.hireDate ? new Date(myProfile.hireDate).toLocaleDateString('fr-FR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase font-bold">Matricule National (CIN)</p>
                <p className="text-xs text-white font-medium">{myProfile?.nationalId ?? '—'}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase font-bold">Contact d'urgence</p>
                <p className="text-xs text-white font-medium">{myProfile?.emergencyContact ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* Form: Editable contacts */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Mettre à jour mes coordonnées</h3>
              <p className="text-xs text-muted-foreground">Modifier vos coordonnées personnelles stockées sur la fiche RH</p>
            </div>

            <form onSubmit={handleProfileSubmit(onProfileSave)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Téléphone personnel">
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <Input
                      {...regProfile('phone')}
                      placeholder="+216 -- --- ---"
                      className="pl-10"
                    />
                  </div>
                </FormField>
              </div>

              <FormField label="Adresse de résidence">
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 text-gray-500" size={14} />
                  <Input
                    {...regProfile('address')}
                    placeholder="Adresse complète..."
                    className="pl-10"
                  />
                </div>
              </FormField>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={isProfileSaving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-2"
                >
                  <Save size={14} /> Sauvegarder les modifications
                </Button>
              </div>
            </form>

            <div className="border-t border-white/5 pt-6 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-white mb-1">Dossier de documents RH</h4>
                <p className="text-[10px] text-muted-foreground">Soumettre des justificatifs administratifs originaux (Format PDF)</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Copie Carte d'Identité (CIN)</p>
                    <p className="text-[9px] text-muted-foreground">Obligatoire pour la gestion de paie</p>
                  </div>
                  <Button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/5">
                    <Upload size={14} />
                  </Button>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Copie Diplômes</p>
                    <p className="text-[9px] text-muted-foreground">Preuve de qualification professionnelle</p>
                  </div>
                  <Button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/5">
                    <Upload size={14} />
                  </Button>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Side: Leave Balances & Form */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Soldes de Congés</h3>
              <p className="text-xs text-muted-foreground">Année en cours : 2026</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5 text-center">
                <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Congé Annuel Restant</span>
                <p className="font-mono text-2xl font-black text-white mt-1">
                  {Number(annualBalance - annualUsed).toFixed(1)} j
                </p>
                <span className="text-[8px] text-muted-foreground block mt-1">sur {Number(annualBalance).toFixed(1)} j total</span>
              </div>
              <div className="p-4 rounded-xl border border-pink-500/10 bg-pink-500/5 text-center">
                <span className="text-[9px] text-pink-400 font-bold uppercase tracking-wider">Congé Maladie Restant</span>
                <p className="font-mono text-2xl font-black text-white mt-1">
                  {Number(sickBalance - sickUsed).toFixed(1)} j
                </p>
                <span className="text-[8px] text-muted-foreground block mt-1">sur {Number(sickBalance).toFixed(1)} j total</span>
              </div>
            </div>

            <div className="border-t border-white/5 pt-6 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-white mb-1">Soumettre une demande</h4>
                <p className="text-[10px] text-muted-foreground">Créer une demande de congé à valider par le management</p>
              </div>

              <form onSubmit={handleLeaveSubmit(onLeaveSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Date de début">
                    <Input type="date" {...regLeave('startDate', { required: true })} />
                  </FormField>
                  <FormField label="Date de fin">
                    <Input type="date" {...regLeave('endDate', { required: true })} />
                  </FormField>
                </div>

                <FormField label="Type de congé">
                  <Select {...regLeave('type')}>
                    {LEAVE_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Motif (optionnel)">
                  <Textarea {...regLeave('reason')} placeholder="Raison de la demande..." rows={3} />
                </FormField>

                <Button
                  type="submit"
                  disabled={isLeaveSubmitting}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> Soumettre la demande
                </Button>
              </form>
            </div>
          </div>

          {/* Table: History of own leave requests */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 lg:col-span-2 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Historique des demandes</h3>
              <p className="text-xs text-muted-foreground">Suivi des validations et attestations d'absence</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-muted-foreground font-semibold">
                    <th className="py-2">Période</th>
                    <th className="py-2">Durée</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Statut</th>
                    <th className="py-2">Notes RH</th>
                    <th className="py-2 text-right">Attestation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-200">
                  {myLeaves.length > 0 ? (
                    myLeaves.map((lr) => (
                      <tr key={lr.id} className="hover:bg-white/[0.01]">
                        <td className="py-2">
                          {new Date(lr.startDate).toLocaleDateString('fr-FR')} — {new Date(lr.endDate).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-2 font-mono">{Number(lr.days).toFixed(1)} j</td>
                        <td className="py-2 capitalize">{lr.type.toLowerCase()}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                            lr.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            lr.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            lr.status === 'REVIEWED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {lr.status === 'APPROVED' ? 'Approuvé' :
                             lr.status === 'PENDING' ? 'En attente RH' :
                             lr.status === 'REVIEWED' ? 'En attente CEO' : 'Rejeté'}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground truncate max-w-[150px]">
                          {lr.reviewNote ?? '—'}
                        </td>
                        <td className="py-2 text-right">
                          {lr.status === 'APPROVED' ? (
                            <button
                              onClick={() => downloadPdf(`/hr/leave-requests/${lr.id}/pdf`, `accord-conge-${lr.id}.pdf`)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-400 border border-white/5 hover:border-emerald-500/30 transition-all"
                            >
                              <Download size={13} />
                            </button>
                          ) : (
                            <button disabled className="p-1.5 rounded-lg text-gray-600 bg-white/[0.01] border border-white/5 cursor-not-allowed">
                              <Download size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        Aucune demande de congé soumise pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'payslips' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Bulletins de Salaire</h3>
            <p className="text-xs text-muted-foreground">Historique et téléchargement de vos fiches de paie mensuelles (TND)</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 text-muted-foreground font-semibold">
                  <th className="py-3">Période</th>
                  <th className="py-3">Salaire de Base</th>
                  <th className="py-3">Primes</th>
                  <th className="py-3">Déductions / Retenues</th>
                  <th className="py-3">Heures Supp.</th>
                  <th className="py-3 font-bold">Net à Payer (TND)</th>
                  <th className="py-3">Statut</th>
                  <th className="py-3 text-right">Fiche de Paie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-200">
                {payslipsData && payslipsData.length > 0 ? (
                  payslipsData.map((p) => {
                    const monthName = MONTHS_FR[p.month - 1] ?? p.month;
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.01]">
                        <td className="py-3 font-semibold text-white">{monthName} {p.year}</td>
                        <td className="py-3 font-mono text-gray-300">{Number(p.baseSalary).toFixed(3)} TND</td>
                        <td className="py-3 font-mono text-emerald-400">+{Number(p.bonuses).toFixed(3)} TND</td>
                        <td className="py-3 font-mono text-rose-400">-{Number(p.deductions).toFixed(3)} TND</td>
                        <td className="py-3 font-mono text-emerald-400">+{Number(p.overtime).toFixed(3)} TND</td>
                        <td className="py-3 font-mono text-white font-bold">{Number(p.netSalary).toFixed(3)} TND</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                            p.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {p.status === 'PAID' ? 'Payé' : 'Brouillon'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => downloadPdf(`/hr/payslips/${p.id}/pdf`, `bulletin-salaire-${p.month}-${p.year}.pdf`)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-indigo-400 border border-white/5 hover:border-indigo-500/30 transition-all flex items-center gap-1.5 ml-auto text-[10px] font-semibold"
                          >
                            <Download size={13} /> PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      Aucune fiche de paie mensuelle disponible pour l'instant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
