import type { Metadata } from 'next'
import { RBACModuleClient } from './_client'

export const metadata: Metadata = {
  title: 'Roles & Permissions',
}

export default function RBACModulePage() {
  return <RBACModuleClient />
}
