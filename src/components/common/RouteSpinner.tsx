import React from 'react'

export const RouteSpinner: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div role="status" aria-live="polite" className="w-full h-full flex items-center justify-center p-6">
    <div className="flex items-center gap-3 text-gray-600">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" aria-hidden="true" />
      <span className="text-sm" aria-label={label}>{label}</span>
    </div>
  </div>
)
export default RouteSpinner
