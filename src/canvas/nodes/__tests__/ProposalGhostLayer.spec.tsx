/**
 * Suggestion preview, stage 2: WHERE the ghost goes (pure geometry) and WHAT the overlay draws (DL ruling 5941839936).
 * Bound by ids: a card per proposed node beside the node it ties to, lines clipped to card borders, a band mark between
 * two nodes on the canvas; anything naming an element the canvas does not hold is dropped. Never a dashed or dotted
 * border (DS v5 §11.3: those MEAN confidence on the canvas). The drawing is never interactive; the ghost's own Approve /
 * Not now (canvas plan step 3) sit beside it and press the reply's own consent chips.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

import { CANVAS_BAND_WORD, ghostBandText, ghostStatusText, ProposalGhostLayer, PROPOSAL_GHOST_TESTID, otherChangesText, REVIEW_ON_THE_CARD } from '../ProposalGhostLayer'
import { GHOST_CARD_WIDTH, GHOST_GAP_X, GHOST_CARD_HEIGHT, GHOST_GAP_Y, clampGhostActionsX, ghostActionsPosition, proposalGhostGeometry } from '../../utils/proposalGhostGeometry'
import { useProposalGhostStore } from '../../stores/proposalGhostStore'
import { consentChipsFor, readProposalPreviewValue, type ProposalPreview } from '../../conversation/proposalPreview'
import { useGuidanceStore } from '../../stores/guidanceStore'
import type { ActionChip, ConversationMessage } from '../../conversation/types'

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

describe('the ghost\'s action row never runs under the panel on the canvas\'s right edge (DL 22 Oct, served at 1440 px)', () => {
  it('a row that would cross the visible right edge is pulled left to end there; one that fits, or nothing covering, stays put', () => {
    expect(clampGhostActionsX(900, 260, 1068)).toBe(808)
    expect(clampGhostActionsX(700, 260, 1068)).toBe(700)
    expect(clampGhostActionsX(900, 260, null)).toBe(900)
    expect(clampGhostActionsX(900, 0, 1068), 'not measured yet → unchanged').toBe(900)
  })

  it('⭐ Paul\'s pre-flight (22 Oct): a row that would cover a card goes just above its anchor; a free spot under stays put', () => {
    // Served shape: a figure's mark sits just above two factor cards; the row under it covered both titles.
    const f2 = { id: 'f2', position: { x: 160, y: 510 }, measured: { width: 350, height: 100 } }
    const f3 = { id: 'f3', position: { x: 553, y: 510 }, measured: { width: 350, height: 100 } }
    const mark = { x: 345, top: 482, bottom: 500 }
    expect(ghostActionsPosition(mark, { w: 290, h: 26 }, [f2, f3], null)).toEqual({ x: 345, y: 482 - 8 - 26 })
    // CONTRAST: nothing under the anchor → exactly today's spot (under, +8).
    expect(ghostActionsPosition(mark, { w: 290, h: 26 }, [], null)).toEqual({ x: 345, y: 508 })
    // Not measured yet → today's spot; both spots covered → today's spot.
    expect(ghostActionsPosition(mark, { w: 0, h: 0 }, [f2, f3], null)).toEqual({ x: 345, y: 508 })
    const roof = { id: 'roof', position: { x: 160, y: 400 }, measured: { width: 800, height: 80 } }
    expect(ghostActionsPosition(mark, { w: 290, h: 26 }, [f2, f3, roof], null)).toEqual({ x: 345, y: 508 })
    // The dock clamp still applies first.
    expect(ghostActionsPosition({ x: 900, top: 100, bottom: 200 }, { w: 260, h: 26 }, [], 1068)).toEqual({ x: 808, y: 208 })
  })
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
    expect(g).toEqual({ cards: [], lines: [], bands: [], statuses: [], values: [] })
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

  it('words: a keep RECORDS (never "Proposed"); a change is "Olumi proposes"; a reversal says so; option words are the card\'s', () => {
    expect(ghostBandText({ band: 'moderate', keeps: true, reverses: false })).toBe('Record as moderate')
    expect(ghostBandText({ band: 'moderate', keeps: false, reverses: false })).toBe('Olumi proposes: moderate')
    expect(ghostBandText({ band: 'strong', keeps: true, reverses: true })).toBe('Olumi proposes: strong, direction reversed')
    // ⛔ The canvas's word, never the enum's: CEE `weak` is the canvas's "slight" (served: "Proposed: weak" beside "as slight").
    expect(ghostBandText({ band: 'weak', keeps: false, reverses: false })).toBe('Olumi proposes: slight')
    expect(ghostBandText({ band: 'weak', keeps: true, reverses: false })).toBe('Record as slight')
    // The map is CEE's CANVAS_BAND_WORD (edge-strength-bands.ts @ 41105c78), literal for literal.
    expect(CANVAS_BAND_WORD).toEqual({ weak: 'slight', moderate: 'moderate', strong: 'strong', 'very strong': 'very strong' })
    expect(ghostStatusText('infeasible')).toBe('Olumi proposes · Taken out: not feasible')
    expect(ghostStatusText('removed')).toBe('Olumi proposes · Taken out')
    expect(ghostStatusText('feasible')).toBe('Olumi proposes · Back in the comparison')
  })
})

describe('ProposalGhostLayer: draws the store’s ghost, render-only', () => {
  it('no ghost → nothing', () => {
    rfNodes = NODES
    render(<ProposalGhostLayer />)
    expect(screen.queryByTestId(PROPOSAL_GHOST_TESTID)).toBeNull()
  })

  it('a ghost → the card (shape, "Olumi proposes", the label), its line and a band in the canvas band words; cleared with the store', () => {
    rfNodes = NODES
    const p = preview([ADD, TIE, { op: 'set_link_strength', from_id: 'sprint_capacity_for_ai_reporting', to_id: 'ai_reporting_module_availability', band: 'moderate', keeps: false }])
    render(<ProposalGhostLayer />)
    act(() => useProposalGhostStore.getState().showGhost(p))
    const card = screen.getByTestId('proposal-ghost-node-fac_onboarding_time')
    expect(card.textContent).toContain('Olumi proposes')
    expect(card.textContent).toContain('Customer onboarding time')
    expect(card.querySelector('svg')).not.toBeNull()
    expect(screen.getByTestId('proposal-ghost-line-fac_onboarding_time->enterprise_prospect_signing_likelihood')).toBeTruthy()
    expect(screen.getByTestId('proposal-ghost-band-sprint_capacity_for_ai_reporting->ai_reporting_module_availability').textContent)
      .toBe('Olumi proposes: moderate')
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

/**
 * ⭐ APPROVE FROM THE GHOST (Reasoning Canvas plan, step 3: "approve from the ghost or the chat card"). The buttons are
 * the reply's OWN consent chips, pressed through the conversation's chip path (`_sendChip`) with their id, words and
 * type: one approval path, no words of the ghost's own.
 */
