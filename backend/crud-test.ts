import { PrismaClient, ProjectStatus, TaskStatus, TaskPriority, QuoteStatus, InvoiceStatus, PaymentMethod, ChatRoomType, LeaveType, LeaveStatus, DocumentType, ReportType } from '@prisma/client';

const prisma = new PrismaClient();

async function runTests() {
  console.log('=== Starting AgencyOS Database CRUD Integration Tests ===\n');

  let testRole: any = null;
  let testUser: any = null;
  let testProfile: any = null;
  let testClient: any = null;
  let testProject: any = null;
  let testTask: any = null;
  let testChatRoom: any = null;
  let testChatMember: any = null;
  let testMessage: any = null;
  let testQuote: any = null;
  let testQuoteItem: any = null;
  let testInvoice: any = null;
  let testInvoiceItem: any = null;
  let testPayment: any = null;
  let testCategory: any = null;
  let testExpense: any = null;
  let testSalary: any = null;
  let testPayslip: any = null;
  let testLeaveRequest: any = null;
  let testReport: any = null;
  let testDocument: any = null;
  let testDocTag: any = null;

  try {
    // ----------------------------------------------------
    // PREPARATION & CLEANUP PRE-CHECK
    // ----------------------------------------------------
    console.log('🧹 Checking and clearing any left-over test data...');
    const existingUser = await prisma.user.findUnique({ where: { email: 'test-crud@agencyos.com' } });
    if (existingUser) {
      console.log('Found existing test user, cleaning up related entities...');
      // Clean up in reverse dependency order
      await prisma.documentTag.deleteMany({ where: { document: { uploadedById: existingUser.id } } });
      await prisma.document.deleteMany({ where: { uploadedById: existingUser.id } });
      await prisma.report.deleteMany({ where: { createdById: existingUser.id } });
      await prisma.leaveRequest.deleteMany({ where: { requestedById: existingUser.id } });
      await prisma.payslip.deleteMany({ where: { employee: { userId: existingUser.id } } });
      await prisma.salary.deleteMany({ where: { employee: { userId: existingUser.id } } });
      await prisma.expense.deleteMany({ where: { submittedById: existingUser.id } });
      await prisma.payment.deleteMany({ where: { invoice: { createdById: existingUser.id } } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { createdById: existingUser.id } } });
      await prisma.invoice.deleteMany({ where: { createdById: existingUser.id } });
      await prisma.quoteItem.deleteMany({ where: { quote: { createdById: existingUser.id } } });
      await prisma.quote.deleteMany({ where: { createdById: existingUser.id } });
      await prisma.message.deleteMany({ where: { senderId: existingUser.id } });
      await prisma.chatRoomMember.deleteMany({ where: { userId: existingUser.id } });
      await prisma.chatRoom.deleteMany({ where: { messages: { some: { senderId: existingUser.id } } } });
      await prisma.task.deleteMany({ where: { createdById: existingUser.id } });
      await prisma.projectMember.deleteMany({ where: { userId: existingUser.id } });
      await prisma.project.deleteMany({ where: { client: { createdById: existingUser.id } } });
      await prisma.client.deleteMany({ where: { createdById: existingUser.id } });
      await prisma.employeeProfile.deleteMany({ where: { userId: existingUser.id } });
      await prisma.user.delete({ where: { id: existingUser.id } });
    }

    const existingCategory = await prisma.expenseCategory.findUnique({ where: { name: 'CRUD Test Category' } });
    if (existingCategory) {
      await prisma.expenseCategory.delete({ where: { id: existingCategory.id } });
    }

    const existingRole = await prisma.role.findUnique({ where: { name: 'CRUD_TEST_ROLE' } });
    if (existingRole) {
      await prisma.role.delete({ where: { id: existingRole.id } });
    }

    console.log('✅ Pre-cleanup finished.\n');

    // ----------------------------------------------------
    // 1. ROLE & USER / EMPLOYEE PROFILE
    // ----------------------------------------------------
    console.log('📌 Test 1: User & Employee Profile CRUD');
    
    // Create Role
    testRole = await prisma.role.create({
      data: {
        name: 'CRUD_TEST_ROLE',
        description: 'Temporary role for CRUD integration testing',
      },
    });
    console.log(`  - Role created: ${testRole.name} (${testRole.id})`);

    // Create User
    testUser = await prisma.user.create({
      data: {
        email: 'test-crud@agencyos.com',
        passwordHash: 'dummyhash123',
        firstName: 'Crud',
        lastName: 'Tester',
        roleId: testRole.id,
      },
      include: { role: true }
    });
    console.log(`  - User created: ${testUser.email} (Role: ${testUser.role.name})`);

    // Create EmployeeProfile
    testProfile = await prisma.employeeProfile.create({
      data: {
        userId: testUser.id,
        jobTitle: 'QA automation engineer',
        employeeCode: 'EMP-CRUD-TEST',
        status: 'ACTIVE',
      },
      include: { user: true },
    });
    console.log(`  - EmployeeProfile created: ${testProfile.jobTitle} for user ${testProfile.user.email}`);

    // Update EmployeeProfile
    testProfile = await prisma.employeeProfile.update({
      where: { id: testProfile.id },
      data: {
        jobTitle: 'Lead QA automation engineer',
      },
    });
    console.log(`  - EmployeeProfile updated. New job title: ${testProfile.jobTitle}`);

    // Read User
    const readUser = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: { employeeProfile: true },
    });
    if (readUser && readUser.employeeProfile?.jobTitle === 'Lead QA automation engineer') {
      console.log('  ✅ User & Employee Profile CRUD successfully verified.');
    } else {
      throw new Error('User & Employee Profile CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 2. CLIENT
    // ----------------------------------------------------
    console.log('📌 Test 2: Client CRUD');
    
    // Create
    testClient = await prisma.client.create({
      data: {
        companyName: 'CRUD Test Enterprise',
        industry: 'Testing',
        website: 'https://test-crud.example.com',
        createdById: testUser.id,
      },
    });
    console.log(`  - Client created: ${testClient.companyName} (${testClient.id})`);

    // Update
    testClient = await prisma.client.update({
      where: { id: testClient.id },
      data: {
        companyName: 'CRUD Test Enterprise Global',
      },
    });
    console.log(`  - Client updated. New companyName: ${testClient.companyName}`);

    // Read & Verify
    const readClient = await prisma.client.findUnique({
      where: { id: testClient.id },
    });
    if (readClient && readClient.companyName === 'CRUD Test Enterprise Global') {
      console.log('  ✅ Client CRUD successfully verified.');
    } else {
      throw new Error('Client CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 3. PROJECT
    // ----------------------------------------------------
    console.log('📌 Test 3: Project CRUD');

    // Create
    testProject = await prisma.project.create({
      data: {
        name: 'CRUD Verification Project',
        description: 'Verify database relationships and operations',
        status: ProjectStatus.PLANNING,
        clientId: testClient.id,
        budget: 15000.00,
        currency: 'TND',
      },
    });
    console.log(`  - Project created: ${testProject.name} (Budget: ${testProject.budget} ${testProject.currency})`);

    // Update
    testProject = await prisma.project.update({
      where: { id: testProject.id },
      data: {
        status: ProjectStatus.ACTIVE,
        budget: 18500.50,
      },
    });
    console.log(`  - Project updated. Status: ${testProject.status}, Budget: ${testProject.budget}`);

    // Read & Verify
    const readProject = await prisma.project.findUnique({
      where: { id: testProject.id },
      include: { client: true },
    });
    if (readProject && readProject.status === ProjectStatus.ACTIVE && readProject.client?.id === testClient.id) {
      console.log('  ✅ Project CRUD successfully verified.');
    } else {
      throw new Error('Project CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 4. TASK
    // ----------------------------------------------------
    console.log('📌 Test 4: Task CRUD');

    // Create
    testTask = await prisma.task.create({
      data: {
        title: 'Perform Integration Tests',
        description: 'Verify all database schema endpoints',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        projectId: testProject.id,
        assigneeId: testUser.id,
        createdById: testUser.id,
      },
    });
    console.log(`  - Task created: "${testTask.title}" assigned to user ${testTask.assigneeId}`);

    // Update
    testTask = await prisma.task.update({
      where: { id: testTask.id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        description: 'Verify database schema endpoints and relations',
      },
    });
    console.log(`  - Task updated. Status: ${testTask.status}`);

    // Read & Verify
    const readTask = await prisma.task.findUnique({
      where: { id: testTask.id },
      include: { project: true, assignee: true },
    });
    if (readTask && readTask.status === TaskStatus.IN_PROGRESS && readTask.project?.id === testProject.id && readTask.assignee?.id === testUser.id) {
      console.log('  ✅ Task CRUD successfully verified.');
    } else {
      throw new Error('Task CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 5. CHAT / MESSAGE
    // ----------------------------------------------------
    console.log('📌 Test 5: Chat Room & Messages CRUD');

    // Create Room
    testChatRoom = await prisma.chatRoom.create({
      data: {
        name: 'CRUD Discussion',
        type: ChatRoomType.GROUP,
        projectId: testProject.id,
      },
    });
    console.log(`  - ChatRoom created: ${testChatRoom.name} (${testChatRoom.id})`);

    // Add Member
    testChatMember = await prisma.chatRoomMember.create({
      data: {
        roomId: testChatRoom.id,
        userId: testUser.id,
      },
    });
    console.log(`  - ChatRoomMember added: User ${testChatMember.userId} joined Room ${testChatMember.roomId}`);

    // Create Message
    testMessage = await prisma.message.create({
      data: {
        roomId: testChatRoom.id,
        senderId: testUser.id,
        content: 'Database CRUD is looking awesome!',
      },
    });
    console.log(`  - Message created: "${testMessage.content}" by Sender ${testMessage.senderId}`);

    // Update Message
    testMessage = await prisma.message.update({
      where: { id: testMessage.id },
      data: {
        content: 'Database CRUD is looking awesome! [EDITED]',
        isEdited: true,
        editedAt: new Date(),
      },
    });
    console.log(`  - Message updated. New Content: "${testMessage.content}"`);

    // Read & Verify
    const readMessage = await prisma.message.findUnique({
      where: { id: testMessage.id },
      include: { room: true, sender: true },
    });
    if (readMessage && readMessage.isEdited && readMessage.room.id === testChatRoom.id && readMessage.sender.id === testUser.id) {
      console.log('  ✅ Chat Room & Messages CRUD successfully verified.');
    } else {
      throw new Error('Chat Room & Messages CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 6. QUOTE
    // ----------------------------------------------------
    console.log('📌 Test 6: Quote CRUD');

    // Create
    testQuote = await prisma.quote.create({
      data: {
        reference: 'DEV-QUOTE-CRUD-TEST',
        clientId: testClient.id,
        projectId: testProject.id,
        createdById: testUser.id,
        status: QuoteStatus.DRAFT,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        subtotal: 1000.00,
        taxRate: 19.00,
        taxAmount: 190.00,
        total: 1190.00,
        notes: 'Initial test quote notes',
        items: {
          create: [
            {
              description: 'Consulting services',
              quantity: 10,
              unitPrice: 100.00,
              total: 1000.00,
            }
          ]
        }
      },
      include: { items: true }
    });
    console.log(`  - Quote created: ${testQuote.reference} with ${testQuote.items.length} item(s) (Total: ${testQuote.total})`);

    // Update
    testQuote = await prisma.quote.update({
      where: { id: testQuote.id },
      data: {
        notes: 'Updated test quote notes',
        status: QuoteStatus.SENT,
      },
    });
    console.log(`  - Quote updated. Status: ${testQuote.status}, Notes: "${testQuote.notes}"`);

    // Read & Verify
    const readQuote = await prisma.quote.findUnique({
      where: { id: testQuote.id },
      include: { items: true, client: true, createdBy: true },
    });
    if (readQuote && readQuote.status === QuoteStatus.SENT && readQuote.items.length === 1 && readQuote.client.id === testClient.id) {
      console.log('  ✅ Quote CRUD successfully verified.');
    } else {
      throw new Error('Quote CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 7. INVOICE & PAYMENT
    // ----------------------------------------------------
    console.log('📌 Test 7: Invoice & Payment CRUD');

    // Create Invoice
    testInvoice = await prisma.invoice.create({
      data: {
        reference: 'DEV-INV-CRUD-TEST',
        clientId: testClient.id,
        quoteId: testQuote.id,
        createdById: testUser.id,
        status: InvoiceStatus.DRAFT,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        subtotal: 1000.00,
        taxRate: 19.00,
        taxAmount: 190.00,
        total: 1190.00,
        notes: 'Initial invoice notes',
        items: {
          create: [
            {
              description: 'Project Phase 1 Delivery',
              quantity: 1,
              unitPrice: 1000.00,
              total: 1000.00,
            }
          ]
        }
      },
      include: { items: true }
    });
    console.log(`  - Invoice created: ${testInvoice.reference} with ${testInvoice.items.length} item(s)`);

    // Update Invoice
    testInvoice = await prisma.invoice.update({
      where: { id: testInvoice.id },
      data: {
        status: InvoiceStatus.SENT,
        notes: 'Updated invoice notes',
      },
    });
    console.log(`  - Invoice updated. Status: ${testInvoice.status}`);

    // Create Payment
    testPayment = await prisma.payment.create({
      data: {
        invoiceId: testInvoice.id,
        amount: 500.00,
        currency: 'TND',
        method: PaymentMethod.BANK_TRANSFER,
        paidAt: new Date(),
        reference: 'TR-BANK-CRUD-999',
        notes: 'Partial payment',
      },
    });
    console.log(`  - Payment created: ${testPayment.amount} ${testPayment.currency} for Invoice ${testPayment.invoiceId}`);

    // Update Payment
    testPayment = await prisma.payment.update({
      where: { id: testPayment.id },
      data: {
        notes: 'Partial payment - Verified',
      },
    });
    console.log(`  - Payment updated. Notes: "${testPayment.notes}"`);

    // Read & Verify
    const readInvoice = await prisma.invoice.findUnique({
      where: { id: testInvoice.id },
      include: { payments: true, items: true },
    });
    if (readInvoice && readInvoice.status === InvoiceStatus.SENT && readInvoice.payments.length === 1 && readInvoice.payments[0].amount.toNumber() === 500.00) {
      console.log('  ✅ Invoice & Payment CRUD successfully verified.');
    } else {
      throw new Error('Invoice & Payment CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 8. EXPENSE
    // ----------------------------------------------------
    console.log('📌 Test 8: Expense CRUD');

    // Create Category
    testCategory = await prisma.expenseCategory.create({
      data: {
        name: 'CRUD Test Category',
        description: 'Category created during automated testing',
      },
    });
    console.log(`  - ExpenseCategory created: ${testCategory.name}`);

    // Create Expense
    testExpense = await prisma.expense.create({
      data: {
        categoryId: testCategory.id,
        submittedById: testUser.id,
        description: 'Verification testing server costs',
        amount: 120.00,
        currency: 'TND',
        expenseDate: new Date(),
        notes: 'Test expense notes',
      },
    });
    console.log(`  - Expense created: ${testExpense.description} (${testExpense.amount} ${testExpense.currency})`);

    // Update Expense
    testExpense = await prisma.expense.update({
      where: { id: testExpense.id },
      data: {
        amount: 145.00,
        notes: 'Updated test expense notes',
      },
    });
    console.log(`  - Expense updated. New Amount: ${testExpense.amount}`);

    // Read & Verify
    const readExpense = await prisma.expense.findUnique({
      where: { id: testExpense.id },
      include: { category: true, submittedBy: true },
    });
    if (readExpense && readExpense.amount.toNumber() === 145.00 && readExpense.category.id === testCategory.id) {
      console.log('  ✅ Expense CRUD successfully verified.');
    } else {
      throw new Error('Expense CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 9. PAYROLL (SALARY & PAYSLIP)
    // ----------------------------------------------------
    console.log('📌 Test 9: Payroll CRUD');

    // Create Salary history record
    testSalary = await prisma.salary.create({
      data: {
        employeeId: testProfile.id,
        amount: 2500.00,
        currency: 'TND',
        effectiveFrom: new Date(),
        note: 'Test salary record',
      },
    });
    console.log(`  - Salary record created: ${testSalary.amount} ${testSalary.currency} for Employee ${testSalary.employeeId}`);

    // Create Payslip
    testPayslip = await prisma.payslip.create({
      data: {
        employeeId: testProfile.id,
        month: 6,
        year: 2026,
        baseSalary: 2500.00,
        bonuses: 100.00,
        deductions: 50.00,
        netSalary: 2550.00,
        status: 'DRAFT',
        notes: 'Test payslip notes',
      },
    });
    console.log(`  - Payslip created: Month ${testPayslip.month}/${testPayslip.year} (Net Salary: ${testPayslip.netSalary})`);

    // Update Payslip
    testPayslip = await prisma.payslip.update({
      where: { id: testPayslip.id },
      data: {
        status: 'PAID',
        notes: 'Payslip paid via bank transfer',
      },
    });
    console.log(`  - Payslip updated. New status: ${testPayslip.status}`);

    // Read & Verify
    const readPayslip = await prisma.payslip.findUnique({
      where: { id: testPayslip.id },
      include: { employee: true },
    });
    if (readPayslip && readPayslip.status === 'PAID' && readPayslip.employee.id === testProfile.id) {
      console.log('  ✅ Payroll CRUD successfully verified.');
    } else {
      throw new Error('Payroll CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 10. LEAVE REQUEST
    // ----------------------------------------------------
    console.log('📌 Test 10: Leave Request CRUD');

    // Create
    testLeaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: testProfile.id,
        requestedById: testUser.id,
        type: LeaveType.ANNUAL,
        startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // in 10 days
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 5 days
        days: 5.00,
        status: LeaveStatus.PENDING,
        reason: 'Rest and relaxation',
      },
    });
    console.log(`  - LeaveRequest created: User ${testLeaveRequest.requestedById} requesting ${testLeaveRequest.days} day(s)`);

    // Update
    testLeaveRequest = await prisma.leaveRequest.update({
      where: { id: testLeaveRequest.id },
      data: {
        status: LeaveStatus.APPROVED,
        reviewNote: 'Approved by automated system',
        reviewedAt: new Date(),
      },
    });
    console.log(`  - LeaveRequest updated. Status: ${testLeaveRequest.status}`);

    // Read & Verify
    const readLeave = await prisma.leaveRequest.findUnique({
      where: { id: testLeaveRequest.id },
      include: { employee: true },
    });
    if (readLeave && readLeave.status === LeaveStatus.APPROVED && readLeave.employee.id === testProfile.id) {
      console.log('  ✅ Leave Request CRUD successfully verified.');
    } else {
      throw new Error('Leave Request CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 11. REPORT
    // ----------------------------------------------------
    console.log('📌 Test 11: Report CRUD');

    // Create
    testReport = await prisma.report.create({
      data: {
        name: 'CRUD Validation Audit Report',
        type: ReportType.HR,
        createdById: testUser.id,
        status: 'APPROVED',
        comment: 'Automated test query validation',
        data: { generatedFromTest: true, metrics: [100, 200, 300] },
      },
    });
    console.log(`  - Report created: "${testReport.name}" (Type: ${testReport.type})`);

    // Update
    testReport = await prisma.report.update({
      where: { id: testReport.id },
      data: {
        name: 'CRUD Validation Audit Report v2',
        version: 2,
      },
    });
    console.log(`  - Report updated. Version: ${testReport.version}, Name: "${testReport.name}"`);

    // Read & Verify
    const readReport = await prisma.report.findUnique({
      where: { id: testReport.id },
    });
    if (readReport && readReport.version === 2 && readReport.name.includes('v2')) {
      console.log('  ✅ Report CRUD successfully verified.');
    } else {
      throw new Error('Report CRUD validation failed.');
    }
    console.log();

    // ----------------------------------------------------
    // 12. DOCUMENT & DOCUMENT TAG
    // ----------------------------------------------------
    console.log('📌 Test 12: Document & DocumentTag CRUD');

    // Create Document
    testDocument = await prisma.document.create({
      data: {
        title: 'CRUD Verification Spec',
        type: DocumentType.CONTRACT,
        url: 'https://cdn.agencyos.com/docs/crud-spec.pdf',
        size: 2048,
        mimeType: 'application/pdf',
        description: 'Verify document tags and file persistence',
        uploadedById: testUser.id,
        clientId: testClient.id,
      },
    });
    console.log(`  - Document created: "${testDocument.title}" (${testDocument.url})`);

    // Update Document
    testDocument = await prisma.document.update({
      where: { id: testDocument.id },
      data: {
        title: 'CRUD Verification Spec Final',
      },
    });
    console.log(`  - Document updated. New Title: "${testDocument.title}"`);

    // Create Tag
    testDocTag = await prisma.documentTag.create({
      data: {
        documentId: testDocument.id,
        tag: 'automated-test',
      },
    });
    console.log(`  - DocumentTag created: "${testDocTag.tag}" attached to Document ${testDocTag.documentId}`);

    // Read & Verify
    const readDoc = await prisma.document.findUnique({
      where: { id: testDocument.id },
      include: { tags: true, uploadedBy: true, client: true },
    });
    if (readDoc && readDoc.title === 'CRUD Verification Spec Final' && readDoc.tags.length === 1 && readDoc.tags[0].tag === 'automated-test') {
      console.log('  ✅ Document & DocumentTag CRUD successfully verified.');
    } else {
      throw new Error('Document & DocumentTag CRUD validation failed.');
    }
    console.log();

    console.log('🎉 ALL 12 ENTITY CRUD INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n');

  } catch (error) {
    console.error('❌ Integration Tests Failed:', error);
    throw error;
  } finally {
    // ----------------------------------------------------
    // CLEANUP AND TEARDOWN AFTER TESTING
    // ----------------------------------------------------
    console.log('🧹 Initiating cleanup of test-created database entities...');

    // Delete in reverse dependency order
    if (testDocTag) {
      await prisma.documentTag.delete({ where: { id: testDocTag.id } }).catch(() => {});
    }
    if (testDocument) {
      await prisma.document.delete({ where: { id: testDocument.id } }).catch(() => {});
    }
    if (testReport) {
      await prisma.report.delete({ where: { id: testReport.id } }).catch(() => {});
    }
    if (testLeaveRequest) {
      await prisma.leaveRequest.delete({ where: { id: testLeaveRequest.id } }).catch(() => {});
    }
    if (testPayslip) {
      await prisma.payslip.delete({ where: { id: testPayslip.id } }).catch(() => {});
    }
    if (testSalary) {
      await prisma.salary.delete({ where: { id: testSalary.id } }).catch(() => {});
    }
    if (testExpense) {
      await prisma.expense.delete({ where: { id: testExpense.id } }).catch(() => {});
    }
    if (testCategory) {
      await prisma.expenseCategory.delete({ where: { id: testCategory.id } }).catch(() => {});
    }
    if (testPayment) {
      await prisma.payment.delete({ where: { id: testPayment.id } }).catch(() => {});
    }
    if (testInvoiceItem) {
      await prisma.invoiceItem.delete({ where: { id: testInvoiceItem.id } }).catch(() => {});
    }
    if (testInvoice) {
      await prisma.invoice.delete({ where: { id: testInvoice.id } }).catch(() => {});
    }
    if (testQuoteItem) {
      await prisma.quoteItem.delete({ where: { id: testQuoteItem.id } }).catch(() => {});
    }
    if (testQuote) {
      await prisma.quote.delete({ where: { id: testQuote.id } }).catch(() => {});
    }
    if (testMessage) {
      await prisma.message.delete({ where: { id: testMessage.id } }).catch(() => {});
    }
    if (testChatMember) {
      await prisma.chatRoomMember.delete({ where: { id: testChatMember.id } }).catch(() => {});
    }
    if (testChatRoom) {
      await prisma.chatRoom.delete({ where: { id: testChatRoom.id } }).catch(() => {});
    }
    if (testTask) {
      await prisma.task.delete({ where: { id: testTask.id } }).catch(() => {});
    }
    if (testProject) {
      await prisma.project.delete({ where: { id: testProject.id } }).catch(() => {});
    }
    if (testClient) {
      await prisma.client.delete({ where: { id: testClient.id } }).catch(() => {});
    }
    if (testProfile) {
      await prisma.employeeProfile.delete({ where: { id: testProfile.id } }).catch(() => {});
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    if (testRole) {
      await prisma.role.delete({ where: { id: testRole.id } }).catch(() => {});
    }

    console.log('✅ Teardown complete. Database restored to initial state.');
    await prisma.$disconnect();
  }
}

runTests();
