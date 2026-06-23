import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../../../lib/api';
import { X, AlertCircle } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roleId: string;
  role: Role;
  avatarUrl?: string | null;
  employeeProfile?: {
    id: string;
    phone?: string | null;
    jobTitle?: string | null;
    departmentId?: string | null;
  } | null;
}

interface UserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit: User | null;
  roles: Role[];
  departments: Department[];
  onSuccess: () => void;
}

const buildSchema = (isEdit: boolean) => {
  return z.object({
    firstName: z.string().min(1, { message: 'Le prénom est requis.' }),
    lastName: z.string().min(1, { message: 'Le nom est requis.' }),
    email: z.string().email({ message: 'Saisissez un e-mail valide.' }),
    password: isEdit
      ? z.string().optional().or(z.literal(''))
      : z.string().min(6, { message: 'Le mot de passe doit comporter au moins 6 caractères.' }),
    roleId: z.string().min(1, { message: 'Le rôle est requis.' }),
    isActive: z.boolean().default(true),
    phone: z.string().optional().or(z.literal('')),
    position: z.string().optional().or(z.literal('')),
    departmentId: z.string().optional().or(z.literal('')),
    avatarUrl: z.string().optional().or(z.literal('')),
  });
};

export const UserDialog = ({
  isOpen,
  onClose,
  userToEdit,
  roles,
  departments,
  onSuccess,
}: UserDialogProps) => {
  const isEdit = !!userToEdit;
  const schema = buildSchema(isEdit);
  type UserFormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      roleId: '',
      isActive: true,
      phone: '',
      position: '',
      departmentId: '',
      avatarUrl: '',
    },
  });

  const [apiError, setApiError] = React.useState<string | null>(null);

  // Sync edit values
  useEffect(() => {
    if (isOpen) {
      setApiError(null);
      if (userToEdit) {
        reset({
          firstName: userToEdit.firstName,
          lastName: userToEdit.lastName,
          email: userToEdit.email,
          roleId: userToEdit.roleId,
          isActive: userToEdit.isActive,
          password: '',
          phone: userToEdit.employeeProfile?.phone || '',
          position: userToEdit.employeeProfile?.jobTitle || '',
          departmentId: userToEdit.employeeProfile?.departmentId || '',
          avatarUrl: userToEdit.avatarUrl || '',
        });
      } else {
        reset({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          roleId: roles[0]?.id || '',
          isActive: true,
          phone: '',
          position: '',
          departmentId: '',
          avatarUrl: '',
        });
      }
    }
  }, [isOpen, userToEdit, reset, roles]);

  if (!isOpen) return null;

  const onSubmit = async (data: UserFormValues) => {
    setApiError(null);
    try {
      const payload: any = { ...data };
      if (isEdit && !payload.password) {
        delete payload.password; // Do not send empty password on update
      }

      // Format empty select values to null/empty string for profile mappings
      if (!payload.departmentId) payload.departmentId = null;

      if (isEdit && userToEdit) {
        await api.patch(`/users/${userToEdit.id}`, payload);
      } else {
        await api.post('/users', payload);
      }

      onSuccess();
      onClose();
    } catch (e: any) {
      setApiError(e.response?.data?.message || 'Une erreur est survenue lors de l\'enregistrement de l\'utilisateur.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal Card */}
      <div className="bg-[#16192a] w-full max-w-lg rounded-2xl border border-white/5 shadow-2xl relative z-10 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {isEdit ? 'Modifier le profil de l\'utilisateur' : 'Enregistrer un nouveau personnel'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {apiError && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-xs">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p>{apiError}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Prénom</label>
              <input
                type="text"
                placeholder="Jeanne"
                className="w-full px-3 py-2 glass-input text-xs border-white/10"
                {...register('firstName')}
              />
              {errors.firstName && <p className="text-[10px] text-red-400">{errors.firstName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Nom de famille</label>
              <input
                type="text"
                placeholder="Martin"
                className="w-full px-3 py-2 glass-input text-xs border-white/10"
                {...register('lastName')}
              />
              {errors.lastName && <p className="text-[10px] text-red-400">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Adresse e-mail</label>
              <input
                type="email"
                placeholder="jeanne.martin@creativart.tn"
                className="w-full px-3 py-2 glass-input text-xs border-white/10"
                {...register('email')}
              />
              {errors.email && <p className="text-[10px] text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Téléphone</label>
              <input
                type="text"
                placeholder="+216 55 555 555"
                className="w-full px-3 py-2 glass-input text-xs border-white/10"
                {...register('phone')}
              />
              {errors.phone && <p className="text-[10px] text-red-400">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Rôle système</label>
              <select
                className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                {...register('roleId')}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id} className="bg-card text-white">
                    {role.name}
                  </option>
                ))}
              </select>
              {errors.roleId && <p className="text-[10px] text-red-400">{errors.roleId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Département</label>
              <select
                className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                {...register('departmentId')}
              >
                <option value="">Sélectionner un département...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id} className="bg-card text-white">
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Poste / Position</label>
              <input
                type="text"
                placeholder="Développeur, Designer..."
                className="w-full px-3 py-2 glass-input text-xs border-white/10"
                {...register('position')}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Image de profil (URL)</label>
              <input
                type="text"
                placeholder="https://example.com/avatar.png"
                className="w-full px-3 py-2 glass-input text-xs border-white/10"
                {...register('avatarUrl')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">
              Mot de passe {isEdit && <span className="text-[10px] text-muted-foreground">(laisser vide pour conserver l'actuel)</span>}
            </label>
            <input
              type="password"
              placeholder={isEdit ? '••••••••' : 'Mot de passe (min 6 caractères)'}
              className="w-full px-3 py-2 glass-input text-xs border-white/10"
              {...register('password')}
            />
            {errors.password && <p className="text-[10px] text-red-400">{errors.password.message}</p>}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-indigo-500/20"
                {...register('isActive')}
              />
              <label htmlFor="isActive" className="text-xs font-semibold text-gray-300 cursor-pointer">
                Statut du compte actif
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-white/10 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
