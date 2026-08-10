/**
 * Analysis freshness slice — sourced ONLY from `response.analysis_ready`.
 *
 * Deliberately independent of `v5AnalysisFact` and of the graph-hash stale
 * guard deleted on 2026-07-16 (both excluded by the brief) and of
 * `ceeAnalysisReady` (which is cleared on
 * analyse-turns-without-analysis_ready and on graph edits — that conflicts with
 * the "retain last verdict" requirement). This slice holds CEE's last freshness
 * verdict verbatim and follows three rules:
 *   - retain: a turn WITHOUT analysis_ready keeps the previous verdict;
 *   - never absence→fresh: a present payload with missing/invalid freshness
 *     degrades to 'unknown', never 'fresh';
 *   - order by computed_at: a strictly-older payload is ignored.
 *
 * The UI renders this verdict as cautious, non-scientific messaging. Supporting
 * fields (reason / hashes / computed_at) are held for ordering and debug only —
 * they are technical and must not be shown as user copy.
 */

export type AnalysisFreshnessValue = 'fresh' | 'stale' | 'unknown' | 'none'

/**
 * Reason code written by the RUN-COMPLETION path (not by CEE): an
 * analysis_result landed with a new hash but the response carried no
 * explicit freshness verdict. Displayed as cannot-confirm — never as a
 * retained pre-run 'stale', which would claim "model changed" over results
 * the run itself just produced (F10, Paul's 16-Jul session).
 */
export const RUN_COMPLETED_WITHOUT_VERDICT = 'run_completed_without_verdict'

/**
 * Reason code written by THIS reducer (not by CEE): a present `analysis_ready`
 * carried NO `freshness` field at all — readiness only. It is the provenance
 * marker that separates the UI's own degradation-of-silence from a verdict CEE
 * actually stated, and it exists because conflating the two shipped an inverted
 * freshness strip (ROADMAP 2.129 (a), live-proven on staging `98aae72e`).
 *
 * A `graph_patch: applied` reply looks exactly like this on the wire:
 *
 *   { options: [...], goal_node_id: 'goal_x', status: 'ready', computed_at: <newer> }
 *
 * — readiness, a newer `computed_at`, and total silence on freshness. Degrading
 * that to `'unknown'` is right (never absence→fresh). Letting the degraded value
 * then IMPERSONATE a CEE-stated `'unknown'` was not: `'unknown'` reads as
 * cannot-confirm, so an accepted edit stopped showing "Model changed" — and with
 * it the Model tab's only re-analyse control — while a REJECTED edit (no
 * `analysis_ready` at all → retain) still did. The strip fired when the edit had
 * not taken and went silent when it had.
 *
 * Two rules key on this marker; both are about not over-claiming from silence:
 *   - the store's `setAnalysisFreshness` does NOT clear the local dirty overlay
 *     for such a payload (silence is not a re-verification — same argument the
 *     `pendingEmittedEdits` hold already makes for an undispatched edit);
 *   - `classifyFreshnessForDisplay` reads it WITH the dirty overlay as 'changed'
 *     (the user demonstrably edited since CEE last spoke), and WITHOUT the
 *     overlay as cannot-confirm (silence alone never claims "you changed it").
 *
 * Never user copy. Deterministic, so the echo guard's `sameVerdict` still works.
 */
export const VERDICT_ABSENT_FROM_PAYLOAD = 'payload_carried_no_freshness_verdict'

/**
 * Reason code written by the BOOT/restore path when a persisted freshness
 * attestation was re-ingested after exact graph-identity validation.
 *
 * ROADMAP 2.1003 / audit finding F4. Measured on deployed staging 2026-08-09:
 * before reload the rerun was `fresh` / `graph_hash_match`; after reload the
 * SAME graph and the SAME result read *"Cannot confirm whether this analysis
 * is current."* The stored `ceeAnalysisReady` already contained MATCHING graph
 * hashes — boot restored readiness and never looked at the attestation.
 *
 * Deliberately DISTINCT from CEE's own `graph_hash_match`: this verdict was
 * re-derived by the client from stored bytes, not stated by CEE on this turn,
 * and a later reader must be able to tell those apart. Never user copy.
 */
