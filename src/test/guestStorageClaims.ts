/**
 * Banned guest-storage claims — ONE definition, swept across the whole tree.
 *
 * ⭐ THE MECHANISM IS SETTLED, AND IT IS SERVER-SIDE. Measured across 8 seeds and
 * 22 restart arms: a guest's model lives on Olumi's servers and is re-fetched on
 * EVERY page load, keyed by a UUID pointer in localStorage. The browser holds
 * `olumi-canvas-current-scenario-id` — 36 bytes — and nothing else; the largest
 * browser-stored value observed was 47 bytes against a ~95 KB model. There is no
 * `olumi-canvas-autosave` key on the deployed build. The decisive control: a
 * pointer-only transplant into a brand-new profile restored the whole model 5/5,
 * while the same profile without the pointer gave 0 nodes and no graph call 4/4.
 *
 * ⚠ AND THE SERVER WRITE-BACK COMPLETES 30-90s AFTER THE MODEL IS ON SCREEN.
 * That window is why two earlier readings appeared to contradict each other:
 * "0 nodes after restart" was a restart INSIDE it, "work survives restart" was one
 * AFTER it. One store, not two. Any "Saved" indicator that fires on render is
 * therefore false for up to ninety seconds.
 *
 * WHY THIS EXISTS. The entry screen shipped "Without an account, your work stays
 * only in this browser." Removed in #841 with a regression pin.
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
  // Locality claims — all false: the model is on Olumi's servers.
  /only in this browser/i,
  /stays? (?:only )?(?:on|in) (?:this|your) (?:browser|device|computer)/i,
  /never leaves/i,
  /(?:saved|stored) (?:only )?locally/i,
  /we (?:do not|don't) (?:store|keep|save)/i,
  /nothing (?:is )?(?:sent|uploaded)/i,
  /only you can see/i,

  // ⚠ THE THREE A REASONABLE PERSON WOULD WRITE, and I wrote one of them.
  // "sign in to save your work" — it is ALREADY saved. Signing in adds an
  // account, not saved-ness. I shipped "Sign in to create a saved workspace" in
  // #841 while fixing a different falsehood, and it is the same claim.
  /sign (?:in|up) to save/i,
  /(?:create|get) a saved workspace/i,
  // Clearing site data deletes the POINTER, not the model.
  /clear(?:ing)? .{0,30}(?:browser|site) data .{0,20}delete/i,
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

/**
 * Sentences that ARE licensed, kept beside the bans as a live positive control.
 * If a pattern ever starts matching one of these it has grown too broad, and the
 * spec fails — a ban list with no sanctioned counterpart drifts towards
 * forbidding everything and nobody notices, because over-blocking reads as safe.
 */
export const GUEST_STORAGE_CLAIMS_LICENSED: readonly string[] = [
  'Saved to Olumi.',
  'Close the tab and come back in this browser.',
  "Clearing this browser's site data loses your way back.",
  'Sign up to keep your models across devices.',
  "Saved to Olumi. You're not signed in, so this browser is the only way back to "
  + 'this model — clearing its data will lose your link to it.',
]

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
  'src/canvas/versions/ServerVersionsSection.tsx':
    'THE MATCH IS ON A CORRECTLY-SCOPED TRUE CLAIM, and my pattern is the thing at '
    + 'fault. "Sign in to save SHARED versions" is scoped to shared versions, which are '
    + 'owner-scoped by DB design — capture short-circuits pre-RPC for guests — so a guest '
    + 'genuinely cannot save them. The unscoped "sign in to save your work" is the false '
    + 'one, and a regex cannot reliably separate them; tuning it would start the '
    + 'four-rounds oscillation this estate has already paid for once. '
    + '⚠ ROWED, NOT ADJUDICATED AWAY: the SAME sentence continues "the local history '
    + 'above still works in this browser". That is a locality claim, and the settled '
    + 'mechanism says the browser holds a 36-byte pointer and nothing else. Either local '
    + 'version history uses a store nobody has named, or that half is false. Needs the '
    + 'mechanism owner, not a copy edit from me.',
  'src/canvas/onboarding/OnboardingOverlay.tsx':
    'MATCHES ON THE WRONG HALF, and the right half is worse. The matched sentence is '
    + 'about SHARE LINKS ("stay on your device unless you copy them out"), which is '
    + 'plausibly true. The sentence BEFORE it — "Everything runs locally for single-user '
    + 'mode" — is materially false: every turn goes UI to CEE to PLoT to ISL. That is a '
    + 'claim about the product architecture, not about guest storage, and it is a bigger '
    + 'finding than the one this guard was built for. ROWED, not fixed here: fixing it '
    + 'inside this seam would be the "while we are here" expansion the estate bans.',
}
