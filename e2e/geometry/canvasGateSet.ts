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
      'would fail here (CLAUDE.md trap 13e). ' +
      '⭐ AND IT CARRIES A SECOND, INDEPENDENT DETECTOR that is easy to mistake for a ' +
      'self-check on the probe: the per-render-path `gated` assertion. Demonstrated by a ' +
      'reviewer breaking the keyboard scope FOR THE `goal` PATH ONLY — the run reported ' +
      '0 bleeding and a clean contrast control, and the gated assertion FIRED ALONE. The goal ' +
      'chip is self-selecting, so `bled` (which requires !mouseSelects && !focusSelects) is ' +
      'STRUCTURALLY BLIND to it. That makes the gated assertion the SOLE detector for a real ' +
      'product regression class — a fix that reaches four render paths and misses one that ' +
      'selects itself anyway — and not merely a guard on this arm\'s own instrument.',
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
  {
    file: 'nodeKeyboardBleed.measure.ts',
    suite: 'in-node keyboard bleed',
    title: 'portalled: Enter/Space at a control inside a portalled popover does not select the anchor node',
    catches:
      'THE HALF THE DOM-SCOPED FIX STRUCTURALLY COULD NOT REACH. `closest()` walks the DOM tree, ' +
      'and portalled popover content is NOT a DOM descendant of the node it belongs to — so the ' +
      'first fix was correct and blind at the same time, across 56-59 controls. Shipped as #1146. ' +
      'Without this arm the gate proves the bleed is closed only where the markup happens to nest.',
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
 * ⭐⭐ NO LONGER A FLAKE — ROOT-CAUSED AND FIXED. The block below used to open
 * "THE ONE KNOWN FLAKE IN THE GATED SET". That is retired, and the entry stays
 * only because its MEASUREMENTS are a record and its reasoning about why the arm
 * belongs in the gate is still correct.
 *
 * ── WHAT WAS BELIEVED, AND WHY IT WAS REASONABLE ────────────────────────────
 * `'opposite direction: Enter at the NODE still selects it, Escape still
 * deselects'` was believed to have a PRE-EXISTING order-dependence: failing
 * roughly 14% of the time after the pointer arm, never in isolation.
 *
 * ⚠ THE DATED MEASUREMENTS BELOW ARE KEPT VERBATIM. They are a record of what
 * was observed on the days it was observed, not a fixture to keep current — a
 * corpus that pins what was measured is EVIDENCE, and rewriting it would falsify
 * the record. Only the CONCLUSIONS drawn from them have gone stale.
 *
 *     independent reviewer, at #1129's head   7 paired,  1 failure
 *                                             8 isolated, 0 failures
 *     this lane, at staging 8736a61a         12 paired,  0 failures
 *     ------------------------------------------------------------------
 *     pooled                                 19 paired,  1 failure  (~5%)
 *
 * The reasoning attached to the 12/12 was also right at the time and is worth
 * keeping: at a true 14% rate, twelve consecutive passes happen about 16% of the
 * time (0.86^12), so twelve greens were an unremarkable draw and NOT evidence of
 * a fix. A "fix" nobody can show fixing anything is how four consecutive wrong
 * diagnoses happened on the canvas overlap defect.
 *
 * ── WHAT IS NOW MEASURED, AND IT REFUTES BOTH HALVES ────────────────────────
 * Settled by #1147 (`2b7248b8`), which did what the note above said nobody had
 * done — reproduced it, root-caused it, and discriminated the fix:
 *
 *   · RATE.  0/25 paired on staging, 0/25 isolated. Against a true 14% rate,
 *     twenty-five consecutive passes is p ≈ 0.023. The 14% is refuted.
 *   · ORDER. NOT order-dependent. Clears occur at the same rate isolated (5/16)
 *     as paired (7/19) — Fisher p = 1.0. Order only widened the VARIANCE of when
 *     the clear landed relative to the press.
 *   · POOLING. The `#1129's head` row is `b186c26a`, an intermediate commit on a
 *     branch and never a staging head. Pooling it with staging runs mixed two
 *     trees now known to differ, so the ~5% is an artefact of the pooling.
 *   · MECHANISM. Selection commits in 21-29 ms every time, then is
 *     SPONTANEOUSLY CLEARED 0.65-0.93 s later by the ghost-node ResizeObserver
 *     livelock. The test samples once at 150 ms and fails when a clear lands in
 *     the window. Single-hunk control: 7/19 clears → 0/20 with the `nodesChanged`
 *     identity guard applied, Fisher p = 0.0033.
 *   · THE FIX SHIPPED IN `c1b662fc` (#1136), which is why it no longer
 *     reproduces. ⚠ Not `a0b77f6c` — see the attribution note in
 *     `src/canvas/store.ts`.
 *
 * The mechanical argument below also still holds, and #1147 re-affirmed it: the
 * #1129 fix cannot cause this (`closest()` walks UP and the keyboard scope is a
 * DESCENDANT of `.react-flow__node`; an instrumented run measured `anyNokey: 0`
 * at the press in 12/12 runs).
 *
 * ⚠ The "re-run it in isolation first" advice is now USELESS and is removed: the
 * arm was never order-dependent, so isolation discriminates nothing.
 *
 * ⭐ WHY IT IS IN THE GATE ANYWAY — unchanged, and independent of flakiness.
 * Removing it would leave the gate WATCHING ONE DOOR: the drive arm proves the
 * bleed is closed, and only this arm proves the closing did not kill React Flow's
 * keyboard node selection — which may be the only keyboard route to the
 * Inspector. A gate that can bless a fix trading one accessibility defect for
 * another is worse than the flake (CLAUDE.md trap 22b).
 *
 * ⭐ WHAT ABSORBS A RED, AND IT IS NOT A RETRY — unchanged. The job is ADVISORY
 * (`continue-on-error: true`, absent from the "Staging Gate" aggregator's
 * `needs`), so an occasional red costs a reader one minute and blocks nobody.
 * `retries` stays 0: a flake hidden by a retry becomes an unknown-rate invisible
 * one, and this suite's whole job is to be believable when it goes red.
 *
 * ── ⚠⚠ PROMOTION TO REQUIRED: TWO PRECONDITIONS, AND ONLY ONE IS MET ────────
 * The old text named this arm as THE stated precondition. That was never the
 * whole bar, and a reader who fixed only this would have concluded promotion was
 * clear when it is not.
 *
 *   1. ✅ MET — root-cause this arm. Done, above.
 *   2. ❌ NOT MET — `staging-full-tests.yml` (the `canvas-gate` job's own
 *      comment) requires the false-positive rate on `ubuntu-latest` to be
 *      OBSERVED over a run of pushes, not assumed. Derive it, do not inherit it:
 *
 *        gh run list -R Talchain/DecisionGuideAI \
 *          --workflow staging-full-tests.yml --branch staging --limit 40 \
 *          --json databaseId,conclusion,headSha,createdAt
 *        # then per run:
 *        gh api "repos/Talchain/DecisionGuideAI/actions/runs/<id>/jobs?filter=all" \
 *          --jq '.jobs[]|select(.name|test("Canvas Browser Gate"))|.conclusion'
 *
 *      ⚠ `filter=all` matters: without it the API serves only the LATEST attempt
 *      and any rate is an undercount (measured 1.5x here). Ignore `cancelled`
 *      runs — staging is `cancel-in-progress`, so every merge kills the previous
 *      run and a cancellation is not a signal.
 *      Measured 2026-09-02: 4 clean non-cancelled staging runs. The trigger is
 *      20 consecutive with no red that is not reproducible on the base. 4/20.
 *
 *      ⭐⭐ AND THE FIRST REAL DATUM ARRIVED THE SAME EVENING, ON A PR THAT
 *      CHANGED ONLY PNG FILES. The job went RED at `Install Chromium
 *      (Playwright)` because `packages.microsoft.com` returned 403 Forbidden on
 *      an apt repository — "The repository ... is no longer signed". The gate
 *      step itself was SKIPPED. It ran ZERO TESTS and reported a red.
 *
 *      That is the argument against promotion, and it is not the flake: an
 *      "I COULD NOT MEASURE" is being reported through the same channel, and in
 *      the same colour, as "I MEASURED A DEFECT". Required, this one apt 403
 *      would have blocked every merge in the repo for a reason nobody here
 *      controls, on a job that tested nothing. The trigger's own wording — no
 *      red "that is not reproducible on the base" — excuses this red, which is
 *      exactly why counting greens is not sufficient on its own: the failure
 *      MODE is what promotion has to survive, not the rate.
 *
 *      Before promoting, make the job DISCRIMINATE those two states — a setup
 *      failure must not present as a gate failure. Until it does, an advisory
 *      red costs a reader a minute; a required one costs everyone the repo.
 *
 * ⚠ And the evidence retires the FLAKE rationale, not every rationale. This repo
 * already has an advisory job that accumulated a standing red until nobody read
 * it — `Visual Regression`, whose linux references went 199 commits stale.
 * Promote this gate on its own merits, not automatically because one
 * precondition cleared.
 */
const KNOWN_FLAKE_TITLE = 'opposite direction: Enter at the NODE still selects it, Escape still deselects'

/**
 * ⭐ BOUND TO THE REGISTRY AT MODULE LOAD, NOT RESTATED BESIDE IT.
 *
 * The first version of this was a bare string sitting next to `GATED_TESTS` —
 * a hand-maintained mirror, which is this estate's dominant defect class
 * (CLAUDE.md trap 12): rename or retire the arm and the string keeps naming a
 * test that no longer exists, silently, forever, while every sentence above it
 * still reads as current. Resolving it THROUGH the registry means the mirror
 * cannot drift, because there is no longer a second copy to drift.
 *
 * ⚠ AND IT FAILS LOUD RATHER THAN FALLING BACK. A lookup that returned
 * `undefined` on a miss would turn a stale reference into a silent no-op — an
 * absence that reads exactly like a healthy absence. This throws at config
 * load, so a rename REDs the whole gate with a message naming the cause, in the
 * same posture as `globalSetup`'s identity assertion.
 */
export const KNOWN_FLAKE_IN_GATE: GatedTest = (() => {
  const found = GATED_TESTS.find((t) => t.title === KNOWN_FLAKE_TITLE)
  if (!found) {
    throw new Error(
      `[canvas-gate] KNOWN_FLAKE_IN_GATE names a test that is not in GATED_TESTS:\n` +
        `  looking for: ${KNOWN_FLAKE_TITLE}\n` +
        `  registered : ${GATED_TESTS.map((t) => t.title).join('\n               ') || '(none)'}\n` +
        `  The flake note above documents a specific gated arm. If that arm was renamed,\n` +
        `  update KNOWN_FLAKE_TITLE; if it was RETIRED, delete the note with it — do not\n` +
        `  leave a documented hazard pointing at nothing.`,
    )
  }
  return found
})()

/**
 * ⭐ ADMITTED. The arm above was gated in this commit, and this note records the
 * dependency that governed it rather than deleting the history silently.
 *
 * It was held out ONLY on sequencing: a registry entry naming a test that is not
 * on the branch REDs the gate with `MISSING` on every run. `PR #1146` merged as
 * `eec43702`, so the arm exists and both halves — the `{ tag: GATE_TAG }` at its
 * own site and the `GATED_TESTS` entry above — landed together here, because
 * either alone REDs by design.
 *
 * ⚠ Where that RED comes from is worth knowing, because it is not where people
 * assume: the tag/registry pairing is enforced at globalTeardown
 * (`canvasGateTeardown.ts`, MISSING / UNEXPECTED / duplicates), NOT at config
 * load. The only config-load throw in this file is the `KNOWN_FLAKE_IN_GATE`
 * IIFE, which fires if `KNOWN_FLAKE_TITLE` stops resolving.
 *
 * ⚠ STILL OWED: the job's wall clock has NOT been re-measured with four arms.
 * The gate's budget is the constraint that shaped it, and this arm is the
 * expensive one — it reseeds once per key per control, so its cost scales with
 * the driven-kind cap rather than with the file. Read the figure off the job
 * rather than extrapolating from a local run.
 */

/** `"suite › title"`, the shape a Playwright `titlePath` collapses to. */
export function gatedKey(t: GatedTest): string {
  return `${t.suite} › ${t.title}`
}

export function expectedGatedKeys(): string[] {
  return GATED_TESTS.map(gatedKey)
}
