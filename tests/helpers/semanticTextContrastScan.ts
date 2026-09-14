/**
 * PER-SITE text/icon colour-contrast scanner.
 *
 * THE GAP THIS CLOSES. `tests/ci-guards/text-light-contrast.spec.ts` asserts the
 * `--text-light` TOKEN's contrast, deriving BOTH the foreground and the ground
 * from brand.css. It is therefore structurally blind to a CALL SITE that moves
 * OFF that token onto a different one — a guard agreeing with itself. It stayed
 * green while PR #1348's first head rendered an 11px span in `text-warning`
 * (`#FFA656`) at 1.92:1 on `--bg-panel` (`#FEFEFE`), against SC 1.4.3's 4.5:1.
 * Nothing in the suite could see it, because nothing in the suite asked what
 * colour a SITE renders.
 *
 * So this scans SITES. For each `text-<colour>` utility in the scanned scope it
 * derives, from the real config rather than from a hand-written map:
 *   · the FOREGROUND  — tailwind.config.js key -> `--token` -> brand.css hex
 *   · the GROUND      — any `bg-<colour>[/alpha]` in the same class-list literal,
 *                       composited over the panel ground; else the panel grounds
 *   · the ROLE        — icon (a lucide-react element) or text, which selects
 *                       SC 1.4.11's 3:1 floor or SC 1.4.3's 4.5:1
 *   · the SIZE        — from the typography token or a Tailwind size utility in
 *                       the same literal, which can lower SC 1.4.3 to 3:1
 *
 * ⚠ WHAT IT DOES NOT AND CANNOT DO. Static source cannot prove the rendered
 * ground of a site whose class list declares no background: the ground comes from
 * an ancestor. Every such site is measured against BOTH panel grounds, which is
 * the right default for this product (the Reasoning and Model surfaces are panel
 * surfaces) and is stated rather than hidden. A site painted on a dark or image
 * ground would be mis-measured; none exists in the scanned scope, and the scope
 * is deliberately narrow for exactly this reason. jsdom performs no layout and
 * this reads source, so neither makes any claim about rendered pixels.
 *
 * ⚠ UNKNOWNS RESOLVE STRICT, NEVER LENIENT. An unestablished size or role is held
 * to the 4.5:1 text floor, not exempted. The alternative — treating "I could not
 * tell" as "it is fine" — is how an absence assertion becomes vacuous.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve as resolvePath } from 'node:path'
import defaultTheme from 'tailwindcss/defaultTheme.js'
// @ts-expect-error TS7016 — the root Tailwind config ships no declaration file.
// The shape read here is pinned by the scanner's own positive control.
import tailwindConfig from '../../tailwind.config.js'
import { resolveTokenHex } from '../../src/styles/channelTriple.mjs'
import { stripComments } from './stripSourceComments'
import {
  WCAG_TEXT_MIN,
  WCAG_LARGE_TEXT_MIN,
  WCAG_NON_TEXT_MIN,
  compositeOver,
  contrast,
  isLargeText,
} from './wcagContrast'

export const REPO_ROOT = resolvePath(__dirname, '../..')
const BRAND_CSS = readFileSync(join(REPO_ROOT, 'src/styles/brand.css'), 'utf8')
const TYPOGRAPHY_TS = readFileSync(join(REPO_ROOT, 'src/styles/typography.ts'), 'utf8')

/**
 * The grounds a site with no declared background is measured against.
 *
 * Both are real surfaces on the scanned scope: `--bg-panel` is the panel/card
 * fill, `--bg-panel-hover` replaces it on hover, so text has to survive both.
 * A site is a violation if it fails on EITHER — a colour that is only legal
 * until the pointer arrives is not legal.
 */
export const PANEL_GROUNDS = ['--bg-panel', '--bg-panel-hover'] as const

/** Resolve a `--token` to its literal hex, or null. Never guesses. */
export function tokenHex(token: string): string | null {
  return resolveTokenHex(BRAND_CSS, token)
}

type ColourTree = Record<string, string | Record<string, string>>
const colourTree = (tailwindConfig as { theme: { extend: { colors: ColourTree } } }).theme.extend
  .colors

/**
 * Every colour key tailwind.config.js DECLARES, flattened the way Tailwind names
 * it in a utility (`warning`, `warning-light`, `text-light`, `danger-500`), mapped
 * to the `--token` its value references.
 *
 * Enumerated from the config object, never from a literal grep — the estate's
 * standing rule. A colour re-pointed at a different token is followed
 * automatically; a colour whose value is not a `var()` reference (e.g. a
 * `color-mix()` or a raw hex) is reported as UNRESOLVED rather than skipped, so
 * a form this scanner does not understand cannot read as a pass.
 */
