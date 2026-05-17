export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-72" />
        </div>
        <div className="h-10 bg-gray-200 rounded-lg w-36" />
      </div>
      <div className="h-14 bg-gray-200 rounded-xl w-full" />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-12 bg-gray-100 border-b border-gray-200" />
        {[1,2,3,4,5,6,7].map(i => (
          <div key={i} className="h-14 border-b border-gray-100 flex items-center px-4 gap-4">
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-28 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
