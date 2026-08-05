/**
 * NodeInspector — 2.468(a): honest rendering of distribution-form priors.
 *
 * `data.prior` is a union (PriorSchema, nodes.ts): a number 0–1 OR a CEE
 * distribution object `{distribution, range_min, range_max}`. The object form
 * is LIVE: useInspectorMutations.setPriorRange writes it, and drafted graphs
 * carry it — the fac_capacity / fac_weather nodes below are byte-copies from
 * the walk-582 export fixture
 * (PHASE0-EVIDENCE-2026-07-28/walk-582-raw/t2b-export-pristine.json).
 *
 * Numeric formatting of the object form (`prior * 100`) renders the literal
 * "NaN%" on screen. These specs make "NaN" impossible on this surface:
 * a distribution prior with a finite range renders as its normalised range in
 * plain words (never percent-coerced — the endpoints are normalised values,
 * not probabilities); a distribution prior without a finite range renders
 * nothing; and the numeric-prior positive control proves the surface still
 * renders percent (so the "no NaN" sweeps are looking at a live surface).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NodeInspector } from '../NodeInspector'
import { useCanvasStore } from '../../store'

/** Byte-copy of the fac_capacity node from t2b-export-pristine.json. */
const FAC_CAPACITY = {
  id: 'fac_capacity',
  type: 'factor',
  position: { x: 24, y: 321 },
  data: {
    category: 'external',
    prior: { distribution: 'uniform', range_min: 0.3, range_max: 1 },
    display_value: '0.3 to 1',
    provenance: 'ai_inferred',
    label: 'Venue Capacity',
    kind: 'factor',
  },
}

/**
 * fac_price, from the REAL CEE payload
 * `PHASE0-EVIDENCE-2026-07-28/replay-payload-747.json` → `graph.nodes[2]`:
 *   { "id": "fac_price", "kind": "factor", "label": "Price",
 *     "category": "controllable",
 *     "prior": {"distribution":"uniform","range_min":10,"range_max":30} }
 * The `prior` object and the id/label/kind/category are byte-copies; the
 * envelope is re-shaped from the CEE wire form (top-level `prior`) to the
 * canvas store form (`data.prior`), which is what mapDraftNodeToCanvas does.
 * Endpoints 10–30 are OUTSIDE [0,1] — the witnessed counter-example to any
 * hardcoded scale claim (#589 review F1).
 */
const FAC_PRICE = {
  id: 'fac_price',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: {
    category: 'controllable',
    prior: { distribution: 'uniform', range_min: 10, range_max: 30 },
    label: 'Price',
    kind: 'factor',
  },
}

/** Byte-copy of the fac_weather node from t2b-export-pristine.json. */
const FAC_WEATHER = {
  id: 'fac_weather',
  type: 'factor',
  position: { x: 1480, y: 321 },
  data: {
    category: 'external',
    prior: { distribution: 'uniform', range_min: 0, range_max: 1 },
    provenance: 'ai_inferred',
    label: 'Weather Conditions on Event Day',
    kind: 'factor',
  },
}

function setStore(nodes: unknown[]) {
  useCanvasStore.setState({
    nodes: nodes as never,
    edges: [],
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    results: { status: 'idle', report: null } as never,
  })
}

afterEach(() => {
  cleanup()
})

