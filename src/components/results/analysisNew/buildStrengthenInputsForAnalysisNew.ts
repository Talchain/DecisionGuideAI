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
import { adaptivePriorityFromStage } from '../strengthen/StrengthenContainer'
import { toStrengthenPhase3Item } from '../strengthen/buildRecommendations'
import { mergeBiasFindingTypes } from '../strengthen/biasTypesFromGuidance'
import type { StrengthenInputs } from '../strengthen/strengthenTypes'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { GuidanceItem } from '../../../canvas/stores/guidanceStore'
import type { ScenarioStage } from '../../../types/scenario'

export interface StrengthenInputSources {
  data: ResultsSectionDataReturn
  guidanceItems: GuidanceItem[]
  /** CEE draft-coaching bias signals. Producer-owned; never locally derived. */
  biasSignals: Array<{ type: string }> | null
  currentStage: ScenarioStage | null
}

export function buildStrengthenInputsForAnalysisNew({
  data,
  guidanceItems,
  biasSignals,
  currentStage,
}: StrengthenInputSources): StrengthenInputs {
  const fragile = (data.confidence.challengeFragileEdges ?? []) as Array<Record<string, unknown>>
  const phase3Items = guidanceItems.map(toStrengthenPhase3Item)
  return {
    goalThreshold: data.recommendation.goalThreshold ?? null,
    hasStatedGoalTarget: data.recommendation.hasGoalTarget,
    analysisComplete: data.recommendation.analysisStatus === 'computed',
    // The OWNED leader entitlement, read through THE one reader
    // (`leaderDesignationPermitted`) exactly as `StrengthenContainer:114` does.
    // `verdict.hasLeadingOption` is Q2 ALONE; this needs the COMPOSED answer,
    // or this tab invites the user to challenge a leader the Analysis tab has
    // withheld. A completed analysis is not an entitlement to name a leader.
    hasLeadingOption: leaderDesignationPermitted(data.recommendation),
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
    factors: data.drivers.drivers.map((d) => ({
      factorId: d.matchedNodeId ?? d.factorKey,
      label: d.factorLabel,
      // The engine ranks on the SAME display value the bars show.
      influence: d.displayInfluence ?? d.influenceScore,
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
