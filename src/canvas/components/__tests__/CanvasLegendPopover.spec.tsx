/**
 * CanvasLegendPopover — brief scope 4: a "How to read this" toolbar disclosure
 * that opens on click (keyboard: Enter/Space), is dismissible, and renders ONLY the approved
 * legend strings (A4) with no Claude-authored copy and no "node/edge/graph"
 * vocabulary.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  CanvasLegendPopover,
  PRE_ANALYSIS_METRIC_NOUNS,
  metricRowsForPhase,
} from '../CanvasLegendPopover'
import { DECISION_NODE_LABEL } from '../../domain/vocabulary'
import { METRIC_NOUN, METRIC_LEGEND_ROWS } from '../../nodes/shared/metricVocabulary'
import { useCanvasStore } from '../../store'

/**
 * ⭐ THE PHASE IS NOW A RENDER INPUT, SO EVERY TEST IN THIS FILE HAS A PHASE —
 * including the ones written before there was one.
 *
 * `results.status` defaults to `'idle'` (`store.ts:2659`), so a bare
 * `render(<CanvasLegendPopover />)` is a PRE-RUN reader. That is the state the
 * defect shipped in and the state most of this file exercises; the post-run
 * arms set it explicitly and put it back.
 */
function setPhase(status: 'idle' | 'complete'): void {
  useCanvasStore.setState({ results: { status, progress: 0 } } as never)
}

