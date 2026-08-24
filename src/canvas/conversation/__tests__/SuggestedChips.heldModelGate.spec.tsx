/**
 * PoC DOMAIN 5 — the chat chip must read the SAME held-model authority every
 * other run affordance reads.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT (the domain's defining one: two surfaces, one run, two answers)
 * ═══════════════════════════════════════════════════════════════════════════
 * The `Run analysis` CHAT CHIP gated on `ceeAnalysisReady.status === 'ready'`
 * — CEE's verdict about its OWN persisted graph — while the Analyse control
 * gated on `analysisHeldOn(nodes)`, the client's verdict about whether the
 * graph ON THIS CANVAS is one CEE ever received.
 *
 * ⭐ THEY ANSWER DIFFERENT QUESTIONS, and that is why aligning their defaults
 * would have been the wrong fix (trap 21). Named apart:
 *
 *   `ceeAnalysisReady.status`  "is CEE's persisted model READY to analyse?"
 *   `analysisHeldOn(nodes)`    "is the model on this canvas one CEE has
 *                               NEVER RECEIVED?"
 *
 * Both are preconditions of the chip's PROMISE, which is neither of those
 * questions but a third: *"if I click this, do I get an analysis of the model
 * I am looking at?"* On a client-injected graph the first can be `ready` while
 * the second is non-null — CEE is ready to analyse a DIFFERENT graph. The chip
 * ran, the button refused, and the results named nodes absent from the canvas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A WIRING FIX AND NOT A NEW AUTHORITY (the lead question)
 * ═══════════════════════════════════════════════════════════════════════════
 * It introduces NO derived value. `analysisHeldOn` is already THE one authority
 * for this fact and already has readers: `canRunAnalysis` (the Analyse control,
 * via `OutputsDock` and `ConversationPanel`) and `StarterProvenanceBanner`.
 * Every OTHER run affordance in the product routes through `executeCanonicalRun`,
 * which applies that gate — node chips, the command palette, the actions menu,
 * the inspector inline rerun, the define-success modal. The chat chip was the
 * LAST run affordance that did not. Adding a reader of one authority is the
 * fix; minting a second derivation would have been the defect.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE NAMED TRAP, MEASURED RATHER THAN ASSUMED
 * ═══════════════════════════════════════════════════════════════════════════
 * "Gating chip visibility on the client hold risks suppressing legitimate live
 * runs." Derived at the bytes, and it does not:
 *   · `analysisHeldOn` is non-null only when a node carries `data.starterId`
 *     or `data.templateId` AND the run routes through the V5 canonical path;
 *   · those stamps are written in exactly three places — `loadStarter.ts:155`,
 *     `useBlueprintInsert.ts:78`, `ReactFlowGraph.tsx:1280` — and NO CEE draft
 *     path writes either;
 *   · the re-draft affordance calls `resetCanvas()` and replaces the graph, so
 *     the stamp disappears exactly when CEE gains the model.
 * So on a CEE-drafted model the hold is null and this gate is inert. That claim
 * is not left to prose: every suppression case below has an OPPOSITE-DIRECTION
 * TWIN asserting the chip still renders (trap 22b — a corpus that tests one
 * direction is a guard watching one door).
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { SuggestedChips } from '../zones/SuggestedChips'

// Mocked so the dev-log counter assertion (case 9) can observe emissions.
// `importOriginal` is spread so every OTHER export stays real — a bare factory
// REPLACES the module and silently removes anything it forgets (trap 12).
vi.mock('../../../v5/debugLog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/debugLog')>()),
  logV5StateEvent: vi.fn(),
}))
import { useCanvasStore } from '../../store'
import type { ActionChip } from '../types'

/** A node the way the canvas store holds one. */
function node(id: string, data: Record<string, unknown> = {}) {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id, ...data } }
}

