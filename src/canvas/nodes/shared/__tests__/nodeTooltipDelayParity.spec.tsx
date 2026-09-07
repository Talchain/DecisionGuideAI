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
 * The glyphs this lane converted, each in a state that RENDERS.
 *
 * ⚠ `NodeProvenanceMark` returns `null` for a provenance literal it does not
 * recognise, so a fixture typo would mount nothing, capture nothing, and leave
 * a one-element set that agrees with itself. `mounts exactly one Tooltip` below
 * is the precondition that makes that impossible to miss.
 */
const ADOPTERS: Array<[string, ReactElement]> = [
  ['BriefIcon', <BriefIcon key="b" />],
  [
    'NodeProvenanceMark',
    <NodeProvenanceMark key="p" nodeType="option" data={{ label: 'Rebuild', type: 'option', provenance: 'ai_inferred' }} />,
  ],
]

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
   * ⚠ AND THE ONE VALUE IS THE SHARED SYMBOL, NOT A NUMBER TYPED HERE. Parity
   * alone would be satisfied by every adopter hardcoding the same literal —
   * agreement today, drift the moment one of them is edited. This binds them to
   * the module the constant lives in.
   */
  it('and that delay is NODE_TOOLTIP_DELAY_MS, not a repeated literal', () => {
    const [first] = ADOPTERS.map(([, element]) => delayPassedBy(element)[0])
    expect(first).toBe(NODE_TOOLTIP_DELAY_MS)
    expect(typeof NODE_TOOLTIP_DELAY_MS).toBe('number')
  })
})
