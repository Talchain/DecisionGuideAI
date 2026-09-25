/**
 * ⭐⭐ THE REASONING PANEL'S RENDER DISCIPLINE — the two rules a screenshot
 * keeps catching and no gate does.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * Paul's approved panel prototype names five "discipline" regressions and its
 * own conclusion is that a guard is the durable fix, not another manual pass:
 * *"A type-scale guard and an action-tier guard would have caught four of the
 * five before they shipped."* Re-derived at this tip rather than inherited —
 * the prototype is dated and four of its own nine claims were wrong:
 *
 *   type scale   ALREADY CLEAN  exactly 3 tokens, 0 raw sizes  → RULE A pins it
 *   containment  ALREADY GUARDED by `complete-borders.spec.ts` → not repeated
 *   action tiers ⛔ LIVE         31 visual signatures / 48 controls → RULE B
 *   colour       ⛔ LIVE         amber carries 6 meanings → needs a design
 *                               ruling, deliberately NOT encoded here
 *   question-first  MISCLASSIFIED — content authoring, not discipline
 *
 * ── RULE A — THE RENDER-SCOPE TYPE SWEEP, WHICH IS THE DEBT ITS SIBLING NAMES
 * `panel-scale-has-exactly-three-sizes.spec.ts` enforces a NAME rule (every
 * `panel*`-prefixed TOKEN resolves to 11/12/14) and says in terms what it does
 * not reach: *"any panel-rendered size reached through a token that is not
 * `panel*`-prefixed, or through a literal class. Closing it needs a
 * render-scope sweep, which is a different guard from this one."*
 *
 * This is that sweep, scoped to the Reasoning tab. It reads what the components
 * RENDER rather than what the token table declares, so a fourth size arriving
 * as `text-[13px]` in a `className` — invisible to the name rule — REDs here.
 *
 * ⚠ THE FILE SET IS DERIVED FROM THE DIRECTORY, NEVER HAND-LISTED (CLAUDE.md
 * trap 12). A hand-maintained scan list silently stops covering the file
 * somebody adds tomorrow, and the drift always reads as green.
 *
 * ── RULE B — AFFORDANCE MAY NOT BE CARRIED BY COLOUR ALONE ─────────────────
 * ⛔ THIS IS A LIVE DEFECT AND IT IS AN ACCESSIBILITY ONE, not a preference.
 * WCAG SC 1.4.1 (Use of Color): colour must not be the ONLY visual means of
 * conveying an affordance. MEASURED in this tree: 8 `text-info` controls carry
 * a persistent `underline`, 8 carry `hover:underline` only — the same tier in
 * two treatments, split down the middle, so neither is the exception. On a
 * touch device `hover` never fires, so for those readers half the panel's links
 * are coloured text and nothing more. Paul's screenshot reads it exactly that
 * way: *"two of three card actions don't look clickable."*
 *
 * ⚠⚠ AND THE OBVIOUS REMEDY IS BANNED HERE, WHICH IS WHY THE RULE IS AN
 * UNDERLINE AND NOT A TINT. `ArgueTheOpposite.tsx` documents it at the bytes:
 * on this panel's ground `bg-info/10` drops `text-info` to 4.05:1 and
 * `bg-info/20` to 3.56:1, both failing SC 1.4.3, and the ratio falls
 * monotonically in alpha so a smaller tint cannot rescue it. Two tinted
 * controls are already pinned as KNOWN_UNREPAIRED at 3.56:1 in
 * `reasoning-model-text-contrast-per-site.spec.ts`. An underline costs NO
 * contrast at all, so it is the one remedy that satisfies 1.4.1 without
 * breaching 1.4.3.
 *
 * ⚠ SHAPE IS A LEGITIMATE AFFORDANCE AND IS EXEMPT — that is the prototype's
 * own rule ("one primary button, then icon buttons"): a control that carries
 * padding, a border, a background, a rounded pill or an icon is not relying on
 * colour alone. The rule targets BARE INLINE controls only, which is the class
 * that actually fails 1.4.1.
 *
 * ── ⚠⚠ THE SCOPE OF THIS RULE, STATED SO IT IS NEVER READ AS THE HEADING ───
 * The heading says "affordance is never carried by colour alone". **What is
 * actually enforced is narrower: no `text-info` control relies on colour
 * alone.** Those are different claims and the gap is reachable — naming the
 * artefact searched rather than the generalisation (CLAUDE.md trap 20).
 *
 * ⭐ WHY IT IS SCOPED TO ONE TOKEN, AND WHY WIDENING IT WAS TRIED AND REJECTED.
 * `text-info` is THIS PANEL'S LINK COLOUR, so a `text-info` control with no
 * rest-state shape is unambiguously leaning on the link convention. Widening
 * the scan to every text colour was MEASURED: it returns six interactive
 * controls, and it cannot discriminate them.
 *   · Two carry no colour at all — the scan was matching `text-left`, an
 *     ALIGNMENT utility, as though it were a hue.
 *   · Two are whole-row disclosure buttons whose affordance is a CHEVRON CHILD.
 *     A className scan reads the control's own attributes and cannot see an
 *     icon inside it, so it calls them bare when they are not.
 * A rule that fires on four cases of which it can justify none is worse than a
 * narrow rule that is right: it trains the next reader to wave the guard
 * through.
 *
 * ⚠ SO THE RESIDUE IS REAL AND IS RECORDED, NOT CLOSED. Controls in other hues
 * (`text-text-light` at `DeeperAnalysis:90`, `StrengthenTheReasoning:1239` and
 * `:1351`; `text-text-body` at `AtAGlance:1205`) are NOT covered here. Closing
 * that needs a scan that can see child elements — a rendered-DOM check rather
 * than a source scan, which is a different guard from this one.
 *
 * CONTROLS (every CI pass, never once by hand — CLAUDE.md trap 13):
 *   · POSITIVE  a synthetic bare `text-info` control and a synthetic
 *               `text-[13px]` MUST both be flagged, proving the scanner sees.
 *   · NEGATIVE  an underlined link, a padded/iconned button, and a
 *               `typography.panelMeta` reference must NOT be flagged, proving
 *               the scanner discriminates rather than banning a substring.
 *   · COMMENT   a violation existing ONLY inside a comment must NOT be flagged
 *               (this repo's dominant guard footgun, #385/#386 — and one I hit
 *               myself on the visual-suite flag-posture guard this week).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve as resolvePath, join as joinPath, relative as relativePath } from 'node:path'
import { stripComments } from '../helpers/stripSourceComments'
import { typography } from '../../src/styles/typography'
import { resolveSizePx } from '../../scripts/lib/type-scale.mjs'

const ROOT = resolvePath(__dirname, '../../src')
const PANEL_DIR = resolvePath(ROOT, 'components/results/analysisNew')

/**
 * The three sizes DS v5 §2.2 declares for the panel context.
 *
 * ⛔ `reasoningLead` (18px) IS RETIRED (design-audit-20260925, gap TYPE-1).
 * Paul's 18 Sep ruling — "lead with the decision label and goal … there
 * shouldn't be a conclusion" — removed the fourth-size case this token
 * existed to permit: the decision line is now `panelHeader` (14px), the
 * largest thing the panel renders. The token and its docblock are deleted
 * from `typography.ts` rather than demoted, so nothing keeps re-deriving the
 * old size from a name still on the page.
 *
 * `panelQuestion` (added the same PR, gap TYPE-2) does NOT reopen a fourth
 * size — it shares `panelHeader`'s 14px and differs only in weight, which is
 * exactly why `derivedSizesPx()` below still resolves to three values. See
 * `theLargestTypeIsTheDecision.spec.tsx` for the render-side invariant this
 * retirement answers: no panel text resolves above 14px, and the -lead
 * element is the first text in the panel body.
 */
