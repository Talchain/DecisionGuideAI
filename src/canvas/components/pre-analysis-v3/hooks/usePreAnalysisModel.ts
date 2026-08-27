/**
 * usePreAnalysisModel — the single derivation for every v3 panel section.
 *
 * Single source of truth: all sections render from this memoised model, so
 * one store commit (e.g. saving the success measure) updates bars, ladder,
 * pills, signals and footer in the same pass. The only local state anywhere
 * in the panel tree is uncommitted input text.
 */

import { useEffect, useMemo } from 'react'
import { goalLabelIsUnconfirmedBriefExtract } from '../../../domain/goalLabelProvenance'
import { useCanvasStore } from '../../../store'
import { useGraphReadiness } from '../../../hooks/useGraphReadiness'
import {
  actionableBlockers,
  readinessObjectsToRun,
  readinessWillScaffold,
} from '../../../utils/canRunAnalysis'
import { useAnalysisReadinessAuthority } from '../../../state/analysisStateSelector'
import { useAnalysisMayRun } from '../../../hooks/useAnalysisReady'
import { composeAnalysisBlockedReason } from '../../../utils/composeBlockedReason'
import { resolveStarterId } from '../../../starters/loadStarter'
import { isReviewedByUser } from '../../pre-analysis/utils/isReviewedByUser'
import { computeBars, type BarsModel } from '../selectors/computeBars'
import { computeContestedRows, type ContestedRowModel } from '../selectors/computeContestedRows'
import { computeEstimateRanking } from '../selectors/computeEstimateRanking'
import { computeGraphFacts, computeProvenanceCounts } from '../selectors/graphFacts'
import { computeInfluenceCoverage } from '../selectors/computeInfluenceCoverage'
import {
  projectAuthoredEntities,
  type AuthoredEntity,
} from '../selectors/projectAuthoredEntities'
import { computeLadder } from '../selectors/computeLadder'
import { computeStructuralAbsence } from '../selectors/computeStructuralAbsence'
import { computeSuccessState, type SuccessState } from '../selectors/computeSuccessState'
import { buildEstimateRows, topUncalibrated } from '../selectors/buildEstimateRows'
import { deriveSignalViews } from '../signals/deriveSignalViews'
import { useSignalSessionStore } from '../signals/signalSessionStore'
import { CEE_FALLBACK_COPY, FOOTER_COPY, LADDER_COPY } from '../constants'
import {
  deriveReadinessCheck,
  readinessNothingHasAnswered,
} from '../footer/readinessDisplay'
import { guardCeeText, guardCeeTextOrNull, categoriseCoaching } from '../signals/ceeTextGuard'
import type {
  Attribution,
  EstimateRowModel,
  LadderStep,
  RankingSource,
  SignalView,
} from '../types'

