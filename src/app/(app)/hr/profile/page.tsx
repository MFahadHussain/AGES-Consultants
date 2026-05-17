import type { Metadata } from 'next'
import { EmployeeProfileRouteClient } from './_client'

export const metadata: Metadata = {
  title: 'Employee Profile',
}

export default function EmployeeProfilePage() {
  return <EmployeeProfileRouteClient />
}
