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
  return { ...actual, ViewportPortal: ({ children }: { children: ReactNode }) => children, useNodes: () => rfNodes }
})

import { ProposalGhostLayer, PROPOSAL_GHOST_TESTID } from '../ProposalGhostLayer'
import { GHOST_CARD_WIDTH, GHOST_GAP_X, GHOST_CARD_HEIGHT, GHOST_GAP_Y, proposalGhostGeometry } from '../../utils/proposalGhostGeometry'
import { useProposalGhostStore } from '../../stores/proposalGhostStore'
import { readProposalPreviewValue, type ProposalPreview } from '../../conversation/proposalPreview'
import { strengthBandWords } from '../../../components/results/analysisNew/runDeltaLinkWords'

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

  it('⛔ once the real node is on the canvas its ghost is gone (no card for an id the canvas holds)', () => {
    const landed = [...NODES, { id: 'fac_onboarding_time', position: { x: 700, y: 300 }, measured: { width: 200, height: 70 } }]
    expect(proposalGhostGeometry(preview([ADD, TIE]), landed).cards).toEqual([])
  })

  it('⛔ an op naming an element neither on the canvas nor a ghost draws nothing (never a guessed place)', () => {
    const g = proposalGhostGeometry(preview([
      { op: 'add_edge', from_id: 'gone', to_id: 'enterprise_prospect_signing_likelihood' },
      { op: 'set_link_strength', from_id: 'gone', to_id: 'ai_reporting_module_availability', band: 'strong' },
    ]), NODES)
    expect(g).toEqual({ cards: [], lines: [], bands: [] })
  })

  it('a strength change between two nodes on the canvas marks the midpoint of their centres', () => {
    const g = proposalGhostGeometry(preview([{ op: 'set_link_strength', from_id: 'sprint_capacity_for_ai_reporting', to_id: 'ai_reporting_module_availability', band: 'moderate' }]), NODES)
    expect(g.bands).toEqual([{ key: 'sprint_capacity_for_ai_reporting->ai_reporting_module_availability', x: 100, y: 135, band: 'moderate' }])
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
    const p = preview([ADD, TIE, { op: 'set_link_strength', from_id: 'sprint_capacity_for_ai_reporting', to_id: 'ai_reporting_module_availability', band: 'moderate' }])
    render(<ProposalGhostLayer />)
    act(() => useProposalGhostStore.getState().showGhost(p))
    const card = screen.getByTestId('proposal-ghost-node-fac_onboarding_time')
    expect(card.textContent).toContain('Proposed')
    expect(card.textContent).toContain('Customer onboarding time')
    expect(card.querySelector('svg')).not.toBeNull()
    expect(screen.getByTestId('proposal-ghost-line-fac_onboarding_time->enterprise_prospect_signing_likelihood')).toBeTruthy()
    expect(screen.getByTestId('proposal-ghost-band-sprint_capacity_for_ai_reporting->ai_reporting_module_availability').textContent)
      .toBe(`Proposed: ${strengthBandWords('moderate')}`)
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
