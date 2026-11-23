import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { HoverButton } from '../../olumiView/look/Hover'
import { OkIcon } from '../../olumiView/look/icons'
import { useDialogFocus } from '../../olumiView/look/useDialogFocus'
import { typography } from '../../styles/typography'
import { VIEW_CHIP_CLASS, VIEW_ICON_BUTTON_CLASS } from '../../v5/blocks/chipClass'
import { CANVAS_LAYER_CLASS } from '../layers'

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
  const lane = isOlumiCoreLane()
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
      if (!lane && event.key === 'Escape' && isOpen) {
        event.preventDefault()
        close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [close, isOpen, lane, toggle])

  // React #185: Memoize return object to prevent unnecessary re-renders in consumers
  return useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle])
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
    title: 'Navigate and inspect',
    items: [
      { keys: ['Double-click node / edge'], description: 'Inspect details' },
      { keys: ['Esc'], description: 'Close active prompts or panels' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { keys: ['Cmd/Ctrl + D'], description: 'Open Documents drawer' },
    ],
  },
  {
    title: 'Run and analyse',
    items: [
      { keys: ['Cmd/Ctrl + Enter'], description: 'Run analysis' },
      { keys: ['Esc'], description: 'Close active overlay' },
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

/** The olumi-core lane's legend (UI restore 11 Nov): only keys that do something there. No node inspector, no Documents drawer, no analysis
 *  run: core runs its own, and says so in the chat. */
const LANE_SHORTCUT_SECTIONS: ShortcutSection[] = [
  { title: 'Navigate', items: [{ keys: ['Esc'], description: 'Close active prompts or panels' }] },
  { title: 'Help', items: [{ keys: ['?'], description: 'Toggle keyboard legend' }, { keys: ['Esc'], description: 'Close this panel' }] },
]

export function KeyboardLegend({ isOpen, onClose }: KeyboardLegendProps) {
  const lane = isOlumiCoreLane()
  const close = useRef<HTMLButtonElement>(null)
  const { dialogRef, onKeyDown } = useDialogFocus<HTMLDivElement>({
    open: isOpen,
    initialFocus: () => close.current,
    opener: () => lane && document.activeElement === document.body
      ? document.querySelector<HTMLButtonElement>('button[aria-label="More options"]')
      : null,
    onEscape: lane ? onClose : undefined,
    containFocus: lane,
    restoreFocus: lane,
  })
  const sections = lane ? LANE_SHORTCUT_SECTIONS : SHORTCUT_SECTIONS
  const keyClass = lane ? 'rounded-sm border border-panel-border bg-panel px-2 py-1' : 'px-2.5 py-1 bg-gray-100 border border-gray-300 rounded-md shadow-sm'

  if (!isOpen) return null

  const dialog = (
    <div
      className={lane ? `fixed inset-y-0 left-0 right-[var(--dock-right-offset,0rem)] ${CANVAS_LAYER_CLASS.modalBackdrop} flex items-center justify-center bg-[var(--backdrop)] px-3` : 'fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-legend-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={lane ? 'flex max-h-[80vh] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-lg bg-panel p-3 shadow-3 focus:outline-none' : 'bg-white rounded-md shadow-panel w-full max-w-3xl max-h-[80vh] overflow-hidden focus:outline-none'}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={event => event.stopPropagation()}
      >
        <div className={lane ? 'flex items-center justify-between gap-2' : 'flex items-center justify-between px-6 py-4'}>
          <div>
            {!lane && <p className="text-xs font-medium uppercase tracking-wide text-info">Shortcuts</p>}
            <h2 id="keyboard-legend-title" className={lane ? `${typography.panelHeader} text-text-header` : 'text-xl font-semibold text-gray-900'}>
              Keyboard legend
            </h2>
          </div>
          {lane ? (
            <HoverButton ref={close} type="button" onClick={onClose} className={`${VIEW_ICON_BUTTON_CLASS} text-text-light`}
              aria-label="Close keyboard legend" words="Close (Esc)">
              <OkIcon id="cancel-close" size={14} decorative inherit />
            </HoverButton>
          ) : <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info transition-colors"
            aria-label="Close keyboard legend"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M6 14L14 6" />
            </svg>
          </button>}
        </div>

        <div className={lane ? 'min-h-0 space-y-4 overflow-y-auto' : 'px-6 py-4 overflow-y-auto max-h-[calc(80vh-120px)]'}>
          {sections.map(section => (
            <div key={section.title} className={lane ? 'space-y-2' : 'mb-6 last:mb-0'}>
              <h3 className={lane ? `${typography.viewPanelHeading} text-text-header` : 'text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3'}>
                {section.title}
              </h3>
              <div className={lane ? 'divide-y divide-panel-border rounded-sm border border-panel-border' : 'border border-gray-100 rounded-lg'}>
                {section.items.map(item => (
                  <div
                    key={item.description}
                    className={lane ? 'flex flex-wrap items-center justify-between gap-2 px-3 py-2.5' : 'flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-white'}
                  >
                    <span className={lane ? `${typography.viewPanelBody} text-text-body` : 'text-gray-800 text-sm font-medium'}>
                      {item.description}
                    </span>
                    <div className={lane ? `flex flex-wrap gap-2 ${typography.viewPanelMeta} text-text-header` : 'flex flex-wrap gap-2 text-sm text-gray-900 font-mono'}>
                      {item.keys.map(key => (
                        <kbd
                          key={key}
                          className={keyClass}
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

        <div className={lane ? `flex flex-wrap items-center justify-between gap-3 ${typography.viewPanelBody} text-text-light` : 'bg-gray-50 px-6 py-4 text-sm text-gray-600 flex flex-wrap items-center justify-between gap-3'}>
          <span>
            Press <kbd className={lane ? keyClass : 'px-2 py-0.5 bg-white border border-gray-300 rounded'}>?</kbd> anytime to toggle this panel.
          </span>
          <button
            onClick={onClose}
            className={lane ? VIEW_CHIP_CLASS : 'text-info hover:text-info font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info rounded'}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
  return lane ? createPortal(dialog, document.body) : dialog
}