export interface PreAnalysisModel {
  hero: {
    decisionTitle: string | null
    /**
     * `fromBrief` is CEE's own `provenance: 'from_brief'` stamp, resolved by the
     * ONE predicate (`goalLabelIsUnconfirmedBriefExtract`) rather than re-read
     * from the node here — so the surface consumes a decision, not a field.
     */
    goal: { nodeId: string; label: string; fromBrief: boolean } | null
    success: SuccessState
    goalNodeId: string | null
    coaching: { text: string; attribution: Attribution } | null
  }
  bars: BarsModel
  ladder: LadderStep
  sharpen: SignalView[]
  estimates: {
    rows: EstimateRowModel[]
    rankingSource: RankingSource
    checkedCount: number
    checkableCount: number
    needsValueCount: number
  }
  /**
   * ⭐ ONE PROJECTION FOR BOTH NAMED-ENTITY SLICES (`projectAuthoredEntities`).
   *
   * `options` used to be `{nodeId, label}` while `risks` beside it carried an
   * attribution — two adjacent memos over the same node array, one reading
   * CEE's `provenance` stamp and one not. An option Olumi invented therefore
   * rendered identically to one the user named, on a product whose premise is
   * that the humans are the authors.
   *
   * Both are now `AuthoredEntity`, whose `attribution` is NON-OPTIONAL: a slice
   * that adopts the type cannot omit the field. That is a strong convention,
   * not a structural guarantee — a future slice declining the type compiles
   * clean (measured). Reach for `AuthoredEntity` for any named-entity slice.
   */
  options: AuthoredEntity[]
  risks: AuthoredEntity[]
  /**
   * ROADMAP 2.376 — connections CEE's two validation passes disagreed about, as words.
   *
   * Sourced from `useCanvasStore(s => s.edges)`, the same store slice every other v3 slice
   * reads and the same one the legacy panel's `usePreAnalysisData` reads. That is not an
   * assumption: `applyDraftResult` writes CEE's per-edge validation metadata onto
   * `edge.data.validation` at ingest (`utils/applyDraftResult.ts:139,157`, via
   * `readValidationMetadata`), so the metadata reaches this tree by construction — there is
   * no separate legacy-only data path to bridge.
   *
   * EMPTY ARRAY IS THE NORMAL CASE and renders nothing at all.
   */
  contested: ContestedRowModel[]
  advanced: {
    factorCount: number
    connectionCount: number
    readinessScore: number | null
    canRun: boolean | null
    aiEstimatedCount: number
    reviewedCount: number
  }
  footer: {
    dot: 'muted' | 'warning' | 'success'
    headline: string
    subline: string
  }
  /**
   * ROADMAP 2.332 / 2.339 — the state of the readiness CHECK, as distinct from
   * the readiness VERDICT.
   *
   * `null` whenever the last check completed: the footer then renders exactly
   * what it always did, and this slice adds nothing to the panel. It is
   * non-null only when the store holds a truthful failure — an unreachable
   * service, a missing route, or a server error — which is precisely the state
   * that was invisible before this slice existed.
   *
   * `verdictRetained` distinguishes "we have never had an answer" from "we are
   * showing you an older one", and `stale` distinguishes an older answer that
   * still describes this model from one the model has outgrown. Nothing here
   * gates the run: the verdict remains the server's.
   */
  readinessCheck: {
    message: string
    verdictRetained: boolean
    stale: boolean
    verdictAtMs: number | null
    retry: () => void
  } | null
  /**
   * Neither the side-car nor the producer has answered. Exposed because the
   * arm that consumes it moved OUT of `footer` and into the shared ladder
   * (`footer/readinessDisplay.ts`) when a second pre-run surface appeared —
   * one with no `PreAnalysisModel` to read it from.
   */
  nothingHasAnswered: boolean
}

