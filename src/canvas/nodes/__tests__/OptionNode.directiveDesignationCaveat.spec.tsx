/**
 * ⭐⭐ THE HIGHLIGHT NOW SAYS WHAT IT IS — PAUL'S RULING, 8 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, MEASURED ON DEPLOYED STAGING (PR #1284)
 * ═══════════════════════════════════════════════════════════════════════════
 * Inside ONE HTTP 200 the assistant text said "No single option can be put
 * forward yet" (twice) while a `ui_directive` told the canvas to highlight the
 * front-running option, and the canvas obeyed.
 *
 * The card itself was already honest: under a refused licence `isRecommended`
 * is false, so the "Most supported" pill and the robustness badge both
 * withhold, and `DecisionNode`'s headline returns `null`. That CORRECT SILENCE
 * is exactly what made the highlight a silent claim — a visual designation with
 * nothing on screen admitting a claim was being made.
 *
 * #1284 removed the highlight. Paul kept the diagnosis and rejected the remedy:
 *
 *   > "Keep the highlight. Add on-screen text that admits the claim is being
 *   >  made and states its uncertainty. The caveat must be VISIBLE, not
 *   >  carried by the animation."
 *
 * This suite drives the CARD, because the card is where the sentence has to
 * appear. It binds by IDENTITY — `directive-designation-caveat-${id}` and the
 * register's exact string — never "some element mentioning Olumi" (trap 19).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ THE SCOPE LIMIT OF THIS EVIDENCE, STATED RATHER THAN LEFT TO A READER
 * ═══════════════════════════════════════════════════════════════════════════
 * jsdom performs NO LAYOUT (trap 3). Every assertion here is about what is
 * MOUNTED and what it READS. Nothing in this file is evidence that the sentence
 * is legible at canvas zoom, that it fits the card without pushing content out,
 * or that it is above the fold — those are BROWSER claims and none is made.
 * What IS structural, and is asserted: the caveat sits in Layer 1 (the
 * always-rendered body), not behind the Detailed/popover disclosure, so it
 * cannot be hidden by the default view mode.
 *
 * ⚠ AND ONE FURTHER LIMIT. The store is driven directly here. The applicator's
 * side of the contract — that it writes this slice ONLY inside the licence gate
 * and rewrites it every non-stale turn — is proven in
 * `src/v5/__tests__/applyV5State.uiDirectiveLeaderEntitlement.spec.ts`, not
 * here. Neither suite alone shows the chain; both are named so the seam between
 * them is visible instead of assumed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { OptionNode } from '../OptionNode'
import {
  DIRECTIVE_DESIGNATION_CAVEAT_COPY,
  useDirectiveDesignationStore,
} from '../../stores/directiveDesignationStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

import { useCanvasStore } from '../../store'

const NODE_ID = 'option-1'
const SIBLING_ID = 'option-2'

/**
 * The run under test: separated arms, this card the front-runner. Q2 is
 * therefore TRUE, so anything that withholds below is Q1's doing alone — the
 * same shape `OptionNode.withheldLeaderClaim.spec.tsx` drives.
 */
function separatedReport() {
  return {
    option_probabilities: {
      [NODE_ID]: { win_probability: 0.72 },
      [SIBLING_ID]: { win_probability: 0.23 },
    },
    robustness: { recommended_option_id: NODE_ID, near_tie: { is_tie: false, top_option_id: NODE_ID } },
  }
}

/** `permitted_analysis_mode` is the ONE reader of Q1 — never re-spelled here. */
const REFUSED = { permitted_analysis_mode: 'quantified_provisional', reasons: [] }
const LICENSED = { permitted_analysis_mode: 'comparative_leader', reasons: [] }

