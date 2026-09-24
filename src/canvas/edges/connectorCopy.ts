/**
 * connectorCopy — THE WORDS OF THE LOCKED CONNECTOR GRAMMAR, spelled once.
 *
 * Experience Design, 23 Sep 2026 (§6 "Connectors"), refining the Canvas Final
 * spec §5: thickness = relationship magnitude · colour/sign = direction ·
 * dash = existence certainty ONLY · orange = AI-review SIGN disagreement only ·
 * fragility = a discreet exception cue · no "contested" without attributable
 * human disagreement · labels must not be verbose.
 *
 * WHY ONE MODULE. Three surfaces describe the same connector states — the edge
 * (its cue, its chip and its hover), the "How to read this" key, and the
 * connection's inspector — and every one of them has, at some point in this
 * estate's history, told a different story about the same edge (the key's
 * "Solid connection: established", the chip's bare "Sensitive · 49%", the card's
 * "Not set yet" beside an edge's "Strong boost est."). A sentence each surface
 * IMPORTS cannot drift between them (trap 12).
 *
 * ⛔ NONE OF THESE MAY SAY "contested", AND NONE MAY PRINT A BARE FLIP FIGURE.
 * `edges/__tests__/connectorCopyHonesty.spec.tsx` enforces both over every
 * perceivable string the edge and the key render.
 *
 * ⚠ LINK-STRENGTH WORDS ARE NOT SPELLED HERE (design integration, 23 Sep
 * 2026). They are the node-card register's (`LINK_STRENGTH_COPY` in
 * `nodes/shared/metricVocabulary.ts`), which the card rows, `EdgePills`, the
 * reduced line and the legend already read — so the edge hover and the card
 * cannot say one state two ways again (MT-15b). Pinned by
 * `edges/__tests__/linkStrengthOneSource.spec.ts`.
 */
import { LINK_STRENGTH_COPY } from '../nodes/shared/metricVocabulary'

// ── The sign disagreement (the ONE disagreement that reaches the line) ──────

/**
 * What orange on a connection means. Experience Design's banked D3 wording
 * (lane LOG 02:25Z, 23 Sep 2026), with "— your call" dropped as they ruled:
 * a demand for a verdict before the reader has seen the two readings.
 *
 * "Olumi's two review passes", not "our reviews" — the purpose audit found three
 * names for this one mechanism, and "our reviews" reads as people.
 */
export const DIRECTION_DISPUTED_SENTENCE = "Olumi's two review passes disagree on direction"

/**
 * The hover's second line on a sign-disputed connection: the direction the
 * MODEL currently runs on, named as that and nothing more. It is the first
 * pass's reading (`ValidationMetadata.pass1` — "what the graph currently
 * uses"), which the stroke, glyph and label all still reflect; saying so is
 * what stops the popover presenting a disputed sign as a settled one.
 */
export function directionInUseSentence(directionWord: string): string {
  return `The model uses ${directionWord} for now. Open the connection to compare both readings.`
}

// ── The arrow sentence — the popover's own first line (contract §03) ────────

/**
 * ⭐ ROW 29 — contract §03's lead sentence: "<A> → <B>. Positive direction in
 * this model." The popover this ships onto is not replaced: it keeps its
 * editing affordances ("Set strength", "Ask Olumi…") the contract's plain
 * tooltip has none of, and this sentence is ADDED ahead of that content as its
 * first line.
 *
 * The direction word is never re-derived here: the caller passes the SAME
 * `dirLabel` the popover's own bold Direction row already reads (itself built
 * from `statedDirection` / `resolveEdgeDirectionDisplay` — one resolver for
 * the stroke, the glyph and this sentence, CLAUDE.md trap 12). `null` means
 * unstated/defaulted, and this says so HONESTLY, in the estate's own already-
 * ratified words for that state (`domain/edgeLabels.describeEdge`: "…effect,
 * direction not stated") — never a guessed sign.
 */
