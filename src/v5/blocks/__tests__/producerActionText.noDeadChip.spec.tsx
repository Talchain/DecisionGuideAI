/**
 * RC ruling (programme-docs #63 5819467504): a producer `action_label` with no
 * command behind it renders as plain text — never as a chip-styled dead control.
 *
 * `review_card` and `evidence` blocks carry `action_label` but, by contract, no
 * `action_prompt` (only `coaching` does), so a click has nothing to send. Before
 * this change both drew the label as a rounded, bordered pill in the grammar of
 * a working chip; on a Run turn the top-level "Strengthen this evidence" looked
 * like a button and did nothing.
 *
 * "Looks like a control" is pinned by what a user and a screen reader get:
 * not a button/link, no pill border or rounding, not focusable. The producer
 * text and the intent attribute still survive verbatim.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V5ReviewCardBlock } from '../V5ReviewCardBlock'
import { V5EvidenceBlock } from '../V5EvidenceBlock'
import type {
  V5ReviewCardBlock as V5ReviewCardBlockType,
  V5EvidenceBlock as V5EvidenceBlockType,
} from '../../../canvas/conversation/types'

const REVIEW: V5ReviewCardBlockType = {
  type: 'v5_review_card',
  block_id: 'e2f8988e-ccf0-5d10-ad58-99c45ec5230c',
  title: 'A load-bearing assumption',
  body: 'Competitive Intensity is assumed to remain stable.',
  severity: 'info',
  card_kind: 'assumption',
  target_refs: [],
  priority_rank: 71,
  freshness: 'fresh',
  action_intent: 'confirm_factor',
  action_label: 'Confirm this assumption',
}

const EVIDENCE: V5EvidenceBlockType = {
  type: 'v5_evidence',
  block_id: '7d9f2a44-1b3c-5e6f-8a90-123456789abc',
  factor_label: 'Churn Trend',
  factor_ref: { id: 'fac_churn_trend', label: 'Churn Trend', kind: 'factor' },
  target_refs: [{ id: 'fac_churn_trend', label: 'Churn Trend', kind: 'factor' }],
  current_confidence: 'medium',
  evidence_gap: 'This will clarify if rising churn could undermine any growth strategy.',
  suggested_technique: 'Pull the last four quarters of churn.',
  impact_if_gathered: 'A firmer churn estimate would settle the comparison.',
  priority_rank: 1,
  severity: 'info',
  freshness: 'fresh',
  action_intent: 'gather_evidence',
  action_label: 'Strengthen this evidence',
}

function expectPlainText(el: HTMLElement, label: string, intent: string) {
  expect(el.textContent).toBe(label)
  expect(el.getAttribute('data-action-intent')).toBe(intent)
  expect(el.getAttribute('data-action-kind')).toBe('text')
  expect(['BUTTON', 'A']).not.toContain(el.tagName)
  expect(el.getAttribute('role')).toBeNull()
  expect(el.hasAttribute('tabindex')).toBe(false)
  expect(el.className).not.toMatch(/rounded-full|\bborder\b|border-info/)
}

describe('a label with no command is text, not a dead chip', () => {
  it('review card', () => {
    render(<V5ReviewCardBlock block={REVIEW} />)
    expectPlainText(screen.getByTestId('v5-review-card-action'), 'Confirm this assumption', 'confirm_factor')
    expect(screen.queryByRole('button', { name: 'Confirm this assumption' })).toBeNull()
  })

  it('evidence card', () => {
    render(<V5EvidenceBlock block={EVIDENCE} />)
    expectPlainText(screen.getByTestId('v5-evidence-action'), 'Strengthen this evidence', 'gather_evidence')
    expect(screen.queryByRole('button', { name: 'Strengthen this evidence' })).toBeNull()
  })
})
