import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from './features/auth/pages/login-page';
import { DashboardLayout } from './components/layout/dashboard-layout';
import { DashboardOverview } from './features/dashboard/pages/dashboard-overview';
import { UsersPage } from './features/users/pages/users-page';
import { FinancialsPage } from './features/financials/pages/financials-page';
import { ProtectedRoute } from './components/shared/protected-route';

// CRM
import { LeadsPage } from './features/crm/pages/leads-page';
import { ClientsPage } from './features/crm/pages/clients-page';

// Projects
import { ProjectsPage } from './features/projects/pages/projects-page';

// Tasks
import { TasksPage } from './features/tasks/pages/tasks-page';

// Finance
import { InvoicesPage } from './features/finance/pages/invoices-page';
import { QuotesPage } from './features/finance/pages/quotes-page';
import { ExpensesPage } from './features/finance/pages/expenses-page';
import { FinanceAnalyticsPage } from './features/finance/pages/finance-analytics-page';

// HR Pages
import { EmployeesPage } from './features/hr/pages/employees-page';
import { DepartmentsPage } from './features/hr/pages/departments-page';
import { LeaveRequestsPage } from './features/hr/pages/leave-requests-page';
import { HrDashboardPage } from './features/hr/pages/hr-dashboard-page';
import { EmployeePortalPage } from './features/hr/pages/employee-portal-page';
import { OrgChartPage } from './features/hr/pages/org-chart-page';
import { RecruitmentPage } from './features/hr/pages/recruitment-page';

// Documents
import { DocumentsPage } from './features/documents/pages/documents-page';
import { DocumentsHistoryPage } from './features/documents/pages/documents-history-page';

// Calendar
import { CalendarPage } from './features/calendar/pages/calendar-page';

// Reports
import { ReportsPage } from './features/reports/pages/reports-page';
import { ReportDetailPage } from './features/reports/pages/report-detail-page';
import { HrReportFormPage } from './features/reports/pages/hr-report-form-page';
import { FinanceReportFormPage } from './features/reports/pages/finance-report-form-page';
import { ReportEditPage } from './features/reports/pages/report-edit-page';

// Chat
import { ChatPage } from './features/chat/pages/chat-page';

