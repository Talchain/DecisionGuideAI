/**
 * ⭐⭐ THE ROW'S SHRINK CONTRACT — the guard this fix shipped WITHOUT, and the
 * reason it had to be added.
 *
 * ⚠⚠ MEASURED BY INDEPENDENT REVIEW **AT `ecf41dfb`**: replacing
 * `ModelRowView.tsx` with its merge-base version — a FULL REVERT of the entire
 * fix, which at that SHA was **16 insertions and 138 deletions**
 * (`git diff --numstat 9c94a718..ecf41dfb -- src/canvas/model-tab-v2/ModelRowView.tsx`
 * → `138 16`) — turned **NOTHING** red. All 19 files and 300 tests in
 * `model-tab-v2/__tests__` passed, and so did the three `ModelTabBody` specs.
 * The fix added zero tests. That is CLAUDE.md trap 11 exactly: a fix whose
 * removal nothing objects to is a fix nothing is holding in place.
 *
 * ⚠⚠ THE SHA IN THAT COMMAND IS LOAD-BEARING, AND THE REASON IS A DEFECT THIS
 * FILE COMMITTED AGAINST ITSELF. The figure was first written as `..HEAD`, and
 * the very next commit — the ROW CONTAINER block below, added to close an
 * independent review's blocker — moved it to `159 16`. So the sentence citing
 * a measurement drifted **because of the fix for the previous review**, and a
 * later reviewer correctly read `138` as wrong. `..HEAD` is a hand-maintained
 * mirror wearing a command's clothing: it looks derived, and it silently
 * re-points every time anyone touches this file.
 *
 * A revert measurement is a DATED CAPTURE of what the suite did on one tree,
 * not a property of the current one — so it is pinned and append-only (trap
 * 14b). **Do not "update" this number.** If you re-run the revert, add a new
 * line naming YOUR SHA and leave this one standing; the claim it supports is
 * "nothing held this fix in place at `ecf41dfb`", and that stays true forever.
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

describe('the ROW CONTAINER — the half of the contract the atoms depend on', () => {
  /**
   * ⭐⭐ THE GAP AN INDEPENDENT REVIEW PROVED, AND IT IS THE WHOLE POINT OF THE
   * FILE. Every other assertion here reads an ATOM's className. Not one of them
   * touched the row `<li>` — and `flex-1`, `shrink-0` and `min-w-0` are
   * MEANINGLESS OUTSIDE A FLEX FORMATTING CONTEXT. So the contract had a
   * provable hole: add `flex-wrap` to the row, or drop `flex` from it, and
   * every class this PR adds goes inert, ragged heights return, and all twelve
   * tests still pass. Not probable — PROVABLE, because the assertions compare
   * className strings and jsdom performs no layout, so a parent-only change
   * *cannot* fail any of them.
   *
   * That is a guard agreeing with itself (CLAUDE.md trap 13b): each atom
   * correctly states what it does under flex, and nothing states that flex is
   * there. The fix is not a geometry harness — it is the container's half, in
   * the paradigm this file already chose.
   *
   * ⚠ `flex-wrap` is asserted ABSENT, not merely `flex` present. Presence of
   * `flex` is what makes the basis rules apply; absence of `flex-wrap` is what
   * makes them apply on ONE LINE, which is the actual claim ("the row does not
   * wrap"). Two different harms, so two assertions — one parameter cannot
   * guard both directions.
   */
  it('establishes a single-line formatting context, which is what makes every atom rule mean anything', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" onBeginEdit={() => {}} />)

    // The formatting context the atom rules are written against.
    // ⚠⚠ SUPERSEDED, DELIBERATELY: this asserted `flex`. The row is now
    // `grid grid-cols-subgrid col-span-4`, adopting tracks defined once on the
    // `<ul>` — see `rowAtomsAlignToOneGrid.spec.tsx`, which owns that contract.
    //
    // The CLAIM of this test is unchanged and is why it survives the paradigm
    // change rather than being deleted: the row must establish a formatting
    // context in which the atom rules below MEAN something, on ONE LINE. Under
    // flex that was `flex` present + `flex-wrap` absent. Under grid it is a
    // fixed track count, which cannot wrap at all — a grid item goes to its
    // track or nowhere.
    //
    // `flex-wrap` stays asserted absent below. It is now inert rather than
    // load-bearing, and it is kept for exactly that reason: if anyone reverts
    // the row to `flex`, that assertion is the one that still guards the
    // original harm, and a guard that costs nothing to keep should not be
    // dropped in a refactor that made it temporarily redundant.
    expect(hasClass('model-row-v2-f1', 'grid')).toBe(true)
    expect(hasClass('model-row-v2-f1', 'grid-cols-subgrid')).toBe(true)
    expect(hasClass('model-row-v2-f1', 'items-center')).toBe(true)

    // ⭐ The regression the reviewer constructed: wrapping the row silently
    // re-opens ragged heights while every atom assertion stays green.
    expect(hasClass('model-row-v2-f1', 'flex-wrap')).toBe(false)

    // …and the display class must be the one this row actually declares. This
    // previously asserted `grid` ABSENT, on the reasoning that a swapped
    // display class should RED rather than pass on a substring match. The
    // reasoning was right and the polarity is now inverted: `grid` is the
    // declared context, and `flex` is the swap that must RED.
    //
    // ⚠ NOTE WHAT THIS ASSERTION IS FOR, because it is easy to delete as
    // redundant once `rowAtomsAlignToOneGrid.spec.tsx` exists. That file owns
    // the CROSS-FILE contract (tracks on the `<ul>` == span on the row). THIS
    // one owns the local claim that the atom rules below have a formatting
    // context to mean anything in. They fail on different mutations: reverting
    // the `<ul>` REDs there and not here; reverting the row to `flex` REDs here
    // and not there. Two questions, two guards.
    expect(hasClass('model-row-v2-f1', 'flex')).toBe(false)
  })

  /**
   * The discriminating control for the assertion above. `hasClass` must be able
   * to return BOTH answers about the same element, or `flex-wrap === false` is
   * a control that cannot fail — it would read false on an element with no
   * className at all, on a missing element, or on a broken helper.
   */
  it('the membership helper discriminates on the row element itself', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" onBeginEdit={() => {}} />)
    // A class that IS present reads true, on this exact element…
    // ⚠ WAS `flex`. The row became `grid grid-cols-subgrid` when the atoms were
    // aligned to one shared grid; `grid` is now the token that is certainly
    // present. The control's JOB is unchanged — prove the helper can return
    // true — so it must name a class the row actually has, or it silently
    // becomes the cannot-pass control it was written to avoid.
    expect(hasClass('model-row-v2-f1', 'grid')).toBe(true)
    // …and one that is not reads false. Both directions, one element.
    expect(hasClass('model-row-v2-f1', 'wrap-me-i-do-not-exist')).toBe(false)
    // The row is a real element carrying a real className — not an empty string
    // that would make every membership question answer false.
    expect(screen.getByTestId('model-row-v2-f1').className.trim().length).toBeGreaterThan(0)
  })
})

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
   * default-shrink item left to take the deficit.
   *
   * ⚠ THE "85px ESCAPE AT THE 280px FLOOR" FIGURE IS WITHDRAWN — it was a
   * reviewer's fixture number, inherited here without reproduction, and a run
   * against the real deployed panel contradicted it (the dock body is
   * `overflow-x: auto`, so escape is 0). The assertion below never depended on
   * it: it pins `min-w-0 truncate` + `title`, i.e. that the loss is SIGNALLED
   * and RECOVERABLE, which is true regardless of how far anything escaped.
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
   * a second line rather than compressing atoms that cannot afford it.
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

