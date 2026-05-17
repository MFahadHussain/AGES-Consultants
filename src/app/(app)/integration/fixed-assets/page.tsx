import type { Metadata } from 'next'
import { FixedAssetsModuleClient } from './_client'

export const metadata: Metadata = {
  title: 'Fixed Assets',
}

export default function FixedAssetsModulePage() {
  return <FixedAssetsModuleClient />
}
