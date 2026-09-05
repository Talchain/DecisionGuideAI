/**
 * Edge Label Utilities
 *
 * v1.2: Converts technical weight/belief pairs into meaningful human-readable labels.
 * Uses British English and plain language to make edges accessible to non-technical users.
 */

import type { EdgeDirectionDisplay, EdgeValueDisplay } from './edgeValueProvenance'

export type EdgeLabelMode = 'human' | 'numeric'

const STORAGE_KEY = 'canvas.edge-labels-mode'

/**
 * Get the current edge label mode from localStorage
 * Defaults to 'human' for better UX
 */
export function getEdgeLabelMode(): EdgeLabelMode {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'human'
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'numeric') return 'numeric'
    return 'human'
  } catch {
    return 'human'
  }
}

/**
 * Set the edge label mode in localStorage
 */
export function setEdgeLabelMode(mode: EdgeLabelMode): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Fail silently if storage is unavailable
  }
}

export interface EdgeDescription {
  label: string
  tooltip: string
}

/**
 * The likelihood at or above which the label STOPS HEDGING.
 *
 * ⚠⚠ THIS DELIBERATELY DIFFERS FROM `EDGE_VALUE_BAND_CUTS`, AND THE DIFFERENCE
 * IS PINNED BY A TEST SO IT CANNOT DRIFT SILENTLY.
 * ---------------------------------------------------------------------------
 * `EDGE_VALUE_BAND_CUTS` (`edgeValueProvenance.ts`, `{ high: 0.7, moderate:
 * 0.4 }` — TWO cuts, four bands counting `unset`) answers **"which colour band
 * is this number in?"**. Its one non-test consumer is `EdgePanel`, which reads
 * it through `edgeValueBand` for the existence slider's colour and track-fill
 * (`EdgePanel.tsx:230`). It exists because those cuts were once a hand-copied
 * literal in three places.
 *
 * `LABEL_HEDGE_CUT` answers a DIFFERENT question: **"is this number confident
 * enough that a sentence about the effect should carry no caveat?"** It is
 * binary and it governs prose rather than colour, so nothing obliges it to
 * equal a band cut — and forcing it to would be CLAUDE.md trap 21 done
 * backwards: two questions collapsed under one number because the numbers
 * looked like they ought to match.
 *
 * ⚠ WHAT THIS BLOCK IS NOT ENTITLED TO SAY, and used to. It claimed
 * `RelationshipsSection`'s likelihood swatch as a second consumer of the
 * registry, and it claimed "there is no value of `LABEL_HEDGE_CUT` that makes
 * the two agree". Both were false, and measurably so:
 *   · `RelationshipsSection` does NOT read the registry. It hand-copies
 *     `>= 70 / >= 40` on the ROUNDED percentage
 *     (`components/model-tab/RelationshipsSection.tsx:210`), which the
 *     registry's own header forbids ("Cut on the RAW value, never on a rounded
 *     percentage"). So this field carries a THIRD scale, not two, and that
 *     third one is a live instance of the mirror the registry was written to
 *     abolish. It is NOT pinned by this file's tests and it needs the model-tab
 *     owner — naming it here is the whole of what this lane did about it.
 *   · Setting `LABEL_HEDGE_CUT` to `0.4` would make hedging mean exactly "band
 *     is `low`"; setting it to `0.7` would make it mean exactly "band is not
 *     `high`". Either lands the binary boundary ON a band boundary and leaves
 *     no band split down the middle. The honest claim is the narrow one — the
 *     two answer different questions, so they need not share a cut — not the
 *     flattering one that they could not share a cut if they tried.
 *
 * ⚠ THE CONSEQUENCE, STATED PLAINLY RATHER THAN HIDDEN: the two scales
 * disagree on `[0.4, 0.6)` and `[0.6, 0.7)`. At `beliefExists = 0.45` the
 * canvas label says "(uncertain)" while the inspector bands the same number
 * **moderate/amber**; at `0.65` the label hedges nothing while the inspector
 * still says **moderate**. That is a real, reachable copy inconsistency (the
 * EdgePanel existence slider reaches both), and it is a COPY DECISION — which
 * cut is right for prose — not a defect this PR is entitled to settle by
 * picking a number.
 *
 * ⭐ IT IS ROWED, AS **S58** in `CANVAS-BACKLOG.md` (`Talchain/olumi-programme-docs`,
 * `origin/main`) — and that row states this divergence in the same terms this
 * block does, down to the two reachable windows at 0.45 and 0.65. The row's
 * open item is the one this block declines to settle: *whether prose should
 * hedge at 0.6 or at the registry's 0.7.* **It is a copy decision, and it is
 * owed.**
 *
 * ⚠ THIS SENTENCE SAID THE OPPOSITE — "AND IT IS NOT ROWED ANYWHERE" — AND IT
 * WAS FALSE. Kept in the record rather than quietly swapped, because the
 * correction is the lesson: the original was itself written to correct an
 * *earlier* draft that claimed a row, and it over-corrected. Twice in a row,
 * on one sentence, in opposite directions.
 *
 * ⚠⚠ AND THE OBVIOUS EXPLANATION IS WRONG — THIS IS THE THIRD VERSION OF THIS
 * PARAGRAPH, IN THE THIRD DIRECTION, AND THE FIRST TWO EACH SOUNDED FINISHED.
 * A draft here said the probe that "proved" the absence WAS BLIND. It was not.
 * `#1171`'s sweep carried a contrast control proving it saw rows S45–S49, and
 * it was reading the pushed copies correctly. **Measured across the three
 * `CANVAS-BACKLOG.md` paths in `Talchain/olumi-programme-docs`, as at
 * 2026-09-05** (contrast `S45`, negative control `S900`): `S58` entered at
 * `593de90b`, 2026-09-03T23:42:23Z — **34 seconds** before `#1171`'s own
 * squash. Until that moment the row lived only in the local
 * `Documents/GitHub` working copy, which is NOT A GIT REPOSITORY. A sighted,
 * correctly-controlled sweep of the pushed copies returned zero because the
 * row was genuinely not in them.
 *
 * ⚠ THAT SENTENCE IS SCOPED ON PURPOSE, AND AN EARLIER DRAFT OF IT WAS NOT.
 * It read "`S58` has appeared in exactly ONE commit and ONE path" — a
 * repo-wide count, which was **already false when it was written** (a session
 * note on another branch mentions the row) and which drifts every time anyone
 * writes the string. Naming the paths searched and the date is what the lesson
 * below actually demands; a bare count names neither.
 *
 * ⭐⭐ SO THE DEFECT WAS SCOPE, NOT BLINDNESS (CLAUDE.md trap 20): "absent from
 * the pushed register" was recorded as "NOT ROWED ANYWHERE". And the lesson
 * the blind-probe draft prescribed — *an absence claim is only as good as a
 * control run in the same sweep* — WOULD NOT HAVE PREVENTED IT, because `#1171`
 * already had one. A remedy that the defect already satisfies teaches the next
 * reader to repeat it, which is worse than no remedy at all.
 *
 * THE LESSON THAT DOES BITE: **the register this estate treats as canonical is
 * routinely edited in a directory that is not under version control, so
 * "swept the repo" and "swept the register" are DIFFERENT CLAIMS.** An
 * absence claim must name the artefact searched and the moment it was searched
 * — not merely prove the instrument could see.
 *
 * Re-derived for this block against `origin/main`: `S58` present, contrast
 * control `S45` reading **1**, negative control `S900` reading **0**, so the
 * instrument discriminates. (A first attempt anchored on a table-row pattern
 * and returned **zero for the contrast too** — which voids a run rather than
 * cleaning it.) The row's line number is deliberately not restated here: it is
 * another repo's numbering and would drift silently.
 *
 * What the constant still buys is unchanged: the divergence is NAMED, ADJACENT
 * to the registry it differs from, and asserted in `edgeLabels.spec.ts` — so it
 * can only change on purpose.
 *
 * The value is unchanged from the bare `0.6` literal that stood here. Nothing
 * about the product's behaviour moves with this constant's introduction.
 */
