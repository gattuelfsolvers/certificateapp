const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAdminFromClientList() {
  const result = await prisma.clientMaster.deleteMany({
    where: {
      OR: [
        { clientName: { contains: 'Apna Digital Hub' } },
        { clientName: { contains: 'Master Admin' } },
        { hwid: { contains: 'DA2B-3CE3' } },
        { hwid: { contains: '47FDCCD0C10E0EFB45F344F48C09ECE8' } }
      ]
    }
  });
  console.log('REMOVED_ADMIN_RECORDS_COUNT:', result.count);
  await prisma.$disconnect();
}

cleanAdminFromClientList().catch(console.error);
