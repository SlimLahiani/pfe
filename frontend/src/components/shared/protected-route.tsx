import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  allowedRoles?: string[];
}

export const ProtectedRoute = ({
  children,
  requiredPermission,
  allowedRoles,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasPermission, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground animate-pulse font-medium">Initialisation de la sécurité CREATIVART...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login but store current location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    // Render high fidelity access denied page
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full glass-panel rounded-2xl p-8 text-center animate-fade-in border-red-500/10">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse-glow">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Accès Restreint</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Votre rôle actuel ne possède pas les autorisations requises pour consulter ce module.
          </p>
          <div className="bg-white/5 border border-white/5 rounded-lg px-4 py-3 mb-6 inline-block text-xs font-mono text-indigo-300">
            Requis : {requiredPermission}
          </div>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-medium py-2.5 px-4 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Render high fidelity access denied page for role
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full glass-panel rounded-2xl p-8 text-center animate-fade-in border-red-500/10">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse-glow">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Accès Restreint</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Votre rôle actuel ({user.role}) n'est pas autorisé à consulter ce module.
          </p>
          <div className="bg-white/5 border border-white/5 rounded-lg px-4 py-3 mb-6 inline-block text-xs font-mono text-indigo-300">
            Rôles autorisés : {allowedRoles.join(', ')}
          </div>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-medium py-2.5 px-4 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