// Intelligence
import { DecisionCenterPage } from './features/intelligence/pages/decision-center-page';
import { IntelligenceDashboardPage } from './features/intelligence/pages/intelligence-dashboard-page';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      // Overview
      { path: '/', element: <DashboardOverview /> },
      
      // Intelligence Center
      {
        path: '/decision-center',
        element: (
          <ProtectedRoute allowedRoles={['GERANT', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER']}>
            <DecisionCenterPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/intelligence',
        element: (
          <ProtectedRoute allowedRoles={['GERANT', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER']}>
            <IntelligenceDashboardPage />
          </ProtectedRoute>
        ),
      },

      // Legacy routes preserved
      // Legacy routes preserved
      {
        path: '/users',
        element: (
          <ProtectedRoute requiredPermission="users:read" allowedRoles={['GERANT']}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/financials',
        element: (
          <ProtectedRoute requiredPermission="finance:read" allowedRoles={['GERANT', 'RESPONSABLE_FINANCIER']}>
            <FinancialsPage />
          </ProtectedRoute>
        ),
      },

      // ── CRM ──────────────────────────────────────────────────────────
      {
        path: '/crm/leads',
        element: (
          <ProtectedRoute requiredPermission="crm:read" allowedRoles={['GERANT', 'SECRETAIRE', 'RESPONSABLE_MARKETING', 'RESPONSABLE_VENTES']}>
            <LeadsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/crm/clients',
        element: (
          <ProtectedRoute requiredPermission="crm:read" allowedRoles={['GERANT', 'SECRETAIRE', 'RESPONSABLE_MARKETING', 'RESPONSABLE_VENTES', 'RESPONSABLE_FINANCIER']}>
            <ClientsPage />
          </ProtectedRoute>
        ),
      },

      // ── Projects ─────────────────────────────────────────────────────
      {
        path: '/projects',
        element: (
          <ProtectedRoute requiredPermission="projects:read" allowedRoles={['GERANT', 'SECRETAIRE', 'COLLABORATEUR', 'CHEF_PROJET', 'CHEF_EQUIPE', 'RESPONSABLE_OPERATIONS', 'RESPONSABLE_MARKETING']}>
            <ProjectsPage />
          </ProtectedRoute>
        ),
      },

      // ── Tasks ─────────────────────────────────────────────────────────
      {
        path: '/tasks',
        element: (
          <ProtectedRoute requiredPermission="tasks:read" allowedRoles={['GERANT', 'SECRETAIRE', 'COLLABORATEUR', 'CHEF_PROJET', 'CHEF_EQUIPE', 'RESPONSABLE_OPERATIONS', 'RESPONSABLE_MARKETING', 'STAGIAIRE']}>
            <TasksPage />
          </ProtectedRoute>
        ),
      },

      // ── Finance ───────────────────────────────────────────────────────
      {
        path: '/finance/invoices',
        element: (
          <ProtectedRoute requiredPermission="finance:read" allowedRoles={['GERANT', 'SECRETAIRE', 'RESPONSABLE_FINANCIER']}>
            <InvoicesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/finance/quotes',
        element: (
          <ProtectedRoute requiredPermission="finance:read" allowedRoles={['GERANT', 'SECRETAIRE', 'RESPONSABLE_FINANCIER']}>
            <QuotesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/finance/expenses',
        element: (
          <ProtectedRoute requiredPermission="finance:read" allowedRoles={['GERANT', 'RESPONSABLE_FINANCIER']}>
            <ExpensesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/finance/analytics',
        element: (
          <ProtectedRoute requiredPermission="finance:read" allowedRoles={['GERANT', 'RESPONSABLE_FINANCIER']}>
            <FinanceAnalyticsPage />
          </ProtectedRoute>
        ),
      },

      // ── HR ────────────────────────────────────────────────────────────
      {
        path: '/hr/dashboard',
        element: (
          <ProtectedRoute requiredPermission="hr:read" allowedRoles={['GERANT', 'RESPONSABLE_RH']}>
            <HrDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/hr/employees',
        element: (
          <ProtectedRoute requiredPermission="hr:read" allowedRoles={['GERANT', 'RESPONSABLE_RH', 'CHEF_EQUIPE', 'CHEF_PROJET', 'RESPONSABLE_OPERATIONS']}>
            <EmployeesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/hr/departments',
        element: (
          <ProtectedRoute requiredPermission="hr:read" allowedRoles={['GERANT', 'RESPONSABLE_RH']}>
            <DepartmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/hr/leave-requests',
        element: (
          <ProtectedRoute requiredPermission="hr:read" allowedRoles={['GERANT', 'RESPONSABLE_RH', 'COLLABORATEUR', 'STAGIAIRE', 'CHEF_PROJET', 'CHEF_EQUIPE']}>
            <LeaveRequestsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/hr/portal',
        element: (
          <ProtectedRoute allowedRoles={['GERANT', 'COLLABORATEUR', 'STAGIAIRE', 'CHEF_PROJET', 'CHEF_EQUIPE']}>
            <EmployeePortalPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/hr/org-chart',
        element: (
          <ProtectedRoute requiredPermission="hr:read" allowedRoles={['GERANT', 'RESPONSABLE_RH']}>
            <OrgChartPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/hr/recruitment',
        element: (
          <ProtectedRoute requiredPermission="hr:read" allowedRoles={['GERANT', 'RESPONSABLE_RH']}>
            <RecruitmentPage />
          </ProtectedRoute>
        ),
      },

      // ── Documents ─────────────────────────────────────────────────────
      {
        path: '/documents',
        element: (
          <ProtectedRoute requiredPermission="documents:read" allowedRoles={['GERANT', 'SECRETAIRE', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER', 'CHEF_PROJET', 'COLLABORATEUR']}>
            <DocumentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/documents/history',
        element: (
          <ProtectedRoute requiredPermission="documents:read" allowedRoles={['GERANT', 'SECRETAIRE', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER', 'CHEF_PROJET', 'COLLABORATEUR']}>
            <DocumentsHistoryPage />
          </ProtectedRoute>
        ),
      },

      // ── Chat ──────────────────────────────────────────────────────────────
      { path: '/chat', element: <ChatPage /> },

      // ── Calendar ──────────────────────────────────────────────────────
      { path: '/calendar', element: <CalendarPage /> },

      // ── Reports ───────────────────────────────────────────────────────
      {
        path: '/reports',
        element: (
          <ProtectedRoute requiredPermission="reports:read" allowedRoles={['GERANT', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER', 'RESPONSABLE_MARKETING', 'RESPONSABLE_VENTES', 'CHEF_PROJET', 'CHEF_EQUIPE', 'RESPONSABLE_OPERATIONS']}>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/reports/new/hr',
        element: (
          <ProtectedRoute requiredPermission="reports:write" allowedRoles={['RESPONSABLE_RH', 'GERANT']}>
            <HrReportFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/reports/new/finance',
        element: (
          <ProtectedRoute requiredPermission="reports:write" allowedRoles={['RESPONSABLE_FINANCIER', 'GERANT']}>
            <FinanceReportFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/reports/:id/edit',
        element: (
          <ProtectedRoute requiredPermission="reports:write" allowedRoles={['RESPONSABLE_RH', 'RESPONSABLE_FINANCIER', 'GERANT']}>
            <ReportEditPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/reports/:id',
        element: (
          <ProtectedRoute requiredPermission="reports:read" allowedRoles={['GERANT', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER', 'RESPONSABLE_MARKETING', 'RESPONSABLE_VENTES', 'CHEF_PROJET', 'CHEF_EQUIPE', 'RESPONSABLE_OPERATIONS']}>
            <ReportDetailPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
