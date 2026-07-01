import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const hrRole = await prisma.role.findUnique({ where: { name: 'RESPONSABLE_RH' } });
  const writePerm = await prisma.permission.findUnique({ where: { name: 'reports:write' } });

  if (hrRole && writePerm) {
    const existing = await prisma.rolePermission.findFirst({
      where: { roleId: hrRole.id, permissionId: writePerm.id }
    });

    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          roleId: hrRole.id,
          permissionId: writePerm.id,
        }
      });
      console.log('Successfully granted reports:write permission to RESPONSABLE_RH.');
    } else {
      console.log('RESPONSABLE_RH already has reports:write permission.');
    }
  } else {
    console.error('Could not find Role or Permission in DB.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
