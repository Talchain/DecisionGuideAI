import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'olumi_keys_seen'
const STORAGE_VERSION = 'v1'

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || target.getAttribute('role') === 'textbox'
}

const readHasSeen = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === STORAGE_VERSION
  } catch (error) {
    // Surface failures in tests and dev tools while defaulting to "seen" to avoid noisy UX
    console.warn('Failed to load keyboard legend state:', error)
    return true
  }
}

const persistSeen = () => {
  try {
    localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)
  } catch {
    // ignore storage failures
  }
}

export interface UseKeyboardLegendOptions {
  autoShow?: boolean
}

export function useKeyboardLegend({ autoShow = false }: UseKeyboardLegendOptions = {}) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasSeen, setHasSeen] = useState(() => readHasSeen())

  const markSeen = useCallback(() => {
    if (!hasSeen) {
      persistSeen()
      setHasSeen(true)
    }
  }, [hasSeen])

  const open = useCallback(() => {
    setIsOpen(true)
    markSeen()
  }, [markSeen])

  const close = useCallback(() => {
    setIsOpen(false)
    markSeen()
  }, [markSeen])

  const toggle = useCallback(
    (next?: boolean) => {
      if (typeof next === 'boolean') {
        next ? open() : close()
        return
      }
      setIsOpen(prev => {
        const targetState = !prev
        if (targetState) markSeen()
        return targetState
      })
    },
    [close, markSeen, open]
  )

  useEffect(() => {
    if (!hasSeen && autoShow) {
      setIsOpen(true)
    }
  }, [autoShow, hasSeen])

  // Re-validate persisted state after mount (important for tests that mock localStorage at runtime)
  useEffect(() => {
    readHasSeen()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isEditableTarget(event.target)) return
        event.preventDefault()
        toggle()
        return
      }
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault()
        close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [close, isOpen, toggle])

  return { isOpen, open, close, toggle }
}

interface KeyboardLegendProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutSection {
  title: string
  items: ShortcutItem[]
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: 'Graph Operations',
    items: [
      { keys: ['Double-click canvas'], description: 'Create node at cursor' },
      { keys: ['Enter'], description: 'Commit inline edit' },
      { keys: ['Esc'], description: 'Cancel inline edit / close prompts' },
    ],
  },
  {
    title: 'Quick Add Menu',
    items: [
      { keys: ['Q'], description: 'Toggle quick-add mode' },
      { keys: ['1…5'], description: 'Insert factors/risks while quick-add is active' },
    ],
  },
  {
    title: 'Editing and documents',
    items: [
      { keys: ['F2'], description: 'Rename document, node, or edge' },
      { keys: ['Cmd/Ctrl + D'], description: 'Toggle Documents drawer' },
      { keys: ['Cmd/Ctrl + K'], description: 'Jump to global search or command palette' },
    ],
  },
  {
    title: 'Run and analyse',
    items: [
      { keys: ['Cmd/Ctrl + Enter'], description: 'Run analysis' },
      { keys: ['Esc'], description: 'Stop run or close active overlay' },
    ],
  },
  {
    title: 'Weights and belief sliders',
    items: [
      { keys: ['Arrow keys'], description: 'Adjust weight / belief by 1%' },
      { keys: ['Shift + Arrow'], description: 'Adjust weight / belief by 10%' },
    ],
  },
  {
    title: 'History',
    items: [
      { keys: ['Cmd/Ctrl + Z'], description: 'Undo last action' },
      { keys: ['Cmd/Ctrl + Shift + Z'], description: 'Redo last undo' },
    ],
  },
  {
    title: 'Help',
    items: [
      { keys: ['?'], description: 'Toggle keyboard legend' },
      { keys: ['Esc'], description: 'Close this panel' },
    ],
  },
]

export function KeyboardLegend({ isOpen, onClose }: KeyboardLegendProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    panelRef.current?.focus()
  }, [isOpen])

  const sections = useMemo(() => SHORTCUT_SECTIONS, [])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-legend-title"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="bg-white rounded-xl shadow-panel w-full max-w-3xl max-h-[80vh] overflow-hidden focus:outline-none"
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Shortcuts</p>
            <h2 id="keyboard-legend-title" className="text-xl font-semibold text-gray-900">
              Keyboard legend
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            aria-label="Close keyboard legend"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M6 14L14 6" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          {sections.map(section => (
            <div key={section.title} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {section.title}
              </h3>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {section.items.map(item => (
                  <div
                    key={item.description}
                    className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-white"
                  >
                    <span className="text-gray-800 text-sm font-medium">
                      {item.description}
                    </span>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-900 font-mono">
                      {item.keys.map(key => (
                        <kbd
                          key={key}
                          className="px-2.5 py-1 bg-gray-100 border border-gray-300 rounded-md shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 text-sm text-gray-600 flex flex-wrap items-center justify-between gap-3">
          <span>
            Press <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded">?</kbd> anytime to toggle this panel.
          </span>
          <button
            onClick={onClose}
            className="text-blue-600 hover:text-blue-800 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
