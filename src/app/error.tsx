'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GLOBAL ERROR]', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2 text-gray-900">Something went wrong</h1>
            <p className="text-gray-500 mb-6 text-sm">{error.message}</p>
            {error.digest && (
              <p className="text-xs text-gray-400 mb-4 font-mono">Error ID: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
