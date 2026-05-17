import type { Metadata } from 'next'
import { PayrollGLMappingClient } from './_client'

export const metadata: Metadata = {
  title: 'GL Account Mapping',
}

export default function PayrollGLMappingPage() {
  return <PayrollGLMappingClient />
}
