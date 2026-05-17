import type { Metadata } from 'next'
import { PayrollReportsClient } from './_client'

export const metadata: Metadata = {
  title: 'Payroll Reports',
}

export default function PayrollReportsPage() {
  return <PayrollReportsClient />
}
