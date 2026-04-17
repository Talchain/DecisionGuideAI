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

describe('TriageCard — compact EVPI pp pill (consistency with default variant)', () => {
  it('renders Npp pill in compact variant when evoiImpact is provided', () => {
    // Surfaced evidence-gap cards ranked 4-6 live in the compact variant via
    // AlsoConsiderDisclosure. They need the Npp signal for the same reason
    // the default variant's top-3 cards do (Brief 4 Phase 8 P1 #2).
    render(
      <TriageCard
        cardKey="k1"
        ordinal={4}
        title="Factor X"
        detail="Detail"
        category="add_evidence"
        variant="compact"
        evoiImpact={2.5}
      />,
    )
    expect(screen.getByText('2.5pp')).toBeInTheDocument()
  })

  it('omits the EVPI pill in compact when evoiImpact is null', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={4}
        title="Factor X"
        detail="Detail"
        category="add_evidence"
        variant="compact"
      />,
    )
    expect(screen.queryByText(/pp$/)).not.toBeInTheDocument()
  })
})

describe('TriageCard — compact subtitle no longer truncates (Brief 4 hotfix Task 2)', () => {
  it('renders the full compact subtitle instead of single-line truncating', () => {
    // 40-char subtitle that used to end in "Connects to 2 downstream..."
    const subtitle = 'Connects to 2 downstream relationships'
    render(
      <TriageCard
        cardKey="k1"
        ordinal={1}
        title="Annual Assistant Cost"
        detail="Detail"
        subtitle={subtitle}
        category="verify"
        variant="compact"
        action={{ kind: 'confirm', label: 'Confirm', targetId: 'n1', targetType: 'node' }}
        onConfirm={() => {}}
      />,
    )
    // Full subtitle present in DOM, not replaced by "..."
    expect(screen.getByText(subtitle)).toBeInTheDocument()
  })
})

describe('TriageCard — optional ordinal badge (Brief 4 hotfix Task 4)', () => {
  it('renders a numeric badge when ordinal is provided', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={3}
        title="Factor A"
        detail="Detail"
        category="verify"
      />,
    )
    // The badge renders the ordinal text verbatim
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('omits the numeric badge when ordinal is undefined (Start Here card)', () => {
    render(
      <TriageCard
        cardKey="start-here"
        title="Factor A"
        detail="Detail"
        category="verify"
      />,
    )
    // No "0" or any other numeric badge next to the title
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    // Title still renders
    expect(screen.getByText('Factor A')).toBeInTheDocument()
  })

  it('compact variant also omits the badge when ordinal is undefined', () => {
    render(
      <TriageCard
        cardKey="start-here-compact"
        title="Factor B"
        detail="Detail"
        category="verify"
        variant="compact"
      />,
    )
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.getByText('Factor B')).toBeInTheDocument()
  })
})

describe('TriageCard — icon-group spacing (P1.3)', () => {
  it('default variant action-icon group uses gap-2 (8px)', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={1}
        title="Factor A"
        detail="Sample detail"
        subtitle="Calibrate this factor for the outcome you expect"
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
        subtitle="Verify the baseline captured from your brief"
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
        subtitle="Calibrate this factor for the outcome you expect"
        category="verify"
        variant="compact"
        action={{ kind: 'confirm', label: 'Confirm', targetId: 'n1', targetType: 'node' }}
        onConfirm={() => {}}
      />,
    )
    // Subtitle must be visible in the rendered output — previously it was
    // destructured from props and never rendered in compact mode.
    expect(screen.getByText('Calibrate this factor for the outcome you expect')).toBeInTheDocument()
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
        subtitle="Calibrate this factor for the outcome you expect"
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
          subtitle="Calibrate this factor for the outcome you expect"
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
