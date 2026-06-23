import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const rooms = await prisma.chatRoom.findMany({
      include: {
        members: {
          include: {
            user: { select: { email: true, firstName: true } }
          }
        },
        _count: { select: { messages: true } }
      }
    });

    console.log('--- Chat Rooms ---');
    rooms.forEach(r => {
      console.log(`Room: [${r.id}] Name: "${r.name}", Type: ${r.type}, Members count: ${r.members.length}, Messages count: ${r._count.messages}`);
      r.members.forEach(m => {
        console.log(`  - Member: ${m.user.firstName} (${m.user.email})`);
      });
    });

    const messages = await prisma.message.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { email: true } }
      }
    });

    console.log('\n--- Recent Messages ---');
    messages.forEach(m => {
      console.log(`Msg: [${m.id}] Room: ${m.roomId}, Sender: ${m.sender.email}, Content: "${m.content}"`);
    });

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
