/**
 * FocusNowPanel — the "Focus now" coaching surface (render-only).
 *
 * Pure presentational and store-free: it renders the rows + freshness banner it is
 * GIVEN and owns no data, no network, no storage, and no feature flag. A thin
 * container (`useFocusNow`) supplies live props at mount time; here, props come
 * from fixtures/stories/tests.
 *
 * Layout: one calm outer card (prototype-aligned) containing the header, the
 * single panel-level freshness banner, an optional verbatim summary line, and the
 * rows. One row opens at a time; "show all / fewer" is a positional slice (never a
 * filter or sort by meaning, F.6). An honest empty state shows when there are no
 * rows. All strings render as TEXT — never HTML.
 *
 * Claim-safety: `summary` is uncertified CEE prose; the live container gates its
 * display (see useFocusNow). Gated rows are dropped defensively before render.
 */
import { useState } from 'react'
import { typography, typo } from '@/styles/typography'
import { FocusBanner } from './FocusBanner'
import { FocusRowCard } from './FocusRowCard'
import { FocusNowEmpty } from './FocusNowEmpty'
import { dropGatedRows } from './buildFocusRows'
import { FOCUS_COPY, FOCUS_DEFAULT_VISIBLE } from './focusConstants'
import type { FocusNowProps, FocusRow } from './focusTypes'

export function FocusNowPanel({
  summary,
  rows,
  banner,
  onPrefill,
  onRerun,
  rerunDisabled = false,
  className = '',
}: FocusNowProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  // Defensive: never render a gated row, even if a caller passes one in.
  const safeRows = dropGatedRows(rows ?? [])
  const visible = revealed ? safeRows : safeRows.slice(0, FOCUS_DEFAULT_VISIBLE)
  const hiddenCount = safeRows.length - FOCUS_DEFAULT_VISIBLE

  const handleTry = (row: FocusRow) => {
    if (row.action?.kind === 'prefill' && row.action.prefillText) onPrefill?.(row.action.prefillText)
  }

  return (
    <section
      aria-label={FOCUS_COPY.panelAria}
      data-testid="focus-now-panel"
      className={`overflow-hidden rounded-2xl border border-panel-border bg-panel shadow-sm ${className}`}
    >
      <div className="px-3.5 pb-2 pt-3">
        <h2 className={`${typography.panelHeader} text-text-header`}>{FOCUS_COPY.header}</h2>
      </div>

      {banner.kind !== 'none' && (
        <div className="px-3.5 pb-2">
          <FocusBanner state={banner} onRerun={onRerun} rerunDisabled={rerunDisabled} />
        </div>
      )}

      {summary && (
        <div className="px-3.5 pb-2">
          <p className={`${typography.panelBody} text-text-body`} data-testid="focus-summary">
            {summary}
          </p>
        </div>
      )}

      {safeRows.length === 0 ? (
        <div className="px-3.5 pb-3">
          <FocusNowEmpty />
        </div>
      ) : (
        <>
          <ul className="m-0 list-none p-0">
            {visible.map((row) => (
              <li key={row.id} className="border-t border-panel-border first:border-t-0">
                <FocusRowCard
                  row={row}
                  isOpen={openId === row.id}
                  onToggle={() => setOpenId((prev) => (prev === row.id ? null : row.id))}
                  onTryAction={handleTry}
                />
              </li>
            ))}
          </ul>

          {hiddenCount > 0 && (
            <div className="px-3.5 pb-3 pt-2">
              <button
                type="button"
                aria-expanded={revealed}
                onClick={() => setRevealed((v) => !v)}
                data-testid="focus-reveal"
                className={typo(
                  'panelMeta',
                  'rounded text-text-light outline-none transition-colors hover:text-text-header focus-visible:text-text-header focus-visible:ring-2 focus-visible:ring-info/40',
                )}
              >
                {revealed ? FOCUS_COPY.showFewer : FOCUS_COPY.showAll(safeRows.length)}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default FocusNowPanel