export const LITERAL_TOKEN = '#literal'

/** Colour keys whose config value is a raw hex rather than a `var()` token. */
const literalHex = new Map<string, string>()

export function colourKeyTokens(): {
  resolved: Map<string, string>
  unresolved: string[]
  literals: Map<string, string>
} {
  const resolved = new Map<string, string>()
  const unresolved: string[] = []
  literalHex.clear()
  const add = (key: string, value: string): void => {
    const ref = value.match(/var\(\s*(--[a-z0-9-]+)/i)
    if (ref) {
      resolved.set(key, ref[1].replace(/-rgb$/, ''))
      return
    }
    // A RAW HEX in the config, not a token. `goal.hover` is declared `#E5B523`
    // — the one colour in this config that bypasses brand.css entirely. A
    // scanner that only understood `var()` would have reported it UNRESOLVED and
    // then skipped every `text-goal-hover` site, which is precisely the class of
    // site this guard exists to catch (the brief's "or hardcodes a colour").
    // Marked with the sentinel token `#literal` so a reader of a failure message
    // can see the colour came from the config rather than from a token.
    const literal = value.trim().match(/^#[0-9A-Fa-f]{3,8}$/)
    if (literal) {
      literalHex.set(key, literal[0].toUpperCase())
      resolved.set(key, LITERAL_TOKEN)
      return
    }
    unresolved.push(key)
  }
  for (const [k, v] of Object.entries(colourTree)) {
    if (typeof v === 'string') add(k, v)
    else for (const [shade, val] of Object.entries(v)) {
      if (typeof val === 'string') add(shade === 'DEFAULT' ? k : `${k}-${shade}`, val)
    }
  }
  return { resolved, unresolved, literals: new Map(literalHex) }
}

/**
 * Colour keys whose token is LIGHT TEXT FOR A COLOURED FILL, excluded from the
 * panel-ground sweep by ROLE rather than by ratio.
 *
 * `text-on-color` is declared `#FFFFFF` and its name states its contract: it is
 * painted on a colour, so `--bg-panel` is not its ground and measuring it there
 * would manufacture ~138 false violations product-wide. The same reasoning covers
 * the surface tokens (`panel`, `panel-hover`, `paper-50`, `canvas`) used as a text
 * colour on a dark fill. Their own contrast IS guarded — `text-light-contrast`
 * asserts `--text-on-color` against a `--text-light` fill — just not here.
 *
 * This is a ROLE classification with a stated reason, not an allowlist of sites:
 * it names four tokens, it is asserted non-empty and asserted to be exactly this
 * set below, and no site can join it by accident.
 */
export const FILL_TEXT_KEYS = new Set(['text-on-color', 'panel', 'panel-hover', 'paper-50', 'canvas'])

/** A `text-<key>` or `bg-<key>`, with an optional `/alpha` modifier. */
function utilityPattern(prefix: string, keys: string[]): RegExp {
  // Longest key first so `warning-light` wins over `warning`.
  const alt = [...keys].sort((a, b) => b.length - a.length).join('|')
  return new RegExp(`\\b${prefix}-(${alt})(?:\\/(\\[[^\\]]*\\]|\\d+))?\\b`, 'g')
}

/** `/30` -> 0.3, `/[0.06]` -> 0.06, absent -> 1. */
function alphaOf(mod: string | undefined): number {
  if (!mod) return 1
  const bracketed = mod.match(/^\[([\d.]+)\]$/)
  if (bracketed) return Number(bracketed[1])
  return Number(mod) / 100
}

/** Font sizes in px, DERIVED from Tailwind's own default theme plus arbitrary values. */
const FONT_SIZE_PX: Map<string, number> = new Map(
  Object.entries(defaultTheme.fontSize as Record<string, unknown>).map(([k, v]) => {
    const raw = Array.isArray(v) ? (v[0] as string) : (v as string)
    return [k, /rem$/.test(raw) ? parseFloat(raw) * 16 : parseFloat(raw)]
  }),
)
/** Font weights, DERIVED from Tailwind's own default theme. */
const FONT_WEIGHT: Map<string, number> = new Map(
  Object.entries(defaultTheme.fontWeight as Record<string, string>).map(([k, v]) => [k, Number(v)]),
)

/**
 * The class string each `typography.<token>` expands to, read out of
 * src/styles/typography.ts so the scanner sees the REAL scale. `panelMeta`
 * declares `text-[11px]`, which no named Tailwind size covers — a hand-written
 * size map would have missed it, or guessed 12.
 */
export function typographyTokens(): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of stripComments(TYPOGRAPHY_TS, 'typography.ts').matchAll(
    /^\s*([A-Za-z0-9_]+):\s*'([^']*)'/gm,
  )) {
    out.set(m[1], m[2])
  }
  return out
}
const TYPOGRAPHY = typographyTokens()