const makeStoreState = (admission: unknown, viewMode: string) => ({
  hoveredOptionId: null,
  nodes: [
    { id: NODE_ID, type: 'option', data: { type: 'option' } },
    { id: SIBLING_ID, type: 'option', data: { type: 'option' } },
  ],
  edges: [],
  ceeAnalysisReady: admission ? { analysis_admission: admission } : null,
  results: { status: 'complete', report: separatedReport() },
  highlightedNodes: new Set<string>(),
  dimmedNodeIds: new Set<string>(),
  optionNumbering: { [NODE_ID]: 1, [SIBLING_ID]: 2 },
  editedSinceRunNodeIds: new Set<string>(),
  olumiAttention: { nodeIds: [] as string[] },
  analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() },
  lens: { _dimmedNodeIds: new Set<string>(), _hiddenNodeIds: new Set<string>(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  lodRung: 'full',
  viewMode,
  setHoveredOption: vi.fn(),
  selectNodeWithoutHistory: vi.fn(),
})

const baseProps = {
  id: NODE_ID,
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function renderOption(
  opts: { admission?: unknown; caveatedOptionId?: string | null; viewMode?: string } = {},
) {
  useDirectiveDesignationStore.setState({
    caveatedOptionId: opts.caveatedOptionId ?? null,
  })
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(
      makeStoreState(opts.admission ?? REFUSED, opts.viewMode ?? 'simple'),
    ),
  )
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Standardise on MacBook Pro', type: 'option' }} />
    </ReactFlowProvider>,
  )
}

const caveatId = `directive-designation-caveat-${NODE_ID}`

beforeEach(() => {
  vi.clearAllMocks()
  useDirectiveDesignationStore.setState({ caveatedOptionId: null })
})

