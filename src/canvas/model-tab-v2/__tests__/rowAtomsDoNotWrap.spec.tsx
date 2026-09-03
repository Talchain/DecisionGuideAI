/**
 * ⭐⭐ THE ROW'S SHRINK CONTRACT — the guard this fix shipped WITHOUT, and the
 * reason it had to be added.
 *
 * ⚠⚠ MEASURED BY INDEPENDENT REVIEW: replacing `ModelRowView.tsx` with its
 * merge-base version — a FULL REVERT of the entire fix, 16 insertions and 128
 * deletions — turned **NOTHING** red. All 19 files and 300 tests in
 * `model-tab-v2/__tests__` passed, and so did the three `ModelTabBody` specs.
 * The fix added zero tests. That is CLAUDE.md trap 11 exactly: a fix whose
 * removal nothing objects to is a fix nothing is holding in place.
 *
 * "jsdom cannot measure layout" is true and is NOT the excuse it looks like.
 * The defect was never a pixel — it was that specific atoms were allowed to
 * shrink or wrap when they must not. That is a CLASS CONTRACT, and the repo
 * already asserts class contracts in exactly this way:
 * `AnalysisReadinessBar.boundedLayout.spec.tsx:107` and
 * `PanelShell.safearea.spec.tsx:53`. The sibling census fix does the same.
 *
 * ⚠ WHAT THIS FILE CLAIMS, AND WHAT IT DOES NOT. It pins the classes that carry
 * the contract, so a refactor that silently drops one REDs here. It asserts NO
 * pixel, no height and no overflow — jsdom computes none of those, and the
 * browser numbers live in the PR. Anyone reading a green here as "the row fits"
 * has read it wrong.
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY — `model-row-v2-<id>-<part>` — never by a
 * class predicate another element in the row could satisfy.
 */

import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import type { ModelRow } from '../types'

function row(over: Partial<ModelRow> & Pick<ModelRow, 'id'>): ModelRow {
  return {
    kind: 'factor',
    group: 'factors',
    label: `Label ${over.id}`,
    primaryValue: '45 days',
    attention: [],
    editable: true,
    ...over,
  }
}

/** The row's own classes, read off the element the testid names. */
const cls = (testid: string) => screen.getByTestId(testid).className

/**
 * ⚠⚠ WHITESPACE-DELIMITED, NOT `\b`. The obvious `/\bmin-w-\[6rem\]\b/`
 * NEVER MATCHES: `]` is a non-word character and so is the space after it, so
 * there is no word boundary between them and the assertion fails on a class
 * that is plainly present. That is an instrument reporting a defect in code
 * that does not have one — the direction that destroys a correct fix. Tailwind
 * arbitrary values (`min-w-[6rem]`, `grid-cols-[auto_1fr_auto]`) are full of
 * such characters, so class membership is tested by splitting on whitespace.
 */
const hasClass = (testid: string, name: string) =>
  cls(testid).split(/\s+/).includes(name)

describe('the label is the one atom that may lose characters — and it has a floor', () => {
  /**
   * `flex-1` gives the label the only zero flex-basis in the row, so the free
   * space lands there instead of on the value atoms. `min-w-[6rem]` is the
   * floor: without it, measured, 24 labels were crushed and "GDPR EU Data
   * Residency Compliance" rendered in 26px — one character and an ellipsis.
   */
  it('carries truncate, a flex basis of zero, and a legibility floor', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" onBeginEdit={() => {}} />)
    expect(hasClass('model-row-v2-f1-label', 'truncate')).toBe(true)
    expect(hasClass('model-row-v2-f1-label', 'flex-1')).toBe(true)
    expect(hasClass('model-row-v2-f1-label', 'min-w-[6rem]')).toBe(true)
  })
})

