import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const coaText = fs.readFileSync(path.join(__dirname, 'new-coa.txt'), 'utf8');
  const lines = coaText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const parent02 = await prisma.account.findUnique({ where: { code: '03-02-02' } });
  const parent03 = await prisma.account.findUnique({ where: { code: '03-02-03' } });

  if (!parent02 || !parent03) {
    console.error('Could not find parent accounts 03-02-02 or 03-02-03 in the database. Ensure they are seeded first.');
    return;
  }

  // Get all accounts that are going to be deleted
  const accountsToDelete = await prisma.account.findMany({
    where: {
      OR: [
        { code: { startsWith: '03-02-02-' } },
        { code: { startsWith: '03-02-03-' } }
      ]
    },
    select: { id: true, level: true, code: true }
  });

  const accountIdsToDelete = accountsToDelete.map(a => a.id);

  if (accountIdsToDelete.length > 0) {
    console.log(`Unlinking ${accountIdsToDelete.length} accounts from Employee records...`);
    
    await prisma.employee.updateMany({
      where: { salaryPayableAccountId: { in: accountIdsToDelete } },
      data: { salaryPayableAccountId: null }
    });

    await prisma.employee.updateMany({
      where: { scPayableAccountId: { in: accountIdsToDelete } },
      data: { scPayableAccountId: null }
    });

    console.log('Deleting existing children of 03-02-02 and 03-02-03 bottom-up...');
    // Delete level 5
    await prisma.account.deleteMany({
      where: { id: { in: accountIdsToDelete }, level: 5 }
    });
    // Delete level 4
    await prisma.account.deleteMany({
      where: { id: { in: accountIdsToDelete }, level: 4 }
    });
    // Delete level 3
    await prisma.account.deleteMany({
      where: { id: { in: accountIdsToDelete }, level: 3 }
    });
    
    // Just to be safe, delete any remaining that might somehow be other levels
    await prisma.account.deleteMany({
      where: {
        OR: [
          { code: { startsWith: '03-02-02-' } },
          { code: { startsWith: '03-02-03-' } }
        ]
      }
    });

    console.log('Deleted existing children.');
  }

  // Parse lines
  const accountsToCreate: any[] = [];
  const codeToIdMap = new Map<string, string>();
  codeToIdMap.set('03-02-02', parent02.id);
  codeToIdMap.set('03-02-03', parent03.id);

  for (const line of lines) {
    if (line.startsWith('(') || line.startsWith('Type:') || line.startsWith('No individual')) {
      continue;
    }

    const match = line.match(/^([0-9-]+)\s*\|\s*(.+)$/);
    if (!match) continue;

    const code = match[1].trim();
    const name = match[2].trim();

    const parts = code.split('-');
    const level = parts.length - 1;
    const parentCode = parts.slice(0, parts.length - 1).join('-');

    if (code === '03-02-02' || code === '03-02-03') {
        continue;
    }

    accountsToCreate.push({
      code,
      name,
      level,
      parentCode,
      accountType: 'LIABILITY',
      subType: 'PAYROLL_LIABILITY',
      isActive: true,
      isSystem: false,
      allowPosting: true, 
      openingBalance: 0
    });
  }

  console.log(`Found ${accountsToCreate.length} accounts to create.`);

  for (let currentLevel = 3; currentLevel <= 5; currentLevel++) {
    const levelAccounts = accountsToCreate.filter(a => a.level === currentLevel);
    for (const acc of levelAccounts) {
      const parentId = codeToIdMap.get(acc.parentCode);
      if (!parentId) {
        console.warn(`Parent ID not found for ${acc.code} (parentCode: ${acc.parentCode})`);
        continue;
      }
      
      await prisma.account.update({
          where: { id: parentId },
          data: { allowPosting: false }
      });

      const created = await prisma.account.create({
        data: {
          code: acc.code,
          name: acc.name,
          level: acc.level,
          parentId: parentId,
          accountType: acc.accountType,
          subType: acc.subType,
          isActive: acc.isActive,
          isSystem: acc.isSystem,
          allowPosting: acc.allowPosting,
          openingBalance: acc.openingBalance
        }
      });
      codeToIdMap.set(created.code, created.id);
    }
  }

  console.log('Successfully inserted all accounts.');
}

async function run() {
  try {
    await main();
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

run();
