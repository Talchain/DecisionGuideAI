/**
 * ⭐⭐ THE AI ACT RENDERS ON A RUN THAT CARRIES NO PRODUCER INTERVENTION —
 * which is every run measured so far.
 *
 * ⛔ THE DEFECT THIS FILE EXISTS FOR, AND IT IS NOT A MISSING FEATURE. #1643
 * restored "Work through with Olumi" to the finding row, with a full mutant
 * kit that bit on every mutant. It shipped DARK. Measured on the served build
 * `d3c818f2`, guest entry, EVERY section opened and all 36 buttons enumerated
 * by name: sensitivity rows 3 with no act at all, options rows 3 with focus
 * only, model-strip marks 4 with focus only, and the two rows that do carry
 * acts carry canvas and review and never the AI one. ZERO routes to Olumi.
 *
 * The cause is one gate answering two questions (CLAUDE.md trap 21): the act
 * was gated on `finding.intervention`, which is what a DISPATCH needs, while an
 * ASK needs only a subject. No finding carries an intervention on a real run.
 *
 * ⛔⛔ AND NOTE WHAT #1643'S KIT COULD NOT SEE. Every mutant asked whether the
 * test could DETECT a change to the act; none asked whether the act ever
 * RENDERS on data the producer actually sends. A fixture that supplies an
 * intervention proves the intervention arm works and says nothing about the
 * ninety-nine runs that have none. So the load-bearing arm here is the one with
 * NO intervention, and it is written first.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openAskOlumi } from '../../coaching/askOlumiStore'
import { DisclosureRow } from '../DisclosureRow'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { AnalysisNewFinding } from '../analysisNewTypes'

const PREFIX = 'row'
const ASK = COPY.disclosure.askOlumi

const finding = (over: Partial<AnalysisNewFinding> = {}): AnalysisNewFinding =>
  ({
    id: 'f1',
    headline: 'Pro Plan Monthly Price is the hinge',
    implication: 'Its effect on Monthly Recurring Revenue decides the ranking.',
    detail: 'Moving it by ten per cent reorders the top two options.',
    groundedIn: 'Grounded in the sensitivity analysis.',
    inspect: [],
    ...over,
  }) as AnalysisNewFinding

const renderRow = (f: AnalysisNewFinding, props: Record<string, unknown> = {}) =>
  render(
    <DisclosureRow
      finding={f}
      testIdPrefix={PREFIX}
      defaultOpen
      onAskOlumi={vi.fn()}
      {...props}
    />,
  )

beforeEach(() => {
  vi.mocked(openAskOlumi).mockClear()
})
afterEach(() => cleanup())

describe('the AI act reaches a real run', () => {
  /**
   * ⭐⭐ THE ARM THAT WOULD HAVE CAUGHT #1643. No intervention, which is the
   * shape of every run measured on the deployed product.
   */
  it('⭐ renders on a finding carrying NO producer intervention', () => {
    renderRow(finding())
    const act = screen.getByTestId(`${PREFIX}-ask`)
    expect(act).toBeInTheDocument()
    expect(act).toHaveAccessibleName(ASK)
    // PRECONDITION, IN-TEST: this fixture really is the interventionless shape,
    // so a pass here is the gate's doing and not a fixture quietly supplying one.
    expect(screen.queryByTestId(`${PREFIX}-intervention`), 'precondition: no intervention arm').toBeNull()
  })

  /**
   * ⛔ ONE SLOT, NOT TWO. Both arms are the sparkle and both mean "work on this
   * with Olumi"; two of them on one row would ask a reader to tell apart two
   * icons the panel had just said were the same act.
   */
  it('⛔ where the producer named a move, the act RUNS it — and there is still only one', () => {
    const onRunIntervention = vi.fn()
    renderRow(
      finding({
        intervention: { label: 'Pin down the churn estimate', recommendationId: 'rec_1' },
      } as Partial<AnalysisNewFinding>),
      { onRunIntervention },
    )
    const act = screen.getByTestId(`${PREFIX}-intervention`)
    expect(act).toHaveAccessibleName('Pin down the churn estimate')
    expect(screen.queryByTestId(`${PREFIX}-ask`), 'the ask must not double the intervention').toBeNull()
    fireEvent.click(act)
    expect(onRunIntervention).toHaveBeenCalledWith('rec_1')
  })

  /**
   * ⛔ THE DISCRIMINATING PAIR FOR THE GATE ITSELF. An intervention the producer
   * left unnameable is not a move — #1643 established that — so the row falls
   * back to the ask rather than rendering a control that cannot say what it
   * does. Both arms differ only in the label's whitespace.
   */
  it('⛔ an unnameable intervention falls back to the ask, never to nothing', () => {
    renderRow(
      finding({
        intervention: { label: '   ', recommendationId: 'rec_2' },
      } as Partial<AnalysisNewFinding>),
      { onRunIntervention: vi.fn() },
    )
    expect(screen.queryByTestId(`${PREFIX}-intervention`)).toBeNull()
    expect(screen.getByTestId(`${PREFIX}-ask`)).toHaveAccessibleName(ASK)
  })

  /** ⚠ A SUBJECT IS REQUIRED. The headline seeds the drawer, so an empty one
   *  would open it blank — the same "a control that cannot say what it acts on"
   *  defect one level down. */
  it('⚠ a finding with no headline earns no act', () => {
    renderRow(finding({ headline: '   ' }))
    expect(screen.queryByTestId(`${PREFIX}-ask`)).toBeNull()
  })

  /**
   * ⛔⛔ THE ACT MUST NOT MAKE A ROW OPENABLE THAT HAS NOTHING TO REVEAL, and
   * this arm exists because the obvious next "fix" breaks it.
   *
   * The acts live inside the level-2 region, which is gated on the row having
   * DETAIL, an intervention or inspect rows — so a row with none of those
   * cannot be opened and carries no acts at all. That is correct: opening it
   * would be a heading over nothing, the defect this panel spent the day
   * removing. Someone will eventually notice the ask is unreachable there and
   * widen the gate to include it. That would trade a dark act for an empty
   * disclosure, which is worse, and this arm REDs when they try.
   */
  it('⛔ a row with nothing to reveal stays shut, and the ask does not prise it open', () => {
    render(
      <DisclosureRow
        finding={finding({ detail: undefined, inspect: [] })}
        testIdPrefix={PREFIX}
        onAskOlumi={vi.fn()}
      />,
    )
    const toggle = screen.getByTestId(`${PREFIX}-row-toggle`)
    expect(toggle, 'a row with nothing beneath it must not offer to open').toBeDisabled()
    expect(screen.queryByTestId(`${PREFIX}-ask`)).toBeNull()
  })

  /** ⚠ AND NO HANDLER MEANS NO ACT, never a disabled one — the rule every other
   *  act on this row already follows. */
  it('⚠ no handler renders nothing, not a dead control', () => {
    render(<DisclosureRow finding={finding()} testIdPrefix={PREFIX} defaultOpen />)
    expect(screen.queryByTestId(`${PREFIX}-ask`)).toBeNull()
  })

  /**
   * ⭐ IT CARRIES THE ROW'S OWN WORDS, and that is what makes it an ask about
   * THIS finding rather than a chat window. Bound by the finding's own text, so
   * a handler wired to the wrong row fails here.
   */
  it('⭐ opens the drawer seeded from this row, by identity', () => {
    const onAskOlumi = vi.fn()
    renderRow(finding({ targetId: 'node_7' }), { onAskOlumi })
    fireEvent.click(screen.getByTestId(`${PREFIX}-ask`))
    expect(onAskOlumi).toHaveBeenCalledTimes(1)
    const passed = onAskOlumi.mock.calls[0]![0] as AnalysisNewFinding
    expect(passed.id, 'the act must hand over the row it sits on').toBe('f1')
    expect(passed.headline).toBe('Pro Plan Monthly Price is the hinge')
  })
})
