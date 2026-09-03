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
  CLASSIFIED_METRIC_NOUNS,
  visibleMetricRows,
} from '../CanvasLegendPopover'
import { DECISION_NODE_LABEL } from '../../domain/vocabulary'
import { METRIC_NOUN, METRIC_LEGEND_ROWS, METRIC_UNSET } from '../../nodes/shared/metricVocabulary'
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
/**
 * ⚠ THE `ResultsStatus` UNION, IN FULL — not the two values this file used to
 * drive. A two-value corpus (`idle` / `complete`) is exactly what let F1 ship:
 * it could not express "a status other than complete, with badges still on the
 * board", which is the state a user reaches with one labelled button.
 */
const ALL_STATUSES = ['idle', 'preparing', 'connecting', 'streaming', 'complete', 'error', 'cancelled'] as const
type Status = (typeof ALL_STATUSES)[number]

/**
 * Drive the two axes the legend reads, INDEPENDENTLY.
 *
 * They are separate parameters because the defect lived in the cell where they
 * disagree — `optionNumbering` is append-only and no results transition clears
 * it, so `status !== 'complete'` with numbered nodes is reachable and durable.
 * A helper that set them together could not have produced that cell.
 */
function setBoard(status: Status, opts: { numberedNodes?: boolean } = {}): void {
  const numbered = opts.numberedNodes ?? false
  useCanvasStore.setState({
    results: { status, progress: 0 },
    nodes: numbered ? [{ id: 'option-1', type: 'option', position: { x: 0, y: 0 }, data: {} }] : [],
    optionNumbering: numbered ? { 'option-1': 1 } : {},
  } as never)
}

