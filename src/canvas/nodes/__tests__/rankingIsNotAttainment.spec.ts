/**
 * ⭐⭐ A COMPARATIVE QUESTION MAY NOT CARRY A GOAL-ATTAINMENT PREMISE.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `DecisionNode`'s "Challenge this result" chip carried the typed action
 * `what_would_flip` — which asks what would change the ORDER of the options —
 * while the sentence it actually sent read:
 *
 *     "What assumptions would need to change for a different option to be
 *      most likely to hit my goal?"
 *
 * That fuses two questions with two different answers. **An option can rank
 * first and still be unlikely to reach the goal, and the goal probability can
 * move without any option changing place.** Paul has ruled on this conflation
 * repeatedly, and it reached the user here through a CHAT MESSAGE rather than a
 * badge — which is exactly why repairing the visible bar never touched it.
 *
 * ── WHY A SOURCE CENSUS AND NOT A RENDER TEST ────────────────────────────────
 * A `NodeChip`'s `message` is a PROP, not DOM: it is what gets sent to the model
 * when the chip is clicked, and it never appears on screen. So there is nothing
 * for a render test to read, and the thing worth guarding — what we ASK on the
 * user's behalf — is only visible in the source.
 *
 * ⚠ SCOPE, STATED, because a sweep is only as good as the boundary it declares:
 * `src/canvas/nodes/*.tsx`, production files, comments stripped. It reads the
 * literal strings passed as `message=` to a `NodeChip`. It will NOT catch a
 * paraphrase that avoids these words, and it will not see a message composed at
 * runtime from variables — `exploreOptionsMessage` is exactly that, and is
 * therefore outside what this file can claim.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

const ROOT = path.resolve(__dirname, '../../../..')
const NODES_DIR = path.join(ROOT, 'src/canvas/nodes')

/**
 * ⚠ A CORPUS, AND NAMED AS ONE. "Does this sentence fuse ranking with goal
 * attainment?" is not derivable, so this is a hand-written list of the shapes
 * that do it. Its failure mode is a FALSE RED — someone writes a legitimate
 * sentence containing one of these and has to justify it — which is the safe
 * direction for a guard over what we ask the model on a user's behalf.
 */
const ATTAINMENT_PREMISE = [
  /most likely to (hit|reach|meet)/i,
  /likelihood of (hitting|reaching|meeting) (my|the) goal/i,
  /chance of (hitting|reaching|meeting) (my|the) goal/i,
]

/** Literal `message="…"` strings passed to a NodeChip. Template messages are out of scope. */
function chipMessages(src: string): string[] {
  return [...src.matchAll(/<NodeChip[^>]*?message="([^"]+)"/gs)].map(m => m[1])
}

describe('what we ask on the user\'s behalf keeps ranking and attainment apart', () => {
  const files = readdirSync(NODES_DIR).filter(f => /\.tsx$/.test(f))

  it('finds no chip message fusing a comparison with reaching the goal', () => {
    // PRECONDITION PINNED IN-TEST: a sweep that read no messages agrees with
    // every other sweep that read no messages (trap 13).
    const all = files.flatMap(f =>
      chipMessages(stripComments(readFileSync(path.join(NODES_DIR, f), 'utf8'), f)).map(m => [f, m] as const),
    )
    expect(all.length, 'no NodeChip messages found — the sweep is vacuous').toBeGreaterThan(3)

    for (const [file, message] of all) {
      for (const banned of ATTAINMENT_PREMISE) {
        expect(
          banned.test(message),
          `${file}: "${message}" matches ${banned}. A comparative question asks what changes the ` +
            'ORDER of the options; a goal question asks whether a target is reached. An option can ' +
            'rank first and still be unlikely to reach the goal.',
        ).toBe(false)
      }
    }
  })

  it('CONTRAST — the corpus catches the sentence this replaced, and the detector reads real files', () => {
    // Without this the guard above passes just as well on a regex that matches
    // nothing and a parser that returns nothing.
    const removed = 'What assumptions would need to change for a different option to be most likely to hit my goal?'
    expect(ATTAINMENT_PREMISE.some(p => p.test(removed))).toBe(true)

    const decision = stripComments(readFileSync(path.join(NODES_DIR, 'DecisionNode.tsx'), 'utf8'), 'DecisionNode.tsx')
    expect(chipMessages(decision).length, 'the parser found no chip messages in DecisionNode').toBeGreaterThan(0)
  })

  it('keeps the comparative question comparative', () => {
    const decision = stripComments(readFileSync(path.join(NODES_DIR, 'DecisionNode.tsx'), 'utf8'), 'DecisionNode.tsx')
    const messages = chipMessages(decision)
    // The typed route was never wrong — only the sentence. Bound by the word
    // that makes it comparative rather than by the whole string, so a rewording
    // that keeps the meaning does not red.
    expect(
      messages.some(m => /compar/i.test(m)),
      'no chip on the decision node asks a comparative question any more',
    ).toBe(true)
  })
})
