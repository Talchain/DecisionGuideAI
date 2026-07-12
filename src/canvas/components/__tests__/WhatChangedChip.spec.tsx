/**
 * WhatChangedChip (seamlessness R6 / ROADMAP 2.1 first slice) — run-over-run
 * graph delta chip.
 *
 * Contract:
 * - Diffs the LATEST stored run's graph snapshot against the PREVIOUS run's.
 *   loadRuns() returns newest-first, so that is runs[0] vs runs[1] — the
 *   original orphaned component read runs[length-2] (the second-OLDEST run;
 *   the old spec masked this by mocking runs oldest-first), which this spec
 *   pins against regression.
 * - The diff is id-precise: click pulses the added+modified elements via
 *   pulseAppliedTargets. Removed elements no longer exist and cannot be
 *   highlighted (fail-closed downstream).
 * - Node "modified" = label change. Position-only moves are layout, not an
 *   analytical delta, and must NOT count (auto-layout would otherwise mark
 *   every node modified on every run).
 * - Copy is honest about the client-side cached-run basis ("since your last
 *   run") — the engine-backed delta is a later contract (ROADMAP 2.1).
 * - Hidden entirely (<2 runs, or zero delta). Ignores the LIVE canvas —
 *   the delta is between analyses, not live edits.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

const { loadRunsMock, pulseMock } = vi.hoisted(() => ({
  loadRunsMock: vi.fn(),
  pulseMock: vi.fn(),
}))
vi.mock('../../store/runHistory', () => ({ loadRuns: loadRunsMock }))
vi.mock('../../utils/appliedEditPulse', () => ({
  pulseAppliedTargets: pulseMock,
  __resetAppliedEditPulseForTests: vi.fn(),
  PULSE_COALESCE_MS: 100,
  PULSE_DURATION_MS: 2000,
}))

import { WhatChangedChip } from '../WhatChangedChip'

const node = (id: string, label: string, x = 0, y = 0): Node =>
  ({ id, type: 'factor', position: { x, y }, data: { label } }) as Node
const edge = (id: string, weight: number, belief = 0.7): Edge =>
  ({ id, source: 'a', target: 'b', data: { weight, belief } }) as Edge

let runSeq = 0
/** Runs are supplied NEWEST-FIRST, matching loadRuns()'s sort. */
const run = (graph: { nodes: Node[]; edges: Edge[] }) => ({
  id: `run-${++runSeq}`,
  ts: 1000 - runSeq,
  graph,
})

beforeEach(() => {
  loadRunsMock.mockReset()
  pulseMock.mockReset()
})
afterEach(() => cleanup())

describe('WhatChangedChip — visibility', () => {
  it('renders nothing with fewer than 2 runs', () => {
    loadRunsMock.mockReturnValue([run({ nodes: [node('a', 'A')], edges: [] })])
    render(<WhatChangedChip />)
    expect(screen.queryByTestId('what-changed-chip')).not.toBeInTheDocument()
  })

  it('renders nothing when the last two runs are identical', () => {
    const g = { nodes: [node('a', 'A')], edges: [edge('e1', 0.5)] }
    loadRunsMock.mockReturnValue([run(g), run(g)])
    render(<WhatChangedChip />)
    expect(screen.queryByTestId('what-changed-chip')).not.toBeInTheDocument()
  })

  it('renders nothing when a run lacks a graph snapshot (older stored runs)', () => {
    loadRunsMock.mockReturnValue([
      { id: 'r-nograph-1', ts: 2 },
      { id: 'r-nograph-2', ts: 1 },
    ])
    render(<WhatChangedChip />)
    expect(screen.queryByTestId('what-changed-chip')).not.toBeInTheDocument()
  })

  it('hides on a SINGLE-SIDED missing snapshot — never fabricates an everything-added delta', () => {
    loadRunsMock.mockReturnValue([
      run({ nodes: [node('a', 'A'), node('b', 'B')], edges: [] }), // latest has a graph
      { id: 'r-legacy', ts: 1 }, // previous predates v1.2 snapshots
    ])
    render(<WhatChangedChip />)
    expect(screen.queryByTestId('what-changed-chip')).not.toBeInTheDocument()
  })

  it('hides when only the LATEST run lacks a snapshot (reverse single-sided case)', () => {
    loadRunsMock.mockReturnValue([
      { id: 'r-legacy', ts: 2 },
      run({ nodes: [node('a', 'A')], edges: [] }),
    ])
    render(<WhatChangedChip />)
    expect(screen.queryByTestId('what-changed-chip')).not.toBeInTheDocument()
  })
})

