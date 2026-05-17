import type { Metadata } from 'next'
import { PayrollIntegrationClient } from './_client'

export const metadata: Metadata = {
  title: 'Payroll Engine',
}

export default function PayrollIntegrationPage() {
  return <PayrollIntegrationClient />
}
