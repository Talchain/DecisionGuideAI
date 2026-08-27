// tests/ci-guards/panel-icon-scale.spec.ts
//
// The AI panel's icons use three sizes and one stroke weight.
//
// ── WHY ──────────────────────────────────────────────────────────────────────
// Seven sizes shipped, written five ways — `size={12}`, `w-3 h-3`, `w-3.5 h-3.5`,
// `w-[18px] h-[18px]`, raw `width="16" height="16"` — so the same 14px icon was
// `size={14}` in one file and `w-3.5 h-3.5` in the next. Five stroke weights
// shipped against a design system that specifies one.
//
// ⚠ THE SCANNER IS THE POINT, AND IT IS WHERE THE EARLIER COUNTS WENT WRONG.
// Three separate blind spots produced three different wrong answers before this:
//   · `w-[0-9]+ h-[0-9]+` never matched `w-3.5 h-3.5` — eleven 14px icons invisible.
//   · counting `w-5/6/8/10` as icons inflated the total to 13; those sit on
//     container `div`s, not glyphs.
//   · only two of the five spellings were checked at all.
// So this guard resolves a size ONLY on an element that is an `<svg>` or a
// component this file imports from `lucide-react`, and it reads all five
// spellings. `it('the scanner sees every spelling')` pins that, because a scanner
// that silently stops seeing one spelling reports a clean panel.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { ICON_SIZES, ICON_STROKE } from '../../src/canvas/conversation/panelIcons'

const root = resolve(__dirname, '../..')
const SURFACE = [
  'src/canvas/conversation',
  'src/v5/blocks',
  'src/canvas/components/FloatingOlumiPanel.tsx',
  'src/canvas/components/OlumiTabBody.tsx',
]

function walk(rel: string): string[] {
  const abs = resolve(root, rel)
  if (statSync(abs).isFile()) return abs.endsWith('.tsx') ? [rel] : []
  return readdirSync(abs).flatMap((e) =>
    e === '__tests__' || e === '__fixtures__' ? [] : walk(join(rel, e)),
  )
}
const FILES = SURFACE.flatMap(walk).filter((f) => !/\.(spec|test)\.tsx$/.test(f))

type Hit = { file: string; tag: string; px: number | null; stroke: number | null; spelling: string }

/** Every icon-element occurrence, with its size resolved from any spelling. */
function iconHits(): Hit[] {
  const hits: Hit[] = []
  for (const rel of FILES) {
    const src = readFileSync(resolve(root, rel), 'utf8')
    const lucide = new Set<string>(['Icon'])
    for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g))
      for (const n of m[1].split(','))
        lucide.add(n.trim().split(/\s+as\s+/).pop()!.trim())

    for (const m of src.matchAll(/<([A-Za-z][A-Za-z0-9]*)\b([^>]*?)\/?>/gs)) {
      const [, tag, attrs] = m
      if (tag !== 'svg' && !lucide.has(tag)) continue
      let px: number | null = null
      let spelling = 'none'
      let a: RegExpExecArray | null
      if ((a = /\bsize=\{(\d+(?:\.\d+)?)\}/.exec(attrs))) { px = +a[1]; spelling = 'sizeProp' }
      else if ((a = /\bw-(\d+(?:\.\d+)?) h-\1\b/.exec(attrs))) { px = +a[1] * 4; spelling = 'tailwind' }
      else if ((a = /\bw-\[(\d+)px\] h-\[\1px\]/.exec(attrs))) { px = +a[1]; spelling = 'arbitrary' }
      else if ((a = /\bwidth="(\d+)"[\s\S]*?height="\1"/.exec(attrs))) { px = +a[1]; spelling = 'svgAttr' }
      const sw = /\bstrokeWidth=[{"]([\d.]+)[}"]/.exec(attrs)
      hits.push({ file: rel, tag, px, stroke: sw ? +sw[1] : null, spelling })
    }
  }
  return hits
}

describe('AI panel icon scale', () => {
  it('PRECONDITION — the surface is walkable and full of icons', () => {
    expect(FILES.length, 'no .tsx found in the panel surface').toBeGreaterThan(40)
    expect(iconHits().filter((h) => h.px !== null).length, 'no sized icons found — scanner blind').toBeGreaterThan(50)
  })

  it('the scanner sees every spelling — a blind mechanism reports a clean panel', () => {
    // Each of these produced a wrong count when it was missing. If a spelling
    // legitimately drops to zero, delete its line here DELIBERATELY; do not let
    // the scanner quietly stop looking for it.
    //
    // `svgAttr` was removed deliberately: the last square raw `<svg>` ICON became
    // a Lucide component, so no icon is sized that way any more. The three raw
    // `<svg>` that remain are the chrome shape and two dashed arrows, all
    // non-square (`width="14" height="8"`), so none is an icon-size hit. The
    // scanner still READS the spelling — this line records that it now finds
    // none, which is the difference between "gone" and "unobserved".
    const spellings = new Set(iconHits().filter((h) => h.px !== null).map((h) => h.spelling))
    expect([...spellings].sort()).toEqual(['sizeProp', 'tailwind'])
  })

  it('every icon is 12, 14 or 16px', () => {
    const offenders = iconHits()
      .filter((h) => h.px !== null && !(ICON_SIZES as readonly number[]).includes(h.px))
      .map((h) => `${h.file} <${h.tag}> ${h.px}px`)
    expect(offenders, 'icon sizes outside the scale — see panelIcons.ts').toEqual([])
  })

  it('every stroke weight is the DS value', () => {
    const offenders = iconHits()
      .filter((h) => h.stroke !== null && h.stroke !== ICON_STROKE)
      .map((h) => `${h.file} <${h.tag}> strokeWidth=${h.stroke}`)
    expect(offenders, `DS v5 §17 specifies ${ICON_STROKE}px`).toEqual([])
  })

  it('pins the hand-drawn <svg> glyphs — a DECLARED debt that may shrink, never grow', () => {
    // DS v5 §17: Lucide only. Five hand-built glyphs were replaced with the
    // Lucide components whose path data they had been copying (ThumbsUp,
    // ThumbsDown, two X marks, ChevronUp/Down) — a swap with no visual delta.
    // THREE remain and are NOT drift: the panel's own chrome shape, and two
    // bespoke dashed connector arrows that Lucide has no equivalent for.
    const raw = FILES.reduce(
      (n, f) => n + (readFileSync(resolve(root, f), 'utf8').match(/<svg\b/g)?.length ?? 0),
      0,
    )
    expect(raw, 'a new hand-drawn <svg> appeared — use Lucide (DS v5 §17)').toBeLessThanOrEqual(3)
  })
})
