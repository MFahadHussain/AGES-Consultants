import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const accounts = await prisma.account.findMany({ take: 5, select: { code: true, name: true, level: true } })
  console.log(accounts)
}
main().finally(() => prisma.$disconnect())
