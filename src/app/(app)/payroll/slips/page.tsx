import type { Metadata } from 'next'
import { PayrollSlipsClient } from './_client'

export const metadata: Metadata = {
  title: 'Payroll Slips & Letters',
}

export default function PayrollSlipsPage() {
  return <PayrollSlipsClient />
}
