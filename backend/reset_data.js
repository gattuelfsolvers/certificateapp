const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
  await prisma.whatsAppLog.deleteMany({});
  await prisma.statusLog.deleteMany({});
  const res = await prisma.certificate.deleteMany({});
  console.log('Successfully cleared database records. Total certificates deleted:', res.count);
}

reset()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
