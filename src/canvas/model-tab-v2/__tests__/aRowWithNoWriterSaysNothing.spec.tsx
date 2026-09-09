/**
 * WHAT A ROW WITH NO WRITER ACTUALLY DOES — and it is not what four comments say.
 *
 * ── THE FALSE CLAIM, IN FOUR PLACES ────────────────────────────────────────
 * `ModelRowView`'s header states the surface's central honesty rule and then
 * describes a behaviour that does not exist:
 *
 *     "An edit control is live ONLY where the host has a CANONICAL transaction
 *      to dispatch on (`editConnected` + the callbacks). Everywhere else it
 *      renders DISABLED, with a label saying why."
 *
 * It renders no such thing. `editorAvailable` false takes the idle arm, which is
 * a bare `<span>` carrying the value (and, where present, Olumi's estimate hint).
 * There is no disabled control and no label. The same false sentence had already
 * propagated to `ModelTabV2Panel` twice ("their existing disabled affordance and
 * their label", "keeps the disabled affordance it has today") and to
 * `contracts.ts` once ("rows keep the disabled affordance") — where it is the
 * stated justification for the per-edge strength gate, i.e. a live design
 * decision is resting on it.
 *
 * ── THE CODE IS RIGHT; THE COMMENTS WERE STALE ─────────────────────────────
 * Silence is a RULING, not an oversight, and this spec pins it rather than
 * "fixing" it:
 *
 *   · `ModelRowView` — THE "NOT SET" WALL: *"'Not set' is printed only where it
 *     is ACTIONABLE… Where nothing can be done from this cell, the cell is
 *     SILENT."* Twenty-odd identical inert strings down one outline were
 *     individually honest and collectively meaningless.
 *   · `sectionWriterNotice.ts` — *"SECTION-LEVEL, NEVER PER-ROW… A per-row
 *     string would rebuild the wall of identical inert text that rule removed."*
 *
 * So a lane reading the header and "restoring" a per-row disabled label would be
 * undoing a ruling it never saw. §1 makes the ruling load-bearing.
 *
 * ── AND THE GAP THE FALSE CLAIM WAS HIDING (§2) ────────────────────────────
 * The sanctioned reason-surface exists and does NOT reach every row that needs
 * it. `rowsThisSectionCannotResolve` keys on `missing-intervention` alone, so
 * the OPTIONS group explains itself and the RELATIONSHIPS group does not — a
 * relationship the server never stated a strength for (`edgeStrengthEditIsAssertable`
 * false) renders an unchangeable value and nothing anywhere says why.
 *
 * §2 pins that gap EXPLICITLY, in both directions, because a gap recorded in the
 * suite is honest and a gap invisible to it is how the four comments survived.
 * It is not closed here: the reason exists as data (`editConnectedIds`,
 * `CANONICAL_EDIT_AUTHORITY`) but the sentence a user would read does not, and
 * `sectionWriterNoticeText` is written for interventions ("no effect on any
 * factor yet"). Widening one predicate to answer two questions is trap 21, and
 * authoring the second sentence is a copy decision with an owner.
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'

import { ModelRowView } from '../ModelRowView'
import { ModelOutline } from '../ModelOutline'
import { SECTION_WRITER_NOTICE_TESTID } from '../sectionWriterNotice'
import type { ModelRow } from '../types'

afterEach(() => cleanup())

// ─────────────────────────────────────────────────────────────────────────────
// §1 — THE ROW
// ─────────────────────────────────────────────────────────────────────────────

const EDGE_ROW: ModelRow = {
  id: 'e_cost_margin',
  kind: 'relationship',
  group: 'relationships',
  label: 'Monthly cost → Gross margin',
  labelEndpoints: ['Monthly cost', 'Gross margin'],
  primaryValue: 'Moderate negative effect',
  attention: [],
  editable: true,
}

function renderRow(editConnected: boolean) {
  cleanup()
  render(
    <ul>
      <ModelRowView
        tier="plain"
        row={EDGE_ROW}
        editConnected={editConnected}
        onSelect={vi.fn()}
        onBeginEdit={vi.fn()}
      />
    </ul>,
  )
  return screen.getByTestId(`model-row-v2-${EDGE_ROW.id}-value`)
}

describe('§1 a value cell with no writer renders no control at all', () => {
  it('POSITIVE CONTROL: with a writer, the same row DOES offer a control', () => {
    // Bound to the row by id (trap 19). Without this the assertions below could
    // pass against a component that had stopped rendering an affordance for
    // every row, and the difference would be invisible.
    const cell = renderRow(true)
    expect(cell.tagName).toBe('BUTTON')
    expect(cell).toBeEnabled()
  })

  it('THE DISCRIMINATOR: `editConnected: false` removes the control entirely', () => {
    // Same row, same value, same callbacks — only the writer changes. So what
    // §1 measures is `editConnected`, never the fixture.
    const cell = renderRow(false)
    expect(cell.tagName).toBe('SPAN')
    expect(cell.textContent).toContain('Moderate negative effect')
  })

  it('⭐ THE FOUR COMMENTS ARE WRONG: there is no disabled affordance', () => {
    renderRow(false)
    const row = screen.getByTestId(`model-row-v2-${EDGE_ROW.id}`)
    // Not "no disabled BUTTON" — nothing in the row is disabled by any means,
    // including a `fieldset`, an `aria-disabled` or an `<input>`.
    expect(row.querySelectorAll('[disabled]')).toHaveLength(0)
    expect(row.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0)
  })

  it('⭐ AND NO LABEL SAYING WHY — the cell is SILENT, per the NOT SET WALL rule', () => {
    /*
     * ⚠ ASSERTED AGAINST THE CONNECTED CELL, NOT AGAINST A TYPED STRING, AND
     * THE FIRST CUT OF THIS TEST IS WHY. It read
     * `expect(cell.textContent).toBe('Moderate negative effect')` and went RED
     * on `'↓Moderate negative effectModerate eff…'` — the leaf renders a
     * direction glyph and carries the full text alongside its clipped copy for
     * assistive tech. A hand-typed expectation encodes the author's picture of
     * the DOM; comparing the two arms encodes the PROPERTY.
     *
     * The property: losing the writer removes the CONTROL and adds NOTHING. If
     * a reason label is ever put here, the two arms diverge by exactly that
     * label and this REDs — which is where that decision gets recorded.
     */
    const withWriter = renderRow(true).textContent
    const withoutWriter = renderRow(false).textContent
    expect(withWriter, 'CONTROL: the cell must say something in the first place').toBeTruthy()
    expect(withoutWriter).toBe(withWriter)
    expect(
      within(screen.getByTestId(`model-row-v2-${EDGE_ROW.id}-value`)).queryByRole('button'),
    ).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §2 — THE SECTION: where the reason IS carried, and where it is not
