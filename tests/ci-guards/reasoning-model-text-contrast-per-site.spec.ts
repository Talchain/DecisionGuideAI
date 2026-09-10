/**
 * ⭐⭐ PER-SITE text/icon contrast guard — REASONING AND MODEL SURFACES ONLY.
 *
 * ⚠⚠ READ THE SCOPE BEFORE THE ASSERTIONS. This guard covers THREE directories
 * (73 of the 1,686 scannable files under src/). It is NOT a product-wide contrast
 * guard and its name says so. A guard that silently covers less than its name
 * implies is worse than no guard, so the coverage fraction is itself ASSERTED
 * below and printed in the failure message — a reader cannot mistake this for a
 * complete sweep, and cannot widen the scope without the numbers moving.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 * `tests/ci-guards/text-light-contrast.spec.ts` asserts the `--text-light`
 * TOKEN's contrast, deriving BOTH the foreground and the ground from brand.css.
 * It is therefore structurally blind to a CALL SITE that moves OFF that token, or
 * paints it on a different ground. That is a guard agreeing with itself. It stayed
 * green while PR #1348's first head rendered an 11px span in `text-warning`
 * (`#FFA656`) at 1.92:1 on `--bg-panel` (`#FEFEFE`), against SC 1.4.3's 4.5:1.
 *
 * ⭐ AND THE BLINDNESS IS NOT HYPOTHETICAL — 13 of the 47 live violations this
 * guard measures involve tokens that PASS at the token level:
 *   · `text-text-light` inside `bg-success/20` -> 4.43:1, inside `bg-danger/20`
 *     -> 4.18:1. The very token `text-light-contrast` exists to protect, failing
 *     at two call sites while that guard asserts 5.23/5.04 and stays green.
 *   · `text-text-light/80` -> 3.40:1. An opacity modifier on a legal token.
 *   · `text-info` inside `bg-info/20` -> 3.56:1 at SIX sites, inside `bg-info/10`
 *     -> 4.05:1. `--info` is one of only three tokens that clear 4.5:1 bare.
 * A legal token and an illegal site are different claims. Nothing in the suite
 * could previously make the second one.
 *
 * ── ⛔ THE TINTED-PILL PREMISE IS REFUTED, MEASURED ──────────────────────────
 * The follow-up row for #1348 carried the premise that the same class "inside a
 * tinted pill sits on a different ground and may pass" — `ModelStrip`'s
 * `bg-warning/10` recipe. That premise is FALSE, and it inverts: a same-hue tint
 * moves the GROUND TOWARDS the text colour, so the ratio falls MONOTONICALLY with
 * alpha. Measured on this palette, over `--bg-panel`:
 *
 *     text-warning   bare 1.92 -> /5% 1.87 -> /10% 1.80 -> /20% 1.68 -> /30% 1.59
 *     text-info      bare 4.78 -> /5% 4.47 -> /10% 4.21 -> /20% 3.69 -> /30% 3.18
 *                                      ^ PASSES bare, FAILS at every tint
 *
 * So a tinted pill is an AGGRAVATION, never an exemption, and `text-info` is the
 * proof: the recipe turns a compliant colour into a non-compliant one. The pill
 * cases are consequently pinned as violations, not exempted, and the inversion is
 * asserted in the positive control so the premise cannot quietly return.
 *
 * ── ROLE AND SIZE ARE CLASSIFIED, NOT ASSUMED ───────────────────────────────
 *   · ICON  -> SC 1.4.11's 3:1 floor. Derived from the file's own `lucide-react`
 *     import list and the enclosing JSX tag, never from a class-name guess.
 *   · LARGE TEXT (>=24px, or >=18.66px bold) -> SC 1.4.3's own 3:1 floor. Derived
 *     from `src/styles/typography.ts` plus Tailwind's OWN default font scale
 *     (imported from `tailwindcss/defaultTheme.js`, so `text-sm` cannot drift
 *     from what the build emits) and the `text-[11px]` arbitrary form.
 *   · An unestablished role or size resolves to the STRICTER 4.5:1 floor. "I
 *     could not tell" must never read as "it is fine".
 *
 * ⚠ AND THE HONEST LIMIT OF THAT MACHINERY, STATED AND PINNED: at the CURRENT
 * palette it never changes a verdict, because NO token in brand.css lands in the
 * 3:1..4.5:1 band on a panel ground — every token either clears 4.5 or fails 3.
 * The band is asserted EMPTY below. That assertion is the point: the day a token
 * lands in it, role and size become load-bearing, and this file REDs to say so
 * rather than silently starting to depend on a classifier nobody re-checked.
 *
 * ── WHY THIS SCOPE ──────────────────────────────────────────────────────────
 * 968 bare failing-token text sites exist across 275 files product-wide. That is
 * not one reviewable change. The tranche is the REASONING and MODEL surfaces,
 * which is CLAUDE.md's standing scope ruling for this programme ("Reasoning tab
 * and Model tab ONLY"), and is where #1348's defect shipped. `analysisNew/` is a
 * legacy directory name — the surface it renders IS Reasoning.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  REPO_ROOT,
  PANEL_GROUNDS,
  FILL_TEXT_KEYS,
  LITERAL_TOKEN,
  colourKeyTokens,
  filesInScope,
  keyCounts,
  scanSites,
  sizeOf,
  tokenHex,
  typographyTokens,
  type Site,
} from '../helpers/semanticTextContrastScan'
import {
  WCAG_TEXT_MIN,
  WCAG_NON_TEXT_MIN,
  compositeOver,
  contrast,
  isLargeText,
} from '../helpers/wcagContrast'

/**
 * THE SCOPE. Explicit, and the only thing that widens this guard.
 *
 * Adding a directory here is the intended way to extend coverage; the pinned set
 * below will then RED with the new directory's sites named, which is the review
 * conversation you want rather than a silent baseline bump.
 */
