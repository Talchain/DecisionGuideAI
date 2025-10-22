/**
 * Offline Banner - Shows when user is offline
 */
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  return (
    <div 
      className="bg-yellow-50 border border-yellow-300 rounded p-3 mb-4 flex items-center gap-2"
      role="alert"
      aria-live="polite"
    >
      <WifiOff className="h-5 w-5 text-yellow-700" />
      <div>
        <p className="text-sm font-semibold text-yellow-800">You're offline</p>
        <p className="text-xs text-yellow-700">
          Reconnect to run templates. Your local data is safe.
        </p>
      </div>
    </div>
  )
}
