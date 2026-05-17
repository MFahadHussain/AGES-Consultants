'use client'

import dynamic from 'next/dynamic'

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A7A4A] border-t-transparent" />
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

const FixedAssetsModuleDynamic = dynamic(
  () => import('@/components/modules/fixed-assets').then(m => ({ default: m.FixedAssetsModule })),
  { ssr: false, loading: () => <Spinner /> }
)

export function FixedAssetsModuleClient() {
  return <FixedAssetsModuleDynamic />
}
