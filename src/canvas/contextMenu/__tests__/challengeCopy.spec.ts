/**
 * Challenge — which node kinds can be argued with, and what the argument says.
 *
 * ── THE GAP THIS PINS ────────────────────────────────────────────────
 *
 * Measured across all eight node kinds on deployed staging `80ccf768`:
 * factor, goal, risk and outcome carried `ask · challenge · inspect · menu`,
 * while decision and option carried only `ask · inspect · menu`. So the product
 * would not let a team argue with the QUESTION it is answering, or with the
 * CHOICES on the table — the two nodes a strategy team most wants to contest.
 * Olumi is the strategic reasoning layer; challenge is the coaching capability,
 * not decoration.
 *
 * ── WHY THE GATE LIVES IN THE PRODUCER, AND WHY THAT IS THE WHOLE POINT ──
 *
 * `NodeQuickActions` deliberately DERIVES its hover control from the menu's own
 * gate rather than mirroring it, so a kind cannot join one surface and miss the
 * other. That design is right and is preserved — but it was derived from
 * `FULL_MENU_KINDS`, which gates FOUR unrelated things (Challenge, Explore,
 * Set value, Mark as assumption). Widening that Set to reach challenge would
 * have handed a Question node "Set to the upper bound of this factor's range",
 * a control that is nonsense for a kind with no range.
 *
 * So challenge gets its OWN set, `CHALLENGE_KINDS`, and it lives beside the
 * copy in `actions.ts` because they are one fact: a kind is challengeable
 * exactly when this file can produce a challenge for it. The old docblock's
 * claim — "the menu builds no challenge prompt for them, so a control here
 * would open nothing" — was a statement about the producer, held in a consumer,
 * where nothing could keep it true.
 *
 * ── WHAT IS ASSERTED, AND WHY EACH CASE EXISTS ───────────────────────
 *
 * 1. BOUND BY KIND, NEVER BY A PREDICATE ANOTHER KIND SATISFIES. Every copy
 *    case names its kind and asserts a phrase only that kind's sentence
 *    contains — so a producer that ignored `nodeType` and returned one string
 *    for everything REDs, rather than passing on a substring three kinds share.
 * 2. THE THREE NEW SENTENCES ARE MUTUALLY DISTINCT. Without this, a copy table
 *    that resolved every new kind to the same entry would pass case 1.
 * 3. THE FOUR SHIPPED KINDS KEEP THEIR WITNESSED COPY, byte for byte. This
 *    change may not silently reword what four kinds already say on staging.
 * 4. THE SET IS PINNED IN BOTH DIRECTIONS. `action` is excluded, so an
 *    "everything is challengeable" mutant cannot pass.
 */
import { describe, it, expect } from 'vitest'
import {
  buildAskAIPrompt,
  buildChallengeTooltip,
  CHALLENGE_KINDS,
} from '../actions'
import type { NodeTarget } from '../types'
import type { NodeType } from '../../domain/nodes'

function nodeTarget(nodeType: NodeType, label: string): NodeTarget {
  return {
    kind: 'node',
    nodeId: `n-${nodeType}`,
    nodeType,
    // Typed via `NodeTarget` itself rather than by importing reactflow's `Node`
    // — the typecheck gate cannot resolve `reactflow` from this project, and
    // deriving the shape from the interface under test is the better binding
    // anyway.
    node: {
      id: `n-${nodeType}`,
      type: nodeType,
      position: { x: 0, y: 0 },
      data: { label, kind: nodeType },
    } as NodeTarget['node'],
    screenPos: { x: 0, y: 0 },
  }
}

function challengeFor(nodeType: NodeType, label: string): string {
  return buildAskAIPrompt(nodeTarget(nodeType, label), 'challenge_element')
}

describe('CHALLENGE_KINDS — the question and the choices can be argued with', () => {
  it.each(['decision', 'option', 'constraint'] as const)(
    'admits %s, the kinds staging withheld',
    (kind) => {
      expect(CHALLENGE_KINDS.has(kind)).toBe(true)
    },
  )

  it.each(['factor', 'risk', 'outcome', 'goal'] as const)(
    'keeps %s, which already shipped',
    (kind) => {
      expect(CHALLENGE_KINDS.has(kind)).toBe(true)
    },
  )

  /**
   * The negative half. Without it, every case above passes on a Set that
   * admits everything — the gate would have stopped discriminating and no
   * assertion here would notice.
   *
   * `action` is in `NodeTypeEnum` but absent from `NODE_TYPE_ITEMS` (the six
   * user-creatable kinds) and its schema is the base plus a type literal.
   * Scope, stated rather than hidden: whether CEE ever emits an `action` node
   * was NOT verified. It is excluded because nothing established that it is
   * reachable, not because it was shown to be unreachable.
   */
  it('does NOT admit action, so the gate still discriminates', () => {
    expect(CHALLENGE_KINDS.has('action' as NodeType)).toBe(false)
  })
})