/** px and weight implied by a class list, following `typography.<token>` references. */
export function sizeOf(classList: string): { px: number | null; weight: number | null } {
  let text = classList
  for (const m of classList.matchAll(/typography\.([A-Za-z0-9_]+)/g)) {
    const expansion = TYPOGRAPHY.get(m[1])
    if (expansion) text += ' ' + expansion
  }
  let px: number | null = null
  const arbitrary = text.match(/\btext-\[(\d+(?:\.\d+)?)px\]/)
  if (arbitrary) px = Number(arbitrary[1])
  if (px == null) {
    for (const m of text.matchAll(/\btext-([a-z0-9]+)\b/g)) {
      const v = FONT_SIZE_PX.get(m[1])
      if (v != null) { px = v; break }
    }
  }
  let weight: number | null = null
  for (const m of text.matchAll(/\bfont-([a-z]+)\b/g)) {
    const v = FONT_WEIGHT.get(m[1])
    if (v != null) { weight = v; break }
  }
  return { px, weight }
}

/**
 * Spans of every string / template literal in a source file, so a matched
 * utility can be attributed to THE CLASS LIST IT SHARES — which is where any
 * sibling `bg-*` and any `typography.*` reference live.
 *
 * A template literal's whole span is used, interpolations included, so a ternary
 * that splits the colour from the background across `${…}` is still read as one
 * class list. That is deliberately INCLUSIVE: over-reading the context can only
 * discover a ground this scanner would otherwise have missed, never hide one.
 */
function literalSpans(src: string): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      const start = i
      let j = i + 1
      let depth = 0
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue }
        if (c === '`' && src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue }
        if (c === '`' && depth > 0 && src[j] === '}') { depth--; j++; continue }
        if (depth === 0 && src[j] === c) break
        if (c !== '`' && src[j] === '\n') break // an unterminated quote is not a literal
        j++
      }
      spans.push([start, Math.min(j + 1, src.length)])
      i = j + 1
      continue
    }
    i++
  }
  return spans
}

/** Names imported from lucide-react in a file — the icon ROLE signal, derived. */
function lucideNames(src: string): Set<string> {
  const out = new Set<string>()
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name) out.add(name)
    }
  }
  return out
}

/**
 * The JSX tag name whose attributes enclose `index`, or null.
 *
 * Walks back to the nearest unclosed `<Tag`. Used ONLY to decide the icon role;
 * a null answer resolves to TEXT (the stricter floor), never to an exemption.
 */
function enclosingTag(src: string, index: number): string | null {
  const open = src.lastIndexOf('<', index)
  if (open === -1) return null
  if (src.slice(open, index).includes('>')) return null // the tag already closed
  const m = src.slice(open).match(/^<\/?([A-Za-z][A-Za-z0-9_.]*)/)
  return m ? m[1] : null
}

export type Role = 'icon' | 'text'

