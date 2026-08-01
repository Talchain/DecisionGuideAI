/**
 * ROADMAP 2.263 F1 — the Model tab must not claim a direction nobody stated.
 *
 * THE DEFECT, at the bytes it was found at (tip d04c5a9b):
 *   · `@talchain/schemas` 0.30.0 declares
 *       effect_direction?: 'positive' | 'negative' | 'unknown'
 *     so a producer has three ways to decline: omit it, send `'unknown'`, or
 *     send something unrecognised.
 *   · `DraftChat.tsx:522` and `applyDraftResult.ts:93` both did
 *       directionFromEdge ?? (rawWeight < 0 ? 'negative' : 'positive')
 *     collapsing ALL of them to `'positive'`.
 *   · `RelationshipsSection.tsx:166` re-collapsed with a ternary whose two live
 *     branches both ended at `'positive'`.
 *   · `strengthBands.ts:56` then read the direction back off the SIGN of a
 *     number the UI had itself signed from that default.
 *   → The user read **"Strong positive effect"** on an edge whose producer
 *     never stated a direction.
 *
 * CLAIM TYPE: rendered TEXT and rendered CLASS TOKENS. jsdom cannot prove
 * visibility or layout (trap 3), and nothing here tries to — the assertions are
 * on the strings and the class strings the component emits.
 *
 * ⚠ THE POSITIVE CONTROLS ARE LOAD-BEARING. A suite that only proves "unknown
 * does not say positive" also passes if the component stops saying 'positive'
 * ever — including for edges that really are positive. Each absence assertion
 * below is paired with a presence assertion on a genuinely-directed edge, so
 * the tests can tell a fix from a lobotomy (trap 13).
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { RelationshipsSection } from '../RelationshipsSection'
import { getStrengthLabel } from '../strengthBands'
import {
  resolveEdgeDirectionDisplay,
  directionFromProducerSignedMean,
  edgeValueSourcePatch,
} from '../../../domain/edgeValueProvenance'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const { mockStoreState } = vi.hoisted(() => ({
  mockStoreState: {
    updateEdge: vi.fn(),
    setHighlightedEdges: vi.fn(),
    setHighlightedNodes: vi.fn(),
    highlightedEdges: new Set<string>(),
    edges: [] as unknown[],
  },
}))

vi.mock('../../../store', () => {
  const useCanvasStore = Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(mockStoreState)),
    { getState: () => mockStoreState },
  )
  return { useCanvasStore }
})

vi.mock('../../../utils/focusHelpers', () => ({
  focusEdgeById: vi.fn(),
  focusNodeById: vi.fn(),
}))

vi.mock('../../../utils/evidenceCoverage', () => ({
  NON_EVIDENCE_PROVENANCE: ['assumption', 'template', 'ai-suggested'],
}))

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../ui/inspector/SignedStrengthSlider', () => ({
  SignedStrengthSlider: () => <input type="range" data-testid="mock-strength-slider" />,
}))

const nodes: Node[] = [
  { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor A' } },
  { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor B' } },
]

/**
 * The four wire shapes that matter, all with the SAME magnitude (0.7 → "Strong")
 * so that any difference in the rendered label is attributable to the direction
 * evidence and to nothing else.
 */
function edgeWith(id: string, data: Record<string, unknown>): Edge {
  return {
    id,
    source: 'f1',
    target: 'f2',
    data: {
      weight: 0.7,
      beliefExists: 0.7,
      provenance: 'assumption',
      // `weight` is stamped throughout: the card is provenance-gated on the
      // NUMBER, so an unstamped weight renders "Not set" and would mask the
      // direction question entirely.
      ...edgeValueSourcePatch({ weight: 'cee', beliefExists: 'cee' }),
      ...data,
    },
  } as Edge
}

/** Producer stated a direction. THE POSITIVE CONTROL. */
const statedPositive = () =>
  edgeWith('stated-pos', { direction: 'positive', ...edgeValueSourcePatch({ direction: 'cee' }) })

