/**
 * ⭐⭐ THE PROVISIONAL ANSWER IS ON THE FIRST SCREEN — V2's three stages, compact.
 *
 * ── THE MEASURED DEFECT ────────────────────────────────────────────────────
 * Served `c5000550`, 24 Sep 2026 16:3xZ, guest, OpenAI path, MRR pricing brief
 * (scenario 342575f9), leader WITHHELD (`constraint_verdict_withheld`), panel
 * 414×769 at a 1440×900 viewport. Offsets from the panel's top:
 *
 *   method strip 16 · amber caveat box 60 (76px) · model strip 152 ·
 *   "Focus now" 334 (108px) · Challenge zone 458 (278px, of which the two
 *   collapsed detail sections are 614–735) · "Move towards commitment" 751 ·
 *   options chart 848 — BELOW the 769px fold.
 *
 * The prototype (`Olumi_Reasoning_Prototype_V2.html`, `reasoningHTML()`) goes
 * check → challenge → commit, with the qualifier one borderless 11px line under
 * the chart: "Provisional · evidence and robustness not established."
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────
 * 1. Nothing that is DETAIL sits between the challenge and the answer: the
 *    drivers section and the "Focus now" nudges come after the commitment
 *    block. "What would change your mind" is the challenge itself and stays
 *    above it (review 5818389086).
 * 2. No amber caveat box renders above the model; its entries are listed under
 *    About › Limitations instead.
 * 3. One provisional qualifier sits under the chart, before "Record your view",
 *    and every clause in it is a fact the view model already licenses (the
 *    run's input provenance, the evidence check, the robustness verdict).
 *
 * Both the withheld run (what an automatic first run on unconfirmed values will
 * almost always be) and its permitted twin are checked: the answer's position
 * must not depend on how well the run went.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentQualifier } from '../commitmentQualifier'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  decisionWithLeaderWithheldAndReason,
  genuineDecision,
} from './analysisNewFixtures'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="first_screen"
    />,
  )

const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })

/** `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

const BOTH = [
  ['a withheld run', decisionWithLeaderWithheldAndReason],
  ['a permitted run', genuineDecision],
] as const

describe('the provisional answer is on the first screen', () => {
  it('PRECONDITION: the two fixtures differ on the leader licence', () => {
    expect(vmOf(decisionWithLeaderWithheldAndReason()).leaderClaimPermitted).toBe(false)
    expect(vmOf(genuineDecision()).leaderClaimPermitted).toBe(true)
  })

  it.each(BOTH)('no detail section sits between the challenge and the answer — %s', (_n, make) => {
    renderBody(make())
    const challenge = screen.getByTestId('analysis-new-zone-also-group')
    const commitment = screen.getByTestId('analysis-new-commitment')
    const options = screen.getByTestId('analysis-new-options')
    expect(precedes(challenge, commitment), 'challenge, then the answer').toBe(true)
    expect(within(commitment).getByTestId('analysis-new-options')).toBe(options)

    // V2 prototype (Paul, 25 Sep 2026): the drivers detail that used to push the
    // chart below the fold is not on the default scroll at all. At rest only the
    // "Assumptions and evidence" door stands in the challenge zone; the detail
    // renders only inside that door once opened — never in the answer zone.
    const answer = screen.getByTestId('analysis-new-zone-answer-group')
    const door = screen.getByTestId('analysis-new-signals-disclose')
    expect(challenge, 'the door is in the challenge zone').toContainElement(door)
    expect(door, 'the door is closed at rest').toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByTestId('analysis-new-what-moves-the-outcome'),
      'nothing of the drivers detail sits on the default scroll',
    ).toBeNull()
    fireEvent.click(door)
    const whatMoves = screen.getByTestId('analysis-new-what-moves-the-outcome')
    expect(screen.getByTestId('analysis-new-signals'), 'it renders inside the opened door').toContainElement(whatMoves)
    expect(answer, 'and never in the answer zone').not.toContainElement(whatMoves)

    // "What would change your mind" is the challenge to the answer: it stays
    // in the challenge zone, above the answer, wherever it renders.
    const sensitivity = screen.queryByTestId('analysis-new-sensitivity')
    if (sensitivity !== null) {
      expect(challenge).toContainElement(sensitivity)
      expect(precedes(sensitivity, commitment), 'the challenge is read before the answer').toBe(true)
    }
    // V2 prototype (Paul, 25 Sep 2026): no "Focus now" block on this tab. The
    // zones found above are this absence's contrast control.
    expect(screen.queryByTestId('analysis-new-zone-focus-group')).toBeNull()
  })

  /** The fixture `AnalysisNewTabBody.spec.tsx` uses for the strip: a real engine caveat. */
  const warned = () =>
    ({
      ...genuineDecision(),
      confidence: {
        ...genuineDecision().confidence,
        inferenceWarnings: [
          {
            code: 'ROOT_NODE_DEFAULT_VALUE',
            affected_nodes: ['n_alpha'],
            message: "No observed value provided for root node 'n_alpha'; defaulted to 0.0.",
            severity: 'warning',
          },
        ],
      },
    }) as never

  it('PRECONDITION: the warned fixture carries a caveat the strip would render', () => {
    expect(vmOf(warned()).deeper.caveats.length).toBeGreaterThan(0)
  })

  it('no amber caveat box sits above the model; the caveat is listed under About › Limitations', () => {
    renderBody(warned())
    // At rest: no caveat box anywhere on the tab.
    expect(screen.queryByTestId('inference-warning-strip')).toBeNull()
    expect(screen.queryByTestId('critique-warning-strip')).toBeNull()

    // The caveat is not lost: it is one disclosure away, in About's limitations.
    const about = screen.getByTestId('analysis-new-about')
    fireEvent.click(within(about).getByTestId('analysis-new-about-toggle'))
    fireEvent.click(within(about).getByTestId('analysis-new-about-detail-limitations-toggle'))
    const strip = screen.getByTestId('inference-warning-strip')
    expect(within(about).getByTestId('analysis-new-about-detail-limitations-body')).toContainElement(strip)
  })

  it('the qualifier sits under the chart and before "Record your view", on a withheld run', () => {
    const data = decisionWithLeaderWithheldAndReason()
    const expected = buildCommitmentQualifier(vmOf(data))
    expect(expected, 'the withheld fixture must license a qualifier').not.toBeNull()

    renderBody(data)
    const qualifier = screen.getByTestId('analysis-new-commitment-qualifier')
    const options = screen.getByTestId('analysis-new-options')
    expect(qualifier).toHaveTextContent(expected?.text ?? '')
    expect(qualifier.textContent).toMatch(/^Provisional · /)
    expect(precedes(options, qualifier), 'the qualifier follows the chart it qualifies').toBe(true)
    const record = screen.queryByTestId('analysis-new-commitment-record')
    if (record !== null) expect(precedes(qualifier, record), 'and precedes the record row').toBe(true)
  })
})