const SCOPE = [
  // Reasoning tab. Legacy directory name; the surface is Reasoning.
  'src/components/results/analysisNew',
  // Model tab — the v2 surface, where #1348's defect shipped.
  'src/canvas/model-tab-v2',
  // Model tab — the v1 surface still mounted beside it.
  'src/canvas/components/model-tab',
] as const

/**
 * ⛔ EVERY SITE BELOW IS A LIVE SC 1.4.3 / SC 1.4.11 FAILURE. NOTHING HERE IS
 * PERMITTED.
 *
 * The row that commissioned this guard called this the "KNOWN-EXEMPT set". It is
 * named UNREPAIRED instead, deliberately: "exempt" says a reviewer decided these
 * are acceptable, and no reviewer did. They are unrepaired because the palette has
 * no legal answer yet — of the 21 `--*-rgb` tokens brand.css declares, exactly
 * three clear 4.5:1 on both panel grounds (`--text-header` 15.01/14.46,
 * `--text-light` 5.23/5.04, `--info` 4.78/4.60) and NOT ONE semantic colour
 * clears even 3:1, so "swap it for a darker amber" has no answer inside the
 * palette. Repairing these is a design change with its own review.
 *
 * ⭐ THIS IS A PINNED SET, NOT AN ALLOWLIST, AND THE DIFFERENCE IS THE WHOLE
 * POINT. It is asserted EXACTLY EQUAL to what the scan measures, so it REDs when
 * it GROWS (a new violation ships) AND when it SHRINKS (one is repaired and the
 * pin not updated). A silent allowlist only fails in one direction, which is how
 * a baseline becomes permanent — the hand-maintained mirror this estate keeps
 * paying for. Measured ratio is NOT stored here: it is derived every run, so
 * retinting a token cannot leave a stale number behind.
 *
 * The KEY is `<file> <utility> <role>` with an occurrence COUNT — never a line
 * number, which shifts under any edit above it and would redden CI on unrelated
 * changes. A guard that cries wolf gets relaxed.
 */
