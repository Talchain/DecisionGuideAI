/**
 * THE MODEL TAB DRAWS THE PRODUCT'S OWN SHAPES, NOT ITS OWN CHARACTERS.
 *
 * ⛔ THE DEFECT, reported by Paul from the served build: the outline rendered a
 * monochrome Unicode glyph from `KIND_GLYPH`, a map private to this tab, while
 * SIXTEEN other files render `NodeShapeIndicator` — the Design System v4 shape
 * channel, coloured SVG, every node kind. The one surface that lists the model
 * BY NAME was the only one not speaking the product's visual language.
 *
 * ⚠⚠ AND THE MAP CONTRADICTED THE CANONICAL COMPONENT, which is why this is a
 * correctness test and not a styling preference:
 *
 *     kind      NodeShapeIndicator     KIND_GLYPH (before)
 *     factor    circle                 '●'  circle
 *     option    SQUARE                 '○'  CIRCLE      ← diverged
 *
 * The two most numerous kinds differed only by FILL here while being
 * circle-vs-square everywhere else. `KIND_GLYPH`'s own comment claimed it "names
 * the same kinds the same way" as the canvas. It did not, and its cited
 * authority (`EntityBar`) is itself Model-tab-local.
 *
 * ⭐⭐ EVERY ASSERTION RENDERS `ModelRowView`. The first draft of this file
 * exercised `NodeShapeIndicator` on its own and passed — WHILE THE ROW STILL
 * RENDERED A CHARACTER. A test that cannot see the thing it was written to
 * protect is the defect this session has already blocked two PRs for, and it was
 * committed here inside the fix for it.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import { KIND_GLYPH } from '../rowPresentation'
import type { ModelRow, ModelElementKind } from '../types'

function row(kind: ModelElementKind, id: string): ModelRow {
  return { id, kind, group: 'factors', label: `Label ${id}`, primaryValue: '45 days', attention: [], editable: true }
}

const NODE_KINDS: ModelElementKind[] = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome']

const glyphCell = (id: string) => screen.getByTestId(`model-row-v2-${id}-glyph`)

describe('the Model outline speaks the canvas vocabulary', () => {
  it('⭐ every node kind renders the CANONICAL SVG SHAPE in the row, not a character', () => {
    render(<>{NODE_KINDS.map((k, i) => <ModelRowView key={k} row={row(k, `r${i}`)} tier="plain" />)}</>)
    for (let i = 0; i < NODE_KINDS.length; i++) {
      const cell = glyphCell(`r${i}`)
      expect(cell.querySelector('svg'), `${NODE_KINDS[i]} must render an SVG shape in the row`).not.toBeNull()
      // Colour comes from the entity token. A grey character carries none.
      expect(cell.innerHTML, `${NODE_KINDS[i]} must carry an entity colour token`).toContain('var(--')
      // And the old character must be gone from the cell.
      expect(cell.textContent ?? '').not.toContain(KIND_GLYPH[NODE_KINDS[i]])
    }
  })

  it('⛔ DISCRIMINATING: option and factor render DIFFERENT markup in the row', () => {
    // The exact pair that was wrong — option was a circle here and a square
    // everywhere else. Rendered through the ROW, so a regression in the row's
    // wiring reds this even if the component itself is still correct.
    render(<><ModelRowView row={row('option', 'o1')} tier="plain" /><ModelRowView row={row('factor', 'f1')} tier="plain" /></>)
    expect(glyphCell('o1').innerHTML).not.toBe(glyphCell('f1').innerHTML)
  })

  it('⚠ `relationship` keeps its glyph — an edge has no node shape', () => {
    // Inventing one would assert a kind the domain does not have. This pins the
    // exemption so it is a decision rather than an oversight.
    render(<ModelRowView row={{ ...row('relationship', 'e1'), group: 'relationships' }} tier="plain" />)
    expect(glyphCell('e1')).toHaveTextContent('→')
    expect(glyphCell('e1').querySelector('svg')).toBeNull()
  })

  it('the kind is still NAMED, not left to the shape alone', () => {
    render(<ModelRowView row={row('option', 'o1')} tier="plain" />)
    expect(glyphCell('o1')).toHaveAttribute('aria-label', 'Option')
  })
})
