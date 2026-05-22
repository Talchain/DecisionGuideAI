/**
 * HeroInputRows — "Needs your input" section: top 3 rows + +3 disclosure.
 *
 * The composed `TriageActionCardsBody` suppresses its own EVPI queue when
 * the v17 hero is rendering (via the `suppressTriageQueue` prop), so this
 * is the canonical input surface in flag-on mode — no duplication.
 */

import { useState } from 'react'
import { typography } from '@/styles/typography'
import type { HeroRow, RowAction } from './analysisHeroVM.types'
import { ROW_TINT_CLASS, CATEGORY_DOT_CLASS } from './tokens'
import { HeroActionRow } from './HeroActionRow'

interface HeroInputRowsProps {
  inputRows: HeroRow[]
  hiddenRows: HeroRow[]
  dispatchRowAction: (
    action: RowAction,
    payload: { chatPrompt: string; targetNodeId: string | undefined },
  ) => void
  /** Forwarded to HeroActionRow. When false, prefill-only icons (ai/discuss/
   *  add/challenge/brief) are filtered out of the row entirely — they do NOT
   *  render disabled. Edit + Confirm remain visible because they dispatch
   *  through onFocusNode / onConfirm and don't require an open chat. */
  chatPrefillAvailable: boolean
}

export function HeroInputRows({ inputRows, hiddenRows, dispatchRowAction, chatPrefillAvailable }: HeroInputRowsProps) {
  const [expanded, setExpanded] = useState(false)
  if (inputRows.length === 0 && hiddenRows.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5" aria-label="Items needing your input" data-testid="hero-v17-input-rows">
      <div className="flex items-center justify-between gap-2">
        <strong className={`${typography.panelHeader} text-text-header`}>Needs your input</strong>
        {hiddenRows.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            className={`${typography.panelMeta} text-text-light hover:text-info cursor-pointer`}
            data-testid="hero-v17-rows-toggle"
          >
            {expanded ? 'Hide ▴' : `+${hiddenRows.length} ▾`}
          </button>
        )}
      </div>
      <div className="flex flex-col">
        {inputRows.map(row => <HeroInputRow key={row.key} row={row} dispatchRowAction={dispatchRowAction} chatPrefillAvailable={chatPrefillAvailable} />)}
      </div>
      {expanded && (
        <div className="flex flex-col" data-testid="hero-v17-hidden-rows">
          {hiddenRows.map(row => <HeroInputRow key={row.key} row={row} dispatchRowAction={dispatchRowAction} chatPrefillAvailable={chatPrefillAvailable} />)}
        </div>
      )}
    </section>
  )
}

interface HeroInputRowProps {
  row: HeroRow
  dispatchRowAction: HeroInputRowsProps['dispatchRowAction']
  chatPrefillAvailable: boolean
}

function HeroInputRow({ row, dispatchRowAction, chatPrefillAvailable }: HeroInputRowProps) {
  return (
    <article
      className={`px-2.5 py-2 border-b border-panel-border last:border-b-0 ${ROW_TINT_CLASS[row.category]}`}
      data-testid={`hero-v17-row-${row.category}`}
    >
      {/* Priority pill (text + mini bar) removed in the 2026-05-21
          correction pass: row order communicates priority and the verb-led
          title + reason carry the actionable signal. `row.priority` and
          `row.priorityWidth` stay on the VM type (still consumed by
          buildResultsVM tests) but are not rendered. */}
      <div className="flex items-start gap-3 justify-between">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_DOT_CLASS[row.category]}`}
              aria-hidden="true"
              data-testid="hero-v17-row-dot"
            />
            <p
              className={`${typography.panelHeader} text-text-header line-clamp-2 break-words min-w-0 flex-1`}
              title={row.title}
              data-testid="hero-v17-row-title"
            >
              {row.title}
            </p>
          </div>
          <p
            className={`${typography.panelBody} text-text-body line-clamp-2`}
            data-testid="hero-v17-row-reason"
          >
            {row.reason}
          </p>
        </div>
        <HeroActionRow
          actions={row.actions}
          chatPrompt={row.chatPrompt}
          targetNodeId={row.targetNodeId}
          dispatchAction={dispatchRowAction}
          chatPrefillAvailable={chatPrefillAvailable}
        />
      </div>
    </article>
  )
}
