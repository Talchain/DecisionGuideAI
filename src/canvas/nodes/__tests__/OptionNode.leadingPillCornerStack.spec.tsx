/**
 * "Most supported" pill — RETIRED from the card; the corner stack keeps ONE
 * positioning authority for what remains.
 *
 * ⭐ ED #63 5799353114 DECISION 1 (23 Sep 2026): "Drop 'Most supported'. It
 * reads as a recommendation." `OptionNode` no longer passes `cornerSlot` at
 * all, so the pill (and the robustness grade that rode beside it) is gone from
 * the corner stack. The cases below that drove the pill INTO the stack are
 * re-pointed at the strongest case — this card IS the permitted leader, with
 * the edited dot and the coaching marker also present — and assert that the
 * stack holds exactly those two members and no pill, each absence paired with
 * a present sibling in the same render. The rank-badge impossibility pin and
 * the ordinal pin are unchanged. The history below is kept because it is why
 * the stack is shaped the way it is.
 *
 * ── HISTORY (the migration this file was written for) ──────────────────────
 *
 * THE DEFECT. `OptionNode` hand-wrote the pill at `absolute -top-2 -right-2
 * z-10` — byte-for-byte the anchor and z-index of `node-corner-stack-{id}`
 * (`BaseNode.tsx`), the container built specifically to abolish same-corner
 * overlap. The pill was never migrated into it, so on a leading option that
 * also carries an edited-since-run dot or a coaching marker, two independently
 * positioned boxes claim the same point. BaseNode's own source already declares
 * the ownership this violated: *"the top-right corner is owned by
 * node-corner-stack below"* (the note on `NodeQuickActions`, which was moved to
 * the bottom-right for exactly this reason after a review caught it
 * overlapping by ~6px).
 *
 * That is one more instance of a defect class this corner keeps producing:
 * rank vs coaching (Codex P1-5), the edited dot vs coaching (Codex P2), the
 * "Needs input" StatusPill (#1177), and now the leading-option pill. Each
 * previous instance was closed by folding the new occupant into the stack;
 * this does the same rather than adding another hand-written offset.
 *
 * ⚠ THE CONTRACT IS STATED ONCE, ON THE STACK ITSELF, AND THIS FILE DOES NOT
 * RESTATE IT. `BaseNode.tsx`'s corner-stack comment carries the reconciled
 * five-member order — `cornerSlot · StatusPill · rank · edited dot · coaching`
 * — together with which pairs are unreachable and why. #1177 merged one day
 * before this change, and both were originally written calling their own
 * occupant "the fourth", which is how two contradictory contracts nearly
 * shipped in one file. A count restated in three places is a hand-maintained
 * mirror (CLAUDE.md trap 12); the assertions below name the members they drive
 * and leave the ordinal to the one authority.
 *
 * ⚠ THE RANK BADGE IS NOT IN THE REACHABLE SET ON THIS CARD, so this suite does
 * not pretend it is. In `useNodeDisplayMetadata.ts`, `sensitivityRank` is
 * declared `null` and REASSIGNED in exactly one place — inside that hook's
 * `if (nodeType === 'factor')` branch; `OptionNode` passes `nodeType="option"`.
 * The largest set reachable beside the pill here is therefore the edited dot
 * and the coaching marker — three occupants, which is what the tests drive. The
 * impossibility itself is PINNED below, at runtime AND against the hook's own
 * source, so a change that makes the pair reachable REDs here instead of
 * silently producing an overlap nobody has measured.
 *
 * ⚠ THE HOOK IS NOT MOCKED. An earlier draft of this file mocked
 * `useNodeDisplayMetadata` and handed it `sensitivityRank: 1` on an option
 * node — a value the real hook cannot return, which turned the impossibility
 * above into a fabricated four-occupant fixture. The store is driven instead
 * and the real hook derives from it, which is the only way the pin below can
 * mean anything (CLAUDE.md trap 16-inverse: a fixture you wrote yourself is not
 * evidence about what the producer can emit).
 *
 * ⚠ WHAT THESE PINS DO AND DO NOT CLAIM (CLAUDE.md trap 3). jsdom performs no
 * layout, so nothing here measures pixels and nothing here claims to. They
 * assert the STRUCTURE that makes a same-corner collision impossible — one
 * positioned container, distinct static flex siblings, no child carrying an
 * absolute/offset of its own — which is the same standard
 * `BaseNode.cornerStack.spec.tsx` holds the other occupants to.
 *
 * ⚠ AND THE ORDINAL IS A SEPARATE CLAIM — ONE THE BROWSER MEASUREMENT REFUTED.
 * The suspicion that the pill covers the option ordinal is the obvious reading
 * of the symptom and it is wrong: `e2e/geometry/leadingPillCorner.measure.ts`
 * measured their intersection at 0px^2 both before and after this migration and
 * at both ends of `--canvas-label-scale` (the pill sits ~27px above it at the
 * zoom the canvas actually settles on, where the scale is already at its 2x
 * cap). A missing ordinal has a different cause: exactly one site POPULATES
 * `optionNumbering` — `registerOptionNumbering`'s only product caller, in
 * `useResultsSectionData.ts` — and its membership is
 * `recommendation.allOptions`, so a card absent from the analysis
 * recommendation renders no ordinal at all — nothing to do with this corner.
 * (`canvas/store.ts` assigns the field too, but only ever `{}`; those clear the
 * map and can never be why one card lacks an ordinal while its siblings have
 * one.)
 *
 * The ordinal test below therefore pins only what it can: that the ordinal is
 * in the DOM alongside the pill and is NOT a child of the corner stack. It
 * makes no claim about pixels, and this suite does not fix the numbering seam.
 */
