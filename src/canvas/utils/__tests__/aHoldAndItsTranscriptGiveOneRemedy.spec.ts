/**
 * ⭐ ONE STATE, ONE REMEDY — the hold and the transcript (Panel #1917 N4;
 * programme-docs #63 5798274977: "two remedies for one failure make the user
 * choose between our explanations").
 *
 * ## The drift this closes
 *
 * An unconfirmed delete or rename is said twice: once in the chat, by the
 * turn's own notice (`STRUCTURAL_DELETE_NOTICE`, `STRUCTURAL_RENAME_NOTICE`,
 * `STRUCTURAL_RENAME_UNCONFIRMED_TOAST`), and once by the analysis hold
 * (`ANALYSIS_HELD_ON_EDIT_COPY`) for as long as the edit stays unconfirmed. The
 * transcript said "reload this decision"; the hold said "remove it again" or
 * "rename it again". Same state, two exits.
 *
 * ## The rule, pinned
 *
 * For each cause, the REMEDY CLAUSE (the last sentence, where both surfaces put
 * the one thing the user can do) is the same on both surfaces. The parity is
 * DERIVED from the hold's own sentence at runtime, never from a constant the
 * two sides might both import, so a drift on EITHER side goes red.
 *
 * Which notices share a state with the hold (measured at `useConversation`'s
 * resolvers and the every-exit carriers):
 *   · delete — `unconfirmed_server` (a typed error with no no-write guarantee;
 *     also the every-exit toast in `useStructuralDeleteEvents`) and
 *     `unconfirmed_transport` both KEEP the deletion and record it unconfirmed,
 *     which is exactly what the delete hold stands on;
 *   · rename — `unconfirmed_server` (an `unproven` 200 or an unknown 409),
 *     `unconfirmed_transport`, and the interrupted-turn toast all settle the
 *     rename `unconfirmed` and keep its label, which is what the rename hold
 *     stands on.
 *
 * The wording is PROPOSED for Experience Design; the requirement is Panel's:
 * a reachable exit (F1) and one remedy (N4).
 */
import { describe, expect, it } from 'vitest'

import { ANALYSIS_HELD_ON_EDIT_COPY } from '../analysisHeldOnInjectedModel'
import { STRUCTURAL_DELETE_NOTICE } from '../../mutations/structuralDelete'
import { STRUCTURAL_RENAME_NOTICE, STRUCTURAL_RENAME_UNCONFIRMED_TOAST } from '../../mutations/structuralRename'

/** The last sentence of a piece of copy — where both surfaces state the remedy. */
function remedyClause(copy: string): string {
  const sentences = copy.trim().split(/(?<=[.?!])\s+/)
  return sentences[sentences.length - 1]
}

/** The proposed remedies, verbatim. */
const DELETE_REMEDY = 'Would you like to ask Olumi to remove it?'
const RENAME_REMEDY = 'Would you like to rename it again, or change the name back?'

const CAUSES = [
  {
    cause: 'an unconfirmed delete',
    remedy: DELETE_REMEDY,
    hold: {
      'a node': ANALYSIS_HELD_ON_EDIT_COPY.unconfirmedDelete('Partner churn'),
      'a link': ANALYSIS_HELD_ON_EDIT_COPY.unconfirmedDelete('the link from Partner churn to Grow revenue'),
      'several (unnamed)': ANALYSIS_HELD_ON_EDIT_COPY.unconfirmedDelete(null),
    },
    transcript: {
      'STRUCTURAL_DELETE_NOTICE.unconfirmed_server': STRUCTURAL_DELETE_NOTICE.unconfirmed_server,
      'STRUCTURAL_DELETE_NOTICE.unconfirmed_transport': STRUCTURAL_DELETE_NOTICE.unconfirmed_transport,
    },
  },
  {
    cause: 'an unconfirmed rename',
    remedy: RENAME_REMEDY,
    hold: {
      named: ANALYSIS_HELD_ON_EDIT_COPY.unconfirmedRename('Adoption drag'),
      unnamed: ANALYSIS_HELD_ON_EDIT_COPY.unconfirmedRename(null),
    },
    transcript: {
      'STRUCTURAL_RENAME_NOTICE.unconfirmed_server': STRUCTURAL_RENAME_NOTICE.unconfirmed_server,
      'STRUCTURAL_RENAME_NOTICE.unconfirmed_transport': STRUCTURAL_RENAME_NOTICE.unconfirmed_transport,
      STRUCTURAL_RENAME_UNCONFIRMED_TOAST,
    },
  },
] as const

describe.each(CAUSES)('$cause: the hold and the transcript give ONE remedy', ({ remedy, hold, transcript }) => {
  const holdForms = Object.entries(hold) as Array<[string, string]>
  const transcriptLines = Object.entries(transcript) as Array<[string, string]>

  it('PRECONDITION: the probe finds a remedy clause in every line it compares', () => {
    for (const [, copy] of [...holdForms, ...transcriptLines]) {
      expect(remedyClause(copy).length).toBeGreaterThan(0)
      expect(remedyClause(copy)).not.toBe(copy.trim())
    }
  })

  it.each(holdForms)('the hold (%s) ends in the one remedy', (_form, copy) => {
    expect(remedyClause(copy)).toBe(remedy)
  })

  it.each(transcriptLines)('PARITY: %s gives the hold\'s own remedy clause', (_line, copy) => {
    for (const [, holdCopy] of holdForms) {
      expect(remedyClause(copy)).toBe(remedyClause(holdCopy))
    }
  })

  it.each(transcriptLines)('%s no longer sends the user to reload the decision', (_line, copy) => {
    expect(copy).not.toMatch(/reload this decision/i)
  })
})

describe('the transcript keeps its CLAIM — only the remedy moved', () => {
  it('delete: still "couldn\'t confirm" / "didn\'t reach", still says it is gone from the canvas', () => {
    expect(STRUCTURAL_DELETE_NOTICE.unconfirmed_server).toMatch(/^I couldn't confirm that deletion reached the saved model\./)
    expect(STRUCTURAL_DELETE_NOTICE.unconfirmed_transport).toMatch(/^That deletion didn't reach the server/)
    for (const copy of [STRUCTURAL_DELETE_NOTICE.unconfirmed_server, STRUCTURAL_DELETE_NOTICE.unconfirmed_transport]) {
      expect(copy).toContain("It's still gone from the canvas")
    }
  })

  it('rename: still "couldn\'t confirm" / "didn\'t reach" / "interrupted", still says it is on the canvas', () => {
    expect(STRUCTURAL_RENAME_NOTICE.unconfirmed_server).toMatch(/^I couldn't confirm that new name reached the saved model\./)
    expect(STRUCTURAL_RENAME_NOTICE.unconfirmed_transport).toMatch(/^That rename didn't reach the server/)
    expect(STRUCTURAL_RENAME_UNCONFIRMED_TOAST).toMatch(/^That rename was interrupted before the model answered/)
  })
})