export function usePreAnalysisModel(): PreAnalysisModel {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const draftCoaching = useCanvasStore(s => s.draftCoaching)
  const analysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  // Stored goal constraints (CEE response root, ingested verbatim by
  // DraftChat/applyDraftResult) — the provenance carrier for the
  // success-target attribution (lane 35 fix 2).
  const goalConstraints = useCanvasStore(s => s.goalConstraints)
  const sensitivity = useCanvasStore(s => s.preAnalysisSensitivity)
  const currentBriefText = useCanvasStore(s => s.currentBriefText)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const {
    readiness,
    error: readinessError,
    stale: readinessStale,
    verdictAtMs: readinessVerdictAtMs,
    refresh: refreshReadiness,
  } = useGraphReadiness()
  const seen = useSignalSessionStore(s => s.seen)
  const markSeen = useSignalSessionStore(s => s.markSeen)
  const ensureScenario = useSignalSessionStore(s => s.ensureScenario)

  // Bind the ledger to the scenario. The store-side check also covers
  // scenario switches that happened while the panel was unmounted (the
  // module-level ledger outlives mounts).
  useEffect(() => {
    ensureScenario(scenarioId)
  }, [scenarioId, ensureScenario])

  const facts = useMemo(() => computeGraphFacts(nodes), [nodes])

  const success = useMemo(
    () =>
      computeSuccessState(
        facts.goalNode,
        (analysisReady as Record<string, unknown> | null) ?? null,
        null,
        goalConstraints,
      ),
    [facts.goalNode, analysisReady, goalConstraints],
  )

  const provenance = useMemo(
    () => computeProvenanceCounts(facts.factorNodes),
    [facts.factorNodes],
  )

  const ranking = useMemo(
    () => computeEstimateRanking(facts.factorNodes, edges, sensitivity),
    [facts.factorNodes, edges, sensitivity],
  )

  const rows = useMemo(
    () => buildEstimateRows(facts.factorNodes, ranking, null),
    [facts.factorNodes, ranking],
  )

  const top = useMemo(() => topUncalibrated(rows), [rows])

  const rowCounts = useMemo(() => {
    const needsValueCount = rows.filter(r => r.needsValue).length
    return {
      checkedCount: rows.filter(r => r.reviewed).length,
      checkableCount: rows.length - needsValueCount,
      needsValueCount,
    }
  }, [rows])

  const coverage = useMemo(
    () => computeInfluenceCoverage(facts.factorNodes, ranking.weights, isReviewedByUser),
    [facts.factorNodes, ranking.weights],
  )

  const decisionPresent =
    facts.decisionNode != null || (currentBriefText != null && currentBriefText.trim().length > 0)

  const bars = useMemo(
    () =>
      computeBars({
        decisionPresent,
        goalPresent: facts.goalNode != null,
        successSet: success.isSet,
        optionCount: facts.optionCount,
        riskCount: facts.riskCount,
        estimates: {
          coverage: coverage.influenceCoverage,
          ...rowCounts,
        },
      }),
    [decisionPresent, facts, success.isSet, coverage.influenceCoverage, rowCounts],
  )

  // The producer's own readiness verdict for this turn. See `canRun` below.
  const analysisReadiness = useAnalysisReadinessAuthority()

  // …and the producer's own ADMISSION verdict, which answers a different
  // question ("will the run proceed if asked?") from a different slice. The two
  // are separate on purpose — see `readinessObjectsToRun`.
  const analysisMayRun = useAnalysisMayRun()

  // UI-SEM-091: runnable-via-scaffold. CEE (#612) rides a scaffold intent on
  // the readiness response; when it will draft the remaining options the graph
  // is runnable despite can_run_analysis being false. Both the footer and the
  // ladder disclose it instead of showing the not-ready copy.
  const willScaffoldOptions = readinessWillScaffold(readiness)
  const scaffoldOptionCount = readiness?.scaffold_plan?.option_count

  // ⭐ ONE READINESS ANSWER FOR THE WHOLE PANEL (19 Aug 2026).
  //
  // This hook used to compute its own: `readiness.can_run_analysis ||
  // willScaffoldOptions`, read straight off the SIDE-CAR verdict. The comment
  // that stood here said its purpose was that "the footer agree with the run
  // gate (canRunAnalysis util)" — a hand-maintained agreement between two
  // expressions, which is the mirror this estate keeps paying for (trap 12).
  //
  // It came due the moment the gate gained a superseding authority: the mounted
  // spec caught an ENABLED "Analyse first pass" button sitting directly beneath
  // the line "Not ready for analysis yet". Same defect class as the blocker this
  // lane was opened for, created by fixing it one layer up.
  //
  // So the panel now asks `readinessObjectsToRun` — the SAME predicate the gate
  // and the dispatch barrier ask — instead of restating it. Three surfaces, one
  // definition, and no expression left here to drift.
  //
  // ⚠ The tri-state is preserved and it matters. `null` means NOBODY has
  // answered — not the producer, not the side-car — and the footer's first arm
  // depends on it to avoid claiming anything about an unassessed model. It is
  // deliberately NOT `readiness == null` alone any more: a producer verdict IS
  // an answer, so a panel that had one would otherwise report itself as still
  // waiting to hear.
  const nothingHasAnswered = readinessNothingHasAnswered(readiness, analysisReadiness)
  // ⭐ CEE's own admission verdict, from the `analysis_ready` slice. Without it
  // this panel refuses a model CEE would analyse now — while the chat offers a
  // live "Run analysis" chip on the same payload. See `readinessObjectsToRun`.
  const canRun = nothingHasAnswered
    ? null
    : !readinessObjectsToRun(readiness, analysisReadiness, analysisMayRun)

  const ladder = useMemo(
    () =>
      computeLadder({
        goalPresent: facts.goalNode != null,
        successSet: success.isSet,
        topUncalibrated: top,
        // The one value, not a second read of the side-car field.
        canRunAnalysis: canRun,
        readinessExplanation: readiness?.confidence_explanation
          ? guardCeeText(readiness.confidence_explanation, LADDER_COPY.readiness_fallback).text
          : null,
        willScaffoldOptions,
        scaffoldOptionCount,
      }),
    [facts.goalNode, success.isSet, top, canRun, readiness, willScaffoldOptions, scaffoldOptionCount],
  )

  const narrowFramingDetail = useMemo(() => {
    const signal = draftCoaching?.biasSignals?.find(b => b.type === 'narrow_framing')
    const detail = signal?.detail && signal.detail.trim().length > 0 ? signal.detail : null
    // Glossary guard: an unsafe swap degrades to the deterministic copy.
    return guardCeeTextOrNull(detail)
  }, [draftCoaching])

  const biasFindingExplanation = useMemo(() => {
    const findings = (analysisReady as { bias_findings?: Array<{ explanation?: string }> } | null)
      ?.bias_findings
    const first = findings?.find(f => typeof f.explanation === 'string' && f.explanation.length > 0)
    if (!first?.explanation) return null
    // Glossary guard: unsafe CEE wording degrades to a safe coaching line.
    return guardCeeText(first.explanation, CEE_FALLBACK_COPY.biasRow).text
  }, [analysisReady])

  /**
   * Is the graph on the canvas one of the bundled starter examples?
   *
   * Derived from the graph's own stamp via `resolveStarterId` — the SAME
   * predicate the canvas disclosure (`StarterProvenanceBanner`) and the run
   * gate (`analysisHeldOn`) ask. A separate flag would be a second
   * answer to one question, and this panel would eventually contradict the
   * banner sitting directly above it (W-1: it already did).
   */
  const isSavedExample = useMemo(() => resolveStarterId(nodes) != null, [nodes])

  /**
   * Causal-structure absence — the one thing the model's SHAPE does not contain.
   *
   * Keyed on the store's own nodes/edges, the same slices every other v3
   * selector reads, so the panel and the canvas can never disagree about the
   * structure being described.
   */
  const structuralAbsence = useMemo(
    () => computeStructuralAbsence(nodes, edges),
    [nodes, edges],
  )

  const derived = useMemo(
    () =>
      deriveSignalViews(
        {
          goalPresent: facts.goalNode != null,
          successSet: success.isSet,
          optionCount: facts.optionCount,
          riskCount: facts.riskCount,
          risksAllOlumi: facts.risksAllOlumi,
          aiEstimatedCount: provenance.aiEstimatedCount,
          topUncalibrated: top,
          isSavedExample,
          narrowFramingDetail,
          biasFindingExplanation,
          structuralAbsence,
        },
        seen,
      ),
    [facts, success.isSet, provenance.aiEstimatedCount, top, isSavedExample, narrowFramingDetail, biasFindingExplanation, structuralAbsence, seen],
  )

  useEffect(() => {
    if (derived.newlySeen.length > 0) markSeen(derived.newlySeen, Date.now())
  }, [derived.newlySeen, markSeen])

  const coaching = useMemo(() => {
    const raw =
      draftCoaching?.summary?.trim() ||
      ((analysisReady as { coaching_summary?: string | null } | null)?.coaching_summary?.trim() ??
        '')
    if (!raw) return null
    // Sanitise in place first; only if a residual term has no safe substitute
    // do we fall back, and then to a fallback matched to the coaching's theme.
    const category = categoriseCoaching(raw)
    const fallback =
      category === 'framing'
        ? CEE_FALLBACK_COPY.heroFraming
        : category === 'assumption'
          ? CEE_FALLBACK_COPY.heroAssumption
          : category === 'comparison'
            ? CEE_FALLBACK_COPY.heroComparison
            : CEE_FALLBACK_COPY.heroCoaching
    return {
      text: guardCeeText(raw, fallback).text,
      attribution: { kind: 'olumi' } as Attribution,
    }
  }, [draftCoaching, analysisReady])

  // Both slices, one projection. The authorship question is asked ONCE, in
  // `projectAuthoredEntities` — not restated per slice, which is how options
  // came to be silent about it while risks directly below were not.
  const options = useMemo(() => projectAuthoredEntities(nodes, 'option'), [nodes])

  const risks = useMemo(() => projectAuthoredEntities(nodes, 'risk'), [nodes])

  // ROADMAP 2.376 — contested connections. Keyed on the store's own nodes/edges so one
  // commit (a resolve in the Model tab, a re-draft) updates this section in the same pass as
  // every other slice.
  const contested = useMemo(() => computeContestedRows(nodes, edges), [nodes, edges])

  const footer = useMemo(() => {
    // ⚠ THE `nothingHasAnswered` ARM USED TO BE FIRST IN THIS MEMO AND IT HAS
    // MOVED — to `footer/readinessDisplay.ts`, which is now the one owner of
    // which headline a pre-run surface states. It is a MOVE, not a copy: this
    // memo had exactly one consumer (`PreAnalysisPanelV3` → `PanelFooter`), and
    // that consumer now reaches the unanswered arm through the shared ladder
    // BEFORE this value is read.
    //
    // Why it had to move: a SECOND pre-run surface exists (the shell's
    // `AnalysisReadinessBar`, hosted on the Olumi tab so the blocked footer's
    // "Ask in the chat" advice does not destroy its own context). It has no
    // `PreAnalysisModel`, so an arm living in here was unreachable from it —
    // and it duly claimed "Analysis available" on exactly the state this arm
    // was added, one day earlier, to stop this surface claiming.
    //
    // What this value MEANS is therefore narrower than it was: it is the
    // RESTING display — what to say once the outage, in-flight, gate and
    // unanswered arms have all declined. Everything below is unchanged.
    // UI-SEM-091: readiness reports not-runnable, but CEE will draft the
    // remaining options — disclose the draft, never the not-ready copy.
    // Scaffold intent is a SIDE-CAR field, so this disclosure belongs to the
    // side-car branch. Once the producer has stated readiness the side-car is
    // superseded, and announcing a draft it licensed would be a claim from an
    // authority that no longer decides.
    if (analysisReadiness == null && readiness?.can_run_analysis === false && willScaffoldOptions) {
      return {
        dot: 'warning' as const,
        headline: FOOTER_COPY.ready,
        subline:
          typeof scaffoldOptionCount === 'number'
            ? FOOTER_COPY.scaffoldSub(scaffoldOptionCount)
            : FOOTER_COPY.scaffoldSubNoCount,
      }
    }
    if (canRun === false) {
      // The reason comes from the authority that DECIDED, never from the other
      // one — the same rule the gate applies. `PanelFooter` overrides this whole
      // value while the gate is shut (it renders the gate's own composed
      // sentence), so in practice this arm is only reachable if the two ever
      // disagree; composing it from the deciding authority means that even then
      // the two cannot tell different stories about one state.
      if (analysisReadiness) {
        return {
          dot: 'muted' as const,
          headline: FOOTER_COPY.notReady,
          // ...and from the same LIST that authority decided on. `canRun` is
          // the run gate's verdict, and that gate counts only ACTIONABLE
          // blockers; composing from the raw list here would name an advisory
          // blocker the gate had already ruled out, and send the user to fix
          // something that cannot open the run. One filter, one owner:
          // `actionableBlockers` in `canRunAnalysis`.
          subline: composeAnalysisBlockedReason(
            actionableBlockers(analysisReadiness.blockers),
          ),
        }
      }
      const explanation = readiness?.confidence_explanation?.trim()
      return {
        dot: 'muted' as const,
        headline: FOOTER_COPY.notReady,
        subline: explanation
          ? guardCeeText(explanation, FOOTER_COPY.notReadySubFallback).text
          : FOOTER_COPY.notReadySubFallback,
      }
    }
    if (!success.isSet) {
      return {
        dot: 'warning' as const,
        headline: FOOTER_COPY.ready,
        subline: FOOTER_COPY.readySubSuccessUnset,
      }
    }
    return {
      dot: 'success' as const,
      headline: FOOTER_COPY.ready,
      subline: top ? FOOTER_COPY.readySubEstimates : FOOTER_COPY.readySubAllSet,
    }
  }, [
    canRun,
    // Read directly by two arms now (the scaffold guard and the not-ready
    // subline), so it is a first-class input to this memo, not a value `canRun`
    // can stand in for.
    analysisReadiness,
    willScaffoldOptions,
    scaffoldOptionCount,
    success.isSet,
    top,
    // The null/non-null transition is what the first branch turns on.
    // `canRun` already tracks it (null → boolean), but depending on the
    // verdict itself keeps the memo's inputs honest rather than relying on a
    // derived value to stand in for it.
    readiness,
    readiness?.can_run_analysis,
    readiness?.confidence_explanation,
  ])

  // Memoised slices so the memo()'d sections actually bail out when their
  // inputs are unchanged (a fresh object tree every render defeats them).
  const hero = useMemo(() => {
    const decisionLabel = facts.decisionNode
      ? ((facts.decisionNode.data as Record<string, unknown>)?.label as string | undefined)
      : undefined
    // The user's own question outranks the drafted decision label (item 6).
    const briefTitle = currentBriefText?.trim()
    const goalLabel = facts.goalNode
      ? ((facts.goalNode.data as Record<string, unknown>)?.label as string | undefined)
      : undefined
    return {
      decisionTitle: briefTitle && briefTitle.length > 0 ? briefTitle : decisionLabel ?? null,
      goal: facts.goalNode
        ? {
            nodeId: facts.goalNode.id,
            label: goalLabel ?? '',
            fromBrief: goalLabelIsUnconfirmedBriefExtract(
              facts.goalNode.data as { provenance?: unknown } | undefined,
            ),
          }
        : null,
      success,
      goalNodeId: facts.goalNode?.id ?? null,
      coaching,
    }
  }, [facts.decisionNode, facts.goalNode, currentBriefText, success, coaching])

  const estimates = useMemo(
    () => ({ rows, rankingSource: ranking.source, ...rowCounts }),
    [rows, ranking.source, rowCounts],
  )

  const advanced = useMemo(
    () => ({
      factorCount: facts.factorNodes.length,
      connectionCount: edges.length,
      readinessScore: readiness?.readiness_score ?? null,
      canRun,
      aiEstimatedCount: provenance.aiEstimatedCount,
      reviewedCount: provenance.reviewedCount,
    }),
    [facts.factorNodes.length, edges.length, readiness?.readiness_score, canRun, provenance],
  )

  // ROADMAP 2.332 / 2.339. `error` is set ONLY by the store's honest failure
  // arms — transport rejection (2.319a), 404 (2.329) and every other non-ok
  // status (2.339). The 429 arm sets an error too, but it also publishes a
  // labelled local fallback, so it is a verdict-bearing state and reaches the
  // retained arm rather than the never-checked one, which is the truth.
  // Derived through the shared builder so the shell's bar and this panel cannot
  // hold different ideas of what "the check failed" means (`readinessDisplay.ts`).
  const readinessCheck = useMemo(
    () =>
      deriveReadinessCheck({
        error: readinessError,
        verdictRetained: readiness != null,
        stale: readinessStale,
        verdictAtMs: readinessVerdictAtMs,
        retry: refreshReadiness,
      }),
    [readinessError, readiness, readinessStale, readinessVerdictAtMs, refreshReadiness],
  )

  return useMemo(
    () => ({
      hero,
      bars,
      ladder,
      sharpen: derived.sharpen,
      estimates,
      options,
      risks,
      contested,
      advanced,
      footer,
      readinessCheck,
      nothingHasAnswered,
    }),
    [
      hero,
      bars,
      ladder,
      derived.sharpen,
      estimates,
      options,
      risks,
      contested,
      advanced,
      footer,
      readinessCheck,
      nothingHasAnswered,
    ],
  )
}