export const LABEL_HEDGE_CUT = 0.6

/**
 * Describe an edge in human-readable terms based on strength and belief
 *
 * Weight scale (applied to the RESOLVED strength's magnitude):
 * - Strong: |w| >= 0.7
 * - Moderate: 0.3 <= |w| < 0.7
 * - Weak: |w| < 0.3
 *
 * Likelihood scale — TWO OUTCOMES, not four bands. See `LABEL_HEDGE_CUT`:
 * - Set and >= the hedge cut → no qualifier
 * - Set and <  the hedge cut → "(uncertain)"
 * - NOT set                  → "(likelihood not set)"
 *
 * ⚠ THIS BLOCK USED TO READ "High: b >= 80% / Medium: 60% <= b < 80% / Low:
 * b < 60% / Undefined: treat as uncertain", and every line of it was either
 * false or decorative. `High` and `Medium` named bands the function never
 * emitted — both produce no qualifier, so the 80% cut described nothing. And
 * "Undefined: treat as uncertain" is precisely the behaviour this function was
 * changed to STOP: an unset likelihood now says so instead of being reported as
 * a low one. A reader going top-down met the false line ~50 lines before the
 * capitalised block that contradicts it.
 *
 * ⚠⚠ THE STRENGTH IS A RESOLVED DISPLAY, NOT A RAW NUMBER (ROADMAP 2.950).
 * ------------------------------------------------------------------------
 * The direction gate below (2.935) closed one clause of this string and left
 * the other open: `StyledEdge` passed `edgeData?.weight ?? 0.5`, and the edge
 * defaults (`DEFAULT_EDGE_DATA.weight = 0.5`, `USER_EDGE_DEFAULTS.weight =
 * 0.3`) define `weight` on every edge whether anyone set it or not. So an edge
 * whose strength NOBODY characterised read "Moderate effect, direction not
 * stated" — the direction half refusing to claim while the strength half
 * asserted a band derived from a UI constant.
 *
 * The parameter is now a required `EdgeValueDisplay`, resolved by
 * `resolveEdgeSignedStrengthDisplay` — the SAME resolver that already gates
 * this component's stroke width — for the same reason the direction parameter
 * is an `EdgeDirectionDisplay`: there is no argument that means "0.5, source
 * unknown", so a defaulted number cannot produce a band adjective by accident
 * and cannot be forgotten.
 *
 * When the strength resolves `show: false`, the value inside is used for
 * NOTHING — not the band, not the tooltip number. When it resolves `show:
 * true`, only its MAGNITUDE is read, exactly as `weight` before it: the sign
 * of `resolveEdgeSignedStrengthDisplay`'s value is NOT a direction claim (its
 * header forbids reading it as one, in capitals) — the direction argument
 * remains the one owner of that word.
 *
 * COPY (ratified, ROADMAP 2.950): when NEITHER strength nor direction is set,
 * the label reuses the hover popover's existing vocabulary — "Strength and
 * likelihood not set" (`edge-hover-popover-unset` in `StyledEdge`) — one
 * phrase for one concept, no new copy. When exactly one half has provenance,
 * that half speaks and the other says only that it was not set.
 *
 * ⚠⚠ THE LIKELIHOOD IS NOW A PROVENANCE-GATED DISPLAY, FROM THE SAME OWNER THE
 * POPOVER READS — AND THAT CLOSED A CONTRADICTION INSIDE ONE COMPONENT.
 * ---------------------------------------------------------------------------
 * This parameter used to be `belief: number | undefined`, and `StyledEdge`
 * passed `edgeData?.belief` — the v3 legacy scalar, marked `@deprecated` in
 * `edges.ts:196`, whose only writer (per `analyticalNodeFields.ts:241`) is the
 * DEAD v1 edge inspector. Nothing on the live path writes it. So `belief` was
 * `undefined` on every edge CEE drafts, `confidence` fell to `'uncertain'`, and
 * EVERY label this function produced carried the qualifier — measured by
 * running `describeEdge` over the 3 Sep 2026 capture: 24 edges, 24
 * "(uncertain)".
 *
 * ⚠ THAT FIGURE MEASURES THIS FUNCTION, NOT THE CANVAS, and an earlier draft
 * said "EVERY edge label on the canvas". How many of the 24 a user saw is NOT
 * established by the capture and no number for it is asserted here: labels are
 * gated by `shouldShowEdgeLabel`, which requires a COMPLETED RUN, excludes
 * structural edges, and then admits only the top-strength persistent set —
 * capped at `PERSISTENT_LABEL_LIMIT` (3) — plus interaction-driven labels in
 * Detailed/Model view. "24 of 24 causal edges are structural, so 15 were
 * painted" is the same over-read one step smaller: it counts non-structural
 * edges, not painted labels. What IS established, and is all the diagnosis
 * needs: every label this function returned carried the word, so no painted
 * label could have escaped it (CLAUDE.md trap 20 — a row minted from this must
 * restate this scope, not the generalisation).
 *
 * Meanwhile the hover popover in the SAME component resolved
 * `resolveEdgeValueDisplay(edgeData, 'beliefExists')` and rendered
 * "80% confident" for those same edges, from `exists_probability`, stamped
 * `beliefExistsSource: 'cee'`. One edge, two surfaces, two answers to one
 * question — CLAUDE.md trap 21, with the two spellings a grep could not pair
 * because they are different words for the same thing.
 *
 * `beliefExists` is the ONE OWNER of "how likely is it that this relationship
 * exists?" — already consulted by the popover, by the dashed-stroke existence
 * styling, and by the Model tab's Relationships rows. The label now asks it
 * too, through the same resolver, rather than keeping a second opinion. The
 * parameter is an `EdgeValueDisplay` for the same reason `strength` and
 * `direction` already are: there is no argument that means "0.5, source
 * unknown", so a defaulted likelihood cannot produce a confidence word by
 * accident and cannot be forgotten. (The old signature took a bare number and
 * silently rendered `b NaN%` when handed the wrong shape.)
 *
 * The empty-state arm's SENTENCE now matches its gate. It named likelihood
 * while its predicate never consulted one; with a real channel available,
 * "Strength and likelihood not set" is reserved for the case where the
 * likelihood is genuinely absent too, and an edge with a known likelihood but
 * no strength says only that the strength is not set.
 *
 * ⚠⚠ THE DIRECTION IS AN ARGUMENT, NOT AN INFERENCE (ROADMAP 2.935, Codex MF5).
 * ----------------------------------------------------------------------------
 * This function used to compute `const isPositive = weight >= 0` and pick
 * "boost" or "drag" from it. Its only product caller — `StyledEdge` via
 * `getEdgeLabel` — passes `edgeData.weight`, and BOTH ingestion paths store that
 * as an UNSIGNED MAGNITUDE beside a separate direction field:
 *
 *     const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))   // UI-SEM-023
 *
 * So `weight >= 0` was true for every edge in the product, and every causal edge
 * on the canvas read "boost" — including the ones CEE sent a NEGATIVE
 * `strength.mean` for. A factor the model says REDUCES the goal was labelled
 * "Moderate boost (uncertain)" while the glyph beside it announced "Effect
 * direction: negative".
 *
 * `weight` is now used ONLY for its magnitude — the sign of the argument is
 * ignored deliberately, so no caller can smuggle a direction claim back in
 * through a number.
 *
 * The parameter is REQUIRED, and typed as `EdgeDirectionDisplay` rather than a
 * bare `'positive' | 'negative'`, for the same reason `computeDirectionStroke`
 * (ROADMAP 2.928) and `getDirectionalStrengthLabel` (2.263) take one: there is
 * no argument that means "positive, source unknown", so an unstated direction
 * cannot produce a signed word by accident and cannot be forgotten.
 * `resolveEdgeDirectionDisplay` is the ONE OWNER of that answer for canvas edge
 * data — do not add a second predicate here (CLAUDE.md trap 21).
 *
 * ⚠ Do NOT "fix" a caller by re-signing the weight from
 * `resolveEdgeSignedStrengthDisplay` instead. That module's header forbids it in
 * capitals — an unstated direction lands there as `+1`, so a word read off that
 * sign would fabricate "boost" on exactly the edges this gate exists to protect.
 *
 * Direction:
 * - Direction STATED positive → boost/increase/push
 * - Direction STATED negative → drag/decrease/hinder
 * - Direction NOT STATED      → name the magnitude, say the direction was never
 *   stated. Same vocabulary as `getDirectionalStrengthLabel`, deliberately: one
 *   phrase for one concept across the canvas and the Model tab.
 *
 * British English spelling throughout
 */
