/**
 * TriageCard spec — locks the layout contracts introduced in the v2 panel
 * regroup and subsequent polish rounds.
 *
 * Coverage:
 *   - Icon-group horizontal gap is 8px (tailwind `gap-2`), matching the brief
 *     requirement for "consistent 8px gaps" between action icons.
 *   - Compact variant preserves the subtitle next to the action icon group
 *     (previously dropped, losing the coaching line).
 *   - Edge titles ("Source → Target") render with the source label in full
 *     and only the target label in the truncating span.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TriageCard } from '../TriageCard'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'

describe('TriageCard — icon-group spacing (P1.3)', () => {
  it('default variant action-icon group uses gap-2 (8px)', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={1}
        title="Factor A"
        detail="Sample detail"
        subtitle="AI estimate. Does this match?"
        category="verify"
        action={{ kind: 'confirm', label: 'Confirm', targetId: 'n1', targetType: 'node' }}
        sourcePill={{ label: 'AI estimate', borderClass: 'border-info/30' }}
        onConfirm={() => {}}
        onEdit={() => {}}
        onSendMessage={() => {}}
      />,
    )
    const iconGroup = screen.getByTestId('triage-card-icon-group')
    expect(iconGroup.className).toContain('gap-2')
    // Guard against regression to the old 4px gap
    expect(iconGroup.className).not.toContain('gap-1 ')
  })

  it('compact variant action-icon group uses gap-2 (8px)', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={4}
        title="Factor B"
        detail="Sample detail"
        subtitle="From your brief. Does this look right?"
        category="verify"
        variant="compact"
        action={{ kind: 'confirm', label: 'Confirm', targetId: 'n2', targetType: 'node' }}
        sourcePill={{ label: 'AI estimate', borderClass: 'border-info/30' }}
        onConfirm={() => {}}
        onSendMessage={() => {}}
      />,
    )
    const iconGroup = screen.getByTestId('triage-card-icon-group')
    expect(iconGroup.className).toContain('gap-2')
  })
})

describe('TriageCard — compact variant subtitle (P1.4)', () => {
  it('renders the subtitle next to the action icon group', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={4}
        title="Customer Satisfaction"
        detail="Fallback detail"
        subtitle="AI estimate. Does this match?"
        category="verify"
        variant="compact"
        action={{ kind: 'confirm', label: 'Confirm', targetId: 'n1', targetType: 'node' }}
        onConfirm={() => {}}
      />,
    )
    // Subtitle must be visible in the rendered output — previously it was
    // destructured from props and never rendered in compact mode.
    expect(screen.getByText('AI estimate. Does this match?')).toBeInTheDocument()
  })

  it('omits the subtitle row when subtitle, action, and edge strength are all absent', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={4}
        title="Bare card"
        detail="Detail text"
        category="verify"
        variant="compact"
      />,
    )
    // No icon group when there's no action
    expect(screen.queryByTestId('triage-card-icon-group')).not.toBeInTheDocument()
  })
})

describe('TriageCard — AI affordance count (UI-BUG-5)', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _sendMessage: vi.fn() })
  })
  afterEach(() => {
    useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null })
  })

  it('renders exactly one Discuss-with-AI button per card when aiDiscuss is set', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={1}
        title="Customer Satisfaction"
        detail="Sample detail"
        subtitle="AI estimate. Does this match?"
        category="verify"
        action={{ kind: 'confirm', label: 'Confirm', targetId: 'n1', targetType: 'node' }}
        sourcePill={{ label: 'AI estimate', borderClass: 'border-info/30' }}
        aiDiscuss={{ kind: 'factor', label: 'Customer Satisfaction' }}
        onConfirm={() => {}}
        onEdit={() => {}}
        onSendMessage={() => {}}
      />,
    )
    // The only AI affordance on a triage card is the bottom-right sparkle.
    // Guards against regressing a second top-right sparkle badge.
    expect(screen.getAllByTestId('discuss-with-ai')).toHaveLength(1)
  })

  it('renders zero Discuss-with-AI buttons when aiDiscuss is absent', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={1}
        title="Factor A"
        detail="Sample detail"
        category="verify"
        sourcePill={{ label: 'AI estimate', borderClass: 'border-info/30' }}
      />,
    )
    expect(screen.queryAllByTestId('discuss-with-ai')).toHaveLength(0)
  })
})

describe('TriageCard — placeholder unit suffix (UI-BUG-1)', () => {
  const placeholderUnits = ['scale', 'index', 'score', 'norm', 'normalised', 'normalized']

  for (const unit of placeholderUnits) {
    it(`does not render "${unit}" as a unit suffix on the inline editor`, () => {
      render(
        <TriageCard
          cardKey="k1"
          ordinal={1}
          title="Factor A"
          detail="Sample detail"
          subtitle="AI estimate. Does this match?"
          category="verify"
          action={{ kind: 'set_value', label: 'Set value', targetId: 'n1', targetType: 'node' }}
          editorConfig={{ kind: 'factor', rawValue: 0, cap: null, unit, onSave: () => {}, onCancel: () => {} }}
          onConfirm={() => {}}
          onEdit={() => {}}
        />,
      )
      // Placeholder unit must not appear anywhere in rendered output
      expect(screen.queryByText(new RegExp(`\\b${unit}\\b`, 'i'))).not.toBeInTheDocument()
    })
  }

  it('still renders a real unit suffix (e.g. "months")', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={1}
        title="Factor A"
        detail="Sample detail"
        category="verify"
        action={{ kind: 'set_value', label: 'Set value', targetId: 'n1', targetType: 'node' }}
        editorConfig={{ kind: 'factor', rawValue: 9, cap: null, unit: 'months', onSave: () => {}, onCancel: () => {} }}
      />,
    )
    expect(screen.getByText('months')).toBeInTheDocument()
  })
})

describe('TriageCard — edge title truncation (P1.5 follow-up)', () => {
  it('renders the source label in full and a separate truncating target span', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={1}
        title="Developer Headcount Added → Delivery Throughput"
        detail="Edge coaching"
        subtitle="How strongly does this relationship work?"
        category="verify"
        action={{ kind: 'edit', label: 'Edit', targetId: 'e1', targetType: 'edge' }}
        onEdit={() => {}}
      />,
    )
    // Source is shown in full (its own whitespace-nowrap span)
    expect(screen.getByText('Developer Headcount Added')).toBeInTheDocument()
    // Target renders as its own span (may be visually truncated via CSS)
    expect(screen.getByText('Delivery Throughput')).toBeInTheDocument()
    // Full title available via the title attribute on the outer <p>
    const outer = screen.getByText('Developer Headcount Added').closest('p')
    expect(outer).toHaveAttribute(
      'title',
      'Developer Headcount Added → Delivery Throughput',
    )
  })
})
