import type { Metadata } from 'next'
import { FinalSettlementModuleClient } from './_client'

export const metadata: Metadata = {
  title: 'Final Settlement',
}

export default function FinalSettlementModulePage() {
  return <FinalSettlementModuleClient />
}