export function describeEdge(
  strength: EdgeValueDisplay,
  likelihood: EdgeValueDisplay,
  direction: EdgeDirectionDisplay,
): EdgeDescription {
  // The magnitude this label is entitled to speak about — null when nothing
  // proves anyone set a strength. See the header: the display's value is used
  // for NOTHING in that case.
  const absWeight = strength.show ? Math.abs(strength.value) : null

  let claim: string
  if (absWeight !== null) {
    // Categorize strength
    const strengthLabel = absWeight >= 0.7 ? 'Strong' : absWeight >= 0.3 ? 'Moderate' : 'Weak'
    // Absence stays absence: name the magnitude, and say plainly that the
    // direction was never stated rather than picking one.
    claim = direction.show
      ? `${strengthLabel} ${direction.direction === 'positive' ? 'boost' : 'drag'}`
      : `${strengthLabel} effect, direction not stated`
  } else if (!direction.show) {
    // Neither strength nor direction has provenance. The ratified popover copy
    // names LIKELIHOOD as well, so it may only be spoken when the likelihood is
    // genuinely absent too — otherwise the label would deny a number the
    // popover is at that moment rendering.
    if (!likelihood.show) {
      return {
        label: 'Strength and likelihood not set',
        tooltip: buildWeightTooltip(null, likelihood, direction),
      }
    }
    // A known likelihood, but nothing stated about the effect itself: say only
    // what is missing, and let the qualifier below report the likelihood band.
    claim = 'Strength not set'
  } else {
    // Direction stated, strength not set: the stated half speaks, the unset
    // half says so — same clause shape as the direction arm above, same
    // "not set" vocabulary as the popover and the tooltip below.
    claim = `${direction.direction === 'positive' ? 'Boost' : 'Drag'}, strength not set`
  }

  // Categorise the likelihood — ONLY when one was actually set. An unset
  // likelihood is not a low one: "(uncertain)" is a verdict about a number we
  // have, and saying it about a number nobody supplied is the fabrication this
  // gate exists to stop.
  let label: string
  if (!likelihood.show) {
    label = `${claim} (likelihood not set)`
  } else if (likelihood.value < LABEL_HEDGE_CUT) {
    label = `${claim} (uncertain)`
  } else {
    label = claim
  }

  return { label, tooltip: buildWeightTooltip(absWeight, likelihood, direction) }
}

