const { checkJharsewaStatus } = require('./src/services/jharsewa.service');

async function runTest() {
  console.log('🧪 Starting self-testing for JHOBCH/2026/95093 (Date: 23-08-2026)...');
  const res = await checkJharsewaStatus('JHOBCH/2026/95093', '23-08-2026');
  console.log('📊 LIVE TEST RESULT FOR JHOBCH:', JSON.stringify(res, null, 2));
  process.exit(0);
}

runTest();