const DECLARED_TOKENS = ['panelHeader', 'panelBody', 'panelMeta', 'panelTabular', 'panelQuestion'] as const

/**
 * The sizes those tokens resolve to — `panelTabular` shares `panelBody`'s.
 *
 * ⚠⚠ THIS LITERAL IS THE DECLARATION. IT IS NOT THE CHECK. The check is
 * `derivedSizesPx()` below, which resolves every `DECLARED_TOKENS` entry
 * through `typography` with the repo's own resolver. Comparing this array to
 * itself — which is what the first version of the test below did — is a
 * tautology wearing a rule's name.
 */
const DECLARED_SIZES_PX = [14, 12, 11] as const

/**
 * ⭐ THE SIZES THE PANEL ACTUALLY RENDERS, DERIVED FROM THE TOKENS THEMSELVES.
 *
 * `resolveSizePx` is the same resolver `panel-scale-has-exactly-three-sizes`
 * and the conversation census use, so a token whose class string this repo
 * cannot parse fails LOUDLY here rather than being silently dropped from the
 * count — an unresolvable token would otherwise shrink the derived set and
 * make the assertion pass by measuring less.
 */
function derivedSizesPx(): number[] {
  const px = DECLARED_TOKENS.map((t) => {
    // `resolveSizePx` returns `{ px, outcome, errors }`; the second argument is
    // the LABEL used in its error messages, not a context to match on.
    const r = resolveSizePx((typography as Record<string, string>)[t], `typography.${t}`)
    if (r.outcome !== 'resolved' || typeof r.px !== 'number') {
      throw new Error(`typography.${t} -> ${r.outcome}: unresolvable, so the derivation cannot be trusted`)
    }
    return r.px
  })
  return [...new Set(px)].sort((a, b) => b - a)
}

