/**
 * IS EACH 0% / 100% GOAL FIGURE EARNED? — the UI's one reader of CEE's stored fact (schemas 0.63.0
 * `GoalCertaintyDecisionSchema`; producer MG CEE #2270, stored writer + cold read Canonical CEE #2280; DL #72 5887061638:
 * "Canvas's panel consumer follows the stored fact; no UI claim from #2270 alone").
 *
 * An option whose P(goal) is exactly 0 or 1 claims a certainty. It is EARNED only if no link nobody has sized could
 * reverse it. An UNEARNED certainty is never shown as a percentage: the chooser (`selectGoalProbability`) withholds it
 * and the producer's own sentence (`say`, composed from typed members, never free text) is shown instead.
 *
 * ⛔ THE CONTRACT (schemas 0.63.0 `RunAnalysisResultSchema.goal_certainty`; builder #72 5889043895, Canonical 5889052586):
 *   - ABSENT = not recorded, and NEVER earned: a displayed 0/1 is withheld behind the neutral fallback;
 *   - a decision binds by `(option_id, probability_of_goal)`: one for the opposite endpoint attests nothing;
 *   - recorded `[]`: there is no 0/1 to attest, so interior figures show as they are.
 * `goalCertaintyStamp` is the one place that rule is applied.
 *
 * Two legs, one reader (the `limit_verdicts` precedent, `storedLimitVerdicts.ts`): the cold read's
 * `analysis_goal_certainty` and a top-level turn key (asked of Canonical, #72 5887080467), read top level first, then the
 * additive sidecar. Validated against the published contract (mirrored below), never repaired:
 *   - not an array, or ANY entry the contract refuses → `null` (absent: never earned);
 *   - `[]` → recorded, no option at 0 or 1.
 *
 * @claim-producer goal-probability
 * @rationale This is the wire boundary where CEE's stored goal-certainty DECISION enters the UI. It reads the
 *   decision's own `probability_of_goal` (0|1) only to bind the attestation to the endpoint it attests, as the contract
 *   requires. It chooses no displayed figure: display goes through `selectGoalProbability`, which reads the stamp.
 */
import { z } from 'zod'
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

export const GOAL_CERTAINTY_TURN_KEY = 'goal_certainty'
export const GOAL_CERTAINTY_READ_KEY = 'analysis_goal_certainty'

export interface GoalCertaintyEntry {
  readonly optionId: string
  /** The endpoint this decision attests (the decision's own `probability_of_goal`). */
  readonly endpoint: 0 | 1
  readonly earned: boolean
  /** The producer's sentence for an unearned certainty; null when it sent none we can show. */
  readonly say: string | null
}

