/**
 * Offline Banner - Shows when user is offline
 */
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  return (
    <div 
      className="bg-panel border border-warning/30 rounded p-3 mb-4 flex items-center gap-2"
      role="alert"
      aria-live="polite"
    >
      <WifiOff className="h-5 w-5 text-warning" />
      <div>
        <p className="text-sm font-semibold text-warning">You're offline</p>
        <p className="text-xs text-warning">
          Reconnect to run templates. Your local data is safe.
        </p>
      </div>
    </div>
  )
}
