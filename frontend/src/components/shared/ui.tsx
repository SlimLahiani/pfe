import React from 'react';
import { cn } from '../../lib/utils';

// ─── Badge ────────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-white/5 text-gray-300 border-white/10',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  info: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => (
  <span
    className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide',
      badgeVariants[variant],
      className
    )}
  >
    {children}
  </span>
);

// ─── Status Badge Helper ──────────────────────────────────────────────────────

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  // Generic
  ACTIVE: 'success', INACTIVE: 'default', PENDING: 'warning',
  APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'danger',
  // Lead statuses
  NEW: 'info', CONTACTED: 'purple', QUALIFIED: 'success', LOST: 'danger',
  // Project statuses
  PLANNING: 'purple', IN_PROGRESS: 'info', COMPLETED: 'success', ON_HOLD: 'warning',
  // Task statuses
  TODO: 'default', IN_REVIEW: 'purple', DONE: 'success', BLOCKED: 'danger',
  // Finance statuses
  DRAFT: 'default', SENT: 'info', PAID: 'success', OVERDUE: 'danger', PARTIALLY_PAID: 'warning',
  ACCEPTED: 'success', EXPIRED: 'danger',
  // Priority
  LOW: 'default', MEDIUM: 'warning', HIGH: 'danger', URGENT: 'danger',
};

const STATUS_FRENCH_MAP: Record<string, string> = {
  ACTIVE: 'ACTIF',
  INACTIVE: 'INACTIF',
  PENDING: 'EN ATTENTE',
  APPROVED: 'APPROUVÉ',
  REJECTED: 'REJETÉ',
  CANCELLED: 'ANNULÉ',
  NEW: 'NOUVEAU',
  CONTACTED: 'CONTACTÉ',
  QUALIFIED: 'QUALIFIÉ',
  LOST: 'PERDU',
  PLANNING: 'PLANIFICATION',
  IN_PROGRESS: 'EN COURS',
  COMPLETED: 'TERMINÉ',
  ON_HOLD: 'EN PAUSE',
  TODO: 'À FAIRE',
  IN_REVIEW: 'EN RÉVISION',
  DONE: 'FAIT',
  BLOCKED: 'BLOQUÉ',
  DRAFT: 'BROUILLON',
  SENT: 'ENVOYÉ',
  PAID: 'PAYÉ',
  OVERDUE: 'EN RETARD',
  PARTIALLY_PAID: 'PARTIELLEMENT PAYÉ',
  ACCEPTED: 'ACCEPTÉ',
  EXPIRED: 'EXPIRÉ',
  UNKNOWN: 'INCONNU',
  CEO: 'PDG',
  ADMIN: 'ADMINISTRATEUR',
  HR_MANAGER: 'RESPONSABLE RH',
  FINANCE_MANAGER: 'RESPONSABLE FINANCIER',
  EMPLOYEE: 'EMPLOYÉ',
};

export const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const cleanStatus = (status || 'UNKNOWN').toUpperCase();
  const label = STATUS_FRENCH_MAP[cleanStatus] ?? cleanStatus.replace(/_/g, ' ');
  return (
    <Badge variant={status ? (STATUS_VARIANT_MAP[status] ?? 'default') : 'default'}>
      {label}
    </Badge>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  colorClass?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label, value, icon, trend, trendUp, colorClass = 'bg-indigo-500/10 text-indigo-400'
}) => (
  <div className="glass-card rounded-2xl p-6">
    <div className="flex justify-between items-start mb-4">
      <div className={cn('p-3 rounded-xl', colorClass)}>{icon}</div>
      {trend && (
        <span className={cn(
          'text-xs font-semibold px-2 py-0.5 rounded-full',
          trendUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
        )}>
          {trend}
        </span>
      )}
    </div>
    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
    <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
  </div>
);

// ─── Page Header ─────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </div>
);

// ─── Search Input ─────────────────────────────────────────────────────────────

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = 'Search...' }) => (
  <div className="relative">
    <svg
      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="glass-input pl-9 pr-4 py-2 text-sm w-full min-w-[220px]"
    />
  </div>
);

// ─── Select Filter ─────────────────────────────────────────────────────────────

interface SelectFilterProps {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}

export const SelectFilter: React.FC<SelectFilterProps> = ({ value, onChange, options, placeholder = 'All' }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="glass-input px-3 py-2 text-sm appearance-none pr-8 cursor-pointer"
    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
  >
    <option value="">{placeholder}</option>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

// ─── Data Table ───────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  keyExtractor: (row: T) => string;
}

export function DataTable<T>({
  columns, data, isLoading, emptyMessage = 'No records found.', onRowClick, keyExtractor
}: DataTableProps<T>) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-5 py-4 text-[10px] uppercase font-bold text-muted-foreground tracking-wider', col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-4">
                      <div className="h-4 bg-white/5 rounded-lg w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'text-sm text-gray-200 hover:bg-white/[0.02] transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-5 py-4', col.className)}>
                      {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, total, limit, onPageChange }) => {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-xs text-muted-foreground">
        Showing <span className="text-white font-medium">{start}–{end}</span> of{' '}
        <span className="text-white font-medium">{total}</span> records
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-300 border border-white/5 disabled:opacity-30 hover:bg-white/10 transition-colors"
        >
          ← Prev
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              p === page
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'
            )}
          >
            {p}
          </button>
        ))}
        <button
          disabled={page === totalPages || totalPages === 0}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-300 border border-white/5 disabled:opacity-30 hover:bg-white/10 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

// ─── Dialog / Modal ───────────────────────────────────────────────────────────

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const dialogSizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={cn(
        'relative w-full glass-panel rounded-2xl p-6 shadow-2xl animate-fade-in',
        dialogSizes[size]
      )}>
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-base font-bold text-white">{title}</h4>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─── Form Field ───────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({ label, error, children, required }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {label}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
);

// ─── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20',
  secondary: 'bg-white/5 hover:bg-white/10 text-white border border-white/10',
  danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20',
  ghost: 'hover:bg-white/5 text-gray-400 hover:text-white',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', icon, isLoading, children, className, ...props
}) => {
  const sizeClasses = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-sm' };
  return (
    <button
      {...props}
      disabled={isLoading || props.disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50',
        buttonVariants[variant],
        sizeClasses[size],
        className
      )}
    >
      {isLoading ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children}
    </button>
  );
};

// ─── Input ─────────────────────────────────────────────────────────────────────

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn('glass-input w-full px-4 py-2.5 text-sm', className)}
    {...props}
  />
));
Input.displayName = 'Input';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn('glass-input w-full px-4 py-2.5 text-sm resize-none', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn('glass-input w-full px-4 py-2.5 text-sm appearance-none', className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

// ─── Empty State ─────────────────────────────────────────────────────────────

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }> = ({
  icon, title, description, action
}) => (
  <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4">
    {icon && <div className="text-muted-foreground/40 mb-2">{icon}</div>}
    <div>
      <h4 className="font-bold text-white text-base">{title}</h4>
      {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
    </div>
    {action}
  </div>
);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface TabsProps {
  tabs: { label: string; value: string }[];
  active: string;
  onChange: (val: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-1">
    {tabs.map((tab) => (
      <button
        key={tab.value}
        onClick={() => onChange(tab.value)}
        className={cn(
          'px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200',
          active === tab.value
            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
            : 'text-muted-foreground hover:text-white hover:bg-white/5'
        )}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
