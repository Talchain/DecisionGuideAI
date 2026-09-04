/**
 * WHAT MAY THIS PANEL CLAIM ABOUT THIS RUN? — three answers, never one.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THREE, AND WHY THEY MUST NOT BE FOLDED
 * ═══════════════════════════════════════════════════════════════════════════
 * `leaderDesignationPermitted` answers exactly one question — "may this panel
 * DESIGNATE a leader?" — and it answers it well. Sites then reached for it as
 * a general "is this run claimable" boolean, or reached past it entirely.
 * Both directions are wrong, because CEE's admission is a LATTICE, not a
 * switch:
 *
 *     none < exploratory < quantified_provisional < comparative_leader
 *
 * `quantified_provisional` is the mode that proves one boolean cannot work:
 * the labelled figures are licensed and the leader is not. A UI that hides
 * everything on that mode is not a successful consumer — it is a different
 * defect, and a worse product than the one it replaced.
 *
 * So this module exposes THREE named answers, each derived from the lattice on
 * its own line. It composes; it does not re-derive:
 *
 *   Q-FIGURES   may we show comparative figures?      lattice only
 *   Q-LEADER    may we name or rank a leader?         `leaderDesignationPermitted`
 *                                                     (lattice ∧ this result's
 *                                                      separation) — QUOTED, not
 *                                                      re-implemented
 *   Q-STABILITY may we state stability/robustness?    lattice only
 *
 * ⚠ Q-LEADER IS NOT Q-STABILITY. They agree on three of the four modes and
 * diverge on the one that matters, and they answer to different evidence:
 * separation is a property of THIS RESULT, robustness is a property of the
 * run's sensitivity. Conjoining them under one name is CLAUDE.md trap 21 — the
 * defect this estate has paid for repeatedly — so they are two fields here and
 * every consumer reads the one it means.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ABSENCE
 * ═══════════════════════════════════════════════════════════════════════════
 * A missing `analysis_admission` means a PRE-ADMISSION CEE — the producer has
 * not spoken — and every answer must then be exactly today's behaviour, or
 * this consumer cannot land before the producer half. That is why the two
 * lattice-only answers default TRUE on absence, matching
 * `licensesComparativeLeaderClaim`.
 *
 * Q-LEADER keeps its own tri-state (`true` / `false` / `undefined` = no
 * authority at all), inherited verbatim from `leaderDesignationPermitted`,
 * whose absence arms are deliberately OPPOSITE to Q1's. Consumers therefore
 * test `=== false` to withhold and `=== true` to assert; neither is coerced.
 * Flattening that third value into a boolean here would re-open the exact
 * regression `leaderDesignation.ts` documents.
 */
import { leaderDesignationPermitted } from './leaderDesignation'
import type { AnalysisAdmissionV1, PermittedAnalysisMode } from '../../adapters/cee/types'

/**
 * The one shape every claim site reads. Three questions, three fields, no
 * derived aggregate — an `everythingPermitted` convenience would be the fold
 * this module exists to prevent.
 */
export interface AnalysisClaimPolicy {
  /**
   * May the panel render comparative figures (win probabilities, expected
   * values, deltas between options)?
   *
   * Licensed from `quantified_provisional` upward. This is the answer that
   * keeps a provisional run INFORMATIVE: its numbers are admitted, only its
   * ranking is not.
   */
  mayShowComparativeFigures: boolean
  /**
   * May the panel name a leading option, assert an ordinal, or write a
   * sentence that PRESUPPOSES one ("the leading option could change",
   * "{alt} could gain ground")?
   *
   * `true` permitted · `false` withheld · `undefined` no authority at all
   * (a legacy caller with no verdict and no admission). Read strictly.
   */
  mayNameOrRankLeader: boolean | undefined
  /**
   * May the panel state a stability or robustness verdict — "Stable ranking",
   * "Robust", "held up under the changes we tested"?
   *
   * Licensed by `comparative_leader` only: a strength word is a claim about
   * how a RANKING survived perturbation, and a mode that licenses no ranking
   * licenses no statement about one holding.
   *
   * ⚠ NOT conjoined with this run's separation. Robustness is a property of
   * the run's sensitivity, not of whether the arms separated; folding Q2 in
   * here would make a second question wear this one's name.
   */
  mayStateStability: boolean
}

/** The subset of `DecisionResultData` this reader needs. Structural on purpose. */
export interface ClaimPolicyInput {
  analysisAdmission?: AnalysisAdmissionV1
  leaderDesignationPermitted?: boolean
  verdict?: { hasLeadingOption?: boolean }
}

/**
 * Q-FIGURES. Comparative figures are licensed from `quantified_provisional`
 * upward — that mode's whole meaning is "the numbers are admitted, the ranking
 * is not".
 *
 * Written as an explicit two-member allow-list rather than an ordinal
 * comparison over the lattice: a new mode inserted into the union then fails
 * CLOSED here and must be classified deliberately, instead of inheriting a
 * permission from its position in an array.
 */
function figuresLicensed(mode: PermittedAnalysisMode | undefined): boolean {
  if (mode === undefined) return true
  return mode === 'quantified_provisional' || mode === 'comparative_leader'
}

/**
 * Q-STABILITY. Only `comparative_leader` licenses a strength word — the
 * contract owner's own sentence, `adapters/cee/types.ts`:
 *
 *   "Only `comparative_leader` licenses naming a leading option, an ordinal,
 *    or a strength word ('Stable', 'Robust')."
 *
 * Quoted from the contract, not inferred from the lattice's ordering.
 */
function stabilityLicensed(mode: PermittedAnalysisMode | undefined): boolean {
  if (mode === undefined) return true
  return mode === 'comparative_leader'
}

/**
 * Read all three answers for a run.
 *
 * @param rec the recommendation slice `useResultsSectionData` publishes —
 *            `analysisAdmission` carries the lattice, `leaderDesignationPermitted`
 *            the already-composed leader answer.
 */
export function analysisClaimPolicy(
  rec: ClaimPolicyInput | null | undefined,
): AnalysisClaimPolicy {
  const mode = rec?.analysisAdmission?.permitted_analysis_mode
  return {
    mayShowComparativeFigures: figuresLicensed(mode),
    // QUOTED VERBATIM from the one module entitled to answer it. Not widened,
    // not narrowed, not re-derived — a second copy of this predicate is a
    // second chance to drift, which is the argument `leaderDesignation.ts`
    // itself makes for existing at all.
    mayNameOrRankLeader: leaderDesignationPermitted(rec),
    mayStateStability: stabilityLicensed(mode),
  }
}

/**
 * The single predicate a PROSE site asks before writing a sentence that names
 * or presupposes a leader.
 *
 * Strict `=== false`: absence of authority keeps today's copy, exactly as
 * every other consumer of `leaderDesignationPermitted` does. A `!== true`
 * spelling here would silently blank the prose on every legacy fixture — the
 * regression that module's header records.
 */
export function leaderClaimWithheld(rec: ClaimPolicyInput | null | undefined): boolean {
  return analysisClaimPolicy(rec).mayNameOrRankLeader === false
}
