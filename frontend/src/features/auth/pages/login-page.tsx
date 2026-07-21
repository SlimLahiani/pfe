import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../../context/auth-context';
import { 
  Lock, Mail, AlertCircle, ArrowRight, ShieldAlert, Sparkles, 
  Eye, EyeOff, Briefcase, Users, Wallet, PenTool, Code 
} from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);

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
    { label: 'Directeur Général', email: 'ceo@creativart.tn', icon: Briefcase, color: 'text-indigo-500 bg-indigo-50' },
    { label: 'Responsable RH', email: 'hr@creativart.tn', icon: Users, color: 'text-pink-500 bg-pink-50' },
    { label: 'Responsable Financier', email: 'finance@creativart.tn', icon: Wallet, color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Secrétaire', email: 'secretary@creativart.tn', icon: PenTool, color: 'text-amber-500 bg-amber-50' },
    { label: 'Employé', email: 'employee1@creativart.tn', icon: Code, color: 'text-blue-500 bg-blue-50' },
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-[#fafafc]">
      {/* Premium animated background mesh blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-blob-1 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-400/8 rounded-full blur-[130px] animate-blob-2 pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[400px] h-[400px] bg-violet-300/8 rounded-full blur-[110px] animate-blob-3 pointer-events-none" />

      {/* Grid Pattern overlay for depth */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand Logo header */}
        <div className="text-center mb-8 animate-fade-in flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-black/[0.05] text-primary text-xs font-semibold mb-6 shadow-sm hover:scale-105 transition-all">
            <Sparkles size={12} className="animate-spin text-primary mr-1" style={{ animationDuration: '4s' }} />
            Portail Interne
          </div>
          <Logo iconSize="xl" showText={true} className="flex-col !gap-3 text-center items-center justify-center scale-110 mb-1" />
          <p className="text-muted-foreground text-xs mt-3 font-medium tracking-wide">
            Le moteur de travail pour les agences créatives modernes.
          </p>
        </div>

        {/* Card wrapper */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-black/[0.06] p-8 animate-fade-in relative overflow-hidden transition-all duration-300 hover:shadow-black/[0.04]">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-700 px-4 py-3 rounded-2xl text-sm animate-fade-in">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="font-medium text-xs">{error}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80 tracking-wide">
                Adresse Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  placeholder="nom@agency.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-black/10 focus:ring-4 focus:ring-primary/10 focus:border-primary/60 outline-none text-sm transition-all bg-black/[0.01] focus:bg-white"
                  {...register('email')}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 flex items-center gap-1 font-medium mt-1">
                  <AlertCircle size={12} /> {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-foreground/80 tracking-wide">
                  Mot de passe
                </label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-black/10 focus:ring-4 focus:ring-primary/10 focus:border-primary/60 outline-none text-sm transition-all bg-black/[0.01] focus:bg-white"
                  {...register('password')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 flex items-center gap-1 font-medium mt-1">
                  <AlertCircle size={12} /> {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Se connecter au tableau de bord
                  <ArrowRight size={16} className="ml-1" />
                </>
              )}
            </button>
          </form>

          {/* Quick seed credentials section */}
          <div className="mt-8 pt-6 border-t border-black/[0.06] flex flex-col items-center">
            <button
              onClick={() => setShowSeedAccounts(!showSeedAccounts)}
              className="text-xs text-primary/80 hover:text-primary font-bold flex items-center gap-2 transition-colors focus:outline-none"
            >
              <ShieldAlert size={14} className="text-primary/70" />
              Identifiants de démonstration ? Afficher
            </button>

            {showSeedAccounts && (
              <div className="w-full mt-4 space-y-2 animate-fade-in bg-black/[0.01] rounded-2xl p-4 border border-black/[0.04]">
                <p className="text-[10px] text-muted-foreground text-center font-semibold mb-2">
                  Sélectionnez un rôle pour pré-remplir la connexion :
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {seedAccounts.map((acc) => {
                    const IconComponent = acc.icon;
                    return (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => fillCredentials(acc.email)}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs hover:bg-white border border-transparent hover:border-black/[0.05] text-gray-700 flex justify-between items-center transition-all hover:shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${acc.color}`}>
                            <IconComponent size={14} />
                          </div>
                          <span className="font-bold text-[11px] text-foreground">{acc.label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">{acc.email}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-muted-foreground font-semibold mt-8 uppercase tracking-wider">
          Accès restreint · Membres autorisés uniquement
        </p>
      </div>
    </div>
  );
};
