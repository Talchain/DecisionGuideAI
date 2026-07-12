/**
 * Wave 3a panel — RED pins (brief §8.3 presentation, §8.4 affordances,
 * §8.9 history honesty, plan §5 stale-but-shown label).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StrengthenPanel } from '../StrengthenPanel'
import type { RecRecord } from '../../../../canvas/stores/strengthenStore'
import type { Recommendation } from '../strengthenTypes'

const rec = (id: string, over: Partial<Recommendation> = {}): Recommendation => ({
  id,
  helpType: 'clarify',
  title: `Title ${id}`,
  signal: `Signal ${id}`,
  whyNow: `Why ${id}`,
  tryThis: `Try ${id}`,
  sourceLine: 'Source: test.',
  action: { kind: 'ai-dialogue', label: 'Go', actionType: 'discuss', message: 'm' },
  targetId: null,
  priority: 10,
  ...over,
})

const record = (id: string, over: Partial<RecRecord> = {}, recOver: Partial<Recommendation> = {}): RecRecord => ({
  id,
  status: 'recommended',
  snapshot: rec(id, recOver),
  analysisHash: 'h1',
  isStale: false,
  history: [{ at: 1, event: 'recommended' }],
  ...over,
})

const noop = () => {}
const baseProps = {
  history: [] as RecRecord[],
  addressedCount: 0,
  onPrimaryAction: noop,
  onWorkThrough: noop,
  onNotRelevant: noop,
  onMarkAddressed: noop,
}

describe('StrengthenPanel — §8.3 presentation', () => {
  it('renders exactly ONE recommendation visible and expanded by default', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a'), record('b'), record('c')]} />)
    expect(screen.getByText('Title a')).toBeInTheDocument()
    expect(screen.getByText(/Try a/)).toBeInTheDocument() // expanded detail
    expect(screen.queryByText('Title b')).toBeNull() // hidden behind Show more
    expect(screen.queryByText('Title c')).toBeNull()
  })

  it('Show more reveals the rest; Show fewer collapses back; labels computed', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a'), record('b'), record('c')]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }))
    expect(screen.getByText('Title b')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(screen.queryByText('Title b')).toBeNull()
  })

  it('footer controls are hidden with a single active recommendation', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a')]} />)
    expect(screen.queryByRole('button', { name: /Show \d+ more/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Expand all' })).toBeNull()
  })

  it('summary line uses the exact format', () => {
    render(<StrengthenPanel {...baseProps} addressedCount={2} active={[record('a'), record('b'), record('c')]} />)
    expect(screen.getByText('2 addressed · 3 worth checking')).toBeInTheDocument()
  })

  it('empty state renders honestly when nothing is active', () => {
    render(<StrengthenPanel {...baseProps} active={[]} />)
    expect(screen.getByText('Nothing to strengthen right now.')).toBeInTheDocument()
  })
})

describe('StrengthenPanel — §8.4 affordances', () => {
  it('the expanded rec shows signal/why/try, the source line, and the full action set', () => {
    const onPrimaryAction = vi.fn()
    const onWorkThrough = vi.fn()
    const onNotRelevant = vi.fn()
    render(
      <StrengthenPanel
        {...baseProps}
        active={[record('a')]}
        onPrimaryAction={onPrimaryAction}
        onWorkThrough={onWorkThrough}
        onNotRelevant={onNotRelevant}
      />,
    )
    expect(screen.getByText(/Signal a/)).toBeInTheDocument()
    expect(screen.getByText(/Why a/)).toBeInTheDocument()
    expect(screen.getByText('Source: test.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onPrimaryAction).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Work through with Olumi' }))
    expect(onWorkThrough).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Not relevant' }))
    expect(onNotRelevant).toHaveBeenCalled()
  })

  it('Focus on canvas renders ONLY when a target exists and the handler is provided', () => {
    const onFocusCanvas = vi.fn()
    const { rerender } = render(
      <StrengthenPanel {...baseProps} active={[record('a')]} onFocusCanvas={onFocusCanvas} />,
    )
    expect(screen.queryByRole('button', { name: 'Focus on canvas' })).toBeNull()
    rerender(
      <StrengthenPanel
        {...baseProps}
        active={[record('a', {}, { targetId: 'node_1' })]}
        onFocusCanvas={onFocusCanvas}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Focus on canvas' }))
    expect(onFocusCanvas).toHaveBeenCalled()
  })

  it('Mark as addressed appears only for in-progress recs', () => {
    const onMarkAddressed = vi.fn()
    render(
      <StrengthenPanel
        {...baseProps}
        active={[record('a', { status: 'in_progress' })]}
        onMarkAddressed={onMarkAddressed}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mark as addressed' }))
    expect(onMarkAddressed).toHaveBeenCalled()
  })

  it('a reopened rec explains why it returned', () => {
    render(
      <StrengthenPanel
        {...baseProps}
        active={[
          record('a', {
            status: 'reopened',
            history: [
              { at: 1, event: 'recommended' },
              { at: 2, event: 'reopened', reopenReason: 'the signal returned after the model changed' },
            ],
          }),
        ]}
      />,
    )
    expect(screen.getByText(/the signal returned after the model changed/)).toBeInTheDocument()
  })
})

describe('StrengthenPanel — stale-but-shown (plan §5)', () => {
  it('a stale record still renders, with the last-completed-analysis label', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a', { isStale: true })]} />)
    expect(screen.getByText('Title a')).toBeInTheDocument()
    expect(screen.getByText('From your last completed analysis')).toBeInTheDocument()
  })
})

describe('StrengthenPanel — §8.9 history', () => {
  it('history is behind a disclosure, shows what changed, and never a score', () => {
    const hist = [
      record('h1', {
        status: 'addressed',
        history: [
          { at: 1, event: 'recommended' },
          { at: 2, event: 'addressed', whatChanged: 'gave the factor a range' },
        ],
      }),
      record('h2', { status: 'dismissed', history: [{ at: 3, event: 'dismissed' }] }),
    ]
    const { container } = render(
      <StrengthenPanel {...baseProps} active={[record('a')]} history={hist} addressedCount={1} />,
    )
    expect(screen.queryByText('Title h1')).toBeNull() // behind disclosure
    fireEvent.click(screen.getByRole('button', { name: 'Show addressed and dismissed' }))
    expect(screen.getByText('Title h1')).toBeInTheDocument()
    expect(screen.getByText(/gave the factor a range/)).toBeInTheDocument()
    expect(screen.getByText('Title h2')).toBeInTheDocument()
    // Never a completion score.
    expect(container.textContent).not.toMatch(/\d+\s*%|\d+\s*\/\s*\d+ complete/i)
  })
})
