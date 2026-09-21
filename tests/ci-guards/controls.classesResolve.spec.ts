/**
 * ⭐⭐⭐ EVERY UTILITY `controls.ts` SHIPS MUST RESOLVE IN THE REAL TAILWIND CONFIG.
 *
 * ## The defect this exists to make impossible
 *
 * `--border-field` was minted at 3.70:1 against the panel, derived against WCAG
 * 1.4.11, registered in `tailwind.config.js` as **`colors.panel.field`**, and
 * used in the source as **`border-field`**.
 *
 * Tailwind flattens a NESTED colour key with a dash, so `colors.panel.field`
 * generates `border-panel-field`. **`border-field` was defined nowhere, Tailwind
 * emitted nothing for it, and the border never rendered.** The control the
 * founder could not find stayed unfindable — the fill landed, the 3.70:1 edge
 * did not.
 *
 * ## ⛔ WHY EVERY EXISTING TEST WAS GREEN, WHICH IS THE POINT
 *
 * Four instruments agreed and all four were blind:
 *   · the affordance specs assert `className` **contains** `'border-field'` — a
 *     STRING test, which cannot see whether the class resolves to any CSS;
 *   · `controls.contrast.spec.ts` parses `brand.css` and COMPUTES the ratio —
 *     green, because the custom property is genuinely correct; it never touches
 *     the Tailwind binding;
 *   · `pnpm typecheck` and the DS text-scanner never resolve utilities at all.
 *
 * A class name is a string until a build tool turns it into a rule. **Nothing in
 * this repo asserted that step**, so the one thing that had to be true was the
 * one thing nothing checked.
 *
 * ## The shape of this guard
 *
 * It reads the class strings out of `controls` at RUNTIME and resolves each
 * against the REAL config via Tailwind's own `resolveConfig`. **Nothing is
 * hand-listed** — add a class to `controls.ts` and it is checked on the next run
 * with no edit here, which is the only form that cannot drift (trap 12).
 */

import { describe, it, expect } from 'vitest'
import resolveConfig from 'tailwindcss/resolveConfig'
// @ts-expect-error TS7016 — the root Tailwind config ships no declaration file.
// Same pragma and same reason as `tests/helpers/semanticTextContrastScan.ts`,
// which is this repo's established form for reading it. The shape relied on here
// is pinned by this file's own non-vacuity assertions: if the resolved theme
// stops yielding a populated borderColor map, the flattener pin REDs.
import tailwindConfig from '../../tailwind.config.js'
import { controls } from '../../src/styles/controls'

const resolved = resolveConfig(tailwindConfig)

/** Flatten every class string `controls` exports, including nested objects. */
function everyClassString(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) everyClassString(v, out)
  }
  return out
}

/** `hover:border-primary` -> `border-primary`; `disabled:bg-panel` -> `bg-panel`. */
const stripVariants = (cls: string) => cls.slice(cls.lastIndexOf(':') + 1)

/**
 * ⚠ `resolveConfig` returns the theme maps NESTED — Tailwind flattens them when
 * it generates CSS, not in the resolved object. So `theme.borderColor.panel` is
 * `{ DEFAULT, hover, border }`, and the utility names are `border-panel`,
 * `border-panel-hover`, `border-panel-border`.
 *
 * ⛔ The first version of this guard read `Object.keys(theme.borderColor)` and
 * therefore only ever saw TOP-LEVEL keys. It passed `field` (top-level, the fix)
 * and REPORTED `panel-border` — a working class with 556 uses — as unresolved.
 * Worse, its "mutant" check that `panel-field` is absent passed for the wrong
 * reason: a nested name was never going to appear in that key set either way,
 * so the check could not have failed. **A guard that cannot fail is not a guard**
 * (trap 13b), and this one had to be corrected before it could be trusted about
 * the defect it was written for.
 */
function flattenThemeMap(obj: Record<string, unknown>, prefix = '', out = new Set<string>()): Set<string> {
  for (const [k, v] of Object.entries(obj)) {
    const name = k === 'DEFAULT' ? prefix.replace(/-$/, '') : `${prefix}${k}`
    if (typeof v === 'string' || typeof v === 'function') out.add(name)
    else if (v && typeof v === 'object') flattenThemeMap(v as Record<string, unknown>, `${name}-`, out)
  }
  return out
}

