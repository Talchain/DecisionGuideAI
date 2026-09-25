/**
 * Analysis (New) — the store-aware hook that assembles the view model.
 *
 * ⭐⭐ THIS HOOK IS READ-ONLY, AND THAT IS THE LOAD-BEARING PROPERTY OF THE
 * WHOLE EXPERIMENT. It performs NO writes: no store mutation, no fetch, no
 * dispatch, no reconcile. Switching to the Analysis (New) tab must not re-run
 * analysis, create a second result, change canonical state, change readiness or
 * change staleness — otherwise the two tabs are not a presentation comparison,
 * they are an A/B test on different data, and Paul's comparison is void.
 *
 * ⚠ IT DOES NOT CALL `useResultsSectionData()` EITHER. The analysis data
 * arrives as a PROP, so the new tab renders the SAME instance `OutputsDock`
 * already hands `ResultsBody` — one data authority for both surfaces, exactly
 * as the 'Alt view' comparison tab did (PR #673). Calling the hook again here
 * would be a second derivation of the same thing and would silently reopen the
 * "are they even looking at the same run?" question this experiment exists to
 * close.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { deriveGuidanceDskProvenance, useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { useStrengthenStore, recordKey} from '../../../canvas/stores/strengthenStore'
import { buildNodeValueSourceMap } from '../driverValueProvenance'
import { buildNodeOriginMap } from './optionOriginDisclosure'
import { buildRecommendations } from '../strengthen/buildRecommendations'
import type { Recommendation } from '../strengthen/strengthenTypes'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { buildStrengthenInputsForAnalysisNew } from './buildStrengthenInputsForAnalysisNew'
import { useAnalysisResultsAreCurrent } from '../../../canvas/hooks/useAnalysisResultsAreCurrent'
import { buildAnalysisNewViewModel } from './buildAnalysisNewViewModel'
import { buildRunDeltaView } from './runDeltaView'
import { runDeltaDescribesDisplayedAnalysis } from '../../../canvas/state/storedRunDelta'
import type { AnalysisNewViewModel } from './analysisNewTypes'
import { readProducerLeaderPermission } from '../../../lib/decisionVerdict'

/**
 * Lifecycle statuses that REMOVE a recommendation from the live list.
 *
 * Read-only reuse of the shared strengthen store: if the user dismissed or
 * completed something on the existing Analysis tab, it must not reappear here.
 * The two surfaces disagreeing about what is still outstanding would be a worse
 * defect than the new tab showing nothing.
 */
const RETIRED_STATUSES = new Set(['dismissed', 'addressed'])

/**
 * The producer's own withhold cause, as carried ON THE DISPLAYED RESULT, or null.
 *
 * ⭐ THE RULE, IN ORDER:
 *  1. The report's stamp must be an explicit refusal —
 *     `readProducerLeaderPermission(stamp) === false`, the module's one sanctioned
 *     reader (strict boolean; a malformed or absent stamp is "not spoken").
 *  2. Its `producer_cause` must be a non-empty string; it is returned trimmed,
 *     verbatim. `leaderWithholdCause` in the builder remains the ONE place that
 *     decides whether a token can be stated.
 *  3. Anything else → null. Nothing is inferred.
 *
 * ⛔ NEVER FROM `withheld_reason` ON THE STAMP. That is this UI's collapsed
 * two-value enum (`'leader_claim_withheld' | 'analysis_unusable'`); reading it
 * as a cause would turn every generic refusal into a named one.
 *
 * ⛔ AND NO FALLBACK TO THE LIVE `analysisStateV1`. #1921 gives the envelope no
 * binding to a held result other than its own writer: all three legs that set a
 * withheld envelope (turn `applyV5State`, poll `applyScenarioAnalysisRead`, boot
 * `serverGraphHydration` → `applyBootLeaderClaimWithholding`) stamp that same
 * cause onto the held report in the same synchronous step. So a live cause that
 * belongs to the displayed result is ALREADY here, and a live cause that is NOT
 * here belongs to no held result, or to a different one — using it would let a
 * stale envelope qualify shares it never described. This is also exactly what
 * the canvas option card does (`OptionNode.tsx`, `shareIsGoalOnly`), so the two
 * surfaces cannot disagree about the same result.
 */