export const RESTORED_ATTESTATION_HASHES_ALIGNED = 'restored_attestation_hashes_aligned'


export interface AnalysisFreshnessState {
  freshness: AnalysisFreshnessValue
  /** Technical reason code from CEE (e.g. 'graph_hash_match') — debug only, never user copy. */
  freshnessReason?: string
  graphHashAtRun?: string
  currentGraphHash?: string
  /** ISO timestamp used to order updates. */
  computedAt?: string
  /**
   * Provenance for the RUN-COMPLETION overwrite only: the CEE verdict that
   * `noteRunCompletedWithoutVerdict` replaced. The echo guard compares
   * incoming payloads against the last CEE payload, and after the run write
   * the stored verdict is no longer that payload — without this field, a
   * byte-identical pre-run 'stale' re-delivered on the next conversational
   * turn would read as a NEW verdict and resurrect "model changed" over the
   * results the run just produced. Never rendered; at most one level deep
   * (the run write flattens).
   */
  supersededVerdict?: AnalysisFreshnessState
}

const VALID: ReadonlySet<AnalysisFreshnessValue> = new Set([
  'fresh',
  'stale',
  'unknown',
  'none',
])

function nonEmptyString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** Field-wise equality — used to treat a re-delivered identical payload as a no-op. */
function sameVerdict(a: AnalysisFreshnessState, b: AnalysisFreshnessState): boolean {
  return (
    a.freshness === b.freshness &&
    a.freshnessReason === b.freshnessReason &&
    a.graphHashAtRun === b.graphHashAtRun &&
    a.currentGraphHash === b.currentGraphHash &&
    a.computedAt === b.computedAt
  )
}

/**
 * Pure reducer for the analysis-freshness slice. See module doc for the rules.
 * `rawAnalysisReady` is the verbatim `response.analysis_ready` (or null/undefined
 * when the turn carried none).
 */
export function deriveAnalysisFreshnessUpdate(
  prev: AnalysisFreshnessState | null,
  rawAnalysisReady: unknown,
): AnalysisFreshnessState | null {
  // Retain: absence of analysis_ready never changes (and never clears) the verdict.
  if (rawAnalysisReady === null || typeof rawAnalysisReady !== 'object') {
    return prev
  }

  const o = rawAnalysisReady as Record<string, unknown>

  // Never absence→fresh: a present payload with a missing/invalid freshness
  // value degrades to 'unknown', not 'fresh'.
  const fRaw = o.freshness
  const freshness: AnalysisFreshnessValue =
    typeof fRaw === 'string' && VALID.has(fRaw as AnalysisFreshnessValue)
      ? (fRaw as AnalysisFreshnessValue)
      : 'unknown'

  // ...but record WHY it is 'unknown' when the field was simply ABSENT. That is
  // a different fact from CEE stating 'unknown', and from CEE sending a value we
  // could not parse: absence means the payload said nothing about freshness at
  // all. See VERDICT_ABSENT_FROM_PAYLOAD for what keys on the distinction and
  // the live defect that conflating them shipped. Deliberately NOT stamped when
  // the payload carried its own `freshness_reason` — CEE's reason is not ours to
  // overwrite.
  const verdictAbsent = fRaw === undefined || fRaw === null

  const computedAt = nonEmptyString(o.computed_at)

  // Order by computed_at: ignore a STRICTLY-older payload when both timestamps
  // are present. When the new payload has no computed_at we cannot order it, so
  // we fall through to the content check below.
  //
  // ⭐ CORRECTED 2026-08-10. This read `computed_at <= prev.computedAt`, and the
  // equal arm silently discarded CEE's authoritative verdict. `computed_at`
  // stamps the ANALYSIS, not the verdict: CEE re-evaluates freshness against the
  // CURRENT graph and re-sends the SAME analysis with a NEW verdict and a NEW
  // `current_graph_hash`. Witnessed on staging — after a graph edit CEE returned
  // `freshness: 'stale'` with a new `current_graph_hash` at an unchanged
  // `computed_at`, and this branch threw it away, leaving the store on `fresh`
  // with the pre-edit hashes. The panel then told the user the analysis
  // reflected a model it did not.
  //
  // The timestamp only ever answered "is this the SAME ANALYSIS?". Whether it is
  // the SAME VERDICT is a different question, and the echo guard below
  // (`sameVerdict`) is the check that answers it — so a genuine equal-time echo
  // is still a reference-stable no-op, without this branch having to guess.
  if (prev?.computedAt && computedAt && computedAt < prev.computedAt) {
    return prev
  }

  const next: AnalysisFreshnessState = {
    freshness,
    freshnessReason:
      nonEmptyString(o.freshness_reason) ?? (verdictAbsent ? VERDICT_ABSENT_FROM_PAYLOAD : undefined),
    graphHashAtRun: nonEmptyString(o.graph_hash_at_run),
    currentGraphHash: nonEmptyString(o.current_graph_hash),
    computedAt,
  }

  // Echo guard: a re-delivered payload identical to the stored verdict is a no-op
  // (returns the same reference). This matters because `computed_at` is not part
  // of the CEE analysis_ready contract today — without this, every re-delivered
  // analysis_ready (e.g. echoed on a conversational turn) would look like a new
  // verdict and wrongly clear the local dirty overlay. With it, a reference
  // change reliably means "a genuinely new/changed verdict".
  //
  // The guard's invariant is "compare against the last CEE payload". The
  // run-completion overwrite (`noteRunCompletedWithoutVerdict`) changes the
  // STORED verdict without a CEE payload, so it records the verdict it
  // replaced in `supersededVerdict` — an echo of that pre-run payload must
  // also be a no-op, or it would silently revert the run's honest 'unknown'
  // back to a pre-run 'stale' one turn later.
  if (
    prev &&
    (sameVerdict(prev, next) ||
      (prev.supersededVerdict != null && sameVerdict(prev.supersededVerdict, next)))
  ) {
    return prev
  }

  return next
}

