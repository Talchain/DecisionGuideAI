/**
 * CanvasLegendPopover — brief scope 4: a "How to read this" toolbar disclosure
 * that opens on click (keyboard: Enter/Space), is dismissible, and renders ONLY the approved
 * legend strings (A4) with no Claude-authored copy and no "node/edge/graph"
 * vocabulary.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasLegendPopover } from '../CanvasLegendPopover'
import { DECISION_NODE_LABEL } from '../../domain/vocabulary'
import { METRIC_NOUN, METRIC_LEGEND_ROWS } from '../../nodes/shared/metricVocabulary'

// ⚠ THE NODE-TYPE WORD COMES FROM THE VOCABULARY CONSTANT, NOT A LITERAL.
// The approved list is a hand-maintained mirror of what the legend renders;
// hardcoding the word here would make this spec the very mirror
// `DECISION_NODE_LABEL` was introduced to abolish, and it would go stale the
// next time the word changes rather than failing loud.
const APPROVED = [
  DECISION_NODE_LABEL, 'Option', 'Factor', 'Outcome', 'Risk', 'Goal', 'Outside your control',
  'Raises', 'Lowers', 'Solid connection: established', 'Dashed connection: less certain',
  'Weak effect', 'Moderate effect', 'Strong effect',
]

describe('CanvasLegendPopover', () => {
  it('is closed initially and opens on click', () => {
    render(<CanvasLegendPopover />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    expect(screen.getByRole('dialog', { name: 'How to read this' })).toBeDefined()
  })

  it('renders exactly the approved legend strings (and never "Choice")', () => {
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    for (const s of APPROVED) {
      expect(screen.getByText(s)).toBeDefined()
    }
    expect(screen.queryByText('Choice')).toBeNull()
  })

  it('uses no technical vocabulary (node / edge / graph) in rendered copy', () => {
    const { container } = render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    const text = (container.textContent ?? '').toLowerCase()
    expect(text).not.toMatch(/\bnode\b/)
    expect(text).not.toMatch(/\bedge\b/)
    expect(text).not.toMatch(/\bgraph\b/)
  })

  it('closes on Escape', () => {
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    expect(screen.getByRole('dialog')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Regression: a real mouse click fires `focus` (on mousedown) before `click`.
  // The trigger must still end up OPEN after that sequence — focus must not
  // pre-toggle and let the following click immediately close it.
  it('opens on a real click even when focus fires first', () => {
    render(<CanvasLegendPopover />)
    const btn = screen.getByRole('button', { name: 'How to read this' })
    fireEvent.focus(btn)
    fireEvent.click(btn)
    expect(screen.getByRole('dialog', { name: 'How to read this' })).toBeDefined()
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  // A second click closes it again — local open-state toggles cleanly without a
  // shared store (the former edge-thickness suppression flag is gone).
  it('toggles closed on a second click', () => {
    render(<CanvasLegendPopover />)
    const btn = screen.getByRole('button', { name: 'How to read this' })
    fireEvent.click(btn)
    expect(screen.getByRole('dialog', { name: 'How to read this' })).toBeDefined()
    fireEvent.click(btn)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // The folded-in effect-strength scale renders its three samples (was the
  // standalone EdgeThicknessLegend; now one consolidated key). P2.9: thickness
  // means effect strength (weight magnitude) in both phases, so the labels read
  // "effect" not "influence".
  it('renders the effect-strength thickness scale', () => {
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    expect(screen.getByText('Weak effect')).toBeDefined()
    expect(screen.getByText('Moderate effect')).toBeDefined()
    expect(screen.getByText('Strong effect')).toBeDefined()
  })
})

/**
 * R6 + L-49 (Paul, 16 Aug 2026) — the key now covers COLOUR and the honest
 * blanks, which is what it was missing.
 *
 * ⚠ Note for whoever edits this file next: the `APPROVED` list above is a
 * hand-maintained copy of the component's own rows, and the test that consumes
 * it asserts PRESENCE only — adding a row can never fail it. So new rows need
 * their own assertions, which is what these are. It cannot prove the key is
 * COMPLETE either; only a reader comparing it against StyledEdge can do that.
 */
