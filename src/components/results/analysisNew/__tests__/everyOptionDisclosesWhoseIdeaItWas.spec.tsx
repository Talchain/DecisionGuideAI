/**
 * EVERY OPTION SAYS WHOSE IDEA IT WAS — NOT JUST THE LEADING ONE.
 *
 * ── THE DEFECT, MEASURED ON THE DEPLOYED BUILD ─────────────────────────────
 * The product invented a hybrid option the user never named. It ranked THIRD
 * of four, and nothing anywhere on the surface marked it as the product's own.
 *
 * The mechanism is a SCOPE defect, not a predicate defect. The disclosure was
 * correct and it was computed once:
 *
 *     optionOrigin: headline && leader ? (nodeOrigins?.get(leader.id) ?? null) : null
 *
 * One node is asked. On the measured run the leader WAS the user's own option,
 * so the one channel that gets this right correctly answered `null` — and every
 * other row went unexamined. A silence that is right for the leader is read as
 * a silence about the whole set.
 *
 * ⚠ NOTE WHAT THAT MEANS FOR EVIDENCE. The leader channel answering `null` is
 * ALSO what a broken join would produce, so the measured run cannot by itself
 * distinguish "correctly silent" from "never looked". This file pins both: the
 * glance stays silent on the leader AND a non-leading row discloses, in the
 * same run, from the same map.
 *
 * ── WHY THE ROW AND NOT A SECOND GLANCE SENTENCE ───────────────────────────
 * `optionOrigin` on `AtAGlance` is a single slot about the named leader and
 * stays exactly as it is. This adds the same fact to `ComparisonOption`, read
 * from the SAME `nodeOrigins` map the glance reads, so the two cannot disagree
 * about one node — one question, one map, two placements.
 *
 * ── THE INVARIANT IS THE SPEC'S, NOT THE FAILURE MODE'S ────────────────────
 * `ai_inferred` is CEE's catch-all and also covers "the user stated it and the
 * brief check came back unverified", so a recorded `source_quote` beside it
 * means nobody may be named. The rule asserted here is that rule — owned by
 * `canvas/domain/olumiAuthorshipClaim` and asked, never re-expressed.
 *
 * ── EVERY ASSERTION BINDS BY OPTION ID (CLAUDE.md trap 19) ─────────────────
 * The fixture gives the invented option and an ambiguous option the SAME win
 * probability, so a lookup by rendered value could not tell them apart. Rows
 * are found by `id` in the view model and by `data-option-id` in the DOM.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { OptionsComparison } from '../sections/OptionsComparison'
import { OPTION_ORIGIN_COPY, buildNodeOriginMap } from '../optionOriginDisclosure'
import type { OptionResult } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeData, makeOption } from './analysisNewFixtures'

afterEach(() => cleanup())

const TESTID = 'analysis-new-options'
const OLUMIS = OPTION_ORIGIN_COPY.ai_suggested

/** The user's own option, and it LEADS — the measured shape. */
const LEADER = 'opt_annual_billing'
/** Olumi's own hybrid, third of four — the option the surface never marked. */
const INVENTED = 'opt_phase_the_increase'
/** `ai_inferred` beside the user's own words: nobody may be named. */
const AMBIGUOUS = 'opt_hold_and_cut_scope'
/** Stated and verified. Nothing to say. */
const PLAIN = 'opt_second_seller'

/**
 * ⚠ TWO OPTIONS SHARE A WIN PROBABILITY ON PURPOSE. `INVENTED` and `AMBIGUOUS`
 * both sit at 0.05, so an assertion that found a row by its rendered figure
 * could be satisfied by the wrong one — and these two are precisely the pair
 * whose correct answers are OPPOSITE.
 */
function fourOptionRun(): OptionResult[] {
  return [
    makeOption({ id: LEADER, label: 'Move to annual billing', winProbability: 0.85, nValidSamples: 10000, isRecommended: true }),
    makeOption({ id: PLAIN, label: 'Hire a second seller', winProbability: 0.05, nValidSamples: 10000 }),
    makeOption({ id: INVENTED, label: 'Raise the price and phase the increase', winProbability: 0.05, nValidSamples: 10000 }),
    makeOption({ id: AMBIGUOUS, label: 'Hold the price and cut scope', winProbability: 0.05, nValidSamples: 10000 }),
  ]
}

/** Store nodes exactly as the canvas holds them; the origin map is built by the real helper. */
const NODES = [
  { id: LEADER, data: { kind: 'option', provenance: 'from_brief', source_quote: 'move everyone to annual' } },
  { id: PLAIN, data: { kind: 'option', provenance: 'user_set' } },
  // Olumi's own: `ai_inferred` with NO quote. This is the disclosure.
  { id: INVENTED, data: { kind: 'option', provenance: 'ai_inferred' } },
  // The catch-all beside the user's words: neither "ours" nor "yours" is safe.
  { id: AMBIGUOUS, data: { kind: 'option', provenance: 'ai_inferred', source_quote: 'hold price, cut scope instead' } },
]

