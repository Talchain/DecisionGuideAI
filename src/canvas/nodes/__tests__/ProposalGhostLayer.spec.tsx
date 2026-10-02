/**
 * Suggestion preview, stage 2: WHERE the ghost goes (pure geometry) and WHAT the overlay draws (DL ruling 5941839936).
 * Bound by ids: a card per proposed node beside the node it ties to, lines clipped to card borders, a band mark between
 * two nodes on the canvas; anything naming an element the canvas does not hold is dropped. Never a dashed or dotted
 * border (DS v5 §11.3: those MEAN confidence on the canvas), never interactive.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

let rfNodes: unknown[] = []
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return {
    ...actual,
    ViewportPortal: ({ children }: { children: ReactNode }) => children,
    useNodes: () => rfNodes,
    useEdges: () => [],
    useReactFlow: () => ({ screenToFlowPosition: (p: { x: number; y: number }) => p }),
    useStore: (select: (s: { transform: [number, number, number] }) => unknown) => select({ transform: [0, 0, 1] }),
  }
})

import { ghostBandText, ghostStatusText, ProposalGhostLayer, PROPOSAL_GHOST_TESTID } from '../ProposalGhostLayer'
import { GHOST_CARD_WIDTH, GHOST_GAP_X, GHOST_CARD_HEIGHT, GHOST_GAP_Y, proposalGhostGeometry } from '../../utils/proposalGhostGeometry'
import { useProposalGhostStore } from '../../stores/proposalGhostStore'
import { readProposalPreviewValue, type ProposalPreview } from '../../conversation/proposalPreview'

const NODES = [
  { id: 'enterprise_prospect_signing_likelihood', position: { x: 400, y: 300 }, measured: { width: 240, height: 80 } },
  { id: 'sprint_capacity_for_ai_reporting', position: { x: 0, y: 0 }, measured: { width: 200, height: 70 } },
  { id: 'ai_reporting_module_availability', position: { x: 0, y: 200 }, measured: { width: 200, height: 70 } },
  // The drawing's right edge (1100) is NOT the anchor's, so "beside its anchor" and "right of the drawing" differ.
  { id: 'quarterly_revenue', position: { x: 900, y: 600 }, measured: { width: 200, height: 80 } },
]
const preview = (ops: unknown[]): ProposalPreview => readProposalPreviewValue({ proposal_id: 'prop_1', ops })!
const ADD = { op: 'add_node', id: 'fac_onboarding_time', label: 'Customer onboarding time', kind: 'factor' }
const TIE = { op: 'add_edge', from_id: 'fac_onboarding_time', to_id: 'enterprise_prospect_signing_likelihood' }

afterEach(() => {
  cleanup()
  const g = useProposalGhostStore.getState().ghost
  if (g) useProposalGhostStore.getState().clearGhost(g.proposalId)
  rfNodes = []
})

describe('proposalGhostGeometry: placed by identity, beside what it ties to', () => {
  it('a proposed node tied to an existing node sits to its right; the line runs border to border', () => {
    const g = proposalGhostGeometry(preview([ADD, TIE]), NODES)
    expect(g.cards).toEqual([{ id: 'fac_onboarding_time', label: 'Customer onboarding time', kind: 'factor',
      x: 400 + 240 + GHOST_GAP_X, y: 300, w: GHOST_CARD_WIDTH, h: GHOST_CARD_HEIGHT }])
    expect(g.lines).toHaveLength(1)
    const l = g.lines[0]
    // From the ghost's LEFT border to the anchor's RIGHT border, not centre to centre.
    expect(l.x1).toBeCloseTo(400 + 240 + GHOST_GAP_X)
    expect(l.x2).toBeCloseTo(400 + 240)
  })

  it('no node on the canvas to tie to → right of the drawing, at its top; several on one anchor stack', () => {
    const g = proposalGhostGeometry(preview([ADD, { ...ADD, id: 'fac_b', label: 'B' }]), NODES)
    expect(g.cards.map((c) => [c.x, c.y])).toEqual([[1100 + GHOST_GAP_X, 0], [1100 + GHOST_GAP_X, GHOST_CARD_HEIGHT + GHOST_GAP_Y]])
  })

  it('⛔ a card never covers a node or another card: the slot right of the anchor is a sibling’s → the next free slot', () => {
    // A layered layout puts the anchor's sibling exactly where "right of the anchor" would be (served CDP template, R1/R2).
    const nodes = [...NODES, { id: 'sibling_right', position: { x: 700, y: 300 }, measured: { width: 200, height: 80 } }]
    const g = proposalGhostGeometry(preview([ADD, TIE, { ...ADD, id: 'fac_b', label: 'B' }, { ...TIE, from_id: 'fac_b' }]), nodes)
    expect(g.cards.map((c) => [c.id, c.x, c.y])).toEqual([
      ['fac_onboarding_time', 400 - GHOST_GAP_X - GHOST_CARD_WIDTH, 300], // left of the anchor
      ['fac_b', 400, 300 + 80 + GHOST_GAP_Y], // below it
    ])
    const rects = [...nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, w: n.measured.width, h: n.measured.height })), ...g.cards]
    const overlapping = rects.flatMap((a, i) => rects.slice(i + 1)
      .filter((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).map((b) => `${a.id}×${b.id}`))
    expect(overlapping).toEqual([])
  })

  // The served CDP template's risk row and its neighbours, as measured in the browser at zoom 0.5 (1 Oct): every slot
  // touching R1 is taken (48 px column gaps, 64 px row gaps) and a ghost card measured 112 tall there.
  const CDP = [
    { id: 'fac_migration_effort', position: { x: 25, y: 715 }, measured: { width: 325, height: 194 } },
    { id: 'fac_segment', position: { x: 398, y: 715 }, measured: { width: 325, height: 194 } },
    { id: 'fac_snowflake_build', position: { x: 771, y: 715 }, measured: { width: 325, height: 194 } },
    { id: 'out_budget_headroom', position: { x: 26, y: 973 }, measured: { width: 276, height: 160 } },
    { id: 'risk_migration_delay', position: { x: 350, y: 973 }, measured: { width: 276, height: 185 } },
    { id: 'risk_gdpr_breach', position: { x: 674, y: 973 }, measured: { width: 276, height: 185 } },
    { id: 'goal_cdp', position: { x: 480, y: 1222 }, measured: { width: 720, height: 105 } },
  ]
  const rectsOf = (nodes: typeof CDP) => nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, w: n.measured.width, h: n.measured.height }))

  it('⛔ boxed in (served CDP rows): the nearest free spot, covering nothing, its line crossing no other node', () => {
    const tie = { op: 'add_edge', from_id: 'fac_vendor_lockin', to_id: 'risk_migration_delay' }
    const g = proposalGhostGeometry(preview([{ ...ADD, id: 'fac_vendor_lockin', label: 'Vendor lock-in exposure' }, tie]), CDP, { heights: new Map([['fac_vendor_lockin', 112]]) })
    const [card] = g.cards
    expect(card.h).toBe(112)
    const rects = rectsOf(CDP)
    // Covers nothing.
    expect(rects.filter((r) => card.x < r.x + r.w && card.x + card.w > r.x && card.y < r.y + r.h && card.y + card.h > r.y)).toEqual([])
    // Near its anchor, not parked right of the drawing (1096 + gap).
    const anchor = rects.find((r) => r.id === 'risk_migration_delay')!
    const [ax, ay, cx, cy] = [anchor.x + anchor.w / 2, anchor.y + anchor.h / 2, card.x + card.w / 2, card.y + card.h / 2]
    expect(Math.hypot(cx - ax, cy - ay)).toBeLessThan(600)
    // Its line crosses no other node: sample the centre-to-centre segment.
    const crossed = new Set<string>()
    for (let t = 0; t <= 1; t += 0.01) {
      const [x, y] = [ax + (cx - ax) * t, ay + (cy - ay) * t]
      for (const r of rects) if (r.id !== anchor.id && x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) crossed.add(r.id)
    }
    expect([...crossed]).toEqual([])
  })

  it('⛔ the nearest free spot lies behind a node → a farther spot whose line crosses nothing', () => {
    // A boxed on three sides; a thin wide wall below it. Straight below the wall is nearest but its line crosses the wall.
    const box = [
      { id: 'a', position: { x: 0, y: 0 }, measured: { width: 200, height: 100 } },
      { id: 'right', position: { x: 248, y: 0 }, measured: { width: 200, height: 100 } },
      { id: 'left', position: { x: -248, y: 0 }, measured: { width: 200, height: 100 } },
      { id: 'above', position: { x: 0, y: -116 }, measured: { width: 200, height: 100 } },
      { id: 'wall', position: { x: -400, y: 116 }, measured: { width: 1000, height: 20 } },
    ]
    const g = proposalGhostGeometry(preview([{ ...ADD, id: 'g' }, { op: 'add_edge', from_id: 'g', to_id: 'a' }]), box)
    const [card] = g.cards
    const rects = rectsOf(box)
    expect(rects.filter((r) => card.x < r.x + r.w && card.x + card.w > r.x && card.y < r.y + r.h && card.y + card.h > r.y)).toEqual([])
    const [ax, ay, cx, cy] = [100, 50, card.x + card.w / 2, card.y + card.h / 2]
    const crossed = new Set<string>()
    for (let t = 0; t <= 1; t += 0.01) {
      const [x, y] = [ax + (cx - ax) * t, ay + (cy - ay) * t]
      for (const r of rects) if (r.id !== 'a' && x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) crossed.add(r.id)
    }
    expect([...crossed]).toEqual([])
  })

  it('⛔ a band mark sits ON the real edge where it covers nothing: its middle runs through a column gap (served CDP)', () => {
    // GDPR → GDPR risk, as drawn: straight down x=747 from the factor row (bottom 606) to the risk row (top 973), its
    // middle through the 48 px gap between Segment and Snowflake. Points in the overlay's order: middle, then outwards.
    const nodes = [...CDP, { id: 'fac_gdpr_compliance', position: { x: 584, y: 476 }, measured: { width: 325, height: 130 } }]
    const op = { op: 'set_link_strength', from_id: 'fac_gdpr_compliance', to_id: 'risk_gdpr_breach', band: 'strong', keeps: false }
    const key = 'fac_gdpr_compliance->risk_gdpr_breach'
    const MIDDLE = { x: 747, y: 790 } // between Segment and Snowflake: a 180-wide mark covers both
    const UPPER_GAP = { x: 747, y: 660 } // between the two factor rows
    const LOWER_GAP = { x: 747, y: 941 } // between the factor row and the risk row
    const at = (obstacles: Array<{ x: number; y: number; w: number; h: number }>) => {
      const b = proposalGhostGeometry(preview([op]), nodes, {
        markSizes: new Map([[key, { w: 180, h: 34 }]]), bandPaths: new Map([[key, [MIDDLE, UPPER_GAP, LOWER_GAP]]]), obstacles,
      }).bands[0]
      return { x: b.x, y: b.y }
    }
    expect(at([])).toEqual(UPPER_GAP)
    const box = { x: UPPER_GAP.x - 90, y: UPPER_GAP.y - 17, w: 180, h: 34 }
    expect(rectsOf(nodes).filter((r) => box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y)).toEqual([])
    // ⛔ ...nor the edge's own label: a sign glyph drawn in the upper gap moves the mark on along the path.
    expect(at([{ x: 737, y: 650, w: 20, h: 20 }])).toEqual(LOWER_GAP)
    // ⛔ Nowhere on the edge clear (served at zoom 0.5: the whole run is the column gap) → a callout: the nearest spot
    // covering nothing, a connector from the edge's middle to it, and the edge highlighted. Never a mark over the cards.
    const signs = [{ x: 737, y: 650, w: 20, h: 20 }, { x: 737, y: 931, w: 20, h: 20 }]
    const callout = proposalGhostGeometry(preview([op]), nodes, {
      markSizes: new Map([[key, { w: 180, h: 34 }]]), bandPaths: new Map([[key, [MIDDLE, UPPER_GAP, LOWER_GAP]]]),
      bandEdgePaths: new Map([[key, 'M747,606 L747,973']]), obstacles: signs,
    }).bands[0]
    const cbox = { x: callout.x - 90, y: callout.y - 17, w: 180, h: 34 }
    expect([...rectsOf(nodes), ...signs.map((o, i) => ({ id: `sign${i}`, ...o }))]
      .filter((r) => cbox.x < r.x + r.w && cbox.x + cbox.w > r.x && cbox.y < r.y + r.h && cbox.y + cbox.h > r.y)).toEqual([])
    expect(callout.connector).toMatchObject({ x1: MIDDLE.x, y1: MIDDLE.y })
    expect(callout.edgePath).toBe('M747,606 L747,973')
    // On the edge, no connector.
    expect(proposalGhostGeometry(preview([op]), nodes, { bandPaths: new Map([[key, [UPPER_GAP]]]) }).bands[0].connector).toBeUndefined()
  })

  it('places by the MEASURED card height: two 112-tall cards right of the drawing do not overlap', () => {
    const g = proposalGhostGeometry(preview([ADD, { ...ADD, id: 'fac_b', label: 'B' }]), NODES, { heights: new Map([['fac_onboarding_time', 112], ['fac_b', 112]]) })
    const [a, b] = g.cards
    expect([a.h, b.h]).toEqual([112, 112])
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.h)
  })

  it('⛔ once the real node is on the canvas its ghost is gone (no card for an id the canvas holds)', () => {
    const landed = [...NODES, { id: 'fac_onboarding_time', position: { x: 700, y: 300 }, measured: { width: 200, height: 70 } }]
    expect(proposalGhostGeometry(preview([ADD, TIE]), landed).cards).toEqual([])
  })

  it('⛔ an op naming an element neither on the canvas nor a ghost draws nothing (never a guessed place)', () => {
    const g = proposalGhostGeometry(preview([
      { op: 'add_edge', from_id: 'gone', to_id: 'enterprise_prospect_signing_likelihood' },
      { op: 'set_link_strength', from_id: 'gone', to_id: 'ai_reporting_module_availability', band: 'strong', keeps: false },
    ]), NODES)
    expect(g).toEqual({ cards: [], lines: [], bands: [], statuses: [] })
  })

  it('a strength change between two nodes on the canvas marks the midpoint of their centres', () => {
    const g = proposalGhostGeometry(preview([{ op: 'set_link_strength', from_id: 'sprint_capacity_for_ai_reporting', to_id: 'ai_reporting_module_availability', band: 'moderate', keeps: false }]), NODES)
    expect(g.bands).toEqual([{ key: 'sprint_capacity_for_ai_reporting->ai_reporting_module_availability', x: 100, y: 135, band: 'moderate', keeps: false, reverses: false }])
  })
})

describe('the producer\'s other ops: a new link\'s band, an option\'s status', () => {
  it('an add_edge with a band marks its ghost line; without one, only the line', () => {
    const tie = { op: 'add_edge', from_id: 'ai_reporting_module_availability', to_id: 'quarterly_revenue' }
    const g = proposalGhostGeometry(preview([{ ...tie, band: 'strong' }]), NODES)
    const l = g.lines[0]
    expect(g.bands).toEqual([{ key: l.key, x: (l.x1 + l.x2) / 2, y: (l.y1 + l.y2) / 2, band: 'strong', keeps: false, reverses: false }])
    expect(proposalGhostGeometry(preview([tie]), NODES).bands).toEqual([])
  })

  it('an option status sits just above its card; ⛔ below it when above is taken; ⛔ unknown option → nothing', () => {
    const opt = { id: 'opt_a', position: { x: 0, y: 400 }, measured: { width: 200, height: 80 } }
    const op = { op: 'set_option_status', option_id: 'opt_a', status: 'removed' }
    const sizes = { markSizes: new Map([['option:opt_a', { w: 120, h: 24 }]]) }
    expect(proposalGhostGeometry(preview([op]), [opt], sizes).statuses)
      .toEqual([{ key: 'option:opt_a', optionId: 'opt_a', status: 'removed', x: 100, y: 400 - 8 - 12 }])
    const roof = { id: 'roof', position: { x: 0, y: 340 }, measured: { width: 200, height: 40 } }
    expect(proposalGhostGeometry(preview([op]), [opt, roof], sizes).statuses[0]).toMatchObject({ x: 100, y: 480 + 8 + 12 })
    expect(proposalGhostGeometry(preview([{ ...op, option_id: 'gone' }]), [opt], sizes).statuses).toEqual([])
  })

  it('words: a keep RECORDS (never "Proposed"); a change is "Proposed"; a reversal says so; option words are the card\'s', () => {
    expect(ghostBandText({ band: 'moderate', keeps: true, reverses: false })).toBe('Record as moderate')
    expect(ghostBandText({ band: 'moderate', keeps: false, reverses: false })).toBe('Proposed: moderate')
    expect(ghostBandText({ band: 'strong', keeps: true, reverses: true })).toBe('Proposed: strong, direction reversed')
    expect(ghostStatusText('infeasible')).toBe('Proposed · Taken out: not feasible')
    expect(ghostStatusText('removed')).toBe('Proposed · Taken out')
    expect(ghostStatusText('feasible')).toBe('Proposed · Back in the comparison')
  })
})

describe('ProposalGhostLayer: draws the store’s ghost, render-only', () => {
  it('no ghost → nothing', () => {
    rfNodes = NODES
    render(<ProposalGhostLayer />)
    expect(screen.queryByTestId(PROPOSAL_GHOST_TESTID)).toBeNull()
  })

  it('a ghost → the card (shape, "Proposed", the label), its line and a band in the canvas band words; cleared with the store', () => {
    rfNodes = NODES
    const p = preview([ADD, TIE, { op: 'set_link_strength', from_id: 'sprint_capacity_for_ai_reporting', to_id: 'ai_reporting_module_availability', band: 'moderate', keeps: false }])
    render(<ProposalGhostLayer />)
    act(() => useProposalGhostStore.getState().showGhost(p))
    const card = screen.getByTestId('proposal-ghost-node-fac_onboarding_time')
    expect(card.textContent).toContain('Proposed')
    expect(card.textContent).toContain('Customer onboarding time')
    expect(card.querySelector('svg')).not.toBeNull()
    expect(screen.getByTestId('proposal-ghost-line-fac_onboarding_time->enterprise_prospect_signing_likelihood')).toBeTruthy()
    expect(screen.getByTestId('proposal-ghost-band-sprint_capacity_for_ai_reporting->ai_reporting_module_availability').textContent)
      .toBe('Proposed: moderate')
    act(() => useProposalGhostStore.getState().clearGhost('prop_1'))
    expect(screen.queryByTestId(PROPOSAL_GHOST_TESTID)).toBeNull()
  })

  it('⛔ DS v5 §11.3: no dashed or dotted border anywhere in the ghost; ⛔ never interactive', () => {
    rfNodes = NODES
    render(<ProposalGhostLayer />)
    act(() => useProposalGhostStore.getState().showGhost(preview([ADD, TIE])))
    const layer = screen.getByTestId(PROPOSAL_GHOST_TESTID)
    expect(layer.outerHTML).not.toMatch(/border-dashed|border-dotted|stroke-dasharray|strokeDasharray/)
    expect(layer.style.pointerEvents).toBe('none')
    expect(layer.querySelectorAll('button, a, input, [role="button"], [tabindex]')).toHaveLength(0)
  })
})
