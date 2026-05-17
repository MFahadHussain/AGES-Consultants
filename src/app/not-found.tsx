import Link from 'next/link'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-8xl font-bold text-gray-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A7A4A] text-white rounded-lg hover:bg-[#15693F] transition-colors font-medium text-sm"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
