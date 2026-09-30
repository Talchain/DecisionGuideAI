/**
 * AnalysisStateCue — one canvas-level sentence that explains the cards'
 * `Last run ·` labels.
 *
 * ⭐ WHY IT EXISTS — Paul 23 Sep contract feedback point 14 (ACCEPT): "Add a
 * small overall analysis-state cue … `Model changed · previous findings shown
 * as Last run`. This makes individual `Last run ·` labels understandable."
 * Without it a user sees `Last run ·` on some cards and not on others and has
 * to work out for themselves why.
 *
 * ⭐ ONE AUTHORITY, THE CARDS' OWN. It shows on exactly one predicate:
 * `useModelChangedSinceRun()` — the same hook the factor cards, the `Key
 * driver N` badge and the inspector's `ImportanceBar` ask before prefixing
 * `LAST_RUN_PREFIX`, and the same composed verdict (`useAnalysisTrust()
 * .semantic === 'changed'`) behind the `'changed'` arm of `runCurrency.ts` that
 * gives option cards their `Last run` caption. So the cue cannot say "shown as
 * Last run" while no card does, and it cannot stay silent while they do.
 *
 * ⛔ WHAT IT DELIBERATELY DOES NOT SAY
 *   · never run / no run → nothing. There is no previous finding to describe.
 *   · current → nothing. The findings ARE about this model; a cue would be noise.
 *   · cannot confirm → nothing. That state may assert neither currency nor
 *     change (ED 02:31Z), and no card says `Last run` in it
 *     (`optionResultCaption('unconfirmed')` is `Model result`), so there is no
 *     label for this sentence to explain. Silence is the one wording that
 *     asserts neither.
 *   · no count. "2 edits since" would need an authoritative edit count against
 *     the displayed run, and none is read here (Paul point 14: "avoid invented
 *     counts"). The sentence names the state, not its size.
 *   · no instruction. It does not tell the user to re-run; whether to is theirs.
 *
 * ⭐ PLACEMENT — THE CANVAS FOOT, BOTTOM-LEFT, PAINTED BENEATH THE GRAPH
 * (27 Sep 2026, canvas-8ffc sbs-post DIFF item 8).
 *
 * It used to be a white bordered pill in the overlay band's bottom-RIGHT cell.
 * On Paul's `mrr-90b8f080` board, stale landing at 1280x800, that pill sat at
 * x 460.5–804, y 760–788, and `elementFromPoint` at the Goal glyph and at the
 * only fragile-edge cue both returned this component. Contract v3.1 draws the
 * sentence as the canvas foot: small muted text at the bottom-left, off the
 * graph, said once (`#canvasFoot`, 10px, muted). Paul ruled out a footer BAR
 * (see `CanvasFooterSummary`'s old mount note), so this is a single muted line
 * with no strip, surface or icon.
 *
 * ⛔ WHY IT IS NOT SIMPLY AN OVERLAY IN THE BOTTOM-LEFT CELL. The band is already
 * a fit contributor (`computeFitPadding`), and the pill still covered the Goal:
 * 90b8 does not fit at the legibility floor, so the landing fit clamps at 0.50
 * and TOP-ANCHORS, and the board overflows the pane's bottom edge (Goal card at
 * y 772.5–821 of 800). On such a board NO band slot is card-free at landing —
 * as an overlay from x 70 this line would run across the Goal title "MRR"
 * (x 308–329). The fit cannot reserve what the clamp overrides.
 *
 * So the line takes the band's bottom-left SLOT — its arbitration (the lens
 * panel outranks it; one slot, one occupant — and while the panel holds the
 * slot it says this sentence itself, so the stale fact is never hidden by the
 * occupant that displaced it; see `LensInfoPanel.tsx`), its left edge and its measured
 * width, which the band floors while the cue holds it (N3) — but it is not
 * drawn INTO the band, which paints above the graph (z 250). It is mounted
 * inside `<ReactFlow>` and sits below `.react-flow__renderer` in the stacking
 * context xyflow gives `.react-flow`: every card, edge and cue paints over it,
 * and the pane above it keeps every pan and click. It cannot cover graph
 * content in any camera state; where a board runs under it, the board wins and
 * the cards keep their own `Last run ·` labels.
 *
 * Styling is neutral: the contract's foot type — 10px, the muted token
 * (`--text-light`, 4.65:1 on `--bg-canvas`, AA for text; Paul point 12 asked
 * for muted contrast to be checked, not avoided) — no surface, no border, no
 * shadow and no icon. It is a statement of state, not a warning and not an
 * attention cue (Paul point 9: info blue is the attention channel).
 */