/**
 * Verdict semantics: a 'stale' verdict whose own payload carries IDENTICAL
 * at-run and current graph hashes is self-contradictory — the payload itself
 * proves the model did not change. Such a verdict must never be rendered as
 * the factual "model changed" claim; the display downgrades it to
 * cannot-confirm ('unknown'). Keyed on hash EQUALITY only (both present and
 * non-empty) — the hashes are technical fields and are never rendered as
 * copy. This is a semantic rule, not a workaround for observed engine
 * behaviour: it stays correct after the engine-side guard fix (it simply
 * stops firing). Missing hashes leave the verdict untouched — absence of
 * evidence is not evidence of contradiction.
 */
export function isSelfContradictoryStale(
  freshness: unknown,
  graphHashAtRun: unknown,
  currentGraphHash: unknown,
): boolean {
  return (
    freshness === 'stale' &&
    typeof graphHashAtRun === 'string' &&
    graphHashAtRun.length > 0 &&
    graphHashAtRun === currentGraphHash
  )
}

/**
 * Local dirty-overlay display rule.
 *
 * CEE's verdict (`state.freshness`) is the source of truth. The local dirty
 * overlay is set by analysis-affecting local edits (see the store wiring) and
 * cleared when a new `analysis_ready` arrives or the scenario resets.
 *
 * The ONLY thing the overlay may do is downgrade a retained `fresh` verdict to
 * `unknown` (cannot-confirm) — it never fabricates `stale`, never upgrades, and
 * never touches a CEE `stale`/`unknown`/`none` verdict. Returns the value to
 * display, or null when there is no verdict to show.
 *
 * Separately from the overlay, a self-contradictory 'stale' verdict (identical
 * at-run/current hashes — see `isSelfContradictoryStale`) displays as
 * 'unknown': the copy must be the cannot-confirm variant, never a factual
 * "model changed" claim the verdict's own payload disproves. The slice still
 * HOLDS the verbatim CEE verdict (`data-cee-freshness` and debug exports keep
 * it); only the display value downgrades.
 */
