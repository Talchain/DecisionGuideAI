/**
 * ⭐⭐⭐ THE TWO CRITICAL-THINKING PROMPTS CARRY THE TARGET FLOOR — the guard
 * `CANVAS_MIN_TARGET_BOX_STYLE` shipped without, and the reason its absence was
 * invisible to everything already in the tree.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔⛔ WHAT THIS FILE CLAIMS, AND WHAT IT REFUSES TO CLAIM
 * ─────────────────────────────────────────────────────────────────────────────
 * **jsdom has no layout, so nothing here proves a single painted pixel**
 * (CLAUDE.md trap 3). The claim is narrower and is stated rather than implied by
 * a green run:
 *
 *   CLAIMED   the floor is DECLARED on both controls, on BOTH axes, built from
 *             `MIN_TARGET_RENDERED_PX` and `CANVAS_LABEL_SCALE_VAR` rather than
 *             hand-spelled — and the arithmetic of that declaration reaches the
 *             WCAG 2.2 AA 2.5.8 minimum in the px the user is handed, across the
 *             whole legible band.
 *   REFUSED   that the control paints 24 x 24 real pixels, that it is visible,
 *             that it is not covered, that it is reachable by touch. Those need
 *             a browser. Nothing below should be quoted as evidence for them.
 *
 * `renderedLabelPx` exists precisely because of that boundary: it is arithmetic
 * over the declared value and the viewport transform, and its own doc says it is
 * *"the ONLY honest way to make a legibility claim in a jsdom test"*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ WHY NOTHING ALREADY IN THE TREE COULD HAVE CAUGHT THIS — BOTH BLIND SPOTS
 * ─────────────────────────────────────────────────────────────────────────────
 * `canvasGlyphTargetScale.spec.tsx` is the fleet registry for canvas targets and
 * it cannot see either of these controls, twice over:
 *
 *   1. `targetsIn` filters to `(el.textContent ?? '').trim() === ''` — a
 *      deliberate, correctly-argued scope decision that excludes every
 *      TEXT-BEARING control, which is exactly what both of these are.
 *   2. `sizeFromClass` reads heights out of the CLASS string only. An inline
 *      `style` is invisible to it even if the filter above were widened.
 *
 * So `CANVAS_MIN_TARGET_BOX_STYLE` could be deleted from both call sites with
 * the registry, and the whole suite, staying GREEN. Measured with a contrast
 * control before this file existed: the constant had **0 test references**
 * across `src/`, while its sibling `MIN_TARGET_RENDERED_PX` had many
 * (`canvasGlyphTargetScale.spec.tsx`, `theCountIsTheWayIn.spec.tsx`,
 * `ConstraintBadge.spec.tsx`). A real absence, not a blind sweep.
 *
 * ⭐ WIDENING THE REGISTRY IS ROWED, NOT DONE HERE. It needs a text-bearing
 * branch, an inline-style reader, and a re-derivation of `KNOWN_SHORT_TARGETS`
 * across all five registered surfaces. Half of that would produce a registry
 * that LOOKS fleet-wide and is not — the defect that file's own header was
 * written about. See `canvasGlyphScale.ts`'s constant header for the row.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ THE MUTATION THIS FILE IS WRITTEN TO FAIL ON, NAMED SO IT CAN BE CHECKED
 * ─────────────────────────────────────────────────────────────────────────────
 * Delete `style={CANVAS_MIN_TARGET_BOX_STYLE}` from `NodeChip.tsx` OR from
 * `TierInvitation.tsx` and the corresponding element's `style.minHeight` reads
 * `''`, `parseFloor` returns `null`, and the named assertion REDs. Change the
 * `24` to a hand-spelled literal at either call site and the parse-back
 * assertion REDs on the px, not on the spelling. Drop one axis and the
 * per-axis loop REDs on that axis alone.
 *
 * ⛔ NOT EXECUTED. This spec was written under a no-run cost constraint: no
 * install, no vitest, no tsc, nothing driven. CI at the pushed head is the
 * authority for whether it passes, and the mutation pair above is the check to
 * run before trusting it. **The same constraint applies to the round-3 edits
 * below: also unrun.**
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ ROUND 3 — WHAT THIS FILE GOT WRONG, AND WHAT THE CI LOG SAID
 * ───────────────────────────────────────────────────────────────────────────────
 * **1. AN ASSERTION MESSAGE RED A REQUIRED CHECK.** `expectFlooredBox` spelled
 * the property as a literal ellipsis character, and
 * `tests/ci-guards/css-var-resolution.spec.ts` reports any `var()` name region
 * that reaches for a custom property and gets it wrong — wherever it appears,
 * prose included. Prose in a test file is scanned code. It names the real
 * property now.
 *
 * **2. THREE ASSERTIONS COULD NEVER RED, AND ONE OF THEM CITED TRAP 13.** Each
 * is repaired in place with the reasoning at the line, not summarised away here:
 *   · the constant's own px, parsed back out and compared to the constant it is
 *     INTERPOLATED FROM — now pinned to `WCAG_MIN_TARGET_CSS_PX`, a literal;
 *   · `expect(getByTestId(…)).not.toBeNull()` — the query throws first, so the
 *     matcher was unreachable; now a COUNT inside the row;
 *   · `expect(subjects.length).toBe(1 + INVITATIONS.length)` — true by
 *     construction, and the line written to prevent vacuity was the vacuous one;
 *     now counted against the DOM.
 * A fourth, `minHeight.px === minWidth.px`, followed by transitivity from the
 * loop two lines above it and is deleted with its reason left in place.
 *
 * ⚠ THE PART A READER SHOULD NOT INHERIT: these are claims about what CAN red,
 * derived by reading. None has been executed, and a mutation pair is still the
 * only thing that settles it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { NodeChip } from '../NodeChip'
import { TierInvitationRow } from '../TierInvitation'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { CANVAS_MIN_TARGET_BOX_STYLE, MIN_TARGET_RENDERED_PX } from '../canvasGlyphScale'
import {
  CANVAS_LABEL_SCALE_VAR,
  LABEL_LEGIBLE_ZOOM,
  MAX_LABEL_COUNTER_SCALE,
  lodBodyHiddenAt,
  renderedLabelPx,
  resolveLodRung,
} from '../../../utils/zoomLegibility'
import type { TierInvitation } from '../../../utils/ghostTiers'

/**
 * The two axes WCAG 2.2 AA 2.5.8 asks about. Written as a list so a dropped
 * axis REDs on the axis by name rather than silently halving what is measured —
 * the shortfall this constant shipped with was precisely one axis claimed and
 * not delivered.
 */
