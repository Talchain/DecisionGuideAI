/**
 * ⭐ EVERY NODE GLYPH OPENS ON THE SAME BEAT — ASSERTED AGAINST THE ADOPTERS,
 *    NOT AGAINST THE CONSTANT'S VALUE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ WHY THIS FILE EXISTS: THE GUARD IT REPLACES FAILED IN BOTH DIRECTIONS
 * ─────────────────────────────────────────────────────────────────────────────
 * `nodeIconHoverAffordance.spec.tsx` carried a case named *"all three open on
 * the one shared beat"* whose entire body was:
 *
 *     expect(NODE_TOOLTIP_DELAY_MS).toBe(300)
 *
 * That is an assertion about a NUMBER, under a name that promises a claim about
 * ADOPTERS, and it was wrong on both sides of the property it named:
 *
 *   · Point one adopter at `delay={200}` and it stays **GREEN** — it never
 *     looked at an adopter, so it cannot see the only drift it is named for.
 *   · Move the shared constant to 250 and it goes **RED** — while its own name
 *     stays true, because the adopters would still be in perfect agreement.
 *
 * A guard that reds on a deliberate change and passes on the regression is worse
 * than no guard: it trains the next author to move the number and move on.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ WHAT IS ACTUALLY MEASURED — AND HOW, BECAUSE THE HOW IS THE EVIDENCE
 * ─────────────────────────────────────────────────────────────────────────────
 * `Tooltip` is mocked with a component that RECORDS the props it is handed and
 * renders `children`, so each adopter is mounted for real and the `delay` it
 * passes is read off the call rather than off this file. The property asserted
 * is then the one the name promises: **every adopter resolves to the SAME
 * delay**, derived by collecting what the adopters passed and checking the set
 * has exactly one member.
 *
 * The value is compared to `NODE_TOOLTIP_DELAY_MS` — the SYMBOL, never a literal
 * `300` — so a deliberate re-tune of the shared beat moves every adopter and this
 * guard together, exactly as it should.
 *
 * ⚠⚠ AND PARITY IS NOT PROVENANCE — THE FIRST ATTEMPT AT THAT SECOND CLAIM WAS
 * ITSELF VACUOUS. A case named *"and that delay is NODE_TOOLTIP_DELAY_MS, not a
 * repeated literal"* asserted `expect(first).toBe(NODE_TOOLTIP_DELAY_MS)` where
 * `first` was the RUNTIME delay an adopter passed — i.e. `Object.is(300, 300)`,
 * green whether the adopter wrote the symbol or the literal. It is replaced by a
 * SOURCE-level claim, because provenance is a fact about what is written, not
 * about what arrives. The replacement's discriminating pair is recorded on the
 * case itself. Note the shape of the mistake: a guard written to replace a
 * value-assertion reproduced a value-assertion one level down.
 *
 * ⚠ NO TIMERS ARE INVOLVED, DELIBERATELY. The obvious alternative — advance fake
 * timers and watch when each bubble appears — measures the same property through
 * floating-ui's async positioning, which is load-sensitive. This lane's machine
 * was at load 320+ on 10 cores; a timing assertion there reports the runner, not
 * the code. Reading the prop is deterministic.
 *
 * ⚠ ITS SCOPE, STATED RATHER THAN IMPLIED. This guards the delay parity of the
 * NAMED adopters below. It is NOT an enumeration of every `<Tooltip>` under
 * `src/canvas/nodes` — a glyph converted by some later lane is outside it until
 * added here. That limit is deliberate: binding this to a directory sweep is
 * what made the `title=` inventory a cross-lane landmine (see
 * `nodeIconTooltipInventory.spec.ts`), and a guard that reds in a sibling's PR
 * for something the sibling did correctly gets deleted, not obeyed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Hoisted so the `vi.mock` factory — which is lifted above every import — can
 * reach it without a TDZ error.
 */
const spy = vi.hoisted(() => ({ calls: [] as Array<{ delay: unknown }> }))

vi.mock('../../../../components/Tooltip', () => ({
  default: (props: { children?: unknown; delay?: unknown }) => {
    spy.calls.push({ delay: props.delay })
    return props.children as ReactElement
  },
}))

