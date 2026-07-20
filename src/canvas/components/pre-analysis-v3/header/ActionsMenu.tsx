/**
 * ActionsMenu — overflow menu of named methods. Every item resolves to a
 * prefilled conversation prompt sent immediately (no dead ends, no contract
 * intents).
 *
 * Keyboard contract (WAI-ARIA menu button): opening focuses the first item;
 * ArrowDown/ArrowUp cycle, Home/End jump, Escape closes and returns focus to
 * the trigger, Tab closes. The trigger and menu are linked via
 * aria-controls.
 */

import { memo, useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ACTIONS_MENU } from '../constants'
import type { SparkPrompt } from '../types'

interface ActionsMenuProps {
  onAction: (spark: SparkPrompt) => void
}

export const ActionsMenu = memo(function ActionsMenu({ onAction }: ActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    // Menu pattern: focus moves into the menu on open.
    itemRefs.current[0]?.focus()
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null)
    const activeIndex = items.findIndex(el => el === document.activeElement)
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close(true)
        return
      case 'Tab':
        // Menus trap arrows, not Tab — Tab leaves and closes.
        close(false)
        return
      case 'ArrowDown':
        e.preventDefault()
        items[(activeIndex + 1) % items.length]?.focus()
        return
      case 'ArrowUp':
        e.preventDefault()
        items[(activeIndex - 1 + items.length) % items.length]?.focus()
        return
      case 'Home':
        e.preventDefault()
        items[0]?.focus()
        return
      case 'End':
        e.preventDefault()
        items[items.length - 1]?.focus()
        return
    }
  }

  return (
    <div className="relative ml-auto" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => {
          // ArrowDown on the trigger opens the menu (focus lands via the effect).
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={`${typography.panelMeta} flex items-center gap-1 rounded-full border border-panel-border bg-transparent px-3 py-1 text-text-light outline-none transition-colors hover:bg-panel-hover hover:text-text-header focus-visible:bg-panel-hover focus-visible:text-text-header focus-visible:ring-2 focus-visible:ring-info/40`}
        data-testid="pre-analysis-v3-actions"
      >
        Actions
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Actions"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-40 mt-2 w-60 rounded-xl border border-panel-border bg-panel p-1 shadow-lg"
        >
          {ACTIONS_MENU.map((item, index) => (
            <button
              key={item.id}
              ref={el => {
                itemRefs.current[index] = el
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close(true)
                onAction(item)
              }}
              className={`${typography.panelBody} flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-text-body outline-none transition-colors hover:bg-panel-hover focus:bg-panel-hover`}
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