import { useLayoutEffect, useState } from 'react'
import {
  OVERLAY_BAND_BOTTOM,
  OVERLAY_BAND_HEIGHT,
  OVERLAY_BAND_LEFT_PAD,
  useOverlayCell,
} from './CanvasOverlayBand'
import { useModelChangedSinceRun } from '../hooks/useModelChangedSinceRun'
import { useCanvasStore } from '../store'
import { LAST_RUN_PREFIX } from '../nodes/shared/metricVocabulary'
import styles from './AnalysisStateCue.module.css'

export const ANALYSIS_STATE_CUE_TESTID = 'analysis-state-cue'

/**
 * The label the cards render, BUILT from their own prefix (`'Last run · '` →
 * `'Last run'`) rather than re-typed, so the cue names the words on the cards.
 */
export const ANALYSIS_STATE_CUE_LABEL = LAST_RUN_PREFIX.replace(/\s*·\s*$/, '')

export const ANALYSIS_STATE_CUE_HEAD = 'Model changed'
export const ANALYSIS_STATE_CUE_DETAIL = `previous findings shown as ${ANALYSIS_STATE_CUE_LABEL}`
/** The whole sentence, as it reads on screen and to assistive technology. */
export const ANALYSIS_STATE_CUE_COPY = `${ANALYSIS_STATE_CUE_HEAD} · ${ANALYSIS_STATE_CUE_DETAIL}`

/**
 * The narrowest cell the line will draw in. It is the width the band already
 * floors the cue's column to while the cue holds it (N3,
 * `OVERLAY_BAND_RIGHT_CELL_MIN`), kept from the pill's old guard so no band
 * layout moves; at 10px type the sentence takes at most two 13px lines there,
 * well inside the band's 64px. It bites only on a canvas genuinely narrower
 * than the floor, where the line withdraws rather than stack up a column — and
 * the cards keep their own `Last run ·` labels.
 */
export const ANALYSIS_STATE_CUE_MIN_WIDTH_PX = 200

/**
 * The live width of the band cell this line mirrors. `undefined` when there is
 * no cell (a standalone render) or no `ResizeObserver`; otherwise re-measured
 * whenever the cell resizes (dock toggled, window resized, a centre occupant
 * came or went) — the band's grid decides, this only reads it.
 */
function useCellWidth(cell: HTMLElement | null): number | undefined {
  const [width, setWidth] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (!cell || typeof ResizeObserver === 'undefined') {
      setWidth(undefined)
      return
    }
    const measure = () => setWidth(cell.getBoundingClientRect().width)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(cell)
    return () => ro.disconnect()
  }, [cell])
  return width
}

export function AnalysisStateCue() {
  // ⛔ "previous findings shown as Last run" needs FINDINGS SHOWN (R3 stale battery, served 6dcb3b10 oob C): a fresh
  // browser whose read says `complete_stale` with no result holds no Run, yet the verdict alone made the state
  // `changed` and the cue claimed findings nobody could see beside "Not ready for analysis yet". The same browser,
  // which drops the unvouched Run, was right to say nothing.
  const findingsShown = useCanvasStore((st) => st.results?.report != null)
  const modelChangedSinceRun = useModelChangedSinceRun() && findingsShown
  // Hooks stay unconditional: the cue's own condition is passed as `wants`, so
  // a cue with nothing to say never holds the slot.
  const { granted, target } = useOverlayCell('bottom-left', 'analysis-state-cue', modelChangedSinceRun)
  const cellWidth = useCellWidth(modelChangedSinceRun && granted ? target : null)

  if (!modelChangedSinceRun || !granted) return null
  if (cellWidth !== undefined && cellWidth < ANALYSIS_STATE_CUE_MIN_WIDTH_PX) return null

  // Rendered IN PLACE — the mount site is inside `<ReactFlow>` — never
  // portalled into the band. See the header for why the band cannot carry it.
  return (
    <div
      className={styles.slot}
      data-testid={`${ANALYSIS_STATE_CUE_TESTID}-fit`}
      style={{
        left: OVERLAY_BAND_LEFT_PAD,
        bottom: OVERLAY_BAND_BOTTOM,
        height: OVERLAY_BAND_HEIGHT,
        ...(cellWidth !== undefined ? { width: cellWidth } : {}),
      }}
    >
      <p data-testid={ANALYSIS_STATE_CUE_TESTID} role="status" aria-live="polite" className={styles.cue}>
        {ANALYSIS_STATE_CUE_COPY}
      </p>
    </div>
  )
}
