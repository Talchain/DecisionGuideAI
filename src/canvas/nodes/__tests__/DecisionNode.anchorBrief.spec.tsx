/**
 * ⭐⭐ THE ANCHOR NODE CARRIES THE USER'S BRIEF.
 *
 * Paul, 5 Sep 2026, on deployed UI `a9c2e050`: the root node of his model
 * showed a type word and the subtitle "Hover for this node's detail". His own
 * framing — the thing the whole model is about — was nowhere on it.
 *
 * ── WHAT WAS REFUTED FIRST, BECAUSE IT CHANGES WHAT THIS FILE IS FOR ───────
 *
 * The brief for this lane said the node "renders the literal word Question" and
 * asked for the hardcoded default / missing field / fallback behind it. Derived
 * at `cfea2216`: THERE IS NO SUCH PATH. The card's title is `data.label` and
 * nothing else (`BaseNode.tsx:132`), the card renders no type word anywhere,
 * and all six writers of a decision node's label default to the wire label
 * verbatim, `backendNode.id`, `Node <id>` or `Untitled`. `DECISION_NODE_LABEL`
 * ('Question') exists once in product code and all ten of its consumers are
 * TYPE-label surfaces — legend, add-node submenu, inspector, model-tab kind
 * column — none of which writes `node.data.label`. I re-derived the most
 * plausible remaining suspect myself: the add-node submenu passes only
 * `nt.type` to `addNodeAction`, which labels the new node `New ${type}`.
 *
 * So no UI change can turn that word into a brief, and this file does NOT claim
 * to. What it fixes is the half that IS ours and IS structurally true: the
 * user's brief never reached the canvas at all.
 *
 * ── THE HARD PART IS NOT SHOWING IT, IT IS NOT SHOWING THE WRONG ONE ───────
 *
 * `contextIntegrityStore` is written ONLY when the cold read returns
 * `status: 'graph'`. A freshly-minted scenario answers `absent`, so nothing is
 * written and nothing is cleared — the previous decision's brief simply stays.
 * That already shipped once as a P0 (the results panel rendered a PREVIOUS
 * decision's brief under "What you gave me", surviving reset-canvas → new brief
 * → draft → analysis → edit until a page reload) and was fixed by a POSITIVE
 * identity match at the point of use.
 *
 * A second reader of that store is a second surface asking the same question
 * with its own gate — the shape CLAUDE.md trap 21 says drifts apart. So the
 * load-bearing cases below are the NEGATIVE ones: stale id, null id, null
 * brief. A suite that only proved the fresh case renders would be green on the
 * P0 itself.
 *
 * CLAUDE.md trap 3: jsdom has no layout. These assert TEXT and the declared
 * attributes, and nothing here claims anything about pixels.
 *
 * ── WHICH TRUNCATION RULE THESE ASSERT ─────────────────────────────────────
 *
 * ⚠ THIS SECTION WAS REWRITTEN WHEN #1219 WAS MERGED INTO THIS BRANCH, AND THE
 * PREVIOUS VERSION OF IT PREDICTED EXACTLY THAT. This spec arrived on `staging`
 * with #1229, which was split out of PR #1219 at `52d7e1e7` and carried the
 * anchor brief ONLY. It therefore asserted `staging`'s truncation rule as it
 * then stood — cut at the last space past 60% of the measure, HARD cut when
 * there is none — and said, in the single-token case below, that it was
 * asserting the less good behaviour on purpose because "PR #1219 changes that
 * rule; this branch does not".
 *
 * #1219 has now been merged in, so this branch DOES carry that rewrite and the
 * rule beneath these cases is the new one: cut at the last space at or before
 * the measure; if the first word overruns, keep that whole word; if there is no
 * space at all, return the text WHOLE. The single-token case is re-bound to
 * that below rather than left to fail, because a spec asserting a rule the file
 * no longer has is a false record, not a guard.
 *
 * Measured across both rules on these exact fixtures, which is why only ONE
 * case moved: the 224-character prose BRIEF truncates byte-for-byte identically
 * under old and new, and the short brief is returned whole by both. Only the
 * unbroken-token case differs — 160 chars + ellipsis before, 200 chars whole
 * after.
 *
 * What makes the whole-token return acceptable at THIS call site is unchanged
 * from what #1229 wrote: the full text is on `title` and the height is bounded
 * by `line-clamp-3 break-words`. The brief never relied on the truncator for
 * its bound. The two `Top gap:` triage lines in the same file DO carry #1219's
 * trade, and they are pinned by `DecisionNode.triageTruncation.spec.tsx`, not
 * here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import {
  DecisionNode,
  DECISION_RESTING_COPY,
  DECISION_ANCHOR_BRIEF_COPY,
  ANCHOR_BRIEF_MAX_CHARS,
} from '../DecisionNode'
import { useContextIntegrityStore } from '../../stores/contextIntegrityStore'
import { useGuidanceStore } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

const hoisted = vi.hoisted(() => ({ state: null as any }))

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => unknown) => selector(hoisted.state)),
    { getState: () => hoisted.state },
  ),
}))

const DECISION_ID = 'decision-1'
const SCENARIO = 'f2b0c1a4-0000-4000-8000-000000000001'
const OTHER_SCENARIO = 'f2b0c1a4-0000-4000-8000-000000000002'

const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire three' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Hire none' } },
]
const optionEdges = [
  { id: 'e1', source: DECISION_ID, target: 'option-1', data: {} },
  { id: 'e2', source: DECISION_ID, target: 'option-2', data: {} },
]

/** A completed run with no owned leader claim — the exact shape that reaches
 *  `completedRunLine`, i.e. the slot Paul was looking at. */
