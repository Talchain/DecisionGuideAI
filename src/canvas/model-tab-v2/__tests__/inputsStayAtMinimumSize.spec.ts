/**
 * Text-entry controls in the Model tab stay at the DS minimum size (14px).
 *
 * ⚠ WHY THIS EXISTS. The panel-scale migration (#1179) declared, in its own
 * commit message, that "text INPUTS stay at 14px — a 12px input is a usability
 * regression at the 280px dock floor". It then migrated two of the three inputs
 * to `panelTabular` (12px) anyway. An independent review caught it at the bytes.
 *
 * Nothing could have caught it otherwise: a reviewer proved that swapping every
 * `panelTabular` in `ModelRowView` to `panelMeta` (11px) leaves 376 tests green.
 * Typography in this directory is entirely unwitnessed, so the ONE rule the
 * migration set for itself had no red anywhere. This is that red.
 *
 * DS v5 §2.1 names 14px the minimum accessible size, and §2.2's panel-context
 * override list covers badges, buttons and helper text — deliberately NOT
 * inputs. The row value editor is 96px wide (`w-24`) at a 280px dock.
 *
 * DERIVED, NOT MIRRORED, in both directions:
 *  - the size of each token comes from the typography module itself, so adding
 *    or resizing a token cannot leave a stale list here;
 *  - the controls come from scanning the directory, so a NEW input is covered
 *    the moment it is written. A hand-listed set of files would go stale, which
 *    is the defect class this estate pays for most often.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { typography } from '../../../styles/typography'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Tailwind font-size utilities that are BELOW the 14px minimum. */
// ⚠ No trailing `\b`: `]` and the following `"` are both non-word characters, so
// a word boundary there never matches and the arbitrary-size branch would be dead.
// The vacuity control at the bottom of this file is what caught that.
const BELOW_MINIMUM = /\btext-(?:xs\b|\[(?:[0-9]|1[0-3])(?:\.\d+)?px\])/

interface Control {
  readonly file: string
  readonly line: number
  readonly tag: string
  readonly token: string | null
}

/**
 * Every text-entry control in the directory, with the typography token on its
 * own className. The forward walk stops at the element's own `/>` so a token
 * belonging to a LATER sibling can never be attributed to this control —
 * binding by identity, not by proximity.
 */
function textEntryControls(): Control[] {
  const found: Control[] = []
  for (const file of readdirSync(DIR).filter(f => f.endsWith('.tsx'))) {
    const lines = readFileSync(path.join(DIR, file), 'utf8').split('\n')
    lines.forEach((line, i) => {
      const open = /<(input|textarea)\b/.exec(line)
      if (!open) return
      let token: string | null = null
      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        const m = /className=.*typography\.(\w+)/.exec(lines[j])
        if (m) {
          token = m[1]
          break
        }
        if (j > i && /\/>/.test(lines[j])) break
      }
      found.push({ file, line: i + 1, tag: open[1], token })
    })
  }
  return found
}

describe('Model tab text-entry controls hold the 14px minimum', () => {
  const controls = textEntryControls()

  it('the scan finds every control the directory contains (positive control)', () => {
    // Counted independently of the walk above: if the parser silently stops
    // matching, this REDs instead of the suite passing on an empty set — an
    // absence probe that cannot see a presence proves nothing.
    const raw = readdirSync(DIR)
      .filter(f => f.endsWith('.tsx'))
      .reduce(
        (n, f) => n + (readFileSync(path.join(DIR, f), 'utf8').match(/<(input|textarea)\b/g) ?? []).length,
        0,
      )
    expect(raw).toBeGreaterThan(0)
    expect(controls).toHaveLength(raw)
  })

  it('every control resolves to a typography token (no unclassifiable control)', () => {
    // A control with no token would slip past the size assertion silently.
    expect(controls.filter(c => c.token === null)).toEqual([])
  })

  it('no control uses a token below the 14px minimum', () => {
    const offenders = controls
      .filter(c => c.token !== null)
      .map(c => ({ ...c, classes: (typography as Record<string, string>)[c.token as string] }))
      .filter(c => typeof c.classes === 'string' && BELOW_MINIMUM.test(c.classes))
      .map(c => `${c.file}:${c.line} <${c.tag}> typography.${c.token} = "${c.classes}"`)

    expect(
      offenders,
      '\nDS v5 §2.1: 14px is the minimum accessible size, and §2.2 does NOT list inputs\n' +
        'among the panel-context overrides. A 12px field is a usability regression at the\n' +
        '280px dock floor. Use `tabular` for numeric fields, `bodySmall` otherwise.\n' +
        offenders.join('\n') +
        '\n',
    ).toEqual([])
  })

  it('the rule can SEE a violation (the assertion is not vacuous)', () => {
    // The guard above is an ABSENCE claim. Shown here detecting a presence,
    // against the real token strings rather than a fabricated one.
    expect(BELOW_MINIMUM.test(typography.panelTabular)).toBe(true)
    expect(BELOW_MINIMUM.test(typography.panelBody)).toBe(true)
    expect(BELOW_MINIMUM.test(typography.panelMeta)).toBe(true)
    // …and a contrast control: the tokens the rule must ACCEPT.
    expect(BELOW_MINIMUM.test(typography.tabular)).toBe(false)
    expect(BELOW_MINIMUM.test(typography.bodySmall)).toBe(false)
  })
})
