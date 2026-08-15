/**
 * Model tab v2 — THE REPAIR QUEUE LIST (design §5.3), render-only.
 *
 * The headline property, and the one the brief names: a queue renders EXACTLY
 * the items it is given, in the order it is given them. It is asserted with
 * exact array equality on IDS — not on length, not on text — because a list that
 * dropped one item and invented another would keep its length, and a list that
 * re-sorted would keep its contents.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RepairQueueList } from '../RepairQueueList'
import type { RepairQueue, RepairQueueItem } from '../types'

const QUEUE: RepairQueue = {
  id: 'confirm-estimates',
  reason: 'unconfirmed-estimate',
  title: 'Confirm estimates',
  supportsApplyAll: true,
}

function item(rowId: string, over: Partial<RepairQueueItem> = {}): RepairQueueItem {
  return {
    rowId,
    label: `Label ${rowId}`,
    currentValue: '45 days',
    suggestedValue: '30 days',
    basis: 'Inferred from model structure',
    ...over,
  }
}

/** The rendered item ids, in DOM order. The object of every order assertion. */
function renderedItemIds(): string[] {
  return Array.from(
    document.querySelectorAll(`[data-testid^="repair-queue-v2-${QUEUE.id}-item-"][data-row-id]`),
  ).map(el => el.getAttribute('data-row-id')!)
}

describe('⭐ RepairQueueList — exactly the queue\'s items, in the queue\'s order', () => {
  it('renders every item, in the given order, and nothing else', () => {
    // Deliberately not alphabetical and not sorted by value: a list that sorted
    // by either would produce a different array and fail here.
    const items = [item('f3'), item('f1'), item('f2')]
    render(<RepairQueueList queue={QUEUE} items={items} />)
    expect(renderedItemIds()).toEqual(['f3', 'f1', 'f2'])
  })

  it('does not drop or dedupe items that share a label', () => {
    const items = [item('f1', { label: 'Same label' }), item('f2', { label: 'Same label' })]
    render(<RepairQueueList queue={QUEUE} items={items} />)
    // Identity, not text: two items indistinguishable by label must both survive.
    expect(renderedItemIds()).toEqual(['f1', 'f2'])
  })

  it('renders each item\'s OWN values, bound by id', () => {
    const items = [
      item('f1', { currentValue: '45 days', suggestedValue: '30 days' }),
      item('f2', { currentValue: '3.0x', suggestedValue: '4.0x' }),
    ]
    render(<RepairQueueList queue={QUEUE} items={items} />)
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f2-current`)).toHaveTextContent('3.0x')
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f2-suggested`)).toHaveTextContent('4.0x')
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-current`)).toHaveTextContent('45 days')
  })

  it('the stated count matches the rendered rows — a badge and its queue cannot disagree', () => {
    const items = [item('f1'), item('f2'), item('f3')]
    render(<RepairQueueList queue={QUEUE} items={items} />)
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-count`)).toHaveTextContent('3 items')
    expect(renderedItemIds()).toHaveLength(3)
  })

  it('says the queue is empty rather than rendering an empty list', () => {
    render(<RepairQueueList queue={QUEUE} items={[]} />)
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-empty`)).toHaveTextContent(
      'Nothing needs attention here',
    )
  })
})

describe('RepairQueueList — a missing value is a fact, not a zero', () => {
  it('renders "No value set" for a null current value (the F9 case)', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1', { currentValue: null })]} />)
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-current`)).toHaveTextContent(
      'No value set',
    )
  })

  it('omits the suggestion entirely when there is none, rather than suggesting a blank', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1', { suggestedValue: null })]} />)
    expect(screen.queryByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-suggested`)).toBeNull()
    // Positive control: the row itself rendered.
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1`)).toBeInTheDocument()
  })

  it('shows the basis when one is given', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1')]} />)
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-basis`)).toHaveTextContent(
      'Inferred from model structure',
    )
  })
})

describe('⭐ RepairQueueList — nothing here pretends it can apply anything', () => {
  it('every per-item Apply is disabled and says why', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1'), item('f2')]} />)
    for (const id of ['f1', 'f2']) {
      const apply = screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-${id}-apply`)
      expect(apply).toBeDisabled()
      expect(apply.getAttribute('title')).toMatch(/not connected yet/i)
    }
  })

  it('"Apply all shown" is disabled and names the BATCH contract as the reason', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1')]} />)
    const applyAll = screen.getByTestId(`repair-queue-v2-${QUEUE.id}-apply-all`)
    expect(applyAll).toBeDisabled()
    // The reason must be the real one — batching — not a generic "coming soon".
    // Looping single proposals is what the batch contract exists to prevent.
    expect(applyAll.getAttribute('title')).toMatch(/batch/i)
    expect(applyAll.getAttribute('title')).toMatch(/re-run the analysis after each one/i)
  })

  it('clicking a disabled Apply changes nothing on screen', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1', { currentValue: '45 days' })]} />)
    const before = screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-current`).textContent
    fireEvent.click(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-apply`))
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-current`).textContent).toBe(before)
  })

  it('offers no "Apply all" at all for a queue that does not support it', () => {
    render(
      <RepairQueueList
        queue={{ ...QUEUE, id: 'contested', supportsApplyAll: false }}
        items={[item('f1')]}
      />,
    )
    expect(screen.queryByTestId('repair-queue-v2-contested-apply-all')).toBeNull()
  })

  it('offers no "Apply all" when the queue is empty', () => {
    render(<RepairQueueList queue={QUEUE} items={[]} />)
    expect(screen.queryByTestId(`repair-queue-v2-${QUEUE.id}-apply-all`)).toBeNull()
  })
})

describe('RepairQueueList — navigation is ID-addressed and safe today', () => {
  it('reports the row id of the label that was clicked, not its position', () => {
    const onFocusOnCanvas = vi.fn()
    render(
      <RepairQueueList
        queue={QUEUE}
        items={[item('f1', { label: 'Same' }), item('f2', { label: 'Same' })]}
        onFocusOnCanvas={onFocusOnCanvas}
      />,
    )
    fireEvent.click(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f2-label`))
    expect(onFocusOnCanvas).toHaveBeenCalledWith('f2')
  })
})