describe('NodeInspector — distribution-form priors render honestly (2.468a)', () => {
  it('fixture node fac_capacity ("Venue Capacity", uniform 0.3–1): renders the range in plain words, never "NaN"', () => {
    setStore([FAC_CAPACITY])
    const { container } = render(<NodeInspector nodeId="fac_capacity" onClose={() => {}} />)

    // Identity: this render is THE fixture node.
    expect(screen.getByText('Venue Capacity')).toBeDefined()

    // Summary KPI row: normalised range in the inspector's voice.
    expect(screen.getByText('0.3 to 1 on 0–1 scale')).toBeDefined()
    // Assumptions section: plain words, same numbers.
    expect(screen.getByText('Between 0.3 and 1 on 0–1 scale')).toBeDefined()

    // A distribution prior is not a probability: no percent progressbar.
    expect(screen.queryByRole('progressbar')).toBeNull()

    // "NaN" is impossible anywhere in the rendered inspector.
    expect(container.textContent).not.toContain('NaN')
  })

  it('fixture node fac_weather (uniform 0–1): range_min 0 renders honestly, not suppressed', () => {
    setStore([FAC_WEATHER])
    const { container } = render(<NodeInspector nodeId="fac_weather" onClose={() => {}} />)

    expect(screen.getByText('Weather Conditions on Event Day')).toBeDefined()
    expect(screen.getByText('0 to 1 on 0–1 scale')).toBeDefined()
    expect(screen.getByText('Between 0 and 1 on 0–1 scale')).toBeDefined()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(container.textContent).not.toContain('NaN')
  })

  it('POSITIVE CONTROL — numeric prior still renders percent in both rows (proves the surface renders values the NaN sweep could see)', () => {
    setStore([
      {
        id: 'fac_num',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Adoption Rate', kind: 'factor', prior: 0.72 },
      },
    ])
    const { container } = render(<NodeInspector nodeId="fac_num" onClose={() => {}} />)

    expect(screen.getByText('Adoption Rate')).toBeDefined()
    // Summary KPI row + Assumptions bar readout: exactly the two percent renders.
    expect(screen.getAllByText('72%')).toHaveLength(2)
    // The Assumptions progressbar keeps its numeric semantics.
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('0.72')
    expect(bar.getAttribute('aria-valuetext')).toBe('72%')
    expect(container.textContent).not.toContain('NaN')
  })

  it('WITNESSED OUT-OF-SCALE payload fac_price ("Price", uniform 10–30): renders the bare range and makes NO scale claim (F1)', () => {
    setStore([FAC_PRICE])
    const { container } = render(<NodeInspector nodeId="fac_price" onClose={() => {}} />)

    // Identity: this render is THE fac_price node from replay-payload-747.json.
    expect(screen.getByText('Price')).toBeDefined()

    // Bare range in both rows — the numbers are the stored bounds, honestly.
    expect(screen.getByText('10 to 30')).toBeDefined()
    expect(screen.getByText('Between 10 and 30')).toBeDefined()

    // The claim the endpoints have NOT earned must appear NOWHERE on the surface.
    expect(container.textContent).not.toContain('0–1 scale')
    expect(container.textContent).not.toContain('NaN')
  })

  it('a single out-of-scale endpoint is enough to withhold the suffix (range_min -0.5, range_max 0.5)', () => {
    setStore([
      {
        id: 'fac_delta',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Margin Delta', kind: 'factor', prior: { distribution: 'uniform', range_min: -0.5, range_max: 0.5 } },
      },
    ])
    const { container } = render(<NodeInspector nodeId="fac_delta" onClose={() => {}} />)

    expect(screen.getByText('Margin Delta')).toBeDefined()
    expect(screen.getByText('-0.5 to 0.5')).toBeDefined()
    expect(container.textContent).not.toContain('0–1 scale')
    expect(container.textContent).not.toContain('NaN')
  })

  it('partial range (one bound only): both prior rows are suppressed — pinned as current behaviour, policy rowed (F6)', () => {
    setStore([
      {
        id: 'fac_partial',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Supplier Lead Time', kind: 'factor', prior: { distribution: 'uniform', range_min: 0.3 } },
      },
    ])
    const { container } = render(<NodeInspector nodeId="fac_partial" onClose={() => {}} />)

    expect(screen.getByText('Supplier Lead Time')).toBeDefined()
    expect(screen.queryByText('Prior')).toBeNull()
    expect(screen.queryByText(/belief before evidence/)).toBeNull()
    expect(container.textContent).not.toContain('NaN')
  })

  it('distribution object WITHOUT a finite range: both prior rows are suppressed, never "NaN"', () => {
    setStore([
      {
        id: 'fac_rangeless',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Regulatory Climate', kind: 'factor', prior: { distribution: 'uniform' } },
      },
    ])
    const { container } = render(<NodeInspector nodeId="fac_rangeless" onClose={() => {}} />)

    expect(screen.getByText('Regulatory Climate')).toBeDefined()
    // Summary KPI row absent (its label span renders the exact text "Prior").
    expect(screen.queryByText('Prior')).toBeNull()
    // Assumptions row absent (its label carries "belief before evidence").
    expect(screen.queryByText(/belief before evidence/)).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(container.textContent).not.toContain('NaN')
  })
})
