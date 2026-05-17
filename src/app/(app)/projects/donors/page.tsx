import type { Metadata } from 'next'
import { DonorsClient } from './_client'

export const metadata: Metadata = {
  title: 'Donors',
}

export default function DonorsPage() {
  return <DonorsClient />
}
