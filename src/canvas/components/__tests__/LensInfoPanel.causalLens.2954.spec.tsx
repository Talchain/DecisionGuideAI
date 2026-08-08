/**
 * ROADMAP 2.954 — the causal table must not sign or speak a strength nobody
 * set. Same defect family as the canvas label (see
 * StyledEdge.causalLens.2954.spec.tsx): the Mean column rendered
 * `computeSignedMean`'s output — `+0.50` for a fully-defaulted edge, a
 * UI-signed `-0.35` for a producer-declined direction.
 *
 * Copy: an unset Mean renders this table's OWN absent-quantity mark — the em
 * dash its Std / P(exists) cells have always used (no new copy, #629 rule).
 * A stated direction signs with U+2212 / '+'; an unstated one prints the bare
 * magnitude.
 *
 * Pattern: real store via setState (the file's sibling spec's technique), map
 * populated through the REAL exported producer so the chain producer → store →
 * table is the one under test. State-class: seeded, fresh per test.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LensInfoPanel } from '../LensInfoPanel'
import { useCanvasStore } from '../../store'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { resolveCausalLensEdgeParams } from '../../domain/edgeValueProvenance'
import { USER_EDGE_DEFAULTS } from '../../domain/edges'

const EM_DASH = '—'

type WireEdge = Record<string, unknown>

function findEdge(from: string, to: string): WireEdge {
  const p = resolve(__dirname, '../../starters/data', 'pricing-model.draft.json')
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const edges = (j.edges ?? j.graph?.edges ?? []) as WireEdge[]
  const hit = edges.find(e => e.from === from && e.to === to)
  expect(hit, `capture no longer carries ${from} → ${to}`).toBeDefined()
  return hit as WireEdge
}

const SET_WIRE = findEdge('fac_adoption_friction', 'out_bottom_up_growth')
const UNKNOWN_DIR_WIRE: WireEdge = { ...SET_WIRE, effect_direction: 'unknown' }

const SET_DATA = mapDraftEdgeToCanvas(SET_WIRE, 0).data as Record<string, unknown>
const UNKNOWN_DIR_DATA = mapDraftEdgeToCanvas(UNKNOWN_DIR_WIRE, 0).data as Record<string, unknown>
const USER_DATA: Record<string, unknown> = { ...USER_EDGE_DEFAULTS }

/** Seed the causal lens with ONE edge whose params come from the real producer. */
function seedCausalLens(edgeId: string, data: Record<string, unknown>): void {
  useCanvasStore.setState({
    nodes: [
      { id: 'n-from', data: { label: 'From node' }, position: { x: 0, y: 0 } },
      { id: 'n-to', data: { label: 'To node' }, position: { x: 0, y: 0 } },
    ] as never,
    edges: [
      { id: edgeId, source: 'n-from', target: 'n-to', data },
    ] as never,
    lens: {
      ...useCanvasStore.getState().lens,
      active: 'causal',
      _causalEdgeParams: new Map([[edgeId, resolveCausalLensEdgeParams(data)]]),
    },
  } as never)
}

/** The Mean cell of the single seeded row, located via its row's From label. */
function meanCellText(): string {
  fireEvent.click(screen.getByText(/Show edge table/))
  const fromCell = screen.getByTitle('From node')
  const row = fromCell.closest('tr') as HTMLTableRowElement
  expect(row, 'the edge row did not render').not.toBeNull()
  // Columns: From | To | Mean | Std | P(exists)
  return row.cells[2].textContent ?? ''
}

function rowCells(): { mean: string; std: string; exists: string } {
  fireEvent.click(screen.getByText(/Show edge table/))
  const row = screen.getByTitle('From node').closest('tr') as HTMLTableRowElement
  return {
    mean: row.cells[2].textContent ?? '',
    std: row.cells[3].textContent ?? '',
    exists: row.cells[4].textContent ?? '',
  }
}

describe('LensInfoPanel causal table — provenance-gated Mean (ROADMAP 2.954)', () => {
  beforeEach(() => {
    localStorage.setItem('feature.graphLens', '1')
  })

  afterEach(() => {
    localStorage.removeItem('feature.graphLens')
    useCanvasStore.setState({
      nodes: [] as never,
      edges: [] as never,
      lens: {
        ...useCanvasStore.getState().lens,
        active: 'full',
        _causalEdgeParams: new Map(),
      },
    } as never)
  })

  it('a stated edge prints the signed mean (U+2212), std and P(exists) — the producer numbers', () => {
    seedCausalLens('e-0', SET_DATA)
    render(<LensInfoPanel />)
    expect(rowCells()).toEqual({ mean: '−0.35', std: '0.11', exists: '88%' })
  })

  it('a producer-declined direction prints the BARE magnitude — no sign [ROADMAP 2.954]', () => {
    seedCausalLens('e-0', UNKNOWN_DIR_DATA)
    render(<LensInfoPanel />)
    const mean = meanCellText()
    expect(mean).toBe('0.35')
    expect(mean).not.toMatch(/[+\-−]/)
  })

  it('a user-drawn edge (all channels defaulted) prints em dashes across the row [ROADMAP 2.954]', () => {
    seedCausalLens('e-0', USER_DATA)
    render(<LensInfoPanel />)
    expect(rowCells()).toEqual({ mean: EM_DASH, std: EM_DASH, exists: EM_DASH })
  })

  it('CONTROL: the em dash is absence, not a formatting accident — the stated edge shows none', () => {
    seedCausalLens('e-0', SET_DATA)
    render(<LensInfoPanel />)
    const cells = rowCells()
    expect(cells.mean).not.toContain(EM_DASH)
    expect(cells.std).not.toContain(EM_DASH)
    expect(cells.exists).not.toContain(EM_DASH)
  })
})
