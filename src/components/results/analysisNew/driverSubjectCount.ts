/**
 * How many DRIVERS are behind "What moves the outcome" — counted as subjects,
 * not as renderings of them.
 *
 * ⛔ THE DEFECT, WITNESSED ON DEPLOYED `219209ad`. The group advertised **4**
 * while holding **two factors**: the prose section read "Drivers and dynamics 2"
 * with rows *Migration and Integration Effort* and *Data Team Capacity*, and the
 * chart's top bar was *Migration and Integration Effort* — the same factor
 * again. The count was `findings.length + influenceRows.length`.
 *
 * ⭐ AND THE FILE ALREADY SAID SO. `buildAnalysisNewViewModel`'s own docblock,
 * immediately above the driver-finding mint: *"The two surfaces are built from
 * ONE filtered list, so a row can never appear without its bar."* One-to-one by
 * construction — so adding the two lengths double-counts BY THE CODEBASE'S OWN
 * STATED INVARIANT. This is not an inference about the data.
 *
 * `SectionShell`'s rule is what makes it matter: *"a collapsed row is a PROMISE
 * about what is behind it, and a count that misreports reads as 'you have seen
 * everything' when you have not."* Here it misreports in the other direction —
 * it promises twice what is there, and the reader who opens it finds half.
 *
 * ⚠ A UNION, NOT `findings.length`. The one-to-one invariant is documented, not
 * enforced; if the two lists ever diverge, a union GROWS honestly while picking
 * either length would silently under-report the other. The fix must not depend
 * on the invariant it was written because of.
 */

/**
 * Driver findings are minted as `driver:<factorKey>` and influence rows as the
 * bare `<factorKey>`. ONE OWNER for that prefix: it was spelled at the mint and
 * nowhere else, and a second spelling here would be the hand-maintained mirror
 * this estate pays for (CLAUDE.md trap 12).
 */
export const DRIVER_FINDING_ID_PREFIX = 'driver:'

/** The bare factor key behind either representation's id. */
export function driverSubjectKey(id: string): string {
  return id.startsWith(DRIVER_FINDING_ID_PREFIX)
    ? id.slice(DRIVER_FINDING_ID_PREFIX.length)
    : id
}

/**
 * Distinct driver subjects across both representations.
 *
 * ⚠ Empty in, zero out — and the group's own render gate already decides
 * whether it appears at all, so this never has to express "nothing to show".
 */
export function distinctDriverSubjects(
  findings: ReadonlyArray<{ readonly id: string }>,
  influenceRows: ReadonlyArray<{ readonly id: string }>,
): number {
  const subjects = new Set<string>()
  for (const f of findings) subjects.add(driverSubjectKey(f.id))
  for (const r of influenceRows) subjects.add(driverSubjectKey(r.id))
  return subjects.size
}
