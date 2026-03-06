/**
 * Tests for shared inspector v2 components
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfidenceBadge } from '../shared/ConfidenceBadge'
import { CoachingCard } from '../shared/CoachingCard'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { ProbabilityArc } from '../shared/ProbabilityArc'
import { SectionTitle } from '../shared/SectionTitle'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { ConnectionRow } from '../shared/ConnectionRow'

describe('ConfidenceBadge', () => {
  it('renders high level with checkmark glyph', () => {
    render(<ConfidenceBadge level="high" value={85} />)
    expect(screen.getByText('\u2713')).toBeTruthy()
    expect(screen.getByText('85%')).toBeTruthy()
  })

  it('renders medium level with tilde glyph', () => {
    render(<ConfidenceBadge level="medium" value={55} />)
    expect(screen.getByText('~')).toBeTruthy()
    expect(screen.getByText('55%')).toBeTruthy()
  })

  it('renders low level with question mark glyph', () => {
    render(<ConfidenceBadge level="low" value={25} />)
    expect(screen.getByText('?')).toBeTruthy()
    expect(screen.getByText('25%')).toBeTruthy()
  })

  it('renders without value when not provided', () => {
    render(<ConfidenceBadge level="high" />)
    expect(screen.getByText('\u2713')).toBeTruthy()
    expect(screen.queryByText('%')).toBeNull()
  })
})

describe('CoachingCard', () => {
  it('renders message text', () => {
    render(<CoachingCard text="Test coaching message" />)
    expect(screen.getByText('Test coaching message')).toBeTruthy()
  })

  it('renders action button when provided', () => {
    const onClick = vi.fn()
    render(<CoachingCard text="Message" action={{ label: 'Do something', onClick }} />)
    expect(screen.getByText('Do something')).toBeTruthy()
  })

  it('dismisses when X clicked', () => {
    render(<CoachingCard text="Dismissable" />)
    expect(screen.getByText('Dismissable')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Dismiss suggestion'))
    expect(screen.queryByText('Dismissable')).toBeNull()
  })
})

describe('StaleGuardBanner', () => {
  it('shows empty state when no results', () => {
    render(
      <StaleGuardBanner isStale={false} hasResults={false}>
        <div>Content</div>
      </StaleGuardBanner>,
    )
    expect(screen.getByText('Run your first simulation to see results')).toBeTruthy()
    expect(screen.queryByText('Content')).toBeNull()
  })

  it('renders children at full opacity when not stale', () => {
    const { container } = render(
      <StaleGuardBanner isStale={false} hasResults={true}>
        <div>Fresh content</div>
      </StaleGuardBanner>,
    )
    expect(screen.getByText('Fresh content')).toBeTruthy()
    expect(screen.queryByText('Results may have changed')).toBeNull()
  })

  it('shows warning banner and renders children at 0.75 opacity when stale', () => {
    render(
      <StaleGuardBanner isStale={true} hasResults={true}>
        <div>Stale content</div>
      </StaleGuardBanner>,
    )
    expect(screen.getByText('Results may have changed since your last edit')).toBeTruthy()
    expect(screen.getByText('Stale content')).toBeTruthy()
  })

  it('shows Re-run button when onRerun provided', () => {
    const onRerun = vi.fn()
    render(
      <StaleGuardBanner isStale={true} hasResults={true} onRerun={onRerun}>
        <div>Content</div>
      </StaleGuardBanner>,
    )
    fireEvent.click(screen.getByText('Re-run'))
    expect(onRerun).toHaveBeenCalledOnce()
  })
})

describe('ProbabilityArc', () => {
  it('renders percentage text', () => {
    render(<ProbabilityArc value={0.68} />)
    // SVG text
    const svg = document.querySelector('svg')
    expect(svg).toBeTruthy()
    const textEl = svg?.querySelector('text')
    expect(textEl?.textContent).toBe('68%')
  })
})

describe('SectionTitle', () => {
  it('renders uppercase label', () => {
    render(<SectionTitle icon="Target" label="Success target" />)
    expect(screen.getByText('Success target')).toBeTruthy()
  })
})

describe('TechnicalDisclosure', () => {
  it('renders nothing when visible=false', () => {
    const { container } = render(
      <TechnicalDisclosure visible={false}>
        <div>Secret</div>
      </TechnicalDisclosure>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders toggle button when visible=true', () => {
    render(
      <TechnicalDisclosure visible={true}>
        <div>Technical data</div>
      </TechnicalDisclosure>,
    )
    expect(screen.getByText('Show model detail')).toBeTruthy()
    expect(screen.queryByText('Technical data')).toBeNull()
  })

  it('shows content when toggled open', () => {
    render(
      <TechnicalDisclosure visible={true}>
        <div>Technical data</div>
      </TechnicalDisclosure>,
    )
    fireEvent.click(screen.getByText('Show model detail'))
    expect(screen.getByText('Technical data')).toBeTruthy()
  })
})

describe('ConnectionRow', () => {
  it('renders node shape, label, and strength in default mode', () => {
    render(
      <ConnectionRow
        nodeKind="outcome"
        label="Revenue growth"
        strength={{ weight: 0.45, direction: 'positive' }}
      />,
    )
    expect(screen.getByText('Revenue growth')).toBeTruthy()
    expect(screen.getByText(/Strong \+/)).toBeTruthy()
  })

  it('renders decimal value in tech mode', () => {
    render(
      <ConnectionRow
        nodeKind="outcome"
        label="Revenue growth"
        strength={{ weight: 0.45, direction: 'positive' }}
        techMode={true}
      />,
    )
    expect(screen.getByText('+0.45')).toBeTruthy()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(
      <ConnectionRow
        nodeKind="factor"
        label="Clickable"
        onClick={onClick}
      />,
    )
    fireEvent.click(screen.getByText('Clickable'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
