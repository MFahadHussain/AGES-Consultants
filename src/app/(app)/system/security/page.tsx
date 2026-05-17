import type { Metadata } from 'next'
import { SecurityCenterClient } from './_client'

export const metadata: Metadata = {
  title: 'Security Center',
}

export default function SecurityCenterPage() {
  return <SecurityCenterClient />
}