describe('the ghost\'s own Approve / Not now', () => {
  const APPROVE: ActionChip = { id: 'agent-approve-proposal:prop_1', label: 'Make this change', message: 'Yes, make that change.', intent: 'primary' }
  const DECLINE: ActionChip = { id: 'agent-decline-proposal:prop_1', label: 'Not now', message: 'Not now.', intent: 'secondary' }
  const reply = (chips: ActionChip[], over: Partial<ConversationMessage> = {}) =>
    ({ id: 'r1', role: 'assistant', content: 'prepared', timestamp: new Date(), actionChips: chips, ...over }) as ConversationMessage

  it('consentChipsFor reads the reply\'s own chips; no approve offered → none; a synthetic notice never offers them', () => {
    expect(consentChipsFor([reply([DECLINE, APPROVE])], 'prop_1')).toEqual({ approve: APPROVE, decline: DECLINE })
    expect(consentChipsFor([reply([APPROVE])], 'prop_1')).toEqual({ approve: APPROVE, decline: null })
    expect(consentChipsFor([reply([DECLINE])], 'prop_1')).toBeNull()
    expect(consentChipsFor([reply([APPROVE], { synthetic: true })], 'prop_1')).toBeNull()
    expect(consentChipsFor([reply([APPROVE])], 'prop_2')).toBeNull()
  })

  it('⭐ pressing Approve sends the reply\'s approve chip, once; both buttons then wait for the reply', () => {
    rfNodes = NODES
    const sent: unknown[][] = []
    act(() => { useGuidanceStore.setState({ _sendChip: (...a: unknown[]) => { sent.push(a) } } as never) })
    act(() => useProposalGhostStore.getState().showGhost(preview([ADD, TIE]), { approve: APPROVE, decline: DECLINE }))
    render(<ProposalGhostLayer />)
    const approve = screen.getByTestId('proposal-ghost-actions-approve')
    expect(approve.textContent).toBe('Make this change')
    expect(screen.getByTestId('proposal-ghost-actions-decline').textContent).toBe('Not now')
    fireEvent.click(approve)
    fireEvent.click(approve)
    expect(sent).toEqual([['Make this change', 'Yes, make that change.', { id: 'agent-approve-proposal:prop_1' }]])
    expect((approve as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('proposal-ghost-actions-decline') as HTMLButtonElement).disabled).toBe(true)
    // The drawing itself stays inert: the buttons sit beside it, never inside the aria-hidden layer.
    expect(screen.getByTestId(PROPOSAL_GHOST_TESTID).querySelectorAll('button')).toHaveLength(0)
    act(() => { useGuidanceStore.setState({ _sendChip: null } as never) })
  })

  it('a reply that offers the chips again makes the buttons live again (a held proposal is never left unpressable)', () => {
    rfNodes = NODES
    act(() => { useGuidanceStore.setState({ _sendChip: () => {} } as never) })
    act(() => useProposalGhostStore.getState().showGhost(preview([ADD, TIE]), { approve: APPROVE, decline: DECLINE }))
    render(<ProposalGhostLayer />)
    fireEvent.click(screen.getByTestId('proposal-ghost-actions-approve'))
    expect((screen.getByTestId('proposal-ghost-actions-approve') as HTMLButtonElement).disabled).toBe(true)
    act(() => useProposalGhostStore.getState().showGhost(useProposalGhostStore.getState().ghost!, { approve: { ...APPROVE }, decline: { ...DECLINE } }))
    expect((screen.getByTestId('proposal-ghost-actions-approve') as HTMLButtonElement).disabled).toBe(false)
    act(() => { useGuidanceStore.setState({ _sendChip: null } as never) })
  })

  it('Not now sends the reply\'s decline chip', () => {
    rfNodes = NODES
    const sent: unknown[][] = []
    act(() => { useGuidanceStore.setState({ _sendChip: (...a: unknown[]) => { sent.push(a) } } as never) })
    act(() => useProposalGhostStore.getState().showGhost(preview([ADD, TIE]), { approve: APPROVE, decline: DECLINE }))
    render(<ProposalGhostLayer />)
    fireEvent.click(screen.getByTestId('proposal-ghost-actions-decline'))
    expect(sent).toEqual([['Not now', 'Not now.', { id: 'agent-decline-proposal:prop_1' }]])
    act(() => { useGuidanceStore.setState({ _sendChip: null } as never) })
  })

  it('⛔ CONSENT (DL 22 Oct): a card that also lists changes in words offers NO approve on the ghost: "+N other changes" and "Review on the card"', () => {
    rfNodes = NODES
    const sent: unknown[][] = []
    act(() => { useGuidanceStore.setState({ _sendChip: (...a: unknown[]) => { sent.push(a) } } as never) })
    act(() => useProposalGhostStore.getState().showGhost({ ...preview([ADD, TIE]), otherChanges: 2 }, { approve: APPROVE, decline: DECLINE }))
    render(<ProposalGhostLayer />)
    expect(screen.queryByTestId('proposal-ghost-actions-approve')).toBeNull()
    expect(screen.getByTestId('proposal-ghost-actions-other-changes').textContent).toBe('+2 other changes')
    const review = screen.getByTestId('proposal-ghost-actions-review')
    expect(review.textContent).toBe(REVIEW_ON_THE_CARD)
    fireEvent.click(review)
    expect(sent, 'reviewing sends nothing').toEqual([])
    // Declining is still the person's: it writes nothing.
    expect(screen.getByTestId('proposal-ghost-actions-decline').textContent).toBe('Not now')
    expect(otherChangesText(1)).toBe('+1 other change')
    act(() => { useGuidanceStore.setState({ _sendChip: null } as never) })
  })

  it('⛔ a count of 0 (every note is about what the ghost draws): still no approve, no "+0", only Review on the card and Not now', () => {
    rfNodes = NODES
    act(() => { useGuidanceStore.setState({ _sendChip: () => {} } as never) })
    act(() => useProposalGhostStore.getState().showGhost({ ...preview([ADD, TIE]), otherChanges: 0 }, { approve: APPROVE, decline: DECLINE }))
    render(<ProposalGhostLayer />)
    expect([...screen.getByTestId('proposal-ghost-actions').children].map((c) => c.getAttribute('data-testid')))
      .toEqual(['proposal-ghost-actions-review', 'proposal-ghost-actions-decline'])
    act(() => { useGuidanceStore.setState({ _sendChip: null } as never) })
  })

  it('CONTRAST: with no other changes the ghost\'s actions are exactly as before (approve, then Not now, nothing else)', () => {
    rfNodes = NODES
    act(() => { useGuidanceStore.setState({ _sendChip: () => {} } as never) })
    act(() => useProposalGhostStore.getState().showGhost(preview([ADD, TIE]), { approve: APPROVE, decline: DECLINE }))
    render(<ProposalGhostLayer />)
    expect([...screen.getByTestId('proposal-ghost-actions').children].map((c) => c.getAttribute('data-testid')))
      .toEqual(['proposal-ghost-actions-approve', 'proposal-ghost-actions-decline'])
    act(() => { useGuidanceStore.setState({ _sendChip: null } as never) })
  })

  it('⛔ CONTRAST: a ghost whose reply offers no chips draws no buttons (the drawing alone)', () => {
    rfNodes = NODES
    act(() => useProposalGhostStore.getState().showGhost(preview([ADD, TIE])))
    render(<ProposalGhostLayer />)
    expect(screen.getByTestId(PROPOSAL_GHOST_TESTID)).toBeTruthy()
    expect(screen.queryByTestId('proposal-ghost-actions')).toBeNull()
  })
})
