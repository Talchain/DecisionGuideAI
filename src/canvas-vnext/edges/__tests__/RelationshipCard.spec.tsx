// Relationship Card — tooltip vs dialog roles, Escape/focus behaviour,
// actions availability, Simple words-only rule, stale why-line treatment.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { useViewLevelStore } from '../../state/viewLevelStore'
import { WHY_FRAGILE, STALE_CLAIM_MARKER } from '../../vm/strings'
import type { RelationshipCardVM } from '../../vm/types'

const prefillMock = vi.fn((_text: string) => true)
vi.mock('../../vm/useGraphExperienceVM', () => ({
  prefillChatText: (text: string) => prefillMock(text),
}))

import { RelationshipCard } from '../RelationshipCard'

configureAxe({ rules: { 'color-contrast': { enabled: false } } })

function makeCard(overrides: Partial<RelationshipCardVM> = {}): RelationshipCardVM {
  return {
    edgeId: 'e1',
    isStructural: false,
    sentence: 'Customer demand strengthens Grow revenue',
    strengthLabel: 'Strong',
    strengthValue: 0.45,
    confidenceLabel: 'medium',
    confidenceValue: 0.55,
    whyItMatters: null,
    whyIsResultDerived: false,
    whyDetailPct: null,
    evidence: [],
    actions: [
      { kind: 'focus', label: 'Focus', availability: 'wired' },
      { kind: 'evidence', label: 'Show evidence', availability: 'disabled', disabledHint: 'No evidence attached yet' },
      { kind: 'challenge', label: 'What if this is wrong?', availability: 'wired' },
      { kind: 'edit', label: 'Edit relationship', availability: 'disabled', disabledHint: 'Available in the standard canvas' },
    ],
    challengePrompt: 'What if the link between "Customer demand" and "Grow revenue" is wrong?',
    isStaleResult: false,
    ...overrides,
  }
}

function renderCard(card: RelationshipCardVM, mode: 'hover' | 'pinned', onClose = vi.fn(), onFocusEdge = vi.fn()) {
  const utils = render(<RelationshipCard card={card} mode={mode} onClose={onClose} onFocusEdge={onFocusEdge} />)
  return { ...utils, onClose, onFocusEdge }
}

beforeEach(() => {
  useViewLevelStore.setState({ level: 'simple' })
  prefillMock.mockClear()
})

describe('hover mode', () => {
  it('is a tooltip with no actions row', () => {
    renderCard(makeCard(), 'hover')
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.queryByTestId('vnext-relationship-actions')).toBeNull()
  })
})

describe('pinned mode', () => {
  it('is a non-modal dialog, takes focus, and Escape closes', () => {
    const { onClose } = renderCard(makeCard(), 'pinned')
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'false')
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click outside closes; click inside does not', () => {
    const { onClose } = renderCard(makeCard(), 'pinned')
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders wired and disabled actions with hints', () => {
    renderCard(makeCard(), 'pinned')
    expect(screen.getByRole('button', { name: 'Focus' })).toBeEnabled()
    const edit = screen.getByRole('button', { name: 'Edit relationship' })
    expect(edit).toBeDisabled()
    expect(edit).toHaveAttribute('title', 'Available in the standard canvas')
  })

  it('challenge action prefills the chat with the solo-safe prompt and closes', () => {
    const { onClose } = renderCard(makeCard(), 'pinned')
    fireEvent.click(screen.getByRole('button', { name: 'What if this is wrong?' }))
    expect(prefillMock).toHaveBeenCalledWith('What if the link between "Customer demand" and "Grow revenue" is wrong?')
    expect(onClose).toHaveBeenCalled()
  })

  it('focus action delegates to onFocusEdge', () => {
    const { onFocusEdge } = renderCard(makeCard(), 'pinned')
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
    expect(onFocusEdge).toHaveBeenCalledTimes(1)
  })

  it('show evidence toggles the statements list', () => {
    const card = makeCard({
      evidence: [{ statement: 'Surveys say so.', source: 'Chamber, 2025' }],
      actions: makeCard().actions.map((a) => (a.kind === 'evidence' ? { ...a, availability: 'wired' as const, disabledHint: undefined } : a)),
    })
    renderCard(card, 'pinned')
    expect(screen.queryByTestId('vnext-relationship-evidence')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show evidence' }))
    expect(screen.getByTestId('vnext-relationship-evidence')).toHaveTextContent('Surveys say so.')
    expect(screen.getByTestId('vnext-relationship-evidence')).toHaveTextContent('Chamber, 2025')
  })
})

describe('vocabulary rendering', () => {
  it('Simple shows words only — no numerals anywhere in the strength/confidence line', () => {
    renderCard(makeCard(), 'hover')
    const words = screen.getByTestId('vnext-relationship-words')
    expect(words).toHaveTextContent('Strong · medium confidence')
    expect(words.textContent).not.toMatch(/\d/)
  })

  it('Detailed appends the numerals', () => {
    useViewLevelStore.setState({ level: 'detailed' })
    renderCard(makeCard(), 'hover')
    const words = screen.getByTestId('vnext-relationship-words')
    expect(words).toHaveTextContent('Strong (+0.45)')
    expect(words).toHaveTextContent('medium confidence (55%)')
  })
})

describe('why-it-matters', () => {
  it('omitted entirely when the VM carries none', () => {
    renderCard(makeCard(), 'hover')
    expect(screen.queryByTestId('vnext-relationship-why')).toBeNull()
  })

  it('fragile why-line renders with warning treatment and Detailed pct', () => {
    useViewLevelStore.setState({ level: 'detailed' })
    renderCard(makeCard({ whyItMatters: WHY_FRAGILE, whyIsResultDerived: true, whyDetailPct: 45 }), 'hover')
    const why = screen.getByTestId('vnext-relationship-why')
    expect(why).toHaveTextContent(WHY_FRAGILE)
    expect(why).toHaveTextContent('45% of stress tests')
    expect(why).toHaveClass('border-warning')
  })

  it('stale result-derived why-line dims and carries the marker (A7)', () => {
    renderCard(makeCard({ whyItMatters: WHY_FRAGILE, whyIsResultDerived: true, isStaleResult: true }), 'hover')
    expect(screen.getByTestId('vnext-relationship-why')).toHaveClass('opacity-60')
    expect(screen.getByTestId('vnext-relationship-stale-marker')).toHaveTextContent(STALE_CLAIM_MARKER)
  })
})

describe('accessibility', () => {
  it('has no axe violations in either mode', async () => {
    const hover = renderCard(makeCard(), 'hover')
    expect((await axe(hover.container)).violations).toEqual([])
    hover.unmount()
    const pinned = renderCard(makeCard(), 'pinned')
    expect((await axe(pinned.container)).violations).toEqual([])
  })
})
