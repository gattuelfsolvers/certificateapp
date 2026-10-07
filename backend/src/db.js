const { PrismaClient } = require('@prisma/client');
const path = require('path');

if (!process.env.DATABASE_URL) {
  const dbPath = path.join(__dirname, '../prisma/dev.db');
  process.env.DATABASE_URL = `file:${dbPath}`;
}

const prisma = new PrismaClient();

module.exports = prisma;
