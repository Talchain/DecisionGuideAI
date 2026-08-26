/**
 * A SECTION THAT DISPLAYS A BLOCKER MUST NAME WHAT CAN RESOLVE IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, DERIVED AT `0ccfbc40` AND DRIVEN ON THE DEPLOYED BUILD
 * ═══════════════════════════════════════════════════════════════════════════
 * The OPTIONS section renders `missing-intervention` attention markers and
 * provides no control that can clear them. Matched pair from the drive, same
 * session, same tab, same moment:
 *
 *   OPTION row  `-value` → an EMPTY, zero-height <span>. Real click REFUSED.
 *   FACTOR row  `-value` → a <button> "Not set", 37×42. Real click SUCCEEDED.
 *
 * ⚠⚠ AND IT IS NOT AN OVERSIGHT — established before writing a line of this.
 * `mutationAuthority.ts:20` declares `modelOptionIntervention: 'disabled'`, so
 * `hasServerGraphAuthority` is false, `OPTION_INTERVENTION_CONNECTED` is false,
 * and `editConnectedIds` (`ModelTabV2Panel.tsx:215-219`) contains FACTORS ONLY.
 * ONE declaration produces BOTH the empty span here AND the option inspector's
 * `<fieldset disabled>`. **There is no writer for an option intervention
 * anywhere in the product except a typed sentence to Olumi.**
 *
 * So the fix is NOT a control. A control here would be a surface with no
 * writer. The fix is that the section SAYS SO and points at what does work.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS DOES NOT CHANGE — the NOT SET WALL stays intact
 * ═══════════════════════════════════════════════════════════════════════════
 * `ModelRowView`'s rule — *"'Not set' is printed only where it is ACTIONABLE;
 * where nothing can be done from this cell, the cell is SILENT"* — is correct
 * and is deliberately left alone. A per-row string would breach it and put back
 * the wall of identical inert text that rule exists to remove. The notice is
 * SECTION-level: one sentence for the group, not N for the rows. Pinned below.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ModelOutline } from '../ModelOutline'
import { GROUP_ACTIONS } from '../groupActions'
import {
  rowsThisSectionCannotResolve,
  SECTION_WRITER_NOTICE_TESTID,
} from '../sectionWriterNotice'
import type { ModelGroupId, ModelRow } from '../types'

function row(id: string, group: ModelGroupId, over: Partial<ModelRow> = {}): ModelRow {
  return {
    id,
    kind: 'option',
    group,
    label: `Label ${id}`,
    primaryValue: null,
    attention: ['missing-intervention'],
    editable: true,
    ...over,
  }
}

/** Two unmapped options and one factor — the shape the drive measured. */
function rows(): ModelRow[] {
  return [
    row('opt-1', 'options'),
    row('opt-2', 'options'),
    row('fac-1', 'factors', {
      kind: 'factor',
      attention: [],
      primaryValue: '12',
    }),
  ]
}

/**
 * ⚠ `onBeginEdit` IS LOAD-BEARING HERE, and omitting it made two assertions in
 * this file VACUOUS on the first run. `editorAvailable` is
 * `row.editable && editConnected && typeof onBeginEdit === 'function'`
 * (`ModelRowView`), so with no handler EVERY row renders as a span — the
 * factor included. The option-vs-factor contrast this file rests on would then
 * hold for the wrong reason, and "the blocked row is still empty" would pass
 * against a host where nothing is editable at all. Supplying it reproduces the
 * drive's matched pair: the factor becomes a real <button>, the unconnected
 * option stays an empty <span>.
 */
function renderOutline(over: Partial<Parameters<typeof ModelOutline>[0]> = {}) {
  return render(
    <ModelOutline
      rows={rows()}
      tier="plain"
      filter=""
      selectedId={null}
      onSelect={() => {}}
      onBeginEdit={() => {}}
      onGroupAction={() => {}}
      {...(over as Record<string, unknown>)}
    />,
  )
}

/** The label the section already renders — DERIVED, never re-typed here. */
const DISCUSS_LABEL = GROUP_ACTIONS.options.find(a => a.intent === 'discuss')!.label

describe('the pure predicate — which rows can this section NOT resolve?', () => {
  it('POSITIVE CONTROL — the fixture really does carry the blocker', () => {
    // Without this the whole file is vacuous: rows with no `missing-intervention`
    // would produce an empty result for the WRONG reason.
    const optionRows = rows().filter(r => r.group === 'options')
    expect(optionRows).toHaveLength(2)
    expect(optionRows.every(r => r.attention.includes('missing-intervention'))).toBe(true)
  })

  it('⭐ names the rows that are blocked AND have no writer', () => {
    const ids = rowsThisSectionCannotResolve(rows(), new Set(['fac-1']))
    expect([...ids].sort()).toEqual(['opt-1', 'opt-2'])
  })

  it('⭐ SELF-RETIRING — a row that GAINS a writer is no longer unresolvable', () => {
    // The load-bearing property. When `modelOptionIntervention` becomes
    // `server_graph`, `editConnectedIds` will contain the option ids and this
    // returns empty WITHOUT anyone remembering to delete the notice. Derived
    // from the same set the row cell reads, so the two cannot disagree.
    const ids = rowsThisSectionCannotResolve(rows(), new Set(['fac-1', 'opt-1', 'opt-2']))
    expect(ids).toEqual([])
  })

  it('a row with no blocker is not named, even without a writer', () => {
    const clean = [row('opt-1', 'options', { attention: [], primaryValue: '3 changes' })]
    expect(rowsThisSectionCannotResolve(clean, new Set())).toEqual([])
  })

  it('an UNDEFINED writer set means "this host connects everything" — nothing is unresolvable', () => {
    // Matches `ModelOutline`'s own convention at its row cell: `undefined`
    // is treated as connected, so a host without the concept is unchanged.
    expect(rowsThisSectionCannotResolve(rows(), undefined)).toEqual([])
  })
})