/** Producer stated the other direction. Discrimination control. */
const statedNegative = () =>
  edgeWith('stated-neg', { direction: 'negative', ...edgeValueSourcePatch({ direction: 'cee' }) })

/**
 * Producer sent `effect_direction: 'unknown'` — a DECLARED 0.30.0 contract
 * member. Ingestion still writes the defaulted `direction: 'positive'` beside
 * it (that byte is deliberately unchanged), so this fixture is exactly what the
 * store holds today for such an edge.
 */
const producerSaidUnknown = () =>
  edgeWith('unknown-dir', { direction: 'positive', effect_direction: 'unknown' })

/** Producer omitted the field. Ingestion's `?? 'positive'` fallback fired. */
const producerSaidNothing = () => edgeWith('absent-dir', { direction: 'positive' })

// ── The resolver — the one owner of the rule ─────────────────────────────────

describe('resolveEdgeDirectionDisplay', () => {
  it('reports a producer-stated direction, with its source (POSITIVE CONTROL)', () => {
    const r = resolveEdgeDirectionDisplay(statedPositive().data as Record<string, unknown>)
    expect(r).toEqual({ show: true, direction: 'positive', source: 'cee' })
  })

  it('reports a stated negative direction (DISCRIMINATION CONTROL)', () => {
    const r = resolveEdgeDirectionDisplay(statedNegative().data as Record<string, unknown>)
    expect(r).toEqual({ show: true, direction: 'negative', source: 'cee' })
  })

  it("does NOT show a direction when the producer sent 'unknown'", () => {
    const r = resolveEdgeDirectionDisplay(producerSaidUnknown().data as Record<string, unknown>)
    expect(r.show).toBe(false)
    // The explicit decline is distinguishable from mere silence, and it must
    // beat the defaulted `direction: 'positive'` sitting on the same edge.
    expect(r).toEqual({ show: false, reason: 'unknown' })
  })

  it('does NOT show a direction when the producer omitted the field', () => {
    const r = resolveEdgeDirectionDisplay(producerSaidNothing().data as Record<string, unknown>)
    expect(r.show).toBe(false)
    expect(r).toEqual({ show: false, reason: 'not_set' })
  })

  it('fails CLOSED on an unrecognised value even when a source stamp is present', () => {
    const r = resolveEdgeDirectionDisplay({
      direction: 'sideways',
      ...edgeValueSourcePatch({ direction: 'cee' }),
    })
    expect(r.show).toBe(false)
  })

  it('accepts the raw CEE `effect_direction` spelling as evidence (back-compat)', () => {
    // Graphs saved before the marker existed carry no stamp, but nothing in the
    // UI fabricates `effect_direction`, so its presence proves a producer.
    const r = resolveEdgeDirectionDisplay({ effect_direction: 'negative' })
    expect(r).toEqual({ show: true, direction: 'negative', source: 'cee' })
  })

  it('reports `absent` for an edge carrying no direction at all', () => {
    expect(resolveEdgeDirectionDisplay({ weight: 0.4 })).toEqual({ show: false, reason: 'absent' })
  })
})

// ── The label — no direction may be read off a magnitude ─────────────────────

describe('getStrengthLabel', () => {
  it('names the direction when it is stated (POSITIVE CONTROL)', () => {
    expect(getStrengthLabel(0.7, { show: true, direction: 'positive', source: 'cee' }))
      .toBe('Strong positive effect')
    expect(getStrengthLabel(-0.7, { show: true, direction: 'negative', source: 'cee' }))
      .toBe('Strong negative effect')
  })

  it('says the direction was not stated rather than inferring one from the sign', () => {
    const label = getStrengthLabel(0.7, { show: false, reason: 'unknown' })
    expect(label).toBe('Strong effect, direction not stated')
    expect(label).not.toMatch(/positive|negative/)
  })

  it('does not invent a NEGATIVE direction from a negative magnitude either', () => {
    // The old code would have said "Strong negative effect" here purely because
    // the number was below zero. Absence is absence in both directions.
    expect(getStrengthLabel(-0.7, { show: false, reason: 'absent' }))
      .toBe('Strong effect, direction not stated')
  })

  it('keeps the direction-free negligible label unchanged', () => {
    expect(getStrengthLabel(0.01, { show: true, direction: 'positive', source: 'cee' }))
      .toBe('Negligible effect')
  })
})