/**
 * Every rendering file under the Reasoning tab, DERIVED. Specs are excluded:
 * a fixture may legitimately spell a raw size to prove a guard bites.
 */
function panelFiles(dir: string = PANEL_DIR): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = joinPath(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__') continue
      out.push(...panelFiles(p))
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      /* ⛔⛔ `.ts` TOO — AND ITS ABSENCE WAS A COLLECTION GAP IN THE GUARD ABOUT
         TOKENS. This collected only `.tsx`, so `panelSurfaces.ts` — the module
         that DEFINES every action tier and surface tone on this panel — was
         invisible to the render-discipline rules. The most token-dense file on
         the surface, unscanned by the token guard.

         ⭐ MEASURED BEFORE WIDENING, not after: `.ts` files carry ZERO raw
         font-size classes and one `typography.*` reference
         (`analysisNewCopy.ts` → `panelHeader`, a declared token), so this
         widening is green on arrival and pins a correct state rather than
         importing a backlog.

         ⚠ THIS IS THE THIRD COLLECTION GAP IN ONE NIGHT, and they are the
         class that keeps getting through: the contrast register blind to
         `border-*`/`ring-*`; the query ban catching one plural alias of three;
         and now this. Every one was in what a rule was ALLOWED TO SEE rather
         than in what it asserted — and assertions are the part that gets
         reviewed. Audit the collection before tuning the assertion. */
      out.push(p)
    }
  }
  return out.sort()
}

const read = (p: string) => stripComments(readFileSync(p, 'utf8'), p)
const rel = (p: string) => relativePath(ROOT, p)

/** A raw Tailwind font-size class — the thing the NAME rule cannot see. */
const RAW_SIZE = /\btext-(?:xs|sm|base|lg|xl|[2-9]xl|\[[0-9.]+(?:px|rem|em)\]|\[length:[^\]]*\])/g

/**
 * A control that leans on `text-info` for its affordance. Exempt when it also
 * carries a non-colour signal: an underline, a border, a background, a pill,
 * or padding.
 *
 * ⛔⛔ THE SIGNAL MUST EXIST AT REST, AND THE FIRST VERSION OF THIS RULE DID NOT
 * SAY SO — which made it blind to the exact class it was written for.
 * `\bunderline` matches INSIDE `hover:underline` (the word boundary sits after
 * the colon), so every hover-only link exempted itself. The guard flagged ONE
 * site against EIGHT measured, and only that disagreement gave it away —
 * reading it could not (CLAUDE.md trap 13b: a guard whose exemption is
 * satisfied by the defect).
 *
 * ⭐ A HOVER-ONLY SIGNAL IS NOT A REST-STATE AFFORDANCE — that is the whole
 * finding, so state-prefixed utilities are stripped before the test rather than
 * patched around with a lookbehind.
 */
const restState = (cls: string): string =>
  cls
    .split(/\s+/)
    .filter((t) => !/^(?:hover|focus|focus-visible|active|group-hover|group-focus):/.test(t))
    .join(' ')

