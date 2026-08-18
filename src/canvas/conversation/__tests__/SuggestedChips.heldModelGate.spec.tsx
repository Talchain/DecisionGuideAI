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

  it('agrees with canRunAnalysis: whenever the run gate refuses for the hold, the chip is absent', async () => {
    const { canRunAnalysis } = await import('../../utils/canRunAnalysis')
    const { analysisHeldOn } = await import('../../utils/analysisHeldOnInjectedModel')

    setReady('ready')
    setNodes(STARTER_NODES)

    const heldOn = analysisHeldOn(STARTER_NODES)
    expect(heldOn).toBe('starter') // precondition PINNED in-test (trap 13b)

    const gate = canRunAnalysis({
      graphHealth: { errors: [], warnings: [] },
      readiness: { status: 'ready' },
      hasBlockers: false,
      nodeCount: STARTER_NODES.length,
      analysisHeldOn: heldOn,
    } as any)
    expect(gate.allowed).toBe(false) // the Analyse control refuses …

    renderChips([makeChip({ id: 'coherent', action_type: 'run_analysis' })])
    expect(screen.queryByTestId('suggested-chip-coherent')).toBeNull() // … and so does the chip
  })
})