/**
 * ⚠ INTERIM 2.467 — THIS FUNCTION TAKES NO `importHold`, AND ITS FOUR CALL
 * SITES ARE FAIL-SAFE BY LUCK, NOT BY DESIGN. Documented rather than
 * re-plumbed, deliberately, because re-plumbing them is out of scope for an
 * interim mitigation.
 *
 * `useEditConfirmation`, `OutputsDock`, `AnalysisFreshnessNotice` and
 * `DecisionConfidencePanel` all only ever ask "is this NOT confirmably fresh?".
 * They inherit the mitigation solely because `setAnalysisFreshness` forces the
 * dirty overlay on under a hold, which downgrades a `fresh` verdict to
 * `'unknown'` here. That forced-dirty line is the single most load-bearing line
 * in the mitigation.
 *
 * ⚠ NO MUTANT COUNT IS RECORDED HERE, DELIBERATELY. This sentence used to read
 * "its mutant bites 6 tests" — a hand-written tally no gate derives, i.e. the
 * hand-maintained mirror this codebase's own doctrine warns about, sitting
 * inside a comment about load-bearing guarantees. Re-measured at 2.494 it was
 * wrong AND ill-posed: deleting the assignment bites **5**, flipping it to
 * `false` bites **7**, so "the" count depends on which mutant you pick and the
 * number could only ever decay. Derive it instead — every test that can reach
 * the held branch lives in ONE file,
 * `src/canvas/__tests__/importCanvas.analysisInvalidation.spec.tsx`, and that
 * is itself derivable rather than asserted: reaching the branch requires
 * `importPendingServerRegistration === true`, and every route to it
 * (`importCanvas`, `markGraphImported`, the marker's storage key, a direct
 * `setState` of the field) is referenced by that spec alone.
 *
 * **Any new call site that asks a POSITIVE question of this function — "is it
 * fresh?" — will get the wrong answer under a hold.** Ask
 * `classifyFreshnessForDisplay` (which takes the hold explicitly and gates the
 * affirmative first) instead.
 */
export function resolveDisplayedFreshness(
  state: AnalysisFreshnessState | null,
  dirty: boolean,
): AnalysisFreshnessValue | null {
  if (!state) return null
  // Suppress a stale-since-edit 'fresh' verdict to cannot-confirm. CEE 'stale'
  // stays 'stale' (unless self-contradictory below); everything else passes
  // through unchanged.
  if (state.freshness === 'fresh' && dirty) return 'unknown'
  if (isSelfContradictoryStale(state.freshness, state.graphHashAtRun, state.currentGraphHash)) {
    return 'unknown'
  }
  return state.freshness
}

/** Copy-oriented classification of the displayed freshness. */
export type FreshnessDisplaySemantic = 'current' | 'changed' | 'cannot_confirm' | 'none'

/**
 * Classify the displayed freshness for COPY decisions across the visible
 * AI-panel surfaces (composer placeholder, Results stale banner, chip relabel).
 * Single source so those surfaces can't drift from each other or from the CEE
 * verdict — and so none of them re-derive currentness from the graph-hash
 * stale guard deleted on 2026-07-16.
 *
 * Distinguishes a model that definitely CHANGED since the run — a CEE 'stale'
 * verdict, OR a local edit that downgraded a retained 'fresh' (the dirty overlay)
 * — from a CANNOT-CONFIRM state where CEE itself could not determine freshness
 * (a present analysis_ready with missing/invalid freshness → 'unknown'). The two
 * warrant different copy: "you've changed the model" vs the neutral "can't confirm
 * this is current". 'changed' must never be claimed for a CEE-sourced 'unknown',
 * nor for a self-contradictory 'stale' whose identical hashes disprove the
 * change (see `isSelfContradictoryStale`).
 */