describe('every clause of the qualifier is a fact the view model already states', () => {
  const base = () => vmOf(decisionWithLeaderWithheldAndReason())

  it('names Olumi\'s estimates only when the run\'s inputs were estimated', () => {
    const vm = base()
    const withEstimates = { ...vm, atAGlance: { ...vm.atAGlance, inputProvenance: 'estimated' as const } }
    const withYours = { ...vm, atAGlance: { ...vm.atAGlance, inputProvenance: 'user_supplied' as const } }
    expect(buildCommitmentQualifier(withEstimates)?.text).toMatch(/Olumi's estimates/)
    expect(buildCommitmentQualifier(withYours)?.text ?? '').not.toMatch(/estimates/)
  })

  it('says robustness is not established only when there is no verdict', () => {
    const vm = base()
    const noVerdict = { ...vm, atAGlance: { ...vm.atAGlance, verdict: null } }
    expect(buildCommitmentQualifier(noVerdict)?.text).toMatch(/robustness not established/)
    if (vm.atAGlance.verdict !== null) {
      expect(buildCommitmentQualifier(vm)?.text ?? '').not.toMatch(/robustness not established/)
    }
  })

  /**
   * ⭐⭐ WAVE 3 (25 Sep 2026): THE ONE-LINE SHAPE — the reason #2025 was
   * blocked. On BASE (before this change) `evidenceNotAssessed` and
   * `robustnessNotEstablished` were always two separate clauses, so a run
   * missing both read "Provisional · evidence not assessed · robustness not
   * established", never the prototype's own witness line. MUTANT: reverting
   * the `if/else if/else if` in `buildCommitmentQualifier` to two independent
   * `if`s (the BASE shape) turns this red, because the combined sentence stops
   * appearing.
   */
  it('combines evidence-not-assessed and robustness-not-established into the prototype\'s one clause', () => {
    const vm = base()
    const both = {
      ...vm,
      atAGlance: { ...vm.atAGlance, inputProvenance: 'user_supplied' as const, verdict: null },
      checks: {
        ...vm.checks,
        items: vm.checks.items.map((i) => (i.id === 'evidence' ? { ...i, code: 'evidence_not_assessed' as const } : i)),
      },
      deeper: { ...vm.deeper, critiques: [], caveats: [] },
    }
    expect(buildCommitmentQualifier(both as never)?.text).toBe('Provisional · evidence and robustness not established')
  })

  it('states only evidence, or only robustness, when just one is true', () => {
    const vm = base()
    const evidenceOnly = {
      ...vm,
      atAGlance: { ...vm.atAGlance, inputProvenance: 'user_supplied' as const, verdict: { label: 'Holds', tone: 'stable' as const } },
      checks: {
        ...vm.checks,
        items: vm.checks.items.map((i) => (i.id === 'evidence' ? { ...i, code: 'evidence_not_assessed' as const } : i)),
      },
      deeper: { ...vm.deeper, critiques: [], caveats: [] },
    }
    expect(buildCommitmentQualifier(evidenceOnly as never)?.text).toBe('Provisional · evidence not assessed')

    const robustnessOnly = {
      ...vm,
      atAGlance: { ...vm.atAGlance, inputProvenance: 'user_supplied' as const, verdict: null },
      checks: {
        ...vm.checks,
        items: vm.checks.items.map((i) => (i.id === 'evidence' ? { ...i, code: 'evidence_none_flagged' as const } : i)),
      },
      deeper: { ...vm.deeper, critiques: [], caveats: [] },
    }
    expect(buildCommitmentQualifier(robustnessOnly as never)?.text).toBe('Provisional · robustness not established')
  })

  it('renders nothing when no clause is licensed', () => {
    const vm = base()
    const settled = {
      ...vm,
      atAGlance: {
        ...vm.atAGlance,
        inputProvenance: 'user_supplied' as const,
        verdict: vm.atAGlance.verdict ?? { label: 'Holds', tone: 'stable' as const },
      },
      checks: {
        ...vm.checks,
        items: vm.checks.items.map((i) => (i.id === 'evidence' ? { ...i, code: 'evidence_none_flagged' as const } : i)),
      },
      deeper: { ...vm.deeper, critiques: [], caveats: [] },
    }
    expect(buildCommitmentQualifier(settled as never)).toBeNull()
  })

  it('counts the engine\'s caveats and points to where they are listed', () => {
    const vm = base()
    const one = { ...vm, deeper: { ...vm.deeper, critiques: [], caveats: [vm.deeper.caveats[0] ?? ({} as never)] } }
    const none = { ...vm, deeper: { ...vm.deeper, critiques: [], caveats: [] } }
    expect(buildCommitmentQualifier(one)?.text).toMatch(/1 caveat in About/)
    expect(buildCommitmentQualifier(none)?.text ?? '').not.toMatch(/caveat/)
  })

  it('renders nothing before a run', () => {
    const vm = base()
    expect(buildCommitmentQualifier({ ...vm, status: { ...vm.status, isPreRun: true } })).toBeNull()
  })
})

/**
 * ⭐ THE TYPED PROVISIONAL MARKER (RC 5818628860; Runtime 5818605567):
 * `analysis_result.enrichment.run_provenance.provisional`. It licenses
 * "Provisional" by itself, so an automatic first run is never unlabelled.
 *
 * ⭐⭐ WAVE 3 (25 Sep 2026): THE WORDS MOVE OFF THE LINE. #2025 was blocked
 * because the composed line could carry five clauses at once, pushing
 * "Record your view" off the first screen on a withheld automatic run — the
 * common case. "automatic first pass" is a fact about the run's OWN
 * provenance mechanics, not what a reader needs at a glance, so it now
 * licenses `detail` — reachable in the one click `CommitmentSummary`'s
 * disclosure toggle offers — rather than joining `text`. MUTANT: pushing
 * `COMMITMENT_QUALIFIER_COPY.automaticFirstPass` into `lineClauses` instead
 * of returning it as `detail` turns every test below red, because "automatic"
 * would reappear in `.text`.
 */
describe('the automatic-first-pass clause', () => {
  const settled = () => {
    const vm = vmOf(decisionWithLeaderWithheldAndReason())
    return {
      ...vm,
      atAGlance: { ...vm.atAGlance, inputProvenance: 'user_supplied' as const, verdict: vm.atAGlance.verdict ?? { label: 'Holds', tone: 'stable' as const } },
      checks: { ...vm.checks, items: vm.checks.items.map((i) => (i.id === 'evidence' ? { ...i, code: 'evidence_none_flagged' as const } : i)) },
      deeper: { ...vm.deeper, critiques: [], caveats: [] },
    } as never
  }

  it('PRECONDITION: with no marker the settled run licenses no line', () => {
    expect(buildCommitmentQualifier(settled())).toBeNull()
  })

  it('the marker alone licenses "Provisional", with the words behind the detail disclosure', () => {
    const q = buildCommitmentQualifier(settled(), { runProvisional: true })
    expect(q?.text).toBe('Provisional')
    expect(q?.detail).toBe('automatic first pass')
  })

  it('on a run that also licenses a visible clause, the marker still never joins the line', () => {
    const full = buildCommitmentQualifier(vmOf(decisionWithLeaderWithheldAndReason()), { runProvisional: true })
    expect(full?.text ?? '').not.toMatch(/automatic/)
    expect(full?.text).toMatch(/^Provisional · /)
    expect(full?.detail).toBe('automatic first pass')
  })

  it('CONTRAST: an explicit or unmarked run has nothing to disclose', () => {
    expect(buildCommitmentQualifier(vmOf(decisionWithLeaderWithheldAndReason()), { runProvisional: false })?.detail).toBeNull()
    expect(buildCommitmentQualifier(vmOf(decisionWithLeaderWithheldAndReason()))?.detail ?? null).toBeNull()
  })

  it('pre-run: nothing, marker or not', () => {
    const vm = vmOf(decisionWithLeaderWithheldAndReason())
    expect(buildCommitmentQualifier({ ...vm, status: { ...vm.status, isPreRun: true } }, { runProvisional: true })).toBeNull()
  })
})

describe('the marker, read from the stored report, reaches the qualifier on the tab — one click away', () => {
  it('a report stamped provisional keeps the line short; "automatic first pass" is behind the toggle', async () => {
    const { useCanvasStore } = await import('../../../../canvas/store')
    const previous = useCanvasStore.getState().results
    useCanvasStore.setState({ results: { ...previous, report: { run_provenance: { initiated_by: 'auto_post_construction', provisional: true } } } } as never)
    try {
      renderBody(decisionWithLeaderWithheldAndReason())
      const qualifier = screen.getByTestId('analysis-new-commitment-qualifier')
      expect(qualifier.textContent ?? '').not.toMatch(/automatic/)
      expect(screen.queryByTestId('analysis-new-commitment-qualifier-detail')).toBeNull()

      const toggle = screen.getByTestId('analysis-new-commitment-qualifier-toggle')
      fireEvent.click(toggle)
      expect(screen.getByTestId('analysis-new-commitment-qualifier-detail').textContent).toMatch(/automatic first pass/)
    } finally {
      useCanvasStore.setState({ results: previous } as never)
    }
  })

  it('CONTRAST: an unstamped report never says "automatic", and offers no toggle', () => {
    renderBody(decisionWithLeaderWithheldAndReason())
    expect(screen.getByTestId('analysis-new-commitment-qualifier').textContent ?? '').not.toMatch(/automatic/)
    expect(screen.queryByTestId('analysis-new-commitment-qualifier-toggle')).toBeNull()
  })
})
