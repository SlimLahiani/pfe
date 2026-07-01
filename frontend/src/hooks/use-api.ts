import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats?: Record<string, number>;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

// ─── Generic Hooks Factory ────────────────────────────────────────────────────

function useList<T>(
  queryKey: unknown[],
  url: string,
  params?: QueryParams,
) {
  return useQuery<PaginatedResponse<T>>({
    queryKey: [...queryKey, params],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<T>>(url, { params });
      return response.data;
    },
    placeholderData: keepPreviousData,
  });
}

function useOne<T>(queryKey: unknown[], url: string, id?: string) {
  return useQuery<T>({
    queryKey: [...queryKey, id],
    queryFn: async () => {
      const response = await api.get<T>(`${url}/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

function useCreate<T, D = Partial<T>>(queryKey: unknown[], url: string) {
  const qc = useQueryClient();
  return useMutation<T, Error, D>({
    mutationFn: async (data: D) => {
      const response = await api.post<T>(url, data);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });
}

function useUpdate<T, D = Partial<T>>(queryKey: unknown[], url: string) {
  const qc = useQueryClient();
  return useMutation<T, Error, { id: string; data: D }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch<T>(`${url}/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });
}

function useRemove(queryKey: unknown[], url: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await api.delete(`${url}/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });
}

function useRestore(queryKey: unknown[], url: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await api.patch(`${url}/${id}/restore`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });
}

// ─── CRM ─────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  status: string;
  source?: string;
  assignedTo?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  status: string;
  createdAt: string;
}

const LEADS_KEY = ['leads'];
const CLIENTS_KEY = ['clients'];

export const useLeads = (params?: QueryParams) => useList<Lead>(LEADS_KEY, '/crm/leads', params);
export const useLead = (id?: string) => useOne<Lead>(LEADS_KEY, '/crm/leads', id);
export const useCreateLead = () => useCreate<Lead, Omit<Lead, 'id' | 'createdAt'>>(LEADS_KEY, '/crm/leads');
export const useUpdateLead = () => useUpdate<Lead, Partial<Lead>>(LEADS_KEY, '/crm/leads');
export const useDeleteLead = () => useRemove(LEADS_KEY, '/crm/leads');
export const useRestoreLead = () => useRestore(LEADS_KEY, '/crm/leads');

export const useClients = (params?: QueryParams) => useList<Client>(CLIENTS_KEY, '/crm/clients', params);
export const useClient = (id?: string) => useOne<Client>(CLIENTS_KEY, '/crm/clients', id);
export const useCreateClient = () => useCreate<Client, Omit<Client, 'id' | 'createdAt'>>(CLIENTS_KEY, '/crm/clients');
export const useUpdateClient = () => useUpdate<Client, Partial<Client>>(CLIENTS_KEY, '/crm/clients');
export const useDeleteClient = () => useRemove(CLIENTS_KEY, '/crm/clients');
export const useRestoreClient = () => useRestore(CLIENTS_KEY, '/crm/clients');

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  clientId?: string;
  client?: { id: string; name: string };
  createdAt: string;
}

const PROJECTS_KEY = ['projects'];

export const useProjects = (params?: QueryParams) => useList<Project>(PROJECTS_KEY, '/projects', params);
export const useProject = (id?: string) => useOne<Project>(PROJECTS_KEY, '/projects', id);
export const useCreateProject = () => useCreate<Project, Omit<Project, 'id' | 'createdAt'>>(PROJECTS_KEY, '/projects');
export const useUpdateProject = () => useUpdate<Project, Partial<Project>>(PROJECTS_KEY, '/projects');
export const useDeleteProject = () => useRemove(PROJECTS_KEY, '/projects');
export const useRestoreProject = () => useRestore(PROJECTS_KEY, '/projects');

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  projectId?: string;
  project?: { id: string; name: string };
  assignee?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

const TASKS_KEY = ['tasks'];

export const useTasks = (params?: QueryParams) => useList<Task>(TASKS_KEY, '/tasks', params);
export const useTask = (id?: string) => useOne<Task>(TASKS_KEY, '/tasks', id);
export const useCreateTask = () => useCreate<Task, Omit<Task, 'id' | 'createdAt'>>(TASKS_KEY, '/tasks');
export const useUpdateTask = () => useUpdate<Task, Partial<Task>>(TASKS_KEY, '/tasks');
export const useDeleteTask = () => useRemove(TASKS_KEY, '/tasks');
export const useRestoreTask = () => useRestore(TASKS_KEY, '/tasks');

// ─── Finance ──────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  invoiceNumber: string;
  reference: string;
  status: string;
  totalAmount: number;
  total: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  paidAmount: number;
  dueDate?: string;
  issuedDate?: string;
  issueDate?: string;
  currency: string;
  notes?: string;
  terms?: string;
  client?: { id: string; name?: string; companyName?: string };
  createdBy?: { id: string; firstName: string; lastName: string };
  items?: InvoiceItem[];
  payments?: PaymentRecord[];
  quote?: { id: string; reference: string };
  quoteId?: string;
  clientId?: string;
  projectId?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  method: string;
  paidAt: string;
  reference?: string;
  notes?: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  reference: string;
  status: string;
  totalAmount: number;
  total: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  validUntil?: string;
  currency: string;
  notes?: string;
  terms?: string;
  client?: { id: string; name?: string; companyName?: string };
  clientId?: string;
  projectId?: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  items?: QuoteItem[];
  invoice?: { id: string; reference: string } | null;
  createdAt: string;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Expense {
  id: string;
  title: string;
  description: string;
  amount: number;
  date: string;
  expenseDate?: string;
  status: string;
  isApproved?: boolean | null;
  receiptUrl?: string;
  notes?: string;
  category?: { id: string; name: string };
  categoryId?: string;
  submittedBy?: { id: string; firstName: string; lastName: string };
  projectId?: string;
  departmentId?: string;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
}

export interface FinanceDashboard {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  outstandingInvoices: { count: number; amount: number };
  pendingQuotes: number;
  pendingApprovals: number;
  monthlyCashFlow: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  collectionRate: number;
}

export interface RevenueTrendItem {
  month: string;
  revenue: number;
  invoiceCount: number;
}

export interface CashFlowItem {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
}

export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
  color: string;
}

export interface TopClient {
  id: string;
  companyName: string;
  totalPaid: number;
  totalInvoiced: number;
  invoiceCount: number;
  quoteCount: number;
}

export interface ExpenseBreakdown {
  categories: { categoryId: string; categoryName: string; total: number; count: number; percentage: number }[];
  grandTotal: number;
}

const INVOICES_KEY = ['invoices'];
const QUOTES_KEY = ['quotes'];
const EXPENSES_KEY = ['expenses'];

export const useInvoices = (params?: QueryParams) => useList<Invoice>(INVOICES_KEY, '/finance/invoices', params);
export const useInvoice = (id?: string) => useOne<Invoice>(INVOICES_KEY, '/finance/invoices', id);
export const useCreateInvoice = () => useCreate<Invoice, any>(INVOICES_KEY, '/finance/invoices');
export const useUpdateInvoice = () => useUpdate<Invoice, any>(INVOICES_KEY, '/finance/invoices');
export const useDeleteInvoice = () => useRemove(INVOICES_KEY, '/finance/invoices');
export const useRestoreInvoice = () => useRestore(INVOICES_KEY, '/finance/invoices');

export const useQuotes = (params?: QueryParams) => useList<Quote>(QUOTES_KEY, '/finance/quotes', params);
export const useQuote = (id?: string) => useOne<Quote>(QUOTES_KEY, '/finance/quotes', id);
export const useCreateQuote = () => useCreate<Quote, any>(QUOTES_KEY, '/finance/quotes');
export const useUpdateQuote = () => useUpdate<Quote, any>(QUOTES_KEY, '/finance/quotes');
export const useDeleteQuote = () => useRemove(QUOTES_KEY, '/finance/quotes');
export const useRestoreQuote = () => useRestore(QUOTES_KEY, '/finance/quotes');
export const useConvertQuote = () => {
  const qc = useQueryClient();
  return useMutation<any, Error, string>({
    mutationFn: async (quoteId: string) => {
      const res = await api.post(`/finance/quotes/${quoteId}/convert`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUOTES_KEY });
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
};

export const useExpenses = (params?: QueryParams) => useList<Expense>(EXPENSES_KEY, '/finance/expenses', params);
export const useCreateExpense = () => useCreate<Expense, any>(EXPENSES_KEY, '/finance/expenses');
export const useUpdateExpense = () => useUpdate<Expense, any>(EXPENSES_KEY, '/finance/expenses');
export const useDeleteExpense = () => useRemove(EXPENSES_KEY, '/finance/expenses');
export const useRestoreExpense = () => useRestore(EXPENSES_KEY, '/finance/expenses');

// ─── Finance Dashboard & Analytics ────────────────────────────────────────────

export const useFinanceDashboard = () =>
  useQuery<FinanceDashboard>({
    queryKey: ['finance-dashboard'],
    queryFn: async () => {
      const res = await api.get<FinanceDashboard>('/finance/dashboard');
      return res.data;
    },
  });

export const useRevenueTrend = () =>
  useQuery<RevenueTrendItem[]>({
    queryKey: ['finance-revenue-trend'],
    queryFn: async () => {
      const res = await api.get<RevenueTrendItem[]>('/finance/analytics/revenue');
      return res.data;
    },
  });

export const useCashFlow = () =>
  useQuery<CashFlowItem[]>({
    queryKey: ['finance-cashflow'],
    queryFn: async () => {
      const res = await api.get<CashFlowItem[]>('/finance/analytics/cashflow');
      return res.data;
    },
  });

export const useInvoiceAging = () =>
  useQuery<AgingBucket[]>({
    queryKey: ['finance-aging'],
    queryFn: async () => {
      const res = await api.get<AgingBucket[]>('/finance/analytics/aging');
      return res.data;
    },
  });

export const useTopClients = () =>
  useQuery<TopClient[]>({
    queryKey: ['finance-top-clients'],
    queryFn: async () => {
      const res = await api.get<TopClient[]>('/finance/analytics/top-clients');
      return res.data;
    },
  });

export const useExpenseBreakdown = () =>
  useQuery<ExpenseBreakdown>({
    queryKey: ['finance-expense-breakdown'],
    queryFn: async () => {
      const res = await api.get<ExpenseBreakdown>('/finance/analytics/expenses');
      return res.data;
    },
  });

export const useExpenseCategories = () =>
  useQuery<ExpenseCategory[]>({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const res = await api.get<ExpenseCategory[]>('/finance/expenses/categories');
      return res.data;
    },
  });

// ─── CRM Client list for Finance forms ────────────────────────────────────────

export interface ClientOption {
  id: string;
  companyName: string;
  email?: string;
  phone?: string;
}

export const useClientsList = () =>
  useQuery<PaginatedResponse<ClientOption>>({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<ClientOption>>('/crm/clients', { params: { limit: 100 } });
      return res.data;
    },
  });


// ─── HR ───────────────────────────────────────────────────────────────────────

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveType: string;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
}

export interface Employee {
  id: string;
  userId: string;
  user?: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string; isActive?: boolean };
  departmentId?: string;
  department?: { id: string; name: string; budget?: number; kpis?: any };
  jobTitle?: string;
  employeeCode?: string;
  dateOfBirth?: string;
  nationalId?: string;
  phone?: string;
  address?: string;
  hireDate?: string;
  emergencyContact?: string;
  status: string;
  lifecycleStage: string;
  onboardingProgress: number;
  mentorId?: string;
  performanceScore: number;
  createdAt: string;
  leaveBalances?: LeaveBalance[];
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  budget?: number | null;
  kpis?: any;
  createdAt: string;
  employees?: Employee[];
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  requestedById: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason?: string;
  reviewedById?: string;
  reviewedAt?: string;
  reviewNote?: string;
  employee?: Employee;
  requestedBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  hoursWorked?: number | null;
  overtime?: number | null;
  status: string; // PRESENT, ABSENT, LATE, REMOTE
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee;
}

export interface Payslip {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  baseSalary: number;
  bonuses: number;
  deductions: number;
  overtime: number;
  netSalary: number;
  status: string; // DRAFT, PAID
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee;
}

export interface EmployeeHistory {
  id: string;
  employeeId: string;
  eventDate: string;
  eventType: string; // STAGE_CHANGE, PROMOTION, SALARY_CHANGE, DEPARTMENT_CHANGE
  title: string;
  description?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface OnboardingTask {
  id: string;
  employeeId: string;
  taskName: string;
  isCompleted: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  employeeId: string;
  type: string; // CDI, CDD, FREELANCE, INTERNSHIP, PART_TIME
  startDate: string;
  endDate?: string | null;
  grossSalary: number;
  currency: string;
  documentUrl?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface Salary {
  id: string;
  employeeId: string;
  amount: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface HrDashboard {
  totalEmployees: number;
  activeEmployees: number;
  newEmployees: number;
  employeesOnLeave: number;
  contractsExpiringSoon: number;
  averageProductivity: number;
  attendanceRate: number;
  leaveRequestsPending: number;
}

export interface HrAnalytics {
  employeeGrowth: { month: string; count: number }[];
  departmentDistribution: { departmentName: string; count: number }[];
  leaveStatistics: { type: string; count: number }[];
  productivityTrends: { departmentName: string; averageProductivity: number }[];
}

export interface HrRecommendation {
  type: string; // 'BURNOUT_RISK' | 'CONTRACT_RENEWAL' | 'PROMOTION_CANDIDATE' | 'LEAVE_NEEDED' | 'DEPARTMENT_UNDERSTAFFED'
  title: string;
  description: string;
  employeeName: string;
  employeeId: string;
}

const EMPLOYEES_KEY = ['employees'];
const DEPARTMENTS_KEY = ['departments'];
const LEAVE_REQUESTS_KEY = ['leave-requests'];

export const useEmployees = (params?: QueryParams) => useList<Employee>(EMPLOYEES_KEY, '/hr/employees', params);
export const useCreateEmployee = () => useCreate<Employee, Partial<Employee>>(EMPLOYEES_KEY, '/hr/employees');
export const useUpdateEmployee = () => useUpdate<Employee, Partial<Employee>>(EMPLOYEES_KEY, '/hr/employees');
export const useDeleteEmployee = () => useRemove(EMPLOYEES_KEY, '/hr/employees');
export const useRestoreEmployee = () => useRestore(EMPLOYEES_KEY, '/hr/employees');

export const useDepartments = (params?: QueryParams) => useList<Department>(DEPARTMENTS_KEY, '/hr/departments', params);
export const useCreateDepartment = () => useCreate<Department, Partial<Department>>(DEPARTMENTS_KEY, '/hr/departments');
export const useDeleteDepartment = () => useRemove(DEPARTMENTS_KEY, '/hr/departments');
export const useRestoreDepartment = () => useRestore(DEPARTMENTS_KEY, '/hr/departments');

export const useLeaveRequests = (params?: QueryParams) => useList<LeaveRequest>(LEAVE_REQUESTS_KEY, '/hr/leave-requests', params);
export const useCreateLeaveRequest = () => useCreate<LeaveRequest, Partial<LeaveRequest>>(LEAVE_REQUESTS_KEY, '/hr/leave-requests');
export const useUpdateLeaveRequest = () => useUpdate<LeaveRequest, Partial<LeaveRequest>>(LEAVE_REQUESTS_KEY, '/hr/leave-requests');
export const useDeleteLeaveRequest = () => useRemove(LEAVE_REQUESTS_KEY, '/hr/leave-requests');
export const useRestoreLeaveRequest = () => useRestore(LEAVE_REQUESTS_KEY, '/hr/leave-requests');

// ─── New HRMS Hooks ──────────────────────────────────────────────────────────

export const useHrDashboard = () =>
  useQuery<HrDashboard>({
    queryKey: ['hr-dashboard'],
    queryFn: async () => {
      const res = await api.get<HrDashboard>('/hr/dashboard');
      return res.data;
    },
  });

export const useHrAnalytics = () =>
  useQuery<HrAnalytics>({
    queryKey: ['hr-analytics'],
    queryFn: async () => {
      const res = await api.get<HrAnalytics>('/hr/analytics');
      return res.data;
    },
  });

export const useHrRecommendations = () =>
  useQuery<HrRecommendation[]>({
    queryKey: ['hr-recommendations'],
    queryFn: async () => {
      const res = await api.get<HrRecommendation[]>('/hr/recommendations');
      return res.data;
    },
  });

export const useAttendanceToday = () =>
  useQuery<Attendance[]>({
    queryKey: ['hr-attendance-today'],
    queryFn: async () => {
      const res = await api.get<Attendance[]>('/hr/attendance/today');
      return res.data;
    },
  });

export const useMyAttendance = () =>
  useQuery<Attendance[]>({
    queryKey: ['hr-attendance-my'],
    queryFn: async () => {
      const res = await api.get<Attendance[]>('/hr/attendance/my');
      return res.data;
    },
  });

export const useEmployeeAttendance = (employeeId: string) =>
  useQuery<Attendance[]>({
    queryKey: ['hr-employee-attendance', employeeId],
    queryFn: async () => {
      const res = await api.get<Attendance[]>(`/hr/employees/${employeeId}/attendance`);
      return res.data;
    },
    enabled: !!employeeId,
  });

export const usePayslips = (employeeId: string) =>
  useQuery<Payslip[]>({
    queryKey: ['payslips', employeeId],
    queryFn: async () => {
      const res = await api.get<Payslip[]>(`/hr/employees/${employeeId}/payslips`);
      return res.data;
    },
    enabled: !!employeeId,
  });

export const useEmployeeHistory = (employeeId: string) =>
  useQuery<EmployeeHistory[]>({
    queryKey: ['employee-history', employeeId],
    queryFn: async () => {
      const res = await api.get<EmployeeHistory[]>(`/hr/employees/${employeeId}/history`);
      return res.data;
    },
    enabled: !!employeeId,
  });

export const useOnboardingTasks = (employeeId: string) =>
  useQuery<OnboardingTask[]>({
    queryKey: ['onboarding-tasks', employeeId],
    queryFn: async () => {
      const res = await api.get<OnboardingTask[]>(`/hr/employees/${employeeId}/onboarding`);
      return res.data;
    },
    enabled: !!employeeId,
  });

export const useEmployeeContracts = (employeeId: string) =>
  useQuery<Contract[]>({
    queryKey: ['employee-contracts', employeeId],
    queryFn: async () => {
      const res = await api.get<Contract[]>(`/hr/employees/${employeeId}/contracts`);
      return res.data;
    },
    enabled: !!employeeId,
  });

export const useEmployeeSalaries = (employeeId: string) =>
  useQuery<Salary[]>({
    queryKey: ['employee-salaries', employeeId],
    queryFn: async () => {
      const res = await api.get<Salary[]>(`/hr/employees/${employeeId}/salaries`);
      return res.data;
    },
    enabled: !!employeeId,
  });

export const useCheckIn = () => {
  const qc = useQueryClient();
  return useMutation<Attendance, Error, void>({
    mutationFn: async () => {
      const res = await api.post<Attendance>('/hr/attendance/check-in');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-attendance-my'] });
      qc.invalidateQueries({ queryKey: ['hr-attendance-today'] });
    },
  });
};

export const useCheckOut = () => {
  const qc = useQueryClient();
  return useMutation<Attendance, Error, void>({
    mutationFn: async () => {
      const res = await api.post<Attendance>('/hr/attendance/check-out');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-attendance-my'] });
      qc.invalidateQueries({ queryKey: ['hr-attendance-today'] });
    },
  });
};

export const useCreatePayslip = (employeeId: string) => {
  const qc = useQueryClient();
  return useMutation<Payslip, Error, { month: number; year: number; bonuses?: number; deductions?: number; notes?: string }>({
    mutationFn: async (data) => {
      const response = await api.post<Payslip>(`/hr/employees/${employeeId}/payslips`, data);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payslips', employeeId] });
    },
  });
};

export const useToggleOnboardingTask = (employeeId: string) => {
  const qc = useQueryClient();
  return useMutation<OnboardingTask, Error, { taskId: string; isCompleted: boolean }>({
    mutationFn: async ({ taskId, isCompleted }) => {
      const response = await api.patch<OnboardingTask>(`/hr/employees/${employeeId}/onboarding/checklist/${taskId}`, { isCompleted });
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding-tasks', employeeId] });
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};

export const useAddHistoryEvent = (employeeId: string) => {
  const qc = useQueryClient();
  return useMutation<EmployeeHistory, Error, { eventType: string; title: string; description?: string; notes?: string }>({
    mutationFn: async (data) => {
      const response = await api.post<EmployeeHistory>(`/hr/employees/${employeeId}/history`, data);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-history', employeeId] });
    },
  });
};

export const useCreateContract = (employeeId: string) => {
  const qc = useQueryClient();
  return useMutation<Contract, Error, { type: string; startDate: string; endDate?: string; grossSalary: number; notes?: string }>({
    mutationFn: async (data) => {
      const res = await api.post<Contract>(`/hr/employees/${employeeId}/contracts`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-contracts', employeeId] });
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};

export const useCreateSalary = (employeeId: string) => {
  const qc = useQueryClient();
  return useMutation<Salary, Error, { amount: number; effectiveFrom: string; note?: string }>({
    mutationFn: async (data) => {
      const res = await api.post<Salary>(`/hr/employees/${employeeId}/salaries`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-salaries', employeeId] });
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};

// ─── Documents ────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  title: string;
  type: string;
  url?: string;
  fileUrl?: string;
  mimeType?: string;
  size?: number;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
  originalFileName?: string;
  storedFileName?: string;
  entityType?: string;
  entityId?: string;
  isArchived?: boolean;
}

const DOCUMENTS_KEY = ['documents'];

export const useDocuments = (params?: QueryParams) => useList<Document>(DOCUMENTS_KEY, '/documents', params);
export const useCreateDocument = () => useCreate<Document, Partial<Document>>(DOCUMENTS_KEY, '/documents');
export const useUpdateDocument = () => useUpdate<Document, Partial<Document>>(DOCUMENTS_KEY, '/documents');
export const useDeleteDocument = () => useRemove(DOCUMENTS_KEY, '/documents');
export const useRestoreDocument = () => useRestore(DOCUMENTS_KEY, '/documents');

// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  type: string;
  createdAt: string;
}

const EVENTS_KEY = ['calendar-events'];

export const useCalendarEvents = (params?: QueryParams) => useList<CalendarEvent>(EVENTS_KEY, '/calendar/events', params);
export const useCreateCalendarEvent = () => useCreate<CalendarEvent, Partial<CalendarEvent>>(EVENTS_KEY, '/calendar/events');
export const useUpdateCalendarEvent = () => useUpdate<CalendarEvent, Partial<CalendarEvent>>(EVENTS_KEY, '/calendar/events');
export const useDeleteCalendarEvent = () => useRemove(EVENTS_KEY, '/calendar/events');
export const useRestoreCalendarEvent = () => useRestore(EVENTS_KEY, '/calendar/events');

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body?: string;
  type: string;
  isRead: boolean;
  resourceId?: string;
  createdAt: string;
}

const NOTIFICATIONS_KEY = ['notifications'];

export const useNotifications = (params?: QueryParams) => useList<Notification>(NOTIFICATIONS_KEY, '/notifications', params);
export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
};

// ─── PDF Helpers ──────────────────────────────────────────────────────────────

export const downloadPdf = async (url: string, defaultFilename: string) => {
  try {
    const response = await api.get(url, { responseType: 'blob' });
    const disposition = response.headers['content-disposition'];
    let filename = defaultFilename;
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }
    const decodedFilename = decodeURIComponent(filename);
    const contentTypeHeader = response.headers['content-type'];
    const contentType = typeof contentTypeHeader === 'string' ? contentTypeHeader : 'application/pdf';
    const blob = new Blob([response.data as BlobPart], { type: contentType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = decodedFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (err: any) {
    console.error('Error downloading PDF:', err);
    if (err.response?.data instanceof Blob) {
      const text = await err.response.data.text();
      try {
        const json = JSON.parse(text);
        alert(`Erreur de téléchargement PDF : ${json.message || json.error || 'Erreur inconnue'}`);
      } catch {
        alert(`Erreur de téléchargement PDF : ${text || err.message}`);
      }
    } else {
      alert(`Erreur de téléchargement PDF : ${err.message}`);
    }
    throw err;
  }
};


// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatRoom {
  id: string;
  name: string;
  type: 'GLOBAL' | 'PROJECT' | 'DIRECT';
  projectId?: string;
}

const CHAT_ROOMS_KEY = ['chat-rooms'];

export const useChatRooms = () =>
  useQuery<ChatRoom[]>({
    queryKey: CHAT_ROOMS_KEY,
    queryFn: async () => {
      const res = await api.get<ChatRoom[]>('/chat/rooms');
      return res.data;
    },
  });

// ─── Recruitment ─────────────────────────────────────────────────────────────

export interface JobVacancy {
  id: string;
  title: string;
  departmentId?: string;
  department?: { id: string; name: string };
  description?: string;
  requirements?: string;
  salaryRange?: string;
  status: string;
  isArchived: boolean;
  createdAt: string;
}

export interface Candidate {
  id: string;
  vacancyId?: string;
  vacancy?: JobVacancy;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  status: string;
  notes?: string;
  isArchived: boolean;
  createdAt: string;
}

const VACANCIES_KEY = ['vacancies'];
const CANDIDATES_KEY = ['candidates'];

export const useVacancies = (params?: QueryParams) => useList<JobVacancy>(VACANCIES_KEY, '/hr/vacancies', params);
export const useVacancy = (id?: string) => useOne<JobVacancy>(VACANCIES_KEY, '/hr/vacancies', id);
export const useCreateVacancy = () => useCreate<JobVacancy, Partial<JobVacancy>>(VACANCIES_KEY, '/hr/vacancies');
export const useUpdateVacancy = () => useUpdate<JobVacancy, Partial<JobVacancy>>(VACANCIES_KEY, '/hr/vacancies');
export const useDeleteVacancy = () => useRemove(VACANCIES_KEY, '/hr/vacancies');
export const useRestoreVacancy = () => useRestore(VACANCIES_KEY, '/hr/vacancies');

export const useCandidates = (params?: QueryParams) => useList<Candidate>(CANDIDATES_KEY, '/hr/candidates', params);
export const useCandidate = (id?: string) => useOne<Candidate>(CANDIDATES_KEY, '/hr/candidates', id);
export const useCreateCandidate = () => useCreate<Candidate, Partial<Candidate>>(CANDIDATES_KEY, '/hr/candidates');
export const useUpdateCandidate = () => useUpdate<Candidate, Partial<Candidate>>(CANDIDATES_KEY, '/hr/candidates');
export const useDeleteCandidate = () => useRemove(CANDIDATES_KEY, '/hr/candidates');
export const useRestoreCandidate = () => useRestore(CANDIDATES_KEY, '/hr/candidates');

// ─── Payslips Mutations & Intelligence Summary ──────────────────────────────

export const useUpdatePayslipStatus = (employeeId: string) => {
  const qc = useQueryClient();
  return useMutation<Payslip, Error, { id: string; status: string }>({
    mutationFn: async ({ id, status }) => {
      const response = await api.patch<Payslip>(`/hr/payslips/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payslips', employeeId] });
      qc.invalidateQueries({ queryKey: ['hr-dashboard'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
  });
};

export const useDeletePayslip = (employeeId: string) => {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/payslips/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payslips', employeeId] });
      qc.invalidateQueries({ queryKey: ['hr-dashboard'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
  });
};

export const useExecutiveSummary = () =>
  useQuery<{ summary: string }>({
    queryKey: ['executive-summary'],
    queryFn: async () => {
      const res = await api.get<{ summary: string }>('/intelligence/summary');
      return res.data;
    },
  });

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface ReportComment {
  id: string;
  reportId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
}

export interface ReportHistoryEntry {
  id: string;
  reportId: string;
  action: string;
  performedById: string;
  details: any;
  createdAt: string;
  performedBy?: { id: string; firstName: string; lastName: string };
}

export interface ReportApproval {
  id: string;
  reportId: string;
  reviewerId: string;
  action: string;
  comment?: string;
  createdAt: string;
  reviewer?: { id: string; firstName: string; lastName: string };
}

export interface ReportSchedule {
  id: string;
  reportId: string;
  cronExpr: string;
  recipients: string[];
  isActive: boolean;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  name: string;
  type: 'FINANCIAL' | 'HR' | 'PROJECT' | 'CRM' | 'MARKETING' | 'SALES' | 'PRODUCTIVITY';
  subType?: string;
  filters: any;
  createdById: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  isArchived: boolean;
  departmentId?: string;
  managerId?: string;
  reportingPeriod?: string;
  // Legacy status (kept for backward compat)
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  // New workflow status
  workflowStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  notes?: {
    // HR notes
    achievements?: string;
    problems?: string;
    risks?: string;
    recommendations?: string;
    improvementPlan?: string;
    generalObservations?: string;
    // Finance notes
    financialAnalysis?: string;
    budgetIssues?: string;
    plannedActions?: string;
  };
  submittedAt?: string;
  approvedAt?: string;
  approvedById?: string;
  rejectedAt?: string;
  rejectedById?: string;
  version: number;
  comment?: string;
  title?: string;
  periodStart?: string;
  periodEnd?: string;
  data?: any;
  aiInsights?: {
    keyFindings: string[];
    performanceSummary: string;
    risks: string[];
    opportunities: string[];
    recommendations: string[];
    priorityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  schedules?: ReportSchedule[];
  reportComments?: ReportComment[];
  reportHistory?: ReportHistoryEntry[];
  reportApprovals?: ReportApproval[];
  createdBy?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
  department?: { id: string; name: string };
  manager?: { id: string; firstName: string; lastName: string };
}

export interface ComparisonAnalyticsItem {
  id: string;
  name: string;
  employeeCount: number;
  activeEmployeeCount: number;
  expenses: number;
  averageProductivity: number;
  budget: number;
  budgetUtilization: number;
  revenueContribution: number;
}

const REPORTS_KEY = ['reports'];

export const useReports = (params?: QueryParams) => useList<Report>(REPORTS_KEY, '/reports', params);
export const useReport = (id?: string) => useOne<Report>(REPORTS_KEY, '/reports', id);

export const useReportData = (id?: string) => {
  return useQuery({
    queryKey: [REPORTS_KEY, id, 'data'],
    queryFn: async () => {
      const res = await api.get(`/reports/${id}/data`);
      return res.data;
    },
    enabled: !!id,
  });
};
export const useCreateReport = () => useCreate<Report, any>(REPORTS_KEY, '/reports');
export const useUpdateReport = () => useUpdate<Report, any>(REPORTS_KEY, '/reports');
export const useDeleteReport = () => useRemove(REPORTS_KEY, '/reports');
export const useRestoreReport = () => useRestore(REPORTS_KEY, '/reports');

export const useRunReport = () => {
  const qc = useQueryClient();
  return useMutation<Report, Error, string>({
    mutationFn: async (id: string) => {
      const res = await api.get<Report>(`/reports/${id}/run`);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['reports', data.id] });
    },
  });
};

export const useSubmitReport = () => {
  const qc = useQueryClient();
  return useMutation<Report, Error, string>({
    mutationFn: async (id: string) => {
      const res = await api.post<Report>(`/reports/${id}/submit`);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['reports', data.id] });
    },
  });
};

export const useApproveReport = () => {
  const qc = useQueryClient();
  return useMutation<Report, Error, { id: string; comment?: string }>({
    mutationFn: async ({ id, comment }) => {
      const res = await api.patch<Report>(`/reports/${id}/approve`, { comment });
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['reports', data.id] });
      qc.invalidateQueries({ queryKey: ['reports', data.id, 'data'] });
    },
  });
};

