/**
 * ⭐⭐⭐ THE CLASS GUARD — a new hero field cannot name a leader the run never
 * licensed, and it cannot deny one either.
 *
 * ## Why this file exists
 *
 * Three PRs in one week were the same defect: a surface asserting something
 * the analysis run does not license. Each was repaired field by field, and the
 * hero now carries four separate "WITHHELD GATE n of 4" comments — a
 * hand-maintained mirror of the model's own shape. The fifth naming field was
 * added without one, and nothing went red: `buildHeroModel`'s HEADLINE named
 * the leader on a run whose admission refused a comparative claim, while the
 * three fields beside it correctly fell silent. Measured, not inferred — see
 * the RED-first evidence in the PR body.
 *
 * A per-field guard cannot catch the field nobody thought of. So this one
 * takes no list of fields: it walks the ENTIRE view model and applies the rule
 * "a per-option record may carry its own identity, nothing else may name an
 * option" (`../../__tests__/helpers/leaderNamingScan`). Add a field tomorrow
 * that interpolates a label, or points at an option id, and this REDs on the
 * withheld cells the day you add it.
 *
 * ⭐ THE HEADLINE LEAK IS ALREADY CLOSED — #1232 landed the two conjuncts
 * while this guard was being written, independently and byte-identically. So
 * this file adds NO fix. It exists because the leak was found by a person
 * reading the file, twice, and the next one will be found the same way unless
 * something derived is watching. `admissionGatesHeroCrown.spec.ts` arms E/F/G
 * were green throughout that whole defect (they were bound to `leaders`), and
 * arms H/I now pin the headline BY NAME — which is one more field on the
 * mirror. This guard is bound to no field at all.
 *
 * ## ⚠ SILENCE IS NOT DENIAL, AND CONFLATING THEM IS ITSELF A REGRESSION
 *
 * There are TWO questions here and they must never be reconciled into one:
 *
 *   "may we NAME an option?"        the licence — Q1 (the model's admission)
 *                                   ∧ Q2 (this result separated the arms)
 *   "did the producer say the       the producer's TIE fact
 *    options are level?"
 *
 * A withheld run gets SILENCE — "Here is how your options compare." A producer
 * TIE earns the DENIAL — "No option is clearly ahead." — because the producer
 * positively said so. An author who put the licence on the band resolution
 * underneath the naming arms (`!designationsWithheld` on `sharedVerdictApplies`)
 * deleted the tie path outright: on every tie `designationsWithheld` is ALREADY
 * true, so the band never reached 'none' and the denial became unreachable. The
 * licence belongs on the arms that NAME an option; the tie arm is not one.
 *
 * Both directions are pinned below, and the PR's mutant pair proves each bites
 * on its own cell and stays green on the other.
 *
 * ## Scope of the claim (CLAUDE.md trap 3 / trap 16)
 *
 * This drives ONE view-model builder over a six-cell matrix in jsdom. It proves
 * WORDING and MODEL CONTENT, never layout, never a screen, and nothing about
 * the other surfaces the register enumerates (Compare tab, Model tab, the
 * conditional-winner cards) — those consult no licence at all and are
 * untouched here. The scanner is exported from the shared helpers directory so
 * a lane closing one of those adopts the same instrument rather than writing a
 * sixth copy of the rule.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { HERO_COPY } from '../heroCopy'
import {
  OPTION_IDENTITIES,
  OPT_HEDGE,
  OPT_HEDGE_LABEL,
  admission,
  resetStore,
  setStore,
} from '../../__tests__/helpers/admissionGatesHarness'
import { scanForOptionNaming } from '../../__tests__/helpers/leaderNamingScan'
import type { PermittedAnalysisMode } from '../../../../adapters/cee/types'

/**
 * The matrix is a CARTESIAN PRODUCT, not a written-out table: three admission
 * states (permits · refuses · absent) × two producer results (the arms
 * separated · a producer tie). A seventh cell cannot be forgotten because no
 * cell is typed out.
 */
const ADMISSION_MODES = ['comparative_leader', 'quantified_provisional', null] as const
const PRODUCER_SEPARATED = [true, false] as const

interface Cell {
  mode: PermittedAnalysisMode | null
  separated: boolean
}
const CELLS: Cell[] = ADMISSION_MODES.flatMap((mode) =>
  PRODUCER_SEPARATED.map((separated) => ({ mode, separated }) as Cell),
)

const cellName = (c: Cell) =>
  `admission=${c.mode ?? 'ABSENT'} · producer=${c.separated ? 'arms separated' : 'TIE'}`

function heroFor(cell: Cell) {
  setStore({
    separated: cell.separated,
    ...(cell.mode == null ? {} : { admission: admission(cell.mode) }),
  })
  const r = renderHook(() => useResultsSectionData())
  const data = r.result.current
  // HARNESS PRECONDITIONS. Every arm below is an assertion about a MODEL; if
  // the hook built no options, or the hero returned a status/empty shape, the
  // arm would pass by describing nothing.
  expect(data.recommendation?.allOptions?.length, 'precondition: the hook must build both options').toBe(2)
  const hero = buildHeroModel(data)
  expect(hero.kind, 'precondition: the hero must return a chart model').toBe('chart')
  const chart = hero as Extract<typeof hero, { kind: 'chart' }>
  expect(chart.rows.length, 'precondition: both options must reach the rows').toBe(2)
  return { data, chart }
}

