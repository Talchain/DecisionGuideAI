/**
 * ⭐⭐ WHEN THE GLANCE ANSWERS NOTHING, THE FIGURES COME UP TO FILL THE GAP.
 *
 * ── THE WITNESSED DEFECT ───────────────────────────────────────────────────
 * Paul, deployed Reasoning tab. The run's verdict WITHHELD the leader, so
 * `AtAGlance` rendered no reading. The panel then ran: coaching with nothing to
 * respond to, four assumption cards, "What we checked" saying *"Most likely
 * option not confirmed"* — and ELEVEN sections down, the only figures the run
 * produced: 72% / 16% / 2%. The product had the numbers, was licensed to show
 * them, and put them a full scroll below the sentence explaining them.
 *
 * ── ⚠ WHY THIS IS NOT A REVERSAL OF THE ORDERING RULING ────────────────────
 * `the coaching sits directly under the reading it responds to`
 * (`AnalysisNewTabBody.spec.tsx`) pins `glance -> strengthen -> detail`, calls
 * it "WHAT HAPPENED -> WHAT TO DO ABOUT IT -> THE DETAIL", and names burying
 * Strengthen below the detail as the defect it prevents. **That ruling stands
 * and this file asserts it still holds**, on the fixture it was written for.
 *
 * Its unstated precondition is that the glance ANSWERED. Where it did not,
 * "what happened" is empty and there is no reading for the coaching to sit
 * under — so the order it protects is not the order being served. The two
 * cases below are the discriminating pair: same surface, one boolean apart,
 * OPPOSITE orders, each correct for its own state.
 *
 * ⭐ THE PREDICATE IS NOT NEW. `OptionsComparison` already computed it for
 * `defaultOpen` and its docblock had already diagnosed the burial: "on a
 * WITHHELD run the glance renders NO reading at all, and then a closed row
 * means a collaborator sees no numbers anywhere — from an analysis that
 * computed them and is licensed to show them." It could only open itself IN
 * PLACE. Hoisting the same fact lets it move.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve as resolvePath, join as joinPath } from 'node:path'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, genuineDecision, makeData, makeOption } from './analysisNewFixtures'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="withheld_promotion"
    />,
  )

/** `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const glanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
    .atAGlance

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the figures rise only when the glance said nothing', () => {
  /**
   * ⭐ THE PRECONDITION, PINNED IN-TEST (trap 13b). Both ordering cases below
   * are claims about a STATE, and a fixture that silently stopped reproducing
   * its state would make either of them pass for the wrong reason. This asserts
   * the two fixtures really do differ on the boolean the behaviour keys on.
   */
  it('PRECONDITION: the two fixtures differ on exactly the governing fact', () => {
    expect(glanceOf(genuineDecision()).headline, 'the permitted run must name a leader').not.toBeNull()
    expect(glanceOf(decisionWithLeaderWithheld()).headline, 'the withheld run must name none').toBeNull()
  })

  it('THE EXISTING RULING HOLDS: when the glance answered, coaching stays above the detail', () => {
    renderBody(genuineDecision())
    const glance = screen.getByTestId('analysis-new-glance')
    const strengthen = screen.getByTestId('analysis-new-strengthen')
    const options = screen.getByTestId('analysis-new-options')
    expect(new Set([glance, strengthen, options]).size, 'three distinct elements').toBe(3)

    expect(precedes(glance, strengthen), 'glance above coaching').toBe(true)
    expect(
      precedes(strengthen, options),
      'the ordering ruling is untouched on a run whose glance answered',
    ).toBe(true)
  })

  it('THE NEW CASE: when the glance withheld, the figures rise above the coaching', () => {
    renderBody(decisionWithLeaderWithheld())
    const glance = screen.getByTestId('analysis-new-glance')
    const options = screen.getByTestId('analysis-new-options')
    const strengthen = screen.getByTestId('analysis-new-strengthen')

    expect(
      precedes(glance, options),
      'the figures fill the gap the glance left, so they sit where the reading would have been',
    ).toBe(true)
    expect(
      precedes(options, strengthen),
      'with no reading above it, coaching has no subject until the figures are on screen',
    ).toBe(true)
  })

  /**
   * ⛔ THE FAILURE MODE THE TWO SLOTS CREATE, AND THE ONLY ONE THAT MATTERS.
   * Two render sites of one component duplicate `analysis-new-options` if the
   * gate is ever written as anything but exclusive — and a duplicated testid
   * breaks every `getByTestId` on this surface, including the cases above,
   * which would then fail for a reason that hides this one.
   */
  /**
   * ⭐ AND THE WHOLE SUITE IS ALREADY THE GUARD, which is stronger than this
   * case alone. Swept every spec reading `analysis-new-options`: all of them
   * use `getByTestId` or `queryByTestId`, and BOTH THROW on a duplicate. The
   * only `getAllByTestId` uses are for `analysis-new-options-row` — a genuinely
   * repeated element — and the assertion below.
   *
   * ⚠ THAT SWEEP IS THE POINT, not a reassurance. `getAllByTestId` silently
   * takes the first match, so a single spec using it on the SECTION id would
   * have made a duplicated testid pass quietly across the surface while this
   * case went on claiming exclusivity. The property is only safe because
   * nothing does.
   */
  it('EXCLUSIVITY: exactly one options section renders, in either state', () => {
    for (const [name, data] of [
      ['permitted', genuineDecision()],
      ['withheld', decisionWithLeaderWithheld()],
    ] as const) {
      renderBody(data)
      /* ⭐ `getByTestId` IS the exclusivity assertion: it throws on ZERO and on
         TWO OR MORE, so a passing call means exactly one. Using it here rather
         than counting with a tolerant query is what lets the rule below be a
         FLAT BAN with no exemption — and an exemption was the whole source of
         the cliff that broke the first two versions of that rule. */
      expect(
        () => screen.getByTestId('analysis-new-options'),
        `${name}: exactly one options section must render — getByTestId throws on 0 and on 2+`,
      ).not.toThrow()
      cleanup()
    }
  })

  /**
   * ⭐⭐ THE QUERY DISCIPLINE THE EXCLUSIVITY CASE SILENTLY DEPENDS ON.
   *
   * ⛔ WHY THIS EXISTS: the case above is only meaningful because every OTHER
   * spec on this surface reads the section id with `getByTestId` /
   * `queryByTestId`, both of which THROW on a duplicate. That makes the whole
   * suite the guard — and it is held BY CONVENTION, with nothing asserting it.
   *
   * `getAllByTestId` silently takes the FIRST match. So one spec switching to
   * it would make a duplicated section pass quietly across the entire surface,
   * while the exclusivity case above went on claiming otherwise — a guard
   * agreeing with itself after the property it guards has gone. The failure
   * arrives the day someone changes a QUERY, not the day someone duplicates the
   * ELEMENT, which is why no amount of care at the render site prevents it.
   *
   * ⚠ DERIVED FROM THE SPEC FILES, NEVER HAND-LISTED (trap 12). A fixed list of
   * "specs allowed to do this" stops covering the file somebody adds tomorrow,
   * and the drift reads as green.
   *
   * ⚠ `-options-row` IS EXEMPT AND MUST BE: those rows are genuinely repeated,
   * one per option, so `getAllByTestId` is the correct query there. The rule is
   * about the SECTION id, which must be unique.
   */
  it('no spec reads the SECTION id with a query that tolerates duplicates', () => {
    /* Assembled, never written whole: a literal here would be matched by the
       scan below exactly as the failure message was. */
    const SECTION_ID = ['analysis', 'new', 'options'].join('-')
    const dir = resolvePath(__dirname)
    const offenders: string[] = []
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
      const src = readFileSync(joinPath(dir, file), 'utf8')
      for (const m of src.matchAll(/getAllByTestId\(\s*['"`]([^'"`]+)['"`]/g)) {
        /* ⛔⛔ A FLAT BAN, AFTER TWO BROKEN ATTEMPTS AT AN EXEMPTION.
           v1 exempted a `toHaveLength` within 220 characters. Proven broken in
           BOTH directions: a hazardous query borrowed a neighbouring
           assertion's exemption, and a safe counting case was falsely flagged
           when a comment pushed its assertion past the cliff. That is a
           character-budget discriminator with hard cliffs either side — the
           shape this estate has ruled unwinnable (trap 22f).
           v2 tried to bind the assertion structurally to the same expression
           and still missed the multi-line `expect(\n  query,\n  msg,\n)` form.

           ⭐ THE FIX WAS TO REMOVE THE NEED FOR AN EXEMPTION, not to write a
           better one. The only legitimate use was this file's own exclusivity
           count — and `getByTestId` already asserts exclusivity by throwing on
           0 and on 2+. With that case converted, NOTHING needs to read the
           section id tolerantly, so the rule is a flat ban: no window, no
           exemption, no cliff, nothing to tune. */
        /* ⚠ THE MESSAGE MUST NOT SPELL THE PATTERN. The first flat-ban version
           reported `...getAllByTestId('<the id>')...` in its own failure text
           and then MATCHED ITSELF on the next run — this scanner reads every
           spec in the directory including this one. Same self-read trap as a
           guard matching its own explanatory comment; here it is a STRING
           LITERAL, which `stripComments` cannot remove. The id is compared, not
           printed. */
        if (m[1] === SECTION_ID) {
          offenders.push(`${file}: a tolerant query on the section id — use getByTestId, which throws on a duplicate`)
        }
      }
    }
    expect(
      offenders,
      'A tolerant query on the SECTION id makes a duplicated section pass silently\n' +
        'across the whole surface. Use getByTestId, which throws.\n' +
        offenders.join('\n'),
    ).toEqual([])
  })

  /**
   * ⭐ THE DISCRIMINATOR. The rule above passes trivially if the scanner reads
   * nothing, and it must not ban the LEGITIMATE use on repeated rows.
   */
  it('DISCRIMINATOR: the scanner reads real files and permits the repeated-row query', () => {
    const dir = resolvePath(__dirname)
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
    expect(files.length, 'PRECONDITION: the spec directory must be readable').toBeGreaterThan(10)
    const anyGetAll = files.some((f) =>
      /getAllByTestId\(/.test(readFileSync(joinPath(dir, f), 'utf8')),
    )
    expect(
      anyGetAll,
      'PRECONDITION: some spec must use getAllByTestId, or the rule above is vacuous',
    ).toBe(true)
  })

  /**
   * ⚠ ABSENCE IS NOT ZERO — the second conjunct, pinned. `headline === null`
   * alone would promote the section on a run that returned no figures either,
   * putting a heading over nothing. This asserts the promotion is keyed on
   * there being something to promote.
   */
  /**
   * ⭐⭐ THE SECOND CONJUNCT, PINNED BY RENDERING — corrected after review.
   *
   * ⛔ THE CASE THAT STOOD HERE WAS NAMED `DISCRIMINATOR` AND DISCRIMINATED
   * NOTHING. It asserted only the PRECONDITION (that the fixture carries
   * figures) and **never rendered**, so it could not observe whether the
   * conjunct did any work. An independent reviewer proved it: deleting
   * `&& rows.some(winReadout !== null)` from `glanceWithheldFigures` left
   * **1801 tests green**. The conjunct was completely unpinned while a case
   * with DISCRIMINATOR in its name sat above it implying otherwise — which is
   * worse than no test, because the name is what a later reader trusts.
   *
   * ⭐ THE PROPERTY IT MUST HOLD: `headline === null` alone would promote the
   * section on a run that produced no figures either — a heading over nothing,
   * which is exactly what `AnalysisNewSection` refuses to do everywhere else.
   * "Absence is not zero" is the estate's rule and this is its instance.
   *
   * So: a withheld glance WITH figures promotes (pinned above); a withheld
   * glance WITHOUT figures must promote NOTHING. Both arms render.
   */
  it('a withheld glance with NO figures promotes nothing', () => {
    const noFigures = makeData({
      recommendation: {
        recommendedOption: null,
        goalLabel: 'Reach the target',
        // Options with no win readout: analysed nowhere, so nothing to promote.
        allOptions: [
          makeOption({ id: 'o1', label: 'Option one' }),
          makeOption({ id: 'o2', label: 'Option two' }),
        ],
      },
    })
    const vm = buildAnalysisNewViewModel({
      data: noFigures, recommendations: [], isPreRun: false, isRunning: false, isStale: false,
    })

    /* ⚠ BOTH PRECONDITIONS PINNED IN-TEST. Without them this passes for the
       wrong reason on any fixture that simply renders no options at all. */
    expect(vm.atAGlance.headline, 'PRECONDITION: the glance must be withholding').toBeNull()
    expect(
      vm.optionsComparison.rows.some((r) => r.kind === 'analysed' && r.winReadout !== null),
      'PRECONDITION: this fixture must carry NO figures, or the conjunct is untested',
    ).toBe(false)

    renderBody(noFigures)
    const options = screen.queryByTestId('analysis-new-options')

    /* ⚠ THE DISCRIMINATING POSITION IS STRENGTHEN, NOT THE GLANCE — and my
       first version of this assertion got that wrong and the test caught it.
       BOTH slots render below the glance; what the promotion changes is
       whether the comparison sits ABOVE the coaching (promoted) or eleven
       sections BELOW it (in place). Comparing against the glance therefore
       cannot tell the two states apart at all.

       The section may also legitimately not mount here — it returns null on an
       empty comparison — so the claim is conditional on it existing. */
    if (options !== null) {
      const strengthen = screen.getByTestId('analysis-new-strengthen')
      expect(
        precedes(strengthen, options),
        'with no figures to show, the comparison must stay in its in-place slot BELOW the coaching',
      ).toBe(true)
    }
  })
})