describe('OptionNode — a highlight the model may not make says so, on the card', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // THE PRECONDITIONS. Without these, every assertion below could be true of a
  // card that is not in the state the P0 describes (trap 13b's third face — a
  // guard whose discrimination rests on an unpinned fixture).
  // ══════════════════════════════════════════════════════════════════════════
  it('PRECONDITION: under a REFUSED licence this card wears no designation at all', () => {
    renderOption({ admission: REFUSED, caveatedOptionId: NODE_ID })
    // This is the silence that made the highlight silent. If this ever starts
    // failing, the caveat below is qualifying a claim the card is now making
    // out loud, and its wording needs re-deciding rather than its gate.
    expect(screen.queryByTestId(`leading-option-pill-${NODE_ID}`)).toBeNull()
    expect(screen.queryByText('Most supported')).toBeNull()
  })

  it('PRECONDITION: the support figure IS present, which is why the caveat omits it', () => {
    // ⭐ THE LOAD-BEARING REASON FOR THE CHOSEN WORDING. `winReadout` is not
    // gated on the licence, so on exactly the runs this caveat appears on the
    // card already states the frequency, anchored and visible. Repeating it in
    // the sentence would say one thing twice on one card — the density harm the
    // founder has explicitly held an item about. If this assertion ever fails,
    // that argument has evaporated and the copy must carry its own number.
    renderOption({ admission: REFUSED, caveatedOptionId: NODE_ID })
    expect(screen.getByTestId(`option-win-readout-${NODE_ID}`)).toHaveTextContent('72%')
  })

  // ══════════════════════════════════════════════════════════════════════════
  // THE RULING ITSELF
  // ══════════════════════════════════════════════════════════════════════════
  it('⭐ THE CLAIM IS ADMITTED: a caveated designation renders the sentence on this card', () => {
    renderOption({ admission: REFUSED, caveatedOptionId: NODE_ID })
    const el = screen.getByTestId(caveatId)
    expect(el).toBeInTheDocument()
    // Bound to the REGISTER, not to a re-typed string: a copy change that
    // forgets this suite cannot pass by accident, and this suite cannot drift
    // into asserting wording the product does not ship.
    expect(el).toHaveTextContent(DIRECTIVE_DESIGNATION_CAVEAT_COPY)
  })

  it('⭐ IT ADMITS A CLAIM AND STATES THE UNCERTAINTY — both halves, or it is not the fix', () => {
    renderOption({ admission: REFUSED, caveatedOptionId: NODE_ID })
    const text = screen.getByTestId(caveatId).textContent ?? ''
    // (a) the admission: the product says it pointed.
    expect(text).toContain('Olumi pointed here')
    // (b) the uncertainty, in CEE's own words from the measured payload.
    expect(text).toContain('No single option can be put forward yet')
    // Either half alone fails the ruling: a bare admission is a claim with no
    // hedge, and a bare hedge does not admit the highlight exists.
  })

  it('⚠ NO RACE FRAMING — the retired vocabulary cannot reach the card through this line', () => {
    renderOption({ admission: REFUSED, caveatedOptionId: NODE_ID })
    const text = (screen.getByTestId(caveatId).textContent ?? '').toLowerCase()
    for (const banned of ['winner', 'wins', 'leads', 'leading', 'ahead', 'beats', 'top option']) {
      expect(text).not.toContain(banned)
    }
    // ⚠ POSITIVE CONTROL for the loop above. A `for` over an empty or
    // mis-spelled list passes silently, and so does a matcher pointed at an
    // empty string — an absence probe with no proof it can see a presence
    // (trap 13). This proves the haystack is real and the matcher discriminates.
    expect(text).toContain('option')
  })

  // ══════════════════════════════════════════════════════════════════════════
  // THE OPPOSITE-DIRECTION TWINS. A caveat that appears where no claim was made
  // is the mirror harm: it teaches the user to ignore the sentence, and it
  // contradicts a designation the model IS entitled to make.
  // ══════════════════════════════════════════════════════════════════════════
  it('NO DIRECTIVE, NO SENTENCE: a refused run alone does not caveat every front-runner', () => {
    renderOption({ admission: REFUSED, caveatedOptionId: null })
    expect(screen.queryByTestId(caveatId)).toBeNull()
  })

  it('BOUND BY IDENTITY: a caveat naming the SIBLING never appears on this card', () => {
    // ⭐ THE GREEN ARM OF THE DISCRIMINATING PAIR. The test above shows the line
    // is absent when nothing is caveated; this shows it is absent when
    // something ELSE is. Neither alone proves the binding — a component that
    // rendered on "any caveat at all" passes the first and fails this.
    renderOption({ admission: REFUSED, caveatedOptionId: SIBLING_ID })
    expect(screen.queryByTestId(caveatId)).toBeNull()
    expect(screen.queryByText(DIRECTIVE_DESIGNATION_CAVEAT_COPY)).toBeNull()
  })

  it('LICENSED RUN: the card wears its designation and carries no contradiction', () => {
    // The applicator never caveats a licensed turn, so this is the state the
    // card must render: pill present, sentence absent. Asserted here as well
    // because a component that ignored the store would show both.
    renderOption({ admission: LICENSED, caveatedOptionId: null })
    expect(screen.getByTestId(`leading-option-pill-${NODE_ID}`)).toBeInTheDocument()
    expect(screen.queryByTestId(caveatId)).toBeNull()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // VISIBLE IN THE DEFAULT VIEW — the half of the ruling a mounting assertion
  // CAN carry. "Visible, not carried by the animation" has a layout half this
  // suite cannot reach and a STRUCTURAL half it can: not behind a disclosure.
  // ══════════════════════════════════════════════════════════════════════════
  it('⭐ LAYER 1, NOT BEHIND THE DETAILED DISCLOSURE: it renders in the default `simple` view', () => {
    renderOption({ admission: REFUSED, caveatedOptionId: NODE_ID, viewMode: 'simple' })
    expect(screen.getByTestId(caveatId)).toBeInTheDocument()
  })

  it('and it is still there in `expert`, so the two views cannot disagree about it', () => {
    renderOption({ admission: REFUSED, caveatedOptionId: NODE_ID, viewMode: 'expert' })
    expect(screen.getByTestId(caveatId)).toBeInTheDocument()
  })

  it('IT IS NOT HIDDEN FROM ASSISTIVE TECHNOLOGY', () => {
    // ⚠ The support row beside it IS `aria-hidden`, deliberately — the bar, the
    // number and the phrase are three renderings of one statistic, announced
    // once through an `sr-only` span. Copying that idiom here would remove the
    // disclosure from exactly the users who cannot see the highlight it
    // discloses, so the pattern is deliberately NOT copied, and pinned.
    renderOption({ admission: REFUSED, caveatedOptionId: NODE_ID })
    expect(screen.getByTestId(caveatId)).not.toHaveAttribute('aria-hidden')
  })
})
