/**
 * Lane UI-R3 (truth rendering) — Track C slice 1: DOM contracts for the
 * typed Phase 3 renderers (V5ReviewCardBlock / V5CoachingBlock).
 *
 * Doctrine (provisional_doctrine_v0):
 *   - Every visible string is producer copy verbatim (title, body,
 *     target_refs labels, action_label). NO invented labels, NO science
 *     interpretation, NO severity/kind words rendered as text.
 *   - severity drives the visual channel only (data-severity + styling).
 *   - kind/freshness/block_id ride as data-* attributes, never as copy.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { V5ReviewCardBlock } from '../V5ReviewCardBlock'
import { V5CoachingBlock } from '../V5CoachingBlock'
import type {
  V5CoachingBlock as V5CoachingBlockType,
  V5ReviewCardBlock as V5ReviewCardBlockType,
} from '../../../canvas/conversation/types'

const REVIEW: V5ReviewCardBlockType = {
  type: 'v5_review_card',
  block_id: 'e2f8988e-ccf0-5d10-ad58-99c45ec5230c',
  title: 'A load-bearing assumption',
  body: 'The relationship between Technical Leadership Capacity and overall throughput remains stable.',
  severity: 'info',
  card_kind: 'assumption',
  target_refs: [{ id: 'fac_tech_lead', label: 'Technical Leadership Capacity', kind: 'factor' }],
  priority_rank: 71,
  freshness: 'fresh',
}

const COACHING: V5CoachingBlockType = {
  type: 'v5_coaching',
  block_id: '7e0855c7-d79d-5d16-9fee-19e68ece297d',
  title: 'An assumption to check',
  body: 'The relationship between Technical Leadership Capacity and overall throughput remains stable.',
  coaching_kind: 'assumption_check',
  source: 'decision_review',
  target_refs: [],
  priority_rank: 101,
  freshness: 'fresh',
  action_intent: 'confirm_factor',
  action_label: 'Confirm this assumption',
}

describe('V5ReviewCardBlock', () => {
  it('renders producer title, body, and target_refs labels VERBATIM', () => {
    render(<V5ReviewCardBlock block={REVIEW} />)
    expect(screen.getByTestId('v5-review-card-title')).toHaveTextContent(REVIEW.title)
    expect(screen.getByTestId('v5-review-card-body')).toHaveTextContent(REVIEW.body)
    expect(screen.getByTestId('v5-review-card-refs')).toHaveTextContent(
      'Technical Leadership Capacity',
    )
  })

  it('exposes severity / card_kind / freshness as data-* only — never as visible copy', () => {
    render(<V5ReviewCardBlock block={REVIEW} />)
    const card = screen.getByTestId('v5-review-card')
    expect(card).toHaveAttribute('data-severity', 'info')
    expect(card).toHaveAttribute('data-card-kind', 'assumption')
    expect(card).toHaveAttribute('data-freshness', 'fresh')
    // Enum tokens must not leak into visible text.
    expect(card.textContent).not.toMatch(/assumption_check|\binfo\b|\bfresh\b/)
  })

  it('warning/critical severity switches the visual channel (data-severity), copy unchanged', () => {
    render(<V5ReviewCardBlock block={{ ...REVIEW, severity: 'critical' }} />)
    expect(screen.getByTestId('v5-review-card')).toHaveAttribute('data-severity', 'critical')
    expect(screen.getByTestId('v5-review-card-body')).toHaveTextContent(REVIEW.body)
  })

  it('renders no action pill when the producer sent no action refs', () => {
    render(<V5ReviewCardBlock block={REVIEW} />)
    expect(screen.queryByTestId('v5-review-card-action')).not.toBeInTheDocument()
  })

  it('renders the producer action_label verbatim when present', () => {
    render(
      <V5ReviewCardBlock
        block={{ ...REVIEW, action_intent: 'confirm_factor', action_label: 'Confirm this assumption' }}
      />,
    )
    const action = screen.getByTestId('v5-review-card-action')
    expect(action).toHaveTextContent('Confirm this assumption')
    expect(action).toHaveAttribute('data-action-intent', 'confirm_factor')
  })
})

describe('V5CoachingBlock', () => {
  it('renders producer title, body, and action_label VERBATIM', () => {
    render(<V5CoachingBlock block={COACHING} />)
    expect(screen.getByTestId('v5-coaching-title')).toHaveTextContent(COACHING.title)
    expect(screen.getByTestId('v5-coaching-body')).toHaveTextContent(COACHING.body)
    expect(screen.getByTestId('v5-coaching-action')).toHaveTextContent('Confirm this assumption')
  })

  it('exposes coaching_kind / source / freshness as data-* only — never as visible copy', () => {
    render(<V5CoachingBlock block={COACHING} />)
    const card = screen.getByTestId('v5-coaching')
    expect(card).toHaveAttribute('data-coaching-kind', 'assumption_check')
    expect(card).toHaveAttribute('data-coaching-source', 'decision_review')
    expect(card).toHaveAttribute('data-freshness', 'fresh')
    expect(card.textContent).not.toMatch(/assumption_check|decision_review|\bfresh\b/)
  })

  it('renders no refs list when target_refs is empty', () => {
    render(<V5CoachingBlock block={COACHING} />)
    expect(screen.queryByTestId('v5-coaching-refs')).not.toBeInTheDocument()
  })
})
