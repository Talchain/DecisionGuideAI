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
import { describe, it, expect } from 'vitest'
import { TriageCard } from '../TriageCard'

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
