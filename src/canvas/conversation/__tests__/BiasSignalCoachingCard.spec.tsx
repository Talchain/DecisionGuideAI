/**
 * Leg 3 (bias-coaching rendering slice) — DOM contract for
 * BiasSignalCoachingCard and its InlineBlocks routing.
 *
 * Fixture provenance: block shapes mirror what buildDraftBiasSignalBlocks
 * produces from the live-verified draft response on CEE staging (build
 * 57959b2c3, 16 Jul 2026): `coaching.bias_signals` carrying
 * `status_quo_bias` + `anchoring`, both grounded. Copy here is synthetic.
 *
 * Pinned behaviour:
 *   1. DS coaching-card recipe (DESIGN_SYSTEM.md:256-264): bg-panel +
 *      coloured LEFT border (border-l-[3px] border-info) + rounded-lg
 *      px-4 py-3 — NOT the full-border idiom the three live CoachingCard
 *      implementations use.
 *   2. Humanised title and producer-verbatim body render; the grounded
 *      reference label is visible.
 *   3. coaching_kind / source / freshness ride as data-* only — no raw
 *      code string (snake_case token) anywhere in visible text (sweep).
 *   4. InlineBlocks routes coaching_kind 'bias_signal' to this card and
 *      every other coaching_kind to the existing V5CoachingBlock
 *      (structure reuse pinned in both directions).
 *   5. Two blocks → two cards; the builder cap means never more than two
 *      reach this renderer, pinned end-to-end via builder + InlineBlocks.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { BiasSignalCoachingCard } from '../../../v5/blocks/BiasSignalCoachingCard'
import { InlineBlocks } from '../InlineBlocks'
import { buildDraftBiasSignalBlocks } from '../draftBiasSignalBlocks'
import type { V5CoachingBlock as V5CoachingBlockType } from '../types'
import type { CEEDraftCoaching } from '../../../adapters/cee/types'

const BIAS_BLOCK: V5CoachingBlockType = {
  type: 'v5_coaching',
  block_id: 'draft_bias_signal_0',
  title: 'Status quo bias',
  body: 'The model leans on keeping the current supplier without weighing the switch on equal terms.',
  coaching_kind: 'bias_signal',
  source: 'draft_graph',
  target_refs: [
    { id: 'fac_current_supplier', label: 'Current supplier terms', kind: 'factor' },
  ],
  priority_rank: 1,
  freshness: 'fresh',
}

const OTHER_COACHING_BLOCK: V5CoachingBlockType = {
  type: 'v5_coaching',
  block_id: '7e0855c7-d79d-5d16-9fee-19e68ece297d',
  title: 'An assumption to check',
  body: 'The relationship between supplier terms and cost remains stable.',
  coaching_kind: 'assumption_check',
  source: 'decision_review',
  target_refs: [],
  priority_rank: 2,
  freshness: 'fresh',
}

describe('BiasSignalCoachingCard — DS coaching-card recipe', () => {
  it('uses the DS recipe: bg-panel + coloured left border, no full border', () => {
    render(<BiasSignalCoachingCard block={BIAS_BLOCK} />)
    const card = screen.getByTestId('bias-signal-card')
    expect(card.classList.contains('bg-panel')).toBe(true)
    expect(card.classList.contains('border-l-[3px]')).toBe(true)
    expect(card.classList.contains('border-info')).toBe(true)
    expect(card.classList.contains('rounded-lg')).toBe(true)
    expect(card.classList.contains('px-4')).toBe(true)
    expect(card.classList.contains('py-3')).toBe(true)
    // NOT the full-border idiom (the DS-audit non-compliance we must not propagate).
    expect(card.classList.contains('border')).toBe(false)
    expect(card.classList.contains('border-info/30')).toBe(false)
    // Neutral background only — never a coloured card background.
    expect([...card.classList].some((c) => /^bg-(info|warning|danger|success)/.test(c))).toBe(false)
  })
})

describe('BiasSignalCoachingCard — copy contract', () => {
  it('renders the humanised title, the producer body verbatim, and the grounded reference', () => {
    render(<BiasSignalCoachingCard block={BIAS_BLOCK} />)
    expect(screen.getByTestId('bias-signal-card-title')).toHaveTextContent('Status quo bias')
    expect(screen.getByTestId('bias-signal-card-body')).toHaveTextContent(BIAS_BLOCK.body)
    expect(screen.getByTestId('bias-signal-card-refs')).toHaveTextContent('Current supplier terms')
  })

  it('exposes coaching_kind / source / freshness as data-* only — never as visible copy', () => {
    render(<BiasSignalCoachingCard block={BIAS_BLOCK} />)
    const card = screen.getByTestId('bias-signal-card')
    expect(card).toHaveAttribute('data-coaching-kind', 'bias_signal')
    expect(card).toHaveAttribute('data-coaching-source', 'draft_graph')
    expect(card).toHaveAttribute('data-freshness', 'fresh')
    expect(card).toHaveAttribute('data-block-id', 'draft_bias_signal_0')
    expect(card.textContent).not.toMatch(/bias_signal|draft_graph|\bfresh\b/)
  })

  it('sweep: no snake_case token ever appears in the visible text', () => {
    render(<BiasSignalCoachingCard block={BIAS_BLOCK} />)
    const card = screen.getByTestId('bias-signal-card')
    expect(card.textContent).not.toMatch(/\b[a-z]+(?:_[a-z]+)+\b/)
  })

  it('renders no refs list when target_refs is empty (renders nothing invented)', () => {
    render(<BiasSignalCoachingCard block={{ ...BIAS_BLOCK, target_refs: [] }} />)
    expect(screen.queryByTestId('bias-signal-card-refs')).not.toBeInTheDocument()
  })
})

describe('InlineBlocks routing — structure reuse pinned in both directions', () => {
  it("routes coaching_kind 'bias_signal' to BiasSignalCoachingCard and other kinds to V5CoachingBlock", () => {
    render(<InlineBlocks blocks={[BIAS_BLOCK, OTHER_COACHING_BLOCK]} />)
    expect(screen.getAllByTestId('bias-signal-card')).toHaveLength(1)
    expect(screen.getAllByTestId('v5-coaching')).toHaveLength(1)
    // The non-bias coaching block still renders its own producer copy.
    expect(screen.getByTestId('v5-coaching-title')).toHaveTextContent('An assumption to check')
  })
})

describe('builder → InlineBlocks end-to-end (fixture wire shape)', () => {
  const NODES = [
    { id: 'fac_current_supplier', type: 'factor', data: { label: 'Current supplier terms' } },
    { id: 'fac_initial_quote', type: 'factor', data: { label: 'Initial quote' } },
    { id: 'opt_switch', type: 'option', data: { label: 'Switch supplier' } },
  ]
  const WIRE_SIGNALS = [
    {
      type: 'status_quo_bias',
      detail: 'The model leans on keeping the current supplier without weighing the switch on equal terms.',
      target: 'fac_current_supplier',
    },
    {
      type: 'anchoring',
      detail: 'Estimates cluster tightly around the initial quote rather than an independent range.',
      target: 'fac_initial_quote',
    },
    {
      type: 'sunk_cost',
      detail: 'Past spend on the current contract is treated as a reason to continue.',
      target: 'opt_switch',
    },
  ]

  function buildFromWire(signals: typeof WIRE_SIGNALS) {
    // Post-adapter shape, as the canvas store holds it (CEEDraftCoaching).
    const draftCoaching: CEEDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: signals,
    }
    return buildDraftBiasSignalBlocks({
      isDraftTurn: true,
      store: { draftCoaching, nodes: NODES },
      existingBlocks: [],
    })
  }

  it('two signals → two DS-recipe cards', () => {
    render(<InlineBlocks blocks={buildFromWire(WIRE_SIGNALS.slice(0, 2))} />)
    const cards = screen.getAllByTestId('bias-signal-card')
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      expect(card.classList.contains('bg-panel')).toBe(true)
      expect(card.classList.contains('border-l-[3px]')).toBe(true)
    }
  })

  it('three signals → exactly two cards', () => {
    render(<InlineBlocks blocks={buildFromWire(WIRE_SIGNALS)} />)
    expect(screen.getAllByTestId('bias-signal-card')).toHaveLength(2)
  })

  it('sweep: raw wire codes never reach the rendered DOM', () => {
    const { container } = render(<InlineBlocks blocks={buildFromWire(WIRE_SIGNALS)} />)
    expect(container.textContent).not.toMatch(/status_quo_bias|anchoring_bias|sunk_cost|bias_signal/)
    expect(container.textContent).not.toMatch(/\b[a-z]+(?:_[a-z]+)+\b/)
  })
})
