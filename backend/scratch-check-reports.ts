import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const reports = await prisma.report.findMany({
      include: {
        createdBy: { select: { email: true, role: { select: { name: true } } } },
        manager: { select: { email: true } },
      }
    });

    console.log('--- Database Reports ---');
    console.log(`Total reports: ${reports.length}`);
    reports.forEach(r => {
      console.log(`Report: [${r.id}] Name: "${r.name}", Type: ${r.type}, Status: ${r.status}, WorkflowStatus: ${r.workflowStatus}`);
      console.log(`  - CreatedBy: ${r.createdBy.email} (Role: ${r.createdBy.role?.name})`);
      console.log(`  - Manager: ${r.manager?.email || 'None'}`);
      console.log(`  - isArchived: ${r.isArchived}`);
    });

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
