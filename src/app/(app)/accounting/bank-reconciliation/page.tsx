import type { Metadata } from 'next'
import { BankReconciliationClient } from './_client'

export const metadata: Metadata = {
  title: 'Bank Reconciliation',
}

export default function BankReconciliationPage() {
  return <BankReconciliationClient />
}
