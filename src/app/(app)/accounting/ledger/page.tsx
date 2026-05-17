import type { Metadata } from 'next'
import { LedgersClient } from './_client'

export const metadata: Metadata = {
  title: 'Ledgers & Sub-Ledgers',
}

export default function LedgersPage() {
  return <LedgersClient />
}
