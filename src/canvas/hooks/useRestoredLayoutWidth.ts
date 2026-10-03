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
 * hand. This hook changes how wide a card DRAWS; it never moves a node — with
 * ONE exception, the Canvas owner's (27 Sep 2026): a row saved too tight for the
 * narrowest drawable card is re-spread, because no width can clear it (see
 * `respreadSubFloorRows` below). Every row that fits stays exactly as saved.
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
import { applyRespreadX, planSubFloorRespread, solveLayoutNodeWidth, solveRestoredCardWidths } from '../utils/layout'
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
  // ⚠ NEEDED BY THE PER-KIND DERIVATION AND NOT BY THE SINGLE ONE. A tier's
  // width is bounded by its share of the WIDEST ROW, and a row's width counts
  // the gaps between its cards — so unlike `solveLayoutNodeWidth`, the per-kind
  // solver is a function of node spacing too. It persists with the rest of the
  // layout options, so it still survives a reload.
  const nodeSpacing = useLayoutStore((s) => s.nodeSpacing)

  const derivedForRef = useRef<string | null>(null)
  /**
   * ⭐⭐ A SECOND LATCH, BECAUSE THE TWO DERIVATIONS HAVE DIFFERENT PRECONDITIONS.
   *
   * The single width is a pure function of the node set and needs no measurement.
   * The PER-KIND bound is measured against the saved positions and is only as good
   * as the height information available when it runs — and `shareARow` falls back
   * to a tolerance when heights are absent.
   *
   * Sharing one latch meant the per-kind bound could be computed in a pre-measure
   * pass and then NEVER recomputed, because `derivedForRef` was already set. That
   * is Codex's P2 on #1608, and it is permanent for the session rather than
   * transient. Latching separately lets the single width land immediately while
   * the bound waits for the evidence it actually needs.
   */
  const perKindDerivedForRef = useRef<string | null>(null)

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

    // The FULL node array, exactly as `applyLayout` passes it to `layoutGraph`
    // (`store.ts:3304`) — a filtered set here would answer about a different
    // graph than the one whose positions are on screen.
    if (derivedForRef.current !== key) {
      derivedForRef.current = key
      const derived = solveLayoutNodeWidth(nodes, { direction, preserveLocked: respectLocked })
      if (derived !== useLayoutStore.getState().layoutNodeWidth) {
        useLayoutStore.getState().setLayoutNodeWidth(derived)
      }
    }

    /**
     * ⛔⛔ THE PER-KIND WIDTHS TOO — AND LEAVING THIS OUT WAS THE SAME DEFECT
     * THIS HOOK EXISTS TO REPAIR, ONE LEVEL UP.
     *
     * `layoutGraph` publishes `layoutCardWidths`; that handshake is session-only
     * for exactly the reason the header describes, so on a RESTORED board the
     * record read `null` and every card fell back to the single width. Measured
     * in the browser at `localhost:5178` before this line existed: decision
     * **327**, goal **336** — the widened Question card was on the wire, in the
     * store's type, in the render expression, and still not on screen, because
     * the one path a returning user actually takes never wrote it.
     *
     * ⭐ IT DERIVES RATHER THAN PERSISTS, for the header's reason unchanged: the
     * widths are a pure function of the tier occupancies, the direction,
     * `respectLocked` and the spacing — all four of which already survive a
     * reload. So they are already persisted, implicitly and exactly, and this
     * repairs every board saved before the change with no migration.
     */
    /**
     * ⛔⛔ BOUNDED BY THE SAVED POSITIONS — `solveRestoredCardWidths`, NOT
     * `solveLayoutCardWidths`. Found by independent review (Codex, 16 Sep 2026).
     *
     * The unbounded solver answers *"how wide would a FRESH layout draw this
     * tier"*. On this path the positions on screen came from an OLD layout, and
     * a per-tier width can be WIDER than the uniform one that board was laid out
     * at — so this hook, which exists to repair overlap by NARROWING a card to
     * its stride, began causing it. Executed contrast: 3 options at a saved
     * uniform 336 with a 56px gap, restored at 440, **gap -48**.
     *
     * ⭐ The header above already argued this, for the single-width limb, four
     * lines up: a width derived against unmoved positions *"would cause the very
     * overlap it exists to remove"*. That reasoning applies to BOTH limbs and was
     * applied to one — the sibling this estate keeps failing to sweep.
     */
    /**
     * ⛔⛔ THE BOUND WAITS FOR THE EVIDENCE IT IS MEASURED AGAINST.
     *
     * Codex's P2 on #1608: absent height metadata plus a larger manual stagger can
     * still overlap at restore. `shareARow` asks the direct question — do the two
     * cards overlap vertically — only where heights are KNOWN, and falls back to a
     * tolerance otherwise. A hand-dragged row staggered past that tolerance then
     * reads as separate rows and the bound lifts.
     *
     * ⚠ AND IT WAS PERMANENT, NOT TRANSIENT, WHICH IS THE PART THAT MADE IT WORTH
     * FIXING. React Flow populates `measured` after a render pass; this effect is
     * keyed on `nodes` and so can fire before that. With ONE latch it would compute
     * the bound from the tolerance and set the latch, and the later pass carrying
     * real heights would return at the guard. One pre-measure pass decided the
     * widths for the whole session.
     *
     * So the per-kind bound latches only once the cards have been measured —
     * every one of them, see below.
     * ⭐ If heights never arrive — jsdom, SSR, comparison mode — this simply never
     * runs, and the card falls back to the single width, which is the behaviour
     * that predates per-kind widths and cannot overlap. Absence degrades to the
     * old safe answer rather than to a guess.
     *
     * ⛔ THIS WAIT IS ONLY HONEST BECAUSE THE RESTORE BOUNDARY DROPS PERSISTED
     * `measured` (`withoutPersistedMeasurement`, edit-structure/F1). The autosave
     * used to carry every card's height from the previous session, so this check
     * passed before React Flow had measured anything, and the bound was computed
     * on heights taken at another width — the loop that kept a board at 191.
     */
    //
    // ⛔ AND IT WAITS FOR EVERY CARD, NOT ANY CARD (27 Sep 2026, measured in the
    // browser once the persisted heights were gone). Measurement arrives in
    // batches; with "any", the bound ran while the factors were still
    // unmeasured, every factor pair fell to `shareARow`'s no-evidence "same row",
    // the two sub-rows interleaved at half their stride, and a nudged
    // `build-vs-buy` drew every factor at the 191 floor. A hidden node is never
    // measured by React Flow, so it is not waited for — the same rule React
    // Flow's own `nodesInitialized` uses.
    //
    // ⚠ Read from the store's CURRENT nodes, like the re-spread and the widths
    // below (Delivery Lead, #2235 r1): one snapshot for the whole block, so the
    // evidence it waits for is the evidence it then uses.
    const live = useCanvasStore.getState().nodes
    const everyCardMeasured = live.every((n) => {
      if ((n as { hidden?: boolean }).hidden === true) return true
      const h = (n as unknown as { measured?: { height?: number } }).measured?.height
      return typeof h === 'number' && h > 0
    })
    if (!everyCardMeasured) return
    if (perKindDerivedForRef.current === key) return
    perKindDerivedForRef.current = key

    /**
     * ⭐ NO OVERLAP BEATS AN OLD STRIDE (Canvas owner, 27 Sep 2026, landing text
     * cap) — the ONE case where this hook moves nodes. A row saved at a stride
     * narrower than the narrowest drawable card plus the sibling gap cannot be
     * repaired by any width, so `planSubFloorRespread` re-spreads THAT row's
     * too-tight cards, each run about its median card (order and y kept; a card
     * already clear of its neighbours stays where the user put it); every row
     * that fits comes back as the same object. It runs here, once per restore, because it needs
     * every card measured to tell a row from its sub-rows.
     *
     * ⚠ NO WRITE OF ITS OWN. This sets the in-memory positions inside the
     * store's 'hydrate' mutation window (a producer write, not a user edit; a
     * direct `setState` pushes no history entry); it calls no save. What reaches storage is whatever the existing post-restore
     * saves already write — the same writes React Flow's first measurement of
     * the restored cards already triggers.
     */
    /**
     * ⛔⛔ FROM THE STORE AT EFFECT TIME, AND X ONLY — NEVER THE RENDER-TIME COPY
     * (Delivery Lead, #2235 r1). This used to write `setState({ nodes: restored })`
     * with `restored` built from `nodes`, the array this render closed over. A
     * store write landing between that render and this effect — the boot
     * readback merge, a measurement batch — was silently UNDONE by the whole-array
     * write, and the autosave then saved the older state. So the plan is read
     * from the store's CURRENT nodes, and the write is a functional update that
     * changes only the x of the cards the plan names, on whatever the store
     * holds at the moment of the write.
     */
    const movedX = planSubFloorRespread(live, { preserveLocked: respectLocked, spacing: nodeSpacing })
    if (movedX.size > 0) {
      const store = useCanvasStore.getState()
      store.beginExternalGraphMutation('hydrate')
      try {
        useCanvasStore.setState((s) => {
          const next = applyRespreadX(s.nodes, movedX)
          return next === s.nodes ? s : { nodes: next }
        })
      } finally {
        useCanvasStore.getState().endExternalGraphMutation()
      }
    }

    const derivedPerKind = solveRestoredCardWidths(useCanvasStore.getState().nodes, {
      direction,
      preserveLocked: respectLocked,
      spacing: nodeSpacing,
    })
    const current = useLayoutStore.getState().layoutCardWidths
    const changed =
      current === null ||
      Object.keys(derivedPerKind).some((k) => current[k] !== derivedPerKind[k]) ||
      Object.keys(current).length !== Object.keys(derivedPerKind).length
    if (changed) {
      useLayoutStore.getState().setLayoutCardWidths(derivedPerKind)
    }
  }, [nodes, layoutVersion, pendingLayout, layoutInProgress, scenarioId, direction, respectLocked, nodeSpacing])
}
