const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const certs = await prisma.certificate.count();
  const clients = await prisma.clientMaster.count();
  const backups = await prisma.clientBackup.count();
  console.log(`CERTIFICATES_COUNT: ${certs}`);
  console.log(`CLIENTS_COUNT: ${clients}`);
  console.log(`BACKUPS_COUNT: ${backups}`);
  await prisma.$disconnect();
}

main().catch(console.error);
