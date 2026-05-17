import type { Metadata } from 'next'
import { AgingAnalysisClient } from './_client'

export const metadata: Metadata = {
  title: 'Aging Analysis',
}

export default function AgingAnalysisPage() {
  return <AgingAnalysisClient />
}