// ─────────────────────────────────────────────────────────────────────────────

function outlineRow(over: Partial<ModelRow> & Pick<ModelRow, 'id' | 'kind' | 'group'>): ModelRow {
  return {
    label: over.id,
    primaryValue: null,
    attention: [],
    editable: true,
    ...over,
  } as ModelRow
}

/**
 * One blocked-and-writerless row in EACH group, so the two arms differ only in
 * the group and the attention reason — the shapes the notice keys on.
 */
const OUTLINE_ROWS: ModelRow[] = [
  outlineRow({
    id: 'opt-1',
    kind: 'option',
    group: 'options',
    label: 'Hire a tech lead',
    attention: ['missing-intervention'],
  }),
  outlineRow({
    id: 'e-1',
    kind: 'relationship',
    group: 'relationships',
    label: 'Monthly cost → Gross margin',
    primaryValue: 'Moderate negative effect',
    attention: ['unconfirmed-estimate'],
  }),
]

/** Neither row has a writer: the set is deliberately empty of both ids. */
const NO_WRITERS = new Set<string>(['fac-unrelated'])

function renderOutline() {
  cleanup()
  render(
    <ModelOutline
      rows={OUTLINE_ROWS}
      tier="plain"
      filter=""
      selectedId={null}
      onSelect={vi.fn()}
      onBeginEdit={vi.fn()}
      onGroupAction={vi.fn()}
      editConnectedIds={NO_WRITERS}
    />,
  )
}

describe('§2 the sanctioned reason-surface reaches options and not relationships', () => {
  it('POSITIVE CONTROL: the OPTIONS section names what it cannot resolve', () => {
    // The notice mechanism works. Without this, §2's absence below would be
    // consistent with a notice component that never renders anywhere.
    renderOutline()
    expect(screen.getByTestId(SECTION_WRITER_NOTICE_TESTID('options'))).toBeTruthy()
  })

  it('⭐ THE PINNED GAP: the RELATIONSHIPS section explains nothing', () => {
    // A relationship the server never stated a strength for shows a value the
    // user cannot change, and no surface anywhere gives the reason. This is a
    // KNOWN, OPEN gap, recorded here rather than left invisible — see the
    // header for why it is not closed in this commit. If it IS closed, this
    // test REDs and the closing commit has to come here and say so.
    renderOutline()
    expect(screen.queryByTestId(SECTION_WRITER_NOTICE_TESTID('relationships'))).toBeNull()
  })

  it('CONTROL: the relationship row really is on screen and really has no writer', () => {
    // Guards the gap-pin from passing because the fixture never rendered.
    renderOutline()
    const cell = screen.getByTestId('model-row-v2-e-1-value')
    expect(cell.tagName, 'the row must be writerless for the gap to be the gap').toBe('SPAN')
  })
})
