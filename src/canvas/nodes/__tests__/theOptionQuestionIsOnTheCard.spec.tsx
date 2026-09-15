/**
 * ⭐⭐ THE OPTION CARD ASKS NOTHING ON ITS FACE — measured, then closed.
 *
 * Deployed `79866c44`, guest, fresh browser context, a fresh draft read at the
 * product's own terminal beat: **4 of 4 option cards carried no question**,
 * while Risk asked *"What would we see first?"*, Outcome *"What would falsify
 * this?"*, Goal *"Is this the real goal?"* and Factor had just gained one in
 * #1591. Options are the cards a reader spends the most time on.
 *
 * ## ⚠ This is a RELOCATION, not new coaching
 *
 * `option_what_could_go_wrong` already existed with this exact label and this
 * exact message — in the Standard **popover**, reachable only by hovering.
 * Codex ruled per-node coaching EXPANSION lower priority; putting a built
 * affordance where a reader who never hovers can reach it is not expansion.
 *
 * ## Why the scope is narrower than Factor's
 *
 * Pre-analysis only. After a run this card carries win rates, goal-fit, deltas
 * and up to three chips, and the popover is the right home for that cluster.
 * Before a run it is sparse and the reader is AUTHORING — which is when a
 * question is worth most, and when nothing was being asked at all.
 *
 * ## What these tests are for
 *
 * The valuable mutant is not "does a chip exist". It is **exactly once, on the
 * right cards** — #1591 rendered the factor's question on the card while the
 * popover still rendered the same chip on the same card, and CI caught it with
 * `getMultipleElementsFoundError`. Here the popover arm returns null, so once
 * is structural; the test pins that it stayed structural.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const ID = 'opt_upmarket'
const state = (resultsStatus: string) => ({
  selectedNodeId: null, hoveredOptionId: null, nodes: [], edges: [],
  ceeAnalysisReady: null, results: { status: resultsStatus, report: null },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { active: null, _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), _evidenceNodeClass: new Map() },
  goalThreshold: null, goalConstraints: [], viewMode: 'standard', lodRung: 'full',
  guidanceItems: [],
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn((s) => s(state('idle'))) }))

/**
 * ⛔⛔ A TRANSPARENT POPOVER, AND WITHOUT IT THE "EXACTLY ONCE" TEST WAS A
 * TAUTOLOGY — proven by its own mutant.
 *
 * The real `NodePopover` mounts behind a 300ms hover and an anchor measurement,
 * neither of which fires in jsdom. So `getAllByText(...).toHaveLength(1)` passed
 * because the popover was never rendered AT ALL — and restoring the duplicate
 * chip (the exact defect #1591 shipped and CI caught) **left the suite GREEN**.
 * A guard agreeing with itself.
 *
 * Rendering the popover's children inline is what makes the duplicate visible,
 * and it is the same device `DecisionNode.restingState.spec` uses for the same
 * reason.
 */
vi.mock('../shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    NodePopover: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="option-node-popover">{children}</div>
    ),
  }
})

const props = {
  type: 'option', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  deletable: true, selectable: true, draggable: true, width: 220, height: 100,
  sourcePosition: undefined, targetPosition: undefined,
}

function renderOption(data: Record<string, unknown> = {}, resultsStatus = 'idle') {
  cleanup()
  vi.mocked(useCanvasStore).mockImplementation((sel) => (sel as (s: unknown) => unknown)(state(resultsStatus) as never))
  render(
    <ReactFlowProvider>
      <OptionNode {...props} id={ID} data={{ label: 'Move upmarket to enterprise', kind: 'option', ...data }} />
    </ReactFlowProvider>,
  )
  // ⚠ Positive control: the card mounted, before any absence is asserted.
  expect(screen.getByTestId('node-title'), 'the card did not mount').toBeTruthy()
}

describe('the option card asks its own question, like every other kind', () => {
  it('⭐ a proposed option asks what could go wrong — on the card, no hover', () => {
    renderOption()
    expect(screen.getByTestId('option-card-question')).toHaveTextContent('What could go wrong?')
  })

  it('⭐ EXACTLY ONCE — the popover arm no longer renders the same chip', () => {
    renderOption()
    // `getAllByText` rather than `getByText`: the failure this pins is a
    // DUPLICATE, and `getByText` would throw a less legible error for it.
    expect(screen.getAllByText('What could go wrong?')).toHaveLength(1)
  })

  it('the message names the option, so the turn it opens is about this card', () => {
    renderOption({ label: 'Double down on self-serve' })
    const chip = screen.getByTestId('option-card-question').querySelector('button')
    expect(chip).toBeTruthy()
  })

  /**
   * ⛔ CONTRAST: the BASELINE gets nothing, unchanged. "What could go wrong if
   * we choose staying as we are" is a question about a choice nobody is
   * proposing to make; the baseline's coaching is its status-quo ScienceIcon.
   * Without this, a card that always asked would pass the binding test above.
   */
  it('⛔ CONTRAST: the baseline option asks nothing', () => {
    // ⚠ `is_baseline` — THE PRODUCER'S OWN FIELD, and the one the component
    // reads. My first cut passed `isBaseline`, which nothing looks at, so the
    // card rendered the question and the test failed for the right reason:
    // a fixture outside the producer's vocabulary proves nothing about the
    // product (trap 16 — a self-authored input encodes the author's model of
    // the producer rather than the producer).
    renderOption({ is_baseline: true })
    expect(screen.queryByTestId('option-card-question')).toBeNull()
  })

  it('⛔ CONTRAST: a label the detector reads as the status quo also asks nothing', () => {
    // The flag is absent here, so `detectBaseline` decides — the other half of
    // the component's own predicate, which the flag-only case never exercises.
    renderOption({ label: 'Keep per-seat pricing (status quo)' })
    expect(screen.queryByTestId('option-card-question')).toBeNull()
  })

  /**
   * ⛔ CONTRAST: POST-analysis the card is dense and the cluster belongs in the
   * popover. A change that rendered the question in both phases would pass
   * every test above and quietly add a row to the busiest card on the canvas.
   */
  it('⛔ CONTRAST: after a run the card question stands down', () => {
    renderOption({}, 'complete')
    expect(screen.queryByTestId('option-card-question')).toBeNull()
  })
})
