/**
 * V7FreshnessStrip — slim freshness strip for the V7 top group (V7 Lane L4).
 *
 * Spec row 14 (V6-RESPEC-2026-07-23): a NEW slim strip that states, honestly,
 * whether the analysis reflects the current model. It reuses the single-source
 * freshness classifier (`classifyFreshnessForDisplay`) and the canonical copy
 * table (`FRESHNESS_COPY`) that the live `AnalysisFreshnessNotice` uses — the
 * two strips can never disagree because they read the same slice through the
 * same reducer.
 *
 * NO RERUN HERE (deliberate deviation from the prototype's "+ Rerun"): the
 * codebase enforces a single-Rerun owner — the sticky bottom `AnalysisFooter`
 * in OutputsDock (AnalysisFreshnessNotice header: "there is exactly one Rerun
 * and no duplicate"). Adding a second Rerun would break that invariant, the
 * same way the hero must not duplicate the footer's verdict (spec P1). This
 * strip is informational only.
 *
 * Honest absence: when there is no verdict to show (semantic 'none') it renders
 * nothing — it never asserts a freshness state the store does not hold.
 * COMPLETE borders only (L1 guard): the changed state colours all four sides
 * (`border-warning/30`), never a one-sided accent.
 */

import { useCanvasStore } from '@/canvas/store'
import { typography } from '@/styles/typography'
import {
  classifyFreshnessForDisplay,
  type AnalysisFreshnessState,
} from '@/canvas/store/analysisFreshness'
import { FRESHNESS_COPY } from '../AnalysisFreshnessNotice'

export interface V7FreshnessStripProps {
  /** Override the store slice (tests / Storybook). `undefined` → read the store. */
  state?: AnalysisFreshnessState | null
  /** Override the local dirty overlay (tests / Storybook). `undefined` → read the store. */
  dirty?: boolean
}

export function V7FreshnessStrip({ state: stateProp, dirty: dirtyProp }: V7FreshnessStripProps = {}) {
  const storeState = useCanvasStore(s => s.analysisFreshness)
  const storeDirty = useCanvasStore(s => s.analysisFreshnessDirty)
  const state = stateProp !== undefined ? stateProp : storeState
  const dirty = dirtyProp !== undefined ? dirtyProp : storeDirty

  const semantic = classifyFreshnessForDisplay(state, dirty)

  // Honest absence — no verdict to show.
  if (semantic === 'none') return null

  // Map the display semantic to the canonical copy + dot colour. 'changed'
  // reuses the 'stale' copy line; 'cannot_confirm' the 'unknown' line.
  const copy =
    semantic === 'current'
      ? FRESHNESS_COPY.fresh
      : semantic === 'changed'
        ? FRESHNESS_COPY.stale
        : FRESHNESS_COPY.unknown
  const dotColour =
    semantic === 'current' ? 'bg-success' : semantic === 'changed' ? 'bg-warning' : 'bg-text-light'
  const borderColour = semantic === 'changed' ? 'border-warning/30' : 'border-panel-border'

  return (
    <div
      data-testid="v7-freshness-strip"
      data-freshness-semantic={semantic}
      className={`flex items-center gap-2 rounded-md border ${borderColour} bg-panel px-3 py-1.5`}
    >
      <span
        className={`flex-none w-2 h-2 rounded-full ${dotColour}`}
        aria-hidden="true"
        data-testid="v7-freshness-dot"
      />
      <span
        role="status"
        className={`${typography.panelMeta} ${semantic === 'changed' ? 'text-text-header' : 'text-text-body'} min-w-0 flex-1 truncate`}
      >
        {copy}
      </span>
    </div>
  )
}

export default V7FreshnessStrip
