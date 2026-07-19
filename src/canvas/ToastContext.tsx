import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { typography } from '../styles/typography'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  action?: { label: string; onClick: () => void }
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, type?: Toast['type'], action?: Toast['action']) => void
  removeToast: (id: string) => void
}

// Brief 37 Task 4: Split contexts to prevent re-renders
// - ToastStateContext: Changes when toasts array changes (for ToastContainer)
// - ToastActionsContext: Never changes (stable refs for showToast/removeToast)
const ToastStateContext = createContext<Toast[]>([])
const ToastActionsContext = createContext<{
  showToast: (message: string, type?: Toast['type'], action?: Toast['action']) => void
  removeToast: (id: string) => void
} | null>(null)

// Legacy context for backwards compatibility
const ToastContext = createContext<ToastContextType | null>(null)

// Auto-dismiss duration per severity level (errors persist until manually dismissed)
const AUTO_DISMISS_MS: Record<Toast['type'], number | null> = {
  success: 5000,
  info:    5000,
  warning: 5000,
  error:   null, // manual dismiss only
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback(
    (message: string, type: Toast['type'] = 'info', action?: Toast['action']) => {
      const id = `toast-${Date.now()}-${Math.random()}`
      const newToast: Toast = { id, message, type, action }

      // Maximum one toast visible at a time — new toast replaces the previous
      setToasts([newToast])

      const dismissAfter = AUTO_DISMISS_MS[type]
      if (dismissAfter !== null) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id))
        }, dismissAfter)
      }
    },
    [],
  )

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Brief 37: Actions context value is STABLE (never changes) because
  // showToast and removeToast are wrapped in useCallback with []
  const actionsValue = useMemo(
    () => ({ showToast, removeToast }),
    [showToast, removeToast],
  )

  // Legacy context value (changes when toasts changes)
  const legacyValue = useMemo(
    () => ({ toasts, showToast, removeToast }),
    [toasts, showToast, removeToast],
  )

  return (
    <ToastActionsContext.Provider value={actionsValue}>
      <ToastStateContext.Provider value={toasts}>
        <ToastContext.Provider value={legacyValue}>
          {children}
          <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
      </ToastStateContext.Provider>
    </ToastActionsContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

/**
 * Brief 37 Task 4: Use this hook when you only need showToast (not toasts array).
 * This prevents re-renders when toasts array changes.
 *
 * The standard useToast() returns { toasts, showToast, removeToast } and causes
 * consumers to re-render when toasts changes (auto-dismiss, etc).
 */
export function useShowToast() {
  const context = useContext(ToastActionsContext)
  if (!context) throw new Error('useShowToast must be used within ToastProvider')
  return context.showToast
}

const noopShowToast: (message: string, type?: Toast['type'], action?: Toast['action']) => void = () => {}

/**
 * Like useShowToast, but no-ops outside a ToastProvider. For components that
 * must also render in headless hosts (unit tests, storybook shells) where
 * surfacing a toast is best-effort rather than essential.
 */
export function useShowToastSafe() {
  const context = useContext(ToastActionsContext)
  return context?.showToast ?? noopShowToast
}

const TOAST_ICONS = {
  success: CheckCircle,
  error:   XCircle,
  info:    Info,
  warning: AlertTriangle,
} as const

// Maps toast type to the semantic CSS variable for the left border colour
const TOAST_BORDER_COLOR: Record<Toast['type'], string> = {
  success: 'var(--success)',
  error:   'var(--danger)',
  info:    'var(--info)',
  warning: 'var(--warning)',
}

const TOAST_ICON_CLASS: Record<Toast['type'], string> = {
  success: 'text-success',
  error:   'text-danger',
  info:    'text-info',
  warning: 'text-warning',
}

const TOAST_ACTION_CLASS: Record<Toast['type'], string> = {
  success: 'text-success',
  error:   'text-danger',
  info:    'text-info hover:text-info',
  warning: 'text-warning',
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-6 right-6 z-[9000] space-y-2" role="region" aria-label="Notifications">
      {toasts.map(toast => {
        const Icon = TOAST_ICONS[toast.type]
        return (
          <div
            key={toast.id}
            className="bg-panel rounded-lg shadow-2 flex items-center gap-3 px-4 py-3 max-w-[360px] animate-slideDown"
            style={{ borderLeft: `3px solid ${TOAST_BORDER_COLOR[toast.type]}` }}
            role="alert"
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${TOAST_ICON_CLASS[toast.type]}`} aria-hidden="true" />
            <p className={`${typography.label} text-text-body flex-1`}>{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                onClick={toast.action.onClick}
                className={`${typography.link} flex-shrink-0 ${TOAST_ACTION_CLASS[toast.type]}`}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(toast.id)}
              className="flex-shrink-0 p-1 hover:bg-black/5 rounded transition-colors text-text-light"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
