/**
 * The frontier's prompts read the model — and stop short of judging it.
 *
 * These were fixed sentences ("Suggest an additional option I haven't
 * considered for this decision") that would read identically in any product,
 * about any decision. The door already knows which siblings it stands beside,
 * so naming them costs a string join and turns a generic ask into one that
 * could only have been asked about THIS model.
 *
 * ⚠ THE LINE THIS FILE GUARDS. Specificity about STRUCTURE is free and needs no
 * producer. Assessment of QUALITY — "your options are too similar", "this
 * framing is weak" — is a reasoning judgement: it needs the science behind it,
 * it belongs to the producer, and a UI that mints one becomes a second
 * authority on what good reasoning looks like. Every assertion below is about
 * keeping the prompts on the free side of that line while making them specific.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Node } from '@xyflow/react'
import {
  GHOST_TIERS,
  GHOST_OPTION_NODE_ID,
  withGhostTiers,
  listForPrompt,
  ghostOptionPrompt,
} from '../ghostTiers'
import { DECISION_NODE_LABEL, GOAL_NODE_LABEL } from '../../domain/vocabulary'

const n = (id: string, type: string, label: string): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: { label, type } }) as Node

const MODEL: Node[] = [
  n('d1', 'decision', 'Replace our customer data platform before the March renewal'),
  n('o1', 'option', 'Segment'),
  n('o2', 'option', 'RudderStack'),
  n('o3', 'option', 'Stay on the current CDP'),
  n('f1', 'factor', 'Annual platform cost'),
  n('r1', 'risk', 'Budget overrun'),
  n('u1', 'outcome', 'Migration completed before renewal'),
]

/**
 * ⭐⭐ THE PROMPT A DOOR ACTUALLY SENDS, ROUTED THE WAY THE CANVAS ROUTES IT.
 *
 * ⚠ THIS HELPER USED TO CALL `withGhostTiers(nodes)` WITH THE DEFAULT SET, AND
 * ITS `'option'` ASSERTIONS WERE THEREFORE GREEN ABOUT A DOOR THE CANVAS NEVER
 * BUILDS. `ReactFlowGraph.tsx` filters the option tier OUT of the set it hands
 * `withGhostTiers` (`tierGhosts`), because the option door is the legacy
 * `ghost-option` node whose position is derived from the rightmost option — so
 * every assertion here about `GHOST_TIERS`' option prompt was passing on a node
 * that only this file constructed, while the deployed door sent a hardcoded
 * sentence this suite could not see. The estate's signature test defect: a spec
 * bound to a component the deployment does not render.
 *
 * The dispatch below is the mount's, restated once. The option tier resolves to
 * `ghostOptionPrompt` — the same function the mount calls, asserted at the
 * mount's own bytes in the last describe of this file — and every other tier
 * resolves through `withGhostTiers` with the option tier excluded, exactly as
 * `tierGhosts` does.
 */
const CANVAS_TIER_DOORS = GHOST_TIERS.filter(t => t.id !== GHOST_OPTION_NODE_ID)

const promptFor = (nodes: Node[], tier: string): string => {
  // ⚠ BY ID, NEVER BY `siblingType`. The tier table is the thing under test;
  // resolving the door through the table's own `tier` data field would let a
  // wrongly-labelled node satisfy the lookup.
  const definition = GHOST_TIERS.find(t => t.siblingType === tier)
  if (!definition) throw new Error(`no tier defined for sibling type "${tier}"`)
  if (definition.id === GHOST_OPTION_NODE_ID) return ghostOptionPrompt(nodes)

  const out = withGhostTiers(nodes, CANVAS_TIER_DOORS)
  const ghost = out.find(g => g.id === definition.id)
  return String((ghost?.data as { prompt?: string })?.prompt ?? '')
}

