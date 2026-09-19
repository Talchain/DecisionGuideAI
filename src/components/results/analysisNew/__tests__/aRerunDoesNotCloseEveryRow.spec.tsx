/**
 * A RERUN MUST NOT LEAVE EVERY ROW CLOSED.
 *
 * ## The defect, derived at source
 *
 * `openRowIds` starts `null`, which is what LICENSES the first-row default. The
 * moment the reader toggles anything it becomes their set — correctly, including
 * their right to close the only open row.
 *
 * ⛔ But the ids in that set are recommendation ids. A rerun after a graph EDIT
 * changes the graph hash, the producer mints new `block_id`s, and **every id the
 * reader holds stops existing** — while the set stays non-null. The default can
 * never come back, so the section renders **entirely closed**: the exact "told a
 * number, asked to guess whether it is worth a click" state this component's own
 * header rejects, reached by a rerun the reader asked for.
 *
 * ## ⚠ THE TEST IS INTERSECTION, NOT SIZE
 *
 * A set the reader deliberately emptied is THEIRS and must survive. What must
 * not survive is a set whose every member has ceased to exist — not a choice
 * they made, but a consequence of ids moving underneath them. Those two are one
 * character apart in the implementation and opposite in meaning, so both are
 * pinned below.
 *
 * ## ⚠ SCOPE, STATED
 *
 * This restores the DEFAULT. It does not restore their selection — nothing can,
 * the rows they opened are gone. Preserving a selection across a rerun needs ids
 * stable across graph hashes, which is a producer question.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import type { Recommendation } from '../../strengthen/strengthenTypes'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

const rec = (id: string, title: string): Recommendation =>
  ({
    helpType: 'challenge',
    title,
    signal: 'One factor carries most of the influence.',
    whyNow: 'The conclusion rests almost entirely on it.',
    tryThis: 'Write down why it failed.',
    sourceLine: 'From the influence concentration check.',
    action: { kind: 'ai-dialogue', label: 'Work through it', prompt: 'p' },
    targetId: 'f_x',
    priority: 1,
    id,
  }) as Recommendation

/** The section itself is a collapsed row; every case opens it first. */
const openSection = () =>
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))

const openRowCount = (): number =>
  screen
    .getAllByTestId('analysis-new-strengthen-row-toggle')
    .filter((b) => b.getAttribute('aria-expanded') === 'true').length

const RUN_A = [rec('strengthen:phase3:a1', 'First finding'), rec('strengthen:phase3:a2', 'Second')]
const RUN_B = [rec('strengthen:phase3:b1', 'New first'), rec('strengthen:phase3:b2', 'New second')]

describe('a rerun does not close every row', () => {
  it('PRECONDITION: untouched, exactly one row is open — the default this protects', () => {
    render(<StrengthenTheReasoning interventions={RUN_A} />)
    openSection()
    expect(openRowCount(), 'the first-row default must hold before anything is toggled').toBe(1)
  })

  it('PRECONDITION: the reader can take the set over, and closing the open row is honoured', () => {
    render(<StrengthenTheReasoning interventions={RUN_A} />)
    openSection()
    fireEvent.click(screen.getAllByTestId('analysis-new-strengthen-row-toggle')[0]!)
    expect(openRowCount(), 'their right to close the only open row is not refused').toBe(0)
  })

  it('⛔ a set the reader EMPTIED survives a rerun that keeps the same ids', () => {
    const { rerender } = render(<StrengthenTheReasoning interventions={RUN_A} />)
    openSection()
    fireEvent.click(screen.getAllByTestId('analysis-new-strengthen-row-toggle')[0]!)
    expect(openRowCount()).toBe(0)

    rerender(<StrengthenTheReasoning interventions={RUN_A} />)
    expect(
      openRowCount(),
      'their choice is theirs — an intersecting set must never be discarded',
    ).toBe(0)
  })

  it('⛔ a set whose every id has CEASED TO EXIST falls back to the default', () => {
    const { rerender } = render(<StrengthenTheReasoning interventions={RUN_A} />)
    openSection()
    // Take the set over by opening the second row: now {a1, a2} or {a2}, all of
    // which vanish on the next run.
    fireEvent.click(screen.getAllByTestId('analysis-new-strengthen-row-toggle')[1]!)
    expect(openRowCount(), 'PRECONDITION: the reader now owns the set').toBeGreaterThan(0)

    rerender(<StrengthenTheReasoning interventions={RUN_B} />)
    expect(
      openRowCount(),
      'every id moved, so the section must not render entirely closed',
    ).toBe(1)
  })

  /**
   * ⛔ THE DISCRIMINATOR. Without it, an implementation that simply reset the
   * set on ANY interventions change would satisfy the case above — and would
   * silently overrule the reader every rerun.
   */
  it('⛔ a PARTIAL overlap is the reader\'s set, not stale', () => {
    const { rerender } = render(<StrengthenTheReasoning interventions={RUN_A} />)
    openSection()
    fireEvent.click(screen.getAllByTestId('analysis-new-strengthen-row-toggle')[0]!)
    expect(openRowCount(), 'PRECONDITION: the reader emptied it').toBe(0)

    // One id survives the rerun. The set is still meaningful, so it stands.
    rerender(
      <StrengthenTheReasoning interventions={[RUN_A[0]!, rec('strengthen:phase3:b9', 'Newcomer')]} />,
    )
    expect(
      openRowCount(),
      'a surviving id means the reader\'s set still describes this run',
    ).toBe(0)
  })
})