const AXES = ['minHeight', 'minWidth'] as const

/**
 * IEEE-754 slack, and it is NOT a tolerance on the product claim.
 * `renderedLabelPx(24, 0.75)` evaluates to 23.999999999999996 because
 * `1 / 0.75` is not exact in binary — a spec that asserted `>= 24` there would
 * RED on arithmetic rather than on a defect.
 *
 * ⚠ IT IS A NANOMETRE-SCALE ALLOWANCE ON A PIXEL QUANTITY — nine orders of
 * magnitude below one CSS px — so it cannot absorb any shortfall this module
 * can express. Stated that way deliberately: the tempting sentence here is
 * "the smallest real shortfall is Npx, far above this", and that would be a
 * claim about every possible future call site which nothing measured
 * (CLAUDE.md trap 14 — the most rhetorically useful sentence is the one nobody
 * checks). The defensible claim is the arithmetic one, so it is the one made.
 */
const FLOAT_SLACK = 1e-9

/**
 * ⭐ WCAG 2.2 AA 2.5.8's minimum, SPELLED AS A LITERAL ON PURPOSE — the one
 * place in this file where a literal is the honest form.
 *
 * `CANVAS_MIN_TARGET_BOX_STYLE` is BUILT by interpolating
 * `MIN_TARGET_RENDERED_PX`, so parsing that constant back out and asserting it
 * equals `MIN_TARGET_RENDERED_PX` compares a value with itself: both sides move
 * together and the assertion can never RED. Lowering the constant to 12 would
 * have passed. 24 CSS px is an EXTERNAL requirement and is not ours to derive,
 * so it is pinned here and the criterion REDs when the constant leaves it.
 *
 * ⚠ THIS IS NOT THE PIN FOR THE RENDERED ELEMENTS. `expectFlooredBox` keeps
 * comparing those against `MIN_TARGET_RENDERED_PX`, because there the two sides
 * are INDEPENDENT — a call site that hand-spells a different number REDs on the
 * number, which is the whole argument of `parseFloor`'s header.
 */
