import { useEffect, useRef } from 'react'
import { useNodesInitialized, useStore as useReactFlowStore } from '@xyflow/react'
import { useCanvasStore } from '../store'
import {
  evaluateMeasurementGate,
  allUnlockedNodesMeasured,
} from '../utils/measureLayoutGate'
import {
  LAYOUT_MEASUREMENT_FALLBACK_MS,
  HEIGHT_GROWTH_TOLERANCE_PX,
} from '../utils/nodeLayoutConstants'
import { handleLayoutWithRecovery } from '../layout/handleLayoutWithRecovery'
import { logger } from '../../lib/logger'

/**
 * Measure-then-layout effect (D2 of the layout-stabilisation brief).
 *
 * Gating logic lives in `evaluateMeasurementGate` (pure, unit-tested in
 * measureLayoutGate.spec.ts). This hook glues the decision to
 * setTimeout / applyLayout / cleanup. The captured layoutRequestId is
 * passed to applyLayout, which silently drops the call if the store has
 * moved past it — a fast second draft arriving before the first laid
 * out is correctly superseded.
 *
 * Auto-triggered failures route through handleLayoutWithRecovery so the
 * existing layoutProgressStore + retry-banner UX surfaces them, matching
 * how manual triggers (toolbar, command palette) already report failures.
 *
 * 2026-05-14 P0 fix: the fallback timer uses a **deadline ref** so it
 * survives effect re-runs. The previous fresh-timer-per-effect pattern was
 * starved in real browser environments where React Flow re-emits
 * `nodeLookup` (forcing this effect to re-run) faster than the fallback
 * timeout — every cleanup cancelled the pending timer before it could fire,
 * so layout never ran on a fresh V5 inline draft. The deadline is set once
 * when the gate first reports `'wait-with-fallback'` and cleared when it
 * leaves that state; subsequent effect re-runs schedule a timer for the
 * *remaining* time relative to that deadline rather than restarting it.
 *
 * Must be called inside a ReactFlowProvider (uses React Flow hooks).
 */
