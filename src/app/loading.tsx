export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A7A4A] border-t-transparent" />
        <p className="text-xs text-gray-500">Loading...</p>
      </div>
    </div>
  )
}