import { readFileSync } from 'node:fs'
import { CANVAS_CORNER_STACK_CLASSES } from '../shared/canvasGlyphScale'
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { optionOrdinalBadgeAccessibleName } from '../shared/metricVocabulary'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'

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
 * The producer's OWN leader claim (ROADMAP 1.223): the verdict renders a leader
 * only when the producer names one, and `near_tie.top_option_id` is the field
 * it checks identity against. Mirrors `OptionNode.spec.tsx`'s helper so both
 * suites drive the same shape rather than two restatements of it.
 */
const producerLeaderClaim = (winArgmaxOptionId: string) => ({
  near_tie: { is_tie: false, top_option_id: winArgmaxOptionId },
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [
    { id: NODE_ID, type: 'option', data: { type: 'option' } },
    { id: SIBLING_ID, type: 'option', data: { type: 'option' } },
  ],
  edges: [],
  ceeAnalysisReady: null,
  results: {
    status: 'complete',
    report: {
      option_probabilities: {
        [NODE_ID]: { win_probability: 0.72 },
        [SIBLING_ID]: { win_probability: 0.28 },
      },
      robustness: producerLeaderClaim(NODE_ID),
      // ⚠ LOAD-BEARING FOR THE IMPOSSIBILITY PIN, not decoration. These rows
      // are the feed the rank badge is computed from, and the first one is
      // keyed to THIS card's id with the top elasticity of a clearly-led set —
      // so the only thing standing between this option and a `#1` badge is the
      // `nodeType === 'factor'` gate. MEASURED: with the gate widened to admit
      // options, the runtime half of the pin goes RED; with these rows removed
      // it stays GREEN under the same mutation, i.e. it would be asserting an
      // absence it could never observe (CLAUDE.md trap 13).
      factor_sensitivity: [
        { node_id: NODE_ID, elasticity: 0.9 },
        { node_id: 'fac-b', elasticity: 0.4 },
        { node_id: 'fac-c', elasticity: 0.1 },
      ],
    },
  },
  highlightedNodes: new Set<string>(),
  dimmedNodeIds: new Set<string>(),
  // The ordinal under test: `Option 3` on this card.
  optionNumbering: { [NODE_ID]: 3 },
  editedSinceRunNodeIds: new Set<string>([NODE_ID]),
  olumiAttention: { nodeIds: [] as string[] },
  analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() },
  lens: { _dimmedNodeIds: new Set<string>(), _hiddenNodeIds: new Set<string>(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  lodRung: 'full',
  viewMode: 'expert',
  setHoveredOption: vi.fn(),
  selectNodeWithoutHistory: vi.fn(),
  ...overrides,
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
  // React Flow's NodeProps requires these three as well. Supplied honestly
  // rather than cast away: an `as never` spread here is what the typecheck
  // ratchet caught, and casting would have hidden the same gap from the gate.
  deletable: true,
  selectable: true,
  draggable: true,
}

function makeGuidanceItem(): GuidanceItem {
  return {
    item_id: 'item-1',
    category: 'should_fix',
    source: 'structural',
    title: 'Review this option',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
    target_object: { type: 'node', id: NODE_ID },
  }
}

function renderOption(overrides: Record<string, unknown> = {}) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(makeStoreState(overrides)),
  )
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire 3 engineers', type: 'option' }} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useGuidanceStore.getState().clearGuidanceItems()
})

