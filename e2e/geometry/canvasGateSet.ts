/**
 * THE CANVAS BROWSER GATE — the explicit, closed set of gated assertions.
 *
 * ── WHY A BROWSER GATE EXISTS AT ALL ────────────────────────────────────────
 *
 * Three canvas defects shipped in one day (1-2 Sep 2026) that jsdom could not
 * have caught BY CONSTRUCTION, not by oversight:
 *
 *   1. THE IN-NODE KEYBOARD BLEED (#1129). React Flow's node-level `onKeyDown`
 *      lives in the ancestor React Flow renders AROUND every node component, so
 *      the defect is in no node component's own tree. NO TEST IN THIS REPO
 *      MOUNTS `<ReactFlow>` AT ALL — a green suite over `src/canvas/nodes` was
 *      silent about it by construction (CLAUDE.md trap 3b).
 *   2. THE GHOST REASONING-FRONTIER DOORS. A livelock measuring 1,660 times in
 *      3s left four affordances invisible from 27 March 2026. A layout livelock
 *      is a property of a real layout engine in a real paint loop; jsdom has
 *      neither.
 *   3. THE CANVAS NODE OVERLAP, root-caused to two independent mechanisms —
 *      card width not surviving reload, and card HEIGHT being a function of
 *      ZOOM. Both are geometry, and jsdom has no geometry: it returns 0 for
 *      every rect.
 *
 * Meanwhile the one browser-level check this repo already had —
 * `Visual Regression (advisory)` — is INOPERATIVE: its own self-test
 * (`e2e/visual/selftest.visual.spec.ts`, "proves the instrument can fail") sits
 * inside its standing failure set, so the instrument cannot fail. "Identical
 * failure sets" from it is two runs of a broken instrument agreeing with each
 * other, not evidence (CLAUDE.md trap 13). We were shipping a class of defect
 * that NO gate in this repo could see.
 *
 * ── WHY THIS SET AND NOT THE WHOLE HARNESS ──────────────────────────────────
 *
 * A job that takes twenty minutes will be routed around within a week — which
 * is exactly how this repo acquired a permanently-red visual check. So this
 * gate is the SMALLEST SET THAT WOULD HAVE CAUGHT THE SHIPPED DEFECT, and
 * nothing else. `e2e/geometry` holds twenty `*.measure.ts` files; the rest are
 * MEASURES — viewport sweeps, exhaustive placement scans, 390-element censuses
 * — and they stay measures, run deliberately, out of the merge path.
 *
 * The distinction is not size, it is CLAIM TYPE:
 *   - a MEASURE answers "what is the number?" and its output is a report;
 *   - a GATED ASSERTION answers "did this behaviour survive?" and its output is
 *     RED or GREEN.
 * Only the second kind belongs on a merge path.
 *
 * ── HOW THE SET IS PINNED (two independent mechanisms that must agree) ───────
 *
 * The brief for this gate was that the set be "explicit and cannot silently
 * grow". One mechanism cannot deliver that, because a derived guard proves
 * AGREEMENT and can never prove COMPLETENESS (CLAUDE.md trap 12d). So there are
 * two, pointing in opposite directions:
 *
 *   1. SELECTION is by TAG. Each gated test carries `{ tag: GATE_TAG }` at its
 *      own site, and `playwright.canvasgate.config.ts` sets `grep` from that
 *      tag. A future editor of the measure file SEES that the test is gated.
 *   2. ADMISSION is by this REGISTRY. `canvasGateTeardown.ts` asserts the set
 *      that actually RAN against `GATED_TESTS` below, BY NAME, in BOTH
 *      directions.
 *
 * Therefore:
 *   - tag a test and forget the registry  -> UNEXPECTED -> red
 *   - register a test and forget the tag  -> MISSING    -> red
 *   - rename a gated test                 -> MISSING + UNEXPECTED -> red
 *   - `--grep` a subset in CI             -> MISSING    -> red
 * The set cannot grow, shrink, or drift without a human editing this file.
 */