const WCAG_MIN_TARGET_CSS_PX = 24

/**
 * Every zoom in the band the product calls legible, DERIVED from
 * `LABEL_LEGIBLE_ZOOM` — never a bare `0.5` restated here, which is the
 * hand-maintained mirror `zoomLegibilitySingleSource.spec.ts` exists to ban
 * (CLAUDE.md trap 12). The midpoint is included because the two endpoints alone
 * would both land on exact binary fractions and hide the float behaviour above.
 */
const LEGIBLE_BAND = [LABEL_LEGIBLE_ZOOM, (LABEL_LEGIBLE_ZOOM + 1) / 2, 1]

/** Two zooms BELOW the floor, also derived. See the L1 pin at the bottom. */
const BELOW_FLOOR = [LABEL_LEGIBLE_ZOOM / 2, LABEL_LEGIBLE_ZOOM * 0.8]

/**
 * Reads the floor back OUT of a rendered element, by MEANING rather than by
 * spelling.
 *
 * ⚠ IT DELIBERATELY DOES NOT COMPARE AGAINST A STRING BUILT THE SAME WAY.
 * Rebuilding the expected value from MIN_TARGET_RENDERED_PX and comparing whole
 * strings would be a guard agreeing with itself (CLAUDE.md trap 13b) — change
 * the constant and both sides move together, so the assertion can only ever see
 * a SPELLING change. Parsing the px and the var name back out instead means a
 * call site that hand-spells a different number REDs on the NUMBER, which is
 * the thing that matters.
 */
function parseFloor(value: string): { px: number; varName: string; fallback: string } | null {
  const m = /^calc\(\s*(\d+(?:\.\d+)?)px\s*\*\s*var\(\s*(--[\w-]+)\s*,\s*([^)]*?)\s*\)\s*\)$/.exec(value)
  if (m === null) return null
  return { px: parseFloat(m[1]!), varName: m[2]!, fallback: m[3]! }
}

/**
 * The floor as the user is handed it, at `zoom`. `renderedLabelPx` collapses
 * `declared x counterScale(zoom) x zoom`, which is the whole reason a guard
 * written in the producer's units could score 24 while the user got 12.
 */
const renderedFloorPx = (declaredPx: number, zoom: number): number => renderedLabelPx(declaredPx, zoom)

/**
 * Asserts a rendered element carries the floor on both axes and returns the
 * declared px it carries — bound to the element passed in, never re-found by a
 * predicate a sibling could satisfy.
 */
function expectFlooredBox(el: HTMLElement, who: string): number {
  const parsed: Record<string, ReturnType<typeof parseFloor>> = {}
  for (const axis of AXES) {
    const raw = el.style[axis]
    const p = parseFloor(raw)
    expect(
      p,
      `${who}: no ${axis} floor — style.${axis} was "${raw}". ` +
        `Either \`style={CANVAS_MIN_TARGET_BOX_STYLE}\` is missing from this call site, ` +
        `or the constant stopped spelling calc(Npx * var(--canvas-label-scale, 1)).`,
    ).not.toBeNull()
    expect(p!.px, `${who}: ${axis} floors ${p!.px}px, not MIN_TARGET_RENDERED_PX`).toBe(
      MIN_TARGET_RENDERED_PX,
    )
    expect(p!.varName, `${who}: ${axis} reads the wrong custom property`).toBe(CANVAS_LABEL_SCALE_VAR)
    parsed[axis] = p
  }
  // ⚠ THERE IS NO CROSS-AXIS EQUALITY ASSERTION HERE, AND ITS ABSENCE IS THE
  // POINT. This read `expect(parsed.minHeight.px).toBe(parsed.minWidth.px)`
  // under a comment calling it a same-box invariant. The loop above has already
  // pinned BOTH axes to `MIN_TARGET_RENDERED_PX`, so the equality follows by
  // transitivity and could never RED — a guard agreeing with itself
  // (CLAUDE.md trap 13b), spent before it was written. The invariant it named is
  // carried by the loop; restating it bought a line that cannot fail.
  return parsed.minHeight!.px
}

