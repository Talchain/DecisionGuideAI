/**
 * Analysis (New) — THE PANEL STATES ITS FRESHNESS EXACTLY ONCE.
 *
 * ⚠⚠ THE DEFECT THIS PINS, MEASURED ON THE DEPLOYED BUILD (staging `19fe8710`,
 * guest, a real completed run). Five freshness statements were on one screen,
 * three of them inside this panel:
 *
 *   1. "We cannot confirm whether this analysis reflects the current model."
 *      — the ribbon at the top of `AtAGlance`
 *   2. "As last analysed"           — the eyebrow above the answer
 *   3. "…is the hinge  From an earlier run"
 *      — a row badge, stamped on EVERY key insight
 *
 * (Two more sat in the dock's own chrome, outside this panel and outside this
 * lane: a footer "Model changed. Results may be out of date." and a chat
 * placeholder "Model changed. Ask or rerun…".)
 *
 * ⭐ EVERY ONE OF THEM WAS TRUE, AND THAT IS WHY THE COUNT — NOT THE WORDING —
 * IS THE PROPERTY UNDER TEST. This is not a truthfulness defect and it must
 * never be "fixed" by making any of them lie: `#1050` and `#1064` were both
 * repairs for this tab falsely claiming staleness or partiality. The bar is
 * FEWER STATEMENTS, SAME TRUTH. So the invariant has two halves and needs both:
 *
 *   ≤ 1  freshness statement inside the panel, in EVERY state
 *   ≥ 1  freshness statement whenever the displayed run is not current
 *
 * A suite that only asserted the first half would pass on a panel that had
 * deleted the signal outright; a suite that only asserted the second would pass
 * on the three-way repetition that shipped. Neither half is the test.
 *
 * ⚠ THE VOCABULARY IS DERIVED FROM `ANALYSIS_NEW_COPY`, NEVER RETYPED. A
 * hand-copied list of sentences is the mirror that goes stale the first time
 * someone edits the copy, and the drift reads as green (CLAUDE.md trap 12).
 * `retiredFreshnessVocabulary` below is the one deliberate exception and it is
 * pinned as a LITERAL on purpose: `glance.eyebrowStale` no longer exists as a
 * key, so a derived reference could not name it, and a literal is exactly what
 * catches its reintroduction under a new key.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { AtAGlance } from '../sections/AtAGlance'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import {
  genuineDecision,
  highUncertainty,
  makeData,
  openStrategicChallenge,
} from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

/**
 * A completed run whose ONLY content is the producer's executive summary: no
 * drivers, no verdict word, no tipping point, no leader.
 *
 * ⚠ IT IS HERE BECAUSE IT IS THE SHAPE THAT CAN STARVE THE RIBBON. Every other
 * fixture in the corpus feeds `AtAGlance` something, so none of them can
 * exercise the branch where the glance has nothing and returns `null` — and
 * that branch used to take the panel's only remaining freshness statement with
 * it (CLAUDE.md trap 22: check what the corpus EXCLUDES).
 */
const executiveSummaryOnly = (): ResultsSectionDataReturn =>
  makeData({
    recommendation: {
      coachingHeadline: 'What this run found',
      coachingDecisionStatement: 'The margin path is the binding constraint.',
    } as never,
  })

/** The four run states this panel can be in. `staleReason` is only read when stale. */
const RUN_STATES = [
  { name: 'current run', props: { isPreRun: false, isStale: false }, notCurrent: false },
  {
    name: 'model-changed-since',
    props: { isPreRun: false, isStale: true, staleReason: 'changed' as const },
    notCurrent: true,
  },
  {
    name: 'unconfirmed',
    props: { isPreRun: false, isStale: true, staleReason: 'unconfirmed' as const },
    notCurrent: true,
  },
  // ⚠ STALE IS PASSED TRUE HERE ON PURPOSE. Pre-run suppression is a real rule
  // (`AnalysisNewTabBody` gates on `isStale && !isPreRun`) and the interesting
  // case is the one where the dock hands down BOTH — witnessed on `4401d6d8`.
  {
    name: 'pre-run',
    props: { isPreRun: true, isStale: true, staleReason: 'changed' as const },
    notCurrent: false,
  },
] as const

