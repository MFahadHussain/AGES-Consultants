import type { Metadata } from 'next'
import { ClientsClient } from './_client'

export const metadata: Metadata = {
  title: 'Clients',
}

export default function ClientsPage() {
  return <ClientsClient />
}