describe('challenge copy — true for the kind it is shown on', () => {
  /**
   * THE LOAD-BEARING CASE FOR THE QUESTION NODE. The user-facing word is
   * "Question", not "Decision" (`DECISION_NODE_LABEL`, retired 31 Aug), so the
   * sentence argues with the FRAMING. "Framed" appears in no other kind's copy,
   * which is what binds this assertion to `decision` rather than to whichever
   * string the producer happened to return.
   */
  it('argues with the FRAMING for a decision — the question itself', () => {
    const prompt = challengeFor('decision', 'Should we expand into Germany?')

    expect(prompt).toContain('Should we expand into Germany?')
    expect(prompt).toContain('framed')
    expect(prompt).toContain('right thing to be working out')
    // Not the generic fallback, which is what a kind-blind producer returns.
    expect(prompt).not.toContain('the current setup of')
  })

  it('argues against the CHOICE for an option, and asks what is missing', () => {
    const prompt = challengeFor('option', 'Enter via partnership')

    expect(prompt).toContain('Enter via partnership')
    expect(prompt).toContain('worse choice than it looks')
    expect(prompt).toContain('alternative is missing')
    expect(prompt).not.toContain('the current setup of')
  })

  it('argues the LEVEL and the negotiability for a constraint', () => {
    const prompt = challengeFor('constraint', 'Budget cap of £2m')

    expect(prompt).toContain('Budget cap of £2m')
    expect(prompt).toContain('set at the right level')
    expect(prompt).toContain('who could relax it')
    expect(prompt).not.toContain('the current setup of')
  })

  /**
   * Case 2. Every sentence above contains its own label and the word
   * "Challenge", so a table that collapsed all three onto one entry would still
   * satisfy the label assertions. This is the case that REDs on that.
   */
  it('gives the three new kinds three DIFFERENT sentences', () => {
    const decision = challengeFor('decision', 'Same label')
    const option = challengeFor('option', 'Same label')
    const constraint = challengeFor('constraint', 'Same label')

    expect(new Set([decision, option, constraint]).size).toBe(3)
  })

  /**
   * Case 3. The four kinds that already ship keep their exact witnessed
   * sentence. A reword here would change copy on deployed surfaces that this
   * lane has no mandate to touch — so the string is pinned literally, which is
   * the one place a literal is correct: it IS the thing being protected.
   */
  it.each(['factor', 'risk', 'outcome', 'goal'] as const)(
    'leaves the shipped %s sentence exactly as staging serves it',
    (kind) => {
      expect(challengeFor(kind, 'Hiring spend')).toBe(
        'Challenge the current setup of "Hiring spend". What could be wrong or missing?',
      )
    },
  )

  it('still falls back to the generic sentence for a node with no label', () => {
    const target = nodeTarget('factor', '')
    ;(target.node.data as { label?: unknown }).label = undefined

    expect(buildAskAIPrompt(target, 'challenge_element')).toBe(
      'Challenge the current setup of "this element". What could be wrong or missing?',
    )
  })
})

describe('challenge tooltip — the menu label must be true for the kind', () => {
  /**
   * The shipped menu tooltip is one fixed string: "Ask AI to argue against this
   * element's current setup". It reads fine for a factor. It is not true of a
   * Question — a question has no "setup" to argue against, it has a framing —
   * and it is limp for an option. The tooltip therefore comes from the same
   * producer as the prompt, so one edit moves both and neither can drift.
   */
  it('tells a decision node the argument is about the question being asked', () => {
    const tooltip = buildChallengeTooltip('decision')

    expect(tooltip).toBe('Ask AI to argue this is the wrong question to be asking')
    expect(tooltip).not.toContain('current setup')
  })

  it('names the option for an option node', () => {
    expect(buildChallengeTooltip('option')).toBe('Ask AI to argue against this option')
  })

  it('offers negotiability for a constraint node', () => {
    expect(buildChallengeTooltip('constraint')).toBe(
      'Ask AI to argue this constraint is wrong or negotiable',
    )
  })

  it.each(['factor', 'risk', 'outcome', 'goal'] as const)(
    'leaves the shipped %s tooltip untouched',
    (kind) => {
      expect(buildChallengeTooltip(kind)).toBe(
        "Ask AI to argue against this element's current setup",
      )
    },
  )
})