const COMPLETED_RUN = {
  option_probabilities: {
    'option-1': { win_probability: 0.55 },
    'option-2': { win_probability: 0.45 },
  },
  robustness: { recommended_option_id: 'option-1', recommendation_stability: 0.62 },
}

const setStore = (overrides: Record<string, unknown> = {}) => {
  hoisted.state = {
    edges: optionEdges,
    nodes: [decisionNode, ...optionNodes],
    results: { status: 'complete', report: COMPLETED_RUN },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    viewMode: 'standard',
    currentScenarioId: SCENARIO,
    selectNodeWithoutHistory: vi.fn(),
    ...overrides,
  }
}

const baseProps = {
  id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0,
  data: { label: 'Should we hire a tech lead?', type: 'decision' },
}

const renderDecision = (overrides: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} {...(overrides as any)} />
    </ReactFlowProvider>,
  )

const BRIEF =
  'We are a 40-person B2B SaaS company and our platform team keeps missing delivery dates. ' +
  'I need to work out whether to hire two mid-level developers or one senior technical lead, ' +
  'given a budget of £180k and a 12-month runway.'

const setBrief = (scenarioId: string | null, briefText: string | null) =>
  useContextIntegrityStore.getState().setContextIntegrity({ scenarioId, briefText, manifest: null })

beforeEach(() => {
  vi.clearAllMocks()
  useContextIntegrityStore.getState().reset()
  setStore()
  // A conversation surface IS registered by default. The resting CTA is gated
  // on one existing, so a default of "none" would make the CTA-preservation
  // cases below pass for the wrong reason — they would assert the absence of a
  // button that was never going to render.
  useGuidanceStore.setState({
    _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(),
  } as any)
})

// ---------------------------------------------------------------------------

