'use client'
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-5">
      <AlertTriangle className="w-8 h-8 text-red-500" />
      <div className="text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-500 max-w-sm">{error.message || 'This module failed to load.'}</p>
        {error.digest && <p className="text-xs text-gray-400 mt-1 font-mono">Error ID: {error.digest}</p>}
      </div>
      <div className="flex gap-3">
        <button onClick={reset} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          <Home className="w-3.5 h-3.5" /> Dashboard
        </Link>
      </div>
    </div>
  )
}