/**
 * ED #63 5799353114 decision 1 — the card names no leader. Asserted by
 * identity (pill and grade test ids) AND by the text a user would read, after
 * a same-render contrast control: the card's label and its result row.
 */
function expectNoLeaderPill(container: HTMLElement) {
  expect(screen.getByText('Hire 3 engineers')).toBeInTheDocument()
  expect(screen.getByTestId(`option-win-readout-${NODE_ID}`)).toHaveTextContent('72% of runs')
  expect(screen.queryByTestId(`leading-option-pill-${NODE_ID}`)).toBeNull()
  expect(screen.queryByTestId(`leading-option-robustness-${NODE_ID}`)).toBeNull()
  expect(screen.queryByText(/most supported/i)).toBeNull()
  expect(container.textContent ?? '').not.toMatch(/most supported/i)
}

describe('OptionNode — the corner stack after ED #63 5799353114 decision 1 (no "Most supported" pill)', () => {
  it('the permitted LEADER card renders its ordinal and result row, and NO pill', () => {
    // WAS "PRECONDITION: the pill and the ordinal both render". The fixture is
    // unchanged — the producer's claim names THIS card and nothing withholds
    // it — which is the strongest case for the retired pill to reappear in.
    const { container } = renderOption()
    expect(screen.getByTestId(`option-stable-number-${NODE_ID}`)).toBeInTheDocument()
    expectNoLeaderPill(container)
  })

  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-11, DESIGN-GAP-AUDIT-20260924.md row 11; Paul
   * v3.1 pt14): the edited-since-run dot is removed from the corner — a
   * per-card duplicate of the single graph-level stale cue. It used to be
   * this fixture's default always-present sibling (`editedSinceRunNodeIds`
   * seeds `NODE_ID` by default, line ~161), proving the stack container
   * itself renders. The container's own testid now carries that proof
   * directly — it is unconditionally mounted regardless of its children
   * (`BaseNode.cornerStack.spec.tsx`'s "each child self-gates" contract).
   */
  it('no pill in the stack that owns this corner — the stack is there, the pill is not', () => {
    // WAS "DEFECT SIGNATURE: the pill is inside the stack". The stack itself is
    // the contrast control: it IS mounted, so the pill's absence from it is a
    // statement about the pill, not about a missing container.
    const { container } = renderOption()
    const stack = screen.getByTestId(`node-corner-stack-${NODE_ID}`)
    expect(screen.queryByTestId(`edited-since-run-${NODE_ID}`)).toBeNull()
    expect(stack.querySelector('[data-testid^="leading-option-"]')).toBeNull()
    expect(stack.textContent ?? '').not.toMatch(/most supported/i)
    expectNoLeaderPill(container)
  })

  it('ALL REACHABLE: on the leader, the ONE stack holds exactly coaching, in order — no pill, no dot', () => {
    // WAS three members (pill, dot, coaching), then two (dot, coaching) once
    // the pill was retired. GAP-11 removes the dot too, so the largest set
    // this leading card can produce is coaching alone (the rank badge cannot
    // render on an option node — pinned below).
    useGuidanceStore.getState().setGuidanceItems([makeGuidanceItem()])
    const { container } = renderOption()

    const stack = screen.getByTestId(`node-corner-stack-${NODE_ID}`)
    const coaching = screen.getByTestId(`node-coaching-marker-${NODE_ID}`)
    expect(screen.queryByTestId(`edited-since-run-${NODE_ID}`)).toBeNull()

    // Order, bound by IDENTITY (trap 19). The length assertion is what makes
    // this a statement about the WHOLE container: a pill re-inserted anywhere
    // in the stack makes it two.
    const kids = Array.from(stack.children)
    expect(kids).toHaveLength(1)
    expect(kids[0]).toBe(coaching)
    expectNoLeaderPill(container)
  })

  /**
   * IMPOSSIBILITY PIN. Asserted two ways, because each answers a different
   * question and neither subsumes the other:
   *
   *  - at RUNTIME, that this results-mode leading option renders no rank badge
   *    even though the report carries a driver row naming it at the top of a
   *    clearly-led set — a claim about what the real hook EMITS for
   *    `nodeType="option"`, which reds if a future gate lets it through;
   *  - against the hook's SOURCE, that the single assignment sits inside the
   *    factor branch — which names WHY, so a reader who makes the runtime
   *    assertion red knows what changed rather than only that it did.
   *
   * Neither half subsumes the other, and that is measured rather than assumed:
   * before the `factor_sensitivity` rows were added to the fixture, widening
   * the gate to admit options killed the SOURCE half alone while the runtime
   * assertion stayed green on an empty feed — an absence it could not have
   * observed. The runtime half also carries a contrast control, because an
   * absence assertion with no proof the query can see a PRESENT sibling is
   * vacuous either way (trap 13).
   */
  it('IMPOSSIBILITY PIN: the rank badge cannot render on an option node', () => {
    // ⛔ UPDATED 24 Sep 2026 (GAP-11): the contrast control used to be the
    // fixture's default edited-since-run dot, now removed. A guidance item is
    // seeded here so the coaching marker is the present sibling instead —
    // same role: proving the corner-stack query family resolves a REAL child
    // before trusting it to resolve an absent one.
    useGuidanceStore.getState().setGuidanceItems([makeGuidanceItem()])
    renderOption()

    // Contrast control FIRST: the same query family resolves a corner-stack
    // child that IS present, so the absence below is the rank badge's and not
    // a dead render or a mistyped id.
    expect(screen.getByTestId(`node-coaching-marker-${NODE_ID}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`sensitivity-rank-${NODE_ID}`)).toBeNull()

    const metadataHook = readFileSync(
      resolve(__dirname, '../../hooks/useNodeDisplayMetadata.ts'), 'utf8')
    // Positive control on the reader itself: prove it can SEE this file's
    // content, so a false zero cannot pass as a satisfied assertion.
    expect(metadataHook).toContain('export function useNodeDisplayMetadata')

    // The one assignment, and the branch it sits in. If either string moves,
    // re-derive whether the pill and the rank badge can now co-occur — and if
    // they can, measure that pair's geometry rather than inheriting this
    // file's verdict.
    expect(metadataHook).toContain("if (nodeType === 'factor') {")
    const assignments = metadataHook.match(/^\s*sensitivityRank = /gm) ?? []
    expect(assignments).toHaveLength(1)
    const assignmentAt = metadataHook.indexOf('\n      sensitivityRank = ')
    const factorBranchAt = metadataHook.indexOf("if (nodeType === 'factor') {")
    const optionBranchAt = metadataHook.indexOf("if (nodeType === 'option') {")
    expect(factorBranchAt).toBeGreaterThan(-1)
    expect(optionBranchAt).toBeGreaterThan(factorBranchAt)
    expect(assignmentAt).toBeGreaterThan(factorBranchAt)
    expect(assignmentAt).toBeLessThan(optionBranchAt)
  })

  it('the stack still owns the corner — and no second positioned box claims it', () => {
    // WAS "the pill carries NO positioning of its own". The pill is gone; what
    // survives is the invariant it was migrated for: ONE positioned container
    // in this corner, and nothing else on the card carrying the stack's own
    // anchor (the pill's pre-migration defect was a byte-for-byte copy of it).
    // The anchor is DERIVED from the stack's constant, and the stack itself is
    // the positive control: the probe must find exactly it, so a probe that
    // matched nothing could not pass.
    useGuidanceStore.getState().setGuidanceItems([makeGuidanceItem()])
    const { container } = renderOption()
    const stack = screen.getByTestId(`node-corner-stack-${NODE_ID}`)
    const anchorTokens = CANVAS_CORNER_STACK_CLASSES.split(/\s+/)
      .filter(t => /^(absolute$|-?(top|right|bottom|left)-)/.test(t))
    expect(anchorTokens.length).toBeGreaterThanOrEqual(2)
    const claimants = Array.from(container.querySelectorAll<Element>('*'))
      .filter(el => anchorTokens.every(t => el.classList.contains(t)))
    expect(claimants).toEqual([stack])
    expectNoLeaderPill(container)

    // ...and the stack still declares the single anchor + z for all of them.
    // ⚠ DERIVED FROM THE COMPONENT'S OWN CONSTANT, NOT A COPY OF IT. This read
    // `toContain('-top-2')` / `toContain('-right-2')` — the measuring stick,
    // not the property in this test's title. The `-top-2` half was an UNSCALED
    // 8px anchor holding counter-scaled content, which put the `Needs input`
    // pill in the card header at the settle zoom and nowhere at zoom >= 1.
    // Asserting the exported constant keeps the invariant that matters (the
    // stack owns the corner; its children carry no positioning) while letting
    // the anchor move in one place.
    expect(stack.className).toContain('absolute')
    expect(stack.className).toBe(CANVAS_CORNER_STACK_CLASSES)
    expect(stack.className).toContain('z-10')
  })

  it('the ordinal is NOT in the corner stack — it stays in the header row', () => {
    renderOption()
    const stack = screen.getByTestId(`node-corner-stack-${NODE_ID}`)
    const ordinal = screen.getByTestId(`option-stable-number-${NODE_ID}`)

    // The ordinal rides `headerSlot`, inside the card. Were it ever folded into
    // the corner stack the two claims would share an owner and this pin would
    // stop meaning what it says.
    expect(stack).not.toContainElement(ordinal)
    // ⚠ WAS 'Option 3'. A bare ordinal is indistinguishable from the factor
    // ranking badge to a screen-reader user, and the two mean opposite things.
    // The name now carries the legend's own gloss (metricVocabulary.ts:373).
    expect(ordinal).toHaveAccessibleName(/^Option 3 — the order the options were first laid out in, not a ranking$/)

    /**
     * ⭐⭐ THE OTHER HALF OF THE COUPLING — AND IT IS NOT REDUNDANT WITH THE
     * LITERAL ABOVE, NOR WITH THE REGISTER-SIDE GUARD.
     *
     * `metricVocabulary.spec.ts` proves the builder AGREES with the legend row.
     * It is structurally blind to this component dropping the builder and
     * re-typing the sentence — which is precisely how the defect arrived: a
     * comment here claimed the wording was "DERIVED from the legend's own
     * gloss" while no import existed. This assertion binds THIS element's
     * rendered accessible name to the builder's output for THIS number, so a
     * re-inlined literal REDs here while the register guard stays green.
     *
     * The literal assertion above stays. A derived guard proves the copies
     * agree, never that the wording is right; the literal is the corpus that
     * notices a wrong sentence (CLAUDE.md trap 12d).
     */
    expect(ordinal).toHaveAccessibleName(optionOrdinalBadgeAccessibleName(3))
  })

  it('DISCRIMINATION: a non-leading option gets no pill, and the stack loses exactly that child', () => {
    // The producer claim names the SIBLING, so this card is not the leader.
    // Without this the "pill is in the stack" tests could pass on a pill that
    // fires for every option — presence of a claim, not its identity (trap 19).
    renderOption({
      results: {
        status: 'complete',
        report: {
          option_probabilities: {
            [NODE_ID]: { win_probability: 0.28 },
            [SIBLING_ID]: { win_probability: 0.72 },
          },
          robustness: producerLeaderClaim(SIBLING_ID),
        },
      },
    })

    expect(screen.queryByText("Most supported")).toBeNull()
    expect(screen.queryByTestId(`leading-option-pill-${NODE_ID}`)).not.toBeInTheDocument()

    // Positive control: the card rendered — so the absence above is the
    // pill's, not a dead render.
    // ⛔ UPDATED 24 Sep 2026 (GAP-11): used to also assert the corner stack
    // held the edited-since-run dot (this fixture's default). The dot is
    // removed; the stack's own testid resolving is proof enough that it is
    // mounted (it renders unconditionally regardless of its children).
    expect(screen.getByText('Hire 3 engineers')).toBeInTheDocument()
    expect(screen.getByTestId(`node-corner-stack-${NODE_ID}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`edited-since-run-${NODE_ID}`)).toBeNull()
  })

  it('NOTHING ELSE IN THE CORNER: with no dot or coaching the leader\'s stack is EMPTY — the pill does not fill it', () => {
    // WAS "PILL ALONE". The stack is still mounted (the contrast control for
    // its emptiness), and the card's own result row proves the render is live.
    const { container } = renderOption({ editedSinceRunNodeIds: new Set<string>() })

    const stack = screen.getByTestId(`node-corner-stack-${NODE_ID}`)
    expect(Array.from(stack.children)).toEqual([])
    expectNoLeaderPill(container)
  })
})