/** The common case: a phase with no ordinals registered. */
function setPhase(status: Status): void {
  setBoard(status)
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
    // ⚠ THIS ARM DRIVES THE BOARD WHERE EVERY MARKING IS ACTUALLY ON SCREEN.
    // It used to run at the default `idle` status and assert all seven rows —
    // which is precisely the original defect: five of them describe markings no
    // pre-run card renders. It then ran at `complete` alone, and THAT was wrong
    // too, in the way F1 names: `complete` does not imply badges, so the
    // completeness claim has to state BOTH axes. The claim is "when every
    // marking is on the cards, every marking is explained".
    setBoard('complete', { numberedNodes: true })
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
    setBoard('complete', { numberedNodes: true })
    open()
    const text = screen.getByRole('dialog').textContent ?? ''
    for (const noun of Object.values(METRIC_NOUN)) {
      expect(text, `"${noun}" is captioned on a card but absent from the key`).toContain(noun)
    }
  })

  it('⭐ CONTRAST: the RETIRED synonyms appear nowhere in the key', () => {
    // Post-run, because the discrimination at the foot of this test asserts the
    // LIVE noun `Ahead` is present — and `Ahead` is a post-run caption.
    setBoard('complete', { numberedNodes: true })
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
 * found FIVE rows in the same state.
 *
 * ⚠⚠ AND THEN THE FIRST FIX GOT THE ORDINAL ROW WRONG IN THE OPPOSITE
 * DIRECTION, WHICH IS WHY THIS BLOCK LOOKS THE WAY IT DOES. Gating every
 * withheld row on `results.status === 'complete'` withheld the ordinal row on
 * every OTHER status — while `optionNumbering`, which is append-only and
 * untouched by `resultsAnalysing()` / `resultsError()` / `resultsReset()`, still
 * had the cards showing `1 2 3`. One labelled button reaches it: Run, then
 * "Clear results".
 *
 * ⭐ THE CORPUS IS WHAT LET THAT THROUGH. The old arms drove exactly two values,
 * `idle` and `complete`, so the failing cell — a non-complete status WITH
 * badges — was not merely unasserted, it was INEXPRESSIBLE. These arms drive the
 * whole `ResultsStatus` union and drive the two axes independently.
 *
 * ⚠ THEY ARM AGAINST `visibleMetricRows`, THE FUNCTION THE COMPONENT RENDERS
 * THROUGH — a spec that recomputed which rows "ought" to show would be a guard
 * agreeing with itself (CLAUDE.md 13b). What is asserted is the OBSERVABLE
 * consequence: what a reader can read in each board state.
 */
describe('CanvasLegendPopover — the key describes only what is on screen (Defect B)', () => {
  function openBoard(status: Status, opts: { numberedNodes?: boolean } = {}): string {
    setBoard(status, opts)
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByTestId('btn-canvas-legend'))
    return screen.getByRole('dialog').textContent ?? ''
  }

  const ORDINAL_NOUN = '1, 2, 3 on an option'
  /** The rows whose card gate really is the phase. The ordinal row is NOT one. */
  const PHASE_GATED = METRIC_LEGEND_ROWS
    .map(r => r.noun)
    .filter(n => n !== ORDINAL_NOUN && ![METRIC_NOUN.strength, METRIC_UNSET.standalone, 'est.'].includes(n))

  it('POSITIVE CONTROL: there are phase-gated rows, and an ordinal row, to assert', () => {
    // Every loop below iterates one of these. An empty list satisfies them all
    // in silence (trap 13).
    expect(PHASE_GATED.length).toBe(4)
    expect(METRIC_LEGEND_ROWS.some(r => r.noun === ORDINAL_NOUN)).toBe(true)
  })

  /**
   * ⭐ THE DISCRIMINATING PAIR (trap 19). Absence alone is what a blind probe
   * reports too, so each phase-gated noun is asserted ABSENT pre-run and PRESENT
   * post-run, from the same reader.
   */
  it('⭐ the four phase-gated nouns are absent pre-run and present post-run', () => {
    const pre = openBoard('idle')
    for (const noun of PHASE_GATED) {
      expect(pre, `pre-run, the key still promises "${noun}" — the shipped defect`).not.toContain(noun)
    }
    cleanup()
    const post = openBoard('complete')
    for (const noun of PHASE_GATED) {
      expect(post, `post-run, the key has stopped explaining "${noun}"`).toContain(noun)
    }
  })

  /**
   * ⭐⭐ F1 — THE ROW FOLLOWS THE BADGE, NOT THE RUN.
   *
   * Driven across the WHOLE `ResultsStatus` union, both ways round. This is the
   * arm the two-value corpus could not contain: five of these seven statuses
   * were unreachable by the old helper.
   */
  it('⭐⭐ the ordinal row is shown exactly when a badge is on screen — at EVERY status', () => {
    for (const status of ALL_STATUSES) {
      // Badges on the board: the row MUST be there, whatever the status.
      const withBadges = openBoard(status, { numberedNodes: true })
      expect(
        withBadges,
        `[${status}] the cards carry ordinals and the key does not explain them — F1`,
      ).toContain(ORDINAL_NOUN)
      // Discrimination: the popover is populated, so this is not passing on air.
      expect(withBadges.length).toBeGreaterThan(200)
      cleanup()

      // No badges: the row must be withheld. The opposite direction, same status.
      const without = openBoard(status, { numberedNodes: false })
      expect(
        without,
        `[${status}] no card carries an ordinal, but the key promises one — the original defect`,
      ).not.toContain(ORDINAL_NOUN)
      expect(without).toContain('Weak effect')
      cleanup()
    }
  })

  /**
   * ⭐ THE CELL THE REVIEWER MEASURED, PINNED BY NAME rather than only inside
   * the loop above. `complete` → `resultsReset()` leaves `optionNumbering`
   * intact, so this is the state a user is in after clicking "Clear results".
   */
  it('⭐ after a run is cleared, the badges remain and so does the row', () => {
    setBoard('complete', { numberedNodes: true })
    // The product's own transition, not a hand-built state: reset the results
    // and assert the numbering SURVIVES, which is the premise of the defect.
    useCanvasStore.getState().resultsReset()
    const numbering = useCanvasStore.getState().optionNumbering
    expect(Object.keys(numbering), 'resultsReset() cleared the numbering — re-derive F1').toHaveLength(1)
    expect(useCanvasStore.getState().results.status, 'resultsReset() left the status at complete').not.toBe('complete')

    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByTestId('btn-canvas-legend'))
    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text, 'the badges survived the reset and the key stopped explaining them').toContain(ORDINAL_NOUN)
  })

  /**
   * ⭐ THE TIGHTER CLAIM, PINNED — otherwise it is unguarded and a later hand
   * "simplifies" it back.
   *
   * The review would have accepted `Object.keys(optionNumbering).length > 0`.
   * The component goes tighter and intersects the map with the MOUNTED nodes,
   * because `optionNumbering` is append-only: a number left behind for a node
   * that is no longer on the board would otherwise make the row promise a badge
   * nobody can see — the same DIRECTION of error this whole change closes. A
   * tighter predicate that nothing asserts is a tighter predicate that will not
   * survive contact with a refactor.
   */
  it('⭐ a number left for an UNMOUNTED node does not bring the row back', () => {
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 },
      // The map remembers an option that is no longer on the board…
      optionNumbering: { 'option-gone': 3 },
      // …and the board holds a different node, which carries no number.
      nodes: [{ id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, data: {} }],
    } as never)
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByTestId('btn-canvas-legend'))
    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text, 'no mounted card carries an ordinal, but the key promises one').not.toContain(ORDINAL_NOUN)
    // Discrimination: the popover is populated and the map really is non-empty,
    // so this is not passing on an empty container or an empty map.
    expect(text).toContain('Weak effect')
    expect(Object.keys(useCanvasStore.getState().optionNumbering)).toHaveLength(1)
  })

  /**
   * ⚠ THE OTHER DIRECTION, AND IT IS NOT OPTIONAL (trap 22b). One change is
   * guarding two opposite harms: showing a row that describes nothing, and
   * hiding a row that describes something live. A guard watching one door would
   * bless a fix that emptied the section.
   */
  it('⭐ OPPOSITE DIRECTION: the three always-live nouns appear at every status', () => {
    // Derived at the cards: `Strength` and `Not set yet` both come from
    // `bridgeEdgeData`, a memo over `state.edges`/`state.nodes` alone, and
    // `est.` is `FactorNode`'s `isInferred` (`data.observedState`). No results
    // term in any of them.
    //
    // ⚠ CORRECTED 3 Sep 2026 — this comment also credited `est.` to
    // `RiskNode:265` / `OutcomeNode:267` `bridgeIsEstimated`. Gone: those cards
    // no longer print a figure for an unset strength, so there is nothing there
    // for `est.` to qualify.
    for (const status of ALL_STATUSES) {
      const text = openBoard(status)
      expect(text, `[${status}] "${METRIC_NOUN.strength}" is live but withheld`).toContain(METRIC_NOUN.strength)
      expect(text, `[${status}] "est." is live but withheld`).toContain('est.')
      expect(text, `[${status}] "${METRIC_UNSET.standalone}" is live but withheld`).toContain(METRIC_UNSET.standalone)
      cleanup()
    }
  })

  /**
   * ⭐⭐ THE COMPLETENESS GUARD — the one that survives the next edit.
   *
   * `METRIC_ROW_VISIBLE` is keyed by noun, and three of its keys are re-typed
   * literals with no exported constant (`#1, #2, #3`, the ordinal row, `est.`).
   * That is a hand-maintained mirror of a register in another file (trap 12).
   * The component's runtime default is safe — an unclassified noun is withheld
   * rather than falsely promised — but a safe default is not a decision.
   */
  it('⭐ every register noun is classified, and every classified noun is in the register', () => {
    const registerNouns = METRIC_LEGEND_ROWS.map(r => r.noun)

    // Direction 1 — the mirror cannot name something that no longer exists.
    for (const noun of CLASSIFIED_METRIC_NOUNS) {
      expect(registerNouns, `"${noun}" is classified but no register row uses it`).toContain(noun)
    }
    // Direction 2 — the register cannot grow a row this file has not placed.
    for (const noun of registerNouns) {
      expect(CLASSIFIED_METRIC_NOUNS, `"${noun}" is in the register but unclassified — place it against its card gate, do not guess`).toContain(noun)
    }

    // …and the classification is EXERCISED, not merely present: with both axes
    // true every row shows, with both false only the always-live ones do.
    const all = visibleMetricRows({ isPostAnalysis: true, ordinalsOnScreen: true }).map(r => r.noun)
    const none = visibleMetricRows({ isPostAnalysis: false, ordinalsOnScreen: false }).map(r => r.noun)
    expect(all).toEqual(registerNouns)
    // ⭐ `METRIC_UNSET.standalone` joins the always-live set, and PRE-RUN is
    // exactly where it earns its place: a drafted model arrives with every
    // bridge strength unset, so this is the row a first-time reader most needs.
    expect(none).toEqual([METRIC_NOUN.strength, METRIC_UNSET.standalone, 'est.'])
    // The two axes are INDEPENDENT — neither implies the other.
    expect(visibleMetricRows({ isPostAnalysis: false, ordinalsOnScreen: true }).map(r => r.noun)).toContain(ORDINAL_NOUN)
    expect(visibleMetricRows({ isPostAnalysis: true, ordinalsOnScreen: false }).map(r => r.noun)).not.toContain(ORDINAL_NOUN)
  })

  it('the vocabulary ban survives at every status', () => {
    for (const status of ALL_STATUSES) {
      const text = openBoard(status, { numberedNodes: true }).toLowerCase()
      expect(text, `"node" leaked into the ${status} key`).not.toMatch(/\bnode\b/)
      expect(text, `"edge" leaked into the ${status} key`).not.toMatch(/\bedge\b/)
      expect(text, `"graph" leaked into the ${status} key`).not.toMatch(/\bgraph\b/)
      cleanup()
    }
  })
})
