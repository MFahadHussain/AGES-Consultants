import type { Metadata } from 'next'
import { TaxSlabsModuleClient } from './_client'

export const metadata: Metadata = {
  title: 'Tax Slabs',
}

export default function TaxSlabsModulePage() {
  return <TaxSlabsModuleClient />
}
