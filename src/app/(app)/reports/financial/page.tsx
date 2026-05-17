import type { Metadata } from 'next'
import { FinancialReportsClient } from './_client'

export const metadata: Metadata = {
  title: 'Financial Reports',
}

export default function FinancialReportsPage() {
  return <FinancialReportsClient />
}