describe('a value never breaks from its own unit', () => {
  /**
   * ⚠ THE ORIGINAL DEFECT. "35 %" was squeezed into 32px and the number wrapped
   * away from its percent sign. Both idle arms must refuse to wrap — and there
   * are TWO, a `<span>` when the value is not editable here and a `<button>`
   * when it is, which is why the first pass fixed only half the rows.
   */
  it('the read-only idle cell will not wrap', () => {
    render(<ModelRowView row={row({ id: 'f1', editable: false })} tier="plain" />)
    expect(cls('model-row-v2-f1-value')).toMatch(/\bwhitespace-nowrap\b/)
  })

  it('the EDITABLE idle cell will not wrap either — the arm the first pass missed', () => {
    render(<ModelRowView row={row({ id: 'f2' })} tier="plain" onBeginEdit={() => {}} />)
    const el = screen.getByTestId('model-row-v2-f2-value')
    expect(el.tagName).toBe('BUTTON') // pin WHICH arm rendered, per rowShowsOlumisEstimate
    expect(el.className).toMatch(/\bwhitespace-nowrap\b/)
  })

  /**
   * A bare value must never shrink; a value carrying an estimate HINT may,
   * because the hint is the thing that can afford to go. Two states, two
   * classes — a discriminating pair, so a change that collapsed them to one
   * would fail here rather than pass.
   */
  it('a bare value refuses to shrink, while one carrying a hint may give', () => {
    render(
      <>
        <ModelRowView row={row({ id: 'bare' })} tier="plain" onBeginEdit={() => {}} />
        <ModelRowView
          row={row({ id: 'hint', primaryValue: null, estimateText: 'Moderate (0.5)' })}
          tier="plain"
          onBeginEdit={() => {}}
        />
      </>,
    )
    expect(cls('model-row-v2-bare-value')).toMatch(/\bshrink-0\b/)
    expect(cls('model-row-v2-hint-value')).toMatch(/\bmin-w-0\b/)
    expect(cls('model-row-v2-hint-value-estimate')).toMatch(/\btruncate\b/)
  })
})