describe('CanvasLegendPopover — colour and honest blanks (R6 / L-49)', () => {
  function open() {
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByTestId('btn-canvas-legend'))
  }

  it('explains the ONE reserved colour: orange means the reviews disagree', () => {
    open()
    expect(screen.getByText('Orange: reviews disagree — your call')).toBeInTheDocument()
  })

  it('explains grey as "not stated yet", the signal with no other channel', () => {
    open()
    expect(screen.getByText('Grey: direction not set yet')).toBeInTheDocument()
    expect(screen.getByText('Not set yet: thin and grey')).toBeInTheDocument()
  })

  /**
   * The row's caption is a claim ABOUT ITS OWN SWATCH, so the text assertion
   * above cannot check it. This shipped for a review cycle with a hard-coded
   * body-coloured stroke: at 1.5px it is the same WIDTH as "Weak effect", so
   * colour is the only discriminator, and the two rows rendered pixel-identical
   * while the caption said "grey". Assert the stroke, and assert the two rows
   * DIFFER — a discriminating pair, not one reading in isolation.
   */
  it('draws the unset swatch grey, and distinguishably from "Weak effect"', () => {
    open()
    const unset = document.querySelector('[data-testid="legend-thickness-unset"] line') as SVGLineElement
    const weak = document.querySelector('[data-testid="legend-thickness-weak"] line') as SVGLineElement
    expect(unset).toBeTruthy()
    expect(weak).toBeTruthy()

    expect(unset.getAttribute('stroke')).toBe('var(--edge-neutral)')
    // Same width — which is precisely why the colour has to carry the meaning.
    expect(unset.getAttribute('stroke-width')).toBe(weak.getAttribute('stroke-width'))
    // …and therefore the two swatches must not be identical.
    expect(unset.getAttribute('stroke')).not.toBe(weak.getAttribute('stroke'))
  })

  it('still teaches direction, and still says Raises / Lowers', () => {
    open()
    expect(screen.getByText('Raises')).toBeInTheDocument()
    expect(screen.getByText('Lowers')).toBeInTheDocument()
  })

  it('keeps the vocabulary constraint on the new rows too', () => {
    const { container } = render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByTestId('btn-canvas-legend'))
    const text = (container.textContent ?? '').toLowerCase()
    expect(text).not.toMatch(/\bnode\b/)
    expect(text).not.toMatch(/\bedge\b/)
    expect(text).not.toMatch(/\bgraph\b/)
  })
})

/**
 * ⭐⭐ THE NUMBERS SECTION — Paul, 31 Aug 2026: "one noun per idea, and a legend
 * where the model is — not in a panel."
 *
 * ⚠ THESE ARE PER-ROW ASSERTIONS ON PURPOSE. The `APPROVED` presence list at
 * the top of this file is, by its own note, additive-blind: adding a row can
 * never fail it. So a numbers section bolted on with no assertions of its own
 * would be invisible to this suite — present, unpinned, and free to rot. Each
 * row is derived from `METRIC_LEGEND_ROWS` rather than re-typed, so the spec
 * cannot drift from the register the cards read.
 */
describe('CanvasLegendPopover — the numbers (Paul, 31 Aug 2026)', () => {
  function open() {
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByTestId('btn-canvas-legend'))
  }

  it('POSITIVE CONTROL: there are rows to assert', () => {
    // Every assertion below iterates the register. An empty register would
    // satisfy all of them silently (trap 13).
    expect(METRIC_LEGEND_ROWS.length).toBeGreaterThan(4)
  })

  it('explains every number the cards print, noun and gloss', () => {
    open()
    const text = screen.getByRole('dialog').textContent ?? ''
    for (const row of METRIC_LEGEND_ROWS) {
      expect(text, `the legend never says "${row.noun}"`).toContain(row.noun)
      expect(text, `"${row.noun}" is named but not explained`).toContain(row.gloss)
    }
  })

  it('explains the four captions a reader meets on a card', () => {
    // Named explicitly as well as derived — so deleting a noun from the
    // register cannot make the derived test above pass by iterating less.
    open()
    const text = screen.getByRole('dialog').textContent ?? ''
    for (const noun of Object.values(METRIC_NOUN)) {
      expect(text, `"${noun}" is captioned on a card but absent from the key`).toContain(noun)
    }
  })

  it('⭐ CONTRAST: the RETIRED synonyms appear nowhere in the key', () => {
    // The point of the change, stated as a test. A legend that explained both
    // "Ahead" and "Leads" would document the confusion rather than end it —
    // and this is the assertion that REDs if a later hand "helpfully" adds the
    // old word back as a parenthetical.
    open()
    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text).not.toContain('Leads')
    expect(text).not.toContain('Achievement')
    expect(text).not.toContain('Chance of leading')
    // Discrimination: the popover HAS text and the live noun IS there, so the
    // three absences above are not passing on an empty container.
    expect(text.length).toBeGreaterThan(200)
    expect(text).toContain(METRIC_NOUN.ahead)
  })

  it('the numbers copy respects the popover vocabulary ban', () => {
    // The container-level ban already runs above; this names the offending
    // section, which the container assertion cannot do.
    const joined = METRIC_LEGEND_ROWS.map(r => `${r.noun} ${r.gloss}`).join(' ').toLowerCase()
    expect(joined).not.toMatch(/\bnode\b/)
    expect(joined).not.toMatch(/\bedge\b/)
    expect(joined).not.toMatch(/\bgraph\b/)
  })
})