export function edgeArrowSentence(
  sourceLabel: string,
  targetLabel: string,
  directionWord: 'Positive' | 'Negative' | null,
  /**
   * ⛔ A DISPUTED SIGN IS NOT A FACT (review 5823365172). When Olumi's own
   * review disputes the sign, the arrow is stated alone: the popover's
   * disputed block names the direction inside a sentence that says it is
   * disputed. "Not stated" would be false too — a direction IS stated.
   */
  opts?: { readonly signDisputed?: boolean },
): string {
  if (opts?.signDisputed) return `${sourceLabel} → ${targetLabel}.`
  const clause = directionWord === null
    ? 'Direction not stated in this model.'
    : `${directionWord} direction in this model.`
  return `${sourceLabel} → ${targetLabel}. ${clause}`
}

/**
 * §03's existence-doubt sentence, appended to the arrow sentence ONLY when a
 * doubt is actually recorded. The caller binds this to `existenceDash` —
 * `resolveExistenceDash`'s own `{ kind: 'stated', dash: string }` arm, the
 * SAME field that draws the dashed stroke (`edgePresentation.resolveEdgeDash`)
 * — never a second "doubt" concept invented for this sentence alone.
 */
export const EDGE_EXISTENCE_DOUBT_SENTENCE =
  'A doubt was recorded about whether this relationship exists.'

// ── The key's line-style and colour rows ────────────────────────────────────

/**
 * ⚠ SCOPED TO THE MODEL, AND THAT IS THE FIX. Once a review disagreement stopped
 * dashing the line, a SOLID line could carry one — an `existence_boundary_
 * crossing` where the model's likelihood clears 0.7 and the review's does not.
 * "No doubt recorded" was then false of it (purpose audit, DRIFT-RISK on the
 * banked draft). What a solid line actually reads is the likelihood the MODEL
 * runs on (`ValidationMetadata.pass1`, or nobody's at all), so that is what this
 * caption states — and `LEGEND_OTHER_REVIEW_CAPTION` says where the review's
 * view lives.
 */
export const LEGEND_SOLID_CAPTION = 'Solid: the model records little or no doubt that this connection exists'

/** Experience Design's banked D3 wording, verbatim. Existence and nothing else. */
export const LEGEND_DASHED_CAPTION = 'Dashed: lower certainty that this connection exists is recorded'

export const LEGEND_ORANGE_CAPTION = `Orange: ${DIRECTION_DISPUTED_SENTENCE}`

/**
 * Where every OTHER review disagreement lives: the connection's inspector
 * (`EdgeReviewDisagreement`), and nowhere on the line. Without this row the key
 * describes the canvas truthfully and still hides that the review exists.
 */
export const LEGEND_OTHER_REVIEW_CAPTION = 'Other review disagreements: shown when you open the connection'

// ── Thickness ───────────────────────────────────────────────────────────────

/**
 * ⚠ THE SAME IN BOTH PHASES, BECAUSE THE CANVAS IS. Spec §5 asks the key to say
 * "thicker = greater relative consequential importance" after a run — "only if
 * the code actually switches". It does not: `StyledEdge`'s P2.9 note pins width
 * to weight magnitude in both phases (a Paul-approved encoding change), and
 * Experience Design's ruling is "thickness = relationship magnitude". A key that
 * switched its wording at run time would describe a switch the line never makes.
 */
export const LEGEND_THICKNESS_CAPTION = 'Thicker line: a stronger modelled relationship, before and after a run'

// ── Fragility ───────────────────────────────────────────────────────────────

/**
 * ⭐ THE ONE FRAGILITY SENTENCE — Paul 23 Sep contract feedback point 4.
 *
 * "Remove the warning-triangle + red/dashed + 'Sensitive' pile-up. One discreet
 * fragility cue." The cue is a neutral mark; this is the sentence its name, its
 * hover title, the connection's hover popover and the key all carry. It is
 * model-relative ("the current model comparison", the words Paul's point 3 uses
 * for the turning point) and names no winner, so it cannot read as advice.
 *
 * ⛔ No "Sensitive" label and no warning vocabulary: a sensitive relationship
 * is not automatically weak or wrong (the contract's own inspector wording).
 *
 * ⚠ NO SIZE CLAIM (reviewer blocker on point 4, 23 Sep). An earlier wording said
 * "Small changes here …" while the inspector tooltip on the SAME figure said
 * "changes significantly": one number, two contradictory magnitudes, and
 * neither established (what `switch_probability` measures is still under
 * investigation). The sentence therefore names the change without sizing it,
 * and `EDGE_COPY.flipRiskTooltip` is composed from `fragileEdgeSentence` so the
 * two can never disagree again.
 */
