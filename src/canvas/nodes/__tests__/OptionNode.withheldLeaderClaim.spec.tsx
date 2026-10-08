/**
 * THE CANVAS STOPS NAMING A LEADER THE PRODUCER REFUSED TO NAME — W1-e (a).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARM, WITNESSED ON DEPLOYED STAGING `113375a1` (drive 3, 4 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * CEE answered a correction with `leader_claim { permitted: false,
 * withheld_reason: 'separation_unavailable' }` and `requires_rerun: true`, and
 * the option card went on wearing its `Leading option` pill. The refusal was
 * rendered in the conversation and vanished on reload; the unsafe designation
 * outlived it. The honest half was transient and the unsafe half was durable.
 *
 * This suite drives the CARD, because the card is where the claim is made. It
 * binds by IDENTITY — `leading-option-pill-${id}`, not "some element reading
 * 49%" — so it cannot pass on a different element than the one under test
 * (CLAUDE.md trap 19).
 *
 * ⚠ WHAT IT DOES NOT CLAIM (trap 3). jsdom performs no layout. Nothing here is
 * a statement about pixels, position or visibility-in-viewport; these are
 * assertions about what is MOUNTED.
 *
 * ⚠ THE HOOK IS NOT MOCKED — the store is driven and `useNodeDisplayMetadata`
 * derives from it, so the fixture cannot hand the card a state the real
 * producer chain cannot reach (trap 16-inverse). The store shape mirrors
 * `OptionNode.leadingPillCornerStack.spec.tsx`'s, deliberately, so both suites
 * drive one shape rather than two restatements of it.
 *
 * ⭐ ED #63 5799353114 DECISION 1 (23 Sep 2026): "Drop 'Most supported'. It
 * reads as a recommendation." The card no longer names a leader in ANY
 * permission state, so the pill this suite used to show PRESENT on a permitted
 * run is now asserted ABSENT there too — the strongest case, since `permitted`
 * is exactly the state that used to license it. The withheld arms keep their
 * absence assertions unchanged. Every absence is paired with a same-render
 * contrast control (the card's own result row), so a blank render cannot pass.
 *
 * ⭐⭐ CURRENT-READ row 9 (AIQ 5912710392; Paul's test 4276f3f9, finding 9): a
 * per-option share names the leader in numbers, so a WITHHELD leader now
 * withholds the share too. On a withheld run the card's result slot holds
 * `Not ranked` + the reason, and that marker is the same-render contrast control.
 * This reverses the old "THE DATA IS NOT DELETED" row below; its intent (the
 * result itself is not lost) is kept by the same report rendering its share
 * once the permission is `true`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { OptionNode } from '../OptionNode'
import { NOT_RANKED_MARKER, WITHHELD_REASON_FALLBACK } from '../../state/winShareGate'

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

/** The wire's own words, spelled verbatim rather than through a helper, so a
 *  RED here is about BEHAVIOUR and never about a missing export. */
function withPermission(report: object, permission: unknown) {
  return { ...report, producer_leader_permission: permission }
}

/** The SHIPPED permitting report — the state the harm was witnessed over. */
function permittedReport() {
  return {
    option_probabilities: {
      [NODE_ID]: { win_probability: 0.72 },
      [SIBLING_ID]: { win_probability: 0.23 },
    },
    robustness: { recommended_option_id: NODE_ID, near_tie: { is_tie: false, top_option_id: NODE_ID } },
  }
}

const makeStoreState = (report: unknown) => ({
  hoveredOptionId: null,
  nodes: [
    { id: NODE_ID, type: 'option', data: { type: 'option' } },
    { id: SIBLING_ID, type: 'option', data: { type: 'option' } },
  ],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'complete', report },
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
  viewMode: 'expert',
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

function renderOption(report: unknown) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(makeStoreState(report)),
  )
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire 3 engineers', type: 'option' }} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

/**
 * ED #63 5799353114 decision 1 — the card makes NO leader claim: no pill by
 * identity, no robustness grade beside it, and no "Most supported" in the
 * card's text. Each absence is read from the SAME render as its contrast
 * control: the card's own label and its model-relative result row.
 */
function expectNoLeaderClaimOnCard(container: HTMLElement, contrast: { notRankedReason: string } | 'share' = 'share') {
  // CONTRAST CONTROL FIRST — the card rendered, with its result row.
  expect(screen.getByText('Hire 3 engineers')).toBeInTheDocument()
  if (contrast === 'share') {
    expect(screen.getByTestId(`option-win-readout-${NODE_ID}`)).toHaveTextContent('72% of runs')
  } else {
    // CURRENT-READ row 9 (AIQ 5912710392): on a withheld run the result slot holds `Not ranked` + the reason.
    expectNotRankedInSlot(contrast.notRankedReason)
  }
  // …and the absences.
  expect(screen.queryByTestId(`leading-option-pill-${NODE_ID}`)).toBeNull()
  expect(screen.queryByTestId(`leading-option-robustness-${NODE_ID}`)).toBeNull()
  expect(screen.queryByText(/most supported/i)).toBeNull()
  expect(container.textContent ?? '').not.toMatch(/most supported/i)
}