describe('frontier prompts — built from the model', () => {
  it('names the options that exist', () => {
    const p = promptFor(MODEL, 'option')
    expect(p).toContain('Segment')
    expect(p).toContain('RudderStack')
    expect(p).toContain('Stay on the current CDP')
  })

  it('carries the subject, so the question is about THIS decision', () => {
    expect(promptFor(MODEL, 'option')).toContain('Replace our customer data platform')
  })

  it('omits the subject clause entirely when the graph carries none — never a guess', () => {
    const noSubject = MODEL.filter(x => x.type !== 'decision')
    const p = promptFor(noSubject, 'option')
    expect(p).toContain('Segment')
    // ⚠ BOTH NOUNS, DERIVED. This assertion used to read `/The decision is:/`,
    // a literal that stopped matching anything the moment the clause learned to
    // say "question" or "goal" — an absence test that passes by testing nothing
    // is the decay this estate keeps paying for. It now excludes every noun the
    // clause can emit, spelled by the product rather than by this file.
    expect(p).not.toMatch(new RegExp(`The ${DECISION_NODE_LABEL} is:`, 'i'))
    expect(p).not.toMatch(new RegExp(`The ${GOAL_NODE_LABEL} is:`, 'i'))
    // POSITIVE CONTROL: the same probe finds the clause when there IS a subject.
    expect(promptFor(MODEL, 'option')).toMatch(
      new RegExp(`The ${DECISION_NODE_LABEL} is:`, 'i'),
    )
  })

  it('⛔ ASSERTS NOTHING ABOUT QUALITY — the producer owns that judgement', () => {
    // The whole reason this component needs no producer. If a prompt ever says
    // the options are similar, narrow, weak or insufficient, it has crossed
    // from stating what is there to assessing it.
    const JUDGEMENT = /\b(too similar|too narrow|weak|insufficient|poor|lacking|should have|missing a|need more)\b/i
    for (const tier of GHOST_TIERS) {
      const p = promptFor(MODEL, tier.siblingType)
      expect(p, `"${tier.label}" prompt makes an assessment: "${p}"`).not.toMatch(JUDGEMENT)
    }
  })

  it('every tier asks a QUESTION rather than instructing an insertion', () => {
    // A ghost that told Olumi to add something would make the AI the author.
    for (const tier of GHOST_TIERS) {
      const p = promptFor(MODEL, tier.siblingType)
      expect(p, `"${tier.label}" does not ask anything`).toContain('?')
      expect(p).not.toMatch(/^\s*(add|insert|create) /i)
    }
  })

  it('an unlabelled node never reaches the prompt as a placeholder', () => {
    // Describing a nameless node back to the user as "Untitled" would put a
    // thing in the prompt that is not in their model.
    const withBlank = [...MODEL, n('o4', 'option', '   ')]
    const p = promptFor(withBlank, 'option')
    expect(p).not.toMatch(/untitled|unnamed|\bnull\b|undefined/i)
    expect(p).toContain('Segment')
  })

  it('caps a long list and SAYS how many it left out', () => {
    // A list that stopped without saying so would misrepresent the model to
    // Olumi — the same honesty rule the canvas applies to the user.
    const many = Array.from({ length: 12 }, (_, i) => `Option ${i + 1}`)
    const joined = listForPrompt(many)
    expect(joined).toContain('Option 8')
    expect(joined).not.toContain('Option 9')
    expect(joined).toContain('and 4 more')
  })

  it('short lists carry no remainder clause', () => {
    expect(listForPrompt(['A', 'B'])).toBe('A, B')
  })

  it('still places no door on a tier with no members', () => {
    // Unchanged by this work, and re-pinned because the prompt builder now runs
    // per tier: a door on an empty tier would assert the tier OUGHT to have
    // members, which is the judgement line again.
    const noRisks = MODEL.filter(x => x.type !== 'risk')
    expect(promptFor(noRisks, 'risk')).toBe('')
  })
})

