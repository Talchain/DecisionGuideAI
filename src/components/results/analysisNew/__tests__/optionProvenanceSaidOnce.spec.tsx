/**
 * ⭐⭐ THE PROVENANCE SENTENCE, SAID ONCE WHEN SEVERAL OPTIONS SHARE IT.
 *
 * The approved prototype's Move 4. Paul's screenshot of the deployed panel
 * shows "Olumi suggested this option, you did not name it" printed under three
 * of five options in the comparison — the same nine words, three times, in one
 * list. Each affected option keeps a MARKER whose accessible name is that exact
 * sentence, and the sentence itself is stated once beneath the list.
 *
 * ⛔ A DE-DUPLICATION, NOT A REMOVAL, AND THAT IS WHAT THESE ARMS ARE FOR.
 * Nothing is hidden from a screen reader: every marked option still carries the
 * whole claim in its own accessible name, bound to its own id. The disclosure
 * does not move behind a disclosure and no wording is invented — the legend
 * renders the same copy constant the rows and the glance render, because two
 * spellings of one claim on one screen is how a reader learns to distrust both.
 *
 * ⛔⛔ THE PREMISE THIS FILE HAD TO CORRECT, recorded rather than quietly fixed.
 * My first version of this change claimed the repetition was "visible WITHOUT
 * opening anything". MEASURED, and false: `SectionShell` rests CLOSED, so at
 * rest the panel states the provenance exactly ONCE, in the glance, and the
 * comparison's rows render nothing at all. The repetition is real in the state
 * Paul's screenshots show — the section open — and that is the state these arms
 * render. The same probe error, reporting a forced-open panel as the resting
 * one, has now produced three wrong claims in this session; this arm opens the
 * section explicitly and says so, rather than inheriting a claim about rest.
 *
 * ⚠ EVERY ASSERTION BINDS BY OPTION ID (CLAUDE.md trap 19). Three options share
 * a win probability in this fixture, so a lookup by rendered value could be
 * satisfied by the wrong row.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { OptionsComparison } from '../sections/OptionsComparison'
import { OPTION_ORIGIN_COPY, buildNodeOriginMap } from '../optionOriginDisclosure'
import type { OptionResult } from '../../types'
import { makeData, makeOption } from './analysisNewFixtures'

afterEach(() => cleanup())

const TESTID = 'analysis-new-options'
const OLUMIS = OPTION_ORIGIN_COPY.ai_suggested

const LEADER = 'opt_annual_billing'
const OLUMI_A = 'opt_phase_the_increase'
const OLUMI_B = 'opt_bundle_support'
/** Stated by the user and verified: nothing to disclose, and the control that
 *  proves the marker does not spread to every row. */
const PLAIN = 'opt_second_seller'

/** ⚠ THREE ROWS SHARE 0.05 ON PURPOSE — an assertion that found a row by its
 *  rendered figure could be satisfied by the wrong one, and one of those three
 *  is the row that must carry NOTHING. */
function run(): OptionResult[] {
  return [
    makeOption({ id: LEADER, label: 'Move to annual billing', winProbability: 0.85, nValidSamples: 10000, isRecommended: true }),
    makeOption({ id: PLAIN, label: 'Hire a second seller', winProbability: 0.05, nValidSamples: 10000 }),
    makeOption({ id: OLUMI_A, label: 'Raise the price and phase the increase', winProbability: 0.05, nValidSamples: 10000 }),
    makeOption({ id: OLUMI_B, label: 'Bundle support into the plan', winProbability: 0.05, nValidSamples: 10000 }),
  ]
}

/** Olumi's own: `ai_inferred` with NO quote. The user's carry a quote or are set. */
const olumis = (id: string) => ({ id, data: { kind: 'option', provenance: 'ai_inferred' } })
const users = (id: string) => ({ id, data: { kind: 'option', provenance: 'user_set' } })

const TWO_SHARE = [users(LEADER), users(PLAIN), olumis(OLUMI_A), olumis(OLUMI_B)]
const ONLY_ONE = [users(LEADER), users(PLAIN), olumis(OLUMI_A), users(OLUMI_B)]

function renderOpen(nodes: ReadonlyArray<{ id: string }>) {
  cleanup()
  const vm = buildAnalysisNewViewModel({
    data: makeData({
      recommendation: {
        allOptions: run(),
        recommendedOption: run().find((o) => o.isRecommended) ?? null,
        winProbability: 0.85,
      },
    }),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    nodeOrigins: buildNodeOriginMap(nodes),
  })
  render(<OptionsComparison options={vm.optionsComparison} />)
  // ⚠ STATED, NOT ASSUMED: the shell rests CLOSED and renders no body, so an
  // assertion against the unopened shell reads an empty string and passes every
  // absence arm by testing nothing. These arms are about the OPEN state.
  fireEvent.click(screen.getByTestId(`${TESTID}-toggle`))
  return vm
}

const rowOf = (id: string) => {
  const el = document.querySelector(`[data-option-id="${id}"]`)
  if (el === null) throw new Error(`no row rendered for ${id}`)
  return within(el as HTMLElement)
}

