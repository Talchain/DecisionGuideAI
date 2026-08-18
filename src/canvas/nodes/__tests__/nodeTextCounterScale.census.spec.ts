/**
 * DERIVED CENSUS — every font size rendered INSIDE the React Flow viewport
 * transform must carry the canvas label counter-scale.
 *
 * WHY THIS EXISTS (browser-measured, Chromium, tip `dd089a50`, 3 shipped
 * starters x 2 laptop viewports, hermetic visual harness).
 * ---------------------------------------------------------------------------
 * `#758` and its geometry follow-up gave canvas label text a counter-scale
 * (`--canvas-label-scale`, see `utils/zoomLegibility.ts`) so a label renders at
 * its DECLARED size instead of `declared x zoom`. Measured at the zoom a
 * post-draft auto-fit actually parks at (0.5000, scale 2.00):
 *
 *   node title   declared 26px -> RENDERED 13.00px   (the counter-scale works)
 *   edge pill    declared 10px -> RENDERED  5.00px   (it does not)
 *
 * The counter-scale reaches text through the three canvas tokens in
 * `typography.ts` and ONLY through them. Five sites inside the node card had
 * been written as raw utilities or inline styles instead — `text-[10px]`,
 * `style={{ fontSize: 11 }}` — so they never saw it, and rendered at HALF
 * their declared size on the first view of every model. 17-21 such pills were
 * on screen per starter.
 *
 * That is the same defect Design System v5 Sec 2.4 already forbids in prose:
 * "No raw typography utilities... Always use semantic tokens from
 * typography.ts", and "Panel and canvas contexts use 10-12px for information
 * density, always via tokens, never raw classes." The DS rule and the
 * legibility rule are the same rule — a raw utility is precisely the thing the
 * counter-scale cannot reach. This census is that prose, executable.
 *
 * WHY A CENSUS AND NOT A LIST OF THE FIVE SITES. A hand-kept list of offenders
 * is the dominant defect class in this codebase (CLAUDE.md trap 12): it is
 * correct the day it is written and silently wrong afterwards. So the scope is
 * walked from disk, every font-size mechanism is RESOLVED (Tailwind utilities,
 * `typography.X` token references parsed out of `typography.ts` at run time,
 * inline `fontSize`), and anything the resolver does not understand is a hard
 * ERROR rather than a silent pass.
 *
 * ⚠ WHAT THIS CENSUS IS AND IS NOT. It proves that every declared size in
 * scope is routed through a counter-scaled token. It CANNOT prove a rendered
 * size — jsdom has no layout and this spec never renders anything (CLAUDE.md
 * trap 3). The rendered-pixel claim is browser-only and lives in
 * `e2e/visual/nodeTextLegibility.visual.spec.ts`. Neither supersedes the
 * other: this one stops a new raw utility being added, that one proves the
 * pixels. Ship both.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../../..')
const SCOPE = path.join(ROOT, 'src/canvas/nodes')
const TYPOGRAPHY = path.join(ROOT, 'src/styles/typography.ts')

/**
 * Rendered OUTSIDE the viewport transform, so the counter-scale must NOT apply
 * — `createPortal` to `document.body` escapes the transformed subtree, and a
 * counter-scaled token there would render at 2x. Excluded BY MECHANISM (the
 * file portals), not by preference; the assertion below re-derives that the
 * exclusion is still earned.
 */
const PORTALLED = ['NodePopover.tsx']

/**
 * Sizes inside the node card that are NOT yet counter-scaled, pinned EXACTLY.
 *
 * These are an honest, visible gap rather than an invisible one: each declares
 * a size that is not in the DS v5 Sec 2.3 canvas scale (13/11/10), so routing it
 * through a canvas token would silently RESIZE the element rather than merely
 * counter-scale it — a visual-design decision this lane is not entitled to
 * take on its own. They are recorded here so the suite is green for the right
 * reason, and REDs if the set GROWS (a new raw size arrived) or SHRINKS (one
 * was fixed and this pin went stale).
 *
 * Rendered size at the 0.50 auto-fit floor, for whoever picks these up:
 *   EvidenceGapBadge 7px  -> 3.5px  (also below the DS v5 Sec 2.4 10px floor at
 *                                    zoom 1, so it needs a size ruling, not a
 *                                    counter-scale)
 *   NodeCoachingMarker 12px (typography.caption) -> 6.0px
 *   BaseNode 18px (text-lg, the low-zoom LOD title boost) -> varies with zoom
 */
const KNOWN_FIXED = [
  'BaseNode.tsx:text-lg',
  'EvidenceGapBadge.tsx:inline-7',
  'shared/NodeCoachingMarker.tsx:typography.caption',
] as const

const TW_NAMED = new Set(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__' || entry === '__fixtures__') continue
      walk(p, out)
    } else if (/\.tsx?$/.test(entry) && !/\.spec\.|\.stories\./.test(entry)) {
      out.push(p)
    }
  }
  return out
}

/** Parse `typography.ts` for every token → its class string. Derived, never mirrored. */
function readTypographyTokens(): Map<string, string> {
  const src = readFileSync(TYPOGRAPHY, 'utf8')
  const body = src.slice(src.indexOf('export const typography'))
  const tokens = new Map<string, string>()
  for (const m of body.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):\s*'([^']*)'/gm)) tokens.set(m[1], m[2])
  return tokens
}

