/**
 * Tests for shared inspector v2 components
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { getProvenanceLabel, getExtractionLabel } from '../inspectorStrings'
import { ConfidenceBadge } from '../shared/ConfidenceBadge'
import { CoachingCard } from '../shared/CoachingCard'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { ProbabilityArc } from '../shared/ProbabilityArc'
import { SectionTitle } from '../shared/SectionTitle'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { ConnectionRow } from '../shared/ConnectionRow'

// ─── Provenance mapping regression tests ────────────────────────────
describe('getProvenanceLabel', () => {
  it('maps brief_extraction to user-facing label', () => {
    expect(getProvenanceLabel('brief_extraction')).toBe('Generated from your brief')
  })

  it('maps explicit to user-facing label', () => {
    expect(getProvenanceLabel('explicit')).toBe('From your brief')
  })

  it('maps inferred to user-facing label', () => {
    expect(getProvenanceLabel('inferred')).toBe('Estimated by Olumi')
  })

  it('maps user_calibration to user-facing label', () => {
    expect(getProvenanceLabel('user_calibration')).toBe('Set by you')
  })

  it('maps default to No evidence yet', () => {
    expect(getProvenanceLabel('default')).toBe('No evidence yet')
  })

  it('prefixes unknown values with Source:', () => {
    expect(getProvenanceLabel('some_unknown')).toBe('Source: some_unknown')
  })

  it('returns No evidence yet for undefined', () => {
    expect(getProvenanceLabel(undefined)).toBe('No evidence yet')
  })
})

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
      <StaleGuardBanner hasResults={false}>
        <div>Content</div>
      </StaleGuardBanner>,
    )
    expect(screen.getByText('Run your first simulation to see results')).toBeTruthy()
    expect(screen.queryByText('Content')).toBeNull()
  })

  it('renders children at full opacity when not stale', () => {
    const { container } = render(
      <StaleGuardBanner hasResults={true}>
        <div>Fresh content</div>
      </StaleGuardBanner>,
    )
    expect(screen.getByText('Fresh content')).toBeTruthy()
    expect(screen.queryByText('Results may have changed')).toBeNull()
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
