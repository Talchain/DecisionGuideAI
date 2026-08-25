/**
 * Banned guest-storage claims — ONE definition, swept across the whole tree.
 *
 * WHY THIS EXISTS. The entry screen shipped "Without an account, your work stays
 * only in this browser." Both halves were false at once: "stays" promises
 * persistence across a settling window in which the work is not yet durable, and
 * "only in this browser" is a PRIVACY claim that is untrue — a guest's graph also
 * exists server-side. It was removed in #841 with a regression pin.
 *
 * ⚠ AND THE PIN DID NOT CATCH ITS TWIN. `GuestDraftImportBanner` carried
 * "otherwise it stays only in this browser" the whole time, because the pin was
 * scoped to the one component's rendered output. A per-surface opt-in only ever
 * guards the surfaces someone remembered to opt in — which is the
 * hand-maintained-mirror defect, and it is how the twin survived.
 *
 * So the guard DISCOVERS its scope by globbing the tree rather than being handed
 * a list of surfaces. A component added tomorrow is covered by construction. The
 * design move is the discovery, not the detector — the same reason
 * `claimDrift/claimDriftWalker.ts` discovers owners instead of listing them.
 *
 * WHAT THIS CANNOT SEE, stated rather than implied:
 *  - copy assembled at runtime from fragments, or loaded from a server;
 *  - a claim phrased in words no pattern here anticipates. The patterns are a
 *    PROXY for "makes a promise about where a guest's work lives", not a proof.
 *    Widen them when a new phrasing is found; do not treat a pass as certainty;
 *  - ⚠ AN UNTRACKED FILE. Scope is `git ls-files`, so a new component is covered
 *    the moment it is STAGED, not the moment it is written. Measured, not
 *    assumed: the same new file reads GREEN untracked and RED once `git add`ed.
 *    That is the right scope for CI, where everything under review is tracked —
 *    but "covered by construction" means TRACKED source, and saying it without
 *    that word would be the scope-generalisation this estate keeps paying for.
 */

/** Shapes that assert where a guest's work is (or is not) stored. */
export const GUEST_STORAGE_CLAIM_PATTERNS: readonly RegExp[] = [
  /only in this browser/i,
  /stays? (?:only )?(?:on|in) (?:this|your) (?:browser|device|computer)/i,
  /never leaves/i,
  /stored only locally/i,
  /we (?:do not|don't) (?:store|keep|save)/i,
  /nothing (?:is )?(?:sent|uploaded)/i,
]

/**
 * Remove line and block comments so a file may EXPLAIN the banned claim without
 * tripping the sweep. Deliberately conservative: it does not attempt to respect
 * comment-like sequences inside string literals, which would at worst leave a
 * real occurrence visible to the sweep — failing closed, not open.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/** The first banned pattern this text matches, or null. */
export function findGuestStorageClaim(text: string): RegExp | null {
  return GUEST_STORAGE_CLAIM_PATTERNS.find(p => p.test(text)) ?? null
}

/**
 * Paths whose match is ADJUDICATED, not suppressed. A reason is required, and
 * the sweep asserts every entry STILL MATCHES — so an entry that goes stale
 * fails loud instead of quietly widening the hole. A silent allowlist is the
 * hand-maintained mirror this guard exists to avoid.
 *
 * ⚠ Being on this list is NOT a finding that the copy is fine. Two of these
 * carry separate, larger issues that are rowed rather than fixed here, because
 * they are outside the seam that introduced them.
 */
export const GUEST_STORAGE_CLAIM_ADJUDICATED: Readonly<Record<string, string>> = {
  'src/components/results/modals/DecisionRecordModal.tsx':
    'TRUE AS WRITTEN, and deliberately so. `persistenceNote` names a SPLIT — choice, '
    + 'confidence, expectation and review date go to the account; rationale, assumption '
    + 'and revisit trigger stay local. That is a precise claim about NAMED FIELDS, not a '
    + "blanket claim about the user's model, and its docblock says it was written to "
    + 'claim neither more nor less than is true. `guestNote` beside it reads similarly '
    + 'and has ZERO CONSUMERS. ROWED: retire the dead `guestNote`, and re-derive whether '
    + 'the split still holds after any change to decision-record persistence.',
  'src/canvas/onboarding/OnboardingOverlay.tsx':
    'MATCHES ON THE WRONG HALF, and the right half is worse. The matched sentence is '
    + 'about SHARE LINKS ("stay on your device unless you copy them out"), which is '
    + 'plausibly true. The sentence BEFORE it — "Everything runs locally for single-user '
    + 'mode" — is materially false: every turn goes UI to CEE to PLoT to ISL. That is a '
    + 'claim about the product architecture, not about guest storage, and it is a bigger '
    + 'finding than the one this guard was built for. ROWED, not fixed here: fixing it '
    + 'inside this seam would be the "while we are here" expansion the estate bans.',
}
