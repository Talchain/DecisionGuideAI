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
// Brief 5.7 close-out follow-up: test no longer imports from `@/canvas/` so
// `src/components/shared/` (including its tests) carries zero canvas
// dependencies. The slot-injection prop pattern means TriageCard does not
// own the rendered AI-affordance button — consumers do — so the slot test
// uses a lightweight stub that mirrors the real `data-testid` only.

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

describe('TriageCard — compact subtitle no longer truncates (Brief 4 hotfix Task 2 + Brief 5.2 Task 5 regression)', () => {
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

  // Brief 5.2 Task 5: longer subtitles must also wrap (via ExpandableCoachingText
  // two-line clamp + "More" toggle), never ellipsise. Guards against a future
  // revert that swaps ExpandableCoachingText for a single-line truncate.
  it('longer subtitles render fully or with a "More" toggle, never end in "…"', () => {
    const longSubtitle = 'Connects to 2 downstream relationships and could shift the outcome'
    render(
      <TriageCard
        cardKey="k-brief-5_2"
        ordinal={1}
        title="Test Factor"
        detail="Detail"
        subtitle={longSubtitle}
        category="verify"
        variant="compact"
        action={{ kind: 'confirm', label: 'Confirm', targetId: 'n1', targetType: 'node' }}
        onConfirm={() => {}}
      />,
    )
    const body = document.body.textContent ?? ''
    // The ASCII three-dot ellipsis from the old truncate path must not
    // appear in the rendered subtitle.
    expect(body).not.toMatch(/Connects to 2 downstream[^…]*\.\.\./)
    // The Unicode ellipsis U+2026 (the typeof ellipsis Tailwind's `truncate`
    // inserts) must not appear either.
    expect(body).not.toContain('Connects to 2 downstream relationships and could shift the outcome…')
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

describe('TriageCard — icon-group spacing (P1.3, tightened in pre-analysis layout pass)', () => {
  it('default variant action-icon group uses gap-1.5 (6px) — tightened to recover width for the subtitle row', () => {
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
      />,
    )
    const iconGroup = screen.getByTestId('triage-card-icon-group')
    expect(iconGroup.className).toContain('gap-1.5')
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

describe('TriageCard — AI affordance slot (UI-BUG-5)', () => {
  // Stub stand-in for the real DiscussWithAiButton. The behaviour of record
  // at this layer is "TriageCard renders the slot exactly once where provided",
  // not the button's own behaviour (covered by canvas-side tests).
  const DiscussStub = () => <button type="button" data-testid="discuss-with-ai">Discuss</button>

  it('renders the slot exactly once when aiDiscussSlot is provided', () => {
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
        aiDiscussSlot={<DiscussStub />}
        onConfirm={() => {}}
        onEdit={() => {}}
      />,
    )
    // Only one AI affordance per card. Guards against regressing a second
    // top-right sparkle badge.
    expect(screen.getAllByTestId('discuss-with-ai')).toHaveLength(1)
  })

  it('renders zero AI affordance buttons when aiDiscussSlot is absent', () => {
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

describe('TriageCard — edge title truncation (P1.5 follow-up, updated 5.8B hotfix)', () => {
  it('shows only the target factor name for edge titles; full title in tooltip', () => {
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
    // Only the target factor name renders — source is hidden to save space.
    expect(screen.getByText('Delivery Throughput')).toBeInTheDocument()
    // Source is NOT rendered as visible text (available only via title tooltip).
    expect(screen.queryByText('Developer Headcount Added')).not.toBeInTheDocument()
    // Full source → target string preserved in the title tooltip.
    const titleEl = screen.getByTitle('Developer Headcount Added → Delivery Throughput')
    expect(titleEl).toBeInTheDocument()
  })
})

// ── Parametrised variant-parity (Brief 4 hotfix self-review P1.3) ──────────
//
// Locks behaviour that MUST be present in BOTH default and compact variants.
// Individual variant tests above exercise each side once; this block asserts
// parity for the same props across both variants so a regression on one
// variant can't slip past unit tests that only touched the other.
//
// Axes covered:
//   - Task 2: ExpandableCoachingText renders the full subtitle (no "…")
//   - Task 4: ordinal badge is hidden when ordinal is undefined
//   - Task 8 / EVPI pill: Npp pill renders when evoiImpact is set, is absent when null
//
// Task 3 (editor pre-fill / cap hint subtitle) is deliberately excluded —
// the compact variant has no inline editor by design, so the subtitle-hint
// override only applies in the default variant. Panel-level behaviour for
// Task 3 is covered by the resolveEditorRawValue / resolveCapHintSubtitle
// unit tests and by the PreAnalysisPanel editorConfig wiring.
describe.each(['default', 'compact'] as const)(
  'TriageCard parity — variant="%s"',
  variant => {
    it('renders the full subtitle (Task 2 — ExpandableCoachingText)', () => {
      const subtitle = 'Connects to 2 downstream relationships'
      render(
        <TriageCard
          cardKey="k-parity-subtitle"
          ordinal={1}
          title="Factor A"
          detail="Detail"
          subtitle={subtitle}
          category="verify"
          variant={variant}
          action={{ kind: 'confirm', label: 'Confirm', targetId: 'n1', targetType: 'node' }}
          onConfirm={() => {}}
        />,
      )
      expect(screen.getByText(subtitle)).toBeInTheDocument()
      // Guard the truncation regression: the literal "…" ellipsis from the
      // old single-line truncate path must never appear in the DOM text.
      const body = document.body.textContent ?? ''
      expect(body).not.toMatch(/Connects to 2 downstream\.\.\./)
    })

    it('omits the ordinal badge when ordinal is undefined (Task 4)', () => {
      render(
        <TriageCard
          cardKey="k-parity-no-ordinal"
          title="Start here"
          detail="Detail"
          category="verify"
          variant={variant}
        />,
      )
      expect(screen.queryByText('0')).not.toBeInTheDocument()
      expect(screen.getByText('Start here')).toBeInTheDocument()
    })

    it('renders the ordinal badge when ordinal is provided (Task 4 inverse)', () => {
      render(
        <TriageCard
          cardKey="k-parity-with-ordinal"
          ordinal={3}
          title="Factor C"
          detail="Detail"
          category="verify"
          variant={variant}
        />,
      )
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('renders the Npp EVPI pill when evoiImpact is set (Phase 8 P1 #2)', () => {
      render(
        <TriageCard
          cardKey="k-parity-evpi"
          ordinal={2}
          title="Factor D"
          detail="Detail"
          category="add_evidence"
          variant={variant}
          evoiImpact={2.5}
        />,
      )
      expect(screen.getByText('2.5pp')).toBeInTheDocument()
    })

    it('omits the Npp pill when evoiImpact is null', () => {
      render(
        <TriageCard
          cardKey="k-parity-no-evpi"
          ordinal={2}
          title="Factor E"
          detail="Detail"
          category="add_evidence"
          variant={variant}
        />,
      )
      expect(screen.queryByText(/\d+\.\d+pp$/)).not.toBeInTheDocument()
    })
  },
)

// ── Pre-analysis narrow-panel layout invariants ─────────────────────────────
//
// Locks the surgical layout fixes applied after the three priority cards in
// the pre-analysis panel were observed wrapping awkwardly inside the 280–480px
// resizable right dock. Each describe block targets one invariant so a future
// agent that regresses one of them sees a single, named failure.

describe('TriageCard — default variant stacks subtitle above value controls', () => {
  it('places subtitle and InlineValueControls in a flex-col container (not the legacy items-start gap-2 row)', () => {
    render(
      <TriageCard
        cardKey="k-stack"
        ordinal={1}
        title="Hiring and Salary Spend"
        detail="Detail"
        subtitle="Connects to 1 downstream relationship"
        category="verify"
        action={{ kind: 'set_value', label: 'Set value', targetId: 'n1', targetType: 'node' }}
        editorConfig={{ kind: 'factor', rawValue: 0, cap: null, unit: 'GBP', onSave: () => {}, onCancel: () => {} }}
        onConfirm={() => {}}
        onEdit={() => {}}
      />,
    )
    const input = screen.getByLabelText('Value for Hiring and Salary Spend')
    // Walk up to the body wrapper (the div directly under the card root that
    // contains both ExpandableCoachingText and InlineValueControls).
    let parent: HTMLElement | null = input
    while (parent && !parent.className.includes('flex-col')) {
      parent = parent.parentElement
    }
    expect(parent).not.toBeNull()
    expect(parent!.className).toContain('flex-col')
    // Guard against regression to the old horizontal squeeze.
    expect(parent!.className).not.toContain('items-start gap-2')
  })

  it('routes the action-icon branch through a right-aligned wrapper too', () => {
    render(
      <TriageCard
        cardKey="k-stack-action"
        ordinal={1}
        title="Factor A"
        detail="Detail"
        subtitle="Calibrate this factor for the outcome you expect"
        category="verify"
        action={{ kind: 'confirm', label: 'Confirm', targetId: 'n1', targetType: 'node' }}
        onConfirm={() => {}}
        onEdit={() => {}}
      />,
    )
    const iconGroup = screen.getByTestId('triage-card-icon-group')
    expect(iconGroup.parentElement?.className).toContain('justify-end')
  })

  it('default-variant input is w-16 (tightened from w-20) and uses the "Value" placeholder', () => {
    render(
      <TriageCard
        cardKey="k-tight"
        ordinal={1}
        title="Factor A"
        detail="Detail"
        subtitle="Connects to 1 downstream relationship"
        category="verify"
        action={{ kind: 'set_value', label: 'Set value', targetId: 'n1', targetType: 'node' }}
        editorConfig={{ kind: 'factor', rawValue: null, cap: null, unit: '', onSave: () => {}, onCancel: () => {} }}
      />,
    )
    const input = screen.getByLabelText('Value for Factor A') as HTMLInputElement
    expect(input.className).toContain('w-16')
    expect(input.className).not.toContain('w-20')
    expect(input.placeholder).toBe('Value')
  })
})

describe('TriageCard — edge strength pills carry a "Strength:" lead-in', () => {
  it('renders the Strength: label before the Weak / Moderate / Strong group', () => {
    render(
      <TriageCard
        cardKey="k-edge-strength"
        ordinal={2}
        title="Budget Constraint Severity → Budget Overrun Risk"
        detail="Edge coaching"
        subtitle="How strongly does Budget Constraint Severity affect Budget Overrun Risk?"
        category="verify"
        action={{ kind: 'edit', label: 'Edit', targetId: 'e1', targetType: 'edge' }}
        onUpdateEdgeStrength={() => {}}
      />,
    )
    expect(screen.getByText('Strength:')).toBeInTheDocument()
    // All three band labels still render
    expect(screen.getByText('Weak')).toBeInTheDocument()
    expect(screen.getByText('Moderate')).toBeInTheDocument()
    expect(screen.getByText('Strong')).toBeInTheDocument()
  })
})

describe('TriageCard — short subtitles render without a More/Less disclosure', () => {
  // The three real strings observed in the pre-analysis panel screenshots.
  // All are under the 80-char SHORT_TEXT_THRESHOLD and must render in full
  // with no disclosure toggle on the narrow right-dock width.
  const BRIEF_EXAMPLES = [
    { name: 'connects-to-relationship', text: 'Connects to 1 downstream relationship' },
    { name: 'edge-question', text: 'How strongly does Launch Deadline Pressure affect Launch Delay Risk?' },
    { name: 'no-data-placeholder', text: 'No data yet. Set a value to include in analysis.' },
  ] as const

  it.each(BRIEF_EXAMPLES)('"$name" renders without a More or Less toggle', ({ text }) => {
    render(
      <TriageCard
        cardKey="k-short"
        ordinal={1}
        title="Factor A"
        detail="Detail"
        subtitle={text}
        category="verify"
        action={{ kind: 'set_value', label: 'Set value', targetId: 'n1', targetType: 'node' }}
        editorConfig={{ kind: 'factor', rawValue: null, cap: null, unit: '', onSave: () => {}, onCancel: () => {} }}
      />,
    )
    expect(screen.getByText(text)).toBeInTheDocument()
    // Disclosure-toggle button must not exist — short text always renders in full.
    expect(screen.queryByRole('button', { name: /^More$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Less$/i })).not.toBeInTheDocument()
  })

  // Positive guard: long CEE coaching strings (the actual disclosure use-case)
  // must still preserve the threshold path. Without this, a future agent
  // could raise SHORT_TEXT_THRESHOLD to a huge number and the negative tests
  // above would silently pass while real coaching strings stopped being
  // disclosure-aware. We assert the long-text path keeps the underlying
  // measurement infrastructure attached (line-clamp style on the <p>).
  it('long CEE coaching strings (>= 80 chars) still receive the clamp style for disclosure measurement', () => {
    const longText =
      'Resolving this factor could improve confidence by 1.8pp because it directly drives the leading option ranking under the current evidence. Verify the underlying assumption before locking it in.'
    render(
      <TriageCard
        cardKey="k-long"
        ordinal={1}
        title="Factor A"
        detail="Detail"
        subtitle={longText}
        category="verify"
      />,
    )
    const paragraph = screen.getByText(longText)
    // Threshold gate must remain wired up — long text gets the line-clamp
    // style applied inline so ExpandableCoachingText can measure overflow.
    expect(paragraph.style.webkitLineClamp).toBe('2')
  })
})