describe('the anchor node surfaces the brief it is about', () => {
  it('renders the brief, attributed, where the wayfinding line used to be', () => {
    setBrief(SCENARIO, BRIEF)
    renderDecision()

    // Positive control: the node rendered at all (CLAUDE.md trap 13).
    expect(screen.getByText('Should we hire a tech lead?')).toBeDefined()

    const block = screen.getByTestId('decision-node-brief')
    expect(block.textContent).toContain(DECISION_ANCHOR_BRIEF_COPY.heading)
    // The user's own opening words are on the card.
    expect(block.textContent).toContain('We are a 40-person B2B SaaS company')

    // And the vacuous line it replaces is gone.
    expect(screen.queryByText(DECISION_RESTING_COPY.completedRunLine)).toBeNull()
  })

  it('the FULL brief is recoverable — the ellipsis has somewhere to go', () => {
    setBrief(SCENARIO, BRIEF)
    renderDecision()

    const quote = screen.getByTestId('decision-node-brief-text')
    // Pin the precondition IN-TEST: this fixture must actually be long enough
    // to truncate, or "the full text is on `title`" is asserted about a case
    // where shown === full and proves nothing (trap 13b).
    expect(BRIEF.length).toBeGreaterThan(ANCHOR_BRIEF_MAX_CHARS)
    expect(quote.textContent).not.toBe(BRIEF)
    expect(quote.getAttribute('title')).toBe(BRIEF)
  })

  it('cuts ordinary prose at a word boundary, never inside a word', () => {
    setBrief(SCENARIO, BRIEF)
    renderDecision()

    const shown = screen.getByTestId('decision-node-brief-text').textContent ?? ''
    // Pin the precondition IN-TEST: if the fixture stopped reaching the
    // truncator this assertion would pass about a string that was never cut
    // (CLAUDE.md trap 13b).
    expect(BRIEF.length).toBeGreaterThan(ANCHOR_BRIEF_MAX_CHARS)
    expect(shown.endsWith('…')).toBe(true)

    // DERIVED, not restated: every word shown must be a whole word of the
    // brief. A mid-word clip fails this without the spec needing to know where
    // the cut lands, so the measure can move without editing this assertion.
    const words = shown.replace(/…$/, '').trim().split(/\s+/)
    const briefWords = BRIEF.split(/\s+/)
    expect(words.length).toBeGreaterThan(0)
    words.forEach((w, i) => expect(w).toBe(briefWords[i]))
  })

  it('a short brief is shown whole, with no ellipsis', () => {
    const short = 'Should we hire a tech lead or two developers?'
    expect(short.length).toBeLessThan(ANCHOR_BRIEF_MAX_CHARS)
    setBrief(SCENARIO, short)
    renderDecision()

    const quote = screen.getByTestId('decision-node-brief-text')
    expect(quote.textContent).toBe(short)
    expect(quote.textContent).not.toContain('…')
  })

  it('an unbroken token is returned WHOLE, not mutilated — and the box still bounds it', () => {
    /**
     * ⚠ THIS CASE ASSERTED THE OPPOSITE UNTIL #1219 WAS MERGED, AND THAT IS
     * RECORDED RATHER THAN QUIETLY SWAPPED. Under `staging`'s rule this token
     * came back as 160 characters plus an ellipsis, because the 0.6 heuristic
     * found no space to fall back to. #1219 replaced that rule with one that
     * never cuts inside a word, so a text containing no space at all is now
     * returned unchanged. The old expectation is not "still true, differently
     * spelled" — it is the behaviour this PR exists to remove.
     *
     * ⭐ THE PRECONDITION IS PINNED IN-TEST because the new expectation is
     * `shown === token`, which a truncator that had been deleted outright would
     * also satisfy (CLAUDE.md trap 13b). Asserting that the fixture genuinely
     * exceeds the measure proves the function had the opportunity to cut and
     * declined; the neighbouring prose case is the contrast that proves it still
     * cuts when there IS a word boundary, so the two together discriminate a
     * working truncator from an absent one.
     *
     * What bounds the box is unchanged and is still asserted: `line-clamp-3
     * break-words` on the blockquote, with the full text on `title`.
     */
    const token = 'A'.repeat(ANCHOR_BRIEF_MAX_CHARS + 40)
    setBrief(SCENARIO, token)
    renderDecision()

    const quote = screen.getByTestId('decision-node-brief-text')
    const shown = quote.textContent ?? ''

    // Precondition: the fixture must actually overrun the measure.
    expect(token.length).toBeGreaterThan(ANCHOR_BRIEF_MAX_CHARS)

    expect(shown).toBe(token)
    expect(shown).not.toContain('…')
    expect(quote.getAttribute('title')).toBe(token)
    expect(quote.className).toContain('line-clamp-3')
    expect(quote.className).toContain('break-words')
  })

  it('is never centred', () => {
    setBrief(SCENARIO, BRIEF)
    renderDecision()
    const block = screen.getByTestId('decision-node-brief')
    for (const el of [block, ...Array.from(block.querySelectorAll('*'))]) {
      expect(el.className).not.toContain('text-center')
      expect(el.className).not.toContain('mx-auto')
      expect((el as HTMLElement).style?.textAlign ?? '').not.toBe('center')
    }
  })
})

