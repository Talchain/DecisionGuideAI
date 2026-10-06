/**
 * ⭐ P(goal) WITHHELD WHEN A DECLARED IDENTITY ON THE GOAL'S PATH WAS NOT EVALUATED
 * (AIQ #72 5885033487 (2) · DL 5885276225 · producer PLoT #416).
 *
 * The producer withholds `probability_of_goal` on every option and says so with ONE typed inference warning:
 * `{ code: 'GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED', node_ids, message }`. `message` is AIQ's exact words with the
 * graph's labels ("Not shown. '‹X›' depends on ‹A × B›, but this run couldn't calculate it that way, so the figures
 * for each option would be wrong."). The UI reads the typed code, never the reply text, and never composes the
 * sentence itself.
 *
 * ⭐ 29 Sep 2026 (W1/W2): PLoT #422 withholds the SAME figures for a second typed reason, a user's link size cut to
 * the model's scale (`GOAL_FIGURES_USER_EFFECT_CLAMPED`). This reader matches the whole code set
 * (`GOAL_FIGURES_WITHHELD_CODES`), says every reason that applies in the producer's words, and falls back to one
 * cause-neutral sentence.
 *
 * ONE reader for every holder of the enrichment (the V5 mapper, the analysis-snapshot factory, the goal panel and
 * Analysis). The mappers stamp each option so `selectGoalProbability` withholds at EVERY figure site, even if a
 * producer ever sent a figure beside the code (fail-closed).
 */
export const GOAL_IDENTITY_NOT_EVALUATED_CODE = 'GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED'

/**
 * ⭐ PLoT #422 (AIQ #72 5893355501): a USER-STATED link size on the goal's path that was cut to the model's scale.
 * The same carrier withholds the same figures, and the warning says so in its own words ("Not shown. Your size for
 * how ‘A’ moves ‘B’ is bigger than this model's scale can hold, …").
 */
export const GOAL_FIGURES_USER_EFFECT_CLAMPED_CODE = 'GOAL_FIGURES_USER_EFFECT_CLAMPED'

/**
 * EVERY typed reason the producer gives for withholding the goal figures (AIQ #72 5893824972: "Readers should match
 * {GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED, GOAL_FIGURES_USER_EFFECT_CLAMPED} and show the warning's own words").
 * ⚠ `EDGE_STRENGTH_CLAMPED` is NOT in it: that code DISCLOSES a cut the figures do not rest on, and withholds nothing.
 */
export const GOAL_FIGURES_WITHHELD_CODES: readonly string[] = [
  GOAL_IDENTITY_NOT_EVALUATED_CODE,
  GOAL_FIGURES_USER_EFFECT_CLAMPED_CODE,
  // CEE's own withholds (MG #75 5904463351): the placeholder-path withhold (served since #2329) and Gate 5's
  // product-not-read (CEE #2340). Both messages open "Not shown." and are shown verbatim by the one reader.
  'GOAL_FIGURES_PLACEHOLDER_PATH',
  'GOAL_FIGURES_PRODUCT_NOT_READ',
  // CEE #2371 (MG SUCCESSOR #75 5915202903): an `exploratory` run withholds every option's goal figures because the
  // target can't be tested yet; "Not shown. " + the decision-representation sentence, which may end in its one question.
  'GOAL_FIGURES_TARGET_NOT_TESTABLE',
  // CEE #2574 (gate 1 v2, Science 0df0e1): two or more options came out identical in the Run, so their wins split and
  // the comparison is withheld; "Not shown. " + which options came out identical and what the user can do.
  'GOAL_FIGURES_OPTIONS_IDENTICAL',
]

/**
 * Only when the producer's words are missing or unsafe to show. CAUSE-NEUTRAL (AIQ #72 5892977762, 5893824972): the
 * goal figures are withheld for three causes — a formula not evaluated, one not confirmed, a user's size cut — and
 * this sentence fires exactly when none of them has said which, so it names none. AIQ's sentence (5892977762), with
 * "figures" for "chance of reaching": the goal-figure wording guard forbids the latter, and every goal figure is withheld.
 */
export const GOAL_IDENTITY_WITHHELD_FALLBACK =
  "Not shown. Olumi can't give each option's figures for this goal from this run."

export interface GoalIdentityWithheld {
  nodeIds: string[]
  message: string
}

/** snake_case ids or structural characters mean the text is not display-safe. */
const NOT_DISPLAY_SAFE = /\b[a-z0-9]+_[a-z0-9_]+\b|[{}[\]<>]/