/**
 * ⭐ THE CASES AN INDEPENDENT REVIEW FOUND BY EXECUTING THE MODULE, after every
 * assertion above passed.
 *
 * The block above has a case for an unnamed node. It uses `'   '` — whitespace,
 * which is the representation I IMAGINED. The producers write the literal
 * `'Untitled'`: the CEE patch-apply path (`applyPatch.ts:82`, the primary draft
 * journey), `persist.ts:35/43`, `migrations.ts:121`, `store.ts:6112/6212`. So
 * the guard was correct, was pointed at the wrong bytes, and the spec agreed
 * with it — CLAUDE.md trap 16-inverse: a fixture you wrote yourself is not
 * evidence about the wire.
 *
 * Every fixture below uses the producers' own literal, imported from the
 * constant they all derive from rather than re-spelled here.
 */
describe('the prompt tells Olumi the truth about the model — the producer-derived cases', () => {
  const UNTITLED = 'Untitled' // === UNNAMED_ELEMENT_LABEL; see elementLabel.ts

  it('does not pass the producer\'s placeholder off as a name', () => {
    const allUnnamed = [
      n('d1', 'decision', 'Replace our CDP'),
      n('o1', 'option', UNTITLED),
      n('o2', 'option', UNTITLED),
      n('o3', 'option', UNTITLED),
    ]
    const p = promptFor(allUnnamed, 'option')
    expect(p).not.toMatch(/untitled|unnamed|\bnull\b|undefined/i)
  })

  it('says how many there are when it cannot say what they are called', () => {
    // The defect: labels were filtered AFTER the door gate, and the surviving
    // list was interpolated into "These are the options currently in my model:
    // {list}." With no names that rendered an EMPTY list — telling Olumi, in
    // the user's own transcript and under the user's own name, that a model
    // with three options had none.
    const allUnnamed = [
      n('d1', 'decision', 'Replace our CDP'),
      n('o1', 'option', UNTITLED),
      n('o2', 'option', UNTITLED),
      n('o3', 'option', UNTITLED),
    ]
    const p = promptFor(allUnnamed, 'option')
    expect(p).toContain('3 options')
    expect(p).not.toMatch(/model:\s*\./)
  })

  it('reports the whole tier when only some of it is named — not just the named part', () => {
    // Worse than the empty case because it is plausible: three options, one
    // named, and Olumi reasons about a one-option model without any signal
    // that it is looking at a third of the board.
    const partly = [
      n('d1', 'decision', 'Replace our CDP'),
      n('o1', 'option', 'Segment'),
      n('o2', 'option', UNTITLED),
      n('o3', 'option', UNTITLED),
    ]
    const p = promptFor(partly, 'option')
    expect(p).toContain('Segment')
    expect(p).toContain('3 options')
    expect(p).toContain('other 2')
  })

  it('DISCRIMINATION: two models that differ only in size do not produce identical copy', () => {
    // This is the assertion the whole feature rests on. The frontier exists
    // because "a generic prompt is a wasted click" — and on the unnamed path
    // the old copy was byte-identical for one risk and for three, degrading
    // into furniture on exactly the sparse early model it is meant to serve.
    const one = [n('d1', 'decision', 'Acquire Acme'), n('r1', 'risk', UNTITLED)]
    const three = [
      n('d1', 'decision', 'Acquire Acme'),
      n('r1', 'risk', UNTITLED),
      n('r2', 'risk', UNTITLED),
      n('r3', 'risk', UNTITLED),
    ]
    const a = promptFor(one, 'risk')
    const b = promptFor(three, 'risk')
    expect(a).not.toBe(b)
    expect(a).toContain('1 risk')
    expect(b).toContain('3 risks')
  })

  it('the honesty rule applies to the FILTER as well as to the cap', () => {
    // The cap says "(and N more)". The filter used to say nothing at all, and
    // both drop members from the same sentence for the same reason.
    const nine = Array.from({ length: 9 }, (_, i) =>
      n(`f${i}`, 'factor', i === 0 ? UNTITLED : `Factor ${i}`),
    )
    const p = promptFor([n('d1', 'decision', 'Acquire Acme'), ...nine], 'factor')
    expect(p).toContain('9 factors')
    expect(p).toContain('other 1 is not named')
  })

  it('a subject that ends in punctuation does not get a second terminator', () => {
    // Non-blocking, but this string lands in the user's own transcript:
    // "The decision is: Acquire Acme?." was visible to them.
    const p = promptFor([n('d1', 'decision', 'Acquire Acme?'), n('o1', 'option', 'Buy')], 'option')
    expect(p).toContain('Acquire Acme?')
    expect(p).not.toContain('Acme?.')
  })
})

