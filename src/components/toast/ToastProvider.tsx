import React, { createContext, useContext, useMemo, useState } from 'react'

export type Toast = {
  id: string
  message: string
  type?: 'success' | 'error'
}

type ToastCtx = {
  addToast: (message: string, type?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastCtx | null>(null)

export const useToast = (): ToastCtx => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    // Auto-dismiss
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 2500)
  }

  const value = useMemo(() => ({ addToast }), [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  )
}

export const ToastViewport: React.FC<{ toasts?: Toast[] }> = ({ toasts = [] }) => (
  <div
    aria-live="polite"
    aria-atomic="true"
    className="fixed bottom-4 right-4 flex flex-col gap-2 z-50"
  >
    {toasts.map(t => (
      <div
        key={t.id}
        role="status"
        data-testid={t.type === 'error' ? 'toast-error' : 'toast-success'}
        className={`rounded-md ${t.type === 'error' ? 'bg-red-600' : 'bg-gray-900'} text-white text-sm px-3 py-2 shadow-lg`}
      >
        {t.message}
      </div>
    ))}
  </div>
)