export function classifyFreshnessForDisplay(
  state: AnalysisFreshnessState | null,
  dirty: boolean,
  /**
   * Interim 2.467: the canvas graph is an IMPORT the server has never seen, so
   * the dirty overlay is held by the mitigation rather than by a user edit.
   *
   * This must NEVER classify as 'changed'. The mitigation's identity match is
   * structural and therefore coarse: after the walk's own flow (export →
   * relabel → import) the imported digest equals CEE's own graph, so every
   * later install of the GENUINE server graph re-derives the hold. Asserting
   * "Model changed. Results may be out of date." there is factually false about
   * a current analysis — and a warning that cries wolf trains users to ignore
   * the one that matters. Cannot-confirm is the honest reading of exactly this
   * state: we cannot confirm the server analysed what is on the canvas.
   */
  // REQUIRED, deliberately not defaulted. A `= false` default means any call
  // site that forgets it silently gets the UNSAFE value and drifts back to the
  // affirmative — derivation proves agreement between call sites, never that
  // the set of call sites is complete (trap 12d). Making it required turns that
  // silent drift into a compile error.
  importHold: boolean,
): FreshnessDisplaySemantic {
  const displayed = resolveDisplayedFreshness(state, dirty)
  if (displayed === null || displayed === 'none') return 'none'
  // ⚠ THE AFFIRMATIVE GATE, AND IT MUST STAY FIRST. Under an import hold the
  // affirmative is unreachable BY THIS FUNCTION ALONE — not by cooperation with
  // another module.
  //
  // Measured, after three review rounds had read this code without catching it:
  // with the hold check placed anywhere BELOW the `fresh → 'current'` line,
  // `(fresh, dirty=false, importHold=true)` returns **'current'** — the exact
  // affirmative this mitigation exists to make unreachable. It was safe only
  // because `setAnalysisFreshness` forces `dirty=true` under a hold, one module
  // away. A mitigation that leans on an invariant in another file, undocumented
  // at the point of use, is one refactor from re-opening the P0.
  if (importHold && displayed === 'fresh') return 'cannot_confirm'
  if (displayed === 'fresh') return 'current'
  // A CEE-STATED 'stale' OUTRANKS our own uncertainty and must reach this
  // branch even under an import hold. It is a first-hand server statement that
  // the model changed — a strictly stronger TRUE claim than "cannot confirm".
  //
  // ⚠ The first cut of the import hold returned cannot-confirm ABOVE this line,
  // which suppressed that server statement, and — because `ReanalyseBar` gates
  // on 'changed' — took the Model tab's ONLY re-analyse control with it. That
  // is precisely the defect ROADMAP 2.129 (a) was opened for and live-proved on
  // staging `98aae72e`; its account sits a few lines below. The hold gates the
  // INFERRED 'changed' only (see the next branch), never a stated one.
  if (displayed === 'stale') return 'changed'
  // The INFERRED cases below rest on our own dirty overlay rather than on
  // anything the server said; under a hold that inference is unsafe (the
  // structural identity match also fires when the GENUINE server graph is on
  // the canvas, where "Model changed" would be false).
  if (importHold) return 'cannot_confirm'
  // displayed === 'unknown': it means the user definitely changed the model
  // since the run in exactly two cases, both of which require the local dirty
  // overlay (the UI's own first-hand knowledge that an analysis-affecting edit
  // happened) — never the verdict alone:
  //
  //   1. the dirty-overlay downgrade of a retained CEE 'fresh' verdict;
  //   2. the dirty overlay over a verdict that is 'unknown' ONLY because the
  //      payload carried no freshness field (VERDICT_ABSENT_FROM_PAYLOAD). CEE
  //      said nothing about freshness, and the user has edited since CEE last
  //      spoke — "Model changed. Results may be out of date." is a true claim,
  //      and this is the state a `graph_patch: applied` reply lands the UI in
  //      (ROADMAP 2.129 (a): treating it as cannot-confirm hid the staleness AND
  //      the Model tab's only re-analyse control after an ACCEPTED edit).
  //
  // Everything else is cannot-confirm, and deliberately so: a CEE-STATED
  // 'unknown', the orphan synthesis (ORPHANED_RESULT) and the run-completion
  // write (RUN_COMPLETED_WITHOUT_VERDICT) must never be dressed up as a factual
  // "you edited" claim.
  // Disclosed: the hold above also downgrades a genuine post-import EDIT
  // (VERDICT_ABSENT_FROM_PAYLOAD + dirty), for which "Model changed" would have
  // been true. Deliberate, and it costs nothing user-facing — the re-analyse
  // affordance renders for a held cannot-confirm too (ReanalyseBar): the
  // ASSERTION is withheld, the AFFORDANCE is not.
  if (dirty && (state?.freshness === 'fresh' || state?.freshnessReason === VERDICT_ABSENT_FROM_PAYLOAD)) {
    return 'changed'
  }
  return 'cannot_confirm'
}


