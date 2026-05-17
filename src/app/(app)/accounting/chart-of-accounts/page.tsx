import type { Metadata } from 'next'
import { ChartOfAccountsClient } from './_client'

export const metadata: Metadata = {
  title: 'Chart of Accounts',
}

export default function ChartOfAccountsPage() {
  return <ChartOfAccountsClient />
}