const FIXTURES = [
  ['openStrategicChallenge', openStrategicChallenge],
  ['genuineDecision', genuineDecision],
  ['highUncertainty', highUncertainty],
  ['executiveSummaryOnly', executiveSummaryOnly],
] as const

/**
 * Every sentence this panel can use to say something about the displayed run's
 * relationship to the current model — derived from the copy module, plus the
 * retired restatements as literals.
 */
const liveFreshnessVocabulary = [COPY.status.stale, COPY.status.freshnessUnknown]
const retiredFreshnessVocabulary = ['As last analysed', COPY.markers.stale]
const FRESHNESS_VOCABULARY = [...liveFreshnessVocabulary, ...retiredFreshnessVocabulary]

/**
 * Count freshness statements as RENDERED, by walking own text nodes so a
 * sentence is attributed to the element that actually prints it rather than to
 * every ancestor that contains it.
 */
function freshnessStatements(root: HTMLElement): Array<{ text: string; testId: string | null }> {
  const hits: Array<{ text: string; testId: string | null }> = []
  root.querySelectorAll('*').forEach((el) => {
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? '')
      .join('')
    for (const sentence of FRESHNESS_VOCABULARY) {
      if (ownText.includes(sentence)) hits.push({ text: sentence, testId: el.getAttribute('data-testid') })
    }
  })
  return hits
}

/**
 * ⚠ EVERY SECTION IS OPENED FIRST, AND WITHOUT THIS THE WHOLE MATRIX IS
 * VACUOUS. `SectionShell` UNMOUNTS a collapsed region, so the row badge that
 * caused this lane lives behind a click — a count taken at rest would read 2
 * where the reader sees 3, and would keep reading 2 if the badge came back.
 */
const openEverySection = () => {
  for (const id of [
    'analysis-new-key-insights',
    'analysis-new-drivers',
    'analysis-new-uncertainty',
    'analysis-new-options-comparison',
    'analysis-new-strengthen',
    'analysis-new-deeper',
  ]) {
    const toggle = screen.queryByTestId(`${id}-toggle`)
    if (toggle) fireEvent.click(toggle)
  }
}

const renderPanel = (
  data: ResultsSectionDataReturn,
  over: Partial<Parameters<typeof AnalysisNewTabBody>[0]>,
) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
      {...over}
    />,
  )

beforeEach(() => {
  useStrengthenStore.setState({ records: {} })
})
afterEach(cleanup)

describe('THE INSTRUMENT — the count can see what shipped', () => {
  /**
   * ⭐ THE POSITIVE CONTROL, AND IT IS THE LOAD-BEARING TEST IN THIS FILE. An
   * absence/count probe with no demonstrated PRESENCE is vacuous (CLAUDE.md
   * trap 13). This renders the three restatements into one tree by hand and
   * proves the counter returns 3 — so a later change that blinds the counter
   * (a testid rename, a copy edit, a walker that stops attributing own text)
   * REDs here instead of silently reporting one everywhere.
   */
  it('counts THREE when all three restatements are present', () => {
    const { container } = render(
      <div>
        <span>{COPY.status.freshnessUnknown}</span>
        <span>As last analysed</span>
        <span>{COPY.markers.stale}</span>
      </div>,
    )
    expect(freshnessStatements(container).map((h) => h.text)).toHaveLength(3)
  })

  /** The discrimination half: an unrelated sentence must not be counted. */
  it('counts ZERO on a panel-shaped tree with no freshness sentence in it', () => {
    const { container } = render(
      <div>
        <span>{COPY.glance.eyebrowLeading}</span>
        <span>{COPY.markers.notAssessed}</span>
        <span>{COPY.status.provisional}</span>
      </div>,
    )
    expect(freshnessStatements(container)).toHaveLength(0)
  })
})

