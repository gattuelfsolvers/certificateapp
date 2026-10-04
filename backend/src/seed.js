const prisma = require('./db');

async function main() {
  console.log('Seeding initial demo data...');

  const count = await prisma.certificate.count();
  if (count === 0) {
    await prisma.certificate.createMany({
      data: [
        {
          refNo: 'JHIC/2026/00101',
          applicantName: 'Rahul Kumar Sharma',
          mobile: '9876543210',
          address: 'Gomoh Main Road, Dhanbad',
          certType: 'Income Certificate (JHIC)',
          currentStatus: 'DELIVERED',
          totalFee: 150,
          paidAmount: 150,
          duesAmount: 0,
          remarks: 'Delivered from Circle Office',
        },
        {
          refNo: 'JHCBC/2026/00102',
          applicantName: 'Priya Devi',
          mobile: '9123456789',
          address: 'Gunghasa, Gomoh',
          certType: 'Caste Certificate (JHCBC)',
          currentStatus: 'UNDER_PROCESS',
          totalFee: 200,
          paidAmount: 100,
          duesAmount: 100,
          remarks: 'Submitted at Block Office',
        },
        {
          refNo: 'JHLRC/2026/00103',
          applicantName: 'Amit Verma',
          mobile: '9988776655',
          address: 'Station Road, Gomoh',
          certType: 'Local Resident Certificate (JHLRC)',
          currentStatus: 'WAITING',
          totalFee: 150,
          paidAmount: 50,
          duesAmount: 100,
          remarks: 'Document verification pending',
        }
      ]
    });
    console.log('✅ Demo certificates seeded successfully!');
  }

  // Clear & Seed master categories with exact codes/prefixes
  await prisma.certTypeMaster.deleteMany({});
  await prisma.certTypeMaster.createMany({
    data: [
      { name: 'Caste Certificate', subCategory: 'JHCBC', prefix: 'JHCBC', price: 150 },
      { name: 'Caste Certificate', subCategory: 'JHNBC', prefix: 'JHNBC', price: 150 },
      { name: 'Caste Certificate', subCategory: 'JHCSC', prefix: 'JHCSC', price: 150 },
      { name: 'Caste Certificate', subCategory: 'JHCST', prefix: 'JHCST', price: 150 },
      { name: 'Income Certificate', subCategory: 'JHIC', prefix: 'JHIC', price: 150 },
      { name: 'Local Resident Certificate', subCategory: 'JHLRC', prefix: 'JHLRC', price: 150 },
      { name: 'Local Resident Certificate', subCategory: 'JHLRCO', prefix: 'JHLRCO', price: 150 },
      { name: 'OBC Certificate', subCategory: 'JHCOB', prefix: 'JHCOB', price: 150 },
      { name: 'OBC Certificate', subCategory: 'JHOBCH', prefix: 'JHOBCH', price: 150 },
      { name: 'EWS Certificate', subCategory: 'JHEWS', prefix: 'JHEWS', price: 200 },
      { name: 'EWS Certificate', subCategory: 'JHEWSH', prefix: 'JHEWSH', price: 200 },
      { name: 'Marriage Certificate', subCategory: 'JHMGR', prefix: 'JHMGR', price: 250 },
      { name: 'PAN Card New', subCategory: 'PANNEW', prefix: 'PANNEW', price: 150 },
      { name: 'PAN Card Update', subCategory: 'PANUPD', prefix: 'PANUPD', price: 150 },
      { name: 'Birth Certificate', subCategory: 'JHBC', prefix: 'JHBC', price: 100 },
      { name: 'Death Certificate', subCategory: 'JHDC', prefix: 'JHDC', price: 100 },
    ]
  });
  console.log('✅ Master categories seeded with Jharsewa prefixes!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
