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
 * The fragility sentence the cue carries on its name and title — MOVED HERE
 * VERBATIM from `StyledEdge`, where it was the badge's own `title`. The number
 * is `fragileEdgeSwitchProb`, from `getFragileEdgeSwitchProbability`, whose
 * docblock names what it renders: *"NN% flip risk" in EdgePanel … and
 * "Sensitive · NN%" on the StyledEdge badge/hover popover*. Its meaning is NOT
 * changed here (a parallel investigation is checking what `switch_probability`
 * measures); only the canvas stops printing it without its noun.
 *
 * Presence-branched: absent means NOT COMPUTED, and the marginal quantity is
 * never a fallback (`StyledEdge.fragilePresence.spec.tsx`).
 */
export function fragileEdgeSentence(switchProbability: number | null): string {
  return switchProbability !== null
    ? `Sensitive assumption: ${Math.round(switchProbability * 100)}% chance the result flips if this relationship changes`
    : 'Sensitive assumption: outcome may flip if this relationship changes'
}

/**
 * The hover popover's fragility line — moved verbatim. It already carried its
 * noun ("flip risk"), the one `fragileEdgeMatch` names for this figure.
 */
export function fragilePopoverLine(switchProbability: number | null): string {
  return switchProbability !== null
    ? `Sensitive: ${Math.round(switchProbability * 100)}% flip risk`
    : 'Sensitive'
}

/**
 * The key's row for the cue. Model-relative ("this model's result") and it
 * DISCLOSES the budget, so a reader who sees one marked connection does not
 * conclude only one matters (purpose audit). No figure: the figure belongs to a
 * connection, on its own cue.
 */
export const LEGEND_SENSITIVE_CAPTION =
  "Sensitive: if this connection changes, this model's result may flip. Standard view marks only the top one."

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