describe('THE STATE MATRIX — at most one statement, and never zero when it matters', () => {
  for (const [fixtureName, fixture] of FIXTURES) {
    for (const state of RUN_STATES) {
      it(`${fixtureName} · ${state.name}: says it ${state.notCurrent ? 'exactly once' : 'not at all'}`, () => {
        const { container } = renderPanel(fixture(), state.props)
        openEverySection()
        const hits = freshnessStatements(container)

        expect(
          hits.length,
          `expected ${state.notCurrent ? 1 : 0}, got ${hits.length}: ${JSON.stringify(hits)}`,
        ).toBe(state.notCurrent ? 1 : 0)

        // The surviving statement must be the RIBBON, by testid — not merely
        // "some element somewhere". Binding by identity, never by a predicate
        // another element could satisfy (CLAUDE.md trap 19).
        if (state.notCurrent) {
          expect(hits[0].testId).toBe(
            state.props.staleReason === 'changed'
              ? 'analysis-new-status-stale'
              : 'analysis-new-status-freshness-unknown',
          )
        }
      })
    }
  }
})

describe('THE TWO CONDITIONS STAY NAMED APART', () => {
  /**
   * `staleReason.ts` exists because one boolean answered two questions:
   * 'changed' is a claim about the WORLD, 'unconfirmed' is a claim about our
   * EVIDENCE. Reducing three surfaces to one must not quietly reduce two
   * conditions to one (CLAUDE.md trap 21) — so the single surviving statement
   * is asserted to differ between them, on the same fixture.
   */
  it("'changed' and 'unconfirmed' render DIFFERENT sentences on the same run", () => {
    const changed = renderPanel(genuineDecision(), {
      isPreRun: false,
      isStale: true,
      staleReason: 'changed',
    })
    const changedText = freshnessStatements(changed.container).map((h) => h.text)
    cleanup()

    const unconfirmed = renderPanel(genuineDecision(), {
      isPreRun: false,
      isStale: true,
      staleReason: 'unconfirmed',
    })
    const unconfirmedText = freshnessStatements(unconfirmed.container).map((h) => h.text)

    expect(changedText).toEqual([COPY.status.stale])
    expect(unconfirmedText).toEqual([COPY.status.freshnessUnknown])
    expect(changedText).not.toEqual(unconfirmedText)
  })

  /**
   * ⚠ FAIL-CLOSED IS PART OF THE CONTRACT, NOT AN ACCIDENT. An absent reason
   * must yield the weaker claim, because not being able to establish a change
   * is not evidence of one.
   */
  it('an ABSENT reason still says the weaker of the two', () => {
    const { container } = renderPanel(genuineDecision(), { isPreRun: false, isStale: true })
    expect(freshnessStatements(container).map((h) => h.text)).toEqual([
      COPY.status.freshnessUnknown,
    ])
  })
})

