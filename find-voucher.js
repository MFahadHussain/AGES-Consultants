const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.auditLog.findMany({
    where: { entity: "Voucher", action: "CREATE" },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(logs, null, 2));
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