/**
 * ⭐⭐ THE OPTION DOOR, AT THE PATH THE CANVAS ACTUALLY TAKES.
 *
 * Everything above now routes the option tier through `ghostOptionPrompt`. That
 * is only worth anything if the MOUNT calls it too — otherwise this file has
 * simply moved its green from one unreached path to another. The block below is
 * the binding, and it is deliberately two different kinds of evidence:
 *
 *   · `ghostOptionPrompt` composes from the model             (executed here)
 *   · `ReactFlowGraph` hands that sentence to the ghost node  (read at the mount)
 *   · `GhostOptionNode` sends what it was handed              (rendered and
 *      clicked in `nodes/__tests__/GhostOptionNode.prompt.spec.tsx`)
 *
 * The middle link is source text because the mount is a 2,700-line component
 * with a live React Flow canvas inside it; the two links either side are
 * executed, so the static one carries only the join.
 */
describe('the legacy option door composes from the same tier table as every other door', () => {
  it('IDENTITY: the sentence is the option TIER\'s, not a second one written for this door', () => {
    // The defect being closed is precisely that there were two sentences for
    // one door. Bound to the tier by ID so a reordering of `GHOST_TIERS` cannot
    // quietly point this at a different tier's prompt.
    const optionTier = GHOST_TIERS.find(t => t.id === GHOST_OPTION_NODE_ID)
    expect(optionTier, 'GHOST_TIERS carries no option tier').toBeTruthy()
    expect(ghostOptionPrompt(MODEL)).toBe(
      optionTier!.prompt({
        namedSiblings: ['Segment', 'RudderStack', 'Stay on the current CDP'],
        siblingCount: 3,
        subject: {
          label: 'Replace our customer data platform before the March renewal',
          noun: DECISION_NODE_LABEL.toLowerCase(),
        },
      }),
    )
  })

  it('agrees with `withGhostTiers` when the option tier is routed through it', () => {
    // The two paths to the same door's sentence must not diverge — a door whose
    // copy depends on which code path built it is the two-`generateGraphHash`
    // shape in a user-visible string.
    const optionTier = GHOST_TIERS.find(t => t.id === GHOST_OPTION_NODE_ID)!
    const viaTiers = withGhostTiers(MODEL, [optionTier]).find(g => g.id === GHOST_OPTION_NODE_ID)
    expect((viaTiers?.data as { prompt?: string })?.prompt).toBe(ghostOptionPrompt(MODEL))
  })

  it('places NO sentence on a model with no options — the empty-tier rule, applied to this door too', () => {
    // `withGhostTiers` refuses a door on an empty tier because it would assert
    // the tier OUGHT to have members. The mount refuses the option ghost for the
    // same reason (it also has nowhere to sit). This keeps the composer from
    // being the one place that would happily say "My model has 0 options".
    const noOptions = MODEL.filter(x => x.type !== 'option')
    expect(ghostOptionPrompt(noOptions)).toBe('')
  })

  it('DISCRIMINATION: it is not a constant — two models get two sentences', () => {
    const other = [
      n('d1', 'decision', 'Replace our customer data platform before the March renewal'),
      n('o1', 'option', 'Snowplow'),
    ]
    expect(ghostOptionPrompt(MODEL)).not.toBe(ghostOptionPrompt(other))
    expect(ghostOptionPrompt(other)).toContain('Snowplow')
  })
})

