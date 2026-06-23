import { PrismaClient } from '@prisma/client';

async function testAutomation() {
  console.log('--- STARTING DOCUMENT AUTOMATION TEST ---');
  const prisma = new PrismaClient();

  try {
    // 1. Verify Email Settings exist
    const settings = await prisma.emailSettings.findFirst();
    console.log('Email Settings found:', settings ? 'SUCCESS' : 'FAILED');

    // 2. Query InvoiceEmailLogs count
    const logsCount = await prisma.invoiceEmailLog.count();
    console.log('Total Email Logs registered:', logsCount);

    console.log('--- TEST COMPLETED SUCCESSFULLY ---');
  } catch (err: any) {
    console.error('Test failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAutomation();
