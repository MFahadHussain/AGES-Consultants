import type { Metadata } from 'next'
import { FinancialYearManagementClient } from './_client'

export const metadata: Metadata = {
  title: 'Financial Year',
}

export default function FinancialYearManagementPage() {
  return <FinancialYearManagementClient />
}