/** Every visible or spoken statement of the sentence, however carried. */
const spokenCount = () =>
  document.querySelectorAll(`[aria-label="${OLUMIS}"]`).length +
  screen.queryAllByText(OLUMIS, { exact: true }).length

describe('the options list says its provenance once', () => {
  it('⭐ two options share it: one legend, and a marker on each — never the sentence twice', () => {
    renderOpen(TWO_SHARE)

    // Precondition, in-test: this fixture really does produce two marked rows.
    // Without it, every absence below could pass on a render that marked none.
    expect(
      document.querySelectorAll('[data-option-origin]').length,
      'precondition: two options carry the origin, plus the legend',
    ).toBe(3)

    for (const id of [OLUMI_A, OLUMI_B]) {
      expect(rowOf(id).getByTestId(`${TESTID}-option-origin-mark-${id}`)).toHaveAttribute('aria-label', OLUMIS)
      // The paragraph is what went; the claim is not.
      expect(rowOf(id).queryByTestId(`${TESTID}-option-origin-${id}`)).toBeNull()
    }

    // The sentence is written out exactly once, in the legend.
    expect(screen.getAllByText(OLUMIS, { exact: true })).toHaveLength(1)
    expect(screen.getByTestId(`${TESTID}-option-origin-legend`)).toHaveTextContent(OLUMIS)
  })

  it('⛔ nothing is taken from a screen reader — every marked option still states it in its own name', () => {
    const vm = renderOpen(TWO_SHARE)
    const marked = vm.optionsComparison.rows.filter((r) => r.origin !== null).map((r) => r.id)
    expect(marked, 'precondition: the view model marks exactly these two').toEqual([OLUMI_A, OLUMI_B])

    // Two markers + one legend = three statements, one per marked option plus
    // the written sentence. Before the change it was two written sentences.
    expect(spokenCount()).toBe(marked.length + 1)
    for (const id of marked) {
      expect(rowOf(id).getByLabelText(OLUMIS)).toBeInTheDocument()
    }
  })

  it('⛔ the claim does not spread — an option the product may not claim carries neither mark nor sentence', () => {
    renderOpen(TWO_SHARE)
    for (const id of [LEADER, PLAIN]) {
      expect(rowOf(id).queryByTestId(`${TESTID}-option-origin-mark-${id}`)).toBeNull()
      expect(rowOf(id).queryByTestId(`${TESTID}-option-origin-${id}`)).toBeNull()
    }
  })

  /**
   * ⛔⛔ THE DISCRIMINATING ARM. With ONE affected option there is nothing to
   * de-duplicate, and a legend would cost a line rather than save one. Both
   * arms run the same fixture and differ only in which nodes Olumi authored, so
   * a legend that rendered regardless — or a marker that replaced the sentence
   * unconditionally — fails here while the arms above still pass.
   */
  /*
   * ⭐ DESIGN TWEAK C (24 Sep 2026): ONE OPTION ALONE NOW GETS THE MARK TOO, AND
   * ITS SENTENCE STOPS BEING A SEPARATE VISIBLE LINE. The product owner read a
   * not-analysed row carrying three stacked lines (reason, link, "Olumi
   * suggested this option, you did not name it") as heavy. The mark next to
   * the name carries the words as its tooltip; the sentence itself stays in the
   * row, visually hidden, so a screen reader still hears it exactly once.
   *
   * ⚠ WHY THE WORDS ARE NOT ONLY THE MARK'S `aria-label`: the mark sits inside
   * the option's name button, whose own `aria-label` REPLACES its content in
   * the accessible name. A label on a child there reaches no screen reader, so
   * the sentence is carried as text beside the button instead.
   */
  it('⛔ one option alone: no legend; the mark sits by the name and the sentence is spoken once, not shown as a line', () => {
    renderOpen(ONLY_ONE)
    expect(screen.queryByTestId(`${TESTID}-option-origin-legend`)).toBeNull()
    // RED-FIRST (tweak C): the mark is next to the name, INSIDE the name button.
    const mark = rowOf(OLUMI_A).getByTestId(`${TESTID}-option-origin-mark-${OLUMI_A}`)
    expect(mark.closest(`[data-testid="${TESTID}-focus"]`), 'the mark sits next to the name').not.toBeNull()
    expect(mark).toHaveAttribute('title', OLUMIS)
    // Decorative to assistive tech: the sentence below is what is spoken.
    expect(mark).toHaveAttribute('aria-hidden', 'true')
    // The sentence is still in the row, but no longer a separate visible line.
    const sentence = rowOf(OLUMI_A).getByTestId(`${TESTID}-option-origin-${OLUMI_A}`)
    expect(sentence).toHaveTextContent(OLUMIS)
    expect(sentence.tagName, 'not a paragraph line').not.toBe('P')
    expect(sentence).toHaveClass('sr-only')
    expect(sentence.closest(`[data-testid="${TESTID}-focus"]`), 'outside the name button, so it is spoken').toBeNull()
    // Contrast in the same arm: the claim is still made exactly once, so this
    // is measuring the threshold and not a render that marked nothing.
    expect(spokenCount()).toBe(1)
  })
})
