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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// ─── Track C slice 2 (Lane UI-W4 C): evidence / exercise renderers ────────

import { V5EvidenceBlock } from '../V5EvidenceBlock'
import { V5ExerciseBlock } from '../V5ExerciseBlock'
import type {
  V5EvidenceBlock as V5EvidenceBlockType,
  V5ExerciseBlock as V5ExerciseBlockType,
} from '../../../canvas/conversation/types'

const EVIDENCE: V5EvidenceBlockType = {
  type: 'v5_evidence',
  block_id: '7d9f2a44-1b3c-5e6f-8a90-123456789abc',
  factor_label: 'Conversion Rate',
  factor_ref: { id: 'fac_conversion_rate', label: 'Conversion Rate', kind: 'factor' },
  target_refs: [
    { id: 'fac_conversion_rate', label: 'Conversion Rate', kind: 'factor' },
    { id: 'opt_paid_ads', label: 'Paid Advertising', kind: 'option' },
  ],
  current_confidence: 'low',
  evidence_gap: 'The conversion rate estimate is based on a single week of data.',
  suggested_technique: 'Run the funnel report for the last quarter and compare weekly variance.',
  impact_if_gathered: 'A firmer conversion estimate would settle which option leads.',
  priority_rank: 41,
  severity: 'warning',
  freshness: 'fresh',
  action_intent: 'gather_evidence',
  action_label: 'Gather conversion evidence',
}

const EXERCISE: V5ExerciseBlockType = {
  type: 'v5_exercise',
  block_id: '3c1d5b26-9e7a-5f40-b1c2-abcdef012345',
  exercise_kind: 'pre_mortem',
  failure_scenario:
    'Twelve months in, the migration stalls because the legacy system\'s edge cases were undocumented.',
  warning_signs: [
    'Integration test coverage stays flat for two sprints',
    'The legacy team\'s answers start with \'it depends\'',
  ],
  mitigation: 'Timebox a two-week legacy discovery spike before committing the migration date.',
  target_refs: [{ id: 'opt_migrate', label: 'Migrate to the new platform', kind: 'option' }],
  freshness: 'fresh',
}

describe('V5EvidenceBlock', () => {
  it('renders the primary factor ref label as the title (§1.3: target_refs label preferred over factor_label) and the three producer paragraphs VERBATIM', () => {
    render(
      <V5EvidenceBlock
        block={{
          ...EVIDENCE,
          // Conflict case: contract says renderers prefer target_refs[].label.
          factor_label: 'Stale Label',
        }}
      />,
    )
    expect(screen.getByTestId('v5-evidence-title')).toHaveTextContent('Conversion Rate')
    expect(screen.getByTestId('v5-evidence-gap')).toHaveTextContent(EVIDENCE.evidence_gap)
    expect(screen.getByTestId('v5-evidence-technique')).toHaveTextContent(
      EVIDENCE.suggested_technique,
    )
    expect(screen.getByTestId('v5-evidence-impact')).toHaveTextContent(
      EVIDENCE.impact_if_gathered,
    )
  })

  it('falls back to factor_label when no factor entry exists in target_refs', () => {
    render(
      <V5EvidenceBlock
        block={{
          ...EVIDENCE,
          target_refs: [{ id: 'opt_paid_ads', label: 'Paid Advertising', kind: 'option' }],
        }}
      />,
    )
    expect(screen.getByTestId('v5-evidence-title')).toHaveTextContent('Conversion Rate')
  })

  it('exposes severity / current_confidence / freshness as data-* only — never as visible copy', () => {
    render(<V5EvidenceBlock block={EVIDENCE} />)
    const card = screen.getByTestId('v5-evidence')
    expect(card).toHaveAttribute('data-severity', 'warning')
    expect(card).toHaveAttribute('data-current-confidence', 'low')
    expect(card).toHaveAttribute('data-freshness', 'fresh')
    expect(card.textContent).not.toMatch(/\blow\b|\bwarning\b|\bfresh\b/)
  })

  it('renders target_refs pills and the producer action_label verbatim', () => {
    render(<V5EvidenceBlock block={EVIDENCE} />)
    expect(screen.getByTestId('v5-evidence-refs')).toHaveTextContent('Paid Advertising')
    const action = screen.getByTestId('v5-evidence-action')
    expect(action).toHaveTextContent('Gather conversion evidence')
    expect(action).toHaveAttribute('data-action-intent', 'gather_evidence')
  })

  it('renders no action pill when the producer sent none', () => {
    const noAction: V5EvidenceBlockType = { ...EVIDENCE }
    delete noAction.action_intent
    delete noAction.action_label
    render(<V5EvidenceBlock block={noAction} />)
    expect(screen.queryByTestId('v5-evidence-action')).not.toBeInTheDocument()
  })
})

