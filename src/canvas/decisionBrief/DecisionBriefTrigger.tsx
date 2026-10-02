/**
 * The decision brief's control and panel, self-contained so its host (the top bar) adds one line and owns only the
 * layout. It holds no store: the open flag is this component's own state, and the brief is built from the saved
 * read fetched on open (`useSavedScenarioRead`).
 *
 * The panel is NON-MODAL and sits at the right edge, so clicking an element in the brief shows it on the graph
 * beside it: `focusExistingTarget` (select, centre, glow — fail-closed for an id this canvas does not hold) and the
 * canvas highlight set (`setHighlightedNodes`), cleared when the panel closes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, X, Printer, Copy } from 'lucide-react'

import { useCanvasStore } from '../store'
import { focusExistingTarget } from '../utils/focusHelpers'
import { isCeeAddressableScenarioId } from '../hydrate/bootGraphRead'
import { buildDecisionBrief, decisionBriefToText } from './buildDecisionBrief'
import { decisionBriefToHtml } from './decisionBriefHtml'
import { DecisionBriefView } from './DecisionBriefView'
import { useSavedScenarioRead } from './useSavedScenarioRead'

export const DECISION_BRIEF_TRIGGER_LABEL = 'Decision brief'

const READ_FAILURE_COPY: Record<string, string> = {
  absent: 'This decision has no saved model yet, so there is nothing to brief.',
  notReadable: 'I couldn’t open the saved model for this decision.',
  unavailable: 'The saved model is unavailable right now. Try again shortly.',
  signInRequired: 'Sign in again to open the saved model.',
  refused: 'I couldn’t open the saved model for this decision.',
  unusable: 'I couldn’t read the saved model for this decision.',
}

export function DecisionBriefTrigger({ className = '' }: { className?: string }) {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId) ?? null
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const read = useSavedScenarioRead(scenarioId, open)

  const brief = useMemo(
    () => (read.status === 'done' && read.result.status === 'graph' ? buildDecisionBrief(read.result) : null),
    [read],
  )

  const close = useCallback(() => {
    setOpen(false)
    useCanvasStore.getState().setHighlightedNodes([])
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const showNode = useCallback((nodeId: string) => {
    if (focusExistingTarget(nodeId, 'node')) useCanvasStore.getState().setHighlightedNodes([nodeId])
  }, [])

  const copyText = useCallback(async () => {
    if (!brief) return
    try {
      await navigator.clipboard.writeText(decisionBriefToText(brief))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [brief])

  const print = useCallback(() => {
    if (!brief) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.open()
    w.document.write(decisionBriefToHtml(brief))
    w.document.close()
    w.focus()
    w.print()
  }, [brief])

  if (!isCeeAddressableScenarioId(scenarioId)) return null

  const failure =
    read.status === 'done' && read.result.status !== 'graph'
      ? READ_FAILURE_COPY[read.result.status] ?? READ_FAILURE_COPY.unusable
      : null

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className={className}
        aria-expanded={open}
        aria-label={DECISION_BRIEF_TRIGGER_LABEL}
        data-testid="decision-brief-trigger"
      >
        <FileText size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <aside
            role="complementary"
            aria-label={DECISION_BRIEF_TRIGGER_LABEL}
            className="fixed bottom-3 right-3 top-16 z-[1600] flex w-[400px] max-w-[calc(100vw-24px)] flex-col rounded-lg border border-panel-border bg-panel shadow-panel"
            data-testid="decision-brief-panel"
          >
            <div className="flex items-center gap-2 border-b border-panel-border px-4 py-2.5">
              <span className="text-sm font-semibold text-text-header">{DECISION_BRIEF_TRIGGER_LABEL}</span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={copyText}
                disabled={!brief}
                className="rounded-md p-1.5 text-text-light hover:bg-panel-hover hover:text-text-header disabled:opacity-40"
                aria-label={copied ? 'Copied' : 'Copy brief as text'}
                title={copied ? 'Copied' : 'Copy brief as text'}
                data-testid="decision-brief-copy"
              >
                <Copy size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={print}
                disabled={!brief}
                className="rounded-md p-1.5 text-text-light hover:bg-panel-hover hover:text-text-header disabled:opacity-40"
                aria-label="Print or save as PDF"
                title="Print or save as PDF"
                data-testid="decision-brief-print"
              >
                <Printer size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1.5 text-text-light hover:bg-panel-hover hover:text-text-header"
                aria-label="Close decision brief"
                data-testid="decision-brief-close"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
              {read.status === 'loading' && <p className="text-sm text-text-light">Reading the saved model…</p>}
              {failure && <p className="text-sm text-text-body" data-testid="decision-brief-failure">{failure}</p>}
              {brief && <DecisionBriefView brief={brief} onShowNode={showNode} />}
            </div>
          </aside>,
          document.body,
        )}
    </>
  )
}
