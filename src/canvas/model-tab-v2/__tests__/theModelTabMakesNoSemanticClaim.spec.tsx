/**
 * ⭐⭐⭐ THE MODEL TAB DESCRIBES THE MODEL. IT DOES NOT RANK IT, CROWN IT, OR
 * CALL ANY PART OF IT IMPORTANT.
 *
 * ── MEASURED ON THE DEPLOYED BUILD, TWICE (staging `1f77130d`, 22 Sep 2026) ──
 * Two models — the canonical pricing example and *International Expansion
 * Strategy* — read fully EXPANDED (a collapsed tree returns the same zero as a
 * clean one, which is no measurement at all):
 *
 *     Key driver        0 / 0
 *     Most influential  0 / 0
 *     rank              0 / 0
 *     est.              0 / 0
 *
 * ── WHY A GUARD RATHER THAN A NOTE ──────────────────────────────────────────
 * The vocabulary exists one component away and is under structural pressure to
 * migrate here. `Key driver 1` is drawn on the CANVAS today; `est.` is a real
 * marker this estate ships (`EstimateMarker`); `Rank` is a real Inspect row on
 * the Reasoning tab. Each is correct where it lives, because a ranking has a
 * producer there. **The Model tab has no analysis behind it** — it is the
 * model, not a reading of one — so the same word here would be a claim nothing
 * measured. That is the sibling-surface defect this estate keeps paying for:
 * a string that is true on one surface copied to its twin, where it is not.
 *
 * This is the Model tab's counterpart to `noWinnerVocabulary.spec.ts`, which
 * exists on the Reasoning tab for the same reason and says so: *"the WIRE
 * vocabulary is winner-shaped … any surface that renders a field faithfully
 * inherits the framing."*
 *
 * ── WHAT IS DELIBERATELY *NOT* BANNED ───────────────────────────────────────
 * **"AI estimate"** and **"Estimate not yet confirmed"** are LICENSED and must
 * keep rendering: they describe who authored a value, which is a fact about the
 * model, not a claim about importance. A guard that swept them up would delete
 * the provenance marking that makes user-authored and Olumi-authored values
 * distinguishable — the opposite of what it is for. The banned list is scoped
 * to IMPORTANCE and RANK claims, and the control below proves the licensed
 * strings survive.
 *
 * ⚠ AND A USER'S OWN WORDS ARE NOT A CLAIM BY THE PRODUCT. Someone may name a
 * factor "Key driver of churn" and the tab must render it verbatim. The census
 * therefore runs over PRODUCT-AUTHORED text — fixture labels carry none of the
 * banned words — and the positive control renders a row whose LABEL does carry
 * one, proving both that the probe can see such a string and that the guard
 * does not censor the user.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../store', () => ({
  useCanvasStore: (sel: (s: unknown) => unknown) => sel({ nodes: [] }),
}))

import { ModelOutline } from '../ModelOutline'
import type { ModelElementKind, ModelRow } from '../types'

afterEach(cleanup)

/**
 * ⚠ EVERY KIND, BECAUSE A CENSUS OVER A SUBSET IS NOT A CENSUS. `ModelRow.kind`
 * is a closed union and the fixture below covers it exhaustively — the
 * `satisfies` pin makes a seventh kind a compile error here rather than a
 * silent hole in the sweep.
 */
const EVERY_KIND = [
  'decision', 'goal', 'option', 'factor', 'risk', 'outcome', 'relationship',
] as const satisfies readonly ModelElementKind[]

const GROUP_OF: Record<ModelElementKind, ModelRow['group']> = {
  decision: 'goal', goal: 'goal', option: 'options', factor: 'factors',
  risk: 'outcomes-risks', outcome: 'outcomes-risks', relationship: 'relationships',
}

/** Neutral labels: no banned word anywhere in the user-authored half. */
const rowOf = (kind: ModelElementKind, over: Partial<ModelRow> = {}): ModelRow => ({
  id: `row_${kind}`,
  kind,
  group: GROUP_OF[kind],
  label: `A ${kind} in the model`,
  primaryValue: kind === 'factor' ? '0.4' : null,
  attention: [],
  editable: kind === 'factor',
  ...over,
} as ModelRow)

const EVERY_STATE: readonly ModelRow[] = [
  ...EVERY_KIND.map((k) => rowOf(k)),
  // An unset factor Olumi HAS spoken about — the row that carries the licensed
  // provenance strings, so the control below is not vacuous.
  rowOf('factor', {
    id: 'row_factor_estimated',
    label: 'An unset factor Olumi estimated',
    primaryValue: null,
    estimateText: 'Very high (0.8)',
    provenanceSource: 'cee_inference',
    attention: ['unconfirmed-estimate'],
  }),
]

