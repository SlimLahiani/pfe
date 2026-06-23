import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.user.findMany({
      include: { role: true }
    });
    console.log('Total users:', users.length);
    users.forEach(u => {
      console.log(`- Email: ${u.email}, Role: ${u.role?.name}, IsActive: ${u.isActive}`);
    });
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
