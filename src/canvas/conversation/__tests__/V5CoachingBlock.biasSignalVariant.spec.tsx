/**
 * Leg 3 (bias-coaching rendering slice) — DOM contract for the
 * V5CoachingBlock `bias_signal` variant and its InlineBlocks routing
 * (review-folds C10+R1: the separate BiasSignalCoachingCard duplicated the
 * whole coaching-card structure and silently DROPPED the producer
 * action_label; it is deleted — ONE component, two container recipes).
 *
 * Fixture provenance: block shapes mirror what buildDraftBiasSignalBlocks
 * produces from the live-verified draft response on CEE staging (build
 * 57959b2c3, 16 Jul 2026): `coaching.bias_signals` carrying
 * `status_quo_bias` + `anchoring`, both grounded. Copy here is synthetic.
 *
 * Pinned behaviour:
 *   1. DS coaching-card recipe (DESIGN_SYSTEM.md:256-264): bg-panel +
 *      coloured LEFT border (border-l-[3px] border-info) + rounded-lg
 *      px-4 py-3 — NOT the full-border idiom of the default variant.
 *   2. Humanised title and producer-verbatim body render; the grounded
 *      reference label is visible.
 *   3. coaching_kind / source ride as data-* only — no raw code string
 *      (snake_case token) anywhere in visible text (sweep). Bridge-built
 *      blocks carry no freshness, so no data-freshness attribute renders;
 *      a producer-typed bias block's freshness still rides data-* only.
 *   4. InlineBlocks routes coaching_kind 'bias_signal' to the bias variant
 *      and every other coaching_kind to the default variant (structure
 *      reuse pinned in both directions — same component).
 *   5. Two blocks → two cards; the builder cap means never more than two
 *      reach this renderer, pinned end-to-end via builder + InlineBlocks.
 *   6. R1: a producer action_label renders on the bias variant too (the
 *      field the deleted fork dropped).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { V5CoachingBlock } from '../../../v5/blocks/V5CoachingBlock'
import { InlineBlocks } from '../InlineBlocks'
import { buildDraftBiasSignalBlocks } from '../draftBiasSignalBlocks'
import type { V5CoachingBlock as V5CoachingBlockType } from '../types'
import type { CEEDraftCoaching } from '../../../adapters/cee/types'

/** Bridge-built shape: no priority_rank / freshness (Conv1 — not fabricated). */
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

describe('V5CoachingBlock bias_signal variant — DS coaching-card recipe', () => {
  it('uses the DS recipe: bg-panel + coloured left border, no full border', () => {
    render(<V5CoachingBlock block={BIAS_BLOCK} variant="bias_signal" />)
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

  it('the default variant keeps the existing full-border idiom and v5-coaching testids', () => {
    render(<V5CoachingBlock block={OTHER_COACHING_BLOCK} />)
    const card = screen.getByTestId('v5-coaching')
    expect(card.classList.contains('border')).toBe(true)
    expect(card.classList.contains('border-info/30')).toBe(true)
    expect(screen.queryByTestId('bias-signal-card')).not.toBeInTheDocument()
  })
})

describe('V5CoachingBlock bias_signal variant — copy contract', () => {
  it('renders the humanised title, the producer body verbatim, and the grounded reference', () => {
    render(<V5CoachingBlock block={BIAS_BLOCK} variant="bias_signal" />)
    expect(screen.getByTestId('bias-signal-card-title')).toHaveTextContent('Status quo bias')
    expect(screen.getByTestId('bias-signal-card-body')).toHaveTextContent(BIAS_BLOCK.body)
    expect(screen.getByTestId('bias-signal-card-refs')).toHaveTextContent('Current supplier terms')
  })

  it('exposes coaching_kind / source as data-* only — never as visible copy', () => {
    render(<V5CoachingBlock block={BIAS_BLOCK} variant="bias_signal" />)
    const card = screen.getByTestId('bias-signal-card')
    expect(card).toHaveAttribute('data-coaching-kind', 'bias_signal')
    expect(card).toHaveAttribute('data-coaching-source', 'draft_graph')
    expect(card).toHaveAttribute('data-block-id', 'draft_bias_signal_0')
    // Bridge-built blocks carry no freshness — nothing is fabricated, so
    // the attribute is absent (Conv1).
    expect(card).not.toHaveAttribute('data-freshness')
    expect(card.textContent).not.toMatch(/bias_signal|draft_graph/)
  })

  it("a producer-typed bias block's freshness rides data-* only", () => {
    render(
      <V5CoachingBlock
        block={{ ...BIAS_BLOCK, block_id: 'producer_bias_1', freshness: 'fresh', priority_rank: 1 }}
        variant="bias_signal"
      />,
    )
    const card = screen.getByTestId('bias-signal-card')
    expect(card).toHaveAttribute('data-freshness', 'fresh')
    expect(card.textContent).not.toMatch(/\bfresh\b/)
  })

  it('sweep: no snake_case token ever appears in the visible text', () => {
    render(<V5CoachingBlock block={BIAS_BLOCK} variant="bias_signal" />)
    const card = screen.getByTestId('bias-signal-card')
    expect(card.textContent).not.toMatch(/\b[a-z]+(?:_[a-z]+)+\b/)
  })

  it('renders no refs list when target_refs is empty (renders nothing invented)', () => {
    render(<V5CoachingBlock block={{ ...BIAS_BLOCK, target_refs: [] }} variant="bias_signal" />)
    expect(screen.queryByTestId('bias-signal-card-refs')).not.toBeInTheDocument()
  })

  it('R1: renders a producer action_label as the outlined pill on the bias variant (the field the deleted fork dropped)', () => {
    render(
      <V5CoachingBlock
        block={{ ...BIAS_BLOCK, action_label: 'Check the baseline on equal terms', action_intent: 'discuss' }}
        variant="bias_signal"
      />,
    )
    const pill = screen.getByTestId('bias-signal-card-action')
    expect(pill).toHaveTextContent('Check the baseline on equal terms')
    expect(pill).toHaveAttribute('data-action-intent', 'discuss')
  })
})

describe('InlineBlocks routing — one component, two variants', () => {
  it("routes coaching_kind 'bias_signal' to the bias variant and other kinds to the default variant", () => {
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