describe('WHAT THE REMOVED SURFACES WERE CARRYING', () => {
  /**
   * ⭐⭐ THE PRECONDITION FOR REMOVING `eyebrowStale`, PINNED IN-TEST RATHER
   * THAN ASSERTED IN A COMMENT.
   *
   * That eyebrow existed to put `glance.headline` — "… currently scores higher"
   * — into the past. The argument for dropping it is that the surface renders
   * `leaderLabel ?? headline` and `leaderLabel` is non-null on exactly the runs
   * where `headline` is, so the tensed sentence never reaches the screen. If
   * that ever stops being true the eyebrow's removal becomes a real loss, and
   * this case is what says so. (CLAUDE.md trap 13b: a guard whose validity
   * depends on a fact nothing pins is a guard agreeing with itself.)
   */
  it('the answer line renders the OPTION LABEL, never the present-tense sentence', () => {
    const vm = buildAnalysisNewViewModel({
      data: genuineDecision(),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: true,
      staleReason: 'changed',
    })
    // The precondition itself: the view model composed a tensed headline AND a
    // label, and the label is what the component prefers.
    expect(vm.atAGlance.headline).toContain('currently scores higher')
    expect(vm.atAGlance.leaderLabel).toBe('Raise price')

    renderPanel(genuineDecision(), { isPreRun: false, isStale: true, staleReason: 'changed' })
    const answer = screen.getByTestId('analysis-new-glance-headline')
    expect(answer).toHaveTextContent('Raise price')
    expect(answer).not.toHaveTextContent('currently scores higher')
  })

  /**
   * ⭐ AND THE THING THE STALE EYEBROW COST THE READER. Swapping the label out
   * meant a stale panel named an option without saying it was the leading one —
   * the role label was information the fresh reader got and the stale reader
   * did not. It is now the same in both states.
   */
  it('the role label survives into the stale state', () => {
    renderPanel(genuineDecision(), { isPreRun: false, isStale: true, staleReason: 'changed' })
    expect(screen.getByTestId('analysis-new-glance')).toHaveTextContent(COPY.glance.eyebrowLeading)
  })

  /**
   * ⚠ THE VIEW MODEL IS UNTOUCHED — this is a render-layer decision, and the
   * evidence for that is that the finding still ARRIVES marked. A future lane
   * reading only the screen would conclude the fact was deleted upstream.
   */
  it('the view model still marks the run stale; only the row badge is dropped', () => {
    const vm = buildAnalysisNewViewModel({
      data: openStrategicChallenge(),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: true,
      staleReason: 'changed',
    })
    expect(vm.keyInsights.insights.length).toBeGreaterThan(0)
    expect(vm.keyInsights.insights.every((i) => i.marker === 'stale')).toBe(true)

    renderPanel(openStrategicChallenge(), {
      isPreRun: false,
      isStale: true,
      staleReason: 'changed',
    })
    openEverySection()
    expect(screen.queryByTestId('analysis-new-key-insights-marker')).toBeNull()
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN. Dropping the RUN-scoped badge must not drop
   * the ROW-scoped ones — `not_assessed` is a claim about one row's own data and
   * is the whole reason `DisclosureRow` has a badge at all. A blanket "no
   * markers" fix would pass every count assertion above and silently delete it.
   */
  it('ROW-scoped markers are untouched', () => {
    renderPanel(highUncertainty(), { isPreRun: false, isStale: true, staleReason: 'changed' })
    openEverySection()
    const badges = screen.getAllByTestId('analysis-new-drivers-marker')
    expect(badges.length).toBeGreaterThan(0)
    for (const b of badges) expect(b).toHaveTextContent(COPY.markers.notAssessed)
  })
})

describe('THE RIBBON CANNOT BE DROPPED BY AN EMPTY GLANCE', () => {
  /**
   * ⚠⚠ THE STRUCTURAL HALF OF THE FIX, AND WITHOUT IT THE ≥1 GUARANTEE HELD
   * ONLY BY LUCK. `AtAGlance` returns `null` when it has nothing to show, and
   * the ribbon used to be built AFTER that early return — so on a glance with no
   * content the freshness statement was dropped and the row badge was carrying
   * it alone. Remove the badge without this and the panel goes SILENT on a stale
   * run. Driven at the component so the branch is reachable at all: through the
   * body the engine always mints an intervention, which keeps the glance alive.
   */
  const emptyGlance = () =>
    buildAnalysisNewViewModel({
      data: makeData({}),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: true,
      staleReason: 'changed',
    }).atAGlance

  it('the fixture really does starve the glance (precondition)', () => {
    const g = emptyGlance()
    expect(g.headline).toBeNull()
    expect(g.verdict).toBeNull()
    expect(g.condition).toBeNull()
    expect(g.drivers).toHaveLength(0)
  })

  it('a stale run with NOTHING to show still says it is stale', () => {
    const { container } = render(
      <AtAGlance glance={emptyGlance()} isStale staleKind="changed" primaryIntervention={null} />,
    )
    expect(screen.getByTestId('analysis-new-status-stale')).toBeInTheDocument()
    expect(freshnessStatements(container)).toHaveLength(1)
  })

  /**
   * The control, and it is what stops the change above from becoming "always
   * render the glance": with nothing to show AND nothing to warn about, the
   * surface is still silent.
   */
  it('a CURRENT run with nothing to show still renders nothing', () => {
    const { container } = render(<AtAGlance glance={emptyGlance()} primaryIntervention={null} />)
    expect(container.firstChild).toBeNull()
  })
})
