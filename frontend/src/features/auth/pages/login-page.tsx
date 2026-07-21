import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../../context/auth-context';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { Logo } from '../../../components/shared/logo';

const loginSchema = z.object({
  email: z.string().email({ message: 'Entrez une adresse email valide.' }),
  password: z.string().min(6, { message: 'Le mot de passe doit comporter au moins 6 caractères.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSeedAccounts, setShowSeedAccounts] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Échec de la connexion. Veuillez vérifier vos identifiants.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredentials = (email: string) => {
    setValue('email', email);
    setValue('password', 'AgencyOS@2026!');
    setShowSeedAccounts(false);
  };

  const seedAccounts = [
    { label: 'Directeur Général (CEO)', email: 'ceo@creativart.tn' },
    { label: 'Responsable RH', email: 'hr@creativart.tn' },
    { label: 'Responsable Financier', email: 'finance@creativart.tn' },
    { label: 'Secrétaire', email: 'secretary@creativart.tn' },
    { label: 'Employé', email: 'employee1@creativart.tn' },
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-background">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-primary/5 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '1s' }} />

      <div className="w-full max-w-md z-10">
        {/* Brand Logo header */}
        <div className="text-center mb-8 animate-fade-in flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-primary text-xs font-medium mb-6 shadow-sm">
            <Sparkles size={12} className="animate-spin text-primary" style={{ animationDuration: '4s' }} />
            Portail Interne
          </div>
          <Logo iconSize="xl" showText={true} className="flex-col !gap-4 text-center items-center justify-center scale-110 mb-2" />
          <p className="text-muted-foreground text-xs mt-3">
            Le moteur de travail pour les agences créatives modernes.
          </p>
        </div>

        {/* Card wrapper */}
        <div className="glass-panel rounded-2xl shadow-2xl border border-black/[0.06] p-8 animate-fade-in relative overflow-hidden">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm animate-fade-in">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 tracking-wide">
                Adresse Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  placeholder="nom@agency.com"
                  className="w-full pl-10 pr-4 py-2.5 glass-input text-sm border-black/10 hover:border-black/20 focus:border-primary focus:bg-card/80"
                  {...register('email')}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-700 tracking-wide">
                  Mot de passe
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 glass-input text-sm border-black/10 hover:border-black/20 focus:border-primary focus:bg-card/80"
                  {...register('password')}
                  disabled={isLoading}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:brightness-110 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Se connecter au tableau de bord
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick seed credentials section */}
          <div className="mt-8 pt-6 border-t border-black/5 flex flex-col items-center">
            <button
              onClick={() => setShowSeedAccounts(!showSeedAccounts)}
              className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1.5 transition-colors focus:outline-none"
            >
              <ShieldAlert size={14} />
              Identifiants de test ? Cliquez pour afficher
            </button>

            {showSeedAccounts && (
              <div className="w-full grid grid-cols-1 gap-2 mt-4 animate-fade-in bg-black/[0.02] rounded-xl p-3 border border-black/5">
                <p className="text-[10px] text-muted-foreground text-center mb-1">
                  Cliquez sur un compte pour pré-remplir (mot de passe: AgencyOS@2026!)
                </p>
                {seedAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => fillCredentials(acc.email)}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-black/5 border border-transparent hover:border-black/5 text-gray-700 flex justify-between items-center transition-all"
                  >
                    <span>{acc.label}</span>
                    <span className="text-[10px] text-muted-foreground">{acc.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Ce système est privé et restreint. Membres de l'agence autorisés uniquement.
        </p>
      </div>
    </div>
  );
};
