/**
 * Z2 — the `action` card stops rendering a blank box below the legibility floor.
 *
 * WHAT WAS ON SCREEN. `action` was the one node type with no reduced line at
 * all: `resolveLodMetricLine` fell through to `default: return null`, and its
 * comment recorded that as deliberate ("genuinely NOT ATTEMPTED", trap 20 — an
 * honest unknown, correctly not generalised into a claim that action had
 * nothing to say). Below 0.5 the body is hidden, so an action card rendered its
 * coloured shape, its title, and nothing else. On the whole-model view — where
 * every shipped starter parks, between 0.26 and 0.38 — that is a box.
 *
 * WHY `description` IS THE RIGHT DATUM, VERIFIED AT THE BYTES BEFORE IT WAS
 * WRITTEN. `ActionNode.tsx:12-16` renders `props.data.description` as the card's
 * entire body, and passes NO `lodMetric` prop. Both halves matter:
 *
 *   · it is the very string the card shows one zoom step up, which is the rule
 *     this module already follows for factor and option — the reduced line is a
 *     shortening of what is there, never a second, differently-derived fact;
 *   · `action` has no owning component for its line, so unlike risk, outcome,
 *     goal and decision (each of which formats its own line and passes it as
 *     `lodMetric`, where it WINS over this resolver), a `case` here is REACHED.
 *     A `case 'risk'` added to this file would be dead code with a green unit
 *     spec — the trap recorded at `lodMetricLine.ts:94-121`. This is the
 *     distinction that makes `action` different, and it was confirmed at the
 *     bytes rather than assumed.
 *
 * THE ADDITIVE RULE THIS MODULE ALREADY DECLARES IS PRESERVED: this arm is
 * reached only where the old one returned `null`, so no card that was already
 * speaking can change. The opposite-direction twin (CLAUDE.md trap 22b) is the
 * `action` case that must still withhold — absent, blank and whitespace-only
 * descriptions — and all three are below, because "shows the description" and
 * "never shows an empty line" are two claims, not one.
 */
import { describe, it, expect } from 'vitest'
import { resolveLodMetricLine } from '../lodMetricLine'
import type { NodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'

/** The neutral metadata an action card resolves under; it reads none of it. */
const NO_METADATA = {} as NodeDisplayMetadata

const resolveAction = (data: Record<string, unknown> | undefined) =>
  resolveLodMetricLine({
    nodeType: 'action',
    data,
    label: 'Ship the pilot',
    displayMetadata: NO_METADATA,
  })

describe('resolveLodMetricLine — action', () => {
  it('speaks the description when there is one', () => {
    expect(
      resolveAction({ label: 'Ship the pilot', type: 'action', description: 'Run a 4-week beta' }),
    ).toBe('Run a 4-week beta')
  })

  it('takes the FIRST line of a multi-line description, trimmed', () => {
    // One line is the whole affordance — the reduced line is absolutely
    // positioned inside a hidden body and must not grow the card's box. A
    // description pasted from a brief routinely carries newlines.
    expect(
      resolveAction({
        type: 'action',
        description: '  Run a 4-week beta  \nThen review with the steering group\n',
      }),
    ).toBe('Run a 4-week beta')
  })

  it('withholds when there is no description — never an empty line', () => {
    expect(resolveAction({ label: 'Ship the pilot', type: 'action' })).toBeNull()
  })

  it('withholds on a whitespace-only description', () => {
    // The shape that turns "shows the description" into a blank line with a
    // testid: present, truthy after a `!= null` check, and empty on screen.
    expect(resolveAction({ type: 'action', description: '   \n  \t ' })).toBeNull()
  })

  it('withholds on an empty string, and on a non-string description', () => {
    expect(resolveAction({ type: 'action', description: '' })).toBeNull()
    expect(resolveAction({ type: 'action', description: 42 })).toBeNull()
    expect(resolveAction({ type: 'action', description: null })).toBeNull()
  })

  it('withholds when the node has no data at all', () => {
    expect(resolveAction(undefined)).toBeNull()
  })

  it('CONTRAST — a type whose line is owned elsewhere is still not resolved here', () => {
    // The discrimination that proves this file is testing the `action` ARM and
    // not merely "the resolver returns something for a description". `risk`
    // carries the identical `description` and must stay null here, because its
    // line is declared by `RiskNode` through `lodMetric`. If a future edit
    // widened the new arm to read `description` for every type, the tests above
    // would all still pass and this one would red.
    expect(
      resolveLodMetricLine({
        nodeType: 'risk',
        data: { type: 'risk', description: 'Run a 4-week beta' },
        label: 'Supplier fails',
        displayMetadata: NO_METADATA,
      }),
    ).toBeNull()
  })
})