/** CEE-drafted graph: no client-injection stamp anywhere. THE CONTRAST CONTROL. */
const DRAFTED_NODES = [node('n1'), node('n2')]
/** Starter graph: `applyStarter` stamps EVERY node. */
const STARTER_NODES = [node('n1', { starterId: 'pricing' }), node('n2', { starterId: 'pricing' })]
/** Template insert: `insertBlueprint` stamps every node it adds. */
const TEMPLATE_NODES = [node('n1', { templateId: 'tmpl_1' }), node('n2', { templateId: 'tmpl_1' })]

function makeChip(overrides: Partial<ActionChip> = {}): ActionChip {
  return {
    id: overrides.id ?? 'chip_1',
    label: 'Run analysis',
    intent: 'primary',
    message: 'Please run the analysis now',
    ...overrides,
  }
}

function setNodes(nodes: ReturnType<typeof node>[]) {
  useCanvasStore.setState({ nodes: nodes as any })
}

function setReady(status: string | null) {
  const payload = status
    ? {
        goal_node_id: 'goal_1',
        status,
        options: [{ id: 'opt_1', label: 'A', status: 'ready', interventions: {} }],
      }
    : null
  useCanvasStore.setState({ ceeAnalysisReady: payload as any })
}

/** Drive the polish input exactly as `SuggestedChips.aiPanelV2Polish.spec` does. */
function setStalePriorAnalysis() {
  useCanvasStore.setState({
    results: { status: 'complete', graphHash: 'abc123' } as any,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  })
  useCanvasStore
    .getState()
    .setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
}

function clearAnalysis() {
  useCanvasStore.setState({
    results: { status: 'idle' } as any,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  })
}

function renderChips(chips: ActionChip[]) {
  render(<SuggestedChips chips={chips} onChipClick={vi.fn()} />)
}