const KNOWN_UNREPAIRED: Record<string, number> = {
  'src/canvas/components/model-tab/ContestedEdgeCard.tsx text-success text': 2,
  'src/canvas/components/model-tab/ContestedEdgeCard.tsx text-warning text': 2,
  'src/canvas/components/model-tab/FactorsSection.tsx text-success text': 2,
  'src/canvas/components/model-tab/GoalSection.tsx text-danger icon': 1,
  'src/canvas/components/model-tab/GoalSection.tsx text-danger text': 1,
  'src/canvas/components/model-tab/ModelHealthSection.tsx text-danger icon': 1,
  'src/canvas/components/model-tab/ModelHealthSection.tsx text-danger text': 1,
  'src/canvas/components/model-tab/ModelTabHeader.tsx text-warning text': 1,
  'src/canvas/components/model-tab/OptionsSection.tsx text-danger text': 1,
  'src/canvas/components/model-tab/OptionsSection.tsx text-success text': 1,
  'src/canvas/components/model-tab/OptionsSection.tsx text-warning text': 1,
  'src/canvas/components/model-tab/ReanalyseBar.tsx text-text-light/80 text': 1,
  'src/canvas/components/model-tab/RelationshipsSection.tsx text-danger text': 1,
  'src/canvas/components/model-tab/RelationshipsSection.tsx text-success text': 1,
  'src/canvas/components/model-tab/RelationshipsSection.tsx text-text-light text': 2,
  'src/canvas/components/model-tab/utils.ts text-danger text': 1,
  'src/canvas/components/model-tab/utils.ts text-success text': 1,
  'src/canvas/model-tab-v2/ModelDetailRegion.tsx text-danger text': 1,
  'src/canvas/model-tab-v2/ModelRowView.tsx text-danger text': 1,
  'src/canvas/model-tab-v2/ModelRowView.tsx text-warning text': 1,
  'src/components/results/analysisNew/sections/AtAGlance.tsx text-info text': 1,
  'src/components/results/analysisNew/sections/AtAGlance.tsx text-success text': 1,
  'src/components/results/analysisNew/sections/AtAGlance.tsx text-warning icon': 2,
  'src/components/results/analysisNew/sections/AtAGlance.tsx text-warning text': 3,
  'src/components/results/analysisNew/sections/ModelHeldUp.tsx text-success icon': 1,
  'src/components/results/analysisNew/sections/ModelStrip.tsx text-info text': 4,
  'src/components/results/analysisNew/sections/ModelStrip.tsx text-warning text': 6,
  'src/components/results/analysisNew/sections/StrengthenTheReasoning.tsx text-info text': 2,
  'src/components/results/analysisNew/sections/WhatWeChecked.tsx text-danger text': 1,
  'src/components/results/analysisNew/sections/WhatWeChecked.tsx text-success text': 1,
  'src/components/results/analysisNew/sections/WhyNoAnalysisYet.tsx text-warning icon': 1,
}

/** Every scannable source file under src/, for the coverage-honesty assertion. */
function allScannableFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) {
        if (entry === '__tests__' || entry === '__mocks__') continue
        walk(p)
      } else if (/\.(tsx|ts)$/.test(p) && !/\.(spec|test)\.tsx?$/.test(p)) out.push(p)
    }
  }
  walk(join(REPO_ROOT, 'src'))
  return out.map((p) => relative(REPO_ROOT, p))
}

const describeSite = (s: Site): string =>
  `  ${s.file}:${s.line}  ${s.utility} (${s.fg}) on ${s.ground} = ${s.ratio.toFixed(2)}:1 — ` +
  `${s.role}, ${s.px ?? '?'}px/${s.weight ?? '?'}, needs ${s.floor}:1 under ${s.criterion}`