export interface Site {
  /** Repo-relative path. */
  file: string
  /** 1-based line, for the failure message only — never part of the pinned key. */
  line: number
  /** The utility as written, e.g. `text-warning` or `text-warning/70`. */
  utility: string
  /** The tailwind colour key, e.g. `warning`. */
  key: string
  /** The `--token` the key resolves to. */
  token: string
  /** The foreground colour actually painted, alpha already composited. */
  fg: string
  /** The worst ground measured, and the ratio there. */
  ground: string
  ratio: number
  role: Role
  px: number | null
  weight: number | null
  /** The floor this site is held to, and why. */
  floor: number
  criterion: string
  ok: boolean
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue
      walk(p, out)
    } else if (/\.(tsx|ts)$/.test(p) && !/\.(spec|test)\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

/** Every scannable source file under `dirs` (repo-relative), sorted. */
export function filesInScope(dirs: readonly string[]): string[] {
  const out: string[] = []
  for (const d of dirs) {
    const abs = join(REPO_ROOT, d)
    if (!statSync(abs).isDirectory()) throw new Error(`scope directory missing: ${d}`)
    walk(abs, out)
  }
  return out.map((p) => relative(REPO_ROOT, p)).sort()
}

/**
 * Measure every colour-bearing text/icon site in `dirs`.
 *
 * Comments are stripped first: a class named in a design note renders nothing, and
 * three of the in-scope files document this very defect by quoting `text-warning`
 * in prose. Counting those would redden CI over text that ships nothing and would
 * punish authors for explaining the anti-pattern (footgun #385).
 */
export function scanSites(dirs: readonly string[]): Site[] {
  const { resolved, literals } = colourKeyTokens()
  const textKeys = [...resolved.keys()].filter((k) => !FILL_TEXT_KEYS.has(k))
  const TEXT_RE = utilityPattern('text', textKeys)
  const BG_RE = utilityPattern('bg', [...resolved.keys()])
  const sites: Site[] = []

  for (const rel of filesInScope(dirs)) {
    const raw = readFileSync(join(REPO_ROOT, rel), 'utf8')
    const code = stripComments(raw, rel)
    const spans = literalSpans(code)
    const icons = lucideNames(code)

    TEXT_RE.lastIndex = 0
    for (const m of code.matchAll(TEXT_RE)) {
      const at = m.index ?? 0
      const key = m[1]
      const token = resolved.get(key)
      if (!token) continue
      const baseFg = token === LITERAL_TOKEN ? (literals.get(key) ?? null) : tokenHex(token)
      // An unresolvable token is reported, never skipped — a colour this scanner
      // cannot read must not read as a pass.
      if (!baseFg) throw new Error(`${rel}: text-${key} -> ${token} does not resolve in brand.css`)

      const span = spans.find(([s, e]) => at >= s && at < e)
      const classList = span ? code.slice(span[0], span[1]) : m[0]

      // GROUND. A same-literal `bg-<colour>[/alpha]` composited over the panel.
      // Worst case across every candidate ground is what the site is judged on.
      const grounds: Array<[string, string]> = []
      BG_RE.lastIndex = 0
      for (const b of classList.matchAll(BG_RE)) {
        const bgToken = resolved.get(b[1])
        const bgHex = bgToken === LITERAL_TOKEN
          ? (literals.get(b[1]) ?? null)
          : bgToken ? tokenHex(bgToken) : null
        if (!bgHex) continue
        for (const base of PANEL_GROUNDS) {
          const baseHex = tokenHex(base)
          if (baseHex) grounds.push([`${b[0]} over ${base}`, compositeOver(bgHex, baseHex, alphaOf(b[2]))])
        }
      }
      if (grounds.length === 0) {
        for (const base of PANEL_GROUNDS) {
          const hex = tokenHex(base)
          if (hex) grounds.push([base, hex])
        }
      }

      const { px, weight } = sizeOf(classList)
      const tag = enclosingTag(code, at)
      const role: Role = tag != null && icons.has(tag) ? 'icon' : 'text'
      const floor = role === 'icon'
        ? WCAG_NON_TEXT_MIN
        : isLargeText(px, weight) ? WCAG_LARGE_TEXT_MIN : WCAG_TEXT_MIN
      const criterion = role === 'icon'
        ? 'SC 1.4.11 (non-text)'
        : isLargeText(px, weight) ? 'SC 1.4.3 (large text)' : 'SC 1.4.3 (normal text)'

      // An alpha-modified TEXT colour composites towards its own ground, so it
      // is measured per ground rather than once.
      let worst: { ground: string; ratio: number; fg: string } | null = null
      for (const [name, groundHex] of grounds) {
        const fg = compositeOver(baseFg, groundHex, alphaOf(m[2]))
        const ratio = contrast(fg, groundHex)
        if (!worst || ratio < worst.ratio) worst = { ground: name, ratio, fg }
      }
      /* c8 ignore next */
      if (!worst) throw new Error(`${rel}: no ground resolved for ${m[0]}`)

      sites.push({
        file: rel,
        line: code.slice(0, at).split('\n').length,
        utility: m[0],
        key,
        token,
        fg: worst.fg,
        ground: worst.ground,
        ratio: worst.ratio,
        role,
        px,
        weight,
        floor,
        criterion,
        ok: worst.ratio >= floor,
      })
    }
  }
  return sites
}

/**
 * A site's PINNING KEY: `<file> <utility> <role>`.
 *
 * Deliberately NOT `file:line`. A line number shifts whenever anything above it
 * is edited, so a line-keyed pin would redden CI on unrelated changes, and a
 * guard that cries wolf gets relaxed. File + utility + role is stable under
 * edits and still discriminates: retinting a site onto a different token, or
 * moving a class from a span to an icon, changes the key.
 */
export const siteKey = (s: Site): string => `${s.file} ${s.utility} ${s.role}`

/** Keys with their occurrence counts, so adding a second identical site also REDs. */
export function keyCounts(sites: Site[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sites) out[siteKey(s)] = (out[siteKey(s)] ?? 0) + 1
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)))
}
