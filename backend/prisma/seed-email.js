const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.emailSettings.findFirst();
  if (!existing) {
    await prisma.emailSettings.create({
      data: {
        provider: 'SMTP',
        senderName: 'CREATIVART Billing',
        senderEmail: 'billing@creativart.tn',
        replyTo: 'contact@creativart.tn',
        companySignature: 'Cordialement,\nL\'équipe Financière CREATIVART',
        footer: 'CREATIVART S.A.R.L. - Les Berges du Lac 2, Tunis, 1053, Tunisie',
        logoUrl: 'https://creativart.tn/logo.png',
        trackingEnabled: true,
        autoReminderEnabled: true
      }
    });
    console.log('✅ Default Email Settings seeded successfully!');
  } else {
    console.log('ℹ️ Email Settings already exist.');
  }
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