export function readGoalIdentityWithheld(holder: unknown): GoalIdentityWithheld | null {
  if (!isPlainObject(holder)) return null
  const warnings = Array.isArray(holder.inference_warnings) ? holder.inference_warnings : []
  const matched = warnings.filter(
    (w): w is Record<string, unknown> =>
      isPlainObject(w) && typeof w.code === 'string' && GOAL_FIGURES_WITHHELD_CODES.includes(w.code),
  )
  if (matched.length === 0) return null
  const nodeIds = [...new Set(matched.flatMap((w) => (Array.isArray(w.node_ids)
    ? w.node_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [])))]
  // Item-3: the target warning states the complete sizing requirement; the placeholder names only a subset.
  // Select words independently of the node/claim scopes, which still retain every matched warning.
  const hasTargetRequirement = matched.some((w) => w.code === 'GOAL_FIGURES_TARGET_NOT_TESTABLE')
  const reasons = hasTargetRequirement ? matched.filter((w) => w.code !== 'GOAL_FIGURES_PLACEHOLDER_PATH') : matched
  const words = reasons.map((w) => (typeof w.message === 'string' ? w.message.trim() : ''))
  // Every independent reason is said, in its own words. If ANY selected reason is missing or unsafe, the cause-neutral
  // fallback stands alone: a partial list would say one cause as if it were the only one.
  const allSafe = words.every((raw) => raw.startsWith('Not shown.') && raw.length <= 400 && !NOT_DISPLAY_SAFE.test(raw))
  return { nodeIds, message: allSafe ? [...new Set(words)].join(' ') : GOAL_IDENTITY_WITHHELD_FALLBACK }
}

/**
 * ⭐ B3 (52f8cd #85 5931020890; CEE B2 per-claim contract): a goal-figure withhold applies PER OPTION × CLAIM, never
 * per run. Each `GOAL_FIGURES_*` warning may carry `option_ids` (absent = every option) and `withheld_claims` (absent =
 * all five). With neither key — every Run before B2 — each warning withholds every claim on every option, which is
 * exactly today's run-wide strip.
 *
 * ⚠ FAIL-CLOSED: an `option_ids` that is not a non-empty string list, or a `withheld_claims` holding a token outside
 * the alphabet, reads as "all": a withhold whose scope can't be read withholds everything it might cover.
 */
export type GoalFigureClaim = 'goal_probability' | 'joint_probability' | 'outcome' | 'downside' | 'win_share'
export const GOAL_FIGURE_CLAIMS: readonly GoalFigureClaim[] = ['goal_probability', 'joint_probability', 'outcome', 'downside', 'win_share']

export interface GoalFigureWithhold {
  code: string
  /** null = every option. */
  optionIds: readonly string[] | null
  claims: ReadonlySet<GoalFigureClaim>
  /** Option ids whose outcome rests on Olumi's estimates the user accepted (label only; withholds nothing). */
  restsOnAcceptedOlumi: readonly string[]
  /** PLACEHOLDER_PATH only: the unsized links the user may accept at Olumi's starting strength. */
  acceptableLinks: ReadonlyArray<{ from: string; to: string }>
}

const nonEmptyStrings = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.length > 0) ? (v as string[]) : null

export function readGoalFigureWithholds(holder: unknown): GoalFigureWithhold[] {
  if (!isPlainObject(holder)) return []
  const warnings = Array.isArray(holder.inference_warnings) ? holder.inference_warnings : []
  return warnings
    .filter((w): w is Record<string, unknown> =>
      isPlainObject(w) && typeof w.code === 'string' && GOAL_FIGURES_WITHHELD_CODES.includes(w.code))
    .map((w) => {
      const listed = nonEmptyStrings(w.withheld_claims)
      const known = listed !== null && listed.every((c) => (GOAL_FIGURE_CLAIMS as readonly string[]).includes(c))
      return {
        code: w.code as string,
        optionIds: nonEmptyStrings(w.option_ids),
        claims: new Set<GoalFigureClaim>(known ? (listed as GoalFigureClaim[]) : GOAL_FIGURE_CLAIMS),
        restsOnAcceptedOlumi: nonEmptyStrings(w.rests_on_accepted_olumi) ?? [],
        acceptableLinks: Array.isArray(w.acceptable_links)
          ? w.acceptable_links.filter((l): l is { from: string; to: string } =>
            isPlainObject(l) && typeof l.from === 'string' && l.from.length > 0 && typeof l.to === 'string' && l.to.length > 0)
          : [],
      }
    })
}

/** The claims withheld for ONE option: the union over every warning that covers it. */
export function withheldClaimsFor(withholds: readonly GoalFigureWithhold[], optionId: string): ReadonlySet<GoalFigureClaim> {
  const out = new Set<GoalFigureClaim>()
  for (const w of withholds) {
    if (w.optionIds !== null && !w.optionIds.includes(optionId)) continue
    for (const c of w.claims) out.add(c)
  }
  return out
}

/** Win shares are one comparison across options: any warning that withholds `win_share` empties them all. */
export function winSharesWithheld(withholds: readonly GoalFigureWithhold[]): boolean {
  return withholds.some((w) => w.claims.has('win_share'))
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * B3b (DL R1 condition 4, 5930827933): the label every kept outcome resting on Olumi's estimates the user accepted
 * carries beside it (B2 `rests_on_accepted_olumi`). The user accepted them, so the figure is usable; they are still
 * Olumi's, so it says whose.
 */
export const RESTS_ON_ACCEPTED_OLUMI_LABEL = "Rests on Olumi's estimates you accepted"
