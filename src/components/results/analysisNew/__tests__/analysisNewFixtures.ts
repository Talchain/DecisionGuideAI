/**
 * Analysis (New) — fixtures for the three scenario CLASSES the experiment must
 * behave correctly across (brief §24F).
 *
 *   1. OPEN STRATEGIC CHALLENGE — no decision exists. The surface must not
 *      manufacture a winner or an option frame.
 *   2. GENUINE DECISION — a leader the single verdict entitles naming.
 *      Comparative material may appear, phrased as "currently scores higher".
 *   3. HIGH UNCERTAINTY — uncertainty becomes prominent WITHOUT the surface
 *      falsely blocking the analysis or equating coverage with readiness.
 *
 * ⚠ THESE ARE HAND-BUILT AND THAT IS A KNOWN LIMIT (CLAUDE.md trap 22): a
 * corpus from the author's head cannot see the class the author did not
 * imagine. They are therefore used to pin SEMANTIC RULES that are checkable
 * from the producer's own declared field semantics (leader entitlement,
 * absence-is-not-zero, set-relative influence, assessed-vs-unassessed), NOT to
 * certify that the IA is right. The IA question is what Paul's side-by-side
 * comparison answers, and no fixture can stand in for it.
 */

import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriverItem,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../../types'
import type { ResultCompleteness } from '../../useResultCompleteness'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

export function makeOption(
  overrides: Partial<OptionResult> & { id: string; label: string },
): OptionResult {
  return {
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    ...overrides,
  } as OptionResult
}

export function makeDriver(overrides: Partial<DriverItem> & { factorKey: string; factorLabel: string }): DriverItem {
  return {
    rawElasticity: 0.4,
    normalisedInfluence: 0.6,
    rank: 1,
    semanticLabel: 'primary',
    canFocus: true,
    displayInfluence: 0.6,
    displayProvenance: 'influence_score',
    ...overrides,
  } as DriverItem
}

const EMPTY_COMPLETENESS: ResultCompleteness = { status: 'full', missing: [], reasons: [] }

export interface MakeDataOptions {
  recommendation?: Partial<DecisionResultData>
  drivers?: Partial<DriversSectionData>
  confidence?: Partial<ConfidenceSectionData>
  completeness?: ResultCompleteness
  decisionVoi?: ResultsSectionDataReturn['decisionVoi']
  sensitivityReference?: ResultsSectionDataReturn['sensitivityReference']
  voiRanking?: ResultsSectionDataReturn['voiRanking']
  /**
   * ⚠ ADDED BECAUSE ITS ABSENCE WAS A SILENT NO-OP. `assumedStrength` was
   * hardcoded to `selected: null` below and had no key here, so a test passing
   * an override got no error and no effect — the extra property was simply
   * dropped. A fixture that ignores what it is handed cannot fail a build that
   * ignores the same thing.
   */
  assumedStrength?: ResultsSectionDataReturn['assumedStrength']
}

export function makeData(opts: MakeDataOptions = {}): ResultsSectionDataReturn {
  const recommendation: DecisionResultData = {
    recommendedOption: null,
    allOptions: [],
    goalLabel: 'Sustained margin',
    isSingleOption: false,
    analysisStatus: 'computed',
    ...opts.recommendation,
  } as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [],
    driversStatus: 'computed',
    topDrivers: [],
    totalCount: 0,
    hasMagnitudeData: true,
    ...opts.drivers,
  } as DriversSectionData

  const confidence: ConfidenceSectionData = {
    // The vocabulary is strong | fair | needs_work | unknown — not a
    // high/medium/low scale. Using an invented token here would have made every
    // case below assert against a tier the producer can never send.
    tier: { tier: 'fair', icon: '', label: 'Fair', description: '' },
    qualityScore: 60,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    ...opts.confidence,
  } as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: recommendation.goalLabel,
    completeness: opts.completeness ?? EMPTY_COMPLETENESS,
    autoNoiseProvenance: null,
    sensitivityReference: opts.sensitivityReference ?? null,
    voiRanking: opts.voiRanking ?? null,
    decisionVoi: opts.decisionVoi ?? 'not_computed',
    assumedStrength: opts.assumedStrength ?? { selected: null, refusalReason: null, assumedFragileCount: 0 },
  } as ResultsSectionDataReturn
}

// ── 1. OPEN STRATEGIC CHALLENGE ─────────────────────────────────────────────
// No options, no leader, no verdict entitlement. A well-analysed problem that
// simply is not a decision.
export function openStrategicChallenge(): ResultsSectionDataReturn {
  return makeData({
    recommendation: {
      allOptions: [],
      recommendedOption: null,
      isSingleOption: true,
      // No `verdict` at all — the producer never named one.
      robustnessVerdict: 'fragile',
      robustnessVerdictReason:
        'Small changes in supplier lead time change which direction looks better.',
      dominantFactorId: 'f_leadtime',
      dominantFactorLabel: 'Supplier lead time',
    },
    drivers: {
      drivers: [
        makeDriver({ factorKey: 'f_leadtime', factorLabel: 'Supplier lead time', direction: 'negative' }),
        makeDriver({ factorKey: 'f_demand', factorLabel: 'Demand volatility', rank: 2, displayInfluence: 0.35, direction: 'mixed' }),
      ],
    },
    confidence: { evidenceGapsAssessed: true, robustnessStatus: 'computed' },
  })
}

