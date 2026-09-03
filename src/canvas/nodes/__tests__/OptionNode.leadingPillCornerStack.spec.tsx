/**
 * "Leading option" pill — ONE positioning authority for the top-right corner.
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
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
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

describe('OptionNode — "Leading option" pill lives in the ONE corner stack', () => {
  it('PRECONDITION: the pill and the ordinal both render on this card', () => {
    // Trap 13b: pin the precondition in-test. Every assertion below is about a
    // card carrying BOTH, so if the fixture ever stopped producing the pill (a
    // withheld leader claim, a lost win probability) the structural tests would
    // pass by testing nothing. This is the state the sibling lane could not
    // reach on the deployed build.
    renderOption()
    expect(screen.getByText('Leading option')).toBeInTheDocument()
    expect(screen.getByTestId(`option-stable-number-${NODE_ID}`)).toBeInTheDocument()
  })

  it('DEFECT SIGNATURE: the pill is inside the stack that owns this corner', () => {
    // Located by its TEXT on purpose, so this test addresses the element that
    // exists at pristine and fails on the STRUCTURE rather than on a missing
    // test id. Before the migration it resolved a `<span>` sitting outside the
    // stack while carrying the stack's own `absolute -top-2 -right-2 z-10` —
    // two independently positioned boxes claiming one point. That is the whole
    // defect, and this is the assertion that goes red without the fix.
    renderOption()
    const pill = screen.getByText('Leading option')
    const stack = screen.getByTestId(`node-corner-stack-${NODE_ID}`)
    expect(stack).toContainElement(pill)
    // Identity confirmation: the element the migration moved is the one the
    // rest of this suite addresses by test id (trap 19 — never two elements).
    expect(pill).toBe(screen.getByTestId(`leading-option-pill-${NODE_ID}`))
  })

  it('ALL THREE REACHABLE: pill, edited dot and coaching are distinct siblings of the ONE stack, in order', () => {
    // Three, not four: the rank badge cannot render on an option node at all
    // (pinned below). This is the LARGEST set this card can actually produce,
    // which is what makes it the right state to drive.
    useGuidanceStore.getState().setGuidanceItems([makeGuidanceItem()])
    renderOption()

    const stack = screen.getByTestId(`node-corner-stack-${NODE_ID}`)
    const pill = screen.getByTestId(`leading-option-pill-${NODE_ID}`)
    const edited = screen.getByTestId(`edited-since-run-${NODE_ID}`)
    const coaching = screen.getByTestId(`node-coaching-marker-${NODE_ID}`)

    // THE DEFECT, pinned: the pill was a second positioned box in this corner,
    // not a member of the stack that owns it.
    expect(stack).toContainElement(pill)
    expect(stack).toContainElement(edited)
    expect(stack).toContainElement(coaching)

    // Order, bound by IDENTITY (trap 19) — each child is the specific element,
    // never "an element with these classes", which a sibling badge could also
    // satisfy. The length assertion is what makes this a statement about the
    // WHOLE container rather than about three elements that happen to be in it.
    const kids = Array.from(stack.children)
    expect(kids).toHaveLength(3)
    expect(kids[0]).toBe(pill)
    expect(kids[1]).toBe(edited)
    expect(kids[2]).toBe(coaching)
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
    renderOption()

    // Contrast control FIRST: the same query family resolves a corner-stack
    // child that IS present, so the absence below is the rank badge's and not
    // a dead render or a mistyped id.
    expect(screen.getByTestId(`edited-since-run-${NODE_ID}`)).toBeInTheDocument()
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

  it('the pill carries NO positioning of its own — the stack owns the corner', () => {
    renderOption()
    const pill = screen.getByTestId(`leading-option-pill-${NODE_ID}`)
    const stack = screen.getByTestId(`node-corner-stack-${NODE_ID}`)

    // The exact classes the pill used to hand-write, which duplicated the
    // stack's. A static flex child cannot self-collide with its siblings.
    expect(pill.className).not.toContain('absolute')
    expect(pill.className).not.toContain('-top-2')
    expect(pill.className).not.toContain('-right-2')
    expect(pill.className).not.toContain('z-10')

    // ...and the stack still declares the single anchor + z for all of them.
    expect(stack.className).toContain('absolute')
    expect(stack.className).toContain('-top-2')
    expect(stack.className).toContain('-right-2')
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
    expect(ordinal).toHaveAccessibleName('Option 3')
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

    expect(screen.queryByText('Leading option')).toBeNull()
    expect(screen.queryByTestId(`leading-option-pill-${NODE_ID}`)).not.toBeInTheDocument()

    // Positive control: the card rendered, and the corner stack still holds the
    // occupant this state can produce — so the absence above is the pill's, not
    // a dead render.
    expect(screen.getByText('Hire 3 engineers')).toBeInTheDocument()
    const stack = screen.getByTestId(`node-corner-stack-${NODE_ID}`)
    expect(stack).toContainElement(screen.getByTestId(`edited-since-run-${NODE_ID}`))
  })

  it("PILL ALONE: with no dot or coaching it is the stack's only child", () => {
    renderOption({ editedSinceRunNodeIds: new Set<string>() })

    const stack = screen.getByTestId(`node-corner-stack-${NODE_ID}`)
    const pill = screen.getByTestId(`leading-option-pill-${NODE_ID}`)
    expect(Array.from(stack.children)).toEqual([pill])
  })
})
