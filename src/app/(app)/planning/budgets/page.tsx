import type { Metadata } from 'next'
import { BudgetManagementClient } from './_client'

export const metadata: Metadata = {
  title: 'Budget Management',
}

export default function BudgetManagementPage() {
  return <BudgetManagementClient />
}
