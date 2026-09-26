/**
 * ONE RESTING ICON SET — contract v3.1 pt 6, gap U6 (24 Sep).
 *
 * Paul's screenshots sat either side of `ICON_LEGIBLE_ZOOM`: at 67% (`full`) the
 * cards carried the rail coaching icon; at 65% (`quiet`) the icon had gone but
 * a "?" still hung off factor corners and the corner coaching marker still
 * rendered. v3.1 pt 6: one discreet coaching icon at Normal zoom, hidden at
 * quiet/far zoom.
 *
 * ⭐ RED-before (at 24e06704): every `quiet`/`line` case below rendered its
 * glyph. The `full` cases are the contrast controls, so a zero at `quiet` is
 * not a blind probe.
 *
 * Real stores (no mocks): the rung is read from `useCanvasStore.lodRung`, the
 * slice `LodSync` writes.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { NodeCoachingMarker } from '../NodeCoachingMarker'
import { NodeStructuralMarker } from '../NodeStructuralMarker'
import { EvidenceGapBadge } from '../../EvidenceGapBadge'
import { selectRestingGlyphsShown } from '../restingGlyphRung'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore, type GuidanceItem } from '../../../stores/guidanceStore'

type Rung = 'full' | 'quiet' | 'line'
const HIDDEN_RUNGS: readonly Rung[] = ['quiet', 'line']

const setRung = (lodRung: Rung) => useCanvasStore.setState({ lodRung } as never, false)

function producerItemNaming(nodeId: string): GuidanceItem[] {
  return [
    {
      item_id: 'g1',
      category: 'should_fix',
      source: 'structural',
      title: 'Anchoring on the current figure',
      priority: 50,
      primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
      target_object: { type: 'node', id: nodeId },
    },
  ]
}

const node = (id: string, kind: string, data: Record<string, unknown> = {}): Node =>
  ({ id, type: kind, position: { x: 0, y: 0 }, data: { kind, label: id, ...data } }) as Node
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target, data: {} }) as Edge

/** `no_downside`: r1 is modelled and no option reaches it (NodeStructuralMarker.spec's fixture). */
function seedStrandedRisk(): void {
  useCanvasStore.setState({
    nodes: [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'external' }),
      node('f2', 'factor', { category: 'controllable' }),
      node('r1', 'risk'),
    ],
    edges: [edge('e1', 'o1', 'f1'), edge('e2', 'o2', 'f2')],
  } as never, false)
}

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
  useCanvasStore.setState({ nodes: [], edges: [], lodRung: 'full' } as never, false)
})

describe('the rung gate itself', () => {
  it('is true at full only, and an absent rung reads as full (store doubles)', () => {
    expect(selectRestingGlyphsShown({ lodRung: 'full' })).toBe(true)
    expect(selectRestingGlyphsShown({ lodRung: 'quiet' })).toBe(false)
    expect(selectRestingGlyphsShown({ lodRung: 'line' })).toBe(false)
    expect(selectRestingGlyphsShown({})).toBe(true)
    expect(selectRestingGlyphsShown(undefined)).toBe(true)
  })
})

describe('v3.1 pt 6 — the producer coaching marker is a Normal-zoom glyph', () => {
  it('CONTRAST: at full, a live item naming the node mounts its marker', () => {
    useGuidanceStore.getState().setGuidanceItems(producerItemNaming('node-a'))
    setRung('full')
    render(<NodeCoachingMarker nodeId="node-a" />)
    expect(screen.getByTestId('node-coaching-marker-node-a')).toBeInTheDocument()
  })

  it.each(HIDDEN_RUNGS)('⭐ RED-before: at %s the same item mounts NO marker', (rung) => {
    useGuidanceStore.getState().setGuidanceItems(producerItemNaming('node-a'))
    setRung(rung)
    const { container } = render(<NodeCoachingMarker nodeId="node-a" />)
    expect(screen.queryByTestId('node-coaching-marker-node-a')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('the item is not lost at quiet — it is still in the guidance store the inspector reads', () => {
    useGuidanceStore.getState().setGuidanceItems(producerItemNaming('node-a'))
    setRung('quiet')
    render(<NodeCoachingMarker nodeId="node-a" />)
    expect(
      useGuidanceStore.getState().guidanceItems.filter((i) => i.target_object?.id === 'node-a'),
    ).toHaveLength(1)
  })
})

describe('v3.1 pt 6 — the structural half of the slot follows the same gate', () => {
  // ⭐ CONTRACT v3.1 #18 (26 Sep, WS4): the structural glyph is off the card
  // at EVERY rung — the slot never carries it. The contrast is now the
  // detection itself, rendered directly (what the inspector can carry), so the
  // hidden-rung absences below are not a dead fixture.
  it('CONTRAST: at full, the stranded risk\'s structural finding is DETECTED — and the card slot still carries no glyph (#18)', () => {
    seedStrandedRisk()
    setRung('full')
    render(<NodeStructuralMarker nodeId="r1" />)
    expect(screen.getByTestId('node-structural-marker-r1')).toHaveAttribute('data-structural-kind', 'no_downside')
    cleanup()
    render(<NodeCoachingMarker nodeId="r1" />)
    expect(screen.queryByTestId('node-structural-marker-r1')).toBeNull()
  })

  it.each(HIDDEN_RUNGS)('⭐ RED-before: at %s the stranded risk carries NO structural marker', (rung) => {
    seedStrandedRisk()
    setRung(rung)
    const { container } = render(<NodeCoachingMarker nodeId="r1" />)
    expect(screen.queryByTestId('node-structural-marker-r1')).toBeNull()
    expect(container.innerHTML).toBe('')
  })
})

describe('v3.1 pt 6 — the evidence-gap "?" is not left hanging off the card at quiet', () => {
  it('CONTRAST: at full, the badge and its named hover zone render', () => {
    setRung('full')
    render(<EvidenceGapBadge label="Trial conversion" />)
    expect(screen.getByTestId('evidence-gap-badge')).toHaveTextContent('?')
    expect(screen.getByRole('img', { name: /No observed data for "Trial conversion"/ })).toBeInTheDocument()
  })

  it.each(HIDDEN_RUNGS)('⭐ RED-before: at %s neither the "?" nor its hover zone renders', (rung) => {
    setRung(rung)
    const { container } = render(<EvidenceGapBadge label="Trial conversion" escalation="critical" />)
    expect(screen.queryByTestId('evidence-gap-badge')).toBeNull()
    expect(screen.queryByTestId('evidence-gap-badge-hover')).toBeNull()
    expect(container.innerHTML).toBe('')
  })
})
