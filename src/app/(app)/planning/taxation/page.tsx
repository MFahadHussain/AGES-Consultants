import type { Metadata } from 'next'
import { TaxationClient } from './_client'

export const metadata: Metadata = {
  title: 'Taxation',
}

export default function TaxationPage() {
  return <TaxationClient />
}