// ── 2. GENUINE DECISION ─────────────────────────────────────────────────────
export function genuineDecision(): ResultsSectionDataReturn {
  const a = makeOption({ id: 'opt_a', label: 'Hold price', winProbability: 0.31 })
  const b = makeOption({ id: 'opt_b', label: 'Raise price', isRecommended: true, winProbability: 0.69 })
  return makeData({
    recommendation: {
      allOptions: [a, b],
      recommendedOption: b,
      isSingleOption: false,
      winProbability: 0.69,
      determinedBy: 'win_probability',
      // The ONE boolean that entitles naming a leader.
      verdict: { leaderId: 'opt_b', hasLeadingOption: true } as DecisionResultData['verdict'],
      robustnessVerdict: 'robust',
      robustnessVerdictReason: 'The ordering held across the simulated range.',
    },
    drivers: {
      drivers: [makeDriver({ factorKey: 'f_elasticity', factorLabel: 'Price elasticity', direction: 'negative' })],
    },
    confidence: { evidenceGapsAssessed: true },
  })
}

/** The same decision, but the producer WITHHELD the leader entitlement. */
export function decisionWithLeaderWithheld(): ResultsSectionDataReturn {
  const data = genuineDecision()
  return {
    ...data,
    recommendation: {
      ...data.recommendation,
      verdict: { leaderId: 'opt_b', hasLeadingOption: false } as DecisionResultData['verdict'],
    },
  }
}

// ── 3. HIGH UNCERTAINTY ─────────────────────────────────────────────────────
// Consequential uncertainty everywhere, incomplete coverage — and STILL a valid
// analysis. Nothing here may read as "the analysis is blocked".
export function highUncertainty(): ResultsSectionDataReturn {
  return makeData({
    recommendation: {
      analysisStatus: 'partial',
      statusReason: 'Two factors could not be sampled to the requested precision.',
      robustnessVerdict: 'fragile',
      robustnessVerdictReason: 'The ordering changed in a substantial share of the simulated range.',
    },
    drivers: {
      drivers: [
        // Set-relative basis — the caveat must fire.
        makeDriver({
          factorKey: 'f_adopt',
          factorLabel: 'Customer adoption',
          displayProvenance: 'normalised_elasticity',
          isDefaultedConfidence: true,
          confidence: 0.25,
          direction: 'positive',
        }),
      ],
    },
    confidence: {
      // Producer NEVER assessed evidence on this run — distinct from "assessed,
      // none found". The empty-state copy must differ.
      evidenceGapsAssessed: false,
      evidenceGaps: [],
      uncertainties: [
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'RAW_TOKEN_SHOULD_NOT_RENDER',
          userMessage: 'Customer adoption is the assumption the result is most sensitive to.',
          displayText: 'Customer adoption is the assumption the result is most sensitive to.',
          suggestion: 'Test the adoption assumption before committing.',
          severity: 'critical',
          affectedNodes: ['f_adopt'],
          eValue: 1.8,
        },
      ],
      robustnessStatus: 'computed',
    },
    completeness: { status: 'partial', missing: ['robustness'], reasons: [] } as unknown as ResultCompleteness,
    decisionVoi: 'measured_non_zero',
  })
}

/** Evidence gaps present, but with a NULL confidence — absence, not zero. */
export function evidenceGapWithNullConfidence(): ResultsSectionDataReturn {
  return makeData({
    confidence: {
      evidenceGapsAssessed: true,
      evidenceGaps: [
        {
          factorId: 'f_churn',
          factorLabel: 'Churn rate',
          confidence: null,
          voi: null,
          suggestion: 'Pull the last four quarters of churn before relying on this.',
        },
      ],
    },
  })
}

// ── 4. MANY FRAGILE EDGES ───────────────────────────────────────────────────
/**
 * ⭐ THE CLASS THE REST OF THIS CORPUS COULD NOT EXPRESS, AND IT IS THE COMMON
 * CASE, NOT AN EDGE CASE.
 *
 * Every other fixture here carries AT MOST ONE uncertainty, so two defects were
 * structurally invisible to 147 passing tests (CLAUDE.md trap 22 — a corpus that
 * omits a value class the contract admits cannot certify the code over it).
 *
 * ⚠ THE SHAPE IS DERIVED FROM THE PRODUCER, NOT INVENTED.
 * `useResultsSectionData.ts:3197` pushes a row per DEDUPED FRAGILE EDGE inside a
 * `forEach`, and every one carries the LITERAL `code: 'SENSITIVE_ASSUMPTION'`
 * and the LITERAL constant `suggestion: 'Review this assumption'`. So on any run
 * with several fragile edges the producer emits N rows sharing one code and one
 * suggestion. Measured on the deployed build at `a9fc1564` (guest run, 3-option
 * 3PL fulfilment brief): SIX uncertainty rows, THREE of them
 * `uncertainty:SENSITIVE_ASSUMPTION`.
 *
 * The three texts below are the real ones from that capture, kept verbatim
 * because their LENGTH is the point — each exceeds the 80-character headline cut
 * and each cuts before its verb.
 */
