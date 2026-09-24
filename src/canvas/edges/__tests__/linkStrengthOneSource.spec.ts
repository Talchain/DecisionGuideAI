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
 * already read, and `EdgePills` imports it. `connectorCopy.ts` imports from it.
 *
 * ⚠ CONTRACT v3.1 (gap U1): the outcome/risk card row (`LinkStrengthRow`) and
 * its reduced line are GONE — "Outcome/risk records are distinct from the
 * strength of their connections". The edge is now the one place a bridge's
 * strength is worded, so the join this file pins is edge ↔ register ↔ the
 * factor card's `EdgePills` (the remaining card-side reader).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { linkStrengthCaption, LINK_STRENGTH_NOUN } from '../connectorCopy'
import { LINK_STRENGTH_COPY, METRIC_NOUN } from '../../nodes/shared/metricVocabulary'

/** Source with comments removed, so a docblock quoting the words is not a hit. */
const codeOf = (rel: string): string =>
  readFileSync(resolve(__dirname, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('link strength — the edge and the card speak with one voice', () => {
  it('an unconfirmed OLUMI strength on the edge hover reads in the register’s words', () => {
    // Contract v3.1 (gap U1): the card-side twin (`linkStrengthLodLine`) is
    // deleted with the outcome/risk row; the edge keeps the register wording.
    const edge = linkStrengthCaption(true, 'cee')
    expect(edge).toBe(`${LINK_STRENGTH_COPY.noun} · ${LINK_STRENGTH_COPY.olumiEstimate}`)
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

  it('CONTROL — the card-side reader (`EdgePills`) imports its words (the probe is not blind to a clean file)', () => {
    // Re-pointed from `LinkStrengthRow.tsx`, deleted by contract v3.1 (gap U1).
    const code = codeOf('../../nodes/shared/EdgePills.tsx')
    expect(code).toContain('LINK_STRENGTH_COPY')
    expect(code).not.toMatch(/['"`]Link strength['"`]/)
    expect(code).not.toMatch(/Olumi['’]s estimate/)
  })
})
