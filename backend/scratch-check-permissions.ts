import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const gerantRole = await prisma.role.findUnique({
      where: { name: 'GERANT' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    console.log('--- GERANT Role Permissions ---');
    if (!gerantRole) {
      console.log('GERANT role not found!');
      return;
    }

    gerantRole.permissions.forEach(rp => {
      console.log(`- Permission: ${rp.permission.name} (${rp.permission.description})`);
    });

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
