'use client'

import dynamic from 'next/dynamic'

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F2D78] border-t-transparent" />
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

const PayrollIntegrationDynamic = dynamic(
  () => import('@/components/modules/payroll').then(m => ({ default: m.PayrollIntegration })),
  { ssr: false, loading: () => <Spinner /> }
)

export function PayrollIntegrationClient() {
  return <PayrollIntegrationDynamic />
}