describe('the mount hands that sentence to the legacy ghost node', () => {
  /**
   * ⚠ COMMENTS STRIPPED FIRST. Without it, every assertion below can be
   * satisfied by prose — a review proved exactly that on the sibling mount-path
   * spec, by replacing a live call with a comment carrying the same call text.
   *
   * ⚠⚠ RE-POINTED WHEN #1077 MOVED THE COMPOSITION, AND THE PROPERTY IS
   * UNCHANGED. These guards were written against `ReactFlowGraph.tsx` because
   * that is where the legacy ghost node was built. #1077 moved the whole
   * composition into `composeFrontier` in `ghostTiers.ts` so the mount and the
   * spec would call the same function — a good change, and one that would have
   * silently voided every assertion below had they been deleted instead of
   * followed. What they protect is unaltered: the door is built with a real
   * sentence rather than `data: {}`. Only the file holding it moved.
   *
   * The mount's own obligation is now DELEGATION rather than construction, and
   * it is asserted separately at the end of this block.
   */
  const sourceOf = (rel: string, min = 1000): string => {
    const raw = readFileSync(resolve(__dirname, rel), 'utf-8')
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    // POSITIVE CONTROL: a strip that ate the file would make every `not.toMatch`
    // below pass by matching nothing, and the `toMatch` ones fail loudly — but
    // only if something asserts the input is non-empty first.
    if (code.length < min) throw new Error(`${rel} read or stripped to nothing`)
    return code
  }

  const composerSource = (): string => sourceOf('../ghostTiers.ts')
  const mountSource = (): string => sourceOf('../../ReactFlowGraph.tsx')

  /** The legacy ghost node's object literal, isolated so the assertions bind to IT. */
  const ghostNodeLiteral = (): string => {
    const m = /id:\s*GHOST_OPTION_NODE_ID[\s\S]{0,600}?connectable:\s*false,/.exec(composerSource())
    if (!m) throw new Error('could not locate the ghost-option node literal in ghostTiers.ts')
    return m[0]
  }

  it('POSITIVE CONTROL: the literal was found, and it is the ghost-option one', () => {
    const block = ghostNodeLiteral()
    expect(block).toContain('GHOST_OPTION_NODE_ID')
    expect(block).toContain("'ghost-option'")
  })

  it('builds it with a prompt from `ghostOptionPrompt`, not with an empty data bag', () => {
    // `data: {}` is what shipped the defect: the node carried nothing, so the
    // component's hardcoded sentence was what the user actually sent.
    expect(ghostNodeLiteral()).toMatch(/data:\s*\{\s*prompt:\s*ghostOptionPrompt\(/)
    expect(ghostNodeLiteral()).not.toMatch(/data:\s*\{\s*\}/)
  })

  it('NEGATIVE CONTROL: a fabricated name does not match', () => {
    // Guards the two assertions above against a regex that matches anything.
    expect(ghostNodeLiteral()).not.toMatch(/data:\s*\{\s*prompt:\s*ghostOptionPromptV99Fabricated\(/)
  })

  it('the composer builds the sentence in the same module as the tier table', () => {
    // The original form of this assertion read the MOUNT's import list, because
    // the mount was what built the door. Now that the composition lives beside
    // the tier table, the property is that the builder and the table are one
    // module — which is what stops a second derivation of the same list.
    expect(composerSource()).toMatch(/export function ghostOptionPrompt\(/)
    expect(composerSource()).toMatch(/export function composeFrontier\(/)
  })

  it('the MOUNT delegates rather than re-deriving the sentence locally', () => {
    // The mount's obligation after #1077: call the composer, and hold no second
    // copy of the door-building logic. A re-derivation appearing here is exactly
    // the drift the move was made to prevent.
    expect(mountSource()).toMatch(/import\s*\{[^}]*composeFrontier[^}]*\}\s*from\s*'\.\/utils\/ghostTiers'/)
    expect(mountSource()).toMatch(/composeFrontier\(\s*nodes\s*,\s*resultsStatus\s*\)/)
    // NEGATIVE CONTROL for the two above: the mount must NOT still be building
    // the literal itself, which is what a botched conflict resolution would
    // leave behind (both copies alive, only one reached).
    expect(mountSource()).not.toMatch(/type:\s*'ghost-option'/)
  })
})
