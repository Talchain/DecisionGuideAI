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
 * gate is the SMALLEST SET THAT WOULD HAVE CAUGHT THE SHIPPED DEFECTS, and
 * nothing else. `e2e/geometry` holds TWENTY-ONE `*.measure.ts` files (derive it:
 * `ls e2e/geometry/*.measure.ts | wc -l` — this sentence said "twenty" while the
 * directory held twenty-one, which is the hand-maintained mirror this estate
 * pays for, inside the file that bans them).
 *
 * The distinction is not size, it is CLAIM TYPE:
 *   - a MEASURE answers "what is the number?" and its output is a report;
 *   - a GATED ASSERTION answers "did this behaviour survive?" and its output is
 *     RED or GREEN.
 * Only the second kind belongs on a merge path.
 *
 * ── ⚠ AND FOR ONE MONTH THE SET WAS TOO SMALL, WHICH IS THE OTHER FAILURE ────
 *
 * Until 3 Sep 2026 all four gated arms sat in `nodeKeyboardBleed.measure.ts`,
 * so of the three shipped defects named above the gate watched ONE. Working
 * browser guards for the other two — the ghost doors and the zoom-dependent
 * card height — were sitting in this same directory, GREEN, and CI ran neither.
 * Every defect found in the 24h before this commit was geometric, several had
 * guards written for them, and none of those guards ran. Writing an alarm and
 * not connecting it is worse than not writing it, because the alarm's existence
 * is what stops anybody writing a second one.
 *
 * The set is now 23 arms across four files. What is still out, and why, is in
 * `DELIBERATE_EXCLUSIONS` below — which also carries THE BUDGET (600s of job
 * wall clock, derived from the workflow's critical path) and the standing rule
 * for admitting the next one.
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

  /*
   * ══════════════════════════════════════════════════════════════════════════
   * ⭐⭐ EVERY ARM BELOW WAS SHOWN TO GO RED. An admitted arm that cannot fail
   * is wall clock with no safety, so the admission evidence is a MUTATION, not
   * a green run. Throwaway worktree outside the repo root, isolation proven by
   * WRITING a sentinel and asserting the source did not change (CLAUDE.md trap
   * 9g — `cp -R` can preserve an APFS hard link, and locating a path proves
   * nothing); committed state only; restores HEAD-relative, never
   * `git checkout -- <path>`, which restores from the INDEX and can write the
   * defect back (trap 9h); applied-check scoped to `src/` asserting exactly one
   * changed file each time; trailing control at the end.
   *
   *   A  band back over the canvas (`bottom: OVERLAY_BAND_BOTTOM` -> `top: 72`,
   *      the shipped defect's own geometry)          -> OVERLAP 10/10 RED
   *   B  revert the `nodesChanged` identity guard
   *      (`c1b662fc`/#1136), restoring the livelock   -> GHOST 7 of 8 RED
   *   C  LOD title boost -> `text-5xl` (the file's own
   *      recorded discriminating size; `text-3xl` is a
   *      DEMONSTRATED equivalent mutant)              -> HZ RED
   *   D  re-introduce the post-analysis withdrawal
   *      Paul deleted on 1 Sep                        -> GHOST arm 6 RED, ALONE
   *   trailing control, src clean                     -> 19/19 GREEN
   *
   * ⭐ B AND D ARE A DISCRIMINATING PAIR, AND WITHOUT D THE EVIDENCE WOULD HAVE
   * BEEN WRONG IN A WAY THAT LOOKS LIKE THOROUGHNESS. `GHOST doors SURVIVE a
   * completed analysis` SURVIVED mutant B — it counts DOM presence, and the
   * livelock hides doors rather than removing them, so B is simply not a
   * mutation of that arm's property. A kit that stopped at "7 of 8 bit" would
   * have shipped one arm with no evidence at all, and read as a strong result
   * while doing it. D REDs that arm and ONLY that arm; B REDs the other seven
   * and leaves it green. Neither alone shows binding — the RED/GREEN pair does
   * (CLAUDE.md trap 19).
   * ══════════════════════════════════════════════════════════════════════════
   */

  /*
   * ══════════════════════════════════════════════════════════════════════════
   * ⭐⭐ ADMITTED 3 Sep 2026 — THE GATE WAS WATCHING ONE DEFECT OUT OF THREE.
   *
   * The header above names three shipped defects as the reason this job exists.
   * Only the FIRST of them was gated: all four arms lived in
   * `nodeKeyboardBleed.measure.ts`. The ghost doors and the zoom-dependent card
   * height — defects 2 and 3 in this file's own justification — had working
   * browser guards sitting in `e2e/geometry`, and CI ran neither. So did the
   * overlay-over-node defect, which shipped TWICE. We were writing alarms and
   * not connecting them, which is a more expensive failure than not writing
   * them: the guard's existence is what stops anyone writing a second one.
   * ══════════════════════════════════════════════════════════════════════════
   */
  ...([
    'vendor-selection @ 1280x800',
    'market-entry @ 1280x800',
    'build-vs-buy @ 1280x800',
    'headcount-allocation @ 1280x800',
    'pricing-model @ 1280x800',
    'vendor-selection @ 1440x900',
    'market-entry @ 1440x900',
    'build-vs-buy @ 1440x900',
    'headcount-allocation @ 1440x900',
    'pricing-model @ 1440x900',
  ].map((cell) => ({
    file: 'overlayNodeOverlap.measure.ts',
    suite: 'canvas overlay band',
    title: `OVERLAP ${cell}`,
    catches:
      'THE OVERLAY-OVER-NODE DEFECT, WHICH SHIPPED TWICE. The CI-rendered reference at staging ' +
      '`f59ffc26` shows the first-model notice painted across the decision node so only ' +
      '"Us… / Bi… / To…" of its title is readable, and "Showing 9 of 19 elements" with its ' +
      '"Show whole model" button clipped by the minimised Olumi pill. Three independent ' +
      'assertions, each pinning a different way that returns: no overlay over a `dec_` node; ' +
      'no two overlays in one slot (the pill collision, reproduced at the merge base in FIVE ' +
      'of these ten cells); and no band occupant TALLER than the 64px band, which is how an ' +
      'occupant grows UPWARD out of the reservation and back over the canvas with every unit ' +
      'test still green (measured: `py-2` gave 71px in all ten cells). ' +
      '⭐ AND IT CANNOT PASS VACUOUSLY: "zero overlaps" is also what a run with no overlays ' +
      'produces, so the arm asserts nodes were measured, an overlay was visible, and a decision ' +
      'node was on screen, BEFORE it scores any of them (CLAUDE.md trap 13). It also asserts ' +
      'the starter stamp landed — without it `StarterProvenanceBanner`, the component carrying ' +
      'the motivating defect, does not mount at all and the measure was blind to its own subject.',
  })) as GatedTest[]),

  ...([
    { title: 'GHOST doors are visible and focusable — vendor-selection', what: 'the FRESH-DRAFT class, per starter' },
    { title: 'GHOST doors are visible and focusable — market-entry', what: 'the FRESH-DRAFT class, per starter' },
    { title: 'GHOST doors are visible and focusable — build-vs-buy', what: 'the FRESH-DRAFT class, per starter' },
    { title: 'GHOST doors are visible and focusable — headcount-allocation', what: 'the FRESH-DRAFT class, per starter' },
    { title: 'GHOST doors are visible and focusable — pricing-model', what: 'the FRESH-DRAFT class, per starter' },
    {
      title: 'GHOST doors SURVIVE a completed analysis in Standard view — Paul, 1 Sep 2026',
      what: 'THE OPPOSITE DIRECTION, and a ruling. Bound as an EQUALITY to the pre-analysis count, ' +
        'so a PARTIAL withdrawal — some tiers surviving, others vanishing — cannot pass as "still present"',
    },
    {
      title: 'GHOST doors are visible on the SAVED-EXAMPLE route — applyStarter, not applyDraftResult',
      what: 'a DIFFERENT SEED PATH. A fresh-draft witness is not evidence about `applyStarter`',
    },
    {
      title: 'GHOST doors are visible in the RESTORED class — a saved example after a real reload',
      what: 'the RESTORED state class, where `layoutVersion` stays 0 and both fit triggers are latched off. ' +
        'The fixture state-class rule: a seeded session is not evidence about a reloaded one',
    },
  ].map((arm) => ({
    file: 'ghostDoorVisibility.measure.ts',
    suite: 'reasoning-frontier doors',
    title: arm.title,
    catches:
      'DEFECT 2 IN THIS FILE\'S OWN HEADER — the four reasoning-frontier doors invisible from ' +
      '27 March 2026 behind a ResizeObserver livelock (1,660 callbacks in ~3s for four elements ' +
      `whose box never changed). This arm covers ${arm.what}. ` +
      'jsdom was GREEN throughout the entire period the doors were invisible, BY CONSTRUCTION: ' +
      'it has no layout, `innerText` is not layout-aware there, and `.focus()` succeeds on ' +
      'elements a browser refuses to focus. ' +
      '⭐ IT CARRIES ITS OWN POSITIVE CONTROL — the probe is shown a deliberately hidden clone ' +
      'of a real door, in the same DOM, through the same reader, and must call it hidden and ' +
      'unfocusable; without that, "everything reads visible" is also what a blind probe says. ' +
      'AND A LIVELOCK COUNTER, so the mechanism cannot return wearing a passing appearance: a ' +
      'door can be visible at rest and still be re-measured hundreds of times a second. ' +
      'AND a suppressed-too-much control: real nodes must still persist their measured dimensions.',
  })) as GatedTest[]),

  {
    file: 'heightVsZoom.measure.ts',
    suite: 'card height vs camera zoom',
    title: 'HZ build-vs-buy @1280x800',
    catches:
      'DEFECT 3 IN THIS FILE\'S OWN HEADER — card HEIGHT being a function of camera ZOOM. The ' +
      'layout fixes its vertical stride at layout time from measured heights, so a card whose ' +
      'height in MODEL px moves with the zoom makes every row under-spaced with nothing in the ' +
      'layout being wrong. Nothing else in this gate watches it, and nothing in jsdom can: jsdom ' +
      'returns 0 for every rect. ' +
      '⚠⚠ WHAT IT ASSERTS IS NARROWER THAN ITS TITLE, AND THIS ENTRY SAID OTHERWISE UNTIL IT WAS ' +
      'CHECKED AT THE BYTES. The draft here claimed the arm asserts that ' +
      '`measureNodeHeightsAtLabelBound()` returns the same map at every zoom. IT DOES NOT: ' +
      '`boundIsZoomInvariant` is COMPUTED AND PRINTED in `HZJSON`, and there is no `expect` on ' +
      'it anywhere in the file — which is correct, because it is FALSE at this tip by a named, ' +
      'bounded margin (the map takes TWO values, one for every zoom at or above ' +
      '`LABEL_LEGIBLE_ZOOM` and a 92px / 1.48% shorter one below it, where the LOD rung flips to ' +
      '`line`). Asserting it would put this job permanently red. An oracle written from a ' +
      'docblock rather than from the assertions is a perfect score on the wrong exam ' +
      '(CLAUDE.md trap 13c), and this entry nearly shipped one. ' +
      '⭐ WHAT IT DOES ASSERT, and it is the LOD DIRECTION, which is the half the safety argument ' +
      'actually rests on: (a) no card is TALLER with LOD on than the tallest it reaches with LOD ' +
      'off — the layout reserves the LOD-off height, so a card that grew overflows its row band; ' +
      'and (b) the worst LOD SHRINK stays under the tightest slack the layout leaves ' +
      '(`SUB_ROW_SLACK`, derived from the same two values `normaliseTierRows` uses, never ' +
      'restated) — the mirror case, where a layout computed while LOD is ON reserves the shorter ' +
      'height and zooming back in pushes a card into the row beneath. One direction alone is a ' +
      'guard watching one door (CLAUDE.md trap 22b). ' +
      '⭐ AND ITS CONTROLS DISCRIMINATE: a POSITIVE one (`--canvas-label-scale` and the computed ' +
      'title font-size MUST change across the series, or the probe never exercised the ' +
      'mechanism); a CONTRAST one (an element OUTSIDE the React Flow subtree must NOT change, or ' +
      'the probe is measuring a page re-render); a non-vacuity one ("NO card changed height ' +
      'across the LOD threshold" REDs, because a comparison that discriminates nothing cannot ' +
      'report "nothing grew"); and a completeness one (every requested zoom was visited). ' +
      '⚠ ITS DETECTION FLOOR IS MEASURED, NOT ASSUMED — `text-3xl` on the LOD title boost is a ' +
      'DEMONSTRATED equivalent mutant (at 30px the card lands level with its LOD-off self, so ' +
      'there is no harm to detect), and it REDs from `text-5xl` up. That floor is not a weakness, ' +
      'it IS the property. `lodTitleBoostIsBounded.spec.ts` compares DECLARED SIZES and is ' +
      'strictly more sensitive on the title alone; neither substitutes for the other. ' +
      '⚠ ITS OWN FIRST VERSION WAS WORTHLESS IN BOTH DIRECTIONS — it set the camera and assumed ' +
      'it held, while the product re-fitted underneath it (`1.2 1 0.5 0.5 0.7` for a requested ' +
      '`1.2 1 0.9 0.8 0.7`). Every sample now re-reads the camera and excludes-and-reports what ' +
      'did not settle rather than averaging it in.',
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

  /*
   * ── EXCLUDED BECAUSE THEY EMIT A REPORT, NOT A VERDICT ────────────────────
   * The claim-type test at the top of this file, applied. Each of these has
   * ZERO product assertions at this tip — derived by reading them, and the
   * count is checkable: `grep -c 'expect(' <file>` returns 0 for the first
   * four. A gate arm must be able to go RED for a product reason; a file whose
   * only hard failures are instrument failures can only ever report that the
   * instrument broke.
   */
  {
    what: 'edgeLabelOverlap.measure.ts (5 cells, 17.7s darwin) — the P0 glyph-on-glyph defect',
    why:
      '⚠ THE MOST PAINFUL EXCLUSION HERE, AND IT IS NOT ABOUT COST — at 3.5s a cell it is the ' +
      'cheapest thing in this directory. Its own header states it: "a MEASUREMENT instrument, ' +
      'not a gate ... No assertions about what the numbers ought to be beyond the vacuity ' +
      'control". It emits one `EDGELBL {...}` line per cell and asserts nothing about them, so ' +
      'tagging it would add a green arm that cannot fail — wall clock with no safety, which is ' +
      'the precise thing this admission round exists to avoid. THE WORK TO MAKE IT GATEABLE IS ' +
      'SMALL AND WORTH DOING: it already computes `overlaps` and `occluded` and already reports ' +
      'a VACUOUS cell (fewer than two labels can never observe an overlap), so what is missing ' +
      'is the ruling on what those numbers are ALLOWED to be. That is a product decision, not a ' +
      'test edit, and inventing one here would be an oracle written from the author\'s head ' +
      '(CLAUDE.md trap 13c). Rowed in the PR.',
  },
  {
    what: 'canonicalGeometry.measure.ts (15 cells, 44.8s), overlapSequence.measure.ts, threadAutoScroll.measure.ts, nodeMarkCensus.measure.ts (31.7s)',
    why:
      'Same claim-type test. Each says so in its own header — "a MEASUREMENT instrument, not a ' +
      'gate" / "the census that decides what a middle rung is allowed to drop" — and the first ' +
      'three carry zero `expect(` calls between them. They answer "what is the number?"; a gate ' +
      'answers "did this behaviour survive?".',
  },
  {
    what: 'savedExampleShowWholeModel.measure.ts (20 arms, ~200s darwin — the single most expensive file here)',
    why:
      'EXCLUDED ON CLAIM TYPE FIRST, COST SECOND, and the order matters because the cost alone ' +
      'would be a weaker reason. Its header is explicit: "THIS FILE MEASURES; IT DOES NOT ' +
      'JUDGE ... the only hard failures are INSTRUMENT failures ... A product assertion here ' +
      'would abort the run on the first bad arm and cost the other nineteen." That design is ' +
      'right for what it is for — a before/after sweep where a NON-reproduction is as ' +
      'reportable as a defect — and wrong for a merge gate. ⭐ ITS TWO INSTRUMENT DEFECTS ARE ' +
      'FIXED IN THIS COMMIT ANYWAY (the overlay-band blindness and the settle latch, below): ' +
      'an ungated measure whose numbers are systematically wrong still misleads every lane that ' +
      'reads them, and a before/after built on a biased instrument is not a comparison.',
  },

  /*
   * ── EXCLUDED BECAUSE THEY ARE RED AT THE BASE ────────────────────────────
   * An arm that is already failing cannot gate anything: it would put this job
   * permanently red, which is exactly how this repo acquired `Visual
   * Regression`. Measured at `bd18bace` on darwin, whole-directory sweep,
   * 87 passed / 32 failed / 17.9m. These are FINDINGS, and they are rowed in
   * the PR rather than silently absorbed — a red nobody rowed is how a standing
   * red starts.
   */
  {
    what: "showWholeModel.measure.ts — 'the user's overview survives a re-layout of the same model' (RED at the base)",
    why:
      '⚠ A REAL RED, AND THE MOST VALUABLE THING THIS ADMISSION ROUND FOUND. At `bd18bace` it ' +
      'reports 11 of 19 model nodes outside the visible canvas after a forced re-layout of the ' +
      'SAME model — i.e. "Show whole model" does not survive a corrective layout pass at the ' +
      'current tip. ⭐ AND IT IS NOT THE SETTLE-LATCH DEFECT: the latch was fixed first and the ' +
      'arm was re-run, which is the only way to tell a false red from a true one. It moved ' +
      '11 -> 12 of 19, and the extra node is the overlay-band fix correctly counting an ' +
      'occlusion the old frame was blind to. Its opposite-direction twin ("a NEW model is still ' +
      'framed by the product") PASSES, so this is one direction failing, not a broken file. ' +
      'It is a strong future gate arm — real assertions, both directions, preconditions pinned ' +
      '— and it is admissible the day the product change lands, not before.',
  },
  {
    what: 'analysisAnswerFirst.measure.ts (2 arms), decisionNodeHittest.measure.ts (29 arms), viewportRestoreFit.measure.ts (1 of 3 arms), zoomLadder.measure.ts (RED at the base)',
    why:
      'Same rule. Measured at `bd18bace`: 32 of the directory\'s 119 arms fail at pristine and ' +
      'these are the rest of them. ⚠ NAMED RATHER THAN SUMMARISED, because "some measures are ' +
      'red" is the kind of sentence that stops anyone looking. Nothing here is a claim about ' +
      'WHY they are red — a red at the base can be a product defect, a stale expectation or a ' +
      'darwin-only artefact, and this lane did not diagnose them. Rowed in the PR.',
  },

  /*
   * ── EXCLUDED ON THE BUDGET, AND HERE IS THE BUDGET ───────────────────────
   *
   * ⭐⭐ THE BUDGET IS "THE GATE MUST NOT BE ON THE WORKFLOW'S CRITICAL PATH",
   * NOT A NUMBER SOMEBODY LIKED. Derived from the run at `bd18bace`
   * (33743994788), every job in `staging-full-tests.yml`, seconds:
   *
   *     674  Full Test Suite (shard 2/4)   <- the critical path
   *     667  Full Test Suite (shard 1/4)
   *     643  Full Test Suite (shard 3/4)
   *     554  Visual Regression (advisory)
   *     488  Full Test Suite (shard 4/4)
   *     361  Typecheck Gate Self-Test
   *     280  Core E2E (advisory)
   *     226  Canvas Browser Gate (advisory) <- before this commit
   *     196  TypeScript + Lint
   *
   * `canvas-gate` runs in PARALLEL with those and is absent from `Staging
   * Gate`'s `needs`, so every second it spends under ~674s costs the workflow
   * NOTHING — not one second of anybody's wait. The budget is therefore
   * **600s of job wall clock**, which keeps a margin under the critical path
   * for runner variance and stays far under both the 20-minute
   * `timeout-minutes` and the "twenty minutes and people route around it"
   * threshold this file was shaped by.
   *
   * MEASURED FROM THE JOB'S OWN STEP TIMINGS, both sides, not extrapolated:
   *   before  226s job  =  28s setup + 17s vite boot + 174s tests (4 arms)
   *                        run 33743994788, `bd18bace`
   *   after   346s job  =  45s setup + 21s vite boot + 271s tests (23 arms)
   *                        run 33750968965, `9c3a8e9b`
   *           429s job  =  the SAME 23 arms, run 33752104701, `e15987d8`,
   *                        on a diff that changed only comments
   *
   * ⭐⭐ USE 429s, NOT 346s, AND THE 83s BETWEEN THEM IS THE POINT. Two runs of
   * an identical set differ by a quarter of the job, so a single figure is not
   * a measurement of this job, it is one draw from it — and the next lane will
   * compute its headroom from whatever number is written here. Against 346s the
   * headroom reads 254s and `draftFitCameraOwnership` (~103s) looks like an easy
   * yes; against 429s it reads 171s and the same admission lands at ~532s, still
   * inside 600s but with the margin nearly gone. Same decision, very different
   * confidence. ⚠ Two observations bound nothing tightly: treat 429s as a FLOOR
   * on the worst case, not as the worst case (CLAUDE.md trap 23 — compare
   * distributions, never a rate).
   *
   * The 4 -> 23 arm growth is ~6x the assertions for 1.5-1.9x the wall clock,
   * because the two arms already in the gate are the expensive ones (~66-78s
   * each on ubuntu; they reseed once per key per control) and the 19 admitted
   * ones average 10.5s.
   *
   * ⚠ THE PROJECTION THAT PRECEDED THIS MEASUREMENT WAS 440-465s — PESSIMISTIC
   * BY ~100s, and it is left recorded rather than quietly replaced. It came from
   * multiplying darwin timings by the worst observed ubuntu ratio (1.9x), which
   * is the right way to be wrong for a budget decision: it can refuse an arm
   * that would have fitted, and it cannot admit one that will not. Do not
   * "correct" the multiplier downwards on the strength of one run.
   *
   * ⚠ ubuntu RUNS ~1.9x DARWIN ON THIS SUITE, derived from the three arms
   * measured on both (41.2 -> 78s, 6.2 -> 9.3s, 6.9 -> 8.7s) and applied at the
   * WORST of those ratios. Do not convert darwin numbers with a friendlier one.
   */
  {
    what: 'draftFitCameraOwnership.measure.ts (5 arms, 54.4s darwin ≈ 103s ubuntu) — green at the base, genuinely assertive',
    why:
      'THE FIRST THING OVER THE LINE, AND THE HONEST ANSWER IS THE BUDGET. Admitting it takes ' +
      'the job to ~544s against a 600s budget, leaving under 60s of headroom for runner ' +
      'variance on a suite whose slowest arm already varies by ~20s between runs. It is also ' +
      'the LEAST marginal of the candidates: it asks the same question as `showWholeModel` ' +
      '(does the user\'s overview hold?) and its own header records that the gated half of its ' +
      'fix already exists as a vitest spec, ' +
      '`src/canvas/__tests__/useFitViewOnLayoutVersion.userOverview.spec.tsx`. ⭐ IT IS THE ' +
      'NAMED NEXT ADMISSION: if the 600s budget is ever raised, or if the two nodeKeyboardBleed ' +
      'arms are made cheaper, this goes in before anything else.',
  },
  {
    what: 'dockClippingPopulated.measure.ts (3 arms, 13.6s), dominantNudgeNumber.measure.ts (4.1s), decisionBriefAssumed.measure.ts, restoreHeightDelta.measure.ts (41.8s), lazyChunkStall.measure.ts (67.8s)',
    why:
      'Green at the base and cheap enough, but NONE of them is a CANVAS GEOMETRY defect of the ' +
      'class this job exists for — they are dock clipping, panel copy, a restore-delta ' +
      'diagnostic and a route-chunk timeout. This gate is deliberately the smallest set that ' +
      'would have caught the shipped canvas defects, and the reason it can be believed is that ' +
      'it has not become "the browser job". Widening it by subject is a separate ruling with ' +
      'its own budget, not a tidy-up. ⚠ `lazyChunkStall` also spends 45s of its 68s ' +
      'DELIBERATELY WAITING on a stall bound, so its cost cannot be optimised away.',
  },
  {
    what: 'THE STANDING RULE FOR THE NEXT LANE',
    why:
      'A file is not excluded by being absent from `GATED_TESTS` — it is excluded by carrying ' +
      'no `GATE_TAG`. To admit one: (1) show it GREEN at the base, twice, or it is a standing ' +
      'red waiting to happen; (2) show it can FAIL, by reverting the fix it guards or ' +
      'perturbing the geometry — an arm that cannot go red is wall clock with no safety, and ' +
      'that is the only test this list refuses to waive; (3) name the SHIPPED defect it would ' +
      'have caught, in its registry entry; (4) state its measured cost and the resulting job ' +
      'wall clock against the 600s budget above, from the job\'s own timings and not from a ' +
      'local run; (5) land the tag and the registry entry IN THE SAME COMMIT, because either ' +
      'alone REDs the teardown by design.',
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