describe('the no-value ⚠ is cut only where it is REDUNDANT', () => {
  /**
   * ⭐ THE PAIR THAT BOUNDS THE ONE DELETION IN THIS CHANGE. The ⚠ is dropped
   * only where "Not set" is actually rendered beside it. `ValueCell` prints
   * those words on its EDITABLE idle arm and nowhere else, so both halves are
   * asserted — a suppression that fired one atom wider would leave a row with
   * no missing-value signal at all.
   */
  it('is cut when the editable idle cell prints "Not set"', () => {
    render(
      <ModelRowView
        row={row({ id: 'f1', primaryValue: null, attention: ['no-value'] })}
        tier="plain"
        onBeginEdit={() => {}}
      />,
    )
    expect(screen.getByTestId('model-row-v2-f1-value')).toHaveTextContent('Not set')
    expect(screen.queryByTestId('model-row-v2-f1-attention-no-value')).toBeNull()
  })

  it('is KEPT when the cell is silent, because there the ⚠ is the only signal', () => {
    render(
      <ModelRowView
        row={row({ id: 'f2', primaryValue: null, editable: false, attention: ['no-value'] })}
        tier="plain"
      />,
    )
    expect(screen.getByTestId('model-row-v2-f2-value')).toHaveTextContent('')
    expect(screen.getByTestId('model-row-v2-f2-attention-no-value')).toBeInTheDocument()
  })

  /**
   * ⚠⚠ THE STATES THAT ARE ACTUALLY DEFECTIVE — and my first attempt at this
   * test was pointed at the one that is not.
   *
   * I bounded the cut with a single non-idle case, `proposed`. Independent
   * review enumerated all 128 states and showed `proposed` WAS NEVER
   * DEFECTIVE: `ValueCell` renders `commit.from`, and the panel builds
   * `from: row.primaryValue ?? 'Not set'`, so the real cell reads
   * "Not set → 60…" and the words ARE on screen. My case only passed because
   * it used `from: ''`, a shape `beginEdit` never produces for a null-valued
   * row — a fixture outside the producer's output domain, which proves nothing
   * about the product.
   *
   * A discriminating mutant (`phase === 'idle'` → `phase !== 'proposed'`)
   * reopens the real defect and my 35 tests stayed GREEN. The three states that
   * genuinely render no "Not set" are `editing`, `inflight` and `applied`, so
   * those are what is pinned, each by name so a failure says which.
   */
  it.each([
    ['editing', { phase: 'editing', draft: '' }],
    ['inflight', { phase: 'inflight', from: 'Not set', to: '60 days' }],
    ['applied', { phase: 'applied', value: '60 days', provenanceSource: 'user' }],
  ])('keeps the warning during %s, where the words are NOT rendered', (_n, commit) => {
    render(
      <ModelRowView
        row={row({ id: 'f3', primaryValue: null, attention: ['no-value'] })}
        tier="plain"
        commit={commit as never}
        onBeginEdit={() => {}}
        onDraftChange={() => {}}
        onProposeEdit={() => {}}
        onDiscardEdit={() => {}}
      />,
    )
    expect(screen.getByTestId('model-row-v2-f3-value')).not.toHaveTextContent('Not set')
    expect(screen.getByTestId('model-row-v2-f3-attention-no-value')).toBeInTheDocument()
  })

  /**
   * ⭐⭐ THE TWO PHASES WHERE THE RULES DIVERGE, AND BOTH MUST BE PINNED.
   *
   * `proposed` and `refused` are the only phases that render `commit.from`, so
   * they are the only ones where "are the words on screen" and "is the ⚠
   * redundant" give DIFFERENT answers. A words-rule would cut the ⚠ in both; the
   * redundancy rule keeps it, because nothing has been committed — the cell is
   * describing a PROPOSAL or a REVERSION, not a settled state, and "no value is
   * set" remains an unresolved fact about the model.
   *
   * ⚠ I ENUMERATED THE RATIONALE AND THEN PINNED ONLY ONE OF ITS TWO PHASES.
   * Independent review measured it: cutting the ⚠ in `refused` survived all 324
   * tests here. Naming a rule and testing one member of the class it governs is
   * the same defect as not enumerating at all — the guard just looks thorough.
   */
  it.each([
    ['proposed', { phase: 'proposed', from: 'Not set', to: '60 days' }],
    ['refused', { phase: 'refused', from: 'Not set', attempted: '60 days', reason: 'Declined.' }],
  ])('keeps the warning during %s, because nothing is committed yet', (_n, commit) => {
    render(
      <ModelRowView
        row={row({ id: 'f4', primaryValue: null, attention: ['no-value'] })}
        tier="plain"
        commit={commit as never}
        onBeginEdit={() => {}}
        onConfirmEdit={() => {}}
        onDiscardEdit={() => {}}
      />,
    )
    // The words ARE on screen in both — pinned, so the reasoning stays
    // checkable rather than becoming a claim nobody re-tests. This is exactly
    // where a words-rule would disagree with the shipped condition.
    expect(screen.getByTestId('model-row-v2-f4-value')).toHaveTextContent('Not set')
    expect(screen.getByTestId('model-row-v2-f4-attention-no-value')).toBeInTheDocument()
  })
})

describe('the atoms that must hold their size', () => {
  it('the attention marker never shrinks', () => {
    render(<ModelRowView row={row({ id: 'f1', attention: ['unconfirmed-estimate'] })} tier="plain" />)
    expect(cls('model-row-v2-f1-attention-unconfirmed-estimate')).toMatch(/\bshrink-0\b/)
  })

  it('Confirm never shrinks and never wraps — a truncated affordance is a fake one', () => {
    render(
      <ModelRowView
        row={row({ id: 'f1', attention: ['unconfirmed-estimate'] })}
        tier="plain"
        onConfirmValueAsIs={() => {}}
      />,
    )
    const c = cls('model-row-v2-f1-confirm-as-is')
    expect(c).toMatch(/\bshrink-0\b/)
    expect(c).toMatch(/\bwhitespace-nowrap\b/)
  })

  /** The provenance pill is LAST in the yield ladder, so it is allowed to give. */
  it('the provenance pill may truncate, because it is the thing that gives', () => {
    render(<ModelRowView row={row({ id: 'f1', provenanceSource: 'cee_inference' })} tier="plain" />)
    const c = cls('model-row-v2-f1-provenance')
    expect(c).toMatch(/\bmin-w-0\b/)
    expect(c).toMatch(/\btruncate\b/)
  })
})