/**
 * ROADMAP 2.1003 / F4 — re-ingest a PERSISTED freshness attestation at boot,
 * and only when it can be positively validated.
 *
 * `resultsLoadHistorical` stamps `{ freshness: 'unknown', freshnessReason:
 * 'hydrated_without_capture' }` because a hydrated snapshot has no live
 * capture proving it matches the current graph. That reasoning is right in
 * general and WRONG in the one case where the snapshot carries its own proof:
 * an `analysis_ready` whose `graph_hash_at_run` EQUALS its `current_graph_hash`
 * is an attestation that the graph had not moved when the verdict was formed.
 *
 * FAIL-CLOSED BY CONSTRUCTION. It returns a verdict only when EVERY one of
 * these holds, and `null` (leave it as cannot-confirm) otherwise:
 *   · the stored payload states `freshness === 'fresh'` — a stored 'stale' or
 *     'unknown' is never upgraded;
 *   · BOTH hashes are present, non-empty strings;
 *   · they are EQUAL. Any mismatch stays unknown, exactly as the audit
 *     prescribes.
 * It never invents `fresh` from silence, and it never downgrades anything: the
 * caller applies it only over the hydration marker.
 *
 * Note what it does NOT do: it does not compare the stored hash against a
 * freshly computed hash of the restored graph. It validates the attestation's
 * INTERNAL consistency plus the caller's node-identity check
 * (`validateCeeAnalysisReady`). A client-side recomputation would need CEE's
 * hash function, which the UI does not have — claiming otherwise would be the
 * two-hash-functions trap.
 */
export function deriveRestoredFreshnessAttestation(
  storedAnalysisReady: unknown,
): AnalysisFreshnessState | null {
  if (storedAnalysisReady === null || typeof storedAnalysisReady !== 'object') return null
  const o = storedAnalysisReady as Record<string, unknown>

  if (o.freshness !== 'fresh') return null

  const atRun = nonEmptyString(o.graph_hash_at_run)
  const current = nonEmptyString(o.current_graph_hash)
  if (atRun === undefined || current === undefined) return null
  if (atRun !== current) return null

  return {
    freshness: 'fresh',
    freshnessReason: RESTORED_ATTESTATION_HASHES_ALIGNED,
    graphHashAtRun: atRun,
    currentGraphHash: current,
    computedAt: nonEmptyString(o.computed_at),
  }
}

/**
 * The whole boot-restore decision as ONE pure function: given the current
 * freshness slice, the dirty overlay, and the stored payload, should the
 * verdict be replaced — and with what?
 *
 * Deliberately NOT a store action. Adding a member to the canvas store's
 * interface changes the rendered text of a pre-existing `V5ApplicatorStore`
 * assignability diagnostic (its elided "… N more …" property count moves),
 * which the typecheck gate's identity baseline reads as a NEW diagnostic and
 * its self-test then fails on. Absorbing that by regenerating the baseline
 * would also absorb ~7 unrelated pre-existing drops in files this lane never
 * touched. Keeping the logic pure avoids the perturbation entirely and makes
 * every guard directly testable.
 *
 * Returns `null` for "change nothing". It can only ever move the hydration
 * cannot-confirm marker to `fresh`; it can never downgrade, never overwrite a
 * live CEE verdict, and never invent a verdict from silence.
 */
export function resolveRestoredFreshnessUpdate(
  current: AnalysisFreshnessState | null,
  dirty: boolean,
  storedAnalysisReady: unknown,
): AnalysisFreshnessState | null {
  // 1. Only the hydration marker is eligible. A live CEE verdict — including a
  //    'stale' one — is never touched.
  if (current?.freshnessReason !== 'hydrated_without_capture') return null
  // 2. If the user has edited since, the attestation is about a graph that no
  //    longer exists.
  if (dirty) return null
  // 3. The attestation must validate on its own terms.
  return deriveRestoredFreshnessAttestation(storedAnalysisReady)
}
