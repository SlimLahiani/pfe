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
    <div className="min-h-screen w-full flex overflow-hidden bg-white select-none">
      
      {/* LEFT SIDE: Brand Showcase (Inspired by user uploaded vector layout) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-primary text-white relative overflow-hidden">
        
        {/* Topographic Wave Lines (Vector SVGs at corners) */}
        <div className="absolute top-0 left-0 w-64 h-64 opacity-25 pointer-events-none">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
            <path d="M10 80 C 40 10, 60 10, 100 80 C 150 130, 80 180, 200 130" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M20 90 C 50 20, 70 20, 110 90 C 160 140, 90 190, 200 150" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M30 100 C 60 30, 80 30, 120 100 C 170 150, 100 200, 200 170" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </div>
        
        <div className="absolute bottom-0 right-0 w-80 h-80 opacity-25 pointer-events-none">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
            <path d="M0 120 C 60 180, 130 130, 150 70 C 170 10, 120 0, 200 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M0 135 C 70 195, 140 145, 160 85 C 180 25, 130 15, 200 35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M0 150 C 80 210, 150 160, 170 100 C 190 40, 140 30, 200 50" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </div>

        {/* Scattered Plus and Circle Shapes */}
        <div className="absolute top-12 left-1/2 text-white/35 font-light text-2xl pointer-events-none animate-pulse">+</div>
        <div className="absolute bottom-28 left-1/3 text-white/35 font-light text-2xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }}>+</div>
        
        <div className="absolute top-36 right-1/4 w-3.5 h-3.5 border-2 border-white/25 rounded-full pointer-events-none animate-bounce" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 left-12 w-4 h-4 border-2 border-white/25 rounded-full pointer-events-none animate-bounce" style={{ animationDuration: '6s' }} />

        {/* Scattered Dot Grid Matrix */}
        <div className="absolute top-12 right-12 opacity-30 grid grid-cols-4 gap-1.5 pointer-events-none">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 bg-white rounded-full" />
          ))}
        </div>

        {/* Top Branding (Transparent PNG, No Background Logo Container) */}
        <div className="z-10 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-sm">
              <Logo iconSize="sm" />
            </div>
            <span className="font-black text-xl tracking-tight uppercase text-white">CreativArt</span>
          </div>
        </div>

        {/* Center Headline (Inspired by Welcome back!) */}
        <div className="z-10 max-w-md space-y-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <h1 className="text-5xl font-black tracking-tight leading-tight">
            Welcome back!
          </h1>
          <p className="text-white/80 text-base leading-relaxed font-semibold">
            You can sign in to access with your existing account.
          </p>
        </div>

        {/* Bottom Feature highlights with float animations */}
        <div className="z-10 max-w-md space-y-3 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3.5 rounded-2xl backdrop-blur-md hover:bg-white/10 transition-all duration-300 animate-card-float">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
              <Sparkles size={14} />
            </div>
            <div>
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-white">Messagerie & Appels</h4>
              <p className="text-[10px] text-white/60">Discutez, partagez vos écrans et activez votre caméra.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3.5 rounded-2xl backdrop-blur-md hover:bg-white/10 transition-all duration-300 animate-card-float" style={{ animationDelay: '2s' }}>
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
              <Users size={14} />
            </div>
            <div>
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-white">Gestion de Projet</h4>
              <p className="text-[10px] text-white/60">Glissez-déposez vos livrables sur le tableau Kanban.</p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Interactive Login Form Container (White theme inspired by template) */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white relative overflow-hidden">
        
        {/* Mobile Background decoration */}
        <div className="lg:hidden absolute top-[-10%] left-[-10%] w-[350px] h-[350px] bg-primary/10 rounded-full blur-[100px] animate-blob-1 pointer-events-none" />
        <div className="lg:hidden absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-400/8 rounded-full blur-[110px] animate-blob-2 pointer-events-none" />

        <div className="w-full max-w-md z-10 space-y-8">
          
          {/* Brand Logo & Intro for mobile screens (hidden on desktop lg) */}
          <div className="lg:hidden text-center flex flex-col items-center animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="bg-primary/5 p-3 rounded-3xl border border-primary/10 mb-4 shadow-sm">
              <Logo iconSize="md" />
            </div>
            <h2 className="text-3xl font-black text-foreground tracking-tight">CreativArt</h2>
            <p className="text-muted-foreground text-xs font-semibold mt-2">
              Le moteur de travail pour les agences créatives modernes.
            </p>
          </div>

          <div className="space-y-6">
            {/* Page Header */}
            <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <h2 className="text-4xl font-extrabold text-foreground tracking-tight">Sign In</h2>
              <p className="text-xs text-muted-foreground mt-1.5 font-medium">Entrez vos identifiants pour accéder à votre espace de travail.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/15 text-red-700 px-4 py-3.5 rounded-2xl text-xs animate-fade-in font-medium">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {/* Email Input - Pill Rounded */}
              <div className="space-y-1.5 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="relative group input-underline">
                  <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-[#7c3aed] transition-colors">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    placeholder="Username or email"
                    className="w-full pl-11 pr-4 py-3.5 rounded-full border border-black/10 focus:ring-4 focus:ring-primary/5 focus:border-[#7c3aed] outline-none text-sm transition-all duration-300 bg-white hover:border-black/20"
                    {...register('email')}
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500 flex items-center gap-1 font-semibold mt-1.5 pl-3">
                    <AlertCircle size={12} /> {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password Input - Pill Rounded */}
              <div className="space-y-1.5 animate-fade-in-up" style={{ animationDelay: '380ms' }}>
                <div className="relative group input-underline">
                  <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-[#7c3aed] transition-colors">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    className="w-full pl-11 pr-11 py-3.5 rounded-full border border-black/10 focus:ring-4 focus:ring-primary/5 focus:border-[#7c3aed] outline-none text-sm transition-all duration-300 bg-white hover:border-black/20"
                    {...register('password')}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 flex items-center gap-1 font-semibold mt-1.5 pl-3">
                    <AlertCircle size={12} /> {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember Me and Forgot Password row */}
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1.5 animate-fade-in-up" style={{ animationDelay: '460ms' }}>
                <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                  <input type="checkbox" className="rounded border-black/10 text-primary focus:ring-primary" />
                  <span>Remember me</span>
                </label>
                <a href="#forgot" className="text-muted-foreground hover:text-primary transition-colors">Forgot password?</a>
              </div>

              {/* Sign In Button - Pill Rounded Gradient */}
              <div className="animate-fade-in-up" style={{ animationDelay: '540ms' }}>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative overflow-hidden bg-gradient-to-r from-[#312e81] to-primary text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/35 hover:brightness-105 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none text-sm group"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight size={16} className="ml-1 group-hover:translate-x-1.5 transition-transform duration-300" />
                    </>
                  )}
                  {/* Reflection shine sweep */}
                  <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/10 opacity-30 group-hover:animate-shine" />
                </button>
              </div>
            </form>

            {/* Test Accounts Drawer (styled cleanly at bottom) */}
            <div 
              className="mt-8 pt-6 border-t border-black/[0.06] flex flex-col items-center animate-fade-in-up"
              style={{ animationDelay: '620ms' }}
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

          {/* Footer note */}
          <p 
            className="text-center text-[10px] text-muted-foreground font-semibold uppercase tracking-wider animate-fade-in-up"
            style={{ animationDelay: '700ms' }}
          >
            Accès sécurisé CreativArt
          </p>
        </div>
      </div>
      
    </div>
  );
};