describe('SuggestedChips — the held-model gate (PoC domain 5)', () => {
  beforeEach(() => {
    // The canonical run path is the hold's second conjunct. `v5CanonicalAnalysis`
    // is a makeFlag that snapshots import.meta.env at module load, so
    // localStorage is the only runtime-mutable override (the idiom the polish
    // spec established for `feature.aiPanelV2`).
    try {
      localStorage.setItem('feature.v5CanonicalAnalysis', 'true')
    } catch {
      /* jsdom without storage — the assertions below would fail loudly */
    }
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
    setNodes(DRAFTED_NODES)
    setReady(null)
    clearAnalysis()
  })

  afterEach(() => {
    cleanup()
    try {
      localStorage.removeItem('feature.v5CanonicalAnalysis')
      localStorage.removeItem('feature.aiPanelV2')
    } catch {
      /* no-op */
    }
    vi.unstubAllEnvs()
    setNodes([])
    setReady(null)
    clearAnalysis()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 1. THE DEFECT ITSELF — CEE says ready about its own graph; the canvas holds
  //    a graph CEE never received.
  // ───────────────────────────────────────────────────────────────────────────

  it('hides the run_analysis chip on a STARTER graph even when CEE reports ready', () => {
    setReady('ready')
    setNodes(STARTER_NODES)
    renderChips([makeChip({ id: 'held_starter', action_type: 'run_analysis' })])
    expect(screen.queryByTestId('suggested-chip-held_starter')).toBeNull()
  })

  it('hides the run_analysis chip on a TEMPLATE-inserted graph even when CEE reports ready', () => {
    setReady('ready')
    setNodes(TEMPLATE_NODES)
    renderChips([makeChip({ id: 'held_template', action_type: 'run_analysis' })])
    expect(screen.queryByTestId('suggested-chip-held_template')).toBeNull()
  })

  it('⭐ OPPOSITE-DIRECTION TWIN: still SHOWS the chip on a CEE-drafted graph when ready', () => {
    setReady('ready')
    setNodes(DRAFTED_NODES)
    renderChips([makeChip({ id: 'drafted_ok', action_type: 'run_analysis' })])
    expect(screen.getByTestId('suggested-chip-drafted_ok')).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 2. THE BYPASS. `relabel-rerun` lets a run_analysis chip survive the
  //    readiness gate. A rerun against a graph CEE never received is exactly as
  //    wrong as a first run, so the hold must defeat the bypass too — this is
  //    the case a gate placed downstream of the polish would MISS.
  // ───────────────────────────────────────────────────────────────────────────

  it('hides the chip on a held graph even via the relabel-rerun readiness-gate BYPASS', () => {
    try {
      localStorage.setItem('feature.aiPanelV2', 'true')
    } catch {
      /* no-op */
    }
    setReady('needs_encoding') // NOT ready — only the bypass could show this chip
    setStalePriorAnalysis() // → 'changed' semantic → relabel-rerun → bypass
    setNodes(STARTER_NODES)
    renderChips([makeChip({ id: 'held_bypass', action_type: 'run_analysis' })])
    expect(screen.queryByTestId('suggested-chip-held_bypass')).toBeNull()
  })

  it('⭐ OPPOSITE-DIRECTION TWIN: the relabel-rerun bypass still works on a drafted graph', () => {
    try {
      localStorage.setItem('feature.aiPanelV2', 'true')
    } catch {
      /* no-op */
    }
    setReady('needs_encoding')
    setStalePriorAnalysis()
    setNodes(DRAFTED_NODES)
    renderChips([makeChip({ id: 'drafted_bypass', action_type: 'run_analysis' })])
    expect(screen.getByTestId('suggested-chip-drafted_bypass')).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 3. SCOPE. The hold refuses THE RUN, not the conversation. A gate that
  //    silenced every chip on a starter would suppress the very affordances the
  //    user needs to get OUT of the held state.
  // ───────────────────────────────────────────────────────────────────────────

  it('still shows a non-run chip (edit_graph) on a held graph', () => {
    setReady('ready')
    setNodes(STARTER_NODES)
    renderChips([makeChip({ id: 'edit_ok', action_type: 'edit_graph', label: 'Add an option' })])
    expect(screen.getByTestId('suggested-chip-edit_ok')).toBeInTheDocument()
  })

  it('still shows a conversational chip (no action_type) on a held graph', () => {
    setReady('ready')
    setNodes(STARTER_NODES)
    renderChips([makeChip({ id: 'chat_ok', label: 'What does this model assume?' })])
    expect(screen.getByTestId('suggested-chip-chat_ok')).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 4. THE LEGACY / PROMPT-ONLY AFFORDANCE. A chip with no `action_type` whose
  //    LABEL is "Run analysis" reaches CEE as a message CEE can route to a run,
  //    so the hold must cover it. Detected with the SAME detector the polish
  //    step already uses — no second predicate.
  // ───────────────────────────────────────────────────────────────────────────

  it('hides a prompt-only "Rerun analysis" affordance on a held graph', () => {
    setReady('ready')
    setNodes(STARTER_NODES)
    renderChips([makeChip({ id: 'held_prompt', label: 'Rerun analysis', message: 'Rerun analysis' })])
    expect(screen.queryByTestId('suggested-chip-held_prompt')).toBeNull()
  })

  it('⭐ OPPOSITE-DIRECTION TWIN: a prompt-only run affordance renders on a drafted graph', () => {
    setReady('ready')
    setNodes(DRAFTED_NODES)
    renderChips([makeChip({ id: 'drafted_prompt', label: 'Rerun analysis', message: 'Rerun analysis' })])
    expect(screen.getByTestId('suggested-chip-drafted_prompt')).toBeInTheDocument()
  })

  it('does NOT hide a conversational chip that merely mentions the analysis', () => {
    setReady('ready')
    setNodes(STARTER_NODES)
    renderChips([makeChip({ id: 'explain_ok', label: 'Explain the analysis', message: 'Explain the analysis' })])
    expect(screen.getByTestId('suggested-chip-explain_ok')).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 5. THE RUN-PATH CONJUNCT. Off the V5 canonical path a run sends the canvas
  //    graph directly, so the engine DOES see this model and the hold must not
  //    fire. Pinned so the gate cannot quietly become unconditional.
  // ───────────────────────────────────────────────────────────────────────────

  it('does NOT hold a starter graph when the canonical run path is OFF', () => {
    try {
      localStorage.setItem('feature.v5CanonicalAnalysis', 'false')
    } catch {
      /* no-op */
    }
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', '')
    setReady('ready')
    setNodes(STARTER_NODES)
    renderChips([makeChip({ id: 'v4_starter', action_type: 'run_analysis' })])
    expect(screen.getByTestId('suggested-chip-v4_starter')).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 6. THE DOMAIN CONTRACT, ASSERTED DIRECTLY: the chip and the Analyse control
  //    must not disagree about the same run. This binds the chip's visibility to
  //    the AUTHORITY ITSELF rather than to a value predicate that a second fact
  //    could satisfy (trap 19) — if `SuggestedChips` ever re-derives the hold
  //    from its own read of `nodes`, this stays green while the pair above still
  //    catches a wrong answer; if the chip stops consulting the authority at
  //    all, this goes red for the right reason.
  // ───────────────────────────────────────────────────────────────────────────

  it('agrees with canRunAnalysis: the gate refuses FOR THE HOLD, and the chip is absent', async () => {
    const { canRunAnalysis } = await import('../../utils/canRunAnalysis')
    const { analysisHeldOn, ANALYSIS_HELD_NOTICE } = await import(
      '../../utils/analysisHeldOnInjectedModel'
    )

    setReady('ready')
    setNodes(STARTER_NODES)

    const heldOn = analysisHeldOn(STARTER_NODES)
    expect(heldOn).toBe('starter') // precondition PINNED in-test (trap 13b)

    // ⚠ THE FIRST DRAFT OF THIS CASE WAS VACUOUS, and the way it was vacuous is
    // worth keeping in view. Its fixture was `readiness: { status: 'ready' }`,
    // but `canRunAnalysis` reads `can_run_analysis` — so `readinessObjectsToRun`
    // fired on the MISSING field and `allowed` was false whether or not the
    // model was held. The test agreed with the fix for a reason that had nothing
    // to do with the fix. A gate that refuses for the wrong reason is not
    // evidence about the hold (trap 13b).
    //
    // Fixed two ways, and BOTH are needed: the fixture now uses the real field
    // names, and the assertion binds to the REASON rather than to the boolean,
    // so only a refusal that is actually the hold can satisfy it.
    const params = {
      graphHealth: { issues: [] },
      readiness: { can_run_analysis: true },
      hasBlockers: false,
      nodeCount: STARTER_NODES.length,
    }

    const held = canRunAnalysis({ ...params, analysisHeldOn: heldOn } as never)
    expect(held.allowed).toBe(false)
    expect(held.reason).toBe(ANALYSIS_HELD_NOTICE.starter) // …refused FOR THE HOLD

    // ⭐ CONTRAST CONTROL, in the same run: the identical fixture with no hold
    // must be ALLOWED. Without this the case could pass on any refusal at all.
    const notHeld = canRunAnalysis({ ...params, analysisHeldOn: null } as never)
    expect(notHeld.allowed).toBe(true)

    renderChips([makeChip({ id: 'coherent', action_type: 'run_analysis' })])
    expect(screen.queryByTestId('suggested-chip-coherent')).toBeNull() // chip agrees
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 7. THE ESCAPE ROUTES MUST SURVIVE THE HOLD. A reviewer's mutant that also
  //    silenced these SURVIVED 12/12 — the routes were present but UNPINNED, so
  //    a future tightening could strand the user on a held model with a green
  //    suite. `start_new_draft` is id-routed and carries no message, which is
  //    exactly the shape a label/message-based filter would swallow.
  // ───────────────────────────────────────────────────────────────────────────

  it('still shows draft_graph on a held graph — re-drafting is the way OUT of the hold', () => {
    setReady('ready')
    setNodes(STARTER_NODES)
    renderChips([makeChip({ id: 'draft_ok', action_type: 'draft_graph', label: 'Re-draft this live' })])
    expect(screen.getByTestId('suggested-chip-draft_ok')).toBeInTheDocument()
  })

  it('still shows the id-routed start_new_draft chip (no message) on a held graph', () => {
    setReady('ready')
    setNodes(STARTER_NODES)
    render(
      <SuggestedChips
        chips={[{ id: 'start_new_draft', label: 'Start a new draft', intent: 'primary' } as ActionChip]}
        onChipClick={vi.fn()}
      />,
    )
    expect(screen.getByTestId('suggested-chip-start_new_draft')).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 8. ⭐ KNOWN-DROPPED, PINNED AS AN EXACT SET rather than left invisible.
  //
  //    `RUN_ANALYSIS_RE` is ANCHORED (`^(?:run|rerun)\s+(?:the\s+)?analysis\.?$`),
  //    deliberately, so conversational chips like "Explain the analysis" survive.
  //    The cost is that a chip with NO `action_type` whose message merely
  //    CONTAINS a run request is not suppressed by the hold.
  //
  //    Widening the regex is the wrong trade: it is the same predicate that
  //    protects the conversational chips, and loosening it to catch this case
  //    re-opens the opposite harm (trap 22b — one predicate, two opposite
  //    harms). So the gap is recorded HERE, as an exact set, and this test REDs
  //    if the set grows OR shrinks. A gap in the suite is honest; a gap the
  //    suite cannot see is how four rounds of oscillation happen.
  //
  //    ⚠ Residual harm is bounded, not zero: such a chip sends an ordinary
  //    conversational turn, and an LLM-elected `run_analysis` is now itself
  //    gated server-side by CEE's analysis-election gate.
  // ───────────────────────────────────────────────────────────────────────────

  it('KNOWN-DROPPED: an unanchored run request with no action_type is NOT suppressed', () => {
    setReady('ready')
    setNodes(STARTER_NODES)
    renderChips([
      makeChip({ id: 'known_dropped', label: 'Run analysis now', message: 'Please run the analysis now' }),
    ])
    // Documented gap, asserted as CURRENT behaviour so a change is visible.
    expect(screen.getByTestId('suggested-chip-known_dropped')).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 9. ⭐ THE M7-ANALOGUE NON-EQUIVALENCE, DEMONSTRATED RATHER THAN CLAIMED.
  //
  //    Mutant M7 showed that applying this filter DOWNSTREAM is behaviourally
  //    equivalent for VISIBILITY. The source comment justifies the upstream
  //    position by saying the dev-log counters operate on the admissible set —
  //    and per the estate's own rule a NON-equivalence must be demonstrated too,
  //    or the claim dropped. This is the demonstration: a held run chip must not
  //    be reported as "removed for unreadiness", because it was not.
  // ───────────────────────────────────────────────────────────────────────────

  it('does not mis-report a HELD chip as removed-for-unreadiness in the dev log', async () => {
    const { logV5StateEvent } = await import('../../../v5/debugLog')
    const spy = vi.mocked(logV5StateEvent)
    spy.mockClear()

    setReady('needs_encoding') // not ready → the unready counter is live
    setNodes(STARTER_NODES)
    renderChips([makeChip({ id: 'held_devlog', action_type: 'run_analysis' })])

    const unready = spy.mock.calls.filter((c) => c[0] === 'chip_filter_unready')
    expect(unready).toHaveLength(0)

    // ⭐ POSITIVE CONTROL, without which the assertion above is vacuous: the
    // counter must actually FIRE for a chip that really was dropped for
    // unreadiness. An absence proves nothing until the probe has shown it can
    // see a presence (trap 13) — and if `import.meta.env.DEV` were false here,
    // or the mock were not wired, this control would fail rather than let the
    // absence pass silently.
    cleanup()
    spy.mockClear()
    setNodes(DRAFTED_NODES) // not held → the hold cannot be the reason
    renderChips([makeChip({ id: 'unready_devlog', action_type: 'run_analysis' })])
    const fired = spy.mock.calls.filter((c) => c[0] === 'chip_filter_unready')
    expect(fired).toHaveLength(1)
  })
})