describe('the Advanced id — round 2, and it made the escape WORSE before it was fixed', () => {
  /**
   * ⚠ `row.id` is a single unbreakable `font-mono` token, so without
   * `overflow:hidden` its automatic minimum is the whole token: it can neither
   * shrink nor wrap. Once the label gained its floor this was the only
   * default-shrink item left, and independent review measured the row escaping
   * by 85px at the 280px dock floor — WORSE than before the fix.
   */
  it('truncates and names itself, rather than pushing the row out', () => {
    render(<ModelRowView row={row({ id: 'fac_platform_migration' })} tier="advanced" />)
    const el = screen.getByTestId('model-row-v2-fac_platform_migration-id')
    expect(el.className).toMatch(/\bmin-w-0\b/)
    expect(el.className).toMatch(/\btruncate\b/)
    // The DOM text stays whole under an ellipsis, so copy still yields the id.
    expect(el).toHaveAttribute('title', 'fac_platform_migration')
    expect(el).toHaveTextContent('fac_platform_migration')
  })

  /** The discriminating twin: `plain` must not render it at all. */
  it('is absent in the plain tier', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" />)
    expect(screen.queryByTestId('model-row-v2-f1-id')).toBeNull()
  })
})

describe('the `proposed` cell — the one LIVE path the first pass left unfixed', () => {
  const proposed = { phase: 'proposed', from: '45 days', to: '60 days' } as const

  /**
   * It carries the most content in the component: `from → to`, a caption, and
   * two bordered chips, in a 280px dock. It is the only place in the row
   * permitted to WRAP, because nothing here can afford to be lost — so it takes
   * a second line rather than pushing the row out of the panel.
   */
  it('is allowed to wrap, and the arrow pair is not', () => {
    render(
      <ModelRowView
        row={row({ id: 'f1' })}
        tier="plain"
        commit={proposed}
        onConfirmEdit={() => {}}
        onDiscardEdit={() => {}}
      />,
    )
    expect(cls('model-row-v2-f1-value')).toMatch(/\bflex-wrap\b/)

    // ⚠ A value broken from its arrow is the defect this whole fix is about, so
    // the pair is pinned to a single non-shrinking, non-wrapping parent.
    const from = screen.getByTestId('model-row-v2-f1-value-from')
    const to = screen.getByTestId('model-row-v2-f1-value-to')
    expect(from.parentElement).toBe(to.parentElement)
    const pair = from.parentElement!
    expect(pair.className).toMatch(/\bshrink-0\b/)
    expect(pair.className).toMatch(/\bwhitespace-nowrap\b/)
  })

  it('the Confirm / Discard chips never shrink', () => {
    render(
      <ModelRowView
        row={row({ id: 'f1' })}
        tier="plain"
        commit={proposed}
        onConfirmEdit={() => {}}
        onDiscardEdit={() => {}}
      />,
    )
    const chips = screen.getByTestId('model-row-v2-f1-confirm').parentElement!
    expect(chips).toBe(screen.getByTestId('model-row-v2-f1-discard').parentElement)
    expect(chips.className).toMatch(/\bshrink-0\b/)
  })

  /**
   * ⭐ THE INSTRUMENT'S OWN CONTROL. Every assertion above turns on
   * `toMatch(/\bclass\b/)`. A predicate that matched nothing would let every
   * one of them pass by testing nothing, so it is shown FAILING on a class the
   * row demonstrably does not carry.
   */
  it('the class predicate can tell present from absent, INCLUDING arbitrary values', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" onBeginEdit={() => {}} />)
    // Present, absent, and — the case that caught me — an ARBITRARY VALUE whose
    // brackets defeat a `\b`-anchored regex.
    expect(hasClass('model-row-v2-f1-label', 'truncate')).toBe(true)
    expect(hasClass('model-row-v2-f1-label', 'min-w-[6rem]')).toBe(true)
    expect(hasClass('model-row-v2-f1-label', 'zz-not-a-real-class')).toBe(false)
    // And prove the OLD predicate was the broken one, so nobody reinstates it.
    expect(/\bmin-w-\[6rem\]\b/.test(cls('model-row-v2-f1-label'))).toBe(false)
  })
})