/**
 * The numeric half of the tooltip, shared by both label modes so the sign rule
 * lives once. The minus sign is a DIRECTION CLAIM and is printed only when the
 * direction was stated; an unstated direction prints the bare magnitude, which
 * is all we are entitled to say about it.
 *
 * `absWeight: null` means NO SET STRENGTH (ROADMAP 2.950): the tooltip prints
 * "not set" — the same vocabulary its own belief clause has always used — and
 * no sign, because the minus decorates a number and there is no number.
 */
function buildWeightTooltip(
  absWeight: number | null,
  likelihood: EdgeValueDisplay,
  direction: EdgeDirectionDisplay,
): string {
  const beliefText = likelihood.show ? `${Math.round(likelihood.value * 100)}%` : 'not set'
  const weightText =
    absWeight !== null ? `${signPrefix(direction)}${absWeight.toFixed(2)}` : 'not set'
  return `Weight: ${weightText}, Belief: ${beliefText}`
}

/** '−' (U+2212 MINUS SIGN) only for a STATED negative direction; '' otherwise. */
function signPrefix(direction: EdgeDirectionDisplay): string {
  return direction.show && direction.direction === 'negative' ? '−' : ''
}

/**
 * Format edge label in numeric format (legacy)
 * Example: "w −0.60 • b 85%"
 *
 * Same gates as `describeEdge`, for the same reasons:
 * - the leading minus is a direction claim, and the magnitude reaches here
 *   unsigned. Before ROADMAP 2.935 this printed `w 0.35` for an edge whose CEE
 *   mean was −0.35 — the numeric channel did not invert the claim, it silently
 *   DELETED it.
 * - the number itself is a strength claim (ROADMAP 2.950). Before the gate
 *   this printed `w 0.50` — the `DEFAULT_EDGE_DATA` constant, verbatim — for an
 *   edge whose strength nobody set. An unset strength now prints `w not set`;
 *   the sign gate is moot in that state because there is no number to sign.
 */
