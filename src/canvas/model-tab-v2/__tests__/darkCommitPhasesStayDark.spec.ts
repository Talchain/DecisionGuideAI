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

/**
 * The phases the producer can currently emit, DERIVED from its own type rather
 * than copied. A hand-listed set here would be the mirror this estate keeps
 * paying for: it would agree with itself forever.
 */
function producerPhases(source: string): string[] {
  // `interface ActiveEdit { … phase: 'editing' | 'proposed' … }`
  const iface = source.match(/interface\s+ActiveEdit\s*\{([\s\S]*?)\n\}/)
  if (!iface) return []
  const line = iface[1].match(/\bphase\s*:\s*([^\n]+)/)
  if (!line) return []
  return [...line[1].matchAll(/'([a-zA-Z_]+)'/g)].map(m => m[1]).sort()
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
    const phases = producerPhases(readFileSync(PRODUCER, 'utf8'))

    // ⭐ THE CONTRAST CONTROL, and it is the whole reason this file can be
    // trusted. A parser that returns `[]` for everything would make the
    // absence assertion below pass forever, on any source, including a file
    // that had been deleted. So: it must find the phases that ARE emitted.
    expect(phases).toEqual(['editing', 'proposed'])

    // And it must return nothing for a source that has no such interface —
    // proving the match is real rather than a default.
    expect(producerPhases('export const x = 1')).toEqual([])
    expect(producerPhases('interface Other { phase: "applied" }')).toEqual([])
  })

  it('⭐ no unbounded arm has been wired into the producer', () => {
    const phases = producerPhases(readFileSync(PRODUCER, 'utf8'))
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
    const wiredSource = `interface ActiveEdit {\n  rowId: string\n  phase: 'editing' | 'proposed' | 'applied'\n  draft: string\n}`
    const phases = producerPhases(wiredSource)
    expect(phases).toContain('applied')
    expect(UNBOUNDED_ARMS.filter(a => phases.includes(a))).toEqual(['applied'])

    // …and the twin: a producer that gains a BOUNDED phase must NOT fire, or
    // the guard is a tripwire on any change rather than on the hazard.
    const benign = `interface ActiveEdit {\n  rowId: string\n  phase: 'editing' | 'proposed' | 'reviewing'\n  draft: string\n}`
    expect(UNBOUNDED_ARMS.filter(a => producerPhases(benign).includes(a))).toEqual([])
  })
})