export function manyFragileEdges(): ResultsSectionDataReturn {
  const sensitive = (from: string, to: string) => ({
    code: 'SENSITIVE_ASSUMPTION',
    message: `If "${from} → ${to}" changes significantly, the comparison could land differently.`,
    displayText: `If "${from} → ${to}" changes significantly, the comparison could land differently.`,
    // ⚠ THE CONSTANT. The producer sends this same remedy on every row, so
    // `implication` never carries the sentence — which is what makes a headline
    // cut unrecoverable anywhere on the page.
    suggestion: 'Review this assumption',
    affectedNodes: [from, to],
    severity: 'warning' as const,
    eValue: 1.4,
  })

  return makeData({
    recommendation: {
      robustnessVerdict: 'fragile',
      robustnessVerdictReason:
        'none of the factors we could test changed which option leads on its own, but this result scored low on our other robustness checks',
    },
    drivers: {
      drivers: [
        makeDriver({ factorKey: 'f_volatility', factorLabel: 'Peak Season Demand Volatility', direction: 'negative' }),
        // ⚠ NO `displayInfluence`. `types.ts` says the live pipeline always
        // sets it and that consumers must NOT fall back to
        // `influenceScore ?? normalisedInfluence`, which mixes an absolute
        // producer scale with a set-relative one. Present so the fail-weakly
        // path is exercised rather than assumed.
        makeDriver({
          factorKey: 'f_nobasis',
          factorLabel: 'Factor with no comparable basis',
          rank: 2,
          direction: 'positive',
          displayInfluence: undefined,
          displayProvenance: undefined,
        }),
      ],
    },
    confidence: {
      evidenceGapsAssessed: true,
      robustnessStatus: 'computed',
      uncertainties: [
        sensitive('Peak Season Throughput', 'getting through peak season without dropping below our 95 percent accuracy commitment, at lower cost'),
        sensitive('Peak Fulfilment Capacity', 'Peak Season Throughput'),
        sensitive('Cost Savings Achieved', 'getting through peak season without dropping below our 95 percent accuracy commitment, at lower cost'),
      ],
      // ⚠ TWO ASSUMPTIONS ABOUT ONE TARGET. The producer's `target` is a node
      // reference, not a row key, so nothing stops it repeating — and an id of
      // `assumption:${a.target}` collapses them. Present so the fix is PINNED
      // rather than merely plausible.
      assumptions: [
        { target: 'f_volatility', message: 'Demand volatility is modelled as stationary across the season.', severity: 'medium' as const },
        { target: 'f_volatility', message: 'Volatility is assumed independent of fulfilment capacity.', severity: 'medium' as const },
      ],
      // Distinct codes on the real capture, IDENTICAL headline — but nothing in
      // the contract requires the codes to differ, and every one of these rows
      // renders the SAME headline, so a collision would be invisible on screen.
      // The repeated code is deliberate for that reason.
      inferenceWarnings: [
        { code: 'EDGE_E_VALUE_NON_FINITE_DROPPED', affected_nodes: [], message: '2 edge E-value entries were omitted from edge_e_values.' },
        { code: 'ROOT_NODE_DEFAULT_VALUE', affected_nodes: ['e4ec3415'], message: "No observed value provided for root node 'e4ec3415'; defaulted to 0.0." },
        { code: 'ROOT_NODE_DEFAULT_VALUE', affected_nodes: ['b71c02aa'], message: "No observed value provided for root node 'b71c02aa'; defaulted to 0.0." },
      ],
    } as Partial<ConfidenceSectionData>,
  })
}

/**
 * ⭐ EVERY FINDING BUILT FROM A PRODUCER UNCERTAINTY ROW, whichever section it
 * lands in.
 *
 * ⚠ WHY THIS EXISTS RATHER THAN `vm.uncertainty.findings`. The
 * `SENSITIVE_ASSUMPTION` rows now build into `vm.sensitivity` ("What would
 * change your mind"); the rest stay in `vm.uncertainty`. Almost every existing
 * assertion about these rows is about HOW THE ROW IS CONSTRUCTED — its id is
 * unique, its prose is not cut, its headline is not its body — and none of
 * those claims is about which section it ended up in. Reading one array would
 * silently narrow each of them to whichever half survived the split, which is
 * the "guard watching one door" shape this estate keeps paying for.
 *
 * A test that IS about the split reads the two arrays apart, deliberately —
 * see `whatWouldChangeYourMind.spec.ts`.
 */
export const uncertaintyDerivedFindings = (vm: {
  uncertainty: { findings: ReadonlyArray<unknown> }
  sensitivity: { findings: ReadonlyArray<unknown> }
}) => [...vm.sensitivity.findings, ...vm.uncertainty.findings] as never[]
