import { useEffect } from 'react'
import { useCanvasStore } from '../store'

export function ReconnectBanner() {
  const reconnecting = useCanvasStore(s => s.reconnecting)
  const cancelReconnect = useCanvasStore(s => s.cancelReconnect)
  
  useEffect(() => {
    if (!reconnecting) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelReconnect()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [reconnecting, cancelReconnect])
  
  if (!reconnecting) return null
  
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 text-white px-4 py-2 rounded shadow-lg z-50" role="alert" aria-live="assertive" data-testid="banner-reconnect-mode" style={{ backgroundColor: 'var(--olumi-info)' }}>
      Reconnect {reconnecting.end}: click a node or press Esc to cancel
    </div>
  )
}
