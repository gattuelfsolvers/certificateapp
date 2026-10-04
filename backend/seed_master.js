const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const os = require('os');

function getHardwareID() {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'CPU';
  const rawString = `${os.hostname()}-${os.platform()}-${os.arch()}-${cpuModel}`;
  return crypto.createHash('sha256').update(rawString).digest('hex').substring(0, 32).toUpperCase();
}

async function main() {
  const adminEntry = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!adminEntry) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: 'Master Admin',
        role: 'SUPER_ADMIN'
      }
    });
    console.log('Created Admin User');
  } else {
    console.log('Admin User Exists');
  }

  const existingClient = await prisma.clientMaster.findFirst();
  if (!existingClient) {
    const hwid = getHardwareID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);
    
    await prisma.clientMaster.create({
      data: {
        clientName: 'Apna Digital Hub',
        ownerName: 'Admin Owner',
        phone: '7781931880',
        hwid: hwid,
        licenseKey: 'ADH-LIVE-TEST-KEY-2026',
        planType: 'YEARLY',
        status: 'ACTIVE',
        expiresAt: expiresAt
      }
    });
    console.log('Created Client Master Entry');
  } else {
    console.log('Client Master Entry Exists');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
