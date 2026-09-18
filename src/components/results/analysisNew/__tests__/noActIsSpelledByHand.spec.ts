/**
 * ⭐⭐ NO PANEL ACT SPELLS THE TIER BY HAND — the guard that would have caught
 * the defect #1655 shipped believing it had fixed.
 *
 * ⛔ WHAT HAPPENED, and it is the whole argument for this file. #1655 found the
 * 24px touch target (WCAG 2.2 AA §2.5.8) applied at exactly one of twelve
 * `action('inline')` call sites, and moved the geometry ONTO the tier so every
 * call site would inherit it. Its rationale named the control it cared most
 * about: *"the ONLY route out of a withheld verdict"*.
 *
 * **That control never called `action('inline')`.** It wrote
 * `rounded … text-info underline` plus `ACTION_FOCUS` out by hand, so the fix
 * landed on a tier the call site did not use. Measured on deployed `45659d8f`,
 * on the surface a fresh guest actually lands on: **133×15** — unchanged, weeks
 * after the PR that existed to fix it.
 *
 * ⭐ SO THE REMEDY IS NOT ANOTHER PER-CALL-SITE FIX. Moving geometry onto a
 * tier only helps the call sites that NAME the tier; a hand-spelled copy is
 * invisible to it and to every later improvement. This asserts the naming.
 *
 * ⚠ IT MATCHES ON THE PAIR, NOT ON `text-info` ALONE. `text-info` is a legitimate
 * colour for non-pressable text; it is `text-info` TOGETHER WITH `underline`
 * that claims PRESSABLE, which is the claim the tier owns — and the same pair
 * `actionColourMeansPressable` polices from the other direction.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve as resolvePath, join as joinPath } from 'node:path'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'

const DIR = resolvePath(__dirname, '..')
/** The tier's own file is where the spelling is SUPPOSED to live. */
const OWNER = 'panelSurfaces.ts'

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = joinPath(dir, entry)
    if (statSync(full).isDirectory()) return entry === '__tests__' || entry === 'prototype' ? [] : sources(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })

/**
 * A className literal that claims PRESSABLE AT REST without naming a tier.
 *
 * ⚠⚠ `underline` MUST BE A BARE CLASS, NOT A VARIANT SUFFIX, and my first
 * version got this wrong in the direction that matters: a plain `/underline/`
 * also matches `hover:underline`, which flagged three controls that are
 * underline-ON-HOVER and therefore make no at-rest claim at all
 * (`ArgueTheOpposite` and two in `StrengthenTheReasoning`, one of which is a
 * filled `bg-info/10` chip with no underline anywhere). They are pinned as
 * negative controls below, because a guard that cries wolf gets widened until
 * it stops guarding.
 */
const spellsAnAct = (code: string): boolean => {
  const literals = code.match(/className=\{?`[^`]*`/g) ?? []
  // `underline` as its own token — not `hover:underline`, `focus:underline`, …
  const bareUnderline = /(^|[\s`{])underline([\s`}]|$)/
  return literals.some((l) => /text-info/.test(l) && bareUnderline.test(l) && !/action\(/.test(l))
}

describe('no act is spelled by hand', () => {
  it('PRECONDITION: the scan reads the directory and the detector can fire', () => {
    const files = sources(DIR)
    expect(files.length, 'the scan must have read the directory').toBeGreaterThan(15)
    /**
     * ⭐ THE DETECTOR'S OWN CONTROL. A `spellsAnAct` that silently matched
     * nothing would report a clean sweep while reading everything — the
     * absence-probe failure this estate keeps paying for. This feeds it the
     * exact shape the guard exists to catch.
     */
    expect(spellsAnAct('className={`rounded text-info underline`}'), 'must catch a hand-spelled act').toBe(true)
    expect(spellsAnAct('className={`${action(\'inline\')} mt-1`}'), 'must allow a named tier').toBe(false)
    expect(spellsAnAct('className={`text-info`}'), 'colour alone is not a pressable claim').toBe(false)
    /**
     * ⛔ THE NEGATIVE CONTROLS, AND THEY ARE REAL CODE RATHER THAN INVENTED.
     * These three shapes ship on this panel today and are CORRECT: an
     * underline that appears on hover makes no claim at rest, and a filled
     * chip makes its claim with a background. My first detector flagged all
     * three, which is how a guard earns a reputation for noise.
     */
    expect(spellsAnAct('className={`text-info hover:underline`}'), 'hover-only underline is not an at-rest claim').toBe(false)
    expect(spellsAnAct('className={`bg-info/10 px-2 py-1 text-info hover:bg-info/20`}'), 'a filled chip claims with its fill').toBe(false)
  })

  it('⭐ every pressable act on this panel names its tier', () => {
    const offenders = sources(DIR)
      .filter((f) => !f.endsWith(OWNER))
      .filter((f) => spellsAnAct(stripComments(readFileSync(f, 'utf8'), f)))
      .map((f) => f.slice(DIR.length + 1))
    expect(offenders, 'these claim PRESSABLE without naming a tier, so tier fixes cannot reach them').toEqual([])
  })
})
