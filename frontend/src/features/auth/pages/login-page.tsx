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
    { label: 'Directeur Général', email: 'ceo@creativart.tn', icon: Briefcase, color: 'text-indigo-500 bg-indigo-50 hover:bg-indigo-100/50' },
    { label: 'Responsable RH', email: 'hr@creativart.tn', icon: Users, color: 'text-pink-500 bg-pink-50 hover:bg-pink-100/50' },
    { label: 'Responsable Financier', email: 'finance@creativart.tn', icon: Wallet, color: 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100/50' },
    { label: 'Secrétaire', email: 'secretary@creativart.tn', icon: PenTool, color: 'text-amber-500 bg-amber-50 hover:bg-amber-100/50' },
    { label: 'Employé', email: 'employee1@creativart.tn', icon: Code, color: 'text-blue-500 bg-blue-50 hover:bg-blue-100/50' },
  ];

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-[#fafafc]">
      
      {/* LEFT SIDE: Brand Showcase (Visible only on lg screens) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-primary text-white relative overflow-hidden">
        {/* Shifting Gradient Mesh */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/30 rounded-full blur-[120px] animate-blob-1 pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[600px] h-[600px] bg-violet-500/20 rounded-full blur-[140px] animate-blob-2 pointer-events-none" />
        <div className="absolute top-[30%] right-[10%] w-[350px] h-[350px] bg-pink-500/10 rounded-full blur-[110px] animate-blob-3 pointer-events-none" />

        {/* Floating Particles */}
        <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-white/20 rounded-full blur-[1px] animate-particle-1" />
        <div className="absolute bottom-1/3 right-1/4 w-4 h-4 bg-white/10 rounded-full blur-[2px] animate-particle-2" />

        {/* Top Branding Logo */}
        <div className="z-10 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <div className="bg-white/95 backdrop-blur-md pl-1.5 pr-4 py-1.5 rounded-2xl shadow-lg inline-flex items-center gap-2 border border-white/10">
            <Logo iconSize="sm" />
            <span className="font-extrabold text-foreground tracking-tight text-sm uppercase">AgencyOS</span>
          </div>
        </div>

        {/* Center Headline */}
        <div className="z-10 max-w-md space-y-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            La plateforme de collaboration pour agences créatives.
          </h1>
          <p className="text-indigo-100 text-sm leading-relaxed font-medium">
            Gérez vos tâches Kanban, communiquez via des appels en direct, gérez les dossiers RH et la facturation client au même endroit.
          </p>
        </div>

        {/* Bottom Feature highlights */}
        <div className="z-10 max-w-md animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="space-y-3.5">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                <Sparkles size={16} />
              </div>
              <div>
                <h4 className="font-bold text-xs">Messagerie & Appels en Temps Réel</h4>
                <p className="text-[10px] text-indigo-200 mt-0.5">Discutez, partagez vos écrans et activez votre caméra.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                <Users size={16} />
              </div>
              <div>
                <h4 className="font-bold text-xs">Tableau Kanban Interactif</h4>
                <p className="text-[10px] text-indigo-200 mt-0.5">Glissez-déposez vos tâches pour modifier instantanément leur statut.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                <Wallet size={16} />
              </div>
              <div>
                <h4 className="font-bold text-xs">Finance & Facturation Pro</h4>
                <p className="text-[10px] text-indigo-200 mt-0.5">Émettez des factures avec logo et générez des rapports PDF.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Interactive Login Form Container */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#fafafc] relative overflow-hidden">
        {/* Dynamic mesh backgrounds for mobile (hidden on lg) */}
        <div className="lg:hidden absolute top-[-10%] left-[-10%] w-[350px] h-[350px] bg-primary/10 rounded-full blur-[100px] animate-blob-1 pointer-events-none" />
        <div className="lg:hidden absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-400/8 rounded-full blur-[110px] animate-blob-2 pointer-events-none" />

        {/* Floating particles */}
        <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-primary/25 rounded-full blur-[0.5px] animate-particle-1" />
        <div className="absolute bottom-1/4 left-1/4 w-3.5 h-3.5 bg-indigo-400/20 rounded-full blur-[1.5px] animate-particle-2" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808007_1px,transparent_1px),linear-gradient(to_bottom,#80808007_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

        <div className="w-full max-w-md z-10">
          
          {/* Logo & Headline for mobile screens (hidden on desktop lg) */}
          <div className="lg:hidden text-center mb-8 flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-black/[0.05] text-primary text-xs font-semibold mb-6 shadow-sm">
              <Sparkles size={12} className="animate-spin text-primary mr-1" style={{ animationDuration: '4s' }} />
              Portail Interne
            </div>
            <Logo iconSize="xl" showText={true} className="flex-col !gap-3 text-center items-center justify-center scale-110 mb-1" />
            <p className="text-muted-foreground text-xs mt-3 font-medium tracking-wide">
              Le moteur de travail pour les agences créatives modernes.
            </p>
          </div>

          {/* Form Card wrapper */}
          <div 
            className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 border border-black/[0.06] shadow-[0_0_50px_rgba(99,102,241,0.03)] hover:shadow-[0_0_60px_rgba(99,102,241,0.12)] hover:border-primary/25 transition-all duration-500 animate-fade-in-up"
            style={{ animationDelay: '300ms' }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Connexion</h2>
              <p className="text-xs text-muted-foreground mt-1 font-medium">Entrez vos identifiants pour accéder à votre espace.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-700 px-4 py-3 rounded-2xl text-sm animate-fade-in">
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="font-medium text-xs">{error}</p>
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1.5 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
                <label className="text-xs font-bold text-foreground/80 tracking-wide">
                  Adresse Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary group-focus-within:scale-105 transition-all duration-300">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    placeholder="nom@agency.com"
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-black/10 focus:ring-4 focus:ring-primary/10 focus:border-primary/60 outline-none text-sm transition-all duration-300 bg-black/[0.01] focus:bg-white hover:border-black/20"
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

              {/* Password Input */}
              <div className="space-y-1.5 animate-fade-in-up" style={{ animationDelay: '420ms' }}>
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-foreground/80 tracking-wide">
                    Mot de passe
                  </label>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary group-focus-within:scale-105 transition-all duration-300">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-3.5 rounded-xl border border-black/10 focus:ring-4 focus:ring-primary/10 focus:border-primary/60 outline-none text-sm transition-all duration-300 bg-black/[0.01] focus:bg-white hover:border-black/20"
                    {...register('password')}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95 transition-all"
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
              <div className="animate-fade-in-up" style={{ animationDelay: '490ms' }}>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative overflow-hidden bg-primary hover:bg-primary/95 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none text-sm group"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Se connecter au tableau de bord
                      <ArrowRight size={16} className="ml-1 group-hover:translate-x-1.5 transition-transform duration-300" />
                    </>
                  )}
                  {/* Reflection shine sweep */}
                  <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/10 opacity-40 group-hover:animate-shine" />
                </button>
              </div>
            </form>

            {/* Test accounts trigger */}
            <div 
              className="mt-8 pt-6 border-t border-black/[0.06] flex flex-col items-center animate-fade-in-up"
              style={{ animationDelay: '560ms' }}
            >
              <button
                onClick={() => setShowSeedAccounts(!showSeedAccounts)}
                className="text-xs text-primary/80 hover:text-primary font-bold flex items-center gap-2 transition-colors focus:outline-none hover:scale-105 transform duration-300"
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
                          className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs hover:bg-white border border-transparent hover:border-black/[0.05] text-gray-700 flex justify-between items-center transition-all duration-300 hover:shadow-sm hover:scale-[1.01]"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg transition-all ${acc.color}`}>
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

          {/* Mobile restricted note (hidden on lg desktop) */}
          <p 
            className="lg:hidden text-center text-[10px] text-muted-foreground font-semibold mt-8 uppercase tracking-wider animate-fade-in-up"
            style={{ animationDelay: '630ms' }}
          >
            Accès restreint · Membres autorisés uniquement
          </p>
        </div>
      </div>
      
    </div>
  );
};
