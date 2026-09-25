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
 * ⚠⚠ CORRECTED 23 Sep 2026 — THE PREMISE ABOVE IS NOW FALSE, AND IS KEPT SO THE
 * CORRECTION IS VISIBLE. `modelOptionIntervention` is `'server_graph'`, and the
 * option's detail region now renders a direct input for every factor the option
 * is LINKED to and does not yet change (`option_intervention_edit`, CEE
 * `prepareOptionInterventionEdit`). So a linked-but-empty option HAS a writer on
 * this surface, and telling its user the value "cannot be set from this
 * section" became the thing sending them back to chat. The notice now fires
 * only for an option linked to NO factor — the one case this surface still
 * cannot resolve — and says what unblocks it: link it first. The predicate's
 * second argument is therefore the set of options that HAVE a value input,
 * derived from the same projection the detail region renders from.
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

  it('⭐ names the rows that are blocked AND have no value input', () => {
    const ids = rowsThisSectionCannotResolve(rows(), new Set())
    expect([...ids].sort()).toEqual(['opt-1', 'opt-2'])
  })

  it('⭐ RETIRES PER ROW — a row that HAS a value input is no longer unresolvable', () => {
    // The retirement is the input, not the authority flag: the set is the
    // options whose detail region renders a first-value input.
    const ids = rowsThisSectionCannotResolve(rows(), new Set(['opt-1', 'opt-2']))
    expect(ids).toEqual([])
    // Per row, not all-or-nothing.
    expect(rowsThisSectionCannotResolve(rows(), new Set(['opt-1']))).toEqual(['opt-2'])
  })

  it('a row with no blocker is not named, even without an input', () => {
    const clean = [row('opt-1', 'options', { attention: [], primaryValue: '3 changes' })]
    expect(rowsThisSectionCannotResolve(clean, new Set())).toEqual([])
  })

  it('an UNDEFINED set means "this host has no concept of it" — nothing is named', () => {
    expect(rowsThisSectionCannotResolve(rows(), undefined)).toEqual([])
  })
})

describe('⭐ the rendered notice — the section names what can resolve the blocker', () => {
  it('⭐ RED-FIRST — the OPTIONS section renders a notice naming the discuss action', () => {
    renderOutline({ editConnectedIds: new Set(['fac-1']), optionIdsWithValueInputs: new Set() })
    const notice = screen.getByTestId(SECTION_WRITER_NOTICE_TESTID('options'))
    expect(notice).toBeTruthy()
    // Bound to the affordance ALREADY on screen, by its real label.
    expect(notice.textContent).toContain(DISCUSS_LABEL)
  })

  it('⭐ it quotes the label DERIVED from GROUP_ACTIONS, not a re-typed copy', () => {
    // Trap 12: a hand-typed duplicate of the button's label would drift the
    // first time the button is renamed, and the notice would point at a
    // control the user cannot find. Asserted against the source of truth.
    renderOutline({ editConnectedIds: new Set(['fac-1']), optionIdsWithValueInputs: new Set() })
    const notice = screen.getByTestId(SECTION_WRITER_NOTICE_TESTID('options'))
    const button = screen.getByTestId('model-action-v2-options-discuss')
    // ⚠ 23 Sep 2026: the discuss act is now an icon button, so its NAME is the
    // label (its visible text is empty — and `toContain('')` would pass for any
    // notice at all). Bound to the accessible name, asserted non-empty first.
    const name = button.getAttribute('aria-label') ?? ''
    expect(name).toBe('Discuss the options with Olumi')
    expect(notice.textContent).toContain(name)
  })

  it('it states HOW MANY rows are affected, derived from the same predicate', () => {
    renderOutline({ editConnectedIds: new Set(['fac-1']), optionIdsWithValueInputs: new Set() })
    const notice = screen.getByTestId(SECTION_WRITER_NOTICE_TESTID('options'))
    expect(notice.textContent).toContain('2')
  })

  it('⭐ it says to LINK the option first — and never that the value "cannot be set from this section"', () => {
    renderOutline({ editConnectedIds: new Set(['fac-1']), optionIdsWithValueInputs: new Set() })
    const notice = screen.getByTestId(SECTION_WRITER_NOTICE_TESTID('options'))
    expect(notice.textContent).toContain('Link them to a factor first (ask Olumi, or add a link)')
    expect(notice.textContent).not.toMatch(/cannot be set from this section/i)
  })

  it('⭐ RETIRES in the DOM — give the options a value input and the notice is GONE', () => {
    // The component is free to disobey a pure function it does not call, so
    // the retirement is asserted against the rendered DOM as well.
    renderOutline({ editConnectedIds: new Set(['fac-1']), optionIdsWithValueInputs: new Set(['opt-1', 'opt-2']) })
    expect(screen.queryByTestId(SECTION_WRITER_NOTICE_TESTID('options'))).toBeNull()
  })

  it('CONTRAST — a section with no blocked rows renders no notice', () => {
    // The FACTORS group is in the same render and carries no
    // `missing-intervention`, so it must stay silent. This is what makes the
    // assertion above about OPTIONS rather than about "a notice renders".
    renderOutline({ editConnectedIds: new Set(['fac-1']), optionIdsWithValueInputs: new Set() })
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
        optionIdsWithValueInputs={new Set()}
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
    renderOutline({ editConnectedIds: new Set(['fac-1']), optionIdsWithValueInputs: new Set() })
    expect(screen.getByTestId('model-row-v2-opt-1-value').textContent).toBe('')
    expect(screen.getByTestId('model-row-v2-opt-2-value').textContent).toBe('')
  })

  it('exactly ONE notice for the section, not one per blocked row', () => {
    renderOutline({ editConnectedIds: new Set(['fac-1']), optionIdsWithValueInputs: new Set() })
    expect(screen.getAllByTestId(SECTION_WRITER_NOTICE_TESTID('options'))).toHaveLength(1)
  })

  it('the factor row still renders its own editable control — unchanged', () => {
    // Guards the other direction: this change must not touch the path that
    // WORKS. `fac-1` is edit-connected, so its cell is still a button.
    renderOutline({ editConnectedIds: new Set(['fac-1']), optionIdsWithValueInputs: new Set() })
    expect(screen.getByTestId('model-row-v2-fac-1-value').tagName).toBe('BUTTON')
  })
})
