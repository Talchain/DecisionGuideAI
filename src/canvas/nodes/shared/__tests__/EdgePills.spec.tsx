/**
 * EdgePills — brief scope 1: always-on factor-card pills now carry direction +
 * the target's label (verbatim) alongside the strength %, with graceful
 * omission (never a throw, never a bare "%") when a label is absent.
 *
 * ⚠ Every fixture below now carries `weightSource: 'cee'`. These cases are
 * about rendering a KNOWN strength, and a known strength is exactly what a
 * source stamp means. The unstamped case is no longer "the same but quieter" —
 * it is a different, disclosed state, covered in its own describe block at the
 * bottom of this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePills } from '../EdgePills'
import { USER_EDGE_DEFAULTS } from '../../../domain/edges'

type AnyState = Record<string, unknown>
const makeState = (over: AnyState = {}): AnyState => ({ edges: [], nodes: [], ...over })

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((sel) => sel(makeState())),
}))

import { useCanvasStore } from '../../../store'

const mockStore = (state: AnyState) =>
  vi.mocked(useCanvasStore).mockImplementation((sel) => sel(state as never))

describe('EdgePills', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders direction + percentage + the verbatim target label (decode path)', () => {
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.45, direction: 'positive', weightSource: 'cee' } }],
      nodes: [{ id: 'o1', type: 'outcome', data: { label: 'Market position' } }],
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    expect(screen.getByText('Market position')).toBeDefined()
    expect(container.textContent).toContain('45%')
    // Positive → "raises" → success-coloured arrow.
    expect(container.querySelector('.text-success')).toBeTruthy()
  })

  it('uses a danger (lowers) arrow for negative edges', () => {
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'r1', data: { weight: 0.65, direction: 'negative', weightSource: 'cee' } }],
      nodes: [{ id: 'r1', type: 'risk', data: { label: 'Burn rate' } }],
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    expect(screen.getByText('Burn rate')).toBeDefined()
    expect(container.textContent).toContain('65%')
    expect(container.querySelector('.text-danger')).toBeTruthy()
  })

  it('omits the pill (no bare value, no throw) when the target label is absent', () => {
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.65, direction: 'negative', weightSource: 'cee' } }],
      nodes: [{ id: 'o1', type: 'risk', data: {} }], // no label
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    expect(screen.queryByText('65%')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('caps visible pills at 4 (top by strength)', () => {
    const edges = Array.from({ length: 6 }, (_, i) => ({
      id: `e${i}`, source: 'f1', target: `o${i}`, data: { weight: 0.9 - i * 0.1, direction: 'positive', weightSource: 'cee' },
    }))
    const nodes = Array.from({ length: 6 }, (_, i) => ({
      id: `o${i}`, type: 'outcome', data: { label: `Outcome ${i}` },
    }))
    mockStore(makeState({ edges, nodes }))
    render(<EdgePills nodeId="f1" />)
    expect(screen.queryAllByText(/^Outcome \d$/).length).toBe(4)
  })

  it('only pills outcome/risk targets (skips other kinds)', () => {
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive', weightSource: 'cee' } }],
      nodes: [{ id: 'g1', type: 'goal', data: { label: 'My goal' } }],
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    expect(container.textContent).toBe('')
  })

  // Brief amendment A6: target labels render VERBATIM — never truncated,
  // abbreviated, or rewritten. A long label must appear in full.
  it('renders a long target label verbatim (no truncation)', () => {
    const longLabel = 'Founder Equity Dilution Across Multiple Funding Rounds'
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.45, direction: 'positive', weightSource: 'cee' } }],
      nodes: [{ id: 'o1', type: 'risk', data: { label: longLabel } }],
    }))
    render(<EdgePills nodeId="f1" />)
    expect(screen.getByText(longLabel)).toBeDefined()
  })

  // A11y: the arrow glyph is aria-hidden, so direction is exposed to screen
  // readers via visually-hidden approved "Raises"/"Lowers" text. Visible UI
  // is unchanged (the text is sr-only / out of flow).
  it('exposes direction to screen readers as "Raises"/"Lowers"', () => {
    mockStore(makeState({
      edges: [
        { id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.45, direction: 'positive', weightSource: 'cee' } },
        { id: 'e2', source: 'f1', target: 'r1', data: { weight: 0.65, direction: 'negative', weightSource: 'cee' } },
      ],
      nodes: [
        { id: 'o1', type: 'outcome', data: { label: 'Revenue Growth' } },
        { id: 'r1', type: 'risk', data: { label: 'Cash Runway Pressure' } },
      ],
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    expect(screen.getByText('Raises')).toBeDefined()
    expect(screen.getByText('Lowers')).toBeDefined()
    // Visually hidden (sr-only) — present for assistive tech, out of visible flow.
    expect(container.querySelector('.sr-only')).toBeTruthy()
  })
})

// Audit §8 P0-4: strength vs confidence labelling — the pill % is link
// STRENGTH and must be self-identifying (title + aria), distinguishable from
// ConnRow's "N% conf." confidence format.
describe('EdgePills — strength labelling (audit §8 P0-4)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exposes the strength title and aria label on the percentage', () => {
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.3, direction: 'positive', weightSource: 'cee' } }],
      nodes: [{ id: 'o1', type: 'outcome', data: { label: 'Shipping speed' } }],
    }))
    render(<EdgePills nodeId="f1" />)
    const pct = screen.getByText('30%')
    expect(pct.getAttribute('title')).toBe('Link strength')
    expect(pct.getAttribute('aria-label')).toBe('30% link strength')
  })
})

/**
 * P1-10 — a UI default is not a link strength.
 *
 * `computeSignedMean` falls back to `weight`, which `USER_EDGE_DEFAULTS` pins
 * at 0.3 and `DEFAULT_EDGE_DATA` at 0.5. A freshly drawn edge therefore
 * announced "30% link strength" and a "Raises" direction that came from
 * `USER_EDGE_DEFAULTS.direction` — two claims nobody had made.
 *
 * ESCAPES THESE TESTS ARE WRITTEN TO CATCH:
 *  1. `container.textContent` WELDS adjacent text nodes ("Not set" + label →
 *     "Not setRevenue"), so a `getByText('Not set')` on the whole container can
 *     silently fail-or-pass for the wrong reason. Every assertion below targets
 *     the specific element by testid or exact-node matcher.
 *  2. Asserting only "30% is absent" would also pass if the pill vanished
 *     entirely — which is a DIFFERENT, worse outcome (the user's own connection
 *     disappears). Each case asserts the label IS still rendered.
 */
