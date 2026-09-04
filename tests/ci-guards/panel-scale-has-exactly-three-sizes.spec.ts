/**
 * EVERY `panel*` TYPOGRAPHY TOKEN RESOLVES TO ONE OF THREE SIZES. Pinned, not asserted.
 *
 * ⚠⚠ READ THE SCOPE BEFORE TRUSTING THE NAME — AND IT IS NARROWER THAN DS v5 §2.2.
 * DS v5 §2.2 is a rule about what panel COMPONENTS RENDER: "all side panel UI …
 * uses only three sizes". THIS GUARD ENFORCES A NAME RULE: every token whose KEY
 * matches /^panel[A-Z]/ resolves to one of {11,12,14}. Those are not the same
 * claim, and the gap is reachable.
 *
 * MEASURED COUNTER-EXAMPLE, not argued: add
 * `resultsCaption: 'text-[13px] font-sans leading-snug'` to `typography.ts` and
 * use it inside `src/components/results/` — a FOURTH panel size on a real panel
 * surface — and this file reports 4 passed, exit 0. The sibling DS ratchet does
 * not catch it either: `PANEL_TYPO` matches neither a `typography.<token>`
 * reference nor a bare `text-[13px]`.
 *
 * `typography.ts` already carries such tokens: `chatProse`, `bodySmall` and the
 * 24px `welcomeHeading` are panel-context and outside the derived set — one of
 * them a fourth size. So the residue is not hypothetical.
 *
 * WHAT IS ENFORCED TODAY: the `panel*` token family.
 * WHAT IS RECORDED DEBT: any panel-rendered size reached through a token that is
 * not `panel*`-prefixed, or through a literal class. Closing it needs a
 * render-scope sweep, which is a different guard from this one.
 *
 * ⚠ WHY. DS v5 §2.2 declares the panel context has ONLY THREE SIZES, and #1179
 * added a FOURTH TOKEN (`panelTabular`) while arguing the count was unchanged —
 * it is `panelBody`'s size and weight plus `tabular-nums`, so 12px either way.
 * That argument was correct **and nothing enforced it**. A reviewer flagged it:
 * *"'Four keys, still three sizes' is true but not mechanically pinned."*
 *
 * The next token added on the same reasoning gets the same free pass, and the
 * rule DS v5 states becomes a sentence the code merely happens to satisfy — the
 * hand-maintained mirror this estate keeps paying for. This is the guard.
 *
 * DERIVED, NOT MIRRORED, IN BOTH DIRECTIONS:
 *  - the TOKEN SET comes from `typography` itself by prefix, so a new `panel*`
 *    token is in scope the moment it is written — no list to keep in sync;
 *  - the SIZES come from `scripts/lib/type-scale.mjs`, the same resolver the
 *    conversation census and the Model-tab minimum-size guard use, so a token
 *    whose class string this repo cannot parse fails LOUDLY rather than being
 *    silently excluded from the count.
 *
 * It pins the exact SET, not just the count: swapping two tokens' sizes keeps
 * the count at three and would slip past a `length === 3` assertion.
 */
import { describe, it, expect } from 'vitest'
import { typography } from '../../src/styles/typography'
import { resolveSizePx } from '../../scripts/lib/type-scale.mjs'

/** The declared panel scale — every token whose name marks it as panel context. */
const PANEL_TOKENS = Object.keys(typography)
  .filter(k => /^panel[A-Z]/.test(k))
  .sort()

/** DS v5 §2.2. Header / body / meta. */
const DECLARED_SIZES = [11, 12, 14]

describe('the `panel*` typography tokens resolve to exactly 11 / 12 / 14', () => {
  it('the token set is DERIVED and non-empty (positive control)', () => {
    // Without this, a rename to a non-`panel*` prefix would empty the set and
    // THE RESOLVE-CHECK below would pass by measuring nothing (`[]` has no
    // unresolved members). Measured, because the first version of this comment
    // said "every assertion below" and that was wrong: with an empty set the
    // distinct-sizes test compares [] against [11,12,14] and the #1179 test
    // loses its token, so 3 of the 4 tests RED on their own. This control
    // protects ONE of them — claiming it protects all four credits it with
    // defending assertions that already defend themselves.
    expect(PANEL_TOKENS.length, 'no panel* tokens found — the derivation is blind').toBeGreaterThanOrEqual(3)
    // Named, so a silent narrowing of the prefix is caught by identity.
    expect(PANEL_TOKENS).toEqual(expect.arrayContaining(['panelBody', 'panelHeader', 'panelMeta']))
  })

  it('every panel token resolves to a size — an unparseable one fails loudly', () => {
    const unresolved = PANEL_TOKENS
      .map(k => ({ k, r: resolveSizePx((typography as Record<string, string>)[k], `typography.${k}`) }))
      .filter(x => x.r.outcome !== 'resolved')
      .map(x => `${x.k} -> ${x.r.outcome}`)
    // A token this repo cannot parse must not be silently dropped from the
    // distinct-size count — that would be the fail-open the resolver exists to
    // prevent, reproduced one level up.
    expect(unresolved).toEqual([])
  })

  it('the distinct sizes are EXACTLY 11 / 12 / 14', () => {
    const sizes = [...new Set(
      PANEL_TOKENS.map(k => resolveSizePx((typography as Record<string, string>)[k]).px as number),
    )].sort((a, b) => a - b)

    expect(
      sizes,
      '\nDS v5 §2.2 declares the panel context has ONLY THREE SIZES (11 / 12 / 14).\n' +
        'A new token is fine — a new SIZE is a change to the design system and needs\n' +
        'the DS document changed in the same PR, not a comment arguing the count held.\n' +
        `Panel tokens seen: ${PANEL_TOKENS.join(', ')}\n`,
    ).toEqual(DECLARED_SIZES)
  })

  it('a token added on the "same size, different variant" argument still counts (the #1179 case)', () => {
    // The precise thing that motivated this guard: `panelTabular` is a fourth
    // KEY at an existing SIZE. It must be in scope and must not move the set.
    expect(PANEL_TOKENS, 'panelTabular left the derived set').toContain('panelTabular')
    expect(resolveSizePx(typography.panelTabular).px).toBe(resolveSizePx(typography.panelBody).px)
  })
})
