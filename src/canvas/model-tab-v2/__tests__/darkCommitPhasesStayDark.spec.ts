/**
 * ⭐⭐ A GUARD THAT REDS ON THE COMMIT THAT WIRES THE HAZARD — not a comment
 * hoping the next author reads it.
 *
 * THE HAZARD. `ModelRowView`'s value cell sits in an `auto` grid track, so it
 * sizes to its content and takes that width out of the identity track. Before
 * the row became a subgrid, flex distributed a row's deficit across every atom.
 * **Now the identity track is the only flexible one, so 100% of any width an
 * `auto` cell takes comes out of the label.** An unbounded `applied` receipt
 * would eat the name it sits beside.
 *
 * WHY IT IS NOT A LIVE DEFECT. `ValueCell` has eight returns, but the sole live
 * writer of `commit` is `ModelOutline.tsx` ← `ModelTabV2Panel`'s `ActiveEdit`,
 * whose `phase` is typed `'editing' | 'proposed'`. `inflight`, `applied`,
 * `refused` and the `editing` fallback are unreachable **by accident of the
 * host, not by design** — and `types.ts` already specifies `applied` as
 * receipt-driven, so the wiring is planned rather than hypothetical.
 *
 * ⚠⚠ WHY THIS FILE EXISTS RATHER THAN A COMMENT OR A REGISTER ROW. The site
 * comment is the highest-probability contact point and it is not a certain one:
 * someone wiring `applied` starts from the receipt PRODUCER and reaches the
 * consumer only if they think to ask who reads it — which is exactly the
 * assumption that fails. A register row is reachable and unread. **This spec is
 * neither: it fails in CI on the exact commit that widens the producer's union,
 * and its failure message is where the hazard is written.** Prose records do
 * not compose across seams; executable ones do.
 *
 * ⚠ IT DOES NOT ASSERT THE HAZARD IS FIXED. It asserts the precondition that
 * makes it dormant. When it REDs, the correct response is to bound the new
 * arm's content and give it a shrink contract in the SAME change — not to add
 * the phase to the list below.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const V2_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRODUCER = join(V2_DIR, 'ModelTabV2Panel.tsx')
const CONTRACT = join(V2_DIR, 'types.ts')

/**
 * The phases the ROW can be told about at all — `EditCommitState`'s own members.
 */
function declaredPhases(contract: string): string[] {
  const block = contract.match(/export type EditCommitState =([\s\S]*?)\n\n/)
  if (!block) return []
  return [...new Set([...block[1].matchAll(/\bphase:\s*'([a-zA-Z_]+)'/g)].map(m => m[1]))].sort()
}

/**
 * The phases the producer can emit, DERIVED from two independent sources and
 * pinned to NEITHER's signature.
 *
 * ⛔⛔ THIS IS THE SECOND WIDENING IN ONE NIGHT, AND THE FIRST ONE WAS STILL
 * WRONG — named by an independent seat before it shipped.
 *
 * v1 read `interface ActiveEdit`'s union. The confirmation-settlement change
 * added a writer that reaches the row WITHOUT passing through it, so the guard
 * would have read `['editing','proposed']` forever while the real union grew,
 * contrast control agreeing all the way.
 *
 * v2 read the `commitByRowId` memo body instead. Better, and still wrong in the
 * same shape: **a derived guard pinned to one function's signature is a
 * hand-maintained mirror wearing a derivation's clothes.** Rename that memo,
 * change its dependency array's formatting, or split it in two, and the match
 * fails, the parse returns `[]`, and every assertion below passes vacuously —
 * silently, exactly as v1 did.
 *
 * v3 is pinned to no signature. It asks: which strings does the producer name as
 * a `phase`, that the ROW CONTRACT actually understands? Both halves have to be
 * deleted for it to go blind, and the `declaredPhases` precondition below fails
 * loudly if the contract half ever stops parsing.
 *
 * ⚠ IT OVER-APPROXIMATES ON PURPOSE. A `phase: 'x'` belonging to some other
 * state machine in the same file counts if `EditCommitState` happens to declare
 * `x` too — `interventionEdit` and this union both use `'editing'`. For a HAZARD
 * guard that is the correct direction: it can cry wolf, it cannot fall silent.
 */
function producerPhases(producer: string, contract: string): string[] {
  const declared = new Set(declaredPhases(contract))
  if (declared.size === 0) return []
  const named = [...producer.matchAll(/\bphase:\s*'([a-zA-Z_]+)'/g)].map(m => m[1])
  return [...new Set(named.filter(x => declared.has(x)))].sort()
}

