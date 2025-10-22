/**
 * Toast - Simple toast notification
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface ToastProps {
  message: string
  onClose: () => void
  duration?: number
}

export function Toast({ message, onClose, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300) // Wait for fade out
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!visible) return null

  return (
    <div
      className={`fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-opacity ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="text-sm">{message}</span>
      <button
        onClick={() => {
          setVisible(false)
          setTimeout(onClose, 300)
        }}
        className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