const SHAPE_SIGNALS = /\b(?:underline|border(?![-\s]*none)|bg-|rounded-full|px-|py-|p-[0-9])/

describe('Reasoning panel — RULE A: only the declared panel sizes are rendered', () => {
  /**
   * ⭐⭐ POSITIVE CONTROL ON THE COLLECTION ITSELF, not on the rule.
   *
   * A guard's green IS an absence claim about defects, so it inherits every
   * discipline an absence claim has — including a control proving the probe can
   * SEE. A short collection returns a confident green: no error, no anomaly,
   * indistinguishable from a clean run. That is why five collection gaps got
   * through this estate in one night while rule defects were caught.
   *
   * ⛔ THIS FILE HAD ONE. It collected only `.tsx`, so `panelSurfaces.ts` — the
   * module DEFINING every action tier and surface tone, and the file where both
   * of this lane's worst errors lived — was invisible to the token guard. The
   * guard could not see the place the defects were.
   *
   * So the widening is asserted by NAME rather than trusted: the `.ts` files
   * that must be in scope are checked for individually.
   */
  it('POSITIVE CONTROL: the collection actually reaches the .ts token modules', () => {
    const collected = panelFiles().map((f) => rel(f))
    expect(
      collected.some((f) => f.endsWith('panelSurfaces.ts')),
      'the module defining every tier and tone must be scanned — it was not, and that was the gap',
    ).toBe(true)
    expect(
      collected.some((f) => f.endsWith('.tsx')),
      'and .tsx must still be collected — a widening that swapped one for the other would read green',
    ).toBe(true)
    // ⚠ Both extensions present, so neither arm can be satisfied by the other.
    expect(new Set(collected.map((f) => f.slice(f.lastIndexOf('.')))).size).toBeGreaterThan(1)
  })

  it('PRECONDITION: the sweep actually reads files', () => {
    const files = panelFiles()
    expect(files.length, 'the panel directory must yield rendering files').toBeGreaterThan(10)
    const total = files.reduce((n, f) => n + read(f).length, 0)
    expect(total, 'the files must have content after comment-stripping').toBeGreaterThan(10_000)
  })

  it('renders NO raw font-size class anywhere in the tree', () => {
    const offenders: string[] = []
    for (const f of panelFiles()) {
      const src = read(f)
      for (const m of src.matchAll(RAW_SIZE)) {
        const line = src.slice(0, m.index).split('\n').length
        offenders.push(`${rel(f)}:${line}  ${m[0]}`)
      }
    }
    expect(
      offenders,
      `A raw font-size bypasses the panel's three-size scale AND is invisible to\n` +
        `panel-scale-has-exactly-three-sizes (which checks token NAMES, not renders).\n` +
        `Use typography.${DECLARED_TOKENS.join(' / typography.')} instead.\n` +
        offenders.join('\n'),
    ).toEqual([])
  })

  it('reaches its sizes ONLY through the declared panel tokens', () => {
    const used = new Set<string>()
    for (const f of panelFiles()) {
      for (const m of read(f).matchAll(/typography\.([A-Za-z]+)/g)) used.add(m[1]!)
    }
    expect(used.size, 'PRECONDITION: the tree must reference typography at all').toBeGreaterThan(0)
    expect(
      [...used].filter((t) => !DECLARED_TOKENS.includes(t as never)).sort(),
      'a non-panel token on a panel surface is the fourth size the sibling guard records as debt',
    ).toEqual([])
  })

  /**
   * ⛔ THE ALLOWLIST ABOVE CLAIMS "ONE GOVERNED EXCEPTION, AND IT STAYS ONE".
   * A claim in a docblock that no assertion can fail on is not a rule — it is
   * a comment that the next lane will read as permission. This is the
   * assertion, so growing the panel's scale costs a deliberate edit here with
   * a reason attached, rather than a quiet append.
   */
  it('⛔ the panel has THREE sizes — a fourth is a design decision, not an allowlist edit', () => {
    // ⛔ THIS TEST DID NOT ENFORCE ITS OWN TITLE, and an independent reviewer
    // (`github-c6`) found it in the PR that added it. `DECLARED_SIZES_PX` was
    // hand-written and never resolved from `typography`, so both assertions
    // compared a literal to itself and passed unconditionally. A fifth TOKEN
    // was caught by the NAME check below; a fifth SIZE reached by editing an
    // EXISTING token's px — `panelTabular` 12 -> 13 — was not: DECLARED_TOKENS
    // is unchanged, so nothing looked at the tokens at all and the guard stayed
    // green while the panel rendered five sizes.
    //
    // ⭐ The literal is now the DECLARATION and the derivation is the CHECK.
    // Proven against that exact mutation before this landed: `panelTabular`
    // 12 -> 13 REDs this test, and read GREEN on the version it replaces.
    expect(derivedSizesPx()).toEqual([...DECLARED_SIZES_PX])
    // ⚠ RE-DERIVED FOR gap TYPE-1/TYPE-2 (design-audit-20260925): the old
    // assertion here named the ONE governed exception BY STRING
    // (`reasoningLead`) because that token was both a new NAME and a new
    // SIZE. `panelQuestion` is a new name at an EXISTING size, so naming it
    // here would ban any future same-size, different-weight token by
    // construction — a stricter rule than the one the guard's title states.
    // The invariant that survives is about SIZE: every token beyond the base
    // four-token panel family must resolve to a size already in
    // `DECLARED_SIZES_PX`, never a new one.
    const baseTokens = ['panelHeader', 'panelBody', 'panelMeta', 'panelTabular'] as const
    const extra = DECLARED_TOKENS.filter((t) => !baseTokens.includes(t as never))
    expect(extra.length, 'PRECONDITION: there must be an extra token to check').toBeGreaterThan(0)
    for (const t of extra) {
      const r = resolveSizePx((typography as Record<string, string>)[t], `typography.${t}`)
      if (r.outcome !== 'resolved' || typeof r.px !== 'number') {
        throw new Error(`typography.${t} -> ${r.outcome}: unresolvable`)
      }
      expect(DECLARED_SIZES_PX, `typography.${t} must not introduce a fourth size`).toContain(r.px)
    }
  })
})

