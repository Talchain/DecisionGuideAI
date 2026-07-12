/**
 * Wave 1 — consolidated Actions menu (brief §4.7).
 *
 * ONE persistent menu owning user-invoked science-grounded methods +
 * global utilities. Methods open CONTEXTUAL AI sessions via dispatchAction
 * as conversation-typed turns (chip_metadata carries {method_id} — it is
 * dropped on every other turn type); they disable honestly when no chat is
 * registered (never dead controls). Rerun routes through the canonical
 * runner. Keyboard-complete: Escape closes and focus returns to the
 * trigger (fixes the harvested HeroActionsMenu gap).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { executeCanonicalRun } from '../../../canvas/analysis/canonicalRunRegistry'
import { useShowToastSafe } from '../../../canvas/ToastContext'
import { typography } from '../../../styles/typography'
import { METHOD_CATALOGUE, GLOBAL_ACTIONS, type MethodEntry } from './actionsCatalogue'

export function ActionsMenu() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const dispatchAction = useGuidanceStore((s) => s._dispatchAction)
  const sendMessage = useGuidanceStore((s) => s._sendMessage)
  const showToast = useShowToastSafe()

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  const runMethod = (method: MethodEntry) => {
    close(true)
    // Conversation-typed turn: chip_metadata (the contextual-session
    // carrier) survives ONLY on this turn type.
    void dispatchAction?.({
      action_type: 'discuss',
      parameters: { method_id: method.id },
      label: method.title,
      message: method.prompt,
      source: 'chip',
    })
  }

  const runGlobal = (id: string) => {
    close(true)
    if (id === 'rerun_analysis') {
      void executeCanonicalRun({ source: 'actions-menu' }).then((outcome) => {
        if (outcome.status === 'blocked' || outcome.status === 'unavailable') {
          showToast(outcome.reason)
        }
      })
      return
    }
    if (id === 'edit_brief') {
      sendMessage?.('Review my decision brief with me: challenge the goal, context, constraints and options.')
      return
    }
    if (id === 'review_inputs') {
      sendMessage?.('Walk me through all the current model inputs without changing anything.')
    }
  }

  const methodsEnabled = dispatchAction !== null

  return (
    <div className="relative flex-none">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => (open ? close(true) : setOpen(true))}
        className={`${typography.panelBody} inline-flex items-center gap-1 rounded-pill border border-panel-border px-3 py-1 text-text-body hover:bg-panel-hover`}
      >
        Actions
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Methods and global actions"
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-panel-border bg-panel p-1.5 shadow-2"
        >
          <p className={`${typography.panelMeta} px-2 pb-1 pt-0.5 text-text-light`}>Methods</p>
          {METHOD_CATALOGUE.map((m) => (
            <button
              key={m.id}
              type="button"
              role="menuitem"
              disabled={!methodsEnabled}
              title={methodsEnabled ? undefined : 'Open the Olumi panel to use methods'}
              onClick={() => runMethod(m)}
              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-panel-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={`${typography.panelBody} block font-semibold text-text-header`}>{m.title}</span>
              <span className={`${typography.panelMeta} block text-text-light`}>{m.description}</span>
            </button>
          ))}
          <div className="my-1 h-px bg-panel-border" aria-hidden="true" />
          <p className={`${typography.panelMeta} px-2 pb-1 text-text-light`}>Global actions</p>
          {GLOBAL_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              onClick={() => runGlobal(a.id)}
              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-panel-hover"
            >
              <span className={`${typography.panelBody} block font-semibold text-text-header`}>{a.title}</span>
              <span className={`${typography.panelMeta} block text-text-light`}>{a.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