describe('the `editing` arm — LIVE, and until now rendered by no test in this file', () => {
  /**
   * ⚠ THE SPEC'S ONLY COMMIT FIXTURE WAS `{ phase: 'proposed' }`, so the
   * `editing` arm — which a user reaches every time they click a value — was
   * never rendered here at all, and its new `shrink-0 whitespace-nowrap` was
   * unguarded. A prior review recorded this as a surviving mutant; it is one
   * assertion, and the file was already open.
   *
   * `editing` is the arm that MUST NOT shrink: it hosts a text input the user
   * is typing into. An input allowed to take the row's deficit collapses to a
   * few characters wide while its own content is what the user is reading.
   */
  it('does not shrink or wrap while the user is typing into it', () => {
    render(
      <ModelRowView
        row={row({ id: 'f1' })}
        tier="plain"
        commit={{ phase: 'editing', draft: '52' } as const}
        onDraftChange={() => {}}
        onProposeEdit={() => {}}
        onDiscardEdit={() => {}}
      />,
    )
    // Precondition, pinned in-test: this really is the editing arm and not a
    // fallback that happens to render — the input only exists on this branch.
    expect(screen.getByTestId('model-row-v2-f1-value-input')).toHaveValue('52')

    expect(hasClass('model-row-v2-f1-value', 'shrink-0')).toBe(true)
    expect(hasClass('model-row-v2-f1-value', 'whitespace-nowrap')).toBe(true)
  })
})
