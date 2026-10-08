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
 *
 * ⭐ P48 (audit #27, GAP-11 ruling: ONE graph-level cue, no per-card mark) — THE SENTENCE LIGHTS WHAT CHANGED.
 * Pointing at the sentence lights the cards and links CEE says changed since the last Run (`changed_since_run`, held
 * by `canvas/changes/changedSinceRun.ts`); a click keeps them lit, a second click or Esc clears. It stays BENEATH the
 * graph and `pointer-events: none`: the pointer is read off the `.react-flow` root and acts only when the PANE is what
 * was hit over the sentence's box, so a card that runs under the line still wins every pointer. Keyboard users reach
 * the same toggle as a real button (focus works at any z-order). The lighting is a scoped rule on xyflow's own
 * `rf__node-` / `rf__edge-` ids, painted only while lit, so no card or edge component carries a mark. Changes CEE
 * cannot place are said once, as a count, while lit. With no answer from CEE the sentence is the plain line it was.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  OVERLAY_BAND_BOTTOM,
  OVERLAY_BAND_HEIGHT,
  OVERLAY_BAND_LEFT_PAD,
  useOverlayCell,
} from './CanvasOverlayBand'
import { useModelChangedSinceRun } from '../hooks/useModelChangedSinceRun'
import { HISTORICAL_REPORT_EPOCH, useCanvasStore } from '../store'
import { runDeltaDescribesDisplayedAnalysis } from '../state/storedRunDelta'
import { isSyntheticRestoreId } from '../store/runIdentityPlaceholder'
import { LAST_RUN_PREFIX } from '../nodes/shared/metricVocabulary'
import { CHANGED_SINCE_RUN_WORDS, isLinkChangedSinceRun, useChangedSinceRunStore } from '../changes/changedSinceRun'
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

export const ANALYSIS_STATE_CUE_LIGHT_WORDS = { aria: 'Show what changed since the last run' } as const

/**
 * An attribute-selector string literal: only `\\`, `"` and line breaks can end or corrupt it. A line break is written as
 * its CSS hex escape, never folded into a space (`e\n1` and `e 1` are two different edges).
 */
const attr = (v: string): string =>
  `"${v.replace(/[\\"]/g, '\\$&').replace(/[\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}"`

/** The rule that lights the changed set — on xyflow's own ids, so no card or edge component carries a mark. */
export function changedSetLightingCss(nodeIds: readonly string[], edgeIds: readonly string[]): string {
  const nodes = nodeIds.map((id) => `.react-flow [data-testid=${attr(`rf__node-${id}`)}]`)
  const edges = edgeIds.map((id) => `.react-flow [data-testid=${attr(`rf__edge-${id}`)}] .react-flow__edge-path`)
  return [
    nodes.length ? `${nodes.join(',')}{outline:2px dashed var(--info);outline-offset:3px;border-radius:var(--radius-sm)}` : '',
    edges.length ? `${edges.join(',')}{stroke:var(--info)!important;stroke-width:3px!important}` : '',
  ].join('')
}

/**
 * What the sentence can light, for the scenario and displayed Run: no confirmed match leaves the plain line.
 */