export const useRejectReport = () => {
  const qc = useQueryClient();
  return useMutation<Report, Error, { id: string; reason: string }>({
    mutationFn: async ({ id, reason }) => {
      const res = await api.patch<Report>(`/reports/${id}/reject`, { reason });
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['reports', data.id] });
      qc.invalidateQueries({ queryKey: ['reports', data.id, 'data'] });
    },
  });
};

export const useRequestModifications = () => {
  const qc = useQueryClient();
  return useMutation<Report, Error, { id: string; comment: string }>({
    mutationFn: async ({ id, comment }) => {
      const res = await api.patch<Report>(`/reports/${id}/request-modifications`, { comment });
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['reports', data.id] });
      qc.invalidateQueries({ queryKey: ['reports', data.id, 'data'] });
    },
  });
};

export const useAddReportComment = () => {
  const qc = useQueryClient();
  return useMutation<ReportComment, Error, { reportId: string; content: string }>({
    mutationFn: async ({ reportId, content }) => {
      const res = await api.post<ReportComment>(`/reports/${reportId}/comments`, { content });
      return res.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['reports', vars.reportId, 'comments'] });
      qc.invalidateQueries({ queryKey: ['reports', vars.reportId] });
    },
  });
};

export const useReportComments = (reportId?: string) =>
  useQuery<ReportComment[]>({
    queryKey: ['reports', reportId, 'comments'],
    queryFn: async () => {
      const res = await api.get<ReportComment[]>(`/reports/${reportId}/comments`);
      return res.data;
    },
    enabled: !!reportId,
  });

