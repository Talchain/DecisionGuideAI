/**
 * Wave 1 + parity O — consolidated Actions menu (brief §4.7, prototype
 * decision-overview v6).
 *
 * ONE persistent menu owning user-invoked science-grounded methods +
 * global utilities. Every coaching ask (the seven methods, Edit decision
 * brief, Review all inputs) routes through the Ask-Olumi drawer
 * (openAskOlumi) with a prefilled EDITABLE draft instead of auto-sending a
 * hidden dispatch — the audit's "routed asks never surface the conversation"
 * fix. The drawer owns the honest no-conversation disabled state, so menu
 * items stay enabled. Rerun stays a direct canonical run (not drawer) with
 * outcome feedback via the self-toast (ToastProvider is absent in the live
 * results tree). Keyboard-complete: Escape closes and focus returns to the
 * trigger.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { executeCanonicalRun } from '../../../canvas/analysis/canonicalRunRegistry'
import { typography } from '../../../styles/typography'
import { openAskOlumi } from '../coaching/askOlumiStore'
import {
  METHOD_CATALOGUE,
  GLOBAL_ACTIONS,
  REVIEW_BRIEF_ASK,
  RERUN_TOASTS,
  type GlobalActionEntry,
  type MethodEntry,
} from './actionsCatalogue'
import { useSelfToast } from './useSelfToast'

export function ActionsMenu() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const { showToast, toastElement } = useSelfToast()

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const menuRef = useRef<HTMLDivElement | null>(null)

  // Review S5: real menu keyboard model — Escape closes with focus restore;
  // Arrow/Home/End rove focus across menuitems; first item focused on open;
  // clicking outside closes.
  useEffect(() => {
    if (!open) return
    const items = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
      )
    items()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        // Codex SF8: a menu that stays open while Tab walks its items is
        // neither the ARIA menu pattern nor a disclosure. Close on Tab and
        // let focus move on naturally (no focus restore — unlike Escape).
        close(false)
        return
      }
      if (e.key === 'Escape') {
        close(true)
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      const list = items()
      if (list.length === 0) return
      e.preventDefault()
      const current = list.indexOf(document.activeElement as HTMLButtonElement)
      const next =
        e.key === 'Home' ? 0
        : e.key === 'End' ? list.length - 1
        : e.key === 'ArrowDown' ? (current + 1 + list.length) % list.length
        : (current - 1 + list.length) % list.length
      list[next]?.focus()
    }
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, close])

  const runMethod = (method: MethodEntry) => {
    close(true)
    // Prototype parity: method click opens the drawer with the method's
    // description as context and its prompt as the editable draft. The
    // method identity rides parameters so the eventual dispatch is a
    // conversation-typed turn carrying chip_metadata {method_id}.
    openAskOlumi({
      context: method.description,
      draft: method.prompt,
      label: method.title,
      parameters: { method_id: method.id },
      source: 'chip',
    })
  }

  const runGlobal = (action: GlobalActionEntry) => {
    close(true)
    if (action.id === 'rerun_analysis') {
      // Rerun stays a DIRECT canonical run (prototype: no drawer). Feedback
      // for every outcome: only the awaited V2 path may claim completion;
      // the fire-and-forget V5 dispatch honestly claims a start.
      void executeCanonicalRun({ source: 'actions-menu' }).then((outcome) => {
        if (outcome.status === 'blocked' || outcome.status === 'unavailable') {
          showToast(outcome.reason)
        } else if (outcome.status === 'already-running') {
          showToast(RERUN_TOASTS.alreadyRunning)
        } else if (outcome.status === 'v2') {
          showToast(RERUN_TOASTS.completed)
        } else {
          showToast(RERUN_TOASTS.started)
        }
      })
      return
    }
    if (action.id === 'edit_brief') {
      openAskOlumi({ ...REVIEW_BRIEF_ASK, source: 'chip' })
      return
    }
    openAskOlumi({
      context: action.description,
      draft: action.prompt ?? `Help me work through: ${action.title}`,
      label: action.title,
      source: 'chip',
    })
  }

  return (
    <div className="relative flex-none">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => (open ? close(true) : setOpen(true))}
        className={`${typography.panelBody} inline-flex items-center gap-1 rounded-pill border px-3 py-1 hover:bg-panel-hover ${
          open ? 'border-info text-text-header' : 'border-panel-border text-text-body'
        }`}
      >
        Actions
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
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
              onClick={() => runMethod(m)}
              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-panel-hover"
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
              onClick={() => runGlobal(a)}
              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-panel-hover"
            >
              <span className={`${typography.panelBody} block font-semibold text-text-header`}>{a.title}</span>
              <span className={`${typography.panelMeta} block text-text-light`}>{a.description}</span>
            </button>
          ))}
        </div>
      )}
      {toastElement}
    </div>
  )
}
