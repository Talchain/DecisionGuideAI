/**
 * The panel has a design for having SUCCEEDED.
 *
 * ⭐⭐ WHAT WAS WRONG. `interventions.length === 0` rendered one sentence —
 * "No recommendations need attention right now" — for two completely different
 * teams: the one that was shown nothing, and the one that WORKED THROUGH
 * EVERYTHING. To the second it reads as *nothing was found*, which discards
 * their work at the exact moment the panel should have the most to say. The
 * trail proving the work sat folded behind a collapsed toggle underneath.
 *
 * The design critique named it finding D — "there is no design for having
 * succeeded" — and it is the missing terminal state of the product's own
 * journey, not an edge case.
 *
 * ⚠ WHAT THIS STATE MUST NOT BECOME. "Your reasoning looks solid" is a verdict
 * nobody measured. Every sentence here is a COUNT WE HOLD. The coaching line
 * names the limit of the instrument — a claim about Olumi, which we can make —
 * rather than a claim about the model, which we cannot.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import type { RecRecord } from '../../../../canvas/stores/strengthenStore'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../modals', () => ({ openDefineSuccess: vi.fn(), openDecisionRecord: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../nodeMarks', async (orig) => ({
  ...(await orig<typeof import('../nodeMarks')>()),
  markKindForTarget: () => null,
}))

import { openAskOlumi } from '../../coaching/askOlumiStore'

/** Records the mocked store hands back; set per test before rendering. */
let RECORDS: Record<string, RecRecord> = {}

vi.mock('../../../../canvas/stores/strengthenStore', async (orig) => {
  const actual = await orig<typeof import('../../../../canvas/stores/strengthenStore')>()
  return {
    ...actual,
    useStrengthenStore: (sel: (s: unknown) => unknown) =>
      sel({
        records: RECORDS,
        priorityOrder: Object.keys(RECORDS),
        dismiss: vi.fn(),
        restoreDismissed: vi.fn(),
        dispute: vi.fn(),
        seedIfAbsent: vi.fn(),
      }),
  }
})

const snapshot = (id: string): Recommendation =>
  ({
    id,
    helpType: 'clarify',
    title: `Finding ${id}`,
    signal: 's',
    whyNow: 'w',
    tryThis: 't',
    sourceLine: 'Source: test.',
    action: { kind: 'ai-dialogue', label: 'l', prompt: 'p' },
    targetId: null,
    priority: 10,
  }) as Recommendation

const record = (id: string, status: 'addressed' | 'dismissed'): RecRecord => ({
  id,
  status,
  snapshot: snapshot(id),
  analysisHash: 'h',
  isStale: false,
  history: [{ at: 1, event: status }],
})

const setTrail = (...recs: RecRecord[]) => {
  RECORDS = Object.fromEntries(recs.map((r) => [r.id, r]))
}

const renderOpen = () => {
  const r = render(<StrengthenTheReasoning interventions={[]} />)
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
  return r
}

beforeEach(() => {
  RECORDS = {}
  vi.mocked(openAskOlumi).mockClear()
})

describe('an empty list means two different things, and the panel now says which', () => {
  /**
   * ⭐ THE DISCRIMINATING CASE, and it must come first: without it the change
   * could have replaced the empty state UNCONDITIONALLY and every other test
   * here would still pass. A team shown nothing must still be told nothing was
   * found — the honest original sentence.
   */
  it('with NO trail, still states what was not found — not a success', () => {
    setTrail()
    renderOpen()

    expect(screen.getByTestId('analysis-new-strengthen-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-strengthen-completed')).not.toBeInTheDocument()
  })

  it('with a trail, reports the work instead of reporting an absence', () => {
    setTrail(record('a', 'addressed'), record('b', 'addressed'), record('c', 'addressed'))
    renderOpen()

    expect(screen.getByTestId('analysis-new-strengthen-completed')).toHaveTextContent(
      STRENGTHEN_COPY.completedAllAddressed(3),
    )
    // The old sentence must be GONE, not merely joined — it says the opposite.
    expect(screen.queryByTestId('analysis-new-strengthen-empty')).not.toBeInTheDocument()
  })

  /**
   * ⭐⭐ THE LOAD-BEARING HONESTY TEST. Setting a finding aside is a legitimate
   * judgement and it is NOT working through it. Any implementation that counts
   * `retired.length` — or derives addressed by subtraction — congratulates this
   * team for work they explicitly declined to do. This is the case that fails
   * such an implementation, and it is the reason the two counts are read by
   * status rather than by arithmetic.
   */
  it('does NOT call a set-aside finding "worked through"', () => {
    setTrail(record('a', 'dismissed'), record('b', 'dismissed'))
    renderOpen()

    const el = screen.getByTestId('analysis-new-strengthen-completed')
    expect(el).toHaveTextContent(STRENGTHEN_COPY.completedAllSetAside(2))
    expect(el.textContent ?? '').not.toMatch(/worked through/i)
  })

  it('counts the two acts apart when a team did both', () => {
    setTrail(
      record('a', 'addressed'),
      record('b', 'addressed'),
      record('c', 'dismissed'),
    )
    renderOpen()

    expect(screen.getByTestId('analysis-new-strengthen-completed')).toHaveTextContent(
      STRENGTHEN_COPY.completedMixed(2, 1),
    )
  })

  it('singular reads as English, not as "1 findings"', () => {
    setTrail(record('a', 'addressed'))
    renderOpen()

    const el = screen.getByTestId('analysis-new-strengthen-completed')
    expect(el.textContent ?? '').not.toMatch(/\b1 findings\b/)
    expect(el).toHaveTextContent(STRENGTHEN_COPY.completedAllAddressed(1))
  })
})

describe('the succeeded state is a thinking prompt, not a dead end', () => {
  it('names the limit of the instrument rather than blessing the model', () => {
    setTrail(record('a', 'addressed'))
    renderOpen()

    const limit = screen.getByTestId('analysis-new-strengthen-completed-limit')
    expect(limit).toHaveTextContent(STRENGTHEN_COPY.completedLimit)
    // The claim this state exists NOT to make.
    expect(limit.textContent ?? '').not.toMatch(/solid|sound|correct enough|looks good/i)
  })

  /**
   * The way out. It carries an intent CEE actually accepts, so the ask resolves
   * a DSK protocol rather than arriving as ordinary chat — the same seam
   * `techniquesInvokeDecisionScience` pins for the technique chips.
   */
  it('offers a challenge that reaches CEE as decision science', () => {
    setTrail(record('a', 'addressed'))
    renderOpen()

    fireEvent.click(screen.getByTestId('analysis-new-strengthen-completed-challenge'))

    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    expect(vi.mocked(openAskOlumi).mock.calls[0][0]).toMatchObject({
      intent: 'challenge_assumption',
      draft: STRENGTHEN_COPY.completedChallengeDraft,
    })
  })
})
