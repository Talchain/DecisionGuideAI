import React from 'react'

export const LoadError: React.FC<{ message?: string }> = ({ message = 'Something went wrong loading this route.' }) => {
  const onRetry = () => {
    // Simple reload; keeps implementation tiny and robust
    if (typeof window !== 'undefined') window.location.reload()
  }
  return (
    <div role="alert" className="w-full h-full flex items-center justify-center p-6">
      <div className="rounded-md border border-red-200 bg-red-50 text-red-700 p-4 flex items-center gap-3">
        <span className="text-sm" aria-live="polite">{message}</span>
        <button
          type="button"
          onClick={onRetry}
          className="ml-2 rounded border border-red-300 bg-white px-2 py-1 text-xs hover:bg-red-100 focus:outline-none focus-visible:ring focus-visible:ring-red-400"
          aria-label="Retry loading"
        >Retry</button>
      </div>
    </div>
  )
}
export default LoadError