function useChangedSet() {
  const scenarioId = useCanvasStore((st) => st.currentScenarioId)
  const edges = useCanvasStore((st) => st.edges)
  const displayedRunId = useCanvasStore((st) => {
    const r = st.results
    if (r.report == null || st.currentScenarioId == null) return null
    // Legacy runId can name an in-flight Run or survive a V5 completion; require report provenance.
    const sameEpoch = typeof r.reportEpoch === 'number' && r.reportEpoch !== HISTORICAL_REPORT_EPOCH && r.reportEpoch === r.runEpoch
    const restoredHere = r.reportEpoch === HISTORICAL_REPORT_EPOCH && r.restoredForScenarioId === st.currentScenarioId
    const legacyId = r.status === 'complete' && r.resultsSource !== 'conversation' && (sameEpoch || restoredHere) &&
      r.runId && !isSyntheticRestoreId(r.runId) ? r.runId : null
    if (st.analysisStateV1 == null) return legacyId
    // V5 records the real Run id on the delta's current endpoint. Hash alone cannot identify a repeated Run.
    if (!runDeltaDescribesDisplayedAnalysis(st.runDelta, r.hash, st.currentScenarioId)) return null
    const current = st.runDelta?.delta.endpoints?.current
    const rs = st.analysisStateV1.run_state
    const computedAt = rs && 'computed_at' in rs ? rs.computed_at : null
    if (!current || typeof computedAt !== 'string' || computedAt.length === 0 || current.computed_at !== computedAt) return null
    // Neither authority wins a conflict: a same-hash completion can retain the other Run's identity.
    const id = current.run_id
    return id && !isSyntheticRestoreId(id) && (legacyId == null || legacyId === id) ? id : null
  })
  const held = useChangedSinceRunStore()
  return useMemo(() => {
    if (scenarioId == null || held.scenarioId !== scenarioId || held.value == null) return null
    if (displayedRunId == null || held.value.sinceRunId !== displayedRunId) return null
    const nodeIds = [...held.value.nodeIds]
    const edgeIds = edges.filter((e) => isLinkChangedSinceRun(held, scenarioId, e.source, e.target)).map((e) => e.id)
    const unattributed = held.value.unattributedChanges
    if (nodeIds.length === 0 && edgeIds.length === 0 && unattributed === 0) return null
    return { scenarioId, runId: displayedRunId, nodeIds, edgeIds, unattributed }
  }, [scenarioId, displayedRunId, edges, held])
}

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
  const changed = useChangedSet()
  const shown = modelChangedSinceRun && granted && (cellWidth === undefined || cellWidth >= ANALYSIS_STATE_CUE_MIN_WIDTH_PX)
  const lightable = shown && changed !== null
  const [{ pinned, hovered, focused, dismissed }, setLighting] = useState({
    pinned: false, hovered: false, focused: false, dismissed: false,
  })
  const sentenceRef = useRef<HTMLParagraphElement>(null)
  const actionHintId = useId()
  const lit = lightable && !dismissed && (pinned || hovered || focused)
  const toggleLighting = useCallback(() => setLighting((s) => ({ ...s, pinned: !s.pinned, dismissed: s.pinned })), [])

  // The pointer, read off the `.react-flow` root: only a PANE hit inside the sentence's box counts.
  useEffect(() => {
    const sentence = sentenceRef.current
    const root = sentence?.closest('.react-flow') as HTMLElement | null
    if (!lightable || !sentence || !root) return
    const over = (e: MouseEvent): boolean => {
      const t = e.target as Element | null
      if (!t?.classList?.contains('react-flow__pane')) return false
      const r = sentence.getBoundingClientRect()
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    }
    const onMove = (e: MouseEvent) => {
      const on = over(e)
      setLighting((s) => ({ ...s, hovered: on, dismissed: on && !s.hovered ? false : s.dismissed }))
      if (on) root.setAttribute('data-analysis-cue-hover', '')
      else root.removeAttribute('data-analysis-cue-hover')
    }
    const onClick = (e: MouseEvent) => { if (over(e)) toggleLighting() }
    const onLeave = () => { setLighting((s) => ({ ...s, hovered: false })); root.removeAttribute('data-analysis-cue-hover') }
    root.addEventListener('pointermove', onMove)
    root.addEventListener('click', onClick)
    root.addEventListener('pointerleave', onLeave)
    return () => {
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('click', onClick)
      root.removeEventListener('pointerleave', onLeave)
      root.removeAttribute('data-analysis-cue-hover')
    }
  }, [lightable, toggleLighting])

  useEffect(() => {
    if (!lightable) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLighting((s) => ({ ...s, pinned: false, dismissed: true }))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightable])

  // No interaction outlives its Run or availability; removal need not dispatch the button's blur.
  useLayoutEffect(() => {
    setLighting({ pinned: false, hovered: false, focused: false, dismissed: false })
  }, [lightable, changed?.scenarioId, changed?.runId])

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
      <p ref={sentenceRef} data-testid={ANALYSIS_STATE_CUE_TESTID} role="status" aria-live="polite" className={styles.cue}>
        {lightable ? (
          <button
            type="button"
            data-testid={`${ANALYSIS_STATE_CUE_TESTID}-light`}
            aria-describedby={actionHintId}
            aria-pressed={pinned}
            className={`${styles.light} ${lit ? styles.lit : ''}`}
            onClick={toggleLighting}
            onFocus={() => setLighting((s) => ({ ...s, focused: true, dismissed: false }))}
            onBlur={() => setLighting((s) => ({ ...s, focused: false }))}
          >
            {ANALYSIS_STATE_CUE_COPY}
          </button>
        ) : (
          ANALYSIS_STATE_CUE_COPY
        )}
      </p>
      {lightable ? (
        <span id={actionHintId} className={styles.srOnly}>{ANALYSIS_STATE_CUE_LIGHT_WORDS.aria}</span>
      ) : null}
      {lit && changed && changed.unattributed > 0 ? (
        <p data-testid={`${ANALYSIS_STATE_CUE_TESTID}-unattributed`} className={styles.cue}>
          {CHANGED_SINCE_RUN_WORDS.unattributed(changed.unattributed)}
        </p>
      ) : null}
      {lit && changed ? (
        <style data-testid={`${ANALYSIS_STATE_CUE_TESTID}-lighting`}>
          {changedSetLightingCss(changed.nodeIds, changed.edgeIds)}
        </style>
      ) : null}
      {lightable ? (
        <style>{'.react-flow[data-analysis-cue-hover] .react-flow__pane{cursor:pointer}'}</style>
      ) : null}
    </div>
  )
}
