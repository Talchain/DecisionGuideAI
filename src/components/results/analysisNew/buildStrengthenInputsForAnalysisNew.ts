/**
 * Analysis (New) — engine inputs for the "Strengthen the reasoning" section.
 *
 * ⭐⭐ READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * This function is a DELIBERATE MIRROR of the `inputs` useMemo inside
 * `StrengthenContainer` (`../strengthen/StrengthenContainer.tsx`). It exists so
 * the experimental tab can run the SAME grounded engine (`buildRecommendations`)
 * WITHOUT mounting `StrengthenContainer`, because that container is also a
 * WRITER: it calls `useStrengthenStore().reconcile(...)` on every completed
 * analysis. Mounting a second writer for a presentation experiment would give
 * the lifecycle store two owners — and "never let two lanes independently solve
 * the same shared-state problem" is a standing rule here, not a preference.
 *
 * So this surface is READ-ONLY: it runs the engine to get today's grounded
 * recommendation set, and reads the store only to honour what the user already
 * dismissed or addressed. It never writes.
 *
 * ⚠ A HAND-MAINTAINED MIRROR IS THIS ESTATE'S DOMINANT DEFECT (CLAUDE.md trap
 * 12), AND THIS FILE IS ONE. It is permitted only because it FAILS LOUD:
 * `__tests__/strengthenInputsMirror.drift.spec.tsx` renders the real
 * `StrengthenContainer` against a fixture, captures the object it actually
 * hands `buildRecommendations`, and asserts deep equality with this function's
 * output. If the container's mapping changes and this one does not, that spec
 * goes RED and names the diverging key. Do not delete that spec, and do not
 * "fix" a failure by loosening it — re-mirror the change here.
 *
 * The alternative — extracting the container's useMemo into a shared helper —
 * was rejected for THIS experiment only: the brief's hard constraint is that no
 * edit may alter the existing Analysis tab, and a behaviour-preserving
 * extraction is still an edit to a file that tab renders. When the experiment
 * concludes, extract and delete this file.
 */

import { resolveFactorConfidenceDisplay } from '../driverConfidenceDisplayPolicy'
import { leaderDesignationPermitted } from '../leaderDesignation'
import { analysisClaimPolicy } from '../analysisClaimPolicy'
import { adaptivePriorityFromStage } from '../strengthen/StrengthenContainer'
import { toStrengthenPhase3Item } from '../strengthen/buildRecommendations'
import { mergeBiasFindingTypes } from '../strengthen/biasTypesFromGuidance'
import type { StrengthenInputs } from '../strengthen/strengthenTypes'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { GuidanceItem } from '../../../canvas/stores/guidanceStore'
import type { ScenarioStage } from '../../../types/scenario'
import { rangeIsSettableForFactor } from '../strengthen/factorRangeCapability'
import { materialParametersAwaitingUserIds } from './materialParametersAwaitingUser'

export interface StrengthenInputSources {
  data: ResultsSectionDataReturn
  guidanceItems: GuidanceItem[]
  /** CEE draft-coaching bias signals. Producer-owned; never locally derived. */
  biasSignals: Array<{ type: string }> | null
  currentStage: ScenarioStage | null
  /**
   * `useAnalysisResultsAreCurrent()` — may a row claim this result is about the
   * graph in front of the reader? Threaded rather than read here because this
   * builder is pure and the authority is a store-reading hook.
   *
   * ⚠ OPTIONAL AND FAIL-CLOSED. A caller that does not supply it gets `false`,
   * which suppresses the one row that depends on it. The opposite default would
   * let a fixture or a legacy call site license a claim about a graph nobody
   * checked.
   */
  analysisIdentityIsCurrent?: boolean
}