import { BriefIcon } from '../BriefIcon'
import { NodeProvenanceMark } from '../NodeProvenanceMark'
import { NODE_TOOLTIP_DELAY_MS } from '../nodeTooltip'

/**
 * The glyphs this lane converted, each in a state that RENDERS, and each
 * carrying THE FILE IT IS DEFINED IN.
 *
 * ⚠ `NodeProvenanceMark` returns `null` for a provenance literal it does not
 * recognise, so a fixture typo would mount nothing, capture nothing, and leave
 * a one-element set that agrees with itself. `mounts exactly one Tooltip` below
 * is the precondition that makes that impossible to miss.
 *
 * ⭐ THE THIRD COLUMN IS WHY THIS TABLE, AND NOT A SECOND LIST, DRIVES THE
 * PROVENANCE CLAIM. `nodeIconTooltipInventory.spec.ts` asserts the same
 * source-level property over its OWN hand-written `ADOPTERS` path list. Two
 * lists naming the same glyphs is the hand-maintained mirror this estate keeps
 * paying for: a lane adding a third adopter to the runtime table here and
 * forgetting the inventory's list would be unguarded there and would never know.
 * Binding the source path to the SAME row as the rendered element makes that
 * drift impossible within this file — a new adopter cannot join the parity
 * claim without also supplying the file its provenance is read from.
 */
const ADOPTERS: Array<[string, ReactElement, string]> = [
  ['BriefIcon', <BriefIcon key="b" />, 'BriefIcon.tsx'],
  [
    'NodeProvenanceMark',
    <NodeProvenanceMark key="p" nodeType="option" data={{ label: 'Rebuild', type: 'option', provenance: 'ai_inferred' }} />,
    'NodeProvenanceMark.tsx',
  ],
]

/** `src/canvas/nodes/shared`, resolved from the runner's cwd. */
const SHARED_ROOT = join(process.cwd(), 'src', 'canvas', 'nodes', 'shared')

/**
 * Remove `/* *\/` and `//` runs so PROSE about a delay never counts as one.
 *
 * ⚠ Not imported from `nodeIconTooltipInventory.spec.ts`, which exports an
 * identical scanner: importing a spec module re-registers its `describe` blocks
 * inside this file's suite, so the two files would each report the other's
 * tests. Duplicated deliberately, and made trustworthy the same way that file
 * makes it trustworthy — by a control below with a known answer, not by
 * inspection.
 */
function stripComments(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    if (source[i] === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end < 0 ? source.length : end + 2
      continue
    }
    if (source[i] === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i)
      i = end < 0 ? source.length : end
      continue
    }
    out += source[i]
    i += 1
  }
  return out
}

function delayPassedBy(element: ReactElement): unknown[] {
  spy.calls = []
  render(element)
  return spy.calls.map((c) => c.delay)
}

