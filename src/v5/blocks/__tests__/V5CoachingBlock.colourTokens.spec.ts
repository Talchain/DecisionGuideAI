/**
 * PR3 follow-up — EVERY COLOUR CLASS ON THE COACHING CARD MUST RESOLVE.
 *
 * THE DEFECT THIS EXISTS FOR, and it shipped inside the very PR that set out
 * to make hierarchy legible. Six new classes were written as
 * `text-text-muted`. `colors.text` in `tailwind.config.js` declares
 * `{header, body, light, on-color}` — there is **no `muted`** — so Tailwind
 * emitted no rule and all six elements silently inherited the body colour.
 * The "one quiet line", the freshness notice, the grounding line and the
 * disclosure summary rendered at exactly the prominence of the body prose,
 * and the emphasis ladder was not even monotone: `technique`, the LEAST
 * urgent tier, carried the darkest label on the card.
 *
 * WHY NOTHING CAUGHT IT — this is the durable lesson and the reason this file
 * is separate and loud:
 *   - jsdom specs compare className STRINGS. A string differs identically
 *     whether or not the class resolves to a rule. No structural test can
 *     EVER see a dead utility class.
 *   - The `Set(badges).size === 4` assertion passes before AND after the fix,
 *     so the suite could not distinguish the broken card from the fixed one.
 *   - Even the browser pass missed it, because it asked "are the four
 *     DISTINCT?" (true — the ladder was distinct but mis-ordered) rather than
 *     "is the ladder ORDERED?". A guard that agrees with itself, inside the
 *     instrument added to escape jsdom.
 *
 * WHAT THIS GUARD DOES: derives the legal colour vocabulary from
 * `tailwind.config.js` — the authority, never a copy — and asserts every
 * colour utility written in the component resolves against it. It reads the
 * SOURCE rather than a render, so it covers branches no fixture exercises.
 * It is cheap, deterministic, and needs no CSS build.
 *
 * WHAT IT CANNOT DO, stated so nobody mistakes its scope: it proves a class
 * NAME is legal, never that the resulting colour is legible, contrast-safe,
 * or correctly ordered. Ordering is asserted from computed styles in the
 * browser pass recorded on the PR.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

interface Tailwindish {
  theme?: { extend?: { colors?: Record<string, unknown> } }
}

/**
 * The config is plain JS with no type declaration, so a STATIC import trips
 * TS7016 and fails the typecheck ratchet. It is loaded at runtime from an
 * absolute file URL instead: the specifier is a variable, so TypeScript never
 * has to resolve it, and no ambient `declare module` or `@ts-expect-error`
 * suppression is needed. `beforeAll` fails loudly if the load returns nothing
 * — a config that silently read as `{}` would make every assertion below pass
 * by policing an empty palette.
 */
let tailwindConfig: Tailwindish
beforeAll(async () => {
  const url = pathToFileURL(resolve(process.cwd(), 'tailwind.config.js')).href
  const mod = (await import(/* @vite-ignore */ url)) as { default?: Tailwindish }
  tailwindConfig = mod.default ?? (mod as Tailwindish)
  if (!tailwindConfig?.theme?.extend?.colors) {
    throw new Error(`tailwind.config.js loaded but declared no colours (${url})`)
  }
})

/**
 * Resolved from the project root, not from `import.meta.url` — under vitest
 * that is not a `file:` URL and `fileURLToPath` throws at COLLECTION, which
 * would take the whole file to zero collected tests. Existence is asserted
 * below rather than assumed: a path that silently reads nothing would make
 * every assertion here pass by policing an empty string.
 */
const CARD_SOURCE = resolve(process.cwd(), 'src/v5/blocks/V5CoachingBlock.tsx')

/**
 * Tailwind built-ins that are legal on every colour utility and are not
 * declared in the project palette.
 */
const BUILT_IN_COLOURS = new Set([
  'transparent',
  'current',
  'inherit',
  'white',
  'black',
])

/** Flatten `theme.extend.colors` into the set of legal utility suffixes. */
function legalColourNames(): Set<string> {
  const colours = tailwindConfig.theme?.extend?.colors
  const out = new Set<string>()
  for (const [family, value] of Object.entries(colours ?? {})) {
    if (typeof value === 'string') {
      out.add(family)
      continue
    }
    for (const shade of Object.keys(value as Record<string, unknown>)) {
      // Tailwind's DEFAULT key is addressed by the bare family name.
      out.add(shade === 'DEFAULT' ? family : `${family}-${shade}`)
    }
  }
  return out
}

/** The first segment of every declared family — used to decide what to police. */
function paletteRoots(names: Set<string>): Set<string> {
  return new Set([...names].map((n) => n.split('-')[0]))
}

describe('V5CoachingBlock — every colour class resolves against the Tailwind palette', () => {
  // Computed INSIDE each test, never at describe-evaluation: the config is
  // loaded in `beforeAll`, which runs after the describe body.

  it('the palette probe itself reads the real config (positive control)', () => {
    const legal = legalColourNames()
    // A probe that reads an empty config would pass every assertion below by
    // policing nothing. It must see the families this card actually uses.
    expect(legal.size).toBeGreaterThan(10)
    expect(legal.has('text-light')).toBe(true)
    expect(legal.has('text-body')).toBe(true)
    expect(legal.has('danger')).toBe(true)
    expect(legal.has('info')).toBe(true)
    // ...and it must NOT invent the token that caused the defect.
    expect(legal.has('text-muted')).toBe(false)
  })

  it('names no colour the config does not declare', () => {
    const legal = legalColourNames()
    const roots = paletteRoots(legal)
    // Positive control: the component must actually be where we think it is.
    expect(existsSync(CARD_SOURCE), `component not found at ${CARD_SOURCE}`).toBe(true)
    const source = readFileSync(CARD_SOURCE, 'utf8')
    // ...and the scan must actually see the file's classes.
    expect(source.length).toBeGreaterThan(1000)

    const used = source.match(/\b(?:text|bg|border|ring|fill|stroke)-[a-z][a-z0-9-]*(?:\/\d+)?/g) ?? []
    expect(used.length, 'class scan found nothing — the regex or path is wrong').toBeGreaterThan(10)

    const offenders: string[] = []
    for (const raw of used) {
      const [utility] = raw.split('-')
      const suffix = raw.slice(utility.length + 1).split('/')[0]
      // Only police tokens that CLAIM a palette family. `text-sm`, `border`,
      // `bg-transparent` and the like are not colour references.
      const root = suffix.split('-')[0]
      if (!roots.has(root)) continue
      if (BUILT_IN_COLOURS.has(suffix)) continue
      if (!legal.has(suffix)) offenders.push(`${raw}  (resolves to nothing)`)
    }

    expect(
      [...new Set(offenders)],
      'A colour utility on this card names a token tailwind.config.js does not declare, ' +
        'so Tailwind emits NO rule and the element silently inherits its parent colour. ' +
        'This is invisible to every className-string assertion in the suite.',
    ).toEqual([])
  })

  it('PROOF THE GUARD CAN FAIL: the exact dead class is reported as unresolvable', () => {
    const legal = legalColourNames()
    // Discriminating pair against the real palette — the fixed token passes,
    // the token this PR actually shipped fails. A completeness guard with no
    // demonstrated red is the shape this estate keeps finding vacuous.
    const resolves = (suffix: string) => legal.has(suffix) || BUILT_IN_COLOURS.has(suffix)
    expect(resolves('text-light'), 'the FIXED token must resolve').toBe(true)
    expect(resolves('text-muted'), 'the SHIPPED dead token must not resolve').toBe(false)
  })
})