function dataWith(allOptions: OptionResult[]): ResultsSectionDataReturn {
  return makeData({
    recommendation: {
      allOptions,
      recommendedOption: allOptions.find((o) => o.isRecommended) ?? null,
      // ⚠ STATED, NOT LEFT UNDEFINED. The leader headline and the comparative
      // figure are both gated upstream; declaring the run fully able to speak
      // keeps this file's subject — the DISCLOSURE — the only thing varying.
      winProbability: 0.85,
    },
  })
}

function vmFor(origins: ReadonlyMap<string, 'ai_suggested'> | undefined) {
  return buildAnalysisNewViewModel({
    data: dataWith(fourOptionRun()),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    nodeOrigins: origins,
  })
}

/** id → the row's own origin, so nothing is found by a value another row shares. */
function originsById(origins: ReadonlyMap<string, 'ai_suggested'> | undefined) {
  const m = new Map<string, string | null>()
  for (const r of vmFor(origins).optionsComparison.rows) m.set(r.id, r.origin)
  return m
}

function renderComparison(origins: ReadonlyMap<string, 'ai_suggested'> | undefined) {
  cleanup()
  render(<OptionsComparison options={vmFor(origins).optionsComparison} />)
  // `SectionShell` rests CLOSED and renders no body until opened. Asserting
  // against the unopened shell reads an empty string and passes every absence
  // claim for free.
  fireEvent.click(screen.getByTestId(`${TESTID}-toggle`))
}

const row = (id: string) => {
  const el = document.querySelector(`[data-option-id="${id}"]`)
  expect(el, `row ${id} must be on screen`).not.toBeNull()
  return within(el as HTMLElement)
}

describe('the comparison discloses Olumi’s own options, wherever they rank', () => {
  it('CONTROL: the run reaches the section with all four rows, so an absence is a verdict', () => {
    // An empty comparison satisfies every "does not disclose" assertion below
    // by rendering nothing at all (CLAUDE.md trap 13).
    const rows = vmFor(buildNodeOriginMap(NODES)).optionsComparison.rows
    expect(rows.map((r) => r.id), 'all four options, in the producer’s order').toEqual([
      LEADER,
      PLAIN,
      INVENTED,
      AMBIGUOUS,
    ])
  })

  it('the invented option discloses, though it ranks third and never leads', () => {
    expect(originsById(buildNodeOriginMap(NODES)).get(INVENTED)).toBe('ai_suggested')
  })

  it.each([LEADER, PLAIN, AMBIGUOUS])(
    '%s: an option the product may not claim carries no origin',
    (id) => {
      expect(originsById(buildNodeOriginMap(NODES)).get(id)).toBeNull()
    },
  )

  it('⭐ THE MEASURED RUN: the glance is silent about the leader WHILE a row discloses', () => {
    // This is the defect in one assertion. The leader is the user's own option,
    // so the leader-only channel is correctly silent — and that silence used to
    // be the surface's ONLY word on authorship for the entire set.
    const vm = vmFor(buildNodeOriginMap(NODES))
    expect(vm.atAGlance.optionOrigin, 'the leader is the user’s own — say nothing').toBeNull()
    expect(
      vm.optionsComparison.rows.filter((r) => r.origin !== null).map((r) => r.id),
      'exactly the invented option, and nothing else, is claimed',
    ).toEqual([INVENTED])
  })

  it('the sentence reaches the screen, inside the invented option’s own row', () => {
    renderComparison(buildNodeOriginMap(NODES))
    expect(row(INVENTED).getByTestId(`${TESTID}-option-origin-${INVENTED}`)).toHaveTextContent(OLUMIS)
  })

  it.each([LEADER, PLAIN, AMBIGUOUS])('%s: renders no origin sentence', (id) => {
    renderComparison(buildNodeOriginMap(NODES))
    expect(row(id).queryByTestId(`${TESTID}-option-origin-${id}`)).toBeNull()
    expect(row(id).queryByText(OLUMIS), `${id} must not be attributed to Olumi`).toBeNull()
  })

  it('a caller with no origin map renders exactly what it rendered before', () => {
    // `nodeOrigins` is optional, and an absent map must mean "nothing known",
    // never "everything is Olumi's".
    renderComparison(undefined)
    expect(screen.queryByText(OLUMIS)).toBeNull()
    expect([...originsById(undefined).values()].every((o) => o === null)).toBe(true)
  })
})
