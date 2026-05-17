import type { Metadata } from 'next'
import { SuppliersClient } from './_client'

export const metadata: Metadata = {
  title: 'Suppliers',
}

export default function SuppliersPage() {
  return <SuppliersClient />
}
