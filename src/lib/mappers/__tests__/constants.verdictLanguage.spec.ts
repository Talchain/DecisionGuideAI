/**
 * `COPY` fragile-edge templates — no crowning noun (ROADMAP 2.724).
 *
 * Doctrine (Paul-ratified): the product recommends what to INVESTIGATE, never
 * what to CHOOSE. "…changed the best option in <N% of simulations" describes an
 * analysis result using a verdict noun; "changed which option ranks first" says
 * the same measured thing without crowning anything. Rank ORDER is analysis and
 * stays — only the framing changes, and the count and threshold are preserved.
 *
 * ── HONEST SCOPE (traps 3b / 10 — do not read this as live coverage) ──────
 * Both templates pinned here are CONSUMER-LESS at tip `a81121d1`. Complete
 * manifest over `src/`, `rg -a`:
 *   · `FILTERED_EDGES_TEMPLATE` — 1 hit, its own definition (`constants.ts:90`).
 *   · `ALL_BELOW_THRESHOLD`     — 1 hit, its own definition (`constants.ts:117`).
 * Neither reaches a render site, and neither string appears anywhere in the
 * deployed staging bundle at that same tip (83-chunk transitive closure crawled
 * from the served entry, `/version.json` commit ==
 * `a81121d1c401a8d51bc4c32e53d1d0e63a7640a3`) — they are tree-shaken out, which
 * is consistent with having no consumer. The source audit filed these as two of
 * five LIVE UI violations; measured at this tip they are dormant.
 *
 * This is therefore a REGRESSION PIN on dormant copy, kept because a consumer
 * can be wired at any time and the template is what a future caller would
 * inherit. It is deliberately not described as protecting a user-visible
 * surface. The one genuinely live verdict string in this change set is the
 * OptionNode leader chip — see `OptionNode.verdictLanguage.spec.tsx`, which
 * carries served-bundle mount evidence.
 */
import { describe, it, expect } from 'vitest'
import { COPY, THRESHOLDS } from '../constants'

const BANNED_CROWNING = [/best (option|choice|bet|pick)/i, /\brecommend/i, /\bwinner\b/i]

describe('COPY fragile-edge templates — analysis description, not a verdict (ROADMAP 2.724)', () => {
  it('FILTERED_EDGES_TEMPLATE names the rank change, not a best option', () => {
    expect(COPY.FILTERED_EDGES_TEMPLATE(3)).toBe(
      '3 additional assumptions changed which option ranks first in <30% of simulations'
    )
    // Singular arm — pluralisation is information the rewrite must not lose.
    expect(COPY.FILTERED_EDGES_TEMPLATE(1)).toBe(
      '1 additional assumption changed which option ranks first in <30% of simulations'
    )
  })

  it('ALL_BELOW_THRESHOLD names the rank change, not a best option', () => {
    expect(COPY.ALL_BELOW_THRESHOLD(2, THRESHOLDS.FRAGILE_EDGE_FILTER)).toBe(
      'No high-sensitivity assumptions found. 2 assumptions changed which option ranks first in <15% of simulations.'
    )
    expect(COPY.ALL_BELOW_THRESHOLD(1, THRESHOLDS.FRAGILE_EDGE_FILTER)).toBe(
      'No high-sensitivity assumptions found. 1 assumption changed which option ranks first in <15% of simulations.'
    )
  })

  it('neither template can carry the banned crowning register', () => {
    const rendered = [
      COPY.FILTERED_EDGES_TEMPLATE(1),
      COPY.FILTERED_EDGES_TEMPLATE(4),
      COPY.ALL_BELOW_THRESHOLD(1, 0.15),
      COPY.ALL_BELOW_THRESHOLD(4, 0.3),
    ]
    for (const text of rendered) {
      for (const pattern of BANNED_CROWNING) {
        expect(text).not.toMatch(pattern)
      }
    }

    // Positive control (trap 13): an absence assertion that has never seen a
    // presence proves nothing. The retired string is pinned BY VALUE here, as a
    // historical artefact rather than a pointer at whatever is current (trap
    // 12b), and every banned-register rule is proved to FIRE on it.
    const RETIRED = '3 additional assumptions changed the best option in <30% of simulations'
    expect(BANNED_CROWNING.some((p) => p.test(RETIRED))).toBe(true)
  })
})
