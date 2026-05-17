import type { Metadata } from 'next'
import { EmployeeMasterClient } from './_client'

export const metadata: Metadata = {
  title: 'Employee Master',
}

export default function EmployeeMasterPage() {
  return <EmployeeMasterClient />
}
