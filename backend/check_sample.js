const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.certificate.count();
  const samples = await prisma.certificate.findMany({ take: 5 });
  console.log('TOTAL_CERTIFICATES:', count);
  console.log('SAMPLE_ENTRIES:', JSON.stringify(samples, null, 2));
  await prisma.$disconnect();
}

check().catch(console.error);
