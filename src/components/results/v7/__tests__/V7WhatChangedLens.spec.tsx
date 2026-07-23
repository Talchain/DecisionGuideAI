/**
 * V7WhatChangedLens — V7 Lane L5 pins for the "What changed in the result"
 * lens body (spec row 6d).
 *
 * Two honest paths: the empty state (the COMMON case — run history is usually
 * empty on the live path) and a real run-over-run delta from the existing
 * runHistory exports. The lens reads run history READ-ONLY and never fabricates
 * a comparison.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V7WhatChangedLens } from '../V7WhatChangedLens'
import { STORAGE_KEY, type StoredRun } from '../../../../canvas/store/runHistory'

function run(
  id: string,
  ts: number,
  p50: number,
  edgeWeight: number,
  drivers: Array<{ kind: 'node' | 'edge'; id?: string; label?: string }>,
): StoredRun {
  return {
    id,
    ts,
    seed: 1,
    adapter: 'httpv1',
    summary: `run ${id}`,
    graphHash: `hash-${id}`,
    report: { run: { bands: { p50 } } },
    drivers,
    graph: { nodes: [], edges: [{ id: 'e1', data: { weight: edgeWeight } }] },
  } as unknown as StoredRun
}

const PRIOR = run('prior', 1000, 0.6, 0.5, [
  { kind: 'node', id: 'd1', label: 'Price' },
  { kind: 'node', id: 'd2', label: 'Demand' },
])
const LATEST = run('latest', 2000, 0.66, 0.8, [
  { kind: 'node', id: 'd2', label: 'Demand' },
  { kind: 'node', id: 'd3', label: 'Rates' },
])

beforeEach(() => {
  localStorage.clear()
})

describe('V7WhatChangedLens (V7 L5)', () => {
  it('renders the honest empty state when fewer than two runs exist', () => {
    render(<V7WhatChangedLens runs={[LATEST]} />)
    expect(screen.getByTestId('v7-what-changed-empty')).toBeInTheDocument()
    expect(screen.getByText('Snapshot unavailable — rerun to compare.')).toBeInTheDocument()
  })

  it('renders a real run-over-run delta (p50, edges, drivers added/removed) from two runs', () => {
    // compareRuns reads localStorage by id, so seed it (latest first).
    localStorage.setItem(STORAGE_KEY, JSON.stringify([LATEST, PRIOR]))
    render(<V7WhatChangedLens runs={[LATEST, PRIOR]} />)

    expect(screen.getByTestId('v7-what-changed')).toBeInTheDocument()
    // p50 of the latest run, with the signed delta vs prior.
    expect(screen.getByText(/p50 0\.66/)).toBeInTheDocument()
    expect(screen.getByTestId('v7-what-changed-delta')).toHaveTextContent('+0.06')
    // one edge weight changed (0.5 -> 0.8).
    expect(screen.getByTestId('v7-what-changed-edges')).toHaveTextContent('1 edge changed')
    // Rates is new in the latest run; Price is gone since prior.
    expect(screen.getByTestId('v7-what-changed-drivers-added')).toHaveTextContent('Rates')
    expect(screen.getByTestId('v7-what-changed-drivers-removed')).toHaveTextContent('Price')
  })
})