describe('EdgePills — unset strength is disclosed, not reported', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const unsetState = makeState({
    edges: [{ id: 'e1', source: 'f1', target: 'o1', data: { ...USER_EDGE_DEFAULTS } }],
    nodes: [{ id: 'o1', type: 'outcome', data: { label: 'Revenue' } }],
  })

  it('does not report the USER_EDGE_DEFAULTS weight as a measured strength', () => {
    mockStore(unsetState)
    render(<EdgePills nodeId="f1" />)
    // The default IS 0.3 — the number exists, which is why presence was never
    // a usable test.
    expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
    expect(screen.queryByText('30%')).toBeNull()
    expect(screen.queryByLabelText('30% link strength')).toBeNull()
  })

  it('keeps the pill and its verbatim label — the connection is real even when the number is not', () => {
    mockStore(unsetState)
    render(<EdgePills nodeId="f1" />)
    expect(screen.getByText('Revenue')).toBeDefined()
  })

  it('says "Not set" on the specific element, with an announceable label', () => {
    mockStore(unsetState)
    render(<EdgePills nodeId="f1" />)
    const marker = screen.getByTestId('edge-pill-strength-unset-e1')
    expect(marker.textContent).toBe('Not set')
    expect(marker.getAttribute('aria-label')).toBe('Link strength not set')
    expect(marker.getAttribute('title')).toContain('not set')
  })

  it('omits the direction arrow AND the "Raises"/"Lowers" text — direction is defaulted too', () => {
    mockStore(unsetState)
    const { container } = render(<EdgePills nodeId="f1" />)
    // USER_EDGE_DEFAULTS.direction is 'positive'; without this gate the pill
    // asserted "Raises" about a link the user never characterised.
    expect(USER_EDGE_DEFAULTS.direction).toBe('positive')
    expect(screen.queryByText('Raises')).toBeNull()
    expect(screen.queryByText('Lowers')).toBeNull()
    expect(container.querySelector('.text-success')).toBeNull()
    expect(container.querySelector('.text-danger')).toBeNull()
  })

  // POSITIVE CONTROL — without it, every assertion above would pass against a
  // component that rendered "Not set" for absolutely everything.
  it('still reports a stamped strength normally (positive control)', () => {
    mockStore(makeState({
      edges: [{
        id: 'e1', source: 'f1', target: 'o1',
        data: { ...USER_EDGE_DEFAULTS, weight: 0.55, weightSource: 'user' },
      }],
      nodes: [{ id: 'o1', type: 'outcome', data: { label: 'Revenue' } }],
    }))
    render(<EdgePills nodeId="f1" />)
    expect(screen.getByText('55%')).toBeDefined()
    expect(screen.queryByTestId('edge-pill-strength-unset-e1')).toBeNull()
    expect(screen.getByText('Raises')).toBeDefined()
  })

  it('sorts unset pills after known strengths so the cap of 4 spends its slots on real numbers', () => {
    mockStore(makeState({
      edges: [
        { id: 'unset', source: 'f1', target: 'o0', data: { ...USER_EDGE_DEFAULTS } },
        { id: 'known', source: 'f1', target: 'o1', data: { weight: 0.1, direction: 'positive', weightSource: 'cee' } },
      ],
      nodes: [
        { id: 'o0', type: 'outcome', data: { label: 'Unset target' } },
        { id: 'o1', type: 'outcome', data: { label: 'Known target' } },
      ],
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    const labels = Array.from(container.querySelectorAll('span'))
      .map(el => el.textContent)
      .filter(t => t === 'Unset target' || t === 'Known target')
    expect(labels).toEqual(['Known target', 'Unset target'])
  })
})