/**
 * The tag that selects a test into the gate. Declared here rather than typed
 * into the config so the selector and the registry cannot drift apart.
 */
export const GATE_TAG = '@canvas-gate'

export interface GatedTest {
  /** The spec file, relative to `e2e/geometry`. */
  readonly file: string
  /** `test.describe` title. */
  readonly suite: string
  /** `test` title, VERBATIM. This is the name the teardown asserts. */
  readonly title: string
  /** The shipped defect this assertion would have caught. */
  readonly catches: string
}

/**
 * ⭐ THE GATED SET.
 *
 * Every entry names the SHIPPED DEFECT it would have caught. An entry that
 * cannot name one does not belong on a merge path — it belongs in the measure
 * it came from.
 */
export const GATED_TESTS: readonly GatedTest[] = [
  {
    file: 'nodeKeyboardBleed.measure.ts',
    suite: 'in-node keyboard bleed',
    title: 'drive: Space/Enter at an in-node control, with a contrast control and an attribution control',
    catches:
      'THE DEFECT ITSELF (#1129). Space/Enter on a button inside a node also selected the node ' +
      'behind it and threw the dock to the Inspector. This arm drives real keys at one control ' +
      'per render path and reads the selected set after each, with a `q` CONTRAST CONTROL whose ' +
      'expected answer DIFFERS — so a probe that reported "selected" for any keypress at all ' +
      'would fail here (CLAUDE.md trap 13e).',
  },
  {
    file: 'nodeKeyboardBleed.measure.ts',
    suite: 'in-node keyboard bleed',
    title: 'pointer: Shift-drag over a node still starts a marquee, and does not move the node',
    catches:
      'THE OBVIOUS REGRESSION THE FIX COULD CAUSE. The fix scopes a `.nokey` region inside each ' +
      'node; `.nokey` suppresses React Flow keyboard handling and must not touch POINTER ' +
      'behaviour. If a future edit widens it into a pointer suppression, Shift-drag marquee ' +
      'selection over a node dies silently — with no red anywhere else in this repo.',
  },
  {
    file: 'nodeKeyboardBleed.measure.ts',
    suite: 'in-node keyboard bleed',
    title: 'opposite direction: Enter at the NODE still selects it, Escape still deselects',
    catches:
      'THE FIX TRADING ONE ACCESSIBILITY DEFECT FOR ANOTHER. React Flow keyboard node selection ' +
      'is a real a11y feature and may be the only keyboard route to the Inspector. A fix that ' +
      'over-suppresses kills it. ONE DIRECTION ALONE IS A GUARD WATCHING ONE DOOR ' +
      '(CLAUDE.md trap 22b) — without this arm the gate would bless a fix that silently removed ' +
      'keyboard access to the canvas.',
  },
]

/**
 * ⚠ DELIBERATELY NOT GATED — recorded here so an exclusion is a DECISION with a
 * reason attached, rather than an absence nobody can see.
 *
 * A `*.measure.ts` file is not gated merely by being absent from `GATED_TESTS`;
 * it is not gated because it carries no `GATE_TAG`. This list exists for the
 * cases where somebody will reasonably ask "why isn't that one in?".
 */
export const DELIBERATE_EXCLUSIONS: readonly { readonly what: string; readonly why: string }[] = [
  {
    what: "nodeKeyboardBleed.measure.ts — 'census: focusable controls inside .react-flow__node, all five starters'",
    why:
      'IT IS A MEASURE, NOT AN ASSERTION. It enumerates 390 focusable elements across five ' +
      'starters to establish the SCOPE of the claim; its output is a report. It also costs the ' +
      'bulk of the file\'s wall-clock. The three gated arms prove the BEHAVIOUR; the census ' +
      'bounds the claim, and bounding a claim is not a merge gate.',
  },
  {
    what: 'every other e2e/geometry/*.measure.ts (ghostDoorVisibility, overlapSequence, heightVsZoom, dockClippingPopulated, ...)',
    why:
      'Heavier by design — viewport sweeps and exhaustive placement scans — and mostly ' +
      'measures rather than assertions. Gating them would put this job well past the few ' +
      'minutes at which a check starts being routed around. They remain runnable deliberately ' +
      'via playwright.geometry.config.ts, which still collects ALL of them.',
  },
]

