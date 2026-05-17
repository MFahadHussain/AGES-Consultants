import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    where: {
      code: {
        startsWith: '03',
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      level: true,
      parentId: true,
      accountType: true,
      subType: true,
      allowPosting: true
    },
    orderBy: {
      code: 'asc'
    }
  });

  console.dir(accounts, { depth: null });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