describe('V5ExerciseBlock', () => {
  it('renders ONLY the producer prose fields present, VERBATIM (no invented labels or headings)', () => {
    render(<V5ExerciseBlock block={EXERCISE} />)
    expect(screen.getByTestId('v5-exercise-failure-scenario')).toHaveTextContent(
      'the legacy system\'s edge cases were undocumented',
    )
    expect(screen.getByTestId('v5-exercise-mitigation')).toHaveTextContent(
      EXERCISE.mitigation as string,
    )
    expect(screen.queryByTestId('v5-exercise-counter-case')).not.toBeInTheDocument()
    expect(screen.queryByTestId('v5-exercise-review-trigger')).not.toBeInTheDocument()
    expect(screen.queryByTestId('v5-exercise-reference-class')).not.toBeInTheDocument()
  })

  it('renders warning_signs as a list, one producer string per item', () => {
    render(<V5ExerciseBlock block={EXERCISE} />)
    const list = screen.getByTestId('v5-exercise-warning-signs')
    const items = list.querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Integration test coverage stays flat for two sprints')
  })

  it('exposes exercise_kind / freshness as data-* only — never as visible copy', () => {
    render(<V5ExerciseBlock block={EXERCISE} />)
    const card = screen.getByTestId('v5-exercise')
    expect(card).toHaveAttribute('data-exercise-kind', 'pre_mortem')
    expect(card).toHaveAttribute('data-freshness', 'fresh')
    expect(card.textContent).not.toMatch(/pre_mortem|\bfresh\b/)
  })

  it('renders target_element_ref and target_refs as pills', () => {
    render(
      <V5ExerciseBlock
        block={{
          ...EXERCISE,
          target_element_ref: { id: 'fac_cost', label: 'Total Cost', kind: 'factor' },
        }}
      />,
    )
    const refs = screen.getByTestId('v5-exercise-refs')
    expect(refs).toHaveTextContent('Total Cost')
    expect(refs).toHaveTextContent('Migrate to the new platform')
  })

  it('renders no refs list when neither target_element_ref nor target_refs exist', () => {
    render(<V5ExerciseBlock block={{ ...EXERCISE, target_refs: [] }} />)
    expect(screen.queryByTestId('v5-exercise-refs')).not.toBeInTheDocument()
  })
})

// ─── R1 (UI-SEAMLESSNESS-REVIEW): target_refs pills are click-to-focus ─────
//
// Uses the REAL focusHelpers singleton with registered spies (the
// focusHelpers.failClosed.spec.ts pattern) so the assertion covers the whole
// path: pill click → focusByTarget → focusNodeById → registered impl.

import { registerFocusHelpers } from '../../../canvas/utils/focusHelpers'
import { useCanvasStore } from '../../../canvas/store'

describe('Phase-3 target_refs pills — click-to-focus (R1)', () => {
  const focusNode = vi.fn()
  const focusEdge = vi.fn()
  let unregister: () => void

  beforeEach(() => {
    focusNode.mockClear()
    focusEdge.mockClear()
    unregister = registerFocusHelpers(focusNode, focusEdge)
    useCanvasStore.setState({
      nodes: [
        { id: 'fac_tech_lead', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Technical Leadership Capacity' } } as any,
        { id: 'opt_paid_ads', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Paid Advertising' } } as any,
        { id: 'opt_migrate', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Migrate to the new platform' } } as any,
        { id: 'fac_cost', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Total Cost' } } as any,
      ],
      edges: [],
    })
  })

  afterEach(() => {
    unregister()
    useCanvasStore.setState({ nodes: [], edges: [] })
  })

  it('review card: an on-canvas ref renders as a button; click focuses the node', () => {
    render(<V5ReviewCardBlock block={REVIEW} />)
    const btn = screen.getByRole('button', {
      name: /highlight technical leadership capacity on the canvas/i,
    })
    btn.click()
    expect(focusNode).toHaveBeenCalledWith('fac_tech_lead')
  })

  it('coaching: an on-canvas ref renders as a button; click focuses the node', () => {
    render(
      <V5CoachingBlock
        block={{
          ...COACHING,
          target_refs: [{ id: 'fac_tech_lead', label: 'Technical Leadership Capacity', kind: 'factor' }],
        }}
      />,
    )
    screen
      .getByRole('button', { name: /highlight technical leadership capacity on the canvas/i })
      .click()
    expect(focusNode).toHaveBeenCalledWith('fac_tech_lead')
  })

  it('evidence: option-kind refs also focus (all non-edge kinds are canvas nodes)', () => {
    render(<V5EvidenceBlock block={EVIDENCE} />)
    screen.getByRole('button', { name: /highlight paid advertising on the canvas/i }).click()
    expect(focusNode).toHaveBeenCalledWith('opt_paid_ads')
  })

  it('exercise: the merged target_element_ref pill focuses too', () => {
    render(
      <V5ExerciseBlock
        block={{
          ...EXERCISE,
          target_element_ref: { id: 'fac_cost', label: 'Total Cost', kind: 'factor' },
        }}
      />,
    )
    screen.getByRole('button', { name: /highlight total cost on the canvas/i }).click()
    expect(focusNode).toHaveBeenCalledWith('fac_cost')
  })

  it('fails closed: a ref whose id is NOT on the canvas stays an inert span, copy verbatim', () => {
    render(
      <V5ReviewCardBlock
        block={{
          ...REVIEW,
          target_refs: [{ id: 'fac_ghost', label: 'Deleted Factor', kind: 'factor' }],
        }}
      />,
    )
    expect(screen.queryByRole('button', { name: /highlight deleted factor/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('v5-review-card-refs')).toHaveTextContent('Deleted Factor')
    expect(focusNode).not.toHaveBeenCalled()
  })

  it('refs containers keep list semantics (listitem per pill) in the clickable state', () => {
    render(<V5ReviewCardBlock block={REVIEW} />)
    const refs = screen.getByTestId('v5-review-card-refs')
    expect(refs.querySelectorAll('[role="listitem"]')).toHaveLength(1)
  })
})
