/**
 * guards — the repo's canonical runtime type guards for untyped wire values.
 *
 * WHY THIS FILE EXISTS. The plain-object guard had **eight** definitions across
 * `src/`: one exported (`canvas/conversation/ceeRecovery.ts`, reached by
 * `transportFailure.ts` and `voi/voiRanking.ts`) and seven private copies under
 * `src/v5` and `src/lib` — a hand-maintained mirror by any other name (CLAUDE.md
 * trap 12). The exported one lived in a CEE-error-recovery module, so every new
 * boundary reader that wanted it had to either import from a module about
 * something else or write copy N+1. Copy N+1 is what kept happening.
 *
 * ⚠ THIS FILE IS THE HOME, NOT THE MIGRATION. The migration of the remaining
 * private copies is a separate rowed change: each is a one-line delete plus an
 * import, but they sit in five further modules with their own suites, and folding
 * them in here would bury a cross-module rename inside a quality PR. What landed
 * with this file is the home plus the two consumers whose files were already open
 * — `v5/decisionReviewAdapter.ts` (the newest copy, written in PR #535, the one
 * that made the count eight) and `v5/blocks/V5AnalysisResultBlock.tsx`. Eight
 * definitions became six plus this home, so the file is not itself copy nine.
 *
 * ⚠ WHAT IS DELIBERATELY *NOT* FOLDED IN: `canvas/conversation/ceeRecovery.ts`
 * keeps its own exported copy. Its docstring declares it "a zero-dependency pure
 * leaf on purpose … imports nothing", and that property is load-bearing for the
 * narrow typecheck gate it is covered by. Collapsing it means re-deciding that
 * invariant, which is a judgement for the migration row and not a drive-by. Its
 * two importers (`transportFailure.ts`, `voi/voiRanking.ts`) are untouched.
 *
 * ⚠ NAMING. Six of the private copies are called `isPlainObject` and two
 * `isRecord`, for the identical predicate. `isRecord` is the name kept: it is the
 * one that was already exported, it names the TYPE the guard narrows to
 * (`Record<string, unknown>`), and `isPlainObject` invites the reader to expect a
 * prototype check this predicate does not perform.
 */

/**
 * A non-null, non-array object — the shape an untyped wire value must have
 * before its keys can be read.
 *
 * Deliberately NOT a prototype or `Object.getPrototypeOf` check: every caller is
 * reading JSON that crossed an HTTP boundary, where a class instance cannot
 * arrive, and a stricter predicate would reject `Object.create(null)` bags that
 * are perfectly readable. `null` is excluded because `typeof null === 'object'`;
 * arrays are excluded because every caller goes on to read named keys, and an
 * array satisfying the guard is how a wrong-typed field becomes a silent empty
 * read instead of a rejection.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