describe('a NEW surface cannot name a leader the run never licensed', () => {
  beforeEach(resetStore)

  /**
   * ⭐ THE INSTRUMENT'S OWN DISCRIMINATING PAIR, run before it is trusted.
   * A scanner that fires on everything and a scanner that fires on nothing
   * both produce a confident answer. This proves it does BOTH — catches a
   * planted name, and does not condemn a row for carrying its own identity.
   */
  it('the scanner discriminates: a planted name is caught, a row own identity is not', () => {
    const opts = [
      { id: 'opt_a', label: 'Alpha plan' },
      { id: 'opt_b', label: 'Beta plan' },
    ]
    const planted = scanForOptionNaming(
      { headline: 'Alpha plan is ahead.', leaders: { goal: 'opt_b' } },
      opts,
    )
    expect(planted.violations.map((v) => `${v.path}:${v.kind}`)).toEqual([
      'headline:label-in-prose',
      'leaders.goal:id-pointer',
    ])
    const dataOnly = scanForOptionNaming(
      { rows: [{ id: 'opt_a', label: 'Alpha plan' }, { id: 'opt_b', label: 'Beta plan' }] },
      opts,
    )
    expect(dataOnly.violations).toEqual([])
    expect(dataOnly.exempt.map((h) => h.path)).toEqual([
      'rows[0].id',
      'rows[0].label',
      'rows[1].id',
      'rows[1].label',
    ])
  })

  /**
   * The harness exports the leader's label BOTH as a literal (`OPT_HEDGE_LABEL`,
   * for the arms that assert on the sentence) and derived from the fixture
   * nodes (`OPTION_IDENTITIES`, for this scan). Two copies of one string is two
   * things to drift, and a scan pointed at a stale label reads CLEAN over a
   * model that names the real one — the quietest possible failure. This is the
   * union assertion that stops the copy rotting; it is not decoration.
   */
  it('the literal label and the derived label are the same string', () => {
    expect(OPTION_IDENTITIES.find((o) => o.id === OPT_HEDGE)?.label).toBe(OPT_HEDGE_LABEL)
  })

  /**
   * SILENCE AND DENIAL MUST REMAIN TWO DIFFERENT SENTENCES. If these two
   * constants were ever made equal, every arm below would still pass while the
   * product silently answered a withheld run with a denial.
   */
  it('silence and denial are distinct copy — the arms below cannot be collapsed', () => {
    expect(HERO_COPY.headline.noLeader).not.toBe(HERO_COPY.headline.noClearLeader)
    expect(HERO_COPY.headline.noLeader).toBe('Here is how your options compare.')
    expect(HERO_COPY.headline.noClearLeader).toBe('No option is clearly ahead.')
  })

  it.each(CELLS.map((c) => [cellName(c), c] as const))('%s', (_name, cell) => {
    const { data, chart } = heroFor(cell)

    // THE DOCTRINE, stated independently of the code under test. Deriving the
    // expectation from `chart.designationsWithheld` would be the model
    // agreeing with itself; these two lines are the rule as written in the
    // ruling, computed from the CELL's inputs.
    const modelLicensesComparativeClaim = cell.mode == null ? true : cell.mode === 'comparative_leader'
    const namingLicensed = modelLicensesComparativeClaim && cell.separated
    const producerCalledATie = !cell.separated

    // Fixture pin: the producer's own leader identity, so the control below
    // binds to an option by ID and not by "whichever label turns up".
    expect(data.recommendation?.verdict?.leaderId, 'fixture pin: the producer names hedge as top option').toBe(OPT_HEDGE)
    const leaderLabel = OPTION_IDENTITIES.find((o) => o.id === OPT_HEDGE)?.label
    expect(leaderLabel, 'fixture pin: the leader option must have a label to look for').toBeTruthy()

    const scan = scanForOptionNaming(chart, OPTION_IDENTITIES)

    // INSTRUMENT PRECONDITION — the one that stops a clean scan meaning
    // "I walked nothing". Both option identities must have been SEEN and
    // classified as the rows' own data.
    expect(scan.stringsScanned, 'instrument: the scan must have read strings').toBeGreaterThan(0)
    expect(
      scan.exempt.filter((h) => h.kind === 'label-verbatim').map((h) => h.optionId).sort(),
      'instrument: both option labels must be present in the model and seen as row data',
    ).toEqual(OPTION_IDENTITIES.map((o) => o.id).slice().sort())

    if (namingLicensed) {
      // POSITIVE CONTROL. On a licensed run the hero SHOULD name the leader,
      // and the scan must say so — otherwise the withheld arms are passing
      // because the instrument is blind, not because the product is silent.
      expect(chart.designationsWithheld).toBe(false)
      expect(
        scan.violations.map((v) => v.path),
        'control: a licensed run names the leader, so the scan must find it',
      ).toContain('headline')
      expect(chart.headline).toContain(leaderLabel)
      return
    }

    // WITHHELD. No field of the model may name an option — not the fields
    // that exist today, and not the one added next week.
    expect(chart.designationsWithheld).toBe(true)
    expect(
      scan.violations.map((v) => `${v.path} (${v.kind}) → ${v.value}`),
      'withheld: no field of the hero model may name an option',
    ).toEqual([])

    if (producerCalledATie) {
      // THE DENIAL THE PRODUCER EARNED. It is licensed by the producer's tie
      // FACT, not by the leader licence, so it must survive a withheld run.
      // A guard that demanded silence here would re-create the regression
      // that made this sentence unreachable.
      expect(chart.headline, 'a producer tie earns the denial, on any admission').toBe(
        HERO_COPY.headline.noClearLeader,
      )
    } else {
      // SILENCE, NEVER A DENIAL. The producer separated the arms; only the
      // MODEL refused the comparative claim. Saying "No option is clearly
      // ahead." here would swap one unearned claim for another.
      expect(chart.headline, 'a withheld claim earns silence, not a denial').toBe(
        HERO_COPY.headline.noLeader,
      )
    }
  })
})
