/**
 * ⭐ ONE SOURCE FOR THE LINK-STRENGTH WORDING — the edge and the card say the
 * same thing about the same state, because they read the same constants.
 *
 * MT-15b (manual test on served `4c6ec07b`) was ONE state described two ways:
 * the outcome card said "Strength Not set yet" while its own edge said "Very
 * strong boost est.". The connectors PR (#1910) and the node-card PR (#1915)
 * each fixed their half — and each spelled the fix itself:
 *
 *   · `edges/connectorCopy.ts`   `LINK_STRENGTH_NOUN`, `linkStrengthCaption`
 *                                 → "Link strength · Olumi's estimate"  (')
 *   · `nodes/shared/metricVocabulary.ts` `LINK_STRENGTH_COPY`
 *                                 → "Link strength · Olumi’s estimate"  (’)
 *
 * Two spellings of one sentence, and not even byte-identical. #1910's own note
 * said "whichever lands second should point at the other's constant"; the
 * design integration is where they meet, so this pins the join.
 *
 * ⭐ THE OWNER IS `metricVocabulary.ts`: it is the estate's copy register, its
 * `METRIC_NOUN.strength` is what the legend row and the retired-noun guard
 * already read, and the card rows, `EdgePills` and the reduced line already
 * import it. `connectorCopy.ts` imports from it.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { linkStrengthCaption, LINK_STRENGTH_NOUN } from '../connectorCopy'
import { LINK_STRENGTH_COPY, METRIC_NOUN } from '../../nodes/shared/metricVocabulary'
import { linkStrengthLodLine } from '../../nodes/shared/LinkStrengthRow'

/** Source with comments removed, so a docblock quoting the words is not a hit. */
const codeOf = (rel: string): string =>
  readFileSync(resolve(__dirname, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('link strength — the edge and the card speak with one voice', () => {
  it('an unconfirmed OLUMI strength reads the SAME on the edge hover and on the card', () => {
    const edge = linkStrengthCaption(true, 'cee')
    const card = linkStrengthLodLine({
      strengthIsSettled: false,
      bridgeStrengthPct: null,
      assumedPct: 40,
      assumedSource: 'cee',
    })
    expect(edge).toBe(`${LINK_STRENGTH_COPY.noun} · ${LINK_STRENGTH_COPY.olumiEstimate}`)
    expect(card).toBe(edge)
  })

  it('the edge’s noun IS the register’s noun', () => {
    expect(LINK_STRENGTH_NOUN).toBe(METRIC_NOUN.strength)
    expect(linkStrengthCaption(false, 'user')).toBe(LINK_STRENGTH_COPY.noun)
  })

  it('connectorCopy spells neither the noun nor "Olumi’s estimate" itself — it imports them', () => {
    const code = codeOf('../connectorCopy.ts')
    // Positive control: the probe reads real code from this file.
    expect(code).toContain('export function linkStrengthCaption(')
    expect(code).not.toMatch(/['"`]Link strength['"`]/)
    expect(code).not.toMatch(/Olumi['’]s estimate/)
  })

  it('CONTROL — the card row already imports its words (the probe is not blind to a clean file)', () => {
    const code = codeOf('../../nodes/shared/LinkStrengthRow.tsx')
    expect(code).toContain('LINK_STRENGTH_COPY')
    expect(code).not.toMatch(/['"`]Link strength['"`]/)
    expect(code).not.toMatch(/Olumi['’]s estimate/)
  })
})