describe('WhatChangedChip — diffs the last two runs (newest-first order)', () => {
  it('compares runs[0] against runs[1], NOT the oldest runs', () => {
    // Newest-first: latest adds node 'c' vs previous. The two OLDER runs
    // differ wildly — the pre-R6 component indexed runs[length-2] (the
    // second-oldest) and would report that delta instead.
    loadRunsMock.mockReturnValue([
      run({ nodes: [node('a', 'A'), node('b', 'B'), node('c', 'C')], edges: [] }), // latest
      run({ nodes: [node('a', 'A'), node('b', 'B')], edges: [] }), // previous
      run({ nodes: [], edges: [] }), // second-oldest (the buggy index)
      run({ nodes: [node('z', 'Z')], edges: [edge('ez', 1)] }), // oldest
    ])
    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    expect(chip.textContent).toMatch(/Nodes: \+1/)
    expect(chip.textContent).not.toMatch(/-\d/) // no removals in run0-vs-run1
  })

  it('counts added, removed, and label-modified nodes', () => {
    loadRunsMock.mockReturnValue([
      run({ nodes: [node('a', 'A renamed'), node('c', 'C')], edges: [] }),
      run({ nodes: [node('a', 'A'), node('b', 'B')], edges: [] }),
    ])
    render(<WhatChangedChip />)
    expect(screen.getByTestId('what-changed-chip').textContent).toMatch(/Nodes: \+1, -1, ~1/)
  })

  it('position-only moves are NOT counted as modified (layout is not an analytical delta)', () => {
    loadRunsMock.mockReturnValue([
      run({ nodes: [node('a', 'A', 500, 500)], edges: [] }),
      run({ nodes: [node('a', 'A', 0, 0)], edges: [] }),
    ])
    render(<WhatChangedChip />)
    expect(screen.queryByTestId('what-changed-chip')).not.toBeInTheDocument()
  })

  it('counts edge weight/belief changes as modified', () => {
    loadRunsMock.mockReturnValue([
      run({ nodes: [node('a', 'A')], edges: [edge('e1', 0.9), edge('e2', 0.5, 0.2)] }),
      run({ nodes: [node('a', 'A')], edges: [edge('e1', 0.5), edge('e2', 0.5, 0.9)] }),
    ])
    render(<WhatChangedChip />)
    expect(screen.getByTestId('what-changed-chip').textContent).toMatch(/Edges: ~2/)
  })

  it('ignores the live canvas — the delta is between stored analyses', () => {
    // No canvas store seeding at all: chip output must come from runs alone.
    loadRunsMock.mockReturnValue([
      run({ nodes: [node('a', 'A'), node('n2', 'New')], edges: [] }),
      run({ nodes: [node('a', 'A')], edges: [] }),
    ])
    render(<WhatChangedChip />)
    expect(screen.getByTestId('what-changed-chip').textContent).toMatch(/Nodes: \+1/)
  })
})

describe('WhatChangedChip — click-to-highlight (the docstring promise, now real)', () => {
  it('is a button; click pulses the added+modified element ids', () => {
    loadRunsMock.mockReturnValue([
      run({
        nodes: [node('a', 'A renamed'), node('c', 'C')],
        edges: [edge('e1', 0.9), edge('e-new', 0.4)],
      }),
      run({ nodes: [node('a', 'A'), node('b', 'B')], edges: [edge('e1', 0.5)] }),
    ])
    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    expect(chip.tagName).toBe('BUTTON')
    fireEvent.click(chip)
    expect(pulseMock).toHaveBeenCalledTimes(1)
    const arg = pulseMock.mock.calls[0][0]
    expect([...arg.nodeIds].sort()).toEqual(['a', 'c']) // modified + added; removed 'b' excluded
    expect([...arg.edgeIds].sort()).toEqual(['e-new', 'e1'])
  })

  it('a removals-only delta still shows the chip but the click pulses nothing', () => {
    loadRunsMock.mockReturnValue([
      run({ nodes: [node('a', 'A')], edges: [] }),
      run({ nodes: [node('a', 'A'), node('b', 'B')], edges: [] }),
    ])
    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    expect(chip.textContent).toMatch(/Nodes: -1/)
    fireEvent.click(chip)
    expect(pulseMock).toHaveBeenCalledWith({ nodeIds: [], edgeIds: [] })
  })
})

describe('WhatChangedChip — honesty + a11y + DS', () => {
  beforeEach(() => {
    loadRunsMock.mockReturnValue([
      run({ nodes: [node('a', 'A'), node('c', 'C')], edges: [] }),
      run({ nodes: [node('a', 'A')], edges: [] }),
    ])
  })

  it('copy states the client-side previous-run basis', () => {
    render(<WhatChangedChip />)
    expect(screen.getByTestId('what-changed-chip').textContent).toMatch(/since your last run/i)
  })

  it('has an accessible label naming the delta and the highlight action', () => {
    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    expect(chip).toHaveAttribute('aria-label', expect.stringMatching(/highlight/i))
    expect(chip).toHaveAttribute('type', 'button')
  })

  it('keeps the outlined-pill DS identity (no filled pill, no text-colour copy token)', () => {
    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    expect(chip.className).toContain('bg-transparent')
    expect(chip.className).toContain('border-info/30')
    expect(chip.className).toContain('text-text-body')
    expect(chip.className).not.toMatch(/(^| )text-info( |$)/)
  })
})
describe("Paul's ruling (2026-07-12): keep + improve — honest basis, clear iconography", () => {
  beforeEach(() => {
    loadRunsMock.mockReturnValue([
      run({ nodes: [node('a', 'A'), node('c', 'C')], edges: [] }),
      run({ nodes: [node('a', 'A')], edges: [] }),
    ])
  })

  it('the device-local basis is a VISIBLE label, not tooltip-only', () => {
    render(<WhatChangedChip />)
    expect(screen.getByText('Compared with your previous run on this device')).toBeInTheDocument()
  })

  it('uses a compare glyph, not the sort-reading ArrowUpDown', () => {
    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    expect(chip.querySelector('.lucide-arrow-up-down')).toBeNull()
    // Pin the ACTUAL glyph, not just the absence of the old one (review F11).
    expect(chip.querySelector('.lucide-git-compare-arrows')).not.toBeNull()
    expect(chip.querySelector('svg')).not.toBeNull()
  })
})
