import type { Metadata } from 'next'
import { AllowancesModuleClient } from './_client'

export const metadata: Metadata = {
  title: 'Allowances & Benefits',
}

export default function AllowancesModulePage() {
  return <AllowancesModuleClient />
}
