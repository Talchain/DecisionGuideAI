/**
 * ⭐⭐ WIN SHARES FOLLOW THE LEADER CLAIM on the REASONING TAB's "What's changed" — CURRENT-READ-v1 row 9
 * (AIQ #75 5912710392), on Paul's served Run 4276f3f9 (`../../__tests__/helpers/paulRun4276f3f9.ts`).
 *
 * The movement lines print each option's win share, prior → current ("Convertible bridge…: 50% → 80%"), from
 * `run_delta.win_probabilities`. When the producer withheld the leader, a per-option share change singles an
 * option out in numbers just as a share does, so the lines go and the reason line takes their place, once. The
 * other change lines (comparability, the attribution limit) stay. The leader-change line may still say the
 * highest-scoring option changed, but it names no option.
 *
 * ⚠ THE DELTA IS CONSTRUCTED: the served turn carried no `run_delta`. The PERMISSION is Paul's (his report's
 * stamp, seeded in the store `winShareGate` reads), and the current shares are his Run's (80% / 13% / 7%); the
 * prior shares are illustrative.
 *
 * AIQ's three rows:
 *   1. 4276f3f9 → 0 option percentages and no per-option movement; the reason line once;
 *   2. CONTROL: `{permitted: true}` still shows the share change (Convertible bridge "→ 80%");
 *   3. CONTROL: `separation_unavailable` hides them too, in that cause's own words.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { WhatsChanged, WHATS_CHANGED_TESTID } from '../sections/WhatsChanged'
import { buildRunDeltaView } from '../runDeltaView'
import { leaderWithholdCause } from '../analysisNewCopy'
import { EXPLORATORY_REASON_LINE } from '../../../../canvas/state/winShareGate'
import {
  CONVERTIBLE, CONVERTIBLE_LABEL, OTHER_CAUSE_STAMP, PERMITTED_STAMP, SCORED, SERVED_STAMP, report, resetPaulRun,
  seedPaulRun,
} from '../../__tests__/helpers/paulRun4276f3f9'

const OTHER_CAUSE_WORDS = leaderWithholdCause('separation_unavailable')
const PERCENT = /\d+(?:\.\d+)?\s*%/g
const PRIOR: Record<string, number> = { [CONVERTIBLE]: 0.5, angel_bridge: 0.3, current_outreach: 0.2 }

const DELTA = {
  attribution_case: 'C1_attributable',
  pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true },
  leader: {
    changed: true, noise_verdict: 'signal',
    prior_leading_option_id: 'angel_bridge', current_leading_option_id: CONVERTIBLE,
  },
  win_probabilities: SCORED.map((o) => ({
    option_id: o.id, prior: PRIOR[o.id], current: report.option_probabilities[o.id].win_probability!, noise_verdict: 'signal',
  })),
  flip_thresholds: [],
} as unknown as RunDelta

const labelFor = (id: string): string | null => SCORED.find((o) => o.id === id)?.label ?? null

function renderSection() {
  render(<WhatsChanged view={buildRunDeltaView(DELTA, labelFor)} />)
  return screen.getByTestId(WHATS_CHANGED_TESTID)
}

afterEach(() => {
  cleanup()
  resetPaulRun()
})

describe('CURRENT-READ row 9 — What\'s changed (Reasoning tab)', () => {
  it('⭐ ROW 1 (Paul\'s 4276f3f9): no per-option share change and no option named; the reason line once', () => {
    seedPaulRun(SERVED_STAMP)
    const section = renderSection()
    expect((section.textContent ?? '').match(PERCENT)).toBeNull()
    expect(screen.queryAllByTestId(`${WHATS_CHANGED_TESTID}-movement`)).toHaveLength(0)
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-win-shares-withheld`).textContent).toBe(EXPLORATORY_REASON_LINE)
    expect((section.textContent ?? '').split(EXPLORATORY_REASON_LINE).length - 1).toBe(1)
    // No option is named anywhere in the section.
    for (const o of SCORED) expect(section.textContent).not.toContain(o.label)
    // The other change lines stay.
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-comparability`).textContent).not.toBe('')
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-highest-scoring`)).toHaveAttribute('data-may-name', 'false')
  })

  it('⭐ ROW 2 — CONTROL: a PERMITTED Run still shows each option\'s share change (→ 80%) and names the leader', () => {
    seedPaulRun(PERMITTED_STAMP)
    const section = renderSection()
    const convertible = screen.getAllByTestId(`${WHATS_CHANGED_TESTID}-movement`)
      .find((el) => el.getAttribute('data-option-id') === CONVERTIBLE)!
    expect(convertible.textContent).toBe(`${CONVERTIBLE_LABEL}: 50% → 80%`)
    expect(screen.queryByTestId(`${WHATS_CHANGED_TESTID}-win-shares-withheld`)).toBeNull()
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-highest-scoring`).textContent).toContain(CONVERTIBLE_LABEL)
    expect(section.textContent).not.toContain(EXPLORATORY_REASON_LINE)
  })

  it('⭐ ROW 3 — CONTROL: a Run withheld for ANOTHER reason hides them too, in that reason\'s own words', () => {
    seedPaulRun(OTHER_CAUSE_STAMP)
    const section = renderSection()
    expect((section.textContent ?? '').match(PERCENT)).toBeNull()
    expect(screen.queryAllByTestId(`${WHATS_CHANGED_TESTID}-movement`)).toHaveLength(0)
    expect(OTHER_CAUSE_WORDS).not.toBeNull()
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-win-shares-withheld`).textContent).toBe(OTHER_CAUSE_WORDS)
  })
})