describe('⭐ the rendered notice — the section names what can resolve the blocker', () => {
  it('⭐ RED-FIRST — the OPTIONS section renders a notice naming the discuss action', () => {
    renderOutline({ editConnectedIds: new Set(['fac-1']) })
    const notice = screen.getByTestId(SECTION_WRITER_NOTICE_TESTID('options'))
    expect(notice).toBeTruthy()
    // Bound to the affordance ALREADY on screen, by its real label.
    expect(notice.textContent).toContain(DISCUSS_LABEL)
  })

  it('⭐ it quotes the label DERIVED from GROUP_ACTIONS, not a re-typed copy', () => {
    // Trap 12: a hand-typed duplicate of the button's label would drift the
    // first time the button is renamed, and the notice would point at a
    // control the user cannot find. Asserted against the source of truth.
    renderOutline({ editConnectedIds: new Set(['fac-1']) })
    const notice = screen.getByTestId(SECTION_WRITER_NOTICE_TESTID('options'))
    const button = screen.getByTestId('model-action-v2-options-discuss')
    expect(notice.textContent).toContain(button.textContent!)
  })

  it('it states HOW MANY rows are affected, derived from the same predicate', () => {
    renderOutline({ editConnectedIds: new Set(['fac-1']) })
    const notice = screen.getByTestId(SECTION_WRITER_NOTICE_TESTID('options'))
    expect(notice.textContent).toContain('2')
  })

  it('⭐ SELF-RETIRING in the DOM — connect a writer and the notice is GONE', () => {
    // The component is free to disobey a pure function it does not call, so
    // the retirement is asserted against the rendered DOM as well.
    renderOutline({ editConnectedIds: new Set(['fac-1', 'opt-1', 'opt-2']) })
    expect(screen.queryByTestId(SECTION_WRITER_NOTICE_TESTID('options'))).toBeNull()
  })

  it('CONTRAST — a section with no blocked rows renders no notice', () => {
    // The FACTORS group is in the same render and carries no
    // `missing-intervention`, so it must stay silent. This is what makes the
    // assertion above about OPTIONS rather than about "a notice renders".
    renderOutline({ editConnectedIds: new Set(['fac-1']) })
    expect(screen.queryByTestId(SECTION_WRITER_NOTICE_TESTID('factors'))).toBeNull()
  })

  it('no notice when the host connects everything (undefined set)', () => {
    renderOutline()
    expect(screen.queryByTestId(SECTION_WRITER_NOTICE_TESTID('options'))).toBeNull()
  })

  it('⭐ NO NOTICE when the action row does not render — never name an absent control', () => {
    // FOUND BY A FIXTURE GAP, NOT BY INSPECTION. The first version of this file
    // omitted `onGroupAction`; `ModelGroupActions` returns null without it, so
    // the button was absent and the "quotes the button's own text" assertion
    // failed. The test was right and the component was wrong: it would have
    // said *Use "Discuss the options with Olumi" below* with no such control
    // below it — the same circularity as reusing SHARED_MODEL_AUTHORITY_COPY,
    // merely relocated one surface along.
    render(
      <ModelOutline
        rows={rows()}
        tier="plain"
        filter=""
        selectedId={null}
            onSelect={() => {}}
        onBeginEdit={() => {}}
        editConnectedIds={new Set(['fac-1'])}
      />,
    )
    // PRECONDITION PINNED IN-TEST: the action row really is absent, so this
    // asserts the gate rather than passing for some unrelated reason.
    expect(screen.queryByTestId('model-action-v2-options-discuss')).toBeNull()
    expect(screen.queryByTestId(SECTION_WRITER_NOTICE_TESTID('options'))).toBeNull()
  })
})

describe('⚠ the NOT SET WALL is untouched — this adds no per-row text', () => {
  it('the blocked row`s value cell is STILL empty', () => {
    // The whole point of a section-level notice. If this ever REDs, someone has
    // put the wall back one row at a time.
    renderOutline({ editConnectedIds: new Set(['fac-1']) })
    expect(screen.getByTestId('model-row-v2-opt-1-value').textContent).toBe('')
    expect(screen.getByTestId('model-row-v2-opt-2-value').textContent).toBe('')
  })

  it('exactly ONE notice for the section, not one per blocked row', () => {
    renderOutline({ editConnectedIds: new Set(['fac-1']) })
    expect(screen.getAllByTestId(SECTION_WRITER_NOTICE_TESTID('options'))).toHaveLength(1)
  })

  it('the factor row still renders its own editable control — unchanged', () => {
    // Guards the other direction: this change must not touch the path that
    // WORKS. `fac-1` is edit-connected, so its cell is still a button.
    renderOutline({ editConnectedIds: new Set(['fac-1']) })
    expect(screen.getByTestId('model-row-v2-fac-1-value').tagName).toBe('BUTTON')
  })
})
