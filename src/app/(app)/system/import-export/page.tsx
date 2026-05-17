import type { Metadata } from 'next'
import { ImportExportClient } from './_client'

export const metadata: Metadata = {
  title: 'Import / Export',
}

export default function ImportExportPage() {
  return <ImportExportClient />
}
