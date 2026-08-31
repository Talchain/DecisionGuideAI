/**
 * At low zoom an OPTION states where it stands, and a degenerate one states nothing.
 *
 * ## Why this spec does not mock `useNodeDisplayMetadata`
 *
 * `BaseNode.lodBodyLine.spec.tsx` mocks the hook, which is right for testing
 * what the line RENDERS. It is the wrong shape for the claim this change
 * actually makes, which is a claim about a CHAIN:
 *
 *   producer `status: 'failed'` -> hook nulls `winRate` -> no low-zoom line
 *
 * A spec that hands `BaseNode` a pre-nulled `winRate` proves the last hop and
 * asserts nothing about the first two — it would stay green with the hook's
 * compute-status gate deleted outright (CLAUDE.md trap 13b). So every case here
 * writes a real report into the real store and lets the real hook derive.
 *
 * That matters more than usual because the low-zoom line is the most COMPRESSED
 * surface on the canvas: it carries no bar, no rank, no disclosure and no room
 * for one. Whatever reaches it is read as fact.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { COMPARATIVE_COPY } from '../../../components/results/utils/goalAnchorCopy'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const LEADER = 'opt-leader'
const FAILED = 'opt-failed'

const baseProps = {
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

const setUp = (opts: { lodActive: boolean; failedStatus?: string }) => {
  useCanvasStore.setState({
    lodActive: opts.lodActive,
    nodes: [
      { id: LEADER, type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold the current plan', type: 'option' } },
      { id: FAILED, type: 'option', position: { x: 200, y: 0 }, data: { label: 'Double the spend', type: 'option' } },
    ],
    edges: [],
    results: {
      status: 'complete',
      report: {
        option_probabilities: {
          [LEADER]: { confidence: 0.9, win_probability: 0.55, status: 'computed' },
          // ⚠ `win_probability: 0` IS PRESENT ON PURPOSE. The producer sends a
          // finite 0 for a failed option — `n_valid === 0` means the share is
          // not a measurement, not that the field is missing. A fixture that
          // omitted it would pass against a fix that only handled absence.
          [FAILED]: { confidence: 0.5, win_probability: 0, status: opts.failedStatus ?? 'failed' },
        },
      },
    },
  } as never)
}

const renderBoth = () =>
  render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} id={LEADER} data={{ label: 'Hold the current plan', type: 'option' }} />
      <OptionNode {...baseProps} id={FAILED} data={{ label: 'Double the spend', type: 'option' }} />
    </ReactFlowProvider>,
  )

describe('low zoom — an option states where it stands', () => {
  beforeEach(() => {
    useCanvasStore.setState({ lodActive: false, results: { status: 'idle', report: null } } as never)
  })

  it('renders the ANCHORED pair, never a bare percentage', () => {
    setUp({ lodActive: true })
    renderBoth()
    const lines = screen.queryAllByTestId('node-lod-line')
    const texts = lines.map(l => l.textContent)
    // `Ahead 55%` — the anchor word from the register plus the shared
    // formatter. A bare "55%" here would be the only unlabelled percentage on
    // a canvas where every other one is anchored.
    expect(texts).toContain(`${COMPARATIVE_COPY.anchor} 55%`)
  })

  it('the anchor word comes from the register, not from this component', () => {
    setUp({ lodActive: true })
    renderBoth()
    const texts = screen.queryAllByTestId('node-lod-line').map(l => l.textContent ?? '')
    // Reading the constant rather than the literal 'Ahead': hardcoding it here
    // would be the hand-maintained mirror the register exists to abolish, and
    // it would go stale silently if the wording changed.
    expect(texts.some(t => t.startsWith(COMPARATIVE_COPY.anchor))).toBe(true)
  })

  // ── THE CHAIN THIS CHANGE DEPENDS ON ────────────────────────────────────────

  it('a FAILED computation renders NO line — not "Ahead 0%"', () => {
    setUp({ lodActive: true })
    renderBoth()
    const texts = screen.queryAllByTestId('node-lod-line').map(l => l.textContent ?? '')
    // Built on a base without the compute-status gate, this line would have
    // shipped `Ahead 0%` — the most compact possible fabrication, on the one
    // surface with no room for the disclosure the full card carries.
    expect(texts).not.toContain(`${COMPARATIVE_COPY.anchor} 0%`)
    expect(texts.filter(t => t.startsWith(COMPARATIVE_COPY.anchor))).toHaveLength(1)
  })

  it("POSITIVE CONTROL: the SAME 0 with status 'computed' DOES render, so the gate is the status and not the zero", () => {
    // Without this, the assertion above would pass if the line simply never
    // rendered a zero for any reason — an absence proven by an instrument that
    // cannot show the presence (CLAUDE.md trap 13). Same fixture, same 0, only
    // `status` differs.
    setUp({ lodActive: true, failedStatus: 'computed' })
    renderBoth()
    const texts = screen.queryAllByTestId('node-lod-line').map(l => l.textContent ?? '')
    expect(texts).toContain(`${COMPARATIVE_COPY.anchor} 0%`)
  })

  it('renders nothing at ordinary zoom — this is a low-zoom affordance only', () => {
    setUp({ lodActive: false })
    renderBoth()
    expect(screen.queryAllByTestId('node-lod-line')).toHaveLength(0)
  })

  it('renders nothing before an analysis has run', () => {
    useCanvasStore.setState({
      lodActive: true,
      nodes: [{ id: LEADER, type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold', type: 'option' } }],
      edges: [],
      results: { status: 'idle', report: null },
    } as never)
    render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} id={LEADER} data={{ label: 'Hold', type: 'option' }} />
      </ReactFlowProvider>,
    )
    expect(screen.queryAllByTestId('node-lod-line')).toHaveLength(0)
  })
})