/**
 * The arms whose content is unbounded and which carry no shrink contract. Named
 * explicitly because this is a claim about WHICH arms are dangerous, not a
 * restatement of which are dark — those are different sets and conflating them
 * is how a guard stops discriminating.
 */
const UNBOUNDED_ARMS = ['applied', 'inflight', 'refused'] as const

describe('the dark commit phases stay dark, or someone deals with the shrink contract', () => {
  it('the producer type parses — or every assertion below is vacuous', () => {
    const phases = producerPhases(readFileSync(PRODUCER, 'utf8'), readFileSync(CONTRACT, 'utf8'))

    // ⭐ THE CONTRAST CONTROL, and it is the whole reason this file can be
    // trusted. A parser that returns `[]` for everything would make the
    // absence assertion below pass forever, on any source, including a file
    // that had been deleted. So: it must find the phases that ARE emitted.
    //
    // ⚠ `confirm_unsettled` IS IN THIS LIST ON PURPOSE. It is emitted, it is
    // NOT in `UNBOUNDED_ARMS`, and those are different claims — the arm takes
    // `proposed`'s `flex-wrap` shape, so it grows the row in height rather than
    // taking width out of the label. The second test below measures that rather
    // than trusting this sentence.
    expect(phases).toEqual(['confirm_unsettled', 'editing', 'proposed'])

    // ⭐ THE CONTRACT HALF, PINNED SEPARATELY. If this stops parsing the
    // intersection silently empties and every assertion below goes vacuous, so
    // it is asserted as a precondition rather than assumed.
    expect(declaredPhases(readFileSync(CONTRACT, 'utf8'))).toEqual([
      'applied', 'confirm_unsettled', 'editing', 'idle', 'inflight', 'proposed', 'refused',
    ])

    // And it must return nothing when either half is missing — proving the
    // match is real rather than a default.
    expect(producerPhases('export const x = 1', 'export const y = 2')).toEqual([])
    expect(producerPhases("const x = { phase: 'applied' }", 'no union here')).toEqual([])
    expect(declaredPhases('export const x = 1')).toEqual([])
  })

  it('⭐ no unbounded arm has been wired into the producer', () => {
    const phases = producerPhases(readFileSync(PRODUCER, 'utf8'), readFileSync(CONTRACT, 'utf8'))
    expect(phases.length).toBeGreaterThan(0) // precondition, pinned in-test

    const wired = UNBOUNDED_ARMS.filter(arm => phases.includes(arm))

    expect(
      wired,
      wired.length === 0
        ? ''
        : `\n\n  ${wired.join(', ')} is now emitted by ModelTabV2Panel's ActiveEdit.\n\n` +
          `  THE VALUE CELL SITS IN AN \`auto\` GRID TRACK. Before the row became a\n` +
          `  subgrid, flex spread a row's deficit across every atom. Now the identity\n` +
          `  track is the only flexible one, so 100% of any width an \`auto\` cell takes\n` +
          `  COMES OUT OF THE LABEL — an unbounded receipt will eat the node name it\n` +
          `  sits beside, at every dock width.\n\n` +
          `  This arm has no shrink contract because it had no producer. It has one now.\n` +
          `  Bound its content and give it \`min-w-0\` + \`truncate\` (or \`shrink-0\` with a\n` +
          `  measured ceiling) in THIS change — see ModelRowView.tsx, CELL 3.\n\n` +
          `  Do NOT satisfy this test by adding the phase to UNBOUNDED_ARMS.\n`,
    ).toEqual([])
  })

  it('the guard would fire — proven on a mutated source, not asserted', () => {
    // The discriminating pair. Without this, "no unbounded arm is wired" is a
    // claim about a predicate nobody has watched fail.
    const CONTRACT_SRC = readFileSync(CONTRACT, 'utf8')

    // A producer that names an unbounded phase ANYWHERE — not only inside a
    // particular memo — must fire.
    expect(
      UNBOUNDED_ARMS.filter(a =>
        producerPhases("const s = { phase: 'applied', value: v }", CONTRACT_SRC).includes(a),
      ),
    ).toEqual(['applied'])

    // …and the twin: a producer that gains a phase the ROW does not understand
    // must NOT fire, or the guard is a tripwire on any change rather than on the
    // hazard.
    expect(producerPhases("const s = { phase: 'reviewing' }", CONTRACT_SRC)).toEqual([])

    // ⭐ THE MUTANT THAT PROVES v3 BEATS v2: a phase emitted outside any
    // `commitByRowId` memo — and outside `interface ActiveEdit` — is still seen.
    // Under v1 and v2 this returned [].
    expect(
      producerPhases("function elsewhere() { return { phase: 'inflight', to: t } }", CONTRACT_SRC),
    ).toEqual(['inflight'])
  })
})
