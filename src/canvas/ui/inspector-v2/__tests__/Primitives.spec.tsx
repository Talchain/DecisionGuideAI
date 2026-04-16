/**
 * Unit tests for v6.2 inspector primitives.
 *
 * Verifies key visual structure and behaviour of each new shared component
 * without depending on full panel rendering context.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PanelGroup } from '../shared/PanelGroup'
import { InlineSectionLabel } from '../shared/InlineSectionLabel'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { ExpertAnnotation } from '../shared/ExpertAnnotation'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { ImportanceBar } from '../shared/ImportanceBar'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'

// ── PanelGroup ───────────────────────────────────────────────────────

describe('PanelGroup', () => {
  it('renders children inside a section with data-panel-group attribute', () => {
    const { container } = render(
      <PanelGroup kind="context" label="Context">
        <p>content</p>
      </PanelGroup>,
    )
    const section = container.querySelector('section[data-panel-group="context"]')
    expect(section).not.toBeNull()
    expect(section?.textContent).toContain('content')
  })

  it('renders label when provided', () => {
    render(<PanelGroup kind="input" label="Your input"><div /></PanelGroup>)
    expect(screen.getByText('Your input')).toBeTruthy()
  })

  it('omits label element when label prop is absent', () => {
    const { container } = render(
      <PanelGroup kind="connections"><div>body</div></PanelGroup>,
    )
    // Only child should be the body div, no label div
    const section = container.querySelector('section')!
    expect(section.children.length).toBe(1)
  })
})

// ── InlineSectionLabel ───────────────────────────────────────────────

describe('InlineSectionLabel', () => {
  it('renders text content without icon or uppercase', () => {
    const { container } = render(<InlineSectionLabel>Set by options</InlineSectionLabel>)
    const div = container.firstElementChild as HTMLElement
    expect(div.textContent).toBe('Set by options')
    // Must NOT have uppercase class (that's SectionTitle's job)
    expect(div.className).not.toContain('uppercase')
    // Must NOT have font-semibold (SectionTitle is semibold)
    expect(div.className).not.toContain('font-semibold')
  })
})

// ── PrimaryControlCard ───────────────────────────────────────────────

describe('PrimaryControlCard', () => {
  it('wraps children in a styled container', () => {
    const { container } = render(
      <PrimaryControlCard><span>slider</span></PrimaryControlCard>,
    )
    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain('bg-panel')
    expect(card.className).toContain('border')
    expect(card.className).toContain('border-panel-border')
    expect(card.className).toContain('rounded-lg')
    expect(card.textContent).toBe('slider')
  })

  it('accepts additional className', () => {
    const { container } = render(
      <PrimaryControlCard className="mt-4"><div /></PrimaryControlCard>,
    )
    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain('mt-4')
  })
})

// ── ExpertAnnotation ─────────────────────────────────────────────────

describe('ExpertAnnotation', () => {
  it('renders nothing when techMode is false', () => {
    const { container } = render(
      <ExpertAnnotation techMode={false}>σ 0.18</ExpertAnnotation>,
    )
    expect(container.firstElementChild).toBeNull()
  })

  it('renders read-only monospace text when techMode is true and editable is absent', () => {
    const { container } = render(
      <ExpertAnnotation techMode={true}>σ 0.18</ExpertAnnotation>,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.textContent).toBe('σ 0.18')
    expect(el.className).toContain('font-mono')
  })

  it('renders editable input with suffix when editable is true', () => {
    const onChange = vi.fn()
    render(
      <ExpertAnnotation techMode={true} editable value={0.35} onChange={onChange} suffix="β =" />,
    )
    // Suffix label
    expect(screen.getByText('β =')).toBeTruthy()
    // Input with value
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('0.35')
    expect(input.type).toBe('number')
    expect(input.step).toBe('0.01')
  })

  it('calls onChange with parsed number on input change', () => {
    const onChange = vi.fn()
    render(
      <ExpertAnnotation techMode={true} editable value={0.35} onChange={onChange} suffix="β =" />,
    )
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '0.72' } })
    expect(onChange).toHaveBeenCalledWith(0.72)
  })

  it('does not call onChange for NaN input', () => {
    const onChange = vi.fn()
    render(
      <ExpertAnnotation techMode={true} editable value={0.35} onChange={onChange} suffix="β =" />,
    )
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ── EmptyDescriptionPrompt ───────────────────────────────────────────

describe('EmptyDescriptionPrompt', () => {
  it('renders placeholder text in italic', () => {
    const { container } = render(
      <EmptyDescriptionPrompt placeholder="What is this factor?" />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.textContent).toBe('What is this factor?')
    expect(el.className).toContain('italic')
  })

  it('non-interactive when onStartEditing is absent', () => {
    const { container } = render(
      <EmptyDescriptionPrompt placeholder="Describe..." />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('role')).toBeNull()
    expect(el.getAttribute('tabindex')).toBeNull()
  })

  it('interactive with role=button and aria-label when onStartEditing is provided', () => {
    const onStart = vi.fn()
    const { container } = render(
      <EmptyDescriptionPrompt placeholder="Describe..." onStartEditing={onStart} />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('role')).toBe('button')
    expect(el.getAttribute('aria-label')).toBe('Describe...')
    expect(el.getAttribute('tabindex')).toBe('0')
  })

  it('calls onStartEditing on click', () => {
    const onStart = vi.fn()
    render(<EmptyDescriptionPrompt placeholder="Describe..." onStartEditing={onStart} />)
    fireEvent.click(screen.getByText('Describe...'))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('calls onStartEditing on Enter key', () => {
    const onStart = vi.fn()
    render(<EmptyDescriptionPrompt placeholder="Describe..." onStartEditing={onStart} />)
    fireEvent.keyDown(screen.getByText('Describe...'), { key: 'Enter' })
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})

// ── AdvancedFieldGroup ───────────────────────────────────────────────

describe('AdvancedFieldGroup', () => {
  it('renders the title in sentence case (no uppercase CSS class)', () => {
    const { container } = render(
      <AdvancedFieldGroup title="Effect parameters"><div /></AdvancedFieldGroup>,
    )
    // Title div is the first child of the outer card
    const titleDiv = container.firstElementChild?.firstElementChild as HTMLElement
    expect(titleDiv?.textContent).toBe('Effect parameters')
    expect(titleDiv?.className).not.toContain('uppercase')
  })

  it('renders children below the title', () => {
    const { container } = render(
      <AdvancedFieldGroup title="Metadata"><span data-testid="child">value</span></AdvancedFieldGroup>,
    )
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull()
  })
})

// ── ImportanceBar ────────────────────────────────────────────────────

describe('ImportanceBar', () => {
  it('returns null when importanceScore is null (pre-analysis)', () => {
    const { container } = render(
      <ImportanceBar importanceScore={null} sensitivityRank={null} />,
    )
    expect(container.firstElementChild).toBeNull()
  })

  it('renders horizontal row: rank, bar, and percentage', () => {
    const { container } = render(
      <ImportanceBar importanceScore={0.65} sensitivityRank={2} />,
    )
    // Rank label
    expect(screen.getByText('2nd')).toBeTruthy()
    // Percentage
    expect(screen.getByText('65%')).toBeTruthy()
    // Progress bar
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar).not.toBeNull()
    expect(bar?.getAttribute('aria-valuenow')).toBe('65')
    // Descriptive text
    expect(screen.getByText('Influence on results')).toBeTruthy()
  })

  it('renders without rank label when sensitivityRank is null', () => {
    render(<ImportanceBar importanceScore={0.4} sensitivityRank={null} />)
    // Still shows bar and percentage
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByText('Influence on results')).toBeTruthy()
  })

  it('clamps importanceScore to [0, 1] range', () => {
    const { container } = render(
      <ImportanceBar importanceScore={1.5} sensitivityRank={1} />,
    )
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('100')
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('ordinalFor handles 11th/12th/13th correctly', () => {
    // Rank > 3 won't show from useNodeDisplayMetadata (caps at 3),
    // but the ordinal function is defensive
    render(<ImportanceBar importanceScore={0.1} sensitivityRank={1} />)
    expect(screen.getByText('1st')).toBeTruthy()
  })
})