export const FRAGILE_CUE_SENTENCE = "If this connection's strength changes, the current model comparison could change"

/**
 * The fragility sentence the cue carries on its name and title, and — since
 * Paul 23 Sep contract feedback point 4 — the hover popover's fragility line
 * too: ONE sentence for one cue, where there used to be three spellings
 * ("Sensitive assumption: …", "Sensitive: NN% flip risk", and the key's
 * "Sensitive: …"). The number is `fragileEdgeSwitchProb`, from
 * `getFragileEdgeSwitchProbability`, stated WITH the noun `fragileEdgeMatch`
 * gives it ("NN% flip risk"). Its meaning is NOT changed here (a parallel
 * investigation is checking what `switch_probability` measures); only the
 * canvas stops calling the connection "Sensitive" and stops printing the
 * figure without its noun.
 *
 * Presence-branched: absent means NOT COMPUTED, and the marginal quantity is
 * never a fallback (`StyledEdge.fragilePresence.spec.tsx`).
 */
export function fragileEdgeSentence(switchProbability: number | null): string {
  return switchProbability !== null
    ? `${FRAGILE_CUE_SENTENCE} (${Math.round(switchProbability * 100)}% flip risk)`
    : FRAGILE_CUE_SENTENCE
}

/**
 * The key's row for the cue. Model-relative, and it DISCLOSES the budget, so a
 * reader who sees one marked connection does not conclude only one matters
 * (purpose audit). No figure: the figure belongs to a connection, on its own
 * cue. The budget is named by the quantity that actually picks the connection
 * (`isTopFragileEdge` takes the highest MEASURED flip risk).
 *
 * (The export keeps its old name so no reader outside this lane moves; its
 * words no longer say "Sensitive" — Paul 23 Sep contract feedback point 4.)
 */
export const LEGEND_SENSITIVE_CAPTION =
  `${FRAGILE_CUE_SENTENCE}. Standard view marks only the connection with the highest flip risk.`

// ── Link strength, as the edge's hover names it ─────────────────────────────

/**
 * The noun the cards already use for a connection's strength (`EdgePills`,
 * `PreAnalysisInboundRows`: "Link strength"), and the one the node-card PR puts
 * on the outcome and risk cards ("Link strength · Olumi’s estimate") — READ
 * from that register, never re-typed here. The edge's
 * hover used to show a bare bar and a percentage with no noun at all, so the
 * card and the edge described one state two ways (manual test MT-15b).
 */
export const LINK_STRENGTH_NOUN = LINK_STRENGTH_COPY.noun

/**
 * The hover's caption for the strength row.
 *
 * ⛔ THE AUTHOR IS NAMED FROM THE DATA, NEVER ASSUMED TO BE OLUMI — the same
 * rule `unconfirmedStrengthDisclosure` keeps: `'template'` is a template
 * author's figure, and an unrecognised source gets the agentless word.
 * ⚠ "Unconfirmed" is `!strengthIsHumanSettled` — the ONE admission — never a
 * raw source read, so an adjudicated `accepted_pass2` (stamped `'cee'`) reads
 * as settled.
 */
export function linkStrengthCaption(
  unconfirmed: boolean,
  source: 'user' | 'cee' | 'template' | null,
): string {
  if (!unconfirmed) return LINK_STRENGTH_NOUN
  const whose =
    source === 'cee'
      ? LINK_STRENGTH_COPY.olumiEstimate
      : source === 'template'
        ? LINK_STRENGTH_COPY.templateEstimate
        : LINK_STRENGTH_COPY.estimate
  return `${LINK_STRENGTH_NOUN} · ${whose}`
}