export function buildStrengthenInputsForAnalysisNew({
  data,
  guidanceItems,
  biasSignals,
  currentStage,
  analysisIdentityIsCurrent,
}: StrengthenInputSources): StrengthenInputs {
  const fragile = (data.confidence.challengeFragileEdges ?? []) as Array<Record<string, unknown>>
  const phase3Items = guidanceItems.map(toStrengthenPhase3Item)
  return {
    goalThreshold: data.recommendation.goalThreshold ?? null,
    hasStatedGoalTarget: data.recommendation.hasGoalTarget,
    analysisComplete: data.recommendation.analysisStatus === 'computed',
    // CEE's own blocking set, read through the ONE structural reader of an
    // untyped wire field. Mirrored verbatim in `StrengthenContainer.tsx`.
    materialParametersAwaitingUserIds: materialParametersAwaitingUserIds(data.recommendation.analysisAdmission),
    analysisIdentityIsCurrent: analysisIdentityIsCurrent === true,
    // The OWNED leader entitlement, quoted from the single verdict and never
    // re-derived. A completed analysis is not an entitlement to name a leader.
    // ⚠ THE COMPOSED ANSWER, matching `StrengthenContainer` exactly. Passing raw
    // Q2 here made Analysis (New) invite the user to CHALLENGE THE LEADER on a
    // run where the producer refuses to name one, while the Analysis tab
    // suppressed the same invitation — the harm `buildRecommendations.ts:220-231`
    // documents, reached through a mirror that was faithful about every key
    // except this one.
    hasLeadingOption: leaderDesignationPermitted(data.recommendation),
    stabilityLicensed: analysisClaimPolicy(data.recommendation).mayStateStability,
    // ⭐ IDENTITY, BESIDE THE PERMISSION ABOVE — two questions, two fields. The
    // line above says the panel MAY designate; this says what the designated
    // option is CALLED, so a permitted trigger can name it instead of writing
    // its subject as a rank position ("the option that scored highest").
    //
    // ⚠ THE SAME OPTION THE GLANCE ALREADY NAMES. `buildAtAGlance` renders
    // `` `${leader.label} currently scores higher` `` from
    // `rec.recommendedOption` under this same gate, so the two sentences on
    // this tab cannot end up pressure-testing and designating different
    // options. The engine trims and treats empty as absent.
    leadingOptionLabel: data.recommendation.recommendedOption?.label ?? null,
    flipThresholds: data.recommendation.flipThresholds ?? null,
    fragileEdges: fragile
      .filter((fe) => typeof fe.switch_probability === 'number')
      .map((fe) => ({
        edgeId: String(fe.edge_id ?? `${fe.from_id ?? fe.from_label}->${fe.to_label}`),
        factorLabel: String(fe.from_label ?? 'this factor'),
        switchProbability: Number(fe.switch_probability),
        alternativeWinnerLabel:
          typeof fe.alternative_winner_label === 'string' ? fe.alternative_winner_label : undefined,
      })),
    // ⭐ ONE DRIVER AUTHORITY: the card's Driver 1, quoted from the view-model.
    // ⚠ MIRRORED in the sibling builder; `strengthenInputsMirror.drift.spec.tsx`.
    driverLeader: data.drivers.driverLeader,
    factors: data.drivers.drivers.map((d) => ({
      factorId: d.matchedNodeId ?? d.factorKey,
      label: d.factorLabel,
      // ⭐ WHETHER THE ACT EXISTS, asked through the ONE owner of that question
      // (`strengthen/factorRangeCapability.ts`). Read NON-REACTIVELY and from the
      // same store at the same instant as its mirror, so the two builders cannot
      // disagree — which is the divergence `strengthenInputsMirror.drift.spec.tsx`
      // exists to catch. A subscription here would re-render this panel on every
      // node drag to track a field that moves only on a structural graph edit.
      rangeIsSettable: rangeIsSettableForFactor(d.matchedNodeId ?? d.factorKey),
      /**
       * ⛔⛔ THE `?? d.influenceScore` TAIL IS GONE, AND IT WAS THE BANNED
       * PATTERN NAMED VERBATIM IN THE CONTRACT.
       *
       * Found by an independent reviewer (Canvas lane, 21 Sep) against #1795 at
       * `6b149be5`, and confirmed at the bytes rather than accepted: `types.ts`
       * (quoted in `buildAnalysisNewViewModel.ts:533`) says *"Consumers must
       * render/sort this, NOT `influenceScore ?? normalisedInfluence`, which
       * mixes bases under partial producer coverage."* This line was that
       * expression, one identifier apart.
       *
       * ⚠ WHY IT MATTERED EVEN THOUGH IT NEVER FIRED. Both bases are
       * set-relative normalisations whose top row is 1.0 by construction, so
       * they agree on SCALE and differ on QUANTITY — the producer's structural
       * score versus this app's normalisation of the magnitude chain. Sorting
       * across the two ranks unlike things while looking entirely plausible,
       * which is why no fixture caught it.
       *
       * ⚠ AND IT CONTRADICTED THIS PR'S OWN ARGUMENT. `nextInputToSet.ts` is
       * built on "ONE RANK AUTHORITY, NOT TWO" and refuses the wire's
       * `influence_rank` for exactly that reason. Reaching for the raw producer
       * metric here was the second authority arriving through the back door of
       * a `??`, inside the change that forbids it.
       *
       * ⭐ FAIL CLOSED, WHICH IS WHAT THE SIBLING ALREADY DOES. The view model
       * uses `displayInfluence` or nothing (`:553`, `:721`), and its own comment
       * rules: *"Absent, the honest render is no number."* An undefined
       * influence here flows to `selectNextInputToSet`, whose
       * `determinedRankDepth` withholds rather than guessing — so the row goes
       * quiet instead of naming a factor ranked on a different basis.
       *
       * ⚠ Reachability NOT claimed either way. The pipeline comment says
       * `displayInfluence` is always set live and the chain existed for legacy
       * fixtures. A debug bundle cannot settle it — `displayInfluence` is
       * computed in this app and appears on no wire, so a capture sweep reads
       * zero for the wrong reason (measured: 0 of 500 runs, with no contrast
       * control available). The fix is warranted by the CONTRACT, not by a
       * frequency.
       */
      influence: d.displayInfluence,
      // Resolved through THE policy module — the engine never sees the raw
      // producer number.
      confidenceDisplay: resolveFactorConfidenceDisplay({
        confidence: d.confidence,
        isDefaulted: d.isDefaultedConfidence,
        confidenceProvenance: d.confidenceProvenance,
      }),
      worthInvestigating: d.worthInvestigating === true,
      canFocus: d.canFocus,
    })),
    robustness: {
      status: data.confidence.robustnessStatus ?? null,
      level: data.confidence.robustnessLevel ?? null,
    },
    // Producer-owned bias findings only — never local option counting.
    // ⭐ THE UNION OF BOTH PRODUCER CHANNELS. Measured on deployed `cffe418d`:
    // `draftCoaching` is NULL on the re-draft path, so this list was empty and
    // the one CREATIVE trigger could not fire — while the producer's own
    // "Narrow framing" card sat in the phase-3 channel, rendered as a row.
    // See `biasTypesFromGuidance.ts`.
    biasFindingTypes: mergeBiasFindingTypes(biasSignals, phase3Items),
    adaptivePriority: adaptivePriorityFromStage(currentStage),
    phase3Items,
  }
}
