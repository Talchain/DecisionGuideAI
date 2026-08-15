/**
 * Model tab v2 — DEFERRAL (design §5.3, §4.2; Paul's ruling, 16 Aug 2026).
 *
 * The ruling: the dismiss `×` stays cut, but removing it must not cost the user
 * their agency. Every queue item gains **Leave unresolved** — a RECORDED CHOICE,
 * not a hidden gap.
 *
 * A Defer that lacked either of the two properties below would simply be the
 * dismiss button under a better name, so both are pinned here, by identity:
 *
 *   1. a deferred item NEVER LEAVES THE RENDERED QUEUE;
 *   2. it CARRIES PROVENANCE — who deferred it, and when.
 *
 * The headline test asserts the rendered id SET, not a count and not a text
 * match: a queue that dropped one deferred item and duplicated another would
 * keep its length, and a queue that hid the group behind CSS would keep its
 * text. Only the set of ids actually in the document settles it.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RepairQueueList } from '../RepairQueueList'
import { ModelRowView } from '../ModelRowView'
import type { DeferralRecord, ModelRow, RepairQueue, RepairQueueItem } from '../types'

const QUEUE: RepairQueue = {
  id: 'confirm-estimates',
  reason: 'unconfirmed-estimate',
  title: 'Confirm estimates',
  supportsApplyAll: true,
}

const PAUL: DeferralRecord = { by: 'Paul', at: '2026-08-16T10:30:00.000Z' }

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

/** Every item id actually in the document, across BOTH groups. */
function renderedItemIds(): string[] {
  return Array.from(
    document.querySelectorAll(`[data-testid^="repair-queue-v2-${QUEUE.id}-item-"][data-row-id]`),
  ).map(el => el.getAttribute('data-row-id')!)
}

describe('⭐ A deferred item NEVER leaves the rendered queue', () => {
  it('keeps the deferred item in the rendered set, bound by id', () => {
    render(
      <RepairQueueList
        queue={QUEUE}
        items={[item('f1'), item('f2', { deferred: PAUL }), item('f3')]}
      />,
    )
    // The whole ruling in one assertion: f2 was deferred and is STILL HERE.
    expect(new Set(renderedItemIds())).toEqual(new Set(['f1', 'f2', 'f3']))
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f2`)).toBeInTheDocument()
  })

  it('keeps EVERY item rendered when all of them are deferred', () => {
    render(
      <RepairQueueList
        queue={QUEUE}
        items={[item('f1', { deferred: PAUL }), item('f2', { deferred: PAUL })]}
      />,
    )
    expect(new Set(renderedItemIds())).toEqual(new Set(['f1', 'f2']))
  })

  it('marks which group each item is in, without removing either', () => {
    render(
      <RepairQueueList queue={QUEUE} items={[item('f1'), item('f2', { deferred: PAUL })]} />,
    )
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1`)).toHaveAttribute(
      'data-deferred',
      'false',
    )
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f2`)).toHaveAttribute(
      'data-deferred',
      'true',
    )
  })

  it('renders the deferred group with a heading naming how many', () => {
    render(
      <RepairQueueList
        queue={QUEUE}
        items={[item('f1'), item('f2', { deferred: PAUL }), item('f3', { deferred: PAUL })]}
      />,
    )
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-deferred-heading`)).toHaveTextContent(
      'Left unresolved (2)',
    )
  })

  it('renders NO deferred group when nothing has been deferred', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1')]} />)
    expect(screen.queryByTestId(`repair-queue-v2-${QUEUE.id}-deferred-group`)).toBeNull()
    // Positive control: the item itself rendered, so the absence is about the
    // group and not a failed render.
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1`)).toBeInTheDocument()
  })

  it('preserves the caller\'s order within each group', () => {
    render(
      <RepairQueueList
        queue={QUEUE}
        items={[
          item('a3'),
          item('d2', { deferred: PAUL }),
          item('a1'),
          item('d1', { deferred: PAUL }),
        ]}
      />,
    )
    // Active first, in given order; then deferred, in given order.
    expect(renderedItemIds()).toEqual(['a3', 'a1', 'd2', 'd1'])
  })
})

describe('⭐ A deferral carries provenance — who, and when', () => {
  it('prints the person and the date on the deferred item', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1', { deferred: PAUL })]} />)
    const line = screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-deferral`)
    expect(line).toHaveTextContent('Paul')
    expect(line).toHaveTextContent('16 Aug 2026')
  })

  it('names the deferrer of EACH item, bound by id, when several differ', () => {
    render(
      <RepairQueueList
        queue={QUEUE}
        items={[
          item('f1', { deferred: { by: 'Paul', at: '2026-08-16T10:30:00.000Z' } }),
          item('f2', { deferred: { by: 'Mel', at: '2026-08-14T09:00:00.000Z' } }),
        ]}
      />,
    )
    // Identity-bound: a lookup by text could attribute either deferral to either
    // row, which is precisely the failure that matters here.
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-deferral`)).toHaveTextContent('Paul')
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f2-deferral`)).toHaveTextContent('Mel')
  })

  it('shows an unparseable timestamp verbatim rather than swallowing it', () => {
    // A visible wrong value is a defect someone can chase; a silently dropped
    // date is a deferral that has quietly lost half its provenance.
    render(
      <RepairQueueList queue={QUEUE} items={[item('f1', { deferred: { by: 'Paul', at: 'not-a-date' } })]} />,
    )
    const line = screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-deferral`)
    expect(line).toHaveTextContent('not-a-date')
    expect(line).not.toHaveTextContent('Invalid Date')
  })

  it('an item that was never deferred carries no deferral line', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1')]} />)
    expect(screen.queryByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-deferral`)).toBeNull()
  })
})