export function useMeasureThenLayout(): void {
  const pendingLayout = useCanvasStore((s) => s.pendingLayout)
  const layoutInProgress = useCanvasStore((s) => s.layoutInProgress)
  const layoutRequestId = useCanvasStore((s) => s.layoutRequestId)
  const storeNodes = useCanvasStore((s) => s.nodes)
  const applyLayout = useCanvasStore((s) => s.applyLayout)
  const nodesInitialized = useNodesInitialized()
  const nodeLookup = useReactFlowStore((s) => s.nodeLookup)

  /**
   * ⭐ THE TRIGGER FOR THE TWO CORRECTIONS BELOW. WITHOUT IT THEY ARE DEAD CODE.
   *
   * React Flow MUTATES `nodeLookup` IN PLACE as cards measure — it does not
   * replace the Map. So `useReactFlowStore(s => s.nodeLookup)` returns the SAME
   * reference before and after a card reaches its final height, React never
   * re-renders on that account, this effect never re-runs, and neither
   * correction below ever gets the chance to observe the growth. The layout
   * committed against the cards' transient first-paint heights is then
   * TERMINAL, which is precisely the shipped overlap.
   *
   * Measured in real Chromium at `d4ff3683`, seeding the `pricing-model`
   * starter at 1440x900 (`e2e/geometry/overlapHeightTimeline.measure.ts`):
   *   t=688ms  layoutVersion 0  cards 119/139/154/125/110 px
   *   t=1512ms layoutVersion 1  row pitches [183,230,218,137,155]
   *                             cards ALREADY 253/300/251/269/244 px
   * A 137 px pitch under a 161 px card overlaps by 24 px, and in 5 of 6 runs
   * nothing corrected it. The discriminating experiment
   * (`e2e/geometry/overlapTriggerProbe.measure.ts`) nudged ONLY the identity of
   * the store's `nodes` array — no geometry, position or content touched — and
   * the graph corrected itself from 15 overlapping pairs at layoutVersion 1 to
   * ZERO at layoutVersion 3. The logic was never wrong; it was never woken.
   *
   * ⚠ A DERIVED SIGNATURE, NOT A HAND-MAINTAINED LIST (CLAUDE.md trap 12): it
   * is computed from whatever `nodeLookup` currently holds, so a new node type
   * or a renamed field cannot silently drop out of it.
   *
   * ⚠ AND IT MUST BE STABLE WHEN NOTHING CHANGED. A value that differs on every
   * call (a counter, a fresh object, `Date.now()`) would also "fix" the failing
   * assertion while re-running this effect on every React Flow emission —
   * re-laying out the model under a reader, which the hook's own doctrine calls
   * a worse defect than the overlap. Both directions are pinned by
   * `useMeasureThenLayout.heightSubscription.spec.tsx`.
   */
  const measuredHeightSignature = useReactFlowStore((s) => {
    let signature = ''
    for (const [id, node] of s.nodeLookup) {
      signature += `${id}:${node.measured?.height ?? 0};`
    }
    return signature
  })

  // Deadline (ms since epoch) for the fallback timer; survives effect re-runs.
  const fallbackDeadlineRef = useRef<number | null>(null)

  // True while a committed layout is known to have been computed against
  // DEFAULT_NODE_HEIGHT for at least one node. Cleared by the corrective pass
  // below, and by any later layout that ran with complete measurement.
  const laidOutWithFallbackRef = useRef(false)

  // The measured height each node had when the last layout was committed.
  // `layoutGraph` sizes every canonical row as (tallest card in that row +
  // layerSpacing), so once a card is TALLER than the height that row was
  // computed against, it overlaps the row beneath. Recording the heights is
  // what makes that detectable without re-running the layout to find out.
  const laidOutHeightsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const measured = allUnlockedNodesMeasured(storeNodes, nodeLookup)

    /** Measured height per unlocked node, right now. */
    const currentHeights = (): Map<string, number> => {
      const out = new Map<string, number>()
      for (const node of storeNodes) {
        if ((node.data as Record<string, unknown> | undefined)?.locked === true) continue
        const h = nodeLookup.get(node.id)?.measured?.height
        if (typeof h === 'number' && h > 0) out.set(node.id, h)
      }
      return out
    }

    /**
     * Has any node grown TALLER than the height the committed layout was
     * computed against?
     *
     * GROWTH ONLY, and the asymmetry is the whole point. A card that grew
     * overflows its row band and overlaps the row beneath — a real defect. A
     * card that SHRANK leaves extra whitespace, which is untidy and harms
     * nobody. Re-laying out on both would move the model under a reader for no
     * gain, and a model that re-arranges itself while you are reading it is a
     * worse defect than the overlap this exists to prevent.
     */
    const grownNodeId = (heights: Map<string, number>): string | null => {
      for (const [id, h] of heights) {
        const was = laidOutHeightsRef.current.get(id)
        if (was !== undefined && h - was > HEIGHT_GROWTH_TOLERANCE_PX) return id
      }
      return null
    }

    const decision = evaluateMeasurementGate({
      pendingLayout,
      layoutInProgress,
      nodesInitialized,
      storeNodes,
      allUnlockedNodesMeasured: measured,
    })

    // ⭐ THE FALLBACK LAYOUT IS NOT THE FINAL ANSWER.
    //
    // When the fallback timer fires, `layoutGraph` runs against
    // DEFAULT_NODE_HEIGHT for every unmeasured node. It sizes each canonical
    // row as (tallest card in the row + layerSpacing), so a uniform fallback
    // height produces a uniform row band, and every card taller than that band
    // overlaps the row beneath it. Before this correction that state was
    // TERMINAL: nothing re-ran layout when the real heights landed a moment
    // later, so the graph stayed overlapped until the user found Auto-arrange.
    //
    // The moment measurement completes, lay out once more against real heights.
    // Guarded on `!pendingLayout` because a pending request means the ordinary
    // path below is already about to lay out with those same measurements — the
    // flag is cleared there rather than corrected here, so the two cannot both
    // fire for one arrival.
    if (
      laidOutWithFallbackRef.current &&
      measured &&
      !layoutInProgress &&
      !pendingLayout
    ) {
      laidOutWithFallbackRef.current = false
      laidOutHeightsRef.current = currentHeights()
      handleLayoutWithRecovery(() => applyLayout({ skipHistory: true, initiatedBy: 'product' }))
      return
    }

    // ⭐ THE SAME DEFECT ARRIVES THROUGH A SECOND DOOR, AFTER ANALYSIS.
    //
    // The correction above handles a layout computed before the cards had
    // measured. It does nothing when the heights change LATER — and analysis
    // changes them: results add content to option and factor cards, so they
    // grow while their positions do not. Measured on an analysed model:
    // 5 overlapping pairs, up to 160x54px.
    //
    // Nothing in the analysis path asks for a re-layout. Enumerated at
    // `origin/staging`: `applyScenarioAnalysisRead.ts` contains zero
    // `setPendingLayout`/`applyLayout` calls, against two in
    // `applyDraftResult.ts` as a contrast control. So the graph keeps a
    // geometry computed for cards that no longer exist at that size.
    //
    // This corrects on GROWTH against the recorded heights, which subsumes
    // both doors under one rule — the row band was sized for a shorter card,
    // whatever made it taller.
    if (measured && !layoutInProgress && !pendingLayout && laidOutHeightsRef.current.size > 0) {
      const heights = currentHeights()
      const grown = grownNodeId(heights)
      if (grown !== null) {
        // Record BEFORE dispatching. The heights are already settled, so if the
        // layout is superseded mid-flight the recorded set still describes what
        // is on screen — and a node cannot re-trigger on the same growth.
        laidOutHeightsRef.current = heights
        handleLayoutWithRecovery(() => applyLayout({ skipHistory: true, initiatedBy: 'product' }))
        return
      }
    }

    if (decision === 'idle' || decision === 'blocked') {
      fallbackDeadlineRef.current = null
      return
    }

    const capturedId = layoutRequestId

    if (decision === 'run-now') {
      fallbackDeadlineRef.current = null
      // This layout has real heights, so there is nothing left to correct.
      laidOutWithFallbackRef.current = false
      laidOutHeightsRef.current = currentHeights()
      handleLayoutWithRecovery(() =>
        applyLayout({ skipHistory: true, requestId: capturedId, initiatedBy: 'product' }),
      )
      return
    }

    // 'wait-with-fallback' — deadline-based safety fallback that survives
    // effect re-renders.
    if (fallbackDeadlineRef.current === null) {
      fallbackDeadlineRef.current = Date.now() + LAYOUT_MEASUREMENT_FALLBACK_MS
    }
    const remaining = Math.max(0, fallbackDeadlineRef.current - Date.now())
    const timer = setTimeout(() => {
      // ⚠ `logger.warn`, NOT `console.warn`, and the difference is the whole
      // point of this line. Production strips console CALL EXPRESSIONS twice,
      // and the terser stanza is not mode-gated (`vite.config.ts:160`
      // `drop_console: true` applies to every `vite build`). Both match a
      // callee rooted at the global identifier `console`, so a raw
      // `console.warn` here compiles to NOTHING — the signal marking a layout
      // computed against DEFAULT_NODE_HEIGHT, which is the state that produced
      // the shipped canvas overlap, would be silent in exactly the build where
      // it matters. Measured at the BUILT BUNDLE, same source, same build,
      // only this call changed: console.warn → 0 chunks carry the message,
      // logger.warn → 1 chunk does. `logger` roots its sink at `globalThis`,
      // which neither stripper matches.
      //
      // The corrective pass above should follow this line; a fallback warning
      // with no correction after it is the signal to chase.
      logger.warn(
        '[layout] proceeding with fallback heights — some nodes not yet measured',
      )
      fallbackDeadlineRef.current = null
      // Committed against fallback heights — mark it for correction.
      laidOutWithFallbackRef.current = true
      handleLayoutWithRecovery(() =>
        applyLayout({ skipHistory: true, requestId: capturedId, initiatedBy: 'product' }),
      )
    }, remaining)
    return () => clearTimeout(timer)
  }, [
    pendingLayout,
    layoutInProgress,
    layoutRequestId,
    nodesInitialized,
    nodeLookup,
    // The dep that actually changes when a card's measured height changes;
    // `nodeLookup` alone does not, because React Flow mutates it in place.
    measuredHeightSignature,
    storeNodes,
    applyLayout,
  ])
}
