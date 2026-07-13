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
  action: { kind: 'ai-dialogue', label: 'Go', actionType: 'discuss', prompt: 'm' },
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

  it('empty state renders honestly when nothing is active (spec copy)', () => {
    render(<StrengthenPanel {...baseProps} active={[]} />)
    expect(screen.getByText('No recommendations need attention right now.')).toBeInTheDocument()
  })

  it('the collapsed row is a two-line block: the trigger signal is visible WITHOUT expanding', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a'), record('b')]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more' }))
    // Row b is collapsed (only index 0 auto-opens) yet its signal line shows.
    expect(screen.queryByText(/Try b/)).toBeNull() // collapsed body
    expect(screen.getByText('Signal b')).toBeInTheDocument() // signal in the head
  })

  it('every row carries a leading family icon in the head', () => {
    render(<StrengthenPanel {...baseProps} active={[record('strengthen:success-measure')]} />)
    const head = screen.getByRole('button', { name: /Title strengthen:success-measure/ })
    expect(head.querySelector('[data-testid="strengthen-rec-icon"]')).not.toBeNull()
  })

  it('footer hosts Show more / Expand all AND the history toggle in ONE row', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a'), record('b')]} />)
    const footer = screen.getByTestId('strengthen-footer')
    expect(footer).toContainElement(screen.getByRole('button', { name: 'Show 1 more' }))
    expect(footer).toContainElement(screen.getByRole('button', { name: 'Expand all' }))
    expect(footer).toContainElement(
      screen.getByRole('button', { name: 'Show addressed and dismissed' }),
    )
  })
})

describe('StrengthenPanel — lifecycle state pills', () => {
  it('an in-progress rec shows the outlined In progress pill in the collapsed head', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a', { status: 'in_progress' })]} />)
    expect(screen.getByText('In progress')).toBeInTheDocument()
  })

  it('a reopened rec shows the Reopened pill', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a', { status: 'reopened' })]} />)
    expect(screen.getByText('Reopened')).toBeInTheDocument()
  })

  it('a fresh rec shows no state pill', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a')]} />)
    expect(screen.queryByText('In progress')).toBeNull()
    expect(screen.queryByText('Reopened')).toBeNull()
  })
})

describe('StrengthenPanel — expanded body treatment', () => {
  it('renders the bold info Try this lead-in and unlabelled why copy (no Signal:/Why:/Try this: labels)', () => {
    const { container } = render(<StrengthenPanel {...baseProps} active={[record('a')]} />)
    expect(screen.getByText('Try this')).toBeInTheDocument()
    expect(container.textContent).not.toContain('Try this:')
    expect(container.textContent).not.toContain('Why:')
    expect(container.textContent).not.toContain('Signal:')
    expect(screen.getByText(/Why a/)).toBeInTheDocument() // plain why paragraph
  })
})

describe('StrengthenPanel — independent per-row expansion', () => {
  it('expanding a second row does NOT collapse the first (no exclusive accordion)', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a'), record('b')]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more' }))
    fireEvent.click(screen.getByRole('button', { name: /Title b/ }))
    expect(screen.getByText(/Try a/)).toBeInTheDocument() // first stays open
    expect(screen.getByText(/Try b/)).toBeInTheDocument()
  })

  it('the default-open first row can be collapsed', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a')]} />)
    expect(screen.getByText(/Try a/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Title a/ }))
    expect(screen.queryByText(/Try a/)).toBeNull()
  })
})

describe('StrengthenPanel — action feedback', () => {
  it('Not relevant shows a transient dismissed notice with an Undo affordance', () => {
    const onNotRelevant = vi.fn()
    const onUndoDismiss = vi.fn()
    render(
      <StrengthenPanel
        {...baseProps}
        active={[record('a')]}
        onNotRelevant={onNotRelevant}
        onUndoDismiss={onUndoDismiss}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Not relevant' }))
    expect(onNotRelevant).toHaveBeenCalled()
    const notice = screen.getByTestId('strengthen-notice')
    expect(notice).toHaveTextContent('Recommendation dismissed')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndoDismiss).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    expect(screen.queryByTestId('strengthen-notice')).toBeNull() // cleared after undo
  })

  it('Mark as addressed shows a visible confirmation', () => {
    render(<StrengthenPanel {...baseProps} active={[record('a', { status: 'in_progress' })]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark as addressed' }))
    expect(screen.getByTestId('strengthen-notice')).toHaveTextContent('Marked as addressed')
  })

  it('a failed canvas focus reports honestly instead of a silent no-op', () => {
    const onFocusCanvas = vi.fn(() => false)
    render(
      <StrengthenPanel
        {...baseProps}
        active={[record('a', {}, { targetId: 'node_1' })]}
        onFocusCanvas={onFocusCanvas}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Focus on canvas' }))
    expect(screen.getByTestId('strengthen-notice')).toHaveTextContent(
      'That element is no longer on the canvas',
    )
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
    // The work-through route is the ✦ icon-button (title + aria-label per spec).
    fireEvent.click(screen.getByRole('button', { name: 'Work through this with Olumi' }))
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
