/**
 * ⭐⭐ GIVE A RESTORED MODEL THE CARD WIDTH ITS OWN POSITIONS WERE COMPUTED FOR.
 *
 * THE DEFECT. `layoutGraph` places nodes on a stride derived from a card width
 * and reports that width back; `applyLayout` publishes it via
 * `layoutStore.setLayoutNodeWidth` (`store.ts:3329` — the field's ONLY writer)
 * and `BaseNode.tsx:460` sizes the card with
 * `maxWidth ?? layoutNodeWidth ?? NODE_CARD_MAX_W`. That handshake is
 * SESSION-ONLY: `setLayoutNodeWidth` does not persist. So on reload the store
 * reads `null` and every card renders at the MAXIMUM — cards laid out at 230px
 * come back at 320px, 90px wider than the stride beneath them, and same-row
 * neighbours overlap.
 *
 * ⚠ AND NOTHING CORRECTS IT, BY CONSTRUCTION — which is why it is permanent
 * rather than a transient. A restored graph arrives through `hydrateGraphSlice`
 * / `loadScenario` with REAL positions, so:
 *   - `useInitialLayoutGuard` fires only when `graphNeedsInitialLayout()` is
 *     true (both spreads < 40px, i.e. stacked at the origin) — never here;
 *   - therefore `pendingLayout` stays false, the measurement gate stays 'idle',
 *     `run-now` never runs, `useMeasureThenLayout`'s `laidOutHeightsRef` stays
 *     EMPTY, and its growth correction's `laidOutHeightsRef.current.size > 0`
 *     guard (`useMeasureThenLayout.ts:150`) is false for the whole session.
 * All three corrective branches are unreachable. Measured over 30s on a
 * reloaded scenario: overlapping pairs constant, `layoutVersion` 0, zero hook
 * branches, zero `applyLayout` calls.
 *
 * ⭐ WHY THIS DERIVES RATHER THAN RESTORING A PERSISTED VALUE. The width is not
 * independent information — it is a pure function of the widest tier's size, the
 * direction and `preserveLocked`, and of nothing else (see
 * `solveLayoutNodeWidth`, measured exact in 288/288 cells). All three inputs
 * already survive a reload: the nodes in the autosave, `direction` and
 * `respectLocked` in the layout store's own persisted options. So the width is
 * ALREADY persisted, implicitly and exactly. Writing a copy of it beside its own
 * inputs would be the hand-maintained mirror this estate keeps paying for
 * (CLAUDE.md trap 12) — and, decisively, it would repair NOTHING already saved:
 * every scenario written before such a change would still carry no width and
 * still overlap. Deriving repairs all of them, with no migration.
 *
 * ⚠ WHAT THIS DELIBERATELY DOES NOT DO — a re-layout. Re-laying out on load
 * would mask the cause and re-arrange geometry a user may have positioned by
 * hand. This hook changes how wide a card DRAWS; it never moves a node.
 *
 * ── THE TWO LATCHES, AND WHY EACH IS LOAD-BEARING ──────────────────────────
 *
 * `layoutVersion === 0` — A LAYOUT THAT HAS RUN IS THE AUTHORITY, ALWAYS.
 * `layoutVersion` is written in exactly one place (`applyLayout`'s success
 * commit) and never reset, so `> 0` means "this session laid this model out and
 * published a width". Re-deriving then would be wrong, not merely redundant:
 * after an edit that changes the widest tier WITHOUT a re-layout (add a 7th
 * factor to a 6-wide tier) the derived width would be 230 while the positions on
 * screen are still on the 320 stride — the fix would cause the very overlap it
 * exists to remove. This guard also makes the hook structurally incapable of
 * touching the FRESH-DRAFT path, where `applyLayout` always runs.
 *
 * `restoreIdentityKey` — ONCE PER RESTORED MODEL, not once per structure.
 * Shared with the camera's restore trigger rather than restated (trap 12), and
 * deliberately NOT `getGraphIdentityKey`, which hashes node/edge ids and so
 * re-arms on every add, delete and paste — turning each user edit into a width
 * change against unmoved geometry. Keyed on the scenario, a reload that lands on
 * X and is then switched to Y re-derives for Y, because that is a new restore.
 *
 * ⚠ KNOWN, NAMED, AND OUT OF SCOPE: draft-a-graph (so `layoutVersion > 0`) and
 * THEN open a saved scenario in the same session. The first guard bounces it and
 * the restored model keeps the draft's width. That is the store field being a
 * global rather than per-model — a pre-existing staleness this hook neither
 * introduces nor fixes, and it is not the reload defect. Reload, and
 * reload-then-switch, are both covered (nothing sets `layoutVersion` on a
 * restore path).
 */
import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useLayoutStore } from '../layoutStore'
import { solveLayoutNodeWidth } from '../utils/layout'
import { graphNeedsInitialLayout } from '../utils/graphNeedsInitialLayout'
import { restoreIdentityKey } from './useFitViewOnLayoutVersion'

export function useRestoredLayoutWidth(): void {
  // Selected individually and as stable references / primitives — a selector
  // returning a fresh object here is the React #185 shape `ci:guard:zustand`
  // exists to catch.
  const nodes = useCanvasStore((s) => s.nodes)
  const layoutVersion = useCanvasStore((s) => s.layoutVersion)
  const pendingLayout = useCanvasStore((s) => s.pendingLayout)
  const layoutInProgress = useCanvasStore((s) => s.layoutInProgress)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const direction = useLayoutStore((s) => s.direction)
  const respectLocked = useLayoutStore((s) => s.respectLocked)

  const derivedForRef = useRef<string | null>(null)

  useEffect(() => {
    // A layout has run: its published width is the authority. See the header.
    if (layoutVersion > 0) return
    // A layout is about to replace every position; the width it publishes will
    // be the right one, and deriving now would be answering about a graph that
    // is already obsolete.
    if (pendingLayout || layoutInProgress) return
    if (nodes.length === 0) return
    // Stacked at the origin is a FRESH graph whose layout is on its way — the
    // same predicate `useInitialLayoutGuard` uses to claim it. Not our case.
    if (graphNeedsInitialLayout(nodes)) return

    const key = restoreIdentityKey(scenarioId)
    if (derivedForRef.current === key) return
    derivedForRef.current = key

    // The FULL node array, exactly as `applyLayout` passes it to `layoutGraph`
    // (`store.ts:3304`) — a filtered set here would answer about a different
    // graph than the one whose positions are on screen.
    const derived = solveLayoutNodeWidth(nodes, { direction, preserveLocked: respectLocked })
    if (derived !== useLayoutStore.getState().layoutNodeWidth) {
      useLayoutStore.getState().setLayoutNodeWidth(derived)
    }
  }, [nodes, layoutVersion, pendingLayout, layoutInProgress, scenarioId, direction, respectLocked])
}