describe('node tooltip delay parity', () => {
  beforeEach(() => {
    spy.calls = []
  })

  /**
   * ⛔ THE PRECONDITION. Without it every assertion below is satisfiable by an
   * adopter that renders nothing: no Tooltip, no captured delay, an empty set —
   * and an empty set trivially fails the size check, but a SINGLE adopter
   * mounting while the other renders null would still leave one value and pass
   * the parity claim while measuring one glyph. This pins that each named
   * adopter actually mounted, by name.
   */
  it.each(ADOPTERS)('%s mounts exactly one Tooltip', (_name, element) => {
    expect(delayPassedBy(element)).toHaveLength(1)
  })

  /**
   * ⭐ THE PROPERTY. Derived from the adopters: whatever they pass, they must
   * all pass the SAME thing. A divergent adopter reds here; a deliberate change
   * to the shared constant does not, because nothing in this case names a value.
   */
  it('every adopter resolves to one and the same delay', () => {
    const delays = ADOPTERS.map(([name, element]) => {
      const passed = delayPassedBy(element)
      expect(passed, `${name} passed no delay to Tooltip`).toHaveLength(1)
      return passed[0]
    })
    expect(delays).toHaveLength(ADOPTERS.length)
    expect(new Set(delays).size, `adopters disagree on the hover delay: ${JSON.stringify(delays)}`).toBe(1)
  })

  /**
   * ⛔⛔ THE CASE THAT USED TO SIT HERE COULD NOT SEE ITS OWN NAME.
   *
   * It was:
   *
   *     const [first] = ADOPTERS.map(([, element]) => delayPassedBy(element)[0])
   *     expect(first).toBe(NODE_TOOLTIP_DELAY_MS)
   *
   * `first` is the delay an adopter passed AT RUNTIME — the number 300. The
   * right-hand side is the constant — the number 300. So the whole assertion was
   * `Object.is(300, 300)`, and it is TRUE whether the adopter wrote
   * `delay={NODE_TOOLTIP_DELAY_MS}` or `delay={300}`. It therefore passed on
   * precisely the regression its name promises to catch, while its own doc
   * comment claimed it "binds them to the module the constant lives in". A
   * runtime value carries no provenance: by the time the prop arrives, the
   * symbol and the literal are the same number.
   *
   * ⭐ PROVENANCE IS A FACT ABOUT THE SOURCE, SO THE SOURCE IS WHAT IS READ.
   * Every `delay={...}` an adopter passes must be spelled `NODE_TOOLTIP_DELAY_MS`.
   * Change one adopter to the literal `300` — same value, wrong provenance — and
   * this REDs, which is the entire property the name claims. Move the constant to
   * 250 with every adopter still referencing it and this stays GREEN, because
   * nothing here names a value. Both arms were measured, not asserted.
   *
   * ⚠ ITS PRECONDITIONS, IN-TEST, BECAUSE A SOURCE READ IS AN ABSENCE PROBE.
   * A wrong `SHARED_ROOT`, a renamed adopter, or a comment-stripper that ate the
   * file would each leave zero `delay=` matches — and a `for` loop over an empty
   * list passes without asserting anything. The non-empty read and the
   * `toBeGreaterThan(0)` below are what stop this becoming the vacuity it
   * replaces.
   */
  it.each(ADOPTERS)('%s spells its delay NODE_TOOLTIP_DELAY_MS, not a bare literal', (name, _element, file) => {
    const path = join(SHARED_ROOT, file)
    expect(existsSync(path), `${name}: adopter source not found at ${path}`).toBe(true)

    const code = stripComments(readFileSync(path, 'utf8'))
    expect(code.length, `${name}: source read empty — the probe is pointed at nothing`).toBeGreaterThan(0)

    const delays = code.match(/delay=\{[^}]*\}/g) ?? []
    expect(delays.length, `${name}: passes no delay= at all, so nothing was checked`).toBeGreaterThan(0)
    for (const passed of delays) {
      expect(passed, `${name}: delay must reference the shared symbol, not a literal of the same value`).toBe(
        'delay={NODE_TOOLTIP_DELAY_MS}',
      )
    }
  })

  /**
   * ⭐ THE STRIPPER DISCRIMINATES. Without this it could return its input
   * unchanged — or everything — and the case above would still look reasonable
   * while reading prose ABOUT a delay as a delay, or reading nothing at all.
   * A known fixture with a known answer, in both directions.
   */
  it('strips a comment-only delay, and keeps a real one', () => {
    const fixture = [
      '/** doc: this used to be delay={300} before the shared beat */',
      '// inline: another delay={300} mention',
      '<Tooltip delay={NODE_TOOLTIP_DELAY_MS}>',
    ].join('\n')
    expect((fixture.match(/delay=\{[^}]*\}/g) ?? []).length).toBe(3)
    expect((stripComments(fixture).match(/delay=\{[^}]*\}/g) ?? []).length).toBe(1)
  })

  /**
   * ⚠ AND THE SHARED SYMBOL IS A NUMBER. Kept from the replaced case: it is the
   * one claim there that was not vacuous, since a string `'300'` would satisfy
   * the parity set above and silently reach floating-ui's `delay`.
   */
  it('the shared constant is a number', () => {
    expect(typeof NODE_TOOLTIP_DELAY_MS).toBe('number')
  })
})