function resultBoundLeaderWithholdCause(stamp: unknown): string | null {
  if (readProducerLeaderPermission(stamp) !== false) return null
  const cause = (stamp as { producer_cause?: unknown }).producer_cause
  if (typeof cause !== 'string') return null
  const token = cause.trim()
  return token === '' ? null : token
}

export interface UseAnalysisNewViewModelArgs {
  /** THE SAME instance OutputsDock hands ResultsBody. Never re-derived. */
  data: ResultsSectionDataReturn
  isPreRun: boolean
  isRunning: boolean
  isStale: boolean
  staleReason?: 'changed' | 'unconfirmed' | null
  nSamples?: number
  seedUsed?: number | string
  responseHash?: string
}

export function useAnalysisNewViewModel(args: UseAnalysisNewViewModelArgs): AnalysisNewViewModel {
  const { data, isPreRun, isRunning, isStale, staleReason, nSamples, seedUsed, responseHash } = args

  // ── reads only ────────────────────────────────────────────────────────────
  const currentStage = useCanvasStore((s) => s.currentStage)
  /**
   * ⭐ AUTHORSHIP, AND IT IS A READ LIKE EVERY OTHER READ HERE. The node's
   * `observed_state.source` is the only field that says who put a value on a
   * factor, and it lives in canvas state — the analysis result does not carry
   * it. The hero's hook derives the identical map from the identical store
   * slice via the identical helper, so the two surfaces cannot disagree about
   * whose number a factor holds.
   */
  const nodes = useCanvasStore((s) => s.nodes)
  const nodeValueSources = useMemo(() => buildNodeValueSourceMap(nodes), [nodes])
  /**
   * ⭐ WHOSE IDEA EACH ELEMENT WAS — the SAME `nodes` slice, a DIFFERENT field.
   * `buildNodeValueSourceMap` reads `observed_state.source` (who authored a
   * NUMBER); this reads `provenance` (who put the ELEMENT on the board). The
   * analysis result carries neither, so both must come from canvas state, and
   * deriving them from one subscription is what stops this surface and the
   * canvas card disagreeing about the same node.
   */
  const nodeOrigins = useMemo(() => buildNodeOriginMap(nodes), [nodes])
  /**
   * ⭐ Node id → label, so a producer gap can name the factor it is about.
   * Derived from the same `nodes` the sibling map above uses — one store read,
   * not a second subscription. Labels only; nothing else about a node is read.
   */
  const nodeLabels = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of nodes ?? []) {
      const label = (n?.data as { label?: unknown } | undefined)?.label
      if (typeof label === 'string' && label.trim().length > 0) m.set(n.id, label)
    }
    return m
  }, [nodes])
  const biasSignals = useCanvasStore((s) => s.draftCoaching?.biasSignals ?? null)
  const guidanceItems = useGuidanceStore((s) => s.guidanceItems)
  const strengthenRecords = useStrengthenStore((s) => s.records)
  /* ⚠⚠ REQUIRED BY THE FILTER BELOW, AND ITS ABSENCE WAS THE WORST OF THREE
     BARE-ID READS. Records are keyed by (decision, finding); indexing by the
     finding alone compiles, returns `undefined` for EVERY record, and makes
     `!record` unconditionally true — so nothing is ever filtered and findings
     the reader had already addressed or set aside REAPPEAR in the active list.
     A silent, user-visible regression with no red anywhere; found by the
     derived sweep in `oneRecordKeyPerRead.spec.ts`, not by reading the code. */
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)

  /**
   * ⭐⭐ THE PRODUCER'S REASON FOR WITHHOLDING THE LEADING OPTION, read off the
   * RESULT it qualifies — `results.report.producer_leader_permission.producer_cause`
   * (#1921), the same carrier the canvas option card reads.
   *
   * ⛔ NOT THE SESSION-LOCAL ENVELOPE ANY MORE (Codex pre-read on #1922,
   * 5804383098). This used to read `analysisStateV1.leader_claim.withheld_reason`,
   * which is never persisted (`store.ts`, the field's doc) and is cleared by any
   * later turn that omits `analysis_state` (`applyV5State.ts`, step 4). The
   * saved comparison's shares then came back after a reload, or after an
   * ordinary follow-up turn, without the "Goal only" qualification that belongs
   * to them. The cause now travels WITH the result through the existing
   * report → autosave → restore path.
   *
   * ⭐ PRECEDENCE — ONE AUTHORITY, NO FALLBACK. See `resultBoundLeaderWithholdCause`
   * (top of this module) for the rule and why the live envelope is never consulted.
   *
   * ⚠ NOT A SECOND WITHHOLD AUTHORITY. Whether the leader IS withheld stays
   * `buildChecks`' own `leaderCode`, derived exactly as before. This supplies a
   * REASON and never a verdict, so the two cannot disagree about whether a
   * refusal happened.
   *
   * Subscribed as a primitive string so the panel cannot re-render on every
   * report identity change, and so the memo below can list it (it does).
   */
  /** CEE's typed run provenance on the stored report; a primitive, like the stamp below. */
  const runProvisional = useCanvasStore(
    (s) =>
      (s.results?.report as { run_provenance?: { provisional?: unknown } } | null | undefined)?.run_provenance
        ?.provisional === true,
  )
  /** The model carries a limit: the slice a run sends to PLoT. Licenses "the limits you set". */
  const modelHasLimits = useCanvasStore((s) => (s.goalConstraints?.length ?? 0) > 0)
  const producerLeaderWithholdReason = useCanvasStore((s) =>
    // `results` itself can be null (no analysis yet): that is the no-cause path,
    // never a crash (Codex pre-read on #1924, shard 4: 13 mounts threw).
    resultBoundLeaderWithholdCause(s.results?.report?.producer_leader_permission),
  )

  /**
   * ⭐ THE RUN-OVER-RUN CONSEQUENCE, GATED ON BEING ABOUT *THIS* ANALYSIS.
   *
   * `responseHash` is `results?.hash` — the same value `resultsComplete` records
   * and the same one the applicator stamped onto the stored delta. Comparing
   * them is how a delta about a superseded run, or about another scenario,
   * becomes invisible rather than merely unlikely. Fail-closed: any absence on
   * either side renders nothing.
   */
  const storedRunDelta = useCanvasStore((s) => s.runDelta)
  const whatsChanged = useMemo(() => {
    if (!runDeltaDescribesDisplayedAnalysis(storedRunDelta, responseHash, currentScenarioId)) return null
    // Labels come from the SAME node map the rest of this surface uses, so the
    // section cannot call an option something the tab above it does not.
    return buildRunDeltaView(storedRunDelta!.delta, (id) => nodeLabels.get(id) ?? null)
  }, [storedRunDelta, responseHash, currentScenarioId, nodeLabels])

  const analysisIdentityIsCurrent = useAnalysisResultsAreCurrent()

  const recommendations: Recommendation[] = useMemo(() => {
    const inputs = buildStrengthenInputsForAnalysisNew({
      data,
      guidanceItems,
      biasSignals,
      currentStage,
      // ⚠ ONE IDENTITY, OR THE ROW NAMES A PARAMETER FROM A GRAPH THAT MOVED.
      // `invalidateAnalysisReady` clears the admission on every analytical edit
      // and the reader falls back to a RETAINED one, so the blocking set and
      // the influence order can arrive from two different graphs and look like
      // one answer.
      analysisIdentityIsCurrent,
    })
    // The engine is the authority on what a grounded intervention is. This
    // surface runs it and renders it; it never adds one of its own, and it
    // never relaxes one of the engine's gates.
    return buildRecommendations(inputs).filter((rec) => {
      const record = strengthenRecords[recordKey(currentScenarioId, rec.id)]
      return !record || !RETIRED_STATUSES.has(record.status)
    })
  }, [data, guidanceItems, biasSignals, currentStage, strengthenRecords, currentScenarioId, analysisIdentityIsCurrent])

  /**
   * Re-join the producer's DSK attestation onto the engine's phase-3
   * recommendations.
   *
   * ⚠ THE JOIN KEY IS DERIVED FROM THE ENGINE'S OWN ID SHAPE, not guessed:
   * `buildRecommendations` mints producer-guidance rows as
   * `strengthen:phase3:${item.item_id}`. Nothing else in this file may invent a
   * key, and a recommendation the engine minted from its OWN deterministic
   * triggers has no guidance item behind it and therefore gets no grounding —
   * which is correct, not a gap to paper over.
   *
   * ⚠ ID-GATED AS A UNIT. `deriveGuidanceDskProvenance` returns undefined
   * unless the producer sent a non-empty `dsk_claim_id`; absence means "not
   * grounded", never a default. This hook adds no key in that case.
   */
  const scienceGrounding = useMemo(() => {
    const out: Record<string, { claimId: string; protocolId?: string; strength?: string }> = {}
    for (const item of guidanceItems) {
      const provenance = deriveGuidanceDskProvenance(item)
      if (provenance) out[`strengthen:phase3:${item.item_id}`] = provenance
    }
    return out
  }, [guidanceItems])

  return useMemo(
    () =>
      buildAnalysisNewViewModel({
        data,
        producerLeaderWithholdReason,
        runProvisional,
        modelHasLimits,
        recommendations,
        isPreRun,
        isRunning,
        isStale,
        staleReason,
        nSamples,
        seedUsed,
        responseHash,
        scienceGrounding,
        whatsChanged,
        nodeValueSources,
        nodeLabels,
        nodeOrigins,
        // ⭐ THE SAME READING Strengthen gets above, now also the licence for
        // the one not-analysed reason that blames the engine — an option added
        // after the run must not read "the analysis returned no result".
        analysisIdentityIsCurrent,
      }),
    /**
     * ⚠⚠ EVERY DECLARED INPUT, AND `staleReason` WAS THE ONE MISSING.
     *
     * `buildAnalysisNewViewModel` derives `status.staleKind` from it, so
     * without it here the panel kept the PREVIOUS staleness sentence when the
     * reason flipped — measured at this hook: 'unconfirmed' → 'changed' with
     * every other input identical returned 'unconfirmed'.
     *
     * That is not cosmetic. `staleReason.ts` exists because one boolean was
     * answering two questions — 'changed' is a claim about the WORLD,
     * 'unconfirmed' a claim about our EVIDENCE — and the dock computes the two
     * flags from two genuinely different authorities (`displayedFreshness` for
     * `isStale`, `composedAnalysisState.trust.semantic` for this), so they move
     * independently by construction. Omitting it made the correction
     * conditional on some OTHER input happening to move in the same render.
     *
     * `__tests__/viewModelHonoursEveryInput.spec.tsx` exercises each scalar
     * input rather than pinning this one. ⚠ Its `SCALAR_INPUTS` is HAND-WRITTEN
     * and exhaustive against this interface only at this tip — it is not derived
     * from it. Add an input here and you must add a row there, or the new input
     * is unguarded and nothing goes red (CLAUDE.md trap 12 — that file is an
     * instance of the mirror, not a cure for it).
     */
    [
      data,
      // The builder reads it (`checks.sharesExcludeLimits`, the withheld
      // cause); a later turn can re-stamp it while every result input is the
      // same object (Codex pre-read on #1922).
      producerLeaderWithholdReason,
      runProvisional,
      modelHasLimits,
      recommendations,
      isPreRun,
      isRunning,
      isStale,
      staleReason,
      nSamples,
      seedUsed,
      responseHash,
      scienceGrounding,
      whatsChanged,
      nodeValueSources,
      nodeLabels,
      nodeOrigins,
      // Store-derived, not an arg: a currency flip must re-license the
      // not-analysed reason even when every other input is the same object.
      analysisIdentityIsCurrent,
    ],
  )
}
