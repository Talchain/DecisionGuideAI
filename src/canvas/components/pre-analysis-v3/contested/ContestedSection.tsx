/**
 * ContestedSection — "Where our reviews disagree" (ROADMAP 2.376).
 *
 * CEE validates every drafted connection twice and flags the ones the two passes disagree
 * about. Those cards have been live in the Model tab for some time; this is the same fact,
 * put in front of the user on the surface they are actually standing on before they run —
 * the pre-analysis panel. It is an ADDITION to the pre-run screen, not a rescue of the Model
 * tab, which keeps its own uncapped, fully actionable list.
 *
 * ⚠ DISPLAY-ONLY, AND THE COPY SAYS SO. There is no pre-analysis write path to reuse: the
 * legacy panel's contested resolve handler was deleted in the Brief 4 Task 6 dead-code sweep
 * (`PreAnalysisPanel.tsx:76,1106`), and the only live adjudication surface is the Model tab
 * (`ModelTabBody::handleResolveContested` → `RelationshipsSection` → `ContestedEdgeCard`).
 * This slice does NOT invent a second write path. The one affordance here is the EXISTING,
 * non-mutating cross-panel handoff the legacy panel already uses for exactly this destination
 * (`PreAnalysisPanel.tsx:2304`) — two ui-store calls, no graph mutation.
 *
 * EMPTY MEANS ABSENT. Nothing renders when no connection is contested — no header, no "0",
 * no reassurance row. Same rule as SharpenSection.
 *
 * HIERARCHY. A single `border-t` and no static `bg-panel-hover` strip: the panel's one neutral
 * section-header strip belongs to Sharpen and its one `border-b` to the Header
 * (`hierarchyContract.spec.tsx`).
 */

import { memo, useCallback, useState } from 'react'
import { Scale } from 'lucide-react'
import { typography, typo } from '../../../../styles/typography'
import { useUIStore } from '../../../../stores/uiStore'
import { CONTESTED_COPY } from '../constants'
import type { ContestedRowModel } from '../selectors/computeContestedRows'

/**
 * One contested connection. The expert detail (what the second look was based on, and its
 * own sentence) sits behind a per-row reveal, in the panel's existing reveal idiom — an
 * `aria-expanded` text button, as SharpenSection's "Show N more" uses. Conditional render
 * rather than `hidden`: PanelDisclosure's always-mounted rule exists so a section-level
 * `aria-controls` target is valid, and this row-level reveal has no such target.
 */
const ContestedRow = memo(function ContestedRow({ row }: { row: ContestedRowModel }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="grid grid-cols-[16px_1fr] items-start gap-2 border-t border-panel-border py-2 first:border-t-0"
      data-testid={`pre-analysis-v3-contested-row-${row.edgeId}`}
      data-contested-edge-id={row.edgeId}
    >
      <Scale className="mt-0.5 h-3.5 w-3.5 flex-none text-text-light" aria-hidden />
      <div className="min-w-0">
        <p className={`${typography.panelBody} text-text-body`}>
          {CONTESTED_COPY.rowLeadIn}{' '}
          {/* Shared graph labels render VERBATIM — the panel never rewrites them. */}
          <span className="font-semibold text-text-header">{row.sourceLabel}</span>{' '}
          {CONTESTED_COPY.rowConnective}{' '}
          <span className="font-semibold text-text-header">{row.targetLabel}</span>
        </p>
        {row.reasons.map(reason => (
          <p key={reason} className={`${typography.panelMeta} text-text-light`}>
            {reason}
          </p>
        ))}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className={typo(
            'panelMeta',
            'mt-1 rounded text-info outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-info/40',
          )}
          data-testid={`pre-analysis-v3-contested-detail-${row.edgeId}`}
        >
          {open ? CONTESTED_COPY.hideDetail : CONTESTED_COPY.showDetail}
        </button>
        {open && (
          <div className="mt-1 space-y-0.5">
            <p className={`${typography.panelMeta} text-text-light`}>{row.basis}</p>
            {row.reasoning && (
              <p className={`${typography.panelMeta} text-text-light`}>{row.reasoning}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

export const ContestedSection = memo(function ContestedSection({
  rows,
}: {
  rows: ContestedRowModel[]
}) {
  // The established pre-analysis → Model tab handoff (PreAnalysisPanel.tsx:2304). Navigation
  // only: it asks the Model tab to open its relationships section and activates that tab.
  // Nothing here writes graph data.
  const openInModelTab = useCallback(() => {
    useUIStore.getState().requestModelTabSection('relationships')
    useUIStore.getState().setActiveOutputTab('diagnostics')
  }, [])

  if (rows.length === 0) return null

  return (
    <div className="border-t border-panel-border px-4 py-4" data-testid="pre-analysis-v3-contested">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className={`${typography.panelHeader} text-text-header`}>{CONTESTED_COPY.title}</h2>
        <span className={`${typography.panelMeta} flex-none text-text-light`}>
          {CONTESTED_COPY.meta(rows.length)}
        </span>
      </div>
      <p className={`${typography.panelMeta} mb-2 text-text-light`}>{CONTESTED_COPY.lead}</p>
      <div>
        {rows.map(row => (
          <ContestedRow key={row.edgeId} row={row} />
        ))}
      </div>
      <button
        type="button"
        onClick={openInModelTab}
        className={typo(
          'panelMeta',
          'mt-2 inline-flex items-center gap-1 self-start rounded text-info outline-none hover:underline focus-visible:ring-2 focus-visible:ring-info/40',
        )}
        data-testid="pre-analysis-v3-contested-review"
      >
        {CONTESTED_COPY.reviewCta} ›
      </button>
    </div>
  )
})