const INVITATIONS: readonly TierInvitation[] = [
  {
    anchorNodeId: 'node-a',
    label: 'What else could you do?',
    prompt: 'What other options could answer this that I have not put on the board?',
    tier: 'option',
  },
  {
    anchorNodeId: 'node-a',
    label: 'What else could go wrong?',
    prompt: 'What other risks sit outside the ones on the board?',
    tier: 'risk',
  },
]

const CHIP_LABEL = 'What would change your mind?'

beforeEach(() => {
  // `TierInvitationRow` is gated on `canReceiveAsk`: with all three bridges
  // null it renders NOTHING and every assertion below would iterate zero
  // elements — trap 13 vacuity, and the reason the fixture is pinned by
  // identity in its own test rather than trusted.
  useGuidanceStore.setState({
    _sendMessage: vi.fn(),
    _prefillChat: vi.fn(),
    _dispatchAction: vi.fn(),
  } as never)
})

describe('the critical-thinking prompts carry the WCAG target floor', () => {
  /**
   * ⭐⭐ THE INSTRUMENT CONTROL, AND IT IS NOT OPTIONAL.
   *
   * Every product assertion in this file reads a `calc()` containing a `var()`
   * back out of jsdom's CSSOM. If `cssstyle` ever stops round-tripping that
   * shape, `style.minHeight` reads `''` — which is INDISTINGUISHABLE from the
   * product defect this file exists to catch. A lane would then see a RED,
   * conclude the floor had been removed, and "fix" working code.
   *
   * So the instrument is proved first, and it is proved in BOTH directions: a
   * styled node must read the value back, an unstyled one must read empty. One
   * alone shows nothing — a reader that returns the same answer for every input
   * is not discriminating (CLAUDE.md trap 20).
   */
  it('CONTROL: jsdom round-trips this style shape, and can tell it from absent', () => {
    render(
      <div>
        <div data-testid="styled" style={CANVAS_MIN_TARGET_BOX_STYLE} />
        <div data-testid="bare" />
      </div>,
    )
    const styled = screen.getByTestId('styled')
    const bare = screen.getByTestId('bare')

    for (const axis of AXES) {
      expect(
        styled.style[axis],
        `INSTRUMENT FAILURE, not a product defect: jsdom dropped ${axis} from a ` +
          `calc(...var(...)) inline style. Every assertion in this file is unreadable ` +
          `until this passes — do NOT read a RED below as the floor having been removed.`,
      ).not.toBe('')
      expect(parseFloor(styled.style[axis]), `CONTROL: ${axis} did not parse`).not.toBeNull()
      // The negative half: the reader must return EMPTY for an element with no
      // floor, or "present" is a constant and every assertion below is vacuous.
      expect(bare.style[axis], `CONTROL: an unstyled node reported a ${axis}`).toBe('')
      expect(parseFloor(bare.style[axis]), `CONTROL: an unstyled node parsed a floor`).toBeNull()
    }
  })

  /**
   * The second control: the ARITHMETIC must discriminate too. A counter-scaled
   * floor and a bare one of the same declared size must NOT measure the same,
   * or the band assertions further down are agreeing with themselves.
   */
  it('CONTROL: the rendered-px measurement tells a counter-scaled floor from a bare one', () => {
    // Counter-scaled: rendered === declared, by construction, at the settle zoom.
    expect(renderedFloorPx(MIN_TARGET_RENDERED_PX, LABEL_LEGIBLE_ZOOM)).toBe(MIN_TARGET_RENDERED_PX)
    // Bare (what a plain `min-height: 24px` would do): halved at the settle zoom.
    expect(MIN_TARGET_RENDERED_PX * LABEL_LEGIBLE_ZOOM).toBeLessThan(MIN_TARGET_RENDERED_PX)
    // …and the two are genuinely different numbers, which is the discrimination.
    expect(MIN_TARGET_RENDERED_PX * LABEL_LEGIBLE_ZOOM).not.toBe(
      renderedFloorPx(MIN_TARGET_RENDERED_PX, LABEL_LEGIBLE_ZOOM),
    )
  })

  it('the constant is DERIVED on both axes, and shared rather than rebuilt per render', () => {
    for (const axis of AXES) {
      const p = parseFloor(String(CANVAS_MIN_TARGET_BOX_STYLE[axis] ?? ''))
      expect(p, `CANVAS_MIN_TARGET_BOX_STYLE has no ${axis}`).not.toBeNull()
      // Against the LITERAL, not against `MIN_TARGET_RENDERED_PX`: the constant
      // interpolates it, so the two sides move together and the old form could
      // never RED. See `WCAG_MIN_TARGET_CSS_PX`.
      expect(p!.px, `${axis} floors ${p!.px}px, not the 2.5.8 minimum`).toBe(WCAG_MIN_TARGET_CSS_PX)
      // This one BITES, and only since the property name stopped being
      // interpolated into the `var()` name region: the constant now spells
      // `--canvas-label-scale` literally, because interpolating it made the
      // reference DYNAMIC to `scripts/css-var-census.mjs` and moved the exact
      // dynamic-site pin in `tests/ci-guards/css-var-resolution.spec.ts`. So
      // the literal and `CANVAS_LABEL_SCALE_VAR` are genuinely two sides now,
      // and a divergence REDs here rather than moving both at once.
      expect(p!.varName, `${axis} does not read CANVAS_LABEL_SCALE_VAR`).toBe(CANVAS_LABEL_SCALE_VAR)
    }
    // Its header claims a frozen module-level object so a `memo`'d button is not
    // re-rendered by a fresh style literal each pass. Claimed, therefore pinned.
    expect(Object.isFrozen(CANVAS_MIN_TARGET_BOX_STYLE)).toBe(true)
  })

  /**
   * ⭐ BOUND BY ACCESSIBLE NAME, NOT BY "the only button on screen".
   * `NodeChip` renders a `<span role="status">` alongside its button; a
   * `querySelector('button')` would work today and would silently start
   * measuring something else the day a second control joins the fixture
   * (CLAUDE.md trap 19).
   */
  it('NodeChip — the coaching chip carries the floor', () => {
    render(
      <NodeChip
        label={CHIP_LABEL}
        message="Tell me what evidence would change this."
        chipId="chip-what-would-change"
        actionType={null}
      />,
    )
    const chip = screen.getByRole('button', { name: CHIP_LABEL })
    expectFlooredBox(chip, 'NodeChip')
  })

  /**
   * Bound by the testid the component mints from the TIER, so each invitation is
   * asserted as itself. A count would be satisfied by either button; these are
   * DIFFERENT QUESTIONS, and sending the wrong one to the model is the product
   * harm the target work exists to avoid.
   */
  it('TierInvitation — every invitation on the card carries the floor', () => {
    render(<TierInvitationRow invitations={INVITATIONS} nodeId="node-a" />)
    // Pin the precondition — with something that CAN red. This asserted
    // `expect(screen.getByTestId('tier-invitations')).not.toBeNull()`, and
    // `getByTestId` THROWS on absence: by the time the matcher ran the query had
    // already decided the test, so the matcher could never fail. A closed gate
    // does RED this test, but on the throw, never on that line.
    // The COUNT inside the row can fail: it REDs if the gate opens and the row
    // mounts fewer invitations than the fixture supplied.
    const row = screen.getByTestId('tier-invitations')
    expect(
      within(row).getAllByRole('button'),
      'the invitation row mounted a different number of controls than the fixture supplied',
    ).toHaveLength(INVITATIONS.length)
    for (const inv of INVITATIONS) {
      expectFlooredBox(screen.getByTestId(`tier-invitation-${inv.tier}`), `TierInvitation(${inv.tier})`)
    }
  })

  /**
   * ⭐⭐ THE CLAIM THAT ACTUALLY MATTERS: the floor is expressed in the px the
   * USER gets, not in the producer's units. This is the defect
   * `canvasGlyphTargetScale.spec.tsx`'s header records — a guard scored 24 in
   * CSS px while the viewport transform handed the user 12.
   *
   * Asserted off the DECLARED value read back from each rendered element, so it
   * is a claim about the DOM rather than about the constant.
   */
  it('both controls reach the minimum IN RENDERED px across the whole legible band', () => {
    render(
      <>
        <NodeChip
          label={CHIP_LABEL}
          message="Tell me what evidence would change this."
          chipId="chip-what-would-change"
          actionType={null}
        />
        <TierInvitationRow invitations={INVITATIONS} nodeId="node-a" />
      </>,
    )
    const subjects: Array<{ who: string; el: HTMLElement }> = [
      { who: 'NodeChip', el: screen.getByRole('button', { name: CHIP_LABEL }) },
    ]
    for (const inv of INVITATIONS) {
      subjects.push({
        who: `TierInvitation(${inv.tier})`,
        el: screen.getByTestId(`tier-invitation-${inv.tier}`),
      })
    }
    // ⛔ THE PRECONDITION, PINNED AGAINST THE DOM RATHER THAN AGAINST THE ARRAY
    // THIS TEST JUST BUILT. It read
    // `expect(subjects.length).toBe(1 + INVITATIONS.length)` under a comment
    // citing trap 13 — and `subjects` is one push plus one per invitation, with
    // every query throwing on absence, so the equality held BY CONSTRUCTION and
    // could never RED. A fixture that rendered nothing would throw at
    // `getByRole`, not loop zero times. The line written to prevent vacuity was
    // itself the vacuous one.
    // Counting the buttons in the document CAN red, and catches the failure the
    // old line only claimed to: a control joining this fixture that the loop
    // below is silently not measuring. Derived at the two components' bytes —
    // `NodeChip` renders one <button> plus a <span role="status">, and
    // `TierInvitationRow` one <button> per invitation and nothing else.
    expect(
      screen.getAllByRole('button'),
      'the fixture mounted a different set of controls than this test measures',
    ).toHaveLength(subjects.length)

    for (const { who, el } of subjects) {
      const declared = expectFlooredBox(el, who)
      for (const zoom of LEGIBLE_BAND) {
        const rendered = renderedFloorPx(declared, zoom)
        expect(
          rendered,
          `${who}: a floor declared at ${declared}px reaches the user as ${rendered}px at zoom ` +
            `${zoom} — WCAG 2.2 AA 2.5.8 asks ${MIN_TARGET_RENDERED_PX}px. The floor must carry ` +
            `the canvas counter-scale, not be a bare px value.`,
        ).toBeGreaterThanOrEqual(MIN_TARGET_RENDERED_PX - FLOAT_SLACK)
      }
    }
  })

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * ⛔⛔ L1 — THE BOUNDED LIMIT BELOW THE LEGIBLE FLOOR, PINNED RATHER THAN
   * ASSUMED AWAY. THE RUNG IS NAMED, AND THE USUAL DEFENCE IS REFUTED.
   * ─────────────────────────────────────────────────────────────────────────
   * `labelCounterScale` CAPS at `MAX_LABEL_COUNTER_SCALE`, so below the floor
   * the rendered target is `declared x MAX_LABEL_COUNTER_SCALE x zoom` and
   * falls away linearly: 19.2px at zoom 0.4, 12px at 0.25. The auto-fit cannot
   * park there (`useFitViewOnLayoutVersion` passes the floor as `minZoom`), but
   * the canvas is `minZoom={0.1}` (`ReactFlowGraph.tsx:988`) so a USER zoom-out
   * reaches it.
   *
   * ⚠⚠ THE DEFENCE — *"level-of-detail has dropped the text down there"* — IS
   * STATED IN COMMENTS AND DOES NOT HOLD FOR EITHER CALL SITE. Derived at
   * `BaseNode.tsx`, not inferred:
   *   · `TierInvitationRow` renders **OUTSIDE** the wrapper LOD blanks, on
   *     purpose, with a comment saying exactly that (`BaseNode.tsx:1878-1881`).
   *   · `NodeChip` is inside that wrapper, but blanking is
   *     `lodBodyBlanked = bodyReduced && lodBodyLine !== null`
   *     (`BaseNode.tsx:486`), whose own doc names REACHABLE null arms. On those
   *     cards the body is not blanked and the chips render.
   *
   * ⛔ SO THIS IS RECORDED AS A KNOWN LIMIT, NOT AS A CLOSED CASE. Closing it
   * would mean raising the counter-scale cap or sizing the target off `zoom`
   * directly — and `MAX_LABEL_COUNTER_SCALE` is what node GEOMETRY is sized
   * against (`nodeLayoutConstants.ts`), so that moves the layout with it. Out
   * of this seam. What is NOT acceptable is the limit being invisible: pinned
   * below so the suite REDs if the shortfall is fixed without deleting this
   * pin, or if its shape changes (CLAUDE.md trap 22f).
   *
   * ⚠ RUNG NAMED, AND ASSERTED — this is the part the review asked for. Below
   * the floor the ladder IS at `line`, and `line` IS the rung that hides a
   * body. Both are pure functions, so this cannot flake.
   */
  it('L1: below the legible floor the target is SHORT — the limit, pinned exactly', () => {
    for (const zoom of BELOW_FLOOR) {
      // ⚠ THE RUNG, BY NAME, FROM THE AUTHORITY RATHER THAN FROM A COMMENT —
      // and read it as the SCOPE of the limit, NOT as a defence against it.
      // These two lines say only "below the floor the ladder is at `line`, and
      // `line` is the rung at which a card body may blank". They do NOT say
      // either control is hidden: `TierInvitationRow` is mounted outside that
      // wrapper, and `NodeChip`'s wrapper blanks only when a replacement line
      // exists. Both derivations are in this test's header, at BaseNode's bytes.
      expect(resolveLodRung(zoom), `zoom ${zoom} is not on the 'line' rung`).toBe('line')
      expect(lodBodyHiddenAt(resolveLodRung(zoom)), `'line' does not hide a body`).toBe(true)

      const rendered = renderedFloorPx(MIN_TARGET_RENDERED_PX, zoom)
      // The mechanism, not a magic number: the cap is what makes it fall away.
      expect(rendered).toBeCloseTo(MIN_TARGET_RENDERED_PX * MAX_LABEL_COUNTER_SCALE * zoom, 6)
      expect(
        rendered,
        `zoom ${zoom} renders the floor at ${rendered}px, which is NOT short — if the ` +
          `counter-scale cap or the floor has changed, re-derive this pin rather than ` +
          `widening it. A limit that quietly absorbs a new value is how this class ships.`,
      ).toBeLessThan(MIN_TARGET_RENDERED_PX)
    }
    // The other direction, so the pin cannot drift into covering the band it is
    // NOT about: AT the floor the rung is not `line` and the target is met.
    expect(resolveLodRung(LABEL_LEGIBLE_ZOOM)).not.toBe('line')
    expect(renderedFloorPx(MIN_TARGET_RENDERED_PX, LABEL_LEGIBLE_ZOOM)).toBe(MIN_TARGET_RENDERED_PX)
  })

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * ⚠ L2 — THE `var()` FALLBACK FAILS OPEN, SILENTLY. RECORDED, NOT FIXED.
   * ─────────────────────────────────────────────────────────────────────────
   * `CANVAS_LABEL_SCALE_VAR` is set only on the MAIN React Flow root
   * (`CanvasLabelScaleSync`, whose own header names the Compare-tab mini-maps as
   * the other instances on the page). Rendered anywhere the var is unset — which
   * includes every render in this very file — the fallback `1` applies and the
   * floor resolves to `MIN_TARGET_RENDERED_PX` DECLARED px, i.e. `24 x zoom`
   * rendered. Nothing errors and nothing looks wrong.
   *
   * ⚠ THE MITIGATING FACT, stated rather than used as an excuse:
   * `typography.edgeLabel` reads the SAME var with the SAME fallback, so in such
   * an instance the whole card is uniformly unscaled rather than this control
   * being singled out. A smaller surface, not a broken one.
   *
   * Pinned so that a change to the fallback is a DECISION rather than a typo.
   */
  it('L2: the fallback is 1, and that means the floor fails OPEN off the canvas root', () => {
    render(<NodeChip label={CHIP_LABEL} message="m" chipId="c" actionType={null} />)
    const chip = screen.getByRole('button', { name: CHIP_LABEL })
    for (const axis of AXES) {
      expect(parseFloor(chip.style[axis])!.fallback, `${axis} fallback is not 1`).toBe('1')
    }
    // What that fallback costs, asserted rather than described: with the var
    // unset the floor is bare px, and a bare floor is halved at the settle zoom.
    const unscaled = MIN_TARGET_RENDERED_PX * LABEL_LEGIBLE_ZOOM
    expect(
      unscaled,
      'a fallback of 1 would be harmless only if a bare floor still met the minimum',
    ).toBeLessThan(MIN_TARGET_RENDERED_PX)
  })
})
