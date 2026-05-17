import type { Metadata } from 'next'
import { LoansModuleClient } from './_client'

export const metadata: Metadata = {
  title: 'Loans & Advances',
}

export default function LoansModulePage() {
  return <LoansModuleClient />
}