export const useReportHistory = (reportId?: string) =>
  useQuery<ReportHistoryEntry[]>({
    queryKey: ['reports', reportId, 'history'],
    queryFn: async () => {
      const res = await api.get<ReportHistoryEntry[]>(`/reports/${reportId}/history`);
      return res.data;
    },
    enabled: !!reportId,
  });

export const useGenerateHrReport = () =>
  useMutation<any, Error, { periodStart?: string; periodEnd?: string; departmentId?: string }>({
    mutationFn: async (data) => {
      const res = await api.post('/reports/generate/hr', data);
      return res.data;
    },
  });

export const useGenerateFinanceReport = () =>
  useMutation<any, Error, { periodStart?: string; periodEnd?: string }>({
    mutationFn: async (data) => {
      const res = await api.post('/reports/generate/finance', data);
      return res.data;
    },
  });

export const useComparisonAnalytics = (options?: { enabled?: boolean }) =>
  useQuery<ComparisonAnalyticsItem[]>({
    queryKey: ['reports-comparison-analytics'],
    queryFn: async () => {
      const res = await api.get<ComparisonAnalyticsItem[]>('/reports/analytics/compare');
      return res.data;
    },
    ...options,
  });

export const useCreateReportSchedule = (reportId: string) => {
  const qc = useQueryClient();
  return useMutation<ReportSchedule, Error, { cronExpr: string; recipients: string[]; isActive?: boolean }>({
    mutationFn: async (data) => {
      const res = await api.post<ReportSchedule>(`/reports/${reportId}/schedules`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['reports', reportId] });
    },
  });
};

// Export URL helpers
export const getReportPdfUrl = (id: string) => `/reports/export/pdf/${id}`;
export const getReportExcelUrl = (id: string) => `/reports/export/excel/${id}`;