/** CURRENT-READ row 9 (AIQ 5912710392): no share figure; `Not ranked` + `reason` in the reserved one-line slot. */
function expectNotRankedInSlot(reason: string) {
  const slot = screen.getByTestId(`option-share-slot-${NODE_ID}`)
  expect(slot.textContent).not.toMatch(/\d\s*%/)
  expect(slot.getAttribute('class')?.split(/\s+/)).toContain('h-[1lh]')
  expect(screen.queryByTestId(`option-win-readout-${NODE_ID}`)).toBeNull()
  const marker = screen.getByTestId(`option-not-ranked-${NODE_ID}`)
  expect(marker.closest('[data-testid^="option-bottom-marks-"]') !== null).toBe(true)
  expect(marker).toHaveAttribute('aria-label', NOT_RANKED_MARKER)
  expect(marker.getAttribute('aria-label')).toBe(NOT_RANKED_MARKER)
  expect(marker.getAttribute('aria-description')).toBe(reason)
}

describe('OptionNode — a withheld leader claim removes the designation', () => {
  it('producer silent: the card still makes no leader claim (ED #63 5799353114 decision 1)', () => {
    // WAS "PRECONDITION: this card wears the pill". The pill is retired, so the
    // producer-silent arm is now an absence — with the contrast control inside
    // the helper, so it cannot pass on a dead render (CLAUDE.md trap 13).
    const { container } = renderOption(permittedReport())
    expectNoLeaderClaimOnCard(container)
  })

  it('DEFECT SIGNATURE: `leader_claim.permitted:false` — no `Leading option` pill', () => {
    const { container } = renderOption(
      withPermission(permittedReport(), {
        permitted: false,
        withheld_reason: 'separation_unavailable',
      }),
    )
    // Bound by identity AND by text, because the text is the claim the user
    // reads and the test id is the element the fix removes.
    // CURRENT-READ row 9 (AIQ 5912710392): WAS contrasted against the share ("72% of runs"); a withheld
    // leader now withholds it, so the contrast is `Not ranked`. No `producer_cause` here → the fallback reason.
    expectNoLeaderClaimOnCard(container, { notRankedReason: WITHHELD_REASON_FALLBACK })
  })

  it('`permitted:true` — the STRONGEST case — still puts no pill on the card (ED #63 5799353114 decision 1)', () => {
    // WAS "CONTRAST CONTROL: permitted:true leaves the pill exactly where it
    // was". Permission used to license the pill; after decision 1 it licenses
    // nothing on the card. The contrast control is now the card's own result
    // row, read in the same render.
    const { container } = renderOption(withPermission(permittedReport(), { permitted: true }))
    expectNoLeaderClaimOnCard(container)
  })

  it('THE SHARE GOES WITH THE CLAIM (CURRENT-READ row 9): a withheld run shows no win figure, `Not ranked` instead; the same data, permitted, still shows it', () => {
    // ⭐ SCOPE, STATED RATHER THAN ASSUMED — AND REVERSED. This row WAS "THE DATA
    // IS NOT DELETED: the option keeps its own win figure", on the reading that
    // CEE withholds the CLAIM and ships the DATA. CURRENT-READ row 9 (AIQ
    // 5912710392; Paul's 4276f3f9: "Model 80% · Goal only" on a run that would
    // not name a leader) rules that a per-option share singling one option out
    // names the leader in numbers, so on a withheld run the card shows
    // `Not ranked` + the reason instead.
    renderOption(withPermission(permittedReport(), { permitted: false }))
    expectNotRankedInSlot(WITHHELD_REASON_FALLBACK)
    cleanup()
    // The result itself is not deleted: the SAME report, permitted, renders its figure.
    renderOption(withPermission(permittedReport(), { permitted: true }))
    expect(screen.getByTestId(`option-win-readout-${NODE_ID}`)).toHaveTextContent('72%')
    expect(screen.queryByTestId(`option-not-ranked-${NODE_ID}`)).toBeNull()
  })

  it('THE ORDINAL IS NOT A RANK AND IS NOT WITHDRAWN', () => {
    // ⚠ PREMISE CORRECTION, derived at `canvas/store.ts:5019-5038`
    // (`registerOptionNumbering`). `option-stable-number-*` is NOT a
    // probability rank: the store orders ids by CANVAS POSITION and its own
    // comment records that the frozen-probability-rank reading was the defect
    // Paul had removed on 31 Aug 2026 ("the store owns ORDER; callers own
    // MEMBERSHIP"). Withdrawing it on a withheld claim would delete a
    // navigational identifier and re-open a ruling, so this suite PINS that it
    // survives rather than silently leaving the question open.
    renderOption(withPermission(permittedReport(), { permitted: false }))
    expect(screen.getByTestId('node-title').getAttribute('data-type-ordinal')).toMatch(/^O\d+$/) // Paul 1 Oct: the card's own "O<n>"
  })
})
