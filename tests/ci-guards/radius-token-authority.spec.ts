// tests/ci-guards/radius-token-authority.spec.ts
//
// `--radius-*` must have exactly ONE authority per token — and where it does not,
// the exception is pinned here EXACTLY, in both directions, with its reason.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// `--radius-lg` is declared TWICE: `styles/brand.css` says 20px and `index.css`
// says 14px. `index.css` wins, because its own `@import './styles/brand.css'` is
// hoisted above its `:root`. So every `rounded-lg` call site renders at 14px —
// a value DS v5 does not contain.
//
// ⚠ THE OBVIOUS FIX IS WRONG, WHICH IS THE WHOLE REASON FOR THIS GUARD.
// Deleting the override does not restore the design system; it makes a different
// half of the product wrong. DS v5 §6.2 is coherent and context-dependent:
//
//     md   12px   Panel cards, modals, accordions
//     lg   20px   Standalone cards, large panels, conversation blocks
//     "Panel context override: Cards inside panels use `md` (12px).
//      Cards outside panels use `lg` (20px)."
//
// 615 `rounded-lg` occurrences across 274 non-test files are dominated by panel
// context (`canvas/components` alone holds 122 files). Those sites are MIS-TOKENED
// — they should be `rounded-md` — and they have been rendering 14px, close enough
// to 12px that nobody saw it. Delete the override on its own and they all jump to
// 20px: a visible regression across the panel estate, arrived at by "removing a
// duplicate", which is exactly the shape of change that reads as tidying.
//
// So the duplicate stays until the call sites are reclassified, and this guard
// makes it a DECLARED exception rather than an accident. It fails loud if:
//   · a third `--radius-lg` declaration appears anywhere,
//   · either declared value changes,
//   · the override is deleted WITHOUT the migration (the tempting move),
//   · a new `--radius-*` token is minted, or an existing one gains a second home.
//
// ── ROOT CAUSE, AND WHY THE DOC ASSERTION BELOW IS THE LOAD-BEARING HALF ──────
// The DS's own panel checklist read `Card radius | rounded-lg (12px) consistently`
// — naming the `lg` TOKEN while quoting the `md` VALUE. That single line is the
// most plausible reason 615 in-panel sites were written as `rounded-lg` by authors
// who expected 12px and had every reason to think they were following the spec.
// It is fixed, and pinned here so it cannot regress. A guard on the CSS alone
// would keep catching the symptom while the instruction that produces it stayed
// on the page.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8')

/** Every `--radius-*` declaration in a stylesheet, as `{ token, value }`. */
function radiusDeclarations(source: string): Array<{ token: string; value: string }> {
  const out: Array<{ token: string; value: string }> = []
  const re = /--(radius-[a-z0-9-]+)\s*:\s*([^;]+);/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    out.push({ token: m[1], value: m[2].trim() })
  }
  return out
}

const STYLESHEETS = ['src/styles/brand.css', 'src/index.css'] as const

describe('--radius-* token authority', () => {
  it('PRECONDITION — both stylesheets are readable and non-empty', () => {
    // Without this, every assertion below passes vacuously on an empty string.
    for (const f of STYLESHEETS) {
      expect(read(f).length, `${f} is empty`).toBeGreaterThan(500)
    }
  })

  it('declares exactly the DS v5 §6.2 token set, and no others', () => {
    const tokens = new Set(
      STYLESHEETS.flatMap((f) => radiusDeclarations(read(f)).map((d) => d.token)),
    )
    expect([...tokens].sort()).toEqual([
      'radius-lg',
      'radius-md',
      'radius-pill',
      'radius-sm',
    ])
  })

  it('gives sm, md and pill exactly one home, with their DS values', () => {
    const all = STYLESHEETS.flatMap((f) =>
      radiusDeclarations(read(f)).map((d) => ({ ...d, file: f })),
    )
    for (const [token, value] of [
      ['radius-sm', '8px'],
      ['radius-md', '12px'],
      ['radius-pill', '999px'],
    ] as const) {
      const found = all.filter((d) => d.token === token)
      expect(found, `${token} must be declared exactly once`).toHaveLength(1)
      expect(found[0].file).toBe('src/styles/brand.css')
      expect(found[0].value).toBe(value)
    }
  })

  it('pins the ONE known duplicate authority exactly — brand 20px, index 14px', () => {
    const brand = radiusDeclarations(read('src/styles/brand.css')).filter(
      (d) => d.token === 'radius-lg',
    )
    const index = radiusDeclarations(read('src/index.css')).filter(
      (d) => d.token === 'radius-lg',
    )

    // Both directions. A deletion is as much a change as an addition: removing
    // the override without reclassifying the panel call sites is the regression
    // this guard exists to stop, and it would otherwise look like a cleanup.
    expect(brand, 'brand.css must declare --radius-lg exactly once').toHaveLength(1)
    expect(index, 'index.css override removed — see this file’s header before "fixing" it').toHaveLength(1)
    expect(brand[0].value).toBe('20px')
    expect(index[0].value).toBe('14px')
  })

  it('keeps index.css the effective authority — the import stays hoisted above :root', () => {
    // The 14px only wins because `@import './styles/brand.css'` is hoisted above
    // the `:root` that overrides it. If the import moved below, the effective
    // value would silently become 20px estate-wide with no diff to the token.
    const css = read('src/index.css')
    const importAt = css.indexOf("@import './styles/brand.css'")
    const overrideAt = css.indexOf('--radius-lg')
    expect(importAt, 'brand.css import not found in index.css').toBeGreaterThan(-1)
    expect(overrideAt, '--radius-lg override not found in index.css').toBeGreaterThan(-1)
    expect(importAt).toBeLessThan(overrideAt)
  })

  it('the DS panel checklist names the md TOKEN, not the lg token, for 12px', () => {
    // The root cause. It read `rounded-lg` (12px) — the lg token with the md
    // value — which is the instruction 615 in-panel call sites appear to have
    // followed. Pinned so it cannot regress to the shape that caused the drift.
    const ds = read('docs/Design/Olumi_Design_System_v5.md')
    const line = ds.split('\n').find((l) => l.includes('Card radius'))
    expect(line, 'the panel checklist has no Card radius row any more').toBeTruthy()
    expect(line).toContain('rounded-md')
    expect(line).not.toMatch(/`rounded-lg`\s*\(12px\)/)
  })

  it('§6.2 still states the panel context override this guard reasons from', () => {
    // If the rule itself is ever changed, this guard's reasoning is stale and the
    // reader must be sent back to §6.2 rather than trusting the header above.
    const ds = read('docs/Design/Olumi_Design_System_v5.md')
    expect(ds).toContain('Cards inside panels use `md` (12px)')
    expect(ds).toContain('Cards outside panels use `lg` (20px)')
  })
})