const ALL_CLASSES = everyClassString(controls).flatMap((s) => s.split(/\s+/)).filter(Boolean)

describe('every class controls.ts ships resolves in the real Tailwind config', () => {
  it('collected a plausible number of classes — a zero here would make every assertion vacuous', () => {
    // Non-vacuity (trap 13): if the flattener stopped working, every `expect`
    // below would pass over an empty list and this file would assert nothing.
    expect(ALL_CLASSES.length).toBeGreaterThan(20)
  })

  it('⭐ every border-* utility names a real borderColor key', () => {
    const keys = flattenThemeMap((resolved.theme?.borderColor ?? {}) as Record<string, unknown>)
    const WIDTH_ONLY = new Set(['border']) // the bare width utility, not a colour

    const unresolved: string[] = []
    for (const raw of ALL_CLASSES) {
      const cls = stripVariants(raw)
      if (!cls.startsWith('border-') || WIDTH_ONLY.has(cls)) continue
      const key = cls.slice('border-'.length)
      if (!keys.has(key)) unresolved.push(`${raw} -> borderColor['${key}'] does not exist`)
    }

    expect(
      unresolved,
      'a border class that resolves to no key emits NO CSS — the border silently ' +
        'does not render, and a className assertion cannot see it:\n  ' +
        unresolved.join('\n  '),
    ).toEqual([])
  })

  it('⛔ MUTANT: the nested spelling this defect shipped must be REJECTED by that check', () => {
    // The discriminating half. Without it, the assertion above passes for any
    // set of classes that happens to resolve and says nothing about whether the
    // check can DETECT the real defect. `panel-field` is the name Tailwind
    // generates from the nested form; it must not satisfy `border-field`.
    const keys = flattenThemeMap((resolved.theme?.borderColor ?? {}) as Record<string, unknown>)
    expect(keys.has('field'), 'border-field must resolve — that is the fix').toBe(true)

    // ⭐ The flattener must be able to SEE a nested name, or the next assertion
    // passes vacuously. `panel-border` is the 556-use working class.
    expect(
      keys.has('panel-border'),
      'the flattener cannot see nested names — every assertion here would be vacuous',
    ).toBe(true)

    expect(
      keys.has('panel-field'),
      'the nested spelling must be GONE, or the colour is still a text utility and ' +
        'the contrast guard will keep REDing',
    ).toBe(false)
  })

  it('every bg-* and text-* utility resolves too — the same blindness applies to them', () => {
    const flat = flattenThemeMap((resolved.theme?.colors ?? {}) as Record<string, unknown>)

    const unresolved: string[] = []
    for (const raw of ALL_CLASSES) {
      const cls = stripVariants(raw)
      const m = /^(bg|text)-(.+)$/.exec(cls)
      if (!m) continue
      // ⚠ `text-` IS FOUR UNRELATED UTILITY FAMILIES, not one. Colour
      // (`text-info`), font size (`text-xl`), alignment (`text-left`) and
      // wrapping/overflow (`text-ellipsis`). The first version of this guard
      // knew only about colour and size, and reported `text-left` — a real
      // alignment utility — as an unresolved colour. A guard that cries wolf on
      // a working class gets switched off, so the non-colour families are named
      // here rather than the assertion being loosened.
      const sizes = new Set(Object.keys(resolved.theme?.fontSize ?? {}))
      const TEXT_NON_COLOUR = new Set([
        'left', 'center', 'right', 'justify', 'start', 'end',
        'ellipsis', 'clip', 'wrap', 'nowrap', 'balance', 'pretty',
      ])
      if (m[1] === 'text' && (sizes.has(m[2]) || TEXT_NON_COLOUR.has(m[2]))) continue
      if (!flat.has(m[2])) unresolved.push(`${raw} -> colors['${m[2]}'] does not exist`)
    }
    expect(unresolved, `unresolved colour utilities:\n  ${unresolved.join('\n  ')}`).toEqual([])
  })
})