// The store is a module singleton, so a phase set by one test leaks into the
// next file-order-dependently. Both hooks, so the reset holds whether a test
// threw or passed.
beforeEach(() => setPhase('idle'))
afterEach(() => setPhase('idle'))

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

  it('POST-RUN: explains every number the cards print, noun and gloss', () => {
    // ⚠ THIS ARM IS NOW EXPLICITLY POST-RUN. It used to run at the default
    // `idle` status and assert all seven rows — which is precisely the defect:
    // five of them describe markings no pre-run card renders. The completeness
    // claim is true, and it is true AFTER A RUN.
    setPhase('complete')
    open()
    const text = screen.getByRole('dialog').textContent ?? ''
    for (const row of METRIC_LEGEND_ROWS) {
      expect(text, `the legend never says "${row.noun}"`).toContain(row.noun)
      expect(text, `"${row.noun}" is named but not explained`).toContain(row.gloss)
    }
  })

  it('POST-RUN: explains the four captions a reader meets on a card', () => {
    // Named explicitly as well as derived — so deleting a noun from the
    // register cannot make the derived test above pass by iterating less.
    setPhase('complete')
    open()
    const text = screen.getByRole('dialog').textContent ?? ''
    for (const noun of Object.values(METRIC_NOUN)) {
      expect(text, `"${noun}" is captioned on a card but absent from the key`).toContain(noun)
    }
  })

  it('⭐ CONTRAST: the RETIRED synonyms appear nowhere in the key', () => {
    // Post-run, because the discrimination at the foot of this test asserts the
    // LIVE noun `Ahead` is present — and `Ahead` is a post-run caption.
    setPhase('complete')
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


/**
 * ⭐⭐⭐ DEFECT B — THE KEY DOCUMENTED MARKINGS THAT WERE ON NO CARD.
 *
 * Witnessed on the deployed build `bd18bace`: the row *"1, 2, 3 on an option…"*
 * described a badge carried by NONE of the four option cards, established by
 * full leaf enumeration including `sr-only` at two scales with a contrast
 * control that did find a single-digit badge elsewhere. Enumerating the rest
 * found FIVE rows in the same state — `Ahead`, `Chance`, `Influence`,
 * `#1, #2, #3` and the ordinals — all post-run vocabulary, all shown to a
 * pre-run reader.
 *
 * ⚠ WHY THESE ARM AGAINST THE SPLIT FUNCTION AND NOT A RE-DERIVED LIST. A spec
 * that recomputed which rows "ought" to be post-run would be a guard agreeing
 * with itself (CLAUDE.md 13b) — it would encode the same classification the
 * component encodes and pass whenever the two agreed, including when both are
 * wrong. These assert the OBSERVABLE consequence instead: what a reader can
 * read in each phase, plus the two structural properties that keep the
 * classification honest as the register grows.
 */
describe('CanvasLegendPopover — the key describes only what is on screen (Defect B)', () => {
  function openIn(status: 'idle' | 'complete'): string {
    setPhase(status)
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByTestId('btn-canvas-legend'))
    return screen.getByRole('dialog').textContent ?? ''
  }

  /**
   * ⭐ THE DISCRIMINATING PAIR (CLAUDE.md trap 19). Absence alone is what a
   * blind probe reports too, so each post-run noun is asserted ABSENT pre-run
   * and PRESENT post-run, in the same test, from the same reader. A probe that
   * could not see the numbers section at all would fail the post-run half.
   */
  it('⭐ the five post-run nouns are absent pre-run and present post-run', () => {
    const postRunOnly = METRIC_LEGEND_ROWS
      .filter(r => !PRE_ANALYSIS_METRIC_NOUNS.includes(r.noun))
      .map(r => r.noun)

    // POSITIVE CONTROL: there is something to assert. An empty list would
    // satisfy both loops below in silence (trap 13).
    expect(postRunOnly.length).toBe(5)

    const pre = openIn('idle')
    for (const noun of postRunOnly) {
      expect(pre, `pre-run, the key still promises "${noun}" — the shipped defect`).not.toContain(noun)
    }

    cleanup() // a second render in one test would leave two dialogs in the DOM
    const post = openIn('complete')
    for (const noun of postRunOnly) {
      expect(post, `post-run, the key has stopped explaining "${noun}"`).toContain(noun)
    }
  })

  /**
   * The named row from the witness, pinned by itself. The derived test above
   * iterates a filter; if that filter ever went empty this would still RED.
   */
  it('⭐ the ordinal row — the witnessed one — is withheld from a pre-run reader', () => {
    const row = METRIC_LEGEND_ROWS.find(r => r.noun === '1, 2, 3 on an option')
    expect(row, 'the ordinal row has left the register — re-derive this guard').toBeDefined()

    const pre = openIn('idle')
    expect(pre).not.toContain(row!.noun)
    expect(pre).not.toContain(row!.gloss)
    // Discrimination: the popover IS rendered and IS populated, so the two
    // absences above are not passing on an empty container.
    expect(pre.length).toBeGreaterThan(200)
    expect(pre).toContain('Weak effect')
  })

  /**
   * ⚠ THE OTHER DIRECTION, AND IT IS NOT OPTIONAL (CLAUDE.md trap 22b). One
   * predicate is guarding two opposite harms here: showing a row that describes
   * nothing, and hiding a row that describes something live. A guard that only
   * watched the first would bless a fix that emptied the section.
   */
  it('⭐ OPPOSITE DIRECTION: the two genuinely pre-run nouns still appear pre-run', () => {
    // Derived at the cards: `Strength` is `bridgeStrengthPct != null` over
    // `state.edges` alone (RiskNode:247, OutcomeNode:253) and `est.` is
    // `observedState.extractionType === 'inferred'` / `weightSource !== 'user'`
    // (FactorNode:911, RiskNode:265, OutcomeNode:267). No results term in any
    // of them.
    const pre = openIn('idle')
    expect(pre).toContain(METRIC_NOUN.strength)
    expect(pre).toContain('est.')
    for (const noun of PRE_ANALYSIS_METRIC_NOUNS) {
      const row = METRIC_LEGEND_ROWS.find(r => r.noun === noun)
      expect(row, `"${noun}" is classified pre-run but is not in the register`).toBeDefined()
      expect(pre, `"${noun}" is live pre-run but its gloss is withheld`).toContain(row!.gloss)
    }
  })

  /**
   * ⭐⭐ THE COMPLETENESS GUARD — this is the one that survives the next edit.
   *
   * `PRE_ANALYSIS_METRIC_NOUNS` is an allow-list, and an allow-list is a
   * hand-maintained mirror of a register that lives in another file (CLAUDE.md
   * trap 12). The component's runtime DEFAULT is safe — an unclassified noun is
   * treated as post-run, so it is withheld rather than falsely promised — but a
   * safe default is not a decision. This REDs so the decision gets made.
   */
  it('⭐ every register noun is classified, and every classified noun is in the register', () => {
    const registerNouns = METRIC_LEGEND_ROWS.map(r => r.noun)

    // Direction 1 — the mirror cannot name something that no longer exists.
    // `'est.'` has no exported constant and is the one re-typed literal in the
    // component; this is the assertion that catches it being renamed.
    for (const noun of PRE_ANALYSIS_METRIC_NOUNS) {
      expect(registerNouns, `"${noun}" is classified pre-run but no register row uses it`).toContain(noun)
    }

    // Direction 2 — the register cannot grow a row this file has not placed.
    // Every noun must be resolvable to exactly one phase.
    const preSet = metricRowsForPhase(false).map(r => r.noun)
    const postSet = metricRowsForPhase(true).map(r => r.noun)
    expect(postSet).toEqual(registerNouns)
    for (const noun of registerNouns) {
      const inPre = preSet.includes(noun)
      const classified = PRE_ANALYSIS_METRIC_NOUNS.includes(noun)
      expect(
        inPre,
        `"${noun}" renders pre-run but is not in PRE_ANALYSIS_METRIC_NOUNS ` +
          '(or vice versa) — classify it against its card gate, do not guess',
      ).toBe(classified)
    }
  })

  it('the vocabulary ban survives in both phases', () => {
    for (const status of ['idle', 'complete'] as const) {
      const text = openIn(status).toLowerCase()
      expect(text, `"node" leaked into the ${status} key`).not.toMatch(/\bnode\b/)
      expect(text, `"edge" leaked into the ${status} key`).not.toMatch(/\bedge\b/)
      expect(text, `"graph" leaked into the ${status} key`).not.toMatch(/\bgraph\b/)
      cleanup() // a second render in one test would leave two dialogs in the DOM
    }
  })
})