describe('Reasoning + Model surfaces: per-site text and icon contrast', () => {
  let sites: Site[]
  let violations: Site[]

  beforeAll(() => {
    sites = scanSites(SCOPE)
    violations = sites.filter((s) => !s.ok)
  }, 60_000)

  it('⭐ the instrument can SEE a failure, a pass, and the DIFFERENCE (positive control)', () => {
    // Without this block every assertion below could be passing because the
    // implementation is broken rather than because the code is compliant.

    // 1. SPEC ANCHORS. Three contrast ratios with known published answers, so a
    //    broken transfer function cannot agree with itself.
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 4)
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 4)
    expect(contrast('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2)

    // 2. THE KNOWN-BAD value — the colour #1348's first head shipped — must FAIL
    //    on both real grounds, to the second decimal.
    expect(contrast('#FFA656', tokenHex('--bg-panel')!)).toBeCloseTo(1.92, 2)
    expect(contrast('#FFA656', tokenHex('--bg-panel-hover')!)).toBeCloseTo(1.85, 2)

    // 3. A KNOWN-GOOD pairing must PASS, or the function returns something small
    //    for everything.
    expect(contrast(tokenHex('--text-light')!, tokenHex('--bg-panel')!)).toBeCloseTo(5.23, 2)
    expect(contrast(tokenHex('--text-header')!, tokenHex('--bg-panel')!)).toBeCloseTo(15.01, 2)

    // 4. The brand.css parser is really reading the file, not defaulting.
    expect(tokenHex('--token-that-does-not-exist')).toBeNull()

    // 5. ⛔ THE TINT INVERSION. A same-hue tint must make contrast WORSE, and the
    //    `text-info` case must cross the floor — passing bare, failing tinted.
    //    This is the measurement that refutes "a tinted pill may pass"; if it
    //    ever holds the other way, the premise is back and the pinned pill
    //    entries below would be wrong.
    const panel = tokenHex('--bg-panel')!
    const info = tokenHex('--info')!
    expect(contrast(info, panel)).toBeGreaterThanOrEqual(WCAG_TEXT_MIN)
    expect(contrast(info, compositeOver(info, panel, 0.2))).toBeCloseTo(3.69, 2)
    expect(
      contrast(info, compositeOver(info, panel, 0.2)),
      'a bg-info/20 tint must push text-info BELOW the floor — if not, the ' +
        'tinted-pill exemption premise is live again and this guard is wrong',
    ).toBeLessThan(WCAG_TEXT_MIN)
    // Monotonic in alpha, so no tint step can be the rescuing one.
    const ratios = [0, 0.05, 0.1, 0.2, 0.3].map((a) =>
      contrast(info, compositeOver(info, panel, a)),
    )
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]).toBeLessThan(ratios[i - 1])

    // 6. THE SIZE DERIVATION reads the REAL scale. `panelMeta` is `text-[11px]`,
    //    which no named Tailwind size covers — a hand-written map would have
    //    guessed 12. And the named scale comes from Tailwind's own theme.
    expect(typographyTokens().get('panelMeta')).toContain('text-[11px]')
    expect(sizeOf('${typography.panelMeta} text-warning').px).toBe(11)
    expect(sizeOf('text-sm font-bold').px).toBe(14)
    expect(sizeOf('text-sm font-bold').weight).toBe(700)
    expect(sizeOf('text-3xl').px).toBe(30)
    expect(sizeOf('text-warning').px).toBeNull()
    // An unknown size must NOT qualify for the large-text exemption.
    expect(isLargeText(null, null)).toBe(false)
    expect(isLargeText(14, 700)).toBe(false)
    expect(isLargeText(24, null)).toBe(true)
    expect(isLargeText(19, 700)).toBe(true)

    // 7. THE SCAN DISCRIMINATES. A guard that flagged every site would satisfy
    //    the pinned set by accident; a guard that flagged none would too. Both
    //    populations must be large.
    expect(sites.length, 'the scan must be finding sites at all').toBeGreaterThan(400)
    expect(
      sites.filter((s) => s.ok).length,
      'most sites must PASS — a guard that condemns everything is not measuring',
    ).toBeGreaterThan(400)
    expect(violations.length, 'and it must still be finding the failures').toBeGreaterThan(20)

    // 8. The scan sees BOTH roles and resolves grounds both ways, or a whole
    //    classification arm is dead code nothing exercises.
    expect(sites.some((s) => s.role === 'icon')).toBe(true)
    expect(sites.some((s) => s.role === 'text')).toBe(true)
    expect(sites.some((s) => s.ground.includes(' over '))).toBe(true)
    expect(sites.some((s) => PANEL_GROUNDS.includes(s.ground as never))).toBe(true)

    // 9. A class quoted ONLY in a comment must not be scanned. Three in-scope
    //    files document this very defect by quoting `text-warning` in prose
    //    (ValueProvenanceMark.tsx, ModelRowView.tsx, AtAGlance.tsx). Counting
    //    those would redden CI over text that ships nothing (footgun #385).
    // This is a DISCRIMINATING PAIR, not a single absence: the commented class
    // must be invisible to the scan AND the file's real class must still be seen.
    // Either half alone proves nothing — a stripper that ate the whole file would
    // satisfy the first, and one that stripped nothing would satisfy the second.
    const vpm = 'src/canvas/model-tab-v2/ValueProvenanceMark.tsx'
    const vpmSource = readFileSync(join(REPO_ROOT, vpm), 'utf8')
    expect(
      vpmSource,
      'precondition: this file must still quote text-warning in a design note',
    ).toContain('text-warning')
    expect(
      vpmSource,
      'precondition: and must still carry a REAL text-text-light class',
    ).toContain('text-text-light')
    expect(
      sites.filter((s) => s.file === vpm).map((s) => s.utility),
      'text-warning is named only in a design note here — it renders nothing and ' +
        'must not be scanned, while the real text-text-light class must be',
    ).toEqual(['text-text-light'])
  })

  it('⛔ the 3:1..4.5:1 band is PINNED, and no in-scope site reaches into it', () => {
    /**
     * ⚠⚠ THIS ASSERTION CAUGHT ITS OWN AUTHOR, AND THAT IS WHY IT IS SHAPED LIKE
     * THIS. It was first written as "no token lands in the 3:1..4.5:1 band", on
     * the strength of a sweep of the 21 `--*-rgb` tokens in brand.css — the
     * enumeration the commissioning row handed over. It RED immediately: FOUR
     * config colours resolve to LITERAL-HEX tokens that are not part of the
     * triple family at all (`--danger-hover` #D96A3A, `--danger-active` #C85A2A,
     * reached as `text-danger-600/-700/-hover/-active`) and they sit squarely in
     * the band at 3.30-4.20:1. A claim derived from a partial enumeration had
     * been generalised to the whole palette — exactly the defect the estate's
     * rule against literal-grep enumeration exists to prevent, committed while
     * reading a brief that named the subset.
     *
     * So the claim is now split into the two things that are separately true:
     *   (a) the band is NOT empty — it holds exactly the eight pairings below,
     *       pinned, REDing if that set grows OR shrinks; and
     *   (b) NO SITE IN SCOPE uses an in-band colour, which is the claim that
     *       actually matters: it means the icon / large-text classification
     *       cannot change a verdict here today, so the strict default for an
     *       unestablished role or size costs nothing and mis-flags nothing.
     *
     * (b) is the load-bearing one. The day a site in scope paints an in-band
     * colour, the classifier starts deciding real outcomes and wants a review
     * before it does — so that case REDs rather than silently depending on a
     * role detector nobody re-checked.
     */
    const { resolved, unresolved, literals } = colourKeyTokens()
    expect(
      unresolved,
      'a colour form this scanner cannot read must fail loud, never be skipped',
    ).toEqual([])
    expect(resolved.size).toBeGreaterThan(80)

    const inBand = new Map<string, string[]>()
    for (const [key, token] of resolved) {
      if (FILL_TEXT_KEYS.has(key)) continue
      const hex = token === LITERAL_TOKEN ? literals.get(key) : tokenHex(token)
      if (!hex) continue
      for (const ground of PANEL_GROUNDS) {
        const r = contrast(hex, tokenHex(ground)!)
        if (r >= WCAG_NON_TEXT_MIN && r < WCAG_TEXT_MIN) {
          const list = inBand.get(key) ?? []
          list.push(`${hex} on ${ground} = ${r.toFixed(2)}:1`)
          inBand.set(key, list)
        }
      }
    }

    // (a) The band, pinned by COLOUR KEY. Ratios are re-derived every run and
    //     deliberately not stored, so a retint cannot leave a stale number here.
    expect(
      [...inBand.keys()].sort(),
      `the set of colours sitting BETWEEN the 3:1 and 4.5:1 floors has changed:\n` +
        [...inBand].map(([k, v]) => `  text-${k}: ${v.join(', ')}`).join('\n') +
        `\n\nThese are the colours for which the icon (SC 1.4.11) and large-text ` +
        `floors differ from the normal-text floor — i.e. the only colours whose ` +
        `verdict the role/size classification can change. Update this list and ` +
        `re-read the assertion below in the same change.`,
    ).toEqual(['danger-600', 'danger-700', 'danger-active', 'danger-hover'])

    // (b) THE ONE THAT MATTERS. No site in scope paints an in-band colour.
    const reaching = sites.filter((s) => inBand.has(s.key))
    expect(
      reaching.map(describeSite),
      `a site in scope now paints a colour inside the 3:1..4.5:1 band:\n` +
        reaching.map(describeSite).join('\n') +
        `\n\n⚠ Until now the icon / large-text classification in ` +
        `tests/helpers/semanticTextContrastScan.ts could not change ANY verdict ` +
        `in this scope, so holding an unestablished role or size to the strict ` +
        `4.5:1 floor cost nothing. It now decides this site. Re-review the role ` +
        `detection (the file's lucide-react imports + the enclosing JSX tag) and ` +
        `the size derivation AGAINST THIS SITE before trusting the verdict — a ` +
        `data-object class list (as in WhatWeChecked.tsx, where the colour is ` +
        `stored on an object and applied to an <Icon> elsewhere) yields role ` +
        `"text", which is strict but not accurate. Then update this assertion ` +
        `deliberately.`,
    ).toEqual([])
  })

  it('⚠ the SCOPE is a named subset, and the coverage fraction is stated not implied', () => {
    const scoped = filesInScope(SCOPE)
    const all = allScannableFiles()
    // Non-zero, or the whole guard is measuring an empty set while reading green.
    expect(scoped.length, 'the scope must resolve to real files').toBeGreaterThan(60)
    expect(
      scoped.every((f) => SCOPE.some((d) => f.startsWith(d))),
      'every scanned file must sit inside a declared scope directory',
    ).toBe(true)
    // Every declared directory must contribute, or a renamed directory silently
    // drops out of coverage while the guard stays green.
    for (const dir of SCOPE) {
      expect(
        scoped.filter((f) => f.startsWith(dir)).length,
        `scope directory "${dir}" matched NO files — it has been renamed or ` +
          `removed, and this guard has silently stopped covering it`,
      ).toBeGreaterThan(0)
    }
    // THE HONESTY FIGURE. Asserted so it cannot drift unnoticed in either
    // direction: coverage must stay a documented minority of the tree until
    // someone deliberately widens SCOPE and re-states it here.
    const fraction = scoped.length / all.length
    expect(
      fraction,
      `this guard covers ${scoped.length} of ${all.length} scannable files ` +
        `(${(fraction * 100).toFixed(1)}%). ~968 bare failing-token text sites ` +
        `exist across ~275 files product-wide; the rest are UNMEASURED by this ` +
        `guard. If coverage has grown because SCOPE was widened, that is the ` +
        `intended path — update this bound and the pinned set together.`,
    ).toBeLessThan(0.2)
    expect(all.length).toBeGreaterThan(1000)
  })

  it('⭐⭐ no NEW failing site, and no repaired one left stale in the pin', () => {
    const measured = keyCounts(violations)
    const added = Object.keys(measured).filter((k) => measured[k] !== KNOWN_UNREPAIRED[k])
    const removed = Object.keys(KNOWN_UNREPAIRED).filter((k) => measured[k] !== KNOWN_UNREPAIRED[k])
    const changed = [...new Set([...added, ...removed])].sort()

    expect(
      measured,
      changed.length === 0
        ? ''
        : `the set of SC 1.4.3 / SC 1.4.11 failures on the Reasoning and Model ` +
          `surfaces has MOVED.\n\n` +
          changed
            .map((k) => {
              const was = KNOWN_UNREPAIRED[k] ?? 0
              const now = measured[k] ?? 0
              return `  ${now > was ? 'NEW     ' : 'REPAIRED'} ${k}  (pinned ${was}, measured ${now})`
            })
            .join('\n') +
          `\n\nEvery measured failure:\n` +
          violations.map(describeSite).join('\n') +
          `\n\n⛔ IF A COUNT WENT UP you have shipped text or an icon that a ` +
          `reader cannot see. Of the 21 --*-rgb tokens in brand.css, exactly ` +
          `three clear 4.5:1 on both panel grounds — --text-header, --text-light ` +
          `and --info — and NOT ONE semantic colour clears even 3:1, so there is ` +
          `no darker amber to reach for. Carry the meaning some other way: an ` +
          `icon with an accessible name, a word, a --text-light/--text-header ` +
          `pairing. ⚠ A TINTED PILL DOES NOT HELP — bg-<c>/NN moves the ground ` +
          `TOWARDS the text and makes every ratio WORSE (text-info goes 4.78 -> ` +
          `3.69 inside bg-info/20).\n\n` +
          `✅ IF A COUNT WENT DOWN, you repaired a site — thank you. Delete its ` +
          `line from KNOWN_UNREPAIRED in this file so the repair is banked and ` +
          `cannot silently regress. This set REDs in BOTH directions on purpose: ` +
          `that is what makes it a pin rather than an allowlist.`,
    ).toEqual(KNOWN_UNREPAIRED)
  })

  it('the pinned set is about REAL sites, and each one still measures below its floor', () => {
    // A pinned COUNT could in principle be satisfied by sites that now pass (if
    // the verdict logic inverted). Re-assert the substance: every pinned key maps
    // to at least one site whose measured ratio is genuinely under its floor.
    for (const key of Object.keys(KNOWN_UNREPAIRED)) {
      const [file] = key.split(' ')
      const matching = violations.filter((s) => `${s.file} ${s.utility} ${s.role}` === key)
      expect(matching.length, `pinned key has no measured site: ${key}`).toBeGreaterThan(0)
      for (const s of matching) {
        expect(s.ratio, `${describeSite(s)} — pinned as failing but measures as a pass`).toBeLessThan(
          s.floor,
        )
      }
      expect(statSync(join(REPO_ROOT, file)).isFile(), `${file} does not exist`).toBe(true)
    }
  })
})
