const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function run() {
  const perms = await prisma.permission.findMany({ take: 10 })
  console.log(perms)
}
run()