/** A token carries the counter-scale iff its class string reads the CSS variable. */
function isCounterScaled(classString: string): boolean {
  return classString.includes('var(--canvas-label-scale')
}

interface Hit { file: string; line: number; key: string; mechanism: string; counterScaled: boolean }

function census(): { hits: Hit[]; errors: string[]; files: number; tokens: number } {
  const tokens = readTypographyTokens()
  const errors: string[] = []
  const hits: Hit[] = []
  const files = walk(SCOPE)

  for (const file of files) {
    const rel = path.relative(SCOPE, file)
    if (PORTALLED.includes(path.basename(file))) continue
    const lines = readFileSync(file, 'utf8').split('\n')

    lines.forEach((text, i) => {
      const line = i + 1
      const push = (key: string, mechanism: string, counterScaled: boolean) =>
        hits.push({ file: rel, line, key: `${rel}:${key}`, mechanism, counterScaled })

      // 1. Arbitrary-value size: text-[10px] or text-[length:calc(...)]
      for (const m of text.matchAll(/text-\[(?:length:)?([^\]]+)\]/g)) {
        const value = m[1]
        if (/^calc\(\s*\d+(?:\.\d+)?px\s*\*\s*var\(--canvas-label-scale/.test(value)) {
          push(`counterscaled-${value.match(/(\d+)px/)?.[1]}`, 'arbitrary', true)
        } else if (/^\d+(?:\.\d+)?px$/.test(value)) {
          push(`text-[${value}]`, 'arbitrary', false)
        } else {
          errors.push(`${rel}:${line} unresolvable arbitrary text size: text-[${value}]`)
        }
      }

      // 2. Named Tailwind size utility
      for (const m of text.matchAll(/\btext-([a-z0-9]+)\b(?!-)/g)) {
        if (TW_NAMED.has(m[1])) push(`text-${m[1]}`, 'tailwind-named', false)
      }

      // 3. typography.X / typo('X') token reference
      for (const m of text.matchAll(/typography\.([a-zA-Z][a-zA-Z0-9]*)|typo\('([a-zA-Z][a-zA-Z0-9]*)'/g)) {
        const name = m[1] ?? m[2]
        const cls = tokens.get(name)
        if (cls === undefined) { errors.push(`${rel}:${line} unknown typography token: ${name}`); continue }
        if (!/text-/.test(cls)) continue // token declares no size
        push(`typography.${name}`, 'token', isCounterScaled(cls))
      }

      // 4. Inline style fontSize. The VALUE is captured first and classified
      // second — a negative lookahead here backtracks over `\s*` and reports a
      // literal as non-literal (caught while writing this census).
      for (const m of text.matchAll(/fontSize:\s*([^,}\n]+)/g)) {
        const raw = m[1].trim().replace(/['"]/g, '')
        const px = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(raw)
        if (px) push(`inline-${px[1]}`, 'inline', false)
        else errors.push(`${rel}:${line} non-literal inline fontSize: ${raw}`)
      }
    })
  }
  return { hits, errors, files: files.length, tokens: tokens.size }
}

describe('canvas node text — counter-scale census (DS v5 §2.3/§2.4)', () => {
  const { hits, errors, files, tokens } = census()

  it('resolves every font-size mechanism in scope, and SEES type at all', () => {
    expect(errors, errors.join('\n')).toEqual([])
    // Positive control (trap 13): an empty scan satisfies every absence
    // assertion below while measuring nothing.
    expect(files, 'census walked no files').toBeGreaterThan(10)
    expect(tokens, 'typography.ts parsed no tokens').toBeGreaterThan(20)
    expect(hits.length, 'census found no font sizes at all').toBeGreaterThan(10)
  })

  it('CONTRAST CONTROL: the census can tell counter-scaled from fixed', () => {
    // Absence claims need a positive AND a contrast control. If the resolver
    // silently classified everything one way, the pin below would pass for the
    // wrong reason.
    expect(hits.some(h => h.counterScaled), 'no counter-scaled hit seen — resolver blind').toBe(true)
    expect(hits.some(h => !h.counterScaled), 'no fixed hit seen — resolver blind').toBe(true)
  })

  it('the counter-scale reaches text ONLY through the three canvas tokens', () => {
    const scaled = new Set(hits.filter(h => h.counterScaled && h.mechanism === 'token')
      .map(h => h.key.split(':').pop()))
    expect([...scaled].sort()).toEqual(['typography.edgeLabel', 'typography.nodeLabel', 'typography.nodeTitle'])
  })

  it('every font size inside the node card is counter-scaled, except the pinned set', () => {
    const fixed = [...new Set(hits.filter(h => !h.counterScaled).map(h => h.key))].sort()
    // EXACT, both directions: RED if a raw size is added, RED if one of these
    // is fixed and this pin is not updated with it.
    expect(fixed).toEqual([...KNOWN_FIXED].sort())
  })

  it('the portal exclusion is still EARNED, not assumed', () => {
    for (const f of PORTALLED) {
      const src = readFileSync(path.join(SCOPE, 'shared', f), 'utf8')
      expect(src, `${f} no longer portals — it is inside the transform and must be censused`)
        .toMatch(/createPortal\(/)
    }
  })
})