describe('⛔ the identity gate — the P0 twin, and the reason this file exists', () => {
  /**
   * Each of these is a state the store REACHES in production, not a defensive
   * hypothetical. `setContextIntegrity` runs only on `status: 'graph'`; every
   * other cold-read outcome leaves whatever was there before, and the draft
   * turn's `recordBriefForFreshDraft` writes only once the NEW decision's graph
   * has landed — so between reset-canvas and that landing the store still
   * holds the previous decision.
   */
  it('a brief recorded for ANOTHER decision never renders on this one', () => {
    setBrief(OTHER_SCENARIO, BRIEF)
    renderDecision()

    expect(screen.queryByTestId('decision-node-brief')).toBeNull()
    expect(screen.queryByText(/40-person B2B SaaS/)).toBeNull()
    // …and the honest fallback is restored rather than the body going empty,
    // which is the defect the resting state was built to fix.
    expect(screen.getByText(DECISION_RESTING_COPY.completedRunLine)).toBeDefined()
  })

  it('a recorded id of null does not pass the gate (a `!==` test would)', () => {
    setBrief(null, BRIEF)
    renderDecision()
    expect(screen.queryByTestId('decision-node-brief')).toBeNull()
  })

  it('a LIVE id of null does not pass the gate either', () => {
    setStore({ currentScenarioId: null })
    setBrief(null, BRIEF)
    renderDecision()
    expect(screen.queryByTestId('decision-node-brief')).toBeNull()
  })

  it('a matching id with no brief renders nothing rather than an empty quote', () => {
    setBrief(SCENARIO, null)
    renderDecision()
    expect(screen.queryByTestId('decision-node-brief')).toBeNull()
    expect(screen.getByText(DECISION_RESTING_COPY.completedRunLine)).toBeDefined()
  })

  it('a whitespace-only brief is treated as no brief', () => {
    setBrief(SCENARIO, '   \n  ')
    renderDecision()
    expect(screen.queryByTestId('decision-node-brief')).toBeNull()
  })
})

describe('the brief displaces only the content-free copy, never a CTA', () => {
  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN (CLAUDE.md trap 22b). Without these, a change
   * that rendered the brief on EVERY arm would be green — and it would have
   * silently swallowed the two lines that offer the user something to do.
   */
  it('keeps "No options linked yet" and its CTA when the brief is available', () => {
    setStore({ nodes: [decisionNode], edges: [], results: { status: 'idle', report: null } })
    setBrief(SCENARIO, BRIEF)
    renderDecision()

    expect(screen.getByText(DECISION_RESTING_COPY.noOptionsLine)).toBeDefined()
    expect(screen.getByTestId('decision-node-resting-cta').textContent)
      .toBe(DECISION_RESTING_COPY.noOptionsCta)
    expect(screen.queryByTestId('decision-node-brief')).toBeNull()
  })

  it('keeps "Not named yet" and its CTA when the brief is available', () => {
    setStore({ nodes: [decisionNode], edges: [], results: { status: 'idle', report: null } })
    setBrief(SCENARIO, BRIEF)
    renderDecision({ data: { type: 'decision' } })

    expect(screen.getByText(DECISION_RESTING_COPY.unnamedLine)).toBeDefined()
    expect(screen.queryByTestId('decision-node-brief')).toBeNull()
  })
})

describe('the brief is kept OUT of the honesty-guarded resting subtree', () => {
  /**
   * ⭐ NOT A LAYOUT PREFERENCE — A GUARD-INTEGRITY ONE.
   *
   * `DecisionNode.restingState.spec.tsx` walks `decision-node-resting-state`
   * and forbids `lead|winner|robust|scenario|result|analysis|confiden|likel|
   * probab|decisions?|questions?`, because PRODUCT copy there must never
   * describe a finding the producer did not state. A user's brief may contain
   * every one of those words legitimately. Rendering it inside that subtree
   * would have forced the guard to be weakened to accommodate text it was never
   * written about — blunting a real honesty check.
   */
  it('a brief full of the guard\'s forbidden words renders, and not inside the guarded subtree', () => {
    const loaded = 'Which decision is most likely to lead to a robust result? Probably the analysis question.'
    setBrief(SCENARIO, loaded)
    renderDecision()

    expect(screen.getByTestId('decision-node-brief-text').textContent).toBe(loaded)
    expect(screen.queryByTestId('decision-node-resting-state')).toBeNull()
  })

  it('the two testids are siblings, never nested', () => {
    setStore({ nodes: [decisionNode], edges: [], results: { status: 'idle', report: null } })
    setBrief(SCENARIO, BRIEF)
    const { container } = renderDecision()

    const resting = container.querySelector('[data-testid="decision-node-resting-state"]')
    expect(resting).not.toBeNull()
    // The brief is absent on this arm; the structural claim is that IF both
    // ever render, neither contains the other.
    expect(resting!.querySelector('[data-testid="decision-node-brief"]')).toBeNull()
  })
})