/** The array from a parsed turn: top level first, then the additive sidecar. */
export function goalCertaintyFromResponse(response: unknown): unknown {
  if (response === null || typeof response !== 'object') return undefined
  const top = (response as Record<string, unknown>)[GOAL_CERTAINTY_TURN_KEY]
  if (top !== undefined) return top
  const additive = (response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return additive?.[GOAL_CERTAINTY_TURN_KEY]
}

/**
 * ⛔ THE PUBLISHED CONTRACT, MIRRORED VERBATIM — `@talchain/schemas` 0.63.0 `GoalCertaintyDecisionSchema`
 * (`olumi-schemas/src/orchestrator/handler-results.ts` @ 5eb351c7). The UI vendors 0.61.0, which predates it, so the
 * schema is copied here rather than re-interpreted field by field: CEE refuses what this refuses (builder #72
 * 5889098845 — e.g. `{earned: true, say}`), and parity is by construction. Delete this copy when the vendored package
 * reaches 0.63.0 and import the schema instead.
 */
const BreakEven = z.object({
  kind: z.enum(['product', 'sum']),
  projected_if_held: z.number().finite(),
  threshold: z.number().finite(),
  operand_id: z.string().min(1),
  fraction: z.number().finite().optional(),
  margin: z.number().finite().optional(),
  operand_count: z.number().finite().optional(),
}).strict().superRefine((b, ctx) => {
  if (b.kind === 'product' && (b.fraction === undefined || b.margin !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fraction'], message: 'a product break-even carries its fraction and no margin' })
  }
  if (b.kind === 'sum' && (b.margin === undefined || b.fraction !== undefined || b.operand_count !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['margin'], message: 'a sum break-even carries its margin, and no fraction or count' })
  }
})
const NoBreakEven = z.enum(['not_an_identity', 'identity_not_evaluated', 'level_from_inputs', 'addends',
  'extra_goal_parent', 'operand_not_parent', 'no_exact_figure'])
const IdentityMismatch = z.object({
  node_id: z.string().min(1),
  reason: z.enum(['operand_not_parent', 'extra_goal_parent']),
}).strict()
const GoalCertaintyDecision = z.object({
  option_id: z.string().min(1),
  probability_of_goal: z.union([z.literal(0), z.literal(1)]),
  earned: z.boolean(),
  unsized_path: z.object({ from: z.string().min(1), enters_goal_through: z.string().min(1) }).strict().optional(),
  identity_mismatch: IdentityMismatch.optional(),
  break_even: BreakEven.optional(),
  no_break_even: NoBreakEven.optional(),
  say: z.string().min(1).max(400).optional(),
}).strict().superRefine((d, ctx) => {
  if (d.earned && (d.unsized_path !== undefined || d.identity_mismatch !== undefined || d.break_even !== undefined
    || d.no_break_even !== undefined || d.say !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['earned'], message: 'an earned certainty carries no path, gap, break-even, reason or sentence' })
  }
  if (!d.earned && ((d.unsized_path === undefined) === (d.identity_mismatch === undefined) || d.say === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unsized_path'], message: 'an unearned certainty names exactly one of its unsized path or its identity mismatch, and its sentence' })
  }
  if (d.identity_mismatch !== undefined && d.no_break_even !== d.identity_mismatch.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['identity_mismatch'], message: 'an identity mismatch is its own no-break-even reason' })
  }
  if (d.unsized_path !== undefined && (d.no_break_even === 'operand_not_parent' || d.no_break_even === 'extra_goal_parent')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unsized_path'], message: 'an identity-mismatch reason claims no graph path' })
  }
  if (!d.earned && (d.break_even === undefined) === (d.no_break_even === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['no_break_even'], message: 'an unearned certainty carries exactly one of break_even or no_break_even' })
  }
})
const GoalCertaintyRecord = z.array(GoalCertaintyDecision)

/**
 * `null` = not recorded, OR REFUSED by the contract (the whole array: the parity rule, Canonical 5888351928 — a record
 * that does not validate is absent, and absent is never earned). `[]` = recorded, no option at 0 or 1.
 */
export function readGoalCertainty(raw: unknown): readonly GoalCertaintyEntry[] | null {
  const parsed = GoalCertaintyRecord.safeParse(raw)
  if (!parsed.success) return null
  return parsed.data.map((d) => ({
    optionId: d.option_id,
    endpoint: d.probability_of_goal,
    earned: d.earned,
    say: d.earned ? null : (d.say ?? null),
  }))
}

/**
 * THE STAMP for one option's DISPLAYED goal figure — the contract, applied once. `null` = show the figure as it is.
 *   - an interior figure (or none) → null: there is no certainty to attest;
 *   - a displayed 0/1 with NO record (`entries` null/undefined) → withheld, fallback (absent is never earned);
 *   - a displayed 0/1 with a decision for THIS option at THIS endpoint → earned: null; unearned: its `say`;
 *   - a displayed 0/1 with no decision at this endpoint (none, or only the opposite one) → withheld, fallback.
 */
export function goalCertaintyStamp(
  displayed: number | undefined,
  optionId: string,
  entries: readonly GoalCertaintyEntry[] | null | undefined,
): { say: string | null } | null {
  if (displayed !== 0 && displayed !== 1) return null
  const match = entries?.find((e) => e.optionId === optionId && e.endpoint === displayed)
  if (match?.earned === true) return null
  return { say: match?.say ?? null }
}

/**
 * Shown in place of an unearned figure when the producer's sentence is missing or unsafe. It names NO cause: an unearned
 * certainty has three (`unsized_path`, `identity_mismatch`, `unchecked`), and the producer's `say` carries the real one
 * (AIQ #72 5888121329). Asks nothing of the user.
 */
export const GOAL_CERTAINTY_UNEARNED_FALLBACK = "Not shown as certain: Olumi can't yet confirm this result."
