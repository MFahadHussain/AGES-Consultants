import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('🔄 Running database branding migration...')

  // 1. Update system settings
  const settingsToUpdate = [
    { key: 'company_name', value: 'AGES Consultants' },
    { key: 'company_short_name', value: 'AGES' },
    { key: 'company_email', value: 'info@agesconsultants.com' },
    { key: 'company_website', value: 'www.agesconsultants.com' },
  ]

  for (const setting of settingsToUpdate) {
    const exists = await db.systemSetting.findUnique({
      where: { key: setting.key },
    })

    if (exists) {
      await db.systemSetting.update({
        where: { key: setting.key },
        data: { value: setting.value },
      })
      console.log(`✅ Updated setting: ${setting.key} -> ${setting.value}`)
    } else {
      await db.systemSetting.create({
        data: {
          key: setting.key,
          value: setting.value,
          category: 'general',
          description: `Seeded setting for ${setting.key}`,
          isPublic: true,
        },
      })
      console.log(`✅ Created setting: ${setting.key} -> ${setting.value}`)
    }
  }

  // 2. Update user emails
  const users = await db.user.findMany()
  let updatedUsersCount = 0

  for (const user of users) {
    let newEmail = user.email

    if (user.email.endsWith('@acctfin.erp')) {
      newEmail = user.email.replace('@acctfin.erp', '@ages.erp')
    } else if (user.email.endsWith('@acctfin.com')) {
      newEmail = user.email.replace('@acctfin.com', '@agesconsultants.com')
    }

    if (newEmail !== user.email) {
      // Check if new email is already taken to avoid unique constraint error
      const collision = await db.user.findUnique({ where: { email: newEmail } })
      if (!collision) {
        await db.user.update({
          where: { id: user.id },
          data: { email: newEmail },
        })
        console.log(`✅ Updated user email: ${user.email} -> ${newEmail}`)
        updatedUsersCount++
      } else {
        console.log(`⚠️ Email collision skipped for: ${newEmail}`)
      }
    }
  }

  console.log(`🎉 Database branding migration completed. Updated ${updatedUsersCount} users.`)
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