describe('⭐ Deferring is offered, reversible, and honest about not working yet', () => {
  it('every ACTIVE item offers "Leave unresolved" beside Apply', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1'), item('f2')]} />)
    for (const id of ['f1', 'f2']) {
      expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-${id}-defer`)).toBeInTheDocument()
      expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-${id}-apply`)).toBeInTheDocument()
    }
  })

  it('the Defer control is DISABLED and says why — deferral is a write', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1')]} />)
    const defer = screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-defer`)
    expect(defer).toBeDisabled()
    expect(defer.getAttribute('title')).toMatch(/not connected yet/i)
  })

  it('every DEFERRED item offers Resume — a choice you cannot revisit is a trap', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1', { deferred: PAUL })]} />)
    const resume = screen.getByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-resume`)
    expect(resume).toBeInTheDocument()
    expect(resume).toBeDisabled()
    expect(resume.getAttribute('title')).toMatch(/not connected yet/i)
  })

  it('a deferred item is not ALSO offered a Defer control', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1', { deferred: PAUL })]} />)
    expect(screen.queryByTestId(`repair-queue-v2-${QUEUE.id}-item-f1-defer`)).toBeNull()
  })
})

describe('⭐ "Apply all shown" never overrules a recorded decision', () => {
  it('states that items left unresolved are excluded', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1'), item('f2', { deferred: PAUL })]} />)
    const applyAll = screen.getByTestId(`repair-queue-v2-${QUEUE.id}-apply-all`)
    expect(applyAll.getAttribute('title')).toMatch(/left unresolved are never included/i)
  })

  it('disappears entirely when every item has been deferred', () => {
    // Nothing is pending, so a batch affordance would be offering to act on
    // rows a human has already ruled on.
    render(
      <RepairQueueList
        queue={QUEUE}
        items={[item('f1', { deferred: PAUL }), item('f2', { deferred: PAUL })]}
      />,
    )
    expect(screen.queryByTestId(`repair-queue-v2-${QUEUE.id}-apply-all`)).toBeNull()
    // Positive control: the items are still rendered — it is the BATCH that is
    // gone, not the queue.
    expect(new Set(renderedItemIds())).toEqual(new Set(['f1', 'f2']))
  })

  it('says so when everything has been left unresolved', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1', { deferred: PAUL })]} />)
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-all-deferred`)).toHaveTextContent(
      'Everything here has been left unresolved',
    )
  })
})

describe('⭐ Deferring does not shrink the model\'s real gap count', () => {
  it('reports the total and the deferred count SEPARATELY', () => {
    render(
      <RepairQueueList
        queue={QUEUE}
        items={[item('f1'), item('f2', { deferred: PAUL }), item('f3', { deferred: PAUL })]}
      />,
    )
    const count = screen.getByTestId(`repair-queue-v2-${QUEUE.id}-count`)
    // Three gaps exist; two have been ruled on. A single number that fell to one
    // would be quietly lying about the state of the model.
    expect(count).toHaveTextContent('3 items')
    expect(count).toHaveTextContent('2 left unresolved')
  })

  it('says nothing about deferrals when there are none', () => {
    render(<RepairQueueList queue={QUEUE} items={[item('f1')]} />)
    expect(screen.getByTestId(`repair-queue-v2-${QUEUE.id}-count`)).not.toHaveTextContent(
      'left unresolved',
    )
  })
})

describe('⭐ The row keeps reporting its gap after it is deferred (§4.2)', () => {
  function row(over: Partial<ModelRow> & Pick<ModelRow, 'id'>): ModelRow {
    return {
      kind: 'factor',
      group: 'factors',
      label: `Label ${over.id}`,
      primaryValue: null,
      attention: ['no-value'],
      editable: true,
      ...over,
    }
  }

  it('renders the deferred marker BESIDE the attention marker, not instead of it', () => {
    render(<ModelRowView row={row({ id: 'f1', deferred: PAUL })} tier="plain" />)
    // Both. A row that fell silent about its gap once deferred would be the
    // dismiss button growing back inside the row.
    expect(screen.getByTestId('model-row-v2-f1-attention-no-value')).toBeInTheDocument()
    expect(screen.getByTestId('model-row-v2-f1-deferred')).toBeInTheDocument()
  })

  it('the deferred marker carries the provenance in its label', () => {
    render(<ModelRowView row={row({ id: 'f1', deferred: PAUL })} tier="plain" />)
    expect(screen.getByTestId('model-row-v2-f1-deferred').getAttribute('aria-label')).toMatch(
      /Paul/,
    )
  })

  it('an undeferred row carries no deferred marker', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" />)
    expect(screen.queryByTestId('model-row-v2-f1-deferred')).toBeNull()
    // Positive control: the row rendered and still reports its gap.
    expect(screen.getByTestId('model-row-v2-f1-attention-no-value')).toBeInTheDocument()
  })
})
