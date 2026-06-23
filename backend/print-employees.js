import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function printEmployees() {
  try {
    const employees = await prisma.employeeProfile.findMany({
      include: {
        user: true,
        department: true,
      },
    });
    console.log('Employees list:');
    employees.forEach((e) => {
      console.log(`- ID: ${e.id}, Email: ${e.user?.email}, Dept: ${e.department?.name} (ID: ${e.departmentId}), Title: ${e.jobTitle}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

printEmployees();
