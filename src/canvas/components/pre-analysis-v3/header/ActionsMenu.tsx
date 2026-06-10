/**
 * ActionsMenu — overflow menu of named methods. Every item resolves to a
 * prefilled conversation prompt sent immediately (no dead ends, no contract
 * intents). Basic keyboard support: Escape closes and returns focus.
 */

import { memo, useEffect, useRef, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ACTIONS_MENU } from '../constants'

interface ActionsMenuProps {
  onAction: (label: string, prompt: string) => void
}

export const ActionsMenu = memo(function ActionsMenu({ onAction }: ActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative ml-auto" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className={`${typography.panelMeta} flex items-center gap-1 rounded-full border border-panel-border bg-transparent px-2.5 py-1 text-text-light outline-none transition-colors hover:bg-panel-hover hover:text-text-header focus-visible:bg-panel-hover focus-visible:text-text-header focus-visible:ring-2 focus-visible:ring-info/40`}
        data-testid="pre-analysis-v3-actions"
      >
        Actions
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-xl border border-panel-border bg-panel p-1 shadow-lg"
        >
          {ACTIONS_MENU.map(item => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onAction(item.label, item.prompt)
              }}
              className={`${typography.panelBody} flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-text-body outline-none transition-colors hover:bg-panel-hover focus-visible:bg-panel-hover`}
            >
              <Sparkles className="h-3.5 w-3.5 flex-none text-info" aria-hidden />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