export function formatNumericLabel(
  strength: EdgeValueDisplay,
  likelihood: EdgeValueDisplay,
  direction: EdgeDirectionDisplay,
): string {
  const weightText = strength.show
    ? `${signPrefix(direction)}${Math.abs(strength.value).toFixed(2)}`
    : 'not set'

  if (likelihood.show) {
    return `w ${weightText} • b ${Math.round(likelihood.value * 100)}%`
  }

  return `w ${weightText}`
}

/**
 * Does the label `getEdgeLabel` will render actually STATE which way the effect
 * goes?
 *
 * ⛔ THIS IS THE DICHROMAT CHANNEL'S GATE, and it lives HERE — beside the two
 * functions that emit the label — because it is a claim about what THEY print.
 * Asking the question anywhere else means re-deriving their behaviour from
 * outside, which is how one datum ends up with two spellings (CLAUDE.md trap
 * 21). Both arms mirror their emitter exactly:
 *
 *   · HUMAN (`describeEdge`): every arm that has a stated direction prints
 *     `boost`/`drag` — including "Boost, strength not set" — and every arm
 *     without one says "direction not stated". So: `direction.show`.
 *   · NUMERIC (`formatNumericLabel`): direction rides `signPrefix`, which emits
 *     U+2212 for a stated NEGATIVE and NOTHING for a stated positive. And the
 *     sign only reaches the string when there is a magnitude to sign — an unset
 *     strength prints "not set". So: stated, negative, AND `strength.show`.
 *
 * The asymmetry is the whole point. `w 0.60 • b 85%` is a stated POSITIVE that
 * names no direction, so a caller suppressing its own polarity signal on the
 * strength of "the label says it" would be wrong exactly there — and nowhere
 * else. Callers must not widen this to "numeric never carries direction": the
 * negative case genuinely does.
 */
export function labelCarriesDirection(
  strength: EdgeValueDisplay,
  direction: EdgeDirectionDisplay,
  mode?: EdgeLabelMode,
): boolean {
  if (!direction.show) return false
  const actualMode = mode ?? getEdgeLabelMode()
  if (actualMode === 'numeric') {
    return strength.show && direction.direction === 'negative'
  }
  return true
}

/**
 * Get the appropriate edge label based on current mode.
 *
 * `strength` and `direction` sit BEFORE the optional `mode` so neither can be
 * omitted — the whole point of the ROADMAP 2.935 + 2.950 gates. See
 * `describeEdge`'s header.
 */
export function getEdgeLabel(
  strength: EdgeValueDisplay,
  likelihood: EdgeValueDisplay,
  direction: EdgeDirectionDisplay,
  mode?: EdgeLabelMode,
): EdgeDescription {
  const actualMode = mode ?? getEdgeLabelMode()

  if (actualMode === 'numeric') {
    const numericLabel = formatNumericLabel(strength, likelihood, direction)
    return {
      label: numericLabel,
      tooltip: numericLabel
    }
  }

  return describeEdge(strength, likelihood, direction)
}
