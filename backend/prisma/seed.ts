import { PrismaClient, Prisma, LeadStatus, LeadSource, ActivityType, ProjectStatus, MilestoneStatus, ProjectMemberRole, TaskStatus, TaskPriority, QuoteStatus, InvoiceStatus, PaymentMethod, ContractType, LeaveType, LeaveStatus, DocumentType, ChatRoomType, NotificationType, EventType, ReportType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting data reset and realistic seeding process...');

  // 1. CLEANING EXISTING DATA (Reverse dependency order to avoid foreign key errors)
  await prisma.auditLog.deleteMany({});
  await prisma.reportSchedule.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.eventAttendee.deleteMany({});
  await prisma.calendarEvent.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.messageReadStatus.deleteMany({});
  await prisma.messageReaction.deleteMany({});
  await prisma.messageAttachment.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.chatRoomMember.deleteMany({});
  await prisma.chatRoom.deleteMany({});
  await prisma.documentTag.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveBalance.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.quoteApprovalHistory.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.quoteItem.deleteMany({});
  await prisma.quote.deleteMany({});
  await prisma.taskAttachment.deleteMany({});
  await prisma.taskComment.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.projectFile.deleteMany({});
  await prisma.projectMilestone.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.clientContact.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.leadActivity.deleteMany({});
  await prisma.leadNote.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.expenseApprovalWorkflow.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.expenseCategory.deleteMany({});
  await prisma.salary.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.jobVacancy.deleteMany({});
  await prisma.onboardingTask.deleteMany({});
  await prisma.employeeHistory.deleteMany({});
  await prisma.payslip.deleteMany({});
  await prisma.employeeProfile.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.userPresence.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.role.deleteMany({});

  console.log('✅ Cleaned all existing transactional, CRM, and user data.');

  // 2. DEFINE SYSTEM PERMISSIONS
  const permissionsList = [
    { name: 'users:create', description: 'Create new user accounts' },
    { name: 'users:read', description: 'Read user list and details' },
    { name: 'users:update', description: 'Update existing user accounts' },
    { name: 'users:delete', description: 'Delete/deactivate user accounts' },
    { name: 'roles:read', description: 'View roles and their permissions' },
    { name: 'roles:update', description: 'Modify role permission assignments' },
    { name: 'hr:read', description: 'View HR records and details' },
    { name: 'hr:write', description: 'Modify HR records, contracts, leave' },
    { name: 'finance:read', description: 'View financial details and invoices' },
    { name: 'finance:write', description: 'Create/modify invoices and financial records' },
    { name: 'crm:read', description: 'View leads, clients and CRM data' },
    { name: 'crm:write', description: 'Create/modify leads and client data' },
    { name: 'projects:read', description: 'View projects, milestones and files' },
    { name: 'projects:write', description: 'Create/modify projects and assign members' },
    { name: 'tasks:read', description: 'View tasks, comments and attachments' },
    { name: 'tasks:write', description: 'Create/modify tasks and comments' },
    { name: 'documents:create', description: 'Generate document files like PDFs' },
    { name: 'documents:read', description: 'View generated reports and documents' },
    { name: 'calendar:read', description: 'View calendar events' },
    { name: 'calendar:write', description: 'Create/modify calendar events' },
    { name: 'reports:read', description: 'View reports and analytics' },
    { name: 'reports:write', description: 'Create/modify reports' },
  ];

  const dbPermissions: { [key: string]: any } = {};
  for (const perm of permissionsList) {
    const created = await prisma.permission.create({ data: perm });
    dbPermissions[perm.name] = created;
  }
  console.log(`Seeded ${permissionsList.length} permissions.`);

  // 3. DEFINE ROLES
  const roles = [
    { name: 'GERANT', description: 'Directeur Général - Contrôle total' },
    { name: 'SECRETAIRE', description: 'Secrétaire administratif / Assistante' },
    { name: 'RESPONSABLE_RH', description: 'Gestion des ressources humaines' },
    { name: 'RESPONSABLE_FINANCIER', description: 'Gestion financière et facturation' },
    { name: 'RESPONSABLE_MARKETING', description: 'Gestion du marketing digital' },
    { name: 'RESPONSABLE_VENTES', description: 'Gestion du CRM et des ventes' },
    { name: 'RESPONSABLE_OPERATIONS', description: 'Gestion des opérations de l\'agence' },
    { name: 'CHEF_PROJET', description: 'Chef de projet opérationnel' },
    { name: 'CHEF_EQUIPE', description: 'Chef d\'équipe opérationnelle' },
    { name: 'COLLABORATEUR', description: 'Collaborateur standard de l\'agence' },
    { name: 'STAGIAIRE', description: 'Stagiaire au sein de l\'agence' },
  ];

  const dbRoles: { [key: string]: any } = {};
  for (const r of roles) {
    const created = await prisma.role.create({ data: r });
    dbRoles[r.name] = created;
  }
  console.log(`Seeded ${roles.length} roles.`);

  // 4. MAP PERMISSIONS TO ROLES
  const rolePermissionsMap: { [roleName: string]: string[] } = {
    GERANT: [
      'users:create', 'users:read', 'users:update', 'users:delete',
      'roles:read', 'roles:update',
      'hr:read', 'hr:write',
      'finance:read', 'finance:write',
      'crm:read', 'crm:write',
      'projects:read', 'projects:write',
      'tasks:read', 'tasks:write',
      'documents:create', 'documents:read',
      'calendar:read', 'calendar:write',
      'reports:read', 'reports:write',
    ],
    SECRETAIRE: [
      'crm:read', 'crm:write',
      'finance:read', 'finance:write',
      'documents:read', 'documents:create',
      'calendar:read', 'calendar:write',
    ],
    RESPONSABLE_RH: [
      'users:create', 'users:read', 'users:update',
      'hr:read', 'hr:write',
      'projects:read',
      'tasks:read', 'tasks:write',
      'documents:read', 'documents:create',
      'calendar:read', 'calendar:write',
      'reports:read', 'reports:write',
    ],
    RESPONSABLE_FINANCIER: [
      'users:read',
      'finance:read', 'finance:write',
      'crm:read',
      'projects:read',
      'tasks:read',
      'documents:read', 'documents:create',
      'calendar:read', 'calendar:write',
      'reports:read', 'reports:write',
    ],
    RESPONSABLE_MARKETING: [
      'crm:read', 'crm:write',
      'reports:read', 'reports:write',
      'calendar:read', 'calendar:write',
      'documents:read', 'documents:create',
      'projects:read', 'tasks:read', 'tasks:write',
    ],
    RESPONSABLE_VENTES: [
      'crm:read', 'crm:write',
      'reports:read', 'reports:write',
      'calendar:read', 'calendar:write',
      'documents:read', 'documents:create',
      'finance:read', 'finance:write',
    ],
    RESPONSABLE_OPERATIONS: [
      'projects:read', 'projects:write',
      'tasks:read', 'tasks:write',
      'reports:read', 'reports:write',
      'calendar:read', 'calendar:write',
      'documents:read',
    ],
    CHEF_PROJET: [
      'projects:read', 'projects:write',
      'tasks:read', 'tasks:write',
      'reports:read', 'reports:write',
      'calendar:read', 'calendar:write',
      'documents:read', 'documents:create',
    ],
    CHEF_EQUIPE: [
      'projects:read',
      'tasks:read', 'tasks:write',
      'reports:read',
      'calendar:read', 'calendar:write',
      'documents:read',
    ],
    COLLABORATEUR: [
      'users:read',
      'projects:read',
      'tasks:read', 'tasks:write',
      'documents:read', 'documents:create',
      'calendar:read', 'calendar:write',
    ],
    STAGIAIRE: [
      'tasks:read', 'tasks:write',
      'calendar:read',
    ],
  };

  for (const [roleName, perms] of Object.entries(rolePermissionsMap)) {
    const roleId = dbRoles[roleName].id;
    for (const permName of perms) {
      const permissionId = dbPermissions[permName].id;
      await prisma.rolePermission.create({ data: { roleId, permissionId } });
    }
  }
  console.log('Mapped permissions to roles.');

  // 5. SEED EXACTLY 12 USERS WITH REALISTIC NAMES
  const passwordHash = await bcrypt.hash('AgencyOS@2026!', 10);

  const seedUsers = [
    { email: 'ceo@creativart.tn', firstName: 'Ahmed', lastName: 'Ben Ali', roleName: 'GERANT' },
    { email: 'secretary@creativart.tn', firstName: 'Rim', lastName: 'Trabelsi', roleName: 'SECRETAIRE' },
    { email: 'hr@creativart.tn', firstName: 'Alaa', lastName: 'Abid', roleName: 'RESPONSABLE_RH' },
    { email: 'finance@creativart.tn', firstName: 'Slim', lastName: 'Gharbi', roleName: 'RESPONSABLE_FINANCIER' },
    { email: 'marketing@creativart.tn', firstName: 'Hela', lastName: 'Ben Salem', roleName: 'RESPONSABLE_MARKETING' },
    { email: 'sales@creativart.tn', firstName: 'Mourad', lastName: 'Chaari', roleName: 'RESPONSABLE_VENTES' },
    { email: 'pm@creativart.tn', firstName: 'Fatma', lastName: 'Trabelsi', roleName: 'CHEF_PROJET' },
    { email: 'employee1@creativart.tn', firstName: 'Sami', lastName: 'Trabelsi', roleName: 'COLLABORATEUR' },
    { email: 'employee2@creativart.tn', firstName: 'Amira', lastName: 'Gharbi', roleName: 'COLLABORATEUR' },
    { email: 'employee3@creativart.tn', firstName: 'Yassine', lastName: 'Mansour', roleName: 'COLLABORATEUR' },
    { email: 'employee4@creativart.tn', firstName: 'Nadia', lastName: 'Ben Youssef', roleName: 'COLLABORATEUR' },
    { email: 'employee5@creativart.tn', firstName: 'Mohamed', lastName: 'Ghorbel', roleName: 'COLLABORATEUR' },
    { email: 'employee6@creativart.tn', firstName: 'Meriam', lastName: 'Kallel', roleName: 'COLLABORATEUR' },
    { email: 'operations@creativart.tn', firstName: 'Anis', lastName: 'Gargouri', roleName: 'RESPONSABLE_OPERATIONS' },
    { email: 'teamleader@creativart.tn', firstName: 'Zied', lastName: 'Mezghanni', roleName: 'CHEF_EQUIPE' },
    { email: 'intern@creativart.tn', firstName: 'Sarra', lastName: 'Feki', roleName: 'STAGIAIRE' },
  ];

  const dbUsers: { [email: string]: any } = {};
  for (const u of seedUsers) {
    const roleId = dbRoles[u.roleName].id;
    const created = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        roleId,
      },
    });
    dbUsers[u.email] = created;
  }
  console.log(`Seeded exactly ${seedUsers.length} users.`);

  // 6. SEED DEPARTMENTS
  const departments = [
    { name: 'Management', description: 'Direction générale et stratégique' },
    { name: 'Creative & Design', description: 'UI/UX design, branding et design graphique' },
    { name: 'Digital Marketing', description: 'SEO, marketing de contenu et campagnes ADS' },
    { name: 'Engineering & Development', description: 'Développement web, mobile et backend' },
    { name: 'Finance & Operations', description: 'Comptabilité, facturation et logistique' },
    { name: 'Human Resources', description: 'Ressources Humaines et recrutement' },
    { name: 'Sales & Growth', description: 'Développement commercial et CRM' },
  ];

  const dbDepartments: { [name: string]: any } = {};
  for (const dept of departments) {
    const created = await prisma.department.create({ data: dept });
    dbDepartments[dept.name] = created;
  }
  console.log(`Seeded ${departments.length} departments.`);

  // Update department managers
  await prisma.department.update({ where: { id: dbDepartments['Management'].id }, data: { managerId: dbUsers['ceo@creativart.tn'].id } });
  await prisma.department.update({ where: { id: dbDepartments['Finance & Operations'].id }, data: { managerId: dbUsers['finance@creativart.tn'].id } });
  await prisma.department.update({ where: { id: dbDepartments['Human Resources'].id }, data: { managerId: dbUsers['hr@creativart.tn'].id } });
  await prisma.department.update({ where: { id: dbDepartments['Digital Marketing'].id }, data: { managerId: dbUsers['marketing@creativart.tn'].id } });
  await prisma.department.update({ where: { id: dbDepartments['Sales & Growth'].id }, data: { managerId: dbUsers['sales@creativart.tn'].id } });
  await prisma.department.update({ where: { id: dbDepartments['Engineering & Development'].id }, data: { managerId: dbUsers['pm@creativart.tn'].id } });

  // 7. SEED EMPLOYEE PROFILES, CONTRACTS & SALARIES (Interconnected profiles for all 12 users)
  const hrMapping = [
    { email: 'ceo@creativart.tn', dept: 'Management', title: 'Directeur Général', code: 'EMP-001', sal: 12000 },
    { email: 'secretary@creativart.tn', dept: 'Finance & Operations', title: 'Secrétaire Administrative', code: 'EMP-002', sal: 3200 },
    { email: 'hr@creativart.tn', dept: 'Human Resources', title: 'Directeur des Ressources Humaines', code: 'EMP-003', sal: 5000 },
    { email: 'finance@creativart.tn', dept: 'Finance & Operations', title: 'Responsable Financier', code: 'EMP-004', sal: 5500 },
    { email: 'marketing@creativart.tn', dept: 'Digital Marketing', title: 'Responsable Marketing', code: 'EMP-005', sal: 4800 },
    { email: 'sales@creativart.tn', dept: 'Sales & Growth', title: 'Responsable des Ventes', code: 'EMP-006', sal: 5200 },
    { email: 'pm@creativart.tn', dept: 'Engineering & Development', title: 'Chef de Projet Technique', code: 'EMP-007', sal: 5000 },
    { email: 'employee1@creativart.tn', dept: 'Engineering & Development', title: 'Ingénieur Logiciel Principal', code: 'EMP-008', sal: 6200 },
    { email: 'employee2@creativart.tn', dept: 'Creative & Design', title: 'Designer UI/UX Senior', code: 'EMP-009', sal: 4200 },
    { email: 'employee3@creativart.tn', dept: 'Engineering & Development', title: 'Développeur Fullstack', code: 'EMP-010', sal: 4000 },
    { email: 'employee4@creativart.tn', dept: 'Creative & Design', title: 'Designer UI/UX Junior', code: 'EMP-011', sal: 3800 },
    { email: 'employee5@creativart.tn', dept: 'Engineering & Development', title: 'Ingénieur DevOps Senior', code: 'EMP-012', sal: 4500 },
    { email: 'employee6@creativart.tn', dept: 'Digital Marketing', title: 'Content Manager', code: 'EMP-013', sal: 3900 },
    { email: 'operations@creativart.tn', dept: 'Finance & Operations', title: 'Responsable des Opérations', code: 'EMP-014', sal: 4700 },
    { email: 'teamleader@creativart.tn', dept: 'Engineering & Development', title: 'Chef d\'Équipe', code: 'EMP-015', sal: 4500 },
    { email: 'intern@creativart.tn', dept: 'Engineering & Development', title: 'Stagiaire', code: 'EMP-016', sal: 1200 },
  ];

  const dbEmployeeProfiles: { [email: string]: any } = {};
  for (const hrU of hrMapping) {
    const user = dbUsers[hrU.email];
    const dept = dbDepartments[hrU.dept];

    const profile = await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        departmentId: dept.id,
        jobTitle: hrU.title,
        employeeCode: hrU.code,
        phone: `+216 98 765 ${String(hrMapping.indexOf(hrU)).padStart(3, '0')}`,
        address: 'Berges du Lac 2, Tunis, Tunisie',
        hireDate: new Date('2024-01-15T00:00:00Z'),
        dateOfBirth: new Date('1990-05-15T00:00:00Z'),
        nationalId: `09876${String(hrMapping.indexOf(hrU)).padStart(3, '0')}`,
        emergencyContact: 'Urgence Famille: +216 22 111 333',
        performanceScore: 85 + (hrMapping.indexOf(hrU) % 3) * 5,
        status: 'ACTIVE',
      }
    });
    dbEmployeeProfiles[hrU.email] = profile;

    await prisma.contract.create({
      data: {
        employeeId: profile.id,
        type: ContractType.CDI,
        startDate: new Date('2024-01-15T00:00:00Z'),
        grossSalary: new Prisma.Decimal(hrU.sal),
        currency: 'TND',
        isActive: true,
        notes: 'Contrat CDI d\'agence CreativArt.',
      }
    });

    await prisma.salary.create({
      data: {
        employeeId: profile.id,
        amount: new Prisma.Decimal(hrU.sal),
        currency: 'TND',
        effectiveFrom: new Date('2024-01-15T00:00:00Z'),
        note: 'Salaire initial fixe.',
      }
    });

    for (const lt of [LeaveType.ANNUAL, LeaveType.SICK, LeaveType.UNPAID]) {
      await prisma.leaveBalance.create({
        data: {
          employeeId: profile.id,
          leaveType: lt,
          year: 2026,
          totalDays: lt === LeaveType.ANNUAL ? 26 : lt === LeaveType.SICK ? 10 : 5,
          usedDays: 0,
          pendingDays: 0,
        }
      });
    }
  }
  console.log('Seeded employee profiles, CDI contracts, salaries, and leave balances.');

  // 8. SEED exactly 20 CLIENTS
  const clientsData = [
    { company: 'Vortex Gaming', industry: 'E-Sports & Gaming', web: 'vortex.gg', tax: '1234567A/M/000', contact: 'Kais Ben Youssef' },
    { company: 'Medina Tourism', industry: 'Travel & Hospitality', web: 'medinatourism.tn', tax: '9876543B/N/000', contact: 'Fatma Chahed' },
    { company: 'Carrefour Tunisie', industry: 'Retail & Supermarkets', web: 'carrefour.tn', tax: '5555555C/P/000', contact: 'Hechmi Laribi' },
    { company: 'Ooredoo Tunisie', industry: 'Telecommunications', web: 'ooredoo.tn', tax: '1111111D/R/000', contact: 'Amel Mansour' },
    { company: 'BIAT', industry: 'Banking & Finance', web: 'biat.com.tn', tax: '2222222B/M/000', contact: 'Bassem Belhadj' },
    { company: 'Attijari Bank', industry: 'Banking & Finance', web: 'attijaribank.com.tn', tax: '3333333C/N/000', contact: 'Sonia Cheikh' },
    { company: 'Monoprix Tunisie', industry: 'Retail & Supermarkets', web: 'monoprix.com.tn', tax: '4444444D/M/000', contact: 'Nabil Touati' },
    { company: 'Tunisair', industry: 'Aviation & Transport', web: 'tunisair.com.tn', tax: '6666666A/N/000', contact: 'Walid Sfar' },
    { company: 'SFBT', industry: 'Beverages & Food', web: 'sfbt.com.tn', tax: '7777777B/P/000', contact: 'Tarek Hamdi' },
    { company: 'Orange Tunisie', industry: 'Telecommunications', web: 'orange.tn', tax: '8888888C/R/000', contact: 'Ines Ben Slimane' },
    { company: 'Poulina Group', industry: 'Agribusiness', web: 'poulinagroup.com', tax: '1010101D/M/000', contact: 'Selim Baba' },
    { company: 'Sousse Palace', industry: 'Travel & Hospitality', web: 'soussepalace.com', tax: '2020202A/N/000', contact: 'Houda Jellouli' },
    { company: 'Clinique de l\'Espoir', industry: 'Healthcare', web: 'cliniqueespoir.tn', tax: '3030303B/P/000', contact: 'Dr. Sami Fehri' },
    { company: 'Wallyscar', industry: 'Automotive', web: 'wallyscar.com', tax: '4040404C/R/000', contact: 'Omar Guiga' },
    { company: 'Université Centrale', industry: 'Education', web: 'universitecentrale.tn', tax: '5050505D/M/000', contact: 'Chadlia Ben Said' },
    { company: 'Tunisietel', industry: 'Telecommunications', web: 'tunisietelecom.tn', tax: '6060606A/P/000', contact: 'Moncef Boukhris' },
    { company: 'Sheraton Tunis', industry: 'Travel & Hospitality', web: 'sheratontunis.com', tax: '7070707B/R/000', contact: 'Nizar Fekih' },
    { company: 'Tunisie Leasing', industry: 'Banking & Finance', web: 'tunisieleasing.com.tn', tax: '8080808C/M/000', contact: 'Rania El Euch' },
    { company: 'MG Tunisie', industry: 'Retail & Supermarkets', web: 'magasingeneral.com.tn', tax: '9090909D/N/000', contact: 'Chokri Dridi' },
    { company: 'TotalEnergies Tunisie', industry: 'Energy & Utilities', web: 'totalenergies.tn', tax: '0010101A/P/000', contact: 'Youssef El Kateb' },
  ];

  const dbClients: { [company: string]: any } = {};
  for (const cl of clientsData) {
    const created = await prisma.client.create({
      data: {
        companyName: cl.company,
        industry: cl.industry,
        website: `https://www.${cl.web}`,
        address: 'Les Berges du Lac 1, Tunis',
        city: 'Tunis',
        country: 'Tunisia',
        taxId: cl.tax,
        isActive: true,
        createdById: dbUsers['ceo@creativart.tn'].id,
      }
    });
    dbClients[cl.company] = created;

    await prisma.clientContact.create({
      data: {
        clientId: created.id,
        firstName: cl.contact.split(' ')[0],
        lastName: cl.contact.split(' ').slice(1).join(' '),
        email: `contact@${cl.web}`,
        phone: cl.company === 'Vortex Gaming' ? '+216 71 111 222' : '+216 71 888 999',
        position: 'Financial Director',
        isPrimary: true,
      }
    });
  }
  console.log(`Seeded exactly ${clientsData.length} Clients.`);

  // 9. SEED LEADS
  const leadsData = [
    { company: 'Monoprix Tunisie', val: 35000, size: 150, status: LeadStatus.QUALIFIED },
    { company: 'Tunisair', val: 75000, size: 2000, status: LeadStatus.PROPOSAL_SENT },
    { company: 'SFBT', val: 120000, size: 1000, status: LeadStatus.NEGOTIATION },
    { company: 'Orange Tunisie', val: 40000, size: 500, status: LeadStatus.NEW },
  ];

  const dbLeads: { [company: string]: any } = {};
  for (const ld of leadsData) {
    const created = await prisma.lead.create({
      data: {
        companyName: ld.company,
        contactName: `Responsable ${ld.company}`,
        email: `contact@${ld.company.toLowerCase().replace(/\s+/g, '')}.tn`,
        phone: '+216 99 111 222',
        estimatedValue: new Prisma.Decimal(ld.val),
        currency: 'TND',
        source: LeadSource.WEBSITE,
        status: ld.status,
        companySize: ld.size,
        description: `Projet de transformation digitale de ${ld.company}`,
        createdById: dbUsers['ceo@creativart.tn'].id,
        assignedToId: dbUsers['sales@creativart.tn'].id,
      }
    });
    dbLeads[ld.company] = created;

    await prisma.leadActivity.create({
      data: {
        leadId: created.id,
        performedById: dbUsers['sales@creativart.tn'].id,
        type: ActivityType.CALL,
        subject: 'Premier contact commercial',
        description: 'Appel de découverte des besoins de l\'entreprise.',
      }
    });
  }
  console.log(`Seeded ${leadsData.length} Leads.`);

  // 10. SEED exactly 15 PROJECTS
  const projectsData = [
    { name: '[PRJ-001] Vortex Mobile App', client: 'Vortex Gaming', status: ProjectStatus.ACTIVE, budget: 85000 },
    { name: '[PRJ-002] Medina Branding & Website', client: 'Medina Tourism', status: ProjectStatus.ACTIVE, budget: 35000 },
    { name: '[PRJ-003] Carrefour Inventory Dashboard', client: 'Carrefour Tunisie', status: ProjectStatus.PLANNING, budget: 120000 },
    { name: '[PRJ-004] Vortex Landing Page', client: 'Vortex Gaming', status: ProjectStatus.COMPLETED, budget: 15000 },
    { name: '[PRJ-005] Ooredoo Summer Campaign', client: 'Ooredoo Tunisie', status: ProjectStatus.ACTIVE, budget: 65000 },
    { name: '[PRJ-006] BIAT Mobile Banking Redesign', client: 'BIAT', status: ProjectStatus.ACTIVE, budget: 180000 },
    { name: '[PRJ-007] Attijari Web Portal', client: 'Attijari Bank', status: ProjectStatus.ACTIVE, budget: 95000 },
    { name: '[PRJ-008] Monoprix E-Commerce App', client: 'Monoprix Tunisie', status: ProjectStatus.PLANNING, budget: 110000 },
    { name: '[PRJ-009] Tunisair Booking UX Audit', client: 'Tunisair', status: ProjectStatus.COMPLETED, budget: 40000 },
    { name: '[PRJ-010] SFBT Corporate Website', client: 'SFBT', status: ProjectStatus.ACTIVE, budget: 55000 },
    { name: '[PRJ-011] Orange Fiber Promo Video', client: 'Orange Tunisie', status: ProjectStatus.PLANNING, budget: 30000 },
    { name: '[PRJ-012] Poulina Packaging Design', client: 'Poulina Group', status: ProjectStatus.ACTIVE, budget: 25000 },
    { name: '[PRJ-013] Sheraton Booking System', client: 'Sheraton Tunis', status: ProjectStatus.ACTIVE, budget: 75000 },
    { name: '[PRJ-014] Wallyscar E-Catalog App', client: 'Wallyscar', status: ProjectStatus.ACTIVE, budget: 50000 },
    { name: '[PRJ-015] Central Uni Portal Dev', client: 'Université Centrale', status: ProjectStatus.ACTIVE, budget: 60000 },
  ];

  const dbProjects: { [name: string]: any } = {};
  for (const pr of projectsData) {
    const client = dbClients[pr.client];
    const created = await prisma.project.create({
      data: {
        name: pr.name,
        description: `Développement opérationnel de la solution ${pr.name} pour ${pr.client}`,
        status: pr.status,
        clientId: client.id,
        budget: new Prisma.Decimal(pr.budget),
        currency: 'TND',
        startDate: new Date('2026-01-10T00:00:00Z'),
        endDate: new Date('2026-12-15T00:00:00Z'),
      }
    });
    dbProjects[pr.name] = created;

    // Add PM as manager
    await prisma.projectMember.create({
      data: {
        projectId: created.id,
        userId: dbUsers['pm@creativart.tn'].id,
        role: ProjectMemberRole.MANAGER,
      }
    });

    // Add milestones
    await prisma.projectMilestone.create({
      data: {
        projectId: created.id,
        title: 'Phase 1: Spécifications approuvées',
        description: 'Signature de la charte de projet et des maquettes UI.',
        dueDate: new Date('2026-06-30T00:00:00Z'),
        status: pr.status === ProjectStatus.COMPLETED ? MilestoneStatus.COMPLETED : MilestoneStatus.IN_PROGRESS,
      }
    });
  }
  console.log(`Seeded exactly ${projectsData.length} Projects and Milestones.`);

  // Add members to Vortex Mobile App project
  await prisma.projectMember.create({ data: { projectId: dbProjects['[PRJ-001] Vortex Mobile App'].id, userId: dbUsers['employee1@creativart.tn'].id, role: ProjectMemberRole.MEMBER } });
  await prisma.projectMember.create({ data: { projectId: dbProjects['[PRJ-001] Vortex Mobile App'].id, userId: dbUsers['employee2@creativart.tn'].id, role: ProjectMemberRole.MEMBER } });
  await prisma.projectMember.create({ data: { projectId: dbProjects['[PRJ-001] Vortex Mobile App'].id, userId: dbUsers['employee3@creativart.tn'].id, role: ProjectMemberRole.MEMBER } });

  // 11. SEED 20 DETAILED TASKS
  const tasksData = [
    { title: 'Conception des maquettes Figma', project: '[PRJ-001] Vortex Mobile App', assignee: 'employee2@creativart.tn', status: TaskStatus.DONE, hrs: 25 },
    { title: 'Développement de l\'API d\'authentification JWT', project: '[PRJ-001] Vortex Mobile App', assignee: 'employee1@creativart.tn', status: TaskStatus.IN_PROGRESS, hrs: 30 },
    { title: 'Intégration de l\'affichage des tournois e-sport', project: '[PRJ-001] Vortex Mobile App', assignee: 'employee3@creativart.tn', status: TaskStatus.TODO, hrs: 45 },
    { title: 'Charte graphique et logo Medina', project: '[PRJ-002] Medina Branding & Website', assignee: 'employee2@creativart.tn', status: TaskStatus.DONE, hrs: 20 },
    { title: 'Intégration du module de réservation hôtelière', project: '[PRJ-002] Medina Branding & Website', assignee: 'employee3@creativart.tn', status: TaskStatus.IN_PROGRESS, hrs: 50 },
    { title: 'Spécifications fonctionnelles Carrefour', project: '[PRJ-003] Carrefour Inventory Dashboard', assignee: 'employee1@creativart.tn', status: TaskStatus.TODO, hrs: 15 },
    { title: 'Conception du schéma de base de données PostgreSQL', project: '[PRJ-003] Carrefour Inventory Dashboard', assignee: 'employee3@creativart.tn', status: TaskStatus.TODO, hrs: 25 },
    { title: 'Intégration HTML/CSS responsive', project: '[PRJ-004] Vortex Landing Page', assignee: 'employee2@creativart.tn', status: TaskStatus.DONE, hrs: 12 },
    { title: 'Validation des formulaires d\'inscription client', project: '[PRJ-004] Vortex Landing Page', assignee: 'employee1@creativart.tn', status: TaskStatus.DONE, hrs: 8 },
    { title: 'Rédaction du contenu éditorial pour les réseaux sociaux', project: '[PRJ-001] Vortex Mobile App', assignee: 'marketing@creativart.tn', status: TaskStatus.IN_PROGRESS, hrs: 10 },
    { title: 'Configuration du serveur d\'intégration continue Jenkins', project: '[PRJ-001] Vortex Mobile App', assignee: 'employee5@creativart.tn', status: TaskStatus.DONE, hrs: 16 },
    { title: 'Intégration de la passerelle de paiement bancaire', project: '[PRJ-006] BIAT Mobile Banking Redesign', assignee: 'employee1@creativart.tn', status: TaskStatus.IN_PROGRESS, hrs: 60 },
    { title: 'Rédaction des spécifications de sécurité bancaire', project: '[PRJ-006] BIAT Mobile Banking Redesign', assignee: 'employee5@creativart.tn', status: TaskStatus.DONE, hrs: 20 },
    { title: 'Création du contenu visuel Instagram', project: '[PRJ-005] Ooredoo Summer Campaign', assignee: 'employee6@creativart.tn', status: TaskStatus.DONE, hrs: 15 },
    { title: 'Audits SEO techniques sur site existant', project: '[PRJ-005] Ooredoo Summer Campaign', assignee: 'employee6@creativart.tn', status: TaskStatus.IN_PROGRESS, hrs: 12 },
    { title: 'Configuration du déploiement Docker sur AWS', project: '[PRJ-003] Carrefour Inventory Dashboard', assignee: 'employee5@creativart.tn', status: TaskStatus.TODO, hrs: 40 },
    { title: 'Conception ergonomique du menu mobile', project: '[PRJ-007] Attijari Web Portal', assignee: 'employee4@creativart.tn', status: TaskStatus.DONE, hrs: 14 },
    { title: 'Intégration des composants UI du tableau de bord', project: '[PRJ-007] Attijari Web Portal', assignee: 'employee4@creativart.tn', status: TaskStatus.IN_PROGRESS, hrs: 22 },
    { title: 'Revue de code des API endpoints', project: '[PRJ-001] Vortex Mobile App', assignee: 'employee1@creativart.tn', status: TaskStatus.DONE, hrs: 8 },
    { title: 'Validation QA finale des formulaires', project: '[PRJ-009] Tunisair Booking UX Audit', assignee: 'employee3@creativart.tn', status: TaskStatus.DONE, hrs: 18 },
  ];

  for (let i = 0; i < tasksData.length; i++) {
    const t = tasksData[i];
    const proj = dbProjects[t.project];
    const assignee = dbUsers[t.assignee];

    await prisma.task.create({
      data: {
        title: t.title,
        description: `Description détaillée pour la tâche: ${t.title}. En accord avec les exigences de ${t.project}.`,
        status: t.status,
        priority: i % 4 === 0 ? TaskPriority.CRITICAL : i % 4 === 1 ? TaskPriority.HIGH : i % 4 === 2 ? TaskPriority.MEDIUM : TaskPriority.LOW,
        projectId: proj.id,
        assigneeId: assignee.id,
        createdById: dbUsers['pm@creativart.tn'].id,
        dueDate: new Date(Date.now() + (i + 1) * 3 * 24 * 3600 * 1000),
        estimatedHours: new Prisma.Decimal(t.hrs),
        actualHours: t.status === TaskStatus.DONE ? new Prisma.Decimal(t.hrs) : undefined,
      }
    });
  }
  console.log(`Seeded ${tasksData.length} Tasks.`);

  // 12. SEED QUOTES (5 quotes)
  const quotesData = [
    { ref: 'QUO-2026-001', client: 'Vortex Gaming', project: '[PRJ-004] Vortex Landing Page', status: QuoteStatus.ACCEPTED, sub: 12605 },
    { ref: 'QUO-2026-002', client: 'Medina Tourism', project: '[PRJ-002] Medina Branding & Website', status: QuoteStatus.APPROVED, sub: 29412 },
    { ref: 'QUO-2026-003', client: 'Carrefour Tunisie', project: '[PRJ-003] Carrefour Inventory Dashboard', status: QuoteStatus.PENDING_APPROVAL, sub: 100840 },
    { ref: 'QUO-2026-004', client: 'Ooredoo Tunisie', project: null, status: QuoteStatus.DRAFT, sub: 46218 },
    { ref: 'QUO-2026-005', client: 'BIAT', project: null, status: QuoteStatus.REJECTED, sub: 35294 },
  ];

  const dbQuotes: { [ref: string]: any } = {};
  for (const q of quotesData) {
    const cl = dbClients[q.client];
    const pr = q.project ? dbProjects[q.project] : null;
    const taxRate = 19;
    const taxAmount = q.sub * (taxRate / 100);
    const total = q.sub + taxAmount;

    const created = await prisma.quote.create({
      data: {
        reference: q.ref,
        clientId: cl.id,
        projectId: pr ? pr.id : null,
        createdById: dbUsers['ceo@creativart.tn'].id,
        status: q.status,
        validUntil: new Date('2026-12-31T00:00:00Z'),
        subtotal: new Prisma.Decimal(q.sub),
        taxRate: new Prisma.Decimal(taxRate),
        taxAmount: new Prisma.Decimal(taxAmount),
        total: new Prisma.Decimal(total),
        notes: 'Conditions générales de vente de CreativArt applicables.',
        terms: 'Règlement 30 jours à réception de facture.',
      }
    });
    dbQuotes[q.ref] = created;

    await prisma.quoteItem.create({
      data: {
        quoteId: created.id,
        description: `Prestations intellectuelles de conseil et développement - Réf ${q.ref}`,
        quantity: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(q.sub),
        total: new Prisma.Decimal(q.sub),
      }
    });

    if (q.status === QuoteStatus.APPROVED || q.status === QuoteStatus.ACCEPTED) {
      await prisma.quoteApprovalHistory.create({
        data: {
          quoteId: created.id,
          userId: dbUsers['ceo@creativart.tn'].id,
          status: 'APPROVED',
          notes: 'Devis approuvé commercialement.',
        }
      });
    } else if (q.status === QuoteStatus.REJECTED) {
      await prisma.quoteApprovalHistory.create({
        data: {
          quoteId: created.id,
          userId: dbUsers['ceo@creativart.tn'].id,
          status: 'REJECTED',
          notes: 'Devis rejeté : remise hors limites.',
        }
      });
    }
  }
  console.log('Seeded Quotes and Approval History.');

  // 13. SEED INVOICES & PAYMENTS (5 invoices)
  const invoicesData = [
    { ref: 'INV-2026-001', client: 'Vortex Gaming', project: '[PRJ-004] Vortex Landing Page', status: InvoiceStatus.PAID, sub: 12605, paid: 15000, quoteRef: 'QUO-2026-001', offsetDays: -40 },
    { ref: 'INV-2026-002', client: 'Medina Tourism', project: '[PRJ-002] Medina Branding & Website', status: InvoiceStatus.PARTIALLY_PAID, sub: 29412, paid: 17500, quoteRef: 'QUO-2026-002', offsetDays: -20 },
    { ref: 'INV-2026-003', client: 'Carrefour Tunisie', project: '[PRJ-003] Carrefour Inventory Dashboard', status: InvoiceStatus.SENT, sub: 100840, paid: 0, quoteRef: 'QUO-2026-003', offsetDays: 5 },
    { ref: 'INV-2026-004', client: 'Ooredoo Tunisie', project: null, status: InvoiceStatus.OVERDUE, sub: 46218, paid: 0, quoteRef: 'QUO-2026-004', offsetDays: -10 },
    { ref: 'INV-2026-005', client: 'Vortex Gaming', project: '[PRJ-001] Vortex Mobile App', status: InvoiceStatus.DRAFT, sub: 35000, paid: 0, quoteRef: null, offsetDays: 30 },
  ];

  const dbInvoices: { [ref: string]: any } = {};
  for (const inv of invoicesData) {
    const cl = dbClients[inv.client];
    const pr = inv.project ? dbProjects[inv.project] : null;
    const q = inv.quoteRef ? dbQuotes[inv.quoteRef] : null;
    const taxRate = 19;
    const taxAmount = inv.sub * (taxRate / 100);
    const total = inv.sub + taxAmount;

    const created = await prisma.invoice.create({
      data: {
        reference: inv.ref,
        clientId: cl.id,
        projectId: pr ? pr.id : null,
        quoteId: q ? q.id : null,
        createdById: dbUsers['finance@creativart.tn'].id,
        status: inv.status,
        issueDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        dueDate: new Date(Date.now() + inv.offsetDays * 24 * 3600 * 1000),
        subtotal: new Prisma.Decimal(inv.sub),
        taxRate: new Prisma.Decimal(taxRate),
        taxAmount: new Prisma.Decimal(taxAmount),
        total: new Prisma.Decimal(total),
        paidAmount: new Prisma.Decimal(inv.paid),
        notes: 'Facture payable par virement bancaire.',
        terms: 'Virement sous 30 jours nets d\'échéance.',
      }
    });
    dbInvoices[inv.ref] = created;

    await prisma.invoiceItem.create({
      data: {
        invoiceId: created.id,
        description: `Facturation de prestations de services - Réf ${inv.ref}`,
        quantity: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(inv.sub),
        total: new Prisma.Decimal(inv.sub),
      }
    });

    if (inv.paid > 0) {
      await prisma.payment.create({
        data: {
          invoiceId: created.id,
          amount: new Prisma.Decimal(inv.paid),
          method: PaymentMethod.BANK_TRANSFER,
          paidAt: new Date(Date.now() - 15 * 24 * 3600 * 1000),
          reference: `TRSF-${inv.ref}-OK`,
        }
      });
    }
  }
  console.log('Seeded Invoices and Payments.');

  // 14. SEED EXPENSE CATEGORIES & EXPENSES
  const categoriesData = [
    { name: 'Logiciels & Abonnements', description: 'Souscriptions d\'outils SaaS' },
    { name: 'Fournitures de Bureau', description: 'Papeterie, stylos et consommables' },
    { name: 'Équipements & Matériels', description: 'Ordinateurs, écrans et hardware' },
    { name: 'Repas & Réceptions', description: 'Frais de repas d\'affaires et réceptions' },
    { name: 'Services Publics', description: 'Factures de télécommunication, internet et électricité' },
    { name: 'Salaires & Rémunérations', description: 'Dépenses salariales de l\'agence' },
  ];

  const dbExpenseCategories: { [name: string]: any } = {};
  for (const cat of categoriesData) {
    const created = await prisma.expenseCategory.create({ data: cat });
    dbExpenseCategories[cat.name] = created;
  }

  const expensesData = [
    { cat: 'Logiciels & Abonnements', subUser: 'employee1@creativart.tn', amt: 250, isApp: true, desc: 'Abonnement annuel GitHub Enterprise', dep: 'Engineering & Development', proj: '[PRJ-001] Vortex Mobile App' },
    { cat: 'Fournitures de Bureau', subUser: 'secretary@creativart.tn', amt: 120, isApp: true, desc: 'Achat ramettes de papier et cartouches d\'encre', dep: 'Finance & Operations', proj: null },
    { cat: 'Équipements & Matériels', subUser: 'employee2@creativart.tn', amt: 4500, isApp: true, desc: 'MacBook Pro 16 pour designer UI/UX', dep: 'Creative & Design', proj: '[PRJ-002] Medina Branding & Website' },
    { cat: 'Repas & Réceptions', subUser: 'sales@creativart.tn', amt: 350, isApp: false, desc: 'Dîner commercial de fin d\'année avec client Vortex', dep: 'Sales & Growth', proj: null },
    { cat: 'Services Publics', subUser: 'secretary@creativart.tn', amt: 1200, isApp: null, desc: 'Facture internet fibre optique - Creative Space', dep: 'Finance & Operations', proj: null },
  ];

  for (let i = 0; i < expensesData.length; i++) {
    const exp = expensesData[i];
    const cat = dbExpenseCategories[exp.cat];
    const user = dbUsers[exp.subUser];
    const dept = dbDepartments[exp.dep];
    const proj = exp.proj ? dbProjects[exp.proj] : null;

    const created = await prisma.expense.create({
      data: {
        categoryId: cat.id,
        submittedById: user.id,
        description: exp.desc,
        amount: new Prisma.Decimal(exp.amt),
        currency: 'TND',
        expenseDate: new Date(),
        isApproved: exp.isApp,
        approvedById: exp.isApp === true ? dbUsers['finance@creativart.tn'].id : exp.isApp === false ? dbUsers['ceo@creativart.tn'].id : null,
        notes: exp.isApp === true ? 'Facture vérifiée, virement effectué.' : exp.isApp === false ? 'Refusé : montant non justifié.' : undefined,
        departmentId: dept.id,
        projectId: proj ? proj.id : null,
      }
    });

    if (exp.isApp !== null) {
      await prisma.expenseApprovalWorkflow.create({
        data: {
          expenseId: created.id,
          userId: exp.isApp === true ? dbUsers['finance@creativart.tn'].id : dbUsers['ceo@creativart.tn'].id,
          status: exp.isApp ? 'APPROVED' : 'REJECTED',
          notes: exp.isApp ? 'Dépense conforme.' : 'Frais de repas non autorisés.',
        }
      });
    }
  }
  console.log('Seeded Expenses and workflows.');

  // 15. SEED LEAVE REQUESTS
  const leavesData = [
    { user: 'employee1@creativart.tn', type: LeaveType.ANNUAL, days: 5, status: LeaveStatus.APPROVED, offsetStart: 45, offsetEnd: 50 },
    { user: 'employee2@creativart.tn', type: LeaveType.SICK, days: 2, status: LeaveStatus.APPROVED, offsetStart: -10, offsetEnd: -8 },
    { user: 'employee3@creativart.tn', type: LeaveType.ANNUAL, days: 10, status: LeaveStatus.PENDING, offsetStart: 70, offsetEnd: 80 },
    { user: 'marketing@creativart.tn', type: LeaveType.ANNUAL, days: 3, status: LeaveStatus.REJECTED, offsetStart: 15, offsetEnd: 18 },
  ];

  for (const lv of leavesData) {
    const profile = dbEmployeeProfiles[lv.user];
    const user = dbUsers[lv.user];

    await prisma.leaveRequest.create({
      data: {
        employeeId: profile.id,
        requestedById: user.id,
        type: lv.type,
        startDate: new Date(Date.now() + lv.offsetStart * 24 * 3600 * 1000),
        endDate: new Date(Date.now() + lv.offsetEnd * 24 * 3600 * 1000),
        days: new Prisma.Decimal(lv.days),
        status: lv.status,
        reason: lv.type === LeaveType.ANNUAL ? 'Vacances annuelles d\'été' : 'Consultation médicale urgente',
        reviewedById: lv.status !== LeaveStatus.PENDING ? dbUsers['hr@creativart.tn'].id : null,
        reviewedAt: lv.status !== LeaveStatus.PENDING ? new Date() : null,
        reviewNote: lv.status === LeaveStatus.APPROVED ? 'Congés approuvés.' : lv.status === LeaveStatus.REJECTED ? 'Congé rejeté : manque d\'effectif à cette période.' : undefined,
      }
    });
  }
  console.log('Seeded Leave Requests.');

  // 16. SEED CHAT ROOMS & MESSAGES
  const channelGeneral = await prisma.chatRoom.create({
    data: {
      name: 'Général',
      type: ChatRoomType.CHANNEL,
    }
  });

  const roomDirect = await prisma.chatRoom.create({
    data: {
      type: ChatRoomType.DIRECT,
    }
  });

  // Add members to channels
  for (const user of Object.values(dbUsers)) {
    await prisma.chatRoomMember.create({
      data: {
        roomId: channelGeneral.id,
        userId: user.id,
      }
    });
  }

  await prisma.chatRoomMember.create({ data: { roomId: roomDirect.id, userId: dbUsers['hr@creativart.tn'].id } });
  await prisma.chatRoomMember.create({ data: { roomId: roomDirect.id, userId: dbUsers['employee1@creativart.tn'].id } });

  // Add messages
  await prisma.message.create({
    data: {
      roomId: channelGeneral.id,
      senderId: dbUsers['ceo@creativart.tn'].id,
      content: 'Bonjour à l\'équipe de CreativArt ! Lancement réussi d\'AgencyOS.',
    }
  });

  await prisma.message.create({
    data: {
      roomId: channelGeneral.id,
      senderId: dbUsers['secretary@creativart.tn'].id,
      content: 'S\'il vous plaît, n\'oubliez pas de soumettre vos notes de frais avant vendredi.',
    }
  });

  await prisma.message.create({
    data: {
      roomId: roomDirect.id,
      senderId: dbUsers['hr@creativart.tn'].id,
      content: 'Salut Sami, as-tu soumis ta demande de congé annuel pour le mois d\'août ?',
    }
  });

  await prisma.message.create({
    data: {
      roomId: roomDirect.id,
      senderId: dbUsers['employee1@creativart.tn'].id,
      content: 'Oui Alaa, elle est en cours de validation.',
    }
  });
  console.log('Seeded Chat Rooms, Members, and initial Messages.');

  // 17. SEED NOTIFICATIONS
  const notifications = [
    { email: 'ceo@creativart.tn', title: 'Devis en attente', body: 'Le devis QUO-2026-003 pour Carrefour Tunisie attend votre approbation.' },
    { email: 'finance@creativart.tn', title: 'Facture en retard', body: 'La facture INV-2026-004 de Ooredoo Tunisie a dépassé sa date d\'échéance.' },
    { email: 'employee1@creativart.tn', title: 'Demande de congé approuvée', body: 'Votre demande de congé annuel du 10 au 15 août 2026 a été acceptée.' },
  ];

  for (const n of notifications) {
    const user = dbUsers[n.email];
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.SYSTEM,
        title: n.title,
        body: n.body,
        isRead: false,
      }
    });
  }
  console.log('Seeded Notifications.');

  // 18. SEED DOCUMENTS
  const docClient = Object.values(dbClients)[0]; // Vortex Gaming
  await prisma.document.create({
    data: {
      title: 'Registre National des Entreprises (RNE)',
      type: DocumentType.RNE,
      url: 'https://cdn.agencyos.com/docs/rne_creativart.pdf',
      size: 1048576,
      mimeType: 'application/pdf',
      description: 'Copie certifiée conforme du RNE de la société',
      uploadedById: dbUsers['ceo@creativart.tn'].id,
      tags: { create: [{ tag: 'Juridique' }, { tag: 'Officiel' }] }
    }
  });

  await prisma.document.create({
    data: {
      title: 'Contrat Cadre de Prestation - Vortex Gaming',
      type: DocumentType.CONTRACT,
      url: 'https://cdn.agencyos.com/docs/contrat_vortex.pdf',
      size: 2097152,
      mimeType: 'application/pdf',
      description: 'Contrat de prestation signé pour le projet Vortex Hub',
      uploadedById: dbUsers['ceo@creativart.tn'].id,
      clientId: docClient.id,
      tags: { create: [{ tag: 'Contrat' }, { tag: 'Client' }] }
    }
  });

  await prisma.document.create({
    data: {
      title: 'Statuts de la SARL CreativArt',
      type: DocumentType.OTHER,
      url: 'https://cdn.agencyos.com/docs/statuts_creativart.pdf',
      size: 4194304,
      mimeType: 'application/pdf',
      description: 'Statuts officiels constitutifs de l\'entreprise',
      uploadedById: dbUsers['hr@creativart.tn'].id,
      tags: { create: [{ tag: 'Constitution' }, { tag: 'Admin' }] }
    }
  });
  console.log('Seeded Documents & DocumentTags.');

  console.log('✅ Seeding complete. All database state cleaned and populated with 12 realistic interconnected users!');
}

main()
  .catch((e) => {
    console.error('Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
