/**
 * The placeholder a RESTORE mints for a run that has no recorded identity —
 * and the predicate that recognises it. Nothing else.
 *
 * ⛔ THIS MODULE IMPORTS NOTHING, DELIBERATELY. The helpers began beside the
 * restore that mints them, which is the obvious home, and `store.ts` needs the
 * predicate. Importing the restore module into `store.ts` perturbed the type
 * graph enough to surface six diagnostics in `src/canvas/nodes/` — files the
 * change never touched — and the typecheck gate's SELF-TEST caught it (17/1,
 * "no added-diagnostics notice on a clean tree") while the gate itself passed.
 * A control on pristine staging read 18/0, so the alarm was real. A leaf module
 * lets every consumer take the predicate without dragging that graph behind it.
 *
 * ⚠ ONE OWNER FOR THE STRING. The restore imports its own mint from here, and
 * the autosave projection asks THIS module whether an id is one it made. A
 * prefix spelled at two sites is the hand-maintained mirror this estate keeps
 * paying for (CLAUDE.md trap 12).
 */
const RESTORED_ID_PREFIX = 'restored:'

export function syntheticRestoreId(hash: string | undefined): string {
  return `${RESTORED_ID_PREFIX}${hash ?? 'unknown'}`
}

/**
 * Whether an id is one `syntheticRestoreId` minted — a placeholder that names
 * no run, and must never be persisted as an identity.
 */
export function isSyntheticRestoreId(id: string | undefined | null): boolean {
  return typeof id === 'string' && id.startsWith(RESTORED_ID_PREFIX)
}
