/**
 * The primary control DOES the thing, where the engine says it should.
 *
 * ⭐⭐ WHAT WAS WRONG. The engine emits five action routes, and two of its eight
 * builders emit `open-modal` — the two that are WORK rather than conversation:
 *   `strengthen:success-measure` → the Define-success modal
 *   `strengthen:commit`          → the Decision-record modal
 * The success-measure builder's own comment reads: "the primary DOES the thing
 * — the structured Define-success modal (threshold commits through the
 * canonical rerun path)".
 *
 * Analysis (New) routed EVERY card to the Ask-Olumi drawer regardless of
 * `action.kind`. So the highest-ranked finding on every run — rank 0, the one
 * the whole ladder is built around — offered a chat ABOUT defining success
 * instead of the control that defines it. Advice you read, where the engine had
 * already built work you do.
 *
 * ⚠ NOT A NEW DISPATCH AUTHORITY. `openDefineSuccess`/`openDecisionRecord` are
 * global store openers and both modals are already mounted by the dock that
 * hosts this tab. The modal owns the mutation and commits through the canonical
 * path. This surface still mutates nothing itself.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import type { Recommendation } from '../../strengthen/strengthenTypes'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../modals', () => ({
  openDefineSuccess: vi.fn(),
  openDecisionRecord: vi.fn(),
}))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../nodeMarks', async (orig) => ({
  ...(await orig<typeof import('../nodeMarks')>()),
  markKindForTarget: () => null,
}))
vi.mock('../../../../canvas/stores/strengthenStore', async (orig) => ({
  ...(await orig<typeof import('../../../../canvas/stores/strengthenStore')>()),
  useStrengthenStore: (sel: (s: unknown) => unknown) =>
    sel({
      records: {},
      priorityOrder: [],
      dismiss: vi.fn(),
      restoreDismissed: vi.fn(),
      dispute: vi.fn(),
      seedIfAbsent: vi.fn(),
    }),
}))

import { openAskOlumi } from '../../coaching/askOlumiStore'
import { openDefineSuccess, openDecisionRecord } from '../../modals'

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'clarify',
    title: 'Define what success looks like',
    signal: 'No measurable success target is set.',
    whyNow: 'Without a target the analysis cannot say how likely each option is to succeed.',
    tryThis: 'Pick the number that would make this decision a win.',
    sourceLine: 'Source: your goal has no success threshold (checked directly).',
    action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'p' },
    targetId: null,
    priority: 0,
    ...over,
  }) as Recommendation

const renderOpen = (ui: React.ReactElement) => {
  const r = render(ui)
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
  return r
}

beforeEach(() => {
  vi.mocked(openAskOlumi).mockClear()
  vi.mocked(openDefineSuccess).mockClear()
  vi.mocked(openDecisionRecord).mockClear()
})

describe('an open-modal finding opens the modal, not a chat about it', () => {
  /**
   * ⭐⭐ define-success IS WITHHELD, AND THAT IS THE CORRECT BEHAVIOUR.
   *
   * The first version of this test asserted the modal OPENED, because the first
   * version of the code opened it. Both were wrong, and the review that caught
   * it named the reason precisely: "already mounted by the dock" answers *may
   * this control look like a shared-model edit?* and not *may this write
   * happen?* — two questions under one name.
   *
   * `CANONICAL_EDIT_AUTHORITY.goalSuccessTarget` is `'disabled'` in a `const
   * satisfies` object, so the gate is a compile-time `false` and BOTH
   * pre-existing call sites already withhold on it. Only the THRESHOLD reaches
   * the analysis; metric, direction, timeframe and baseline die with the
   * session, under a toast reading "Success measure saved." Opening it from
   * the top card of every run would have been the product's most prominent
   * false promise.
   *
   * ⚠ This test is now the ONLY pinned behaviour for that gate on either
   * surface — `StrengthenContainer`'s authority branch has no test at all — so
   * a later reconciliation is pulled toward the honest arm rather than away
   * from it.
   */
  it('withholds the local-only Define-success editor and hands over a draft instead', () => {
    renderOpen(
      <StrengthenTheReasoning
        interventions={[
          rec({
            id: 'strengthen:success-measure',
            action: { kind: 'open-modal', modal: 'define-success', label: 'Define success', prompt: 'p' },
          }),
        ]}
      />,
    )
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-action'))

    expect(openDefineSuccess).not.toHaveBeenCalled()
    // Withheld, not dropped: the coaching action stays useful.
    expect(openAskOlumi).toHaveBeenCalledTimes(1)
  })

  it('decision-record opens the Decision-record modal', () => {
    renderOpen(
      <StrengthenTheReasoning
        interventions={[
          rec({
            id: 'strengthen:commit',
            helpType: 'commit',
            action: { kind: 'open-modal', modal: 'decision-record', label: 'Create a decision record', prompt: 'p' },
          }),
        ]}
      />,
    )
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-action'))

    expect(openDecisionRecord).toHaveBeenCalledTimes(1)
    expect(openAskOlumi).not.toHaveBeenCalled()
  })

  /**
   * ⭐ THE DISCRIMINATING CASE. Without it the change could have routed
   * EVERYTHING to a modal, and both tests above would still pass. The
   * conversational routes must be untouched.
   */
  it('leaves a conversational finding on the Ask-Olumi route, unchanged', () => {
    renderOpen(
      <StrengthenTheReasoning
        interventions={[
          rec({
            id: 'strengthen:robustness',
            helpType: 'challenge',
            action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'Pressure-test it' },
          }),
        ]}
      />,
    )
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-action'))

    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    expect(openDefineSuccess).not.toHaveBeenCalled()
    expect(openDecisionRecord).not.toHaveBeenCalled()
  })
})
