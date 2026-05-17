import type { Metadata } from 'next'
import { AuditTrailClient } from './_client'

export const metadata: Metadata = {
  title: 'Audit Trail',
}

export default function AuditTrailPage() {
  return <AuditTrailClient />
}
