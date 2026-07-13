/**
 * Wave 1 — copy hygiene for the Decision overview surface (house pattern:
 * per-surface spec over centralised copy; no repo-wide guard exists).
 * Rules (brief §13.4): sentence case (no shouting caps), no em dashes in
 * prose, en-GB, no internal analytical terms in user-facing strings.
 */
import { describe, it, expect } from 'vitest'

import { OVERVIEW_COPY } from '../DecisionOverviewCard'
import { METHOD_CATALOGUE, GLOBAL_ACTIONS, REVIEW_BRIEF_ASK, RERUN_TOASTS } from '../actionsCatalogue'

const BANNED_TERMS = /\b(node|edge|coefficient|elasticity|normalised value|graph hash|winner|validate)\b/i
const AMERICAN = /\b(analyze|optimize|color|behavior|center|favorite)\w*/i

function allStrings(): string[] {
  return [
    ...Object.values(OVERVIEW_COPY),
    ...METHOD_CATALOGUE.flatMap((m) => [m.title, m.description, m.prompt]),
    ...GLOBAL_ACTIONS.flatMap((a) => [a.title, a.description, ...(a.prompt ? [a.prompt] : [])]),
    ...Object.values(REVIEW_BRIEF_ASK),
    ...Object.values(RERUN_TOASTS),
  ]
}

describe('Decision overview copy hygiene', () => {
  it('contains no em dashes in prose', () => {
    for (const s of allStrings()) expect(s, s).not.toContain('—')
  })

  it('contains no shouting caps', () => {
    for (const s of allStrings()) {
      const shouting = s.match(/\b[A-Z]{2,}\b/g)?.filter((w) => w !== 'AGAINST') ?? []
      expect(shouting, s).toEqual([])
    }
  })

  it('avoids internal analytical vocabulary and American spellings', () => {
    for (const s of allStrings()) {
      expect(s, s).not.toMatch(BANNED_TERMS)
      expect(s, s).not.toMatch(AMERICAN)
    }
  })
})