describe('directionFromProducerSignedMean', () => {
  it('reads the sign of a PRODUCER-signed validator mean as that pass’s direction', () => {
    expect(directionFromProducerSignedMean(-0.42))
      .toEqual({ show: true, direction: 'negative', source: 'cee' })
    expect(directionFromProducerSignedMean(0.42))
      .toEqual({ show: true, direction: 'positive', source: 'cee' })
  })

  it('shows nothing for a non-finite mean', () => {
    expect(directionFromProducerSignedMean(Number.NaN).show).toBe(false)
  })
})

// ── The rendered card ────────────────────────────────────────────────────────

describe('RelationshipsSection — rendered direction claims', () => {
  it('renders "Strong positive effect" for a genuinely positive edge (POSITIVE CONTROL)', () => {
    render(<RelationshipsSection edges={[statedPositive()]} nodes={nodes} />)
    expect(screen.getAllByText('Strong positive effect').length).toBeGreaterThan(0)
  })

  it('renders "Strong negative effect" for a genuinely negative edge (CONTROL)', () => {
    render(<RelationshipsSection edges={[statedNegative()]} nodes={nodes} />)
    expect(screen.getAllByText('Strong negative effect').length).toBeGreaterThan(0)
  })

  it("never says 'positive' for an edge the producer marked 'unknown'", () => {
    render(<RelationshipsSection edges={[producerSaidUnknown()]} nodes={nodes} />)
    expect(screen.queryByText(/positive effect/i)).toBeNull()
    expect(screen.getAllByText('Strong effect, direction not stated').length).toBeGreaterThan(0)
  })

  it("never says 'positive' for an edge whose producer omitted the direction", () => {
    render(<RelationshipsSection edges={[producerSaidNothing()]} nodes={nodes} />)
    expect(screen.queryByText(/positive effect/i)).toBeNull()
    expect(screen.getAllByText('Strong effect, direction not stated').length).toBeGreaterThan(0)
  })

  it('does not print a leading + on an undirected magnitude', () => {
    // The `+` is a direction claim with no words attached — the quiet channel
    // that survived the previous sweeps.
    const { container } = render(
      <RelationshipsSection edges={[producerSaidNothing()]} nodes={nodes} />,
    )
    expect(container.textContent).toContain('0.70')
    expect(container.textContent).not.toContain('+0.70')
  })

  it('DOES print a leading + when the direction is stated (CONTROL)', () => {
    const { container } = render(<RelationshipsSection edges={[statedPositive()]} nodes={nodes} />)
    expect(container.textContent).toContain('+0.70')
  })

  it('does not paint an undirected edge with the positive tone class', () => {
    const { container } = render(
      <RelationshipsSection edges={[producerSaidNothing()]} nodes={nodes} />,
    )
    const summary = container.querySelector('[data-testid="edge-absent-dir-summary"]')
    expect(summary).not.toBeNull()
    expect(summary!.innerHTML).not.toContain('text-success')
  })

  it('DOES paint a stated-positive edge with the positive tone class (CONTROL)', () => {
    const { container } = render(<RelationshipsSection edges={[statedPositive()]} nodes={nodes} />)
    const summary = container.querySelector('[data-testid="edge-stated-pos-summary"]')
    expect(summary).not.toBeNull()
    expect(summary!.innerHTML).toContain('text-success')
  })
})