describe('Reasoning panel — RULE B: no text-info control relies on colour alone', () => {
  /**
   * ⭐ PINNED AS AN EXACT SET, NOT A CEILING. A count REDs only upward, so a
   * ceiling ratifies today's violations forever; an exact set REDs when the
   * list grows OR shrinks, which forces the next repair to update the record.
   */
  const KNOWN_COLOUR_ONLY: readonly string[] = []

  it('no bare text-info control relies on colour alone (WCAG SC 1.4.1)', () => {
    const offenders: string[] = []
    for (const f of panelFiles()) {
      const src = read(f)
      for (const m of src.matchAll(/className=(?:\{`|"|\{")([^`"]*text-info[^`"]*)/g)) {
        const cls = m[1]!
        if (SHAPE_SIGNALS.test(restState(cls))) continue
        /**
         * ⚠ A DECORATIVE ICON IS NOT A CONTROL, AND THE FIRST VERSION FLAGGED
         * ONE. `<Sparkles className="… text-info" aria-hidden="true" />` carries
         * no affordance to signal — it is hidden from the accessibility tree by
         * its own declaration, and an icon inside a control inherits that
         * control's affordance rather than owning one.
         *
         * Keyed on `aria-hidden` — the element's OWN statement about itself —
         * never on a tag-name list, which would be a hand-maintained mirror of
         * every icon component this panel imports (CLAUDE.md trap 12).
         */
        const tagStart = src.lastIndexOf('<', m.index)
        const tagEnd = src.indexOf('>', m.index)
        const tag = tagStart >= 0 && tagEnd > tagStart ? src.slice(tagStart, tagEnd) : ''
        if (/aria-hidden=(?:\{?["']?true)/.test(tag)) continue
        const line = src.slice(0, m.index).split('\n').length
        offenders.push(`${rel(f)}:${line}`)
      }
    }
    expect(
      offenders.sort(),
      `Colour is the only affordance signal on these controls. On touch there is\n` +
        `no hover, so they read as coloured text. Add a persistent \`underline\` —\n` +
        `NOT a tint: bg-info/10 drops this text to 4.05:1 and fails SC 1.4.3.\n` +
        offenders.join('\n'),
    ).toEqual(KNOWN_COLOUR_ONLY)
  })
})

/**
 * ⭐⭐ RULE C — THE TIER REGISTER IS INJECTIVE.
 *
 * Canvas's property, adopted verbatim because it is the right one: **two
 * meanings must not share a channel.** That is what makes a register a SYSTEM
 * rather than a list — without it, `primary` and `secondary` can drift into the
 * same pixels and the vocabulary silently collapses to four tiers, then three,
 * and the 30-spellings defect regrows from the inside.
 *
 * ⚠ THE TWO REGISTERS ARE NAMED APART, DELIBERATELY (CLAUDE.md trap 21), and
 * this note is the record so nobody later "reconciles" them:
 *   · THIS one answers *"what interaction affordance is this control, and how
 *     loud should it be?"* — a PRESENTATION question about things you press.
 *   · Canvas's answers *"what kind of claim is this visual making about the
 *     model?"* — an EPISTEMIC question about meaning a reader must not misread.
 *
 * Canvas's test for the boundary, which is sharper than mine: *"If getting it
 * wrong makes the UI ugly, it is Panel's. If getting it wrong makes the product
 * say something false, it is Canvas's."* `border-dashed` is Canvas's — it means
 * "outside your control" and shipped a false claim once. A button at the wrong
 * loudness is this file's.
 */
/**
 * The ACTION_TIER object literal ALONE.
 *
 * ⛔ THIS SLICE USED TO RUN TO THE END OF THE FILE, and that was a live defect
 * rather than a tidiness point: `panelSurfaces.ts` gained `ICON_SCALE` below
 * `ACTION_TIER`, whose entries have the same `name: 'classes'` shape, so the
 * rules below started reading ICON SIZES as ACTION TIERS and RED'd on
 * `section: 'w-4 h-4'` for carrying "no rest-state shape signal". It is not an
 * action tier and was never claimed to be.
 *
 * ⚠ The guard was reading more than the register it names. Bounding it at the
 * literal's closing `} as const` is what makes its scope match its sentence —
 * and stops the next const added to that file re-opening this.
 */
function actionTierBlock(src: string): string {
  const start = src.indexOf('export const ACTION_TIER')
  if (start < 0) return ''
  const end = src.indexOf('\n} as const', start)
  return end < 0 ? src.slice(start) : src.slice(start, end)
}

describe('Reasoning panel — RULE C: the action-tier register is injective', () => {
  it('no two tiers resolve to the same visual channel', () => {
    const src = readFileSync(resolvePath(PANEL_DIR, 'panelSurfaces.ts'), 'utf8')
    const block = actionTierBlock(src)
    const tiers = [...block.matchAll(/^\s{2}(\w+):\s*'([^']+)'/gm)].map((m) => [m[1]!, m[2]!] as const)

    expect(tiers.length, 'PRECONDITION: the register must be readable').toBeGreaterThanOrEqual(4)

    const seen = new Map<string, string>()
    const collisions: string[] = []
    for (const [name, cls] of tiers) {
      // Order-insensitive: two tiers spelling the same classes differently are
      // still the same channel.
      const key = [...new Set(cls.split(/\s+/).filter(Boolean))].sort().join(' ')
      const prior = seen.get(key)
      if (prior !== undefined) collisions.push(`${prior} and ${name} share a channel`)
      else seen.set(key, name)
    }
    expect(
      collisions,
      'Two tiers resolving to the same pixels is a vocabulary that has silently\n' +
        'collapsed. Either they are one tier and one name should go, or they are\n' +
        'two and one needs a channel of its own.',
    ).toEqual([])
  })

  /**
   * ⭐ THE DISCRIMINATOR. Injectivity passes trivially on a register of one, so
   * this pins that the vocabulary is actually plural and that the check is
   * reading real content rather than an empty match.
   */
  it('DISCRIMINATOR: the register is plural and every tier carries a shape signal', () => {
    const src = readFileSync(resolvePath(PANEL_DIR, 'panelSurfaces.ts'), 'utf8')
    const block = actionTierBlock(src)
    const tiers = [...block.matchAll(/^\s{2}(\w+):\s*'([^']+)'/gm)].map((m) => [m[1]!, m[2]!] as const)
    expect(tiers.length, 'a register of one tier is not a register').toBeGreaterThan(1)
    for (const [name, cls] of tiers) {
      expect(
        SHAPE_SIGNALS.test(restState(cls)),
        `tier "${name}" carries no rest-state shape signal — its affordance would be colour alone (SC 1.4.1)`,
      ).toBe(true)
    }
  })
})

describe('CONTROLS — the scanner can see, discriminates, and ignores comments', () => {
  const scanSizes = (src: string) => [...stripComments(src, 'x.tsx').matchAll(RAW_SIZE)].map((m) => m[0])
  const colourOnly = (cls: string) => !SHAPE_SIGNALS.test(restState(cls))

  it('POSITIVE: a raw size and a bare text-info control are both flagged', () => {
    expect(scanSizes('<p className="text-[13px]">x</p>')).toEqual(['text-[13px]'])
    expect(scanSizes('<p className="text-sm">x</p>')).toEqual(['text-sm'])
    expect(colourOnly('text-info'), 'a bare coloured control must be flagged').toBe(true)
  })

  it('NEGATIVE: tokens, underlines, pills, padding and icons are NOT flagged', () => {
    expect(scanSizes('<p className={typography.panelMeta}>x</p>')).toEqual([])
    expect(colourOnly('text-info underline'), 'an underline is a non-colour signal').toBe(false)
    expect(colourOnly('text-info bg-info/10 rounded-full'), 'a pill is a shape').toBe(false)
    expect(colourOnly('text-info px-2 py-0.5'), 'padding is a shape').toBe(false)
    expect(colourOnly('text-info border border-info/40'), 'a border is a shape').toBe(false)
  })

  /**
   * ⭐⭐ THE DISCRIMINATING PAIR, and it is the case the first version of this
   * guard failed. `underline` and `hover:underline` differ ONLY in the state
   * prefix, so a rule that cannot tell them apart is blind to the whole finding.
   * Both arms are required: the first proves the hole is closed, the second
   * proves closing it did not swallow the legitimate exemption.
   */
  it('DISCRIMINATOR: hover:underline is NOT a rest-state affordance, underline IS', () => {
    expect(colourOnly('text-info hover:underline'), 'hover does not fire on touch').toBe(true)
    expect(colourOnly('text-info underline'), 'a persistent underline is the remedy').toBe(false)
    expect(
      colourOnly('text-info hover:bg-info/20'),
      'a hover-only background is equally absent at rest',
    ).toBe(true)
    expect(
      colourOnly('text-info px-2 py-1 hover:underline'),
      'padding is a rest-state shape, so this one is legitimately exempt',
    ).toBe(false)
  })

  /**
   * ⚠ THE DECORATIVE-ICON EXEMPTION, pinned in both directions. Without the
   * first arm this guard REDs on `<Sparkles … aria-hidden="true" />`, which
   * signals nothing and cannot be "fixed"; without the second it would exempt
   * any control that happens to sit near an icon.
   */
  it('DISCRIMINATOR: an aria-hidden icon is exempt, a control is not', () => {
    const scan = (src: string) => {
      const out: string[] = []
      const stripped = stripComments(src, 'x.tsx')
      for (const m of stripped.matchAll(/className=(?:\{`|"|\{")([^`"]*text-info[^`"]*)/g)) {
        if (SHAPE_SIGNALS.test(restState(m[1]!))) continue
        const tagStart = stripped.lastIndexOf('<', m.index)
        const tagEnd = stripped.indexOf('>', m.index)
        const tag = tagStart >= 0 && tagEnd > tagStart ? stripped.slice(tagStart, tagEnd) : ''
        if (/aria-hidden=(?:\{?["']?true)/.test(tag)) continue
        out.push(m[1]!)
      }
      return out
    }
    expect(
      scan('<Sparkles className="w-3 text-info" aria-hidden="true" />'),
      'a decorative icon declares itself hidden and signals no affordance',
    ).toEqual([])
    expect(
      scan('<button className="text-info hover:underline">Inspect</button>'),
      'a real control must still be flagged',
    ).toHaveLength(1)
  })

  it('COMMENT: a violation living only in a comment is NOT flagged', () => {
    expect(scanSizes('// text-[13px] is banned\nconst a = 1')).toEqual([])
    expect(scanSizes('/* an example: text-sm */\nconst a = 1')).toEqual([])
  })
})