/**
 * ⚠⚠ THE ONE KNOWN FLAKE IN THE GATED SET — INCLUDED DELIBERATELY, NOT MISSED.
 *
 * `'opposite direction: Enter at the NODE still selects it, Escape still
 * deselects'` has a measured, PRE-EXISTING order-dependence: it fails roughly
 * 14% of the time when it runs AFTER the pointer arm, and not at all in
 * isolation. The measurements, pooled:
 *
 *     independent reviewer, at #1129's head   7 paired,  1 failure
 *                                             8 isolated, 0 failures
 *     this lane, at staging 8736a61a         12 paired,  0 failures
 *     ------------------------------------------------------------------
 *     pooled                                 19 paired,  1 failure  (~5%)
 *
 * ⭐ AND THE 12/12 IS NOT A REFUTATION — SAYING SO IS THE POINT. At a true 14%
 * rate, twelve consecutive passes happen about 16% of the time (0.86^12). That
 * is an unremarkable draw, not evidence of a fix. The arm's own comment already
 * makes the symmetric point about 8/8 green at the merge base. So this lane did
 * NOT reproduce it and did NOT root-cause it, and has changed nothing about the
 * arm — a "fix" nobody can show fixing anything is how four consecutive wrong
 * diagnoses happened on the canvas overlap defect.
 *
 * ⭐ WHY IT IS IN THE GATE ANYWAY. Removing it would leave the gate WATCHING ONE
 * DOOR: the drive arm proves the bleed is closed, and only this arm proves the
 * closing did not kill React Flow's keyboard node selection — which may be the
 * only keyboard route to the Inspector. A gate that can bless a fix trading one
 * accessibility defect for another is worse than the flake (CLAUDE.md trap 22b).
 *
 * ⭐ WHAT ABSORBS IT, AND IT IS NOT A RETRY. The job is ADVISORY
 * (`continue-on-error: true`, absent from the "Staging Gate" aggregator's
 * `needs`), so an occasional red costs a reader one minute and blocks nobody.
 * `retries` stays 0: a flake hidden by a retry becomes an unknown-rate invisible
 * one, and this suite's whole job is to be believable when it goes red.
 *
 * ⚠ IF YOU ARE READING THIS BECAUSE THE GATE IS RED ON THIS ARM: its failure
 * message reads `keyboard node selection is GONE`, which looks catastrophic and
 * usually is not. Re-run the arm IN ISOLATION before assuming your diff caused
 * it — mechanically the #1129 fix cannot cause it (`closest()` walks UP and the
 * keyboard scope is a DESCENDANT of `.react-flow__node`; an instrumented run
 * measured `anyNokey: 0` at the press in 12/12 runs):
 *
 *     pnpm exec playwright test -c playwright.geometry.config.ts \
 *       nodeKeyboardBleed --grep "opposite direction"
 *
 * ⭐ THIS IS THE STATED PRECONDITION FOR PROMOTING THE JOB TO REQUIRED. Root-cause
 * this arm first. Putting a known-flaky assertion on the merge path is exactly
 * how this repo acquired a browser check nobody looks at, and the cure must not
 * begin by administering the disease.
 */
export const KNOWN_FLAKE_IN_GATE =
  'opposite direction: Enter at the NODE still selects it, Escape still deselects'

/** `"suite › title"`, the shape a Playwright `titlePath` collapses to. */
export function gatedKey(t: GatedTest): string {
  return `${t.suite} › ${t.title}`
}

export function expectedGatedKeys(): string[] {
  return GATED_TESTS.map(gatedKey)
}