const draw = (rows: readonly ModelRow[]) =>
  render(<ModelOutline rows={rows} tier="advanced" filter="" />)

/**
 * ⭐⭐⭐ EVERYTHING A READER RECEIVES — TEXT **AND** `aria-label` **AND**
 * `title`, and the third channel is the one that caught this file out.
 *
 * ⛔ THE FIRST CUT SWEPT `textContent` ALONE AND TWO OF ITS THREE MUTANTS
 * SURVIVED. Retitling the unconfirmed-estimate marker to the bare `est.` badge
 * changed nothing it could see, because that marker is an **`aria-label` on an
 * icon** — there is no text node at all. Putting a literal `Key driver` crown
 * on every row as a **`title`** changed nothing either. A census blind to the
 * two channels the product actually uses for exactly this kind of mark reports
 * a clean sweep of the wrong document, and every arm below would have returned
 * "clean" forever.
 *
 * ⇒ This is the estate's own rule in the other direction: `innerText` unions
 * the visible and `sr-only` documents and INFLATES a duplication finding, so
 * `.sr-only` is stripped; but an attribute-borne claim is still a claim, so
 * `aria-label` and `title` are ADDED. Strip what is duplicated, add what is
 * carried.
 */
const claimSurface = (): string => {
  const root = screen.getByTestId('model-outline-v2') ?? document.body
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.sr-only').forEach((n) => n.remove())
  const attributes = Array.from(clone.querySelectorAll('[aria-label], [title]'))
    .flatMap((el) => [el.getAttribute('aria-label'), el.getAttribute('title')])
    .filter((v): v is string => typeof v === 'string' && v !== '')
  return [clone.textContent ?? '', ...attributes].join(' | ').replace(/\s+/g, ' ')
}

/**
 * ⚠ IMPORTANCE AND RANK CLAIMS ONLY. Each is a claim the Model tab has no
 * producer for. `est\.` is bounded so it cannot match inside "Estimate not yet
 * confirmed"; `\brank\b` is bounded so it cannot match "ranked" inside a
 * user's prose.
 */
const BANNED: ReadonlyArray<readonly [string, RegExp]> = [
  ['Key driver', /key driver/i],
  ['Most influential', /most influential/i],
  ['Top driver', /top driver/i],
  ['est. (the bare marker)', /\best\./i],
  ['rank', /\brank\b/i],
  ['importance', /\bimportanc/i],
  ['confidence', /\bconfidence\b/i],
]

describe('the Model tab makes no semantic claim it has no producer for', () => {
  /**
   * ⚠ PRECONDITION (trap 13b). A census that rendered nothing would report a
   * clean sweep of an empty string, and every assertion below would pass for
   * the wrong reason.
   */
  it('PRECONDITION — every kind really rendered, and the text is substantial', () => {
    draw(EVERY_STATE)
    const text = claimSurface()
    expect(text.length, 'the outline produced a real surface to sweep').toBeGreaterThan(120)
    for (const kind of EVERY_KIND) {
      expect(screen.getByTestId(`model-row-v2-row_${kind}`), `${kind} row mounted`).toBeInTheDocument()
    }
  })

  it.each(BANNED)('⛔ never says %s', (_name, pattern) => {
    draw(EVERY_STATE)
    expect(claimSurface()).not.toMatch(pattern)
  })

  /**
   * ⭐⭐ POSITIVE CONTROL — the probe CAN see a banned word, and the guard does
   * not censor the user. A factor a person named "Key driver of churn" renders
   * verbatim, and this sweep would have caught the product saying it.
   */
  it('CONTROL — the probe sees the string when it is there, and a user may still say it', () => {
    draw([rowOf('factor', { id: 'row_user_words', label: 'Key driver of churn' })])
    const text = claimSurface()
    expect(text, 'the user\'s own label is rendered verbatim').toMatch(/key driver of churn/i)
    expect(text, 'so the census above was measuring a document that can contain it').toMatch(/key driver/i)
  })

  /**
   * ⭐⭐ THE LICENSED STRINGS SURVIVE. These describe AUTHORSHIP, not
   * importance, and they are what makes user-authored and Olumi-authored values
   * distinguishable. A ban list that swept them up would delete the thing the
   * tab is for.
   */
  it('CONTROL — provenance marking is untouched', () => {
    draw(EVERY_STATE)
    const marks = Array.from(document.querySelectorAll('[aria-label]'))
      .map((e) => e.getAttribute('aria-label') ?? '')
    expect(marks.join(' | ')).toMatch(/Olumi estimate/i)
    expect(marks.join(' | ')).toMatch(/Estimate not yet confirmed/i)
  })
})
