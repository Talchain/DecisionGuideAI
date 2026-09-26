/**
 * CanvasLegendPopover — brief scope 4: a "How to read this" toolbar disclosure
 * that opens on click (keyboard: Enter/Space), is dismissible, and renders ONLY the approved
 * legend strings (A4) with no Claude-authored copy and no "node/edge/graph"
 * vocabulary.
 *
 * ⚠ UNRUN IN THE LANE THAT LAST EDITED THIS FILE (18 Sep 2026). No suite, no
 * typecheck and no install were executed — the cost constraints for that lane
 * forbade all three. CI at this head is the authority for whether it is green.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  CanvasLegendPopover,
  CLASSIFIED_METRIC_NOUNS,
  visibleMetricRows,
} from '../CanvasLegendPopover'
import { DECISION_NODE_LABEL, CANVAS_STRENGTH_BANDS } from '../../domain/vocabulary'
import { CURRENT_MODEL_NOUN, METRIC_NOUN, METRIC_LEGEND_ROWS, METRIC_UNSET, OPTION_RESULT_COPY, SENSITIVITY_RANK_LEGEND_NOUN } from '../../nodes/shared/metricVocabulary'
import { useCanvasStore } from '../../store'
import { EDGE_STROKE_WIDTH_BANDS, UNSET_EDGE_STROKE_WIDTH } from '../../utils/graphDisplayCalculations'

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
 * Drive the THREE axes the legend reads, INDEPENDENTLY.
 *
 * They are separate parameters because every defect this file guards lived in a
 * cell where two of them disagree — `optionNumbering` is append-only and no
 * results transition clears it, so `status !== 'complete'` with numbered nodes
 * is reachable and durable; and `est.`'s marker needs an inferred factor AND
 * standard view, so "the factor is mounted but expert view hides its marker" is
 * a cell a combined helper could not produce.
 *
 * ⚠ ONE TYPE, SHARED BY `setBoard` AND `openBoard`. They drifted the moment the
 * third axis was added — `openBoard` kept the two-axis literal and the typecheck
 * gate caught three TS2353s — which is the hand-maintained mirror (trap 12) in
 * miniature, inside a spec file. Naming it once makes a new axis reach both.
 */
type BoardOpts = { numberedNodes?: boolean; inferredFactor?: boolean; expertView?: boolean }

function setBoard(status: Status, opts: BoardOpts = {}): void {
  const numbered = opts.numberedNodes ?? false
  // ⭐ THE THIRD AXIS, AND IT IS SEPARATE FOR THE SAME REASON THE SECOND IS.
  // `est.`'s marker is gated on `isInferred && !isDetailed` — a NODE fact AND a
  // BOARD setting — so the cell that matters is "an inferred factor is mounted
  // AND expert view is on", where the marking is off screen while the factor is
  // still there. A helper that tied the two together could not produce it.
  const inferred = opts.inferredFactor ?? false
  const nodes = [
    ...(numbered ? [{ id: 'option-1', type: 'option', position: { x: 0, y: 0 }, data: {} }] : []),
    ...(inferred
      ? [{
          id: 'factor-inferred',
          type: 'factor',
          position: { x: 0, y: 0 },
          // The SAME field `FactorNode:304` reads — `data.observedState.extractionType`.
          data: { observedState: { extractionType: 'inferred' } },
        }]
      : []),
  ]
  useCanvasStore.setState({
    results: { status, progress: 0 },
    nodes,
    optionNumbering: numbered ? { 'option-1': 1 } : {},
    viewMode: opts.expertView ? 'expert' : 'standard',
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
//
// ⚠⚠ AND THIS LIST WENT STALE EXACTLY AS PREDICTED, WITHOUT FAILING LOUD ABOUT
// THE RIGHT THING. The two connection rows were rewritten in this PR's own
// first commit ("…: established" / "…: less certain" → the doubt wording) and
// this file was not touched, so `renders exactly the approved legend strings`
// was RED on two `getByText` calls at head `6e4ce7d7`. The mirror did fail — but
// it fails as "string missing", which reads like a rendering regression rather
// than "someone edited the copy and left me behind", and nothing else in the
// suite says which. Recorded rather than smoothed over: it is the cost of the
// mirror this comment already concedes, and the reason the strings below are
// the ONLY approved-copy assertion in the file.

// ⚠ AND THE THICKNESS WORDS COME FROM `CANVAS_STRENGTH_BANDS` FOR THE SAME REASON
// (18 Sep 2026). They were listed here as literals — `'Weak effect',
// 'Moderate effect', 'Strong effect'` — which made this allowlist a mirror of
// a mirror: the legend restated the vocabulary and this spec restated the
// legend, so all three could agree while none matched the words the canvas
// edge chip printed. "Weak effect" in particular appeared in exactly two
// places in the repo, the legend and this line, and nowhere a user could reach
// it except through the legend itself.
const THICKNESS_LABELS = CANVAS_STRENGTH_BANDS.map(b => `${b.label} effect`)

const APPROVED = [
  DECISION_NODE_LABEL, 'Option', 'Factor', 'Outcome', 'Risk', 'Goal', 'Outside your control',
  'Raises', 'Lowers',
  // ⭐ REWRITTEN 23 Sep 2026 — the locked connector grammar ("dash = existence
  // certainty only"). Solid is still TWO existence populations (nobody stated a
  // likelihood; somebody stated one at or above `EDGE_VALUE_BAND_CUTS.high`),
  // and since the contest dash was removed it ALSO carries Olumi's review
  // disagreements. So the caption is scoped to what the line reads — the
  // MODEL's likelihood — and a separate row says where the review's view is.
  // `CanvasLegendPopover.connectorGrammar.spec.tsx` pins the derivation.
  'Solid: the model records little or no doubt that this connection exists',
  // Experience Design's banked D3 wording: existence, and nothing else.
  'Dashed: lower certainty that this connection exists is recorded',
  'Other review disagreements: shown when you open the connection',
  // ⚠ The three thickness literals are replaced by the derivation above —
  // keeping them would make this allowlist a mirror of a mirror.
  ...THICKNESS_LABELS,
]

/**
 * A row this key renders in EVERY phase and posture, used below purely as a
 * "the popover is populated" discrimination check — an absence assertion needs
 * a presence assertion beside it or it passes on an empty container (trap 13).
 * Derived, because this file has just finished proving what a literal does.
 */
const THICKNESS_SENTINEL = `${CANVAS_STRENGTH_BANDS[0].label} effect`

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

  // The folded-in effect-strength scale renders ONE SAMPLE PER BAND (was the
  // standalone EdgeThicknessLegend; now one consolidated key). P2.9: thickness
  // means effect strength (weight magnitude) in both phases, so the labels read
  // "effect" not "influence".
  //
  // ⭐ THE COMPLETENESS HALF IS THE POINT, AND A LIST OF THREE `getByText`
  // CALLS COULD NOT SEE IT. The key had three rows against four vocabulary
  // bands, so it named a thickness after a band that did not exist ("Weak
  // effect") while two real bands shared one rung. Asserting the COUNT as well
  // as the words is what REDs if a band is added to the vocabulary and the
  // legend silently keeps teaching the old ladder.
  it('renders one thickness sample per strength band, named by the canonical word', () => {
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    for (const label of THICKNESS_LABELS) {
      expect(screen.getByText(label), `the key does not name the "${label}" band`).toBeDefined()
    }
    const swatches = document.querySelectorAll('[data-testid^="legend-thickness-"]')
    // +1 for the unset floor row, which is not a band.
    expect(
      swatches.length,
      'the thickness key does not carry exactly one swatch per band plus the unset floor',
    ).toBe(CANVAS_STRENGTH_BANDS.length + 1)
    // …and "Weak effect" is retired: it named a rung two bands wide.
    expect(screen.queryByText('Weak effect')).toBeNull()
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

  // ⭐ 23 Sep 2026: orange is narrowed to a SIGN disagreement between Olumi's
  // two review passes, in Experience Design's banked wording (no "your call").
  it('explains the ONE reserved colour: orange means the review passes disagree on direction', () => {
    open()
    expect(screen.getByText("Orange: Olumi's two review passes disagree on direction")).toBeInTheDocument()
  })

  it('explains grey as "not stated yet", the signal with no other channel', () => {
    open()
    expect(screen.getByText('Grey: direction not set yet')).toBeInTheDocument()
    expect(screen.getByText('No strength suggested: thin and grey')).toBeInTheDocument()
  })

  /**
   * ⭐⭐ N1 — ONE POPOVER MUST NOT LABEL TWO DIFFERENT CONDITIONS WITH THE SAME
   * WORDS (CLAUDE.md trap 21, at the level of rendered copy).
   *
   * The thickness key's unset row was labelled "Not set yet: thin and grey",
   * which is `resolveEdgeSignedStrengthDisplay(...).show === false` — NOBODY
   * SUPPLIED A FIGURE. The cards then began printing `METRIC_UNSET.standalone`,
   * the literal string "Not set yet", for a DIFFERENT condition —
   * `strengthIsHumanSettled(...) === false`, nobody SETTLED it — and the two
   * are reachable apart: a drafted board carries a producer's figure on every
   * bridge and a human's verdict on none, so the card says "Not set yet" beside
   * a line that is thick and POLARITY-COLOURED. A reader using this row as the
   * key to that card is being taught the exact opposite of what they can see.
   *
   * ⚠ ASSERTED AGAINST THE CONSTANT, NOT A LITERAL. If the card's wording
   * changes, this guard follows it; a re-typed string here would be the mirror
   * (trap 12) and would stop guarding the moment the two drifted.
   */
  it('⭐ N1: the thickness key does not reuse the card\'s "not settled" wording', () => {
    open()
    const swatch = screen.getByTestId('legend-thickness-unset')
    const rowText = swatch.closest('div')?.textContent ?? ''
    // Discrimination first: we are reading the right row, and it is not empty.
    expect(rowText, 'the unset thickness row read empty — this guard is blind').toContain('thin and grey')
    expect(rowText, `the thickness row opens with "${METRIC_UNSET.standalone}", the cards' settlement wording — two conditions, one label`)
      .not.toMatch(new RegExp(`^\\s*${METRIC_UNSET.standalone}`))
    // …and the card's own row IS still present under that wording, so the
    // absence above is a de-collision, not a deletion.
    const dialog = screen.getByRole('dialog').textContent ?? ''
    expect(dialog).toContain(METRIC_UNSET.standalone)
  })

  /**
   * The row's caption is a claim ABOUT ITS OWN SWATCH, so the text assertion
   * above cannot check it. This shipped for a review cycle with a hard-coded
   * body-coloured stroke: the two rows rendered pixel-identical while the
   * caption said "grey". Assert the stroke, and assert the two rows DIFFER — a
   * discriminating pair, not one reading in isolation.
   *
   * ⭐ UPDATED 8 Sep 2026, AND THE WIDTH ASSERTION IS NOW INVERTED. It used to
   * read `expect(unset...).toBe(weak...)` with the comment "Same width — which
   * is precisely why the colour has to carry the meaning". That was a true
   * guard on a real defect: `UNSET_EDGE_STROKE_WIDTH` equalled the weakest
   * measured band, so the legend could only be honest via colour. The canvas
   * now draws an unset strength strictly THINNER than any measurement, so this
   * guard flips: the caption says "thin and grey" and BOTH halves must now be
   * true of the swatch. Asserting sameness here would re-pin the defect.
   *
   * Widths are read from the imported constants, never from literals — the
   * legend derives its swatches from the same source, so a literal here would
   * be a mirror of a mirror.
   */
  it('draws the unset swatch grey AND thinner than the thinnest measured band', () => {
    open()
    const unset = document.querySelector('[data-testid="legend-thickness-unset"] line') as SVGLineElement
    // The thinnest band, reached BY ID rather than by the word that used to
    // label it — the id survives a vocabulary change, the word does not.
    const thinnestId = CANVAS_STRENGTH_BANDS[0].id
    const thinnest = document.querySelector(`[data-testid="legend-thickness-${thinnestId}"] line`) as SVGLineElement
    expect(unset).toBeTruthy()
    expect(thinnest).toBeTruthy()

    // GREY — the row says "thin and grey"; this is the "grey".
    expect(unset.getAttribute('stroke')).toBe('var(--edge-neutral)')
    expect(unset.getAttribute('stroke')).not.toBe(thinnest.getAttribute('stroke'))

    // THIN — bound to the constants, and asserted as an ORDERING so it cannot
    // pass on two arbitrary different numbers.
    const unsetW = Number(unset.getAttribute('stroke-width'))
    const thinnestW = Number(thinnest.getAttribute('stroke-width'))
    expect(unsetW, 'the unset swatch does not render the canvas\'s unset width').toBe(UNSET_EDGE_STROKE_WIDTH)
    expect(thinnestW, 'the thinnest band swatch does not render the canvas\'s width for that band').toBe(EDGE_STROKE_WIDTH_BANDS[thinnestId])
    expect(
      unsetW,
      'the legend draws "no strength suggested" at or above the thinnest measured band — it is teaching the reader to mistake a blank for a finding',
    ).toBeLessThan(thinnestW)
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
    //
    // ⚠⚠ AND IT IS THREE AXES, NOT TWO. `est.` was asserted here while its row
    // was `() => true`, so this arm passed on a board carrying NO inferred
    // factor — i.e. the completeness claim was being made about a marking the
    // board did not have. Mounting one is what makes "every marking is on the
    // cards" true of the fixture rather than merely asserted about it.
    setBoard('complete', { numberedNodes: true, inferredFactor: true })
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
    //
    // ⭐ ED #63 5799353114 decision 2: "Rename 'Support' → 'Current model'
    // wherever that result family remains visible". The canvas captions the
    // comparative family `Current model` (the option card's own caption,
    // `OPTION_RESULT_COPY.current`), so that — not `METRIC_NOUN.support`, which
    // the panel-owned surfaces still read — is the noun the key must explain.
    setBoard('complete', { numberedNodes: true })
    open()
    const text = screen.getByRole('dialog').textContent ?? ''
    const canvasCaptions = Object.values({ ...METRIC_NOUN, support: CURRENT_MODEL_NOUN })
    expect(canvasCaptions).toHaveLength(Object.keys(METRIC_NOUN).length)
    for (const noun of canvasCaptions) {
      expect(text, `"${noun}" is captioned on a card but absent from the key`).toContain(noun)
    }
    // The noun the key explains IS the caption the option card prints (one
    // noun per idea, across the key and the card)…
    expect(OPTION_RESULT_COPY.current).toBe(CURRENT_MODEL_NOUN)
    // …and the literal, so the register changing its own word is noticed (trap 12d).
    expect(text).toContain('Current model')
    // ED decision 2's second half: the explanation ON SCREEN says it is
    // conditional on the model and its assumptions, and is not a
    // recommendation — the property, read from the row the key renders.
    const currentModelRow = METRIC_LEGEND_ROWS.find(r => r.noun === CURRENT_MODEL_NOUN)!
    expect(text).toContain(currentModelRow.gloss)
    expect(currentModelRow.gloss).toMatch(/\bmodel\b/)
    expect(currentModelRow.gloss).toMatch(/\bassumptions?\b/)
    expect(currentModelRow.gloss).toMatch(/not a recommendation/)
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
    // ⭐ ED #63 5799353114 decisions 1–2: the canvas no longer says "Support"
    // for this result family, nor "Most supported" for a leader. A key that
    // explained both would document the confusion rather than end it.
    //
    // ⚠ NO LEADING `\b`. `textContent` glues adjacent rows together — the row
    // before this one ends "…suggested this", so a retired noun would read
    // "thisSupport:" and a word-boundary probe would MISS it (measured: a
    // `\bSupport\b` probe stayed green with the noun reverted to "Support").
    // The probe below is bounded on the right only, and a noun-element probe
    // (each row's noun is its own <span>) sits beside it.
    const RETIRED_SUPPORT = /Support(?![a-z])/
    expect(text).not.toMatch(RETIRED_SUPPORT)
    expect(screen.queryByText(METRIC_NOUN.support)).toBeNull()
    expect(text).not.toMatch(/most supported/i)
    expect(text).not.toMatch(/most-supported/i)
    // Discrimination: the popover HAS text and the live noun IS there, so the
    // absences above are not passing on an empty container.
    expect(text.length).toBeGreaterThan(200)
    expect(text).toContain(CURRENT_MODEL_NOUN)
    expect(screen.getByText(CURRENT_MODEL_NOUN)).toBeInTheDocument()
    // …and the retired-word probe can fire on GLUED text, the shape it meets.
    expect(RETIRED_SUPPORT.test(`Olumi suggested this${METRIC_NOUN.support}: on option cards`)).toBe(true)
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
  function openBoard(status: Status, opts: BoardOpts = {}): string {
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
      expect(without).toContain(THICKNESS_SENTINEL)
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
    expect(text).toContain(THICKNESS_SENTINEL)
    expect(Object.keys(useCanvasStore.getState().optionNumbering)).toHaveLength(1)
  })

  /**
   * ⚠ THE OTHER DIRECTION, AND IT IS NOT OPTIONAL (trap 22b). One change is
   * guarding two opposite harms: showing a row that describes nothing, and
   * hiding a row that describes something live. A guard watching one door would
   * bless a fix that emptied the section.
   */
  it('⭐ OPPOSITE DIRECTION: the status-independent nouns appear at every status', () => {
    // Derived at the cards: `Strength` and `Not set yet` both come from
    // `bridgeEdgeData`, a memo over `state.edges`/`state.nodes` alone, and
    // `est.` is `FactorNode`'s `isInferred` (`data.observedState`). No results
    // term in any of them.
    //
    // ⚠ CORRECTED 3 Sep 2026 — this comment also credited `est.` to
    // `RiskNode:265` / `OutcomeNode:267` `bridgeIsEstimated`. Gone: those cards
    // no longer print a figure for an unset strength, so there is nothing there
    // for `est.` to qualify.
    //
    // ⚠⚠ CORRECTED AGAIN — the title said "the three ALWAYS-LIVE nouns", and
    // `est.` was never one. Its marker is gated on `isInferred && !isDetailed`
    // and TWO OF ITS THREE PRODUCERS WERE DELETED by the change this file
    // guards. "Status-independent" is the true claim: no results term, but a
    // board term. The arm therefore MOUNTS AN INFERRED FACTOR — the same fact
    // the card reads — instead of asserting `est.` on an empty board, which is
    // what let the unconditional row through.
    for (const status of ALL_STATUSES) {
      const text = openBoard(status, { inferredFactor: true })
      expect(text, `[${status}] "${METRIC_NOUN.strength}" is live but withheld`).toContain(METRIC_NOUN.strength)
      expect(text, `[${status}] "est." is live but withheld`).toContain('est.')
      expect(text, `[${status}] "${METRIC_UNSET.standalone}" is live but withheld`).toContain(METRIC_UNSET.standalone)
      cleanup()
    }
  })

  /**
   * ⭐⭐ N2 — THE DISCRIMINATING TRIPLE FOR `est.` (trap 19).
   *
   * The row shipped `() => true` while two of the marker's three production
   * sites were deleted in the same change. Absence alone is what a blind probe
   * reports, so all three cells are asserted from the same reader, and the two
   * withholding cells fail for DIFFERENT reasons — one because the board setting
   * hides the marker everywhere, one because no card carries the fact.
   */
  it('⭐ N2: "est." is shown only where its marker can actually render', () => {
    // (a) Inferred factor, standard view — the marker's own gate is satisfied.
    const shown = openBoard('idle', { inferredFactor: true })
    expect(shown, '"est." withheld while its marker can render').toContain('est.')
    cleanup()

    // (b) EXPERT VIEW. `FactorNode:911` is `isInferred && !isDetailed`, and
    // `isDetailed` is `viewMode === 'expert'` — BOARD-level, so the marker
    // renders on NO card. This is the definitive half of the finding.
    const expert = openBoard('idle', { inferredFactor: true, expertView: true })
    expect(expert, 'expert view: the key explains a marking no card can render').not.toContain('est.')
    // Discrimination — the popover is populated and the inferred factor IS
    // still mounted, so this absence is the gate's doing, not an empty board.
    expect(expert).toContain(THICKNESS_SENTINEL)
    expect(useCanvasStore.getState().nodes.some(n => n.type === 'factor')).toBe(true)
    cleanup()

    // (c) Standard view, NO inferred factor — nothing on the board carries the
    // marking. Fails for a different reason than (b), which is the point.
    const noFactor = openBoard('idle')
    expect(noFactor, 'no inferred factor is mounted, but the key promises one').not.toContain('est.')
    expect(noFactor).toContain(THICKNESS_SENTINEL)
    cleanup()
  })

  /**
   * ⭐⭐ THE COMPLETENESS GUARD — the one that survives the next edit.
   *
   * `METRIC_ROW_VISIBLE` is keyed by noun, and three of its keys are re-typed
   * literals with no exported constant (~~`#1, #2, #3`~~ — now
   * `SENSITIVITY_RANK_LEGEND_NOUN`, imported — the ordinal row, `est.`).
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

    // …and the classification is EXERCISED, not merely present: with all axes
    // true every row shows, with all false only the unconditional ones do.
    const ALL_ON = { isPostAnalysis: true, ordinalsOnScreen: true, estimateMarkersOnScreen: true }
    const ALL_OFF = { isPostAnalysis: false, ordinalsOnScreen: false, estimateMarkersOnScreen: false }
    const all = visibleMetricRows(ALL_ON).map(r => r.noun)
    const none = visibleMetricRows(ALL_OFF).map(r => r.noun)
    expect(all).toEqual(registerNouns)
    // ⭐ `METRIC_UNSET.standalone` joins the always-live set, and PRE-RUN is
    // exactly where it earns its place: a drafted model arrives with every
    // bridge strength unset, so this is the row a first-time reader most needs.
    // ⚠ `est.` LEFT this set — its marker has a board-level gate, so it is not
    // unconditional. See the N2 triple above.
    expect(none).toEqual([METRIC_NOUN.strength, METRIC_UNSET.standalone])
    // The three axes are INDEPENDENT — no one of them implies another.
    expect(visibleMetricRows({ ...ALL_OFF, ordinalsOnScreen: true }).map(r => r.noun)).toContain(ORDINAL_NOUN)
    expect(visibleMetricRows({ ...ALL_ON, ordinalsOnScreen: false }).map(r => r.noun)).not.toContain(ORDINAL_NOUN)
    expect(visibleMetricRows({ ...ALL_OFF, estimateMarkersOnScreen: true }).map(r => r.noun)).toContain('est.')
    expect(visibleMetricRows({ ...ALL_ON, estimateMarkersOnScreen: false }).map(r => r.noun)).not.toContain('est.')
  })

  /**
   * ⭐⭐⭐ THE MISSING DIRECTION — A DELETED PRODUCER MUST RED.
   *
   * ⛔ WHY THIS TEST EXISTS. The guard above is bidirectional between the
   * REGISTER and the CLASSIFIER, and that is not the axis the defect used. Both
   * of its directions are satisfied by a noun whose CARD CODE HAS BEEN DELETED:
   * the row is still in the register, the classifier still names it, the two
   * still agree — and the marking is on no card. `est.` walked out through
   * exactly that gap. Its production sites went `FactorNode:911` +
   * `RiskNode:265` + `OutcomeNode:267` → `FactorNode:911` alone, in the same
   * change, and every existing assertion here stayed green.
   *
   * So the third axis is NOUN → PRODUCER, read from the source the cards are
   * actually built from rather than from a list someone remembers to update
   * (CLAUDE.md trap 12: derive, do not mirror).
   *
   * ⚠ WHAT THIS CAN AND CANNOT PROVE (trap 12d — a derived guard proves
   * agreement, never completeness). It proves each classified noun still has at
   * least one site that renders it. It does NOT prove the site is reachable, and
   * it does not prove the row's PREDICATE matches that site's gate — that is
   * what the per-row arms above are for. A guard that claimed more than this
   * would be the confident-instrument failure it exists to prevent.
   *
   * ⚠ IF THIS REDs, RE-DERIVE THE PRODUCER — DO NOT DELETE THE PROBE. A pattern
   * that stops matching means the marking moved or died, and both are answers
   * the legend needs.
   */
  const NODES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'nodes')

  /**
   * Each classified noun's card-side producer: the files that can put the
   * marking on screen, and a pattern bound to the marking's IDENTITY rather
   * than to incidental formatting (trap 19).
   */
  const NOUN_PRODUCERS: ReadonlyArray<{
    noun: string
    files: readonly string[]
    pattern: RegExp
  }> = [
    // ⚠ PRODUCER RE-DERIVED (locked node-card design, 23 Sep 2026; ED 11:52Z
    // point 4: "Do not use `Support` as the result label"). The option card
    // still renders this quantity — the share of simulated runs — as its
    // model-relative readout "N% of runs" (`OPTION_RESULT_COPY.share`), and the
    // register row's gloss now names that caption.
    // ⚠ NOUN RE-DERIVED (ED #63 5799353114 decision 2): the row's HEADING is
    // now `CURRENT_MODEL_NOUN` ("Current model"), the caption the card prints;
    // `METRIC_NOUN.support` stays the panel-owned surfaces' anchor.
    { noun: CURRENT_MODEL_NOUN, files: ['OptionNode.tsx'], pattern: /OPTION_RESULT_COPY\.share\(/ },
    { noun: METRIC_NOUN.chance, files: ['GoalNode.tsx', 'OutcomeNode.tsx'], pattern: /METRIC_NOUN\.chance/ },
    // ⚠ PATTERN RE-DERIVED, CLAIM UNCHANGED. FactorNode no longer reaches the
    // influence caption through `METRIC_NOUN.influence`: it calls
    // `influenceBasisNoun(provenance)`, which returns 'Relative influence' for
    // both stamped bases and fail-closes to the plain noun. The figure is
    // max-normalised at the producer, so the bare noun invited an absolute
    // reading — and the basis was disclosed only through <Tooltip>/title, which
    // a shared-link reader never opens and a touch reader cannot.
    // This probe asks "does a card still render this marking"; it binds to the
    // new producer by identity, exactly as the header requires. The noun in the
    // manifest stays METRIC_NOUN.influence because that is the LEGEND's row.
    // ⚠ RE-DERIVED AGAIN (locked design, 23 Sep 2026): the factor card's bar is
    // now the relative DRIVER line (`FactorDriverLine`), which owns the basis
    // noun and the relative-to-strongest disclosure this row explains.
    { noun: METRIC_NOUN.influence, files: ['FactorNode.tsx'], pattern: /<FactorDriverLine\b/ },
    // ⚠ RE-DERIVED (locked design, 23 Sep 2026; ED 11:52Z point 5): the noun is
    // now "Link strength" (`METRIC_NOUN.strength`'s value).
    // ⚠ RE-DERIVED AGAIN (contract v3.1, gap U1): the outcome/risk card row
    // (`LinkStrengthRow`) is deleted — "Outcome/risk records are distinct from
    // the strength of their connections". The card-side producer left is the
    // factor card's `EdgePills` (Detailed); the edge hover also says it.
    { noun: METRIC_NOUN.strength, files: ['shared/EdgePills.tsx'], pattern: /LINK_STRENGTH_COPY\.noun/ },
    // ⚠ PATTERN AND NOUN BOTH RE-DERIVED; THE CLAIM IS UNCHANGED. The comment
    //   here read "The rank badge prints the numeral itself — there is no noun
    //   constant", and BaseNode's JSX was `#{displayMetadata.sensitivityRank}`.
    //   Both were true and both described the defect: a marking whose entire
    //   visible copy was a numeral, which a reader takes for a placing. The
    //   badge now renders `sensitivityRankBadgeLabel(...)` — `Key driver 1` —
    //   so the noun constant exists and the probe binds to the builder call,
    //   which is this marking's identity now (trap 19).
    // ⚠ RE-DERIVED (locked design, 23 Sep 2026; ED 02:31Z D1a): the corner
    // badge is RETIRED; the rank is stated once, on the factor card's driver
    // line ("Driver N of M analysed"), and the heading moved with it.
    { noun: SENSITIVITY_RANK_LEGEND_NOUN, files: ['FactorNode.tsx'], pattern: /<FactorDriverLine\b/ },
    { noun: ORDINAL_NOUN, files: ['OptionNode.tsx'], pattern: /\{stableOptionNumber\}/ },
    // ⚠ RE-DERIVED (locked design, 23 Sep 2026): a link with NO value reads
    // "Link strength · not set yet" — the register's inline form — through the
    // shared row both cards mount (MT-15b: an unconfirmed producer value now
    // reads as Olumi's estimate instead).
    // ⚠ RE-DERIVED (contract v3.1, gap U1): `LinkStrengthRow` is deleted; the
    // unset link pill in `EdgePills` is the remaining card-side producer.
    {
      noun: METRIC_UNSET.standalone,
      files: ['shared/EdgePills.tsx'],
      pattern: /LINK_STRENGTH_COPY\.notSet/,
    },
    // ⭐ THE ONE THE DEFECT WAS IN. Three sites → one; this is what would have
    // REDded had it gone to zero, and what will RED if the last one goes.
    // v3.1 #21 (26 Sep, WS4): the mark now takes its route to the source detail
    // (`onOpenSource`), so the element carries props — still one self-closing tag.
    { noun: 'est.', files: ['FactorNode.tsx'], pattern: /<EstimateMarker\b[^>]*\/>/ },
  ]

  function nodeSource(file: string): string {
    return readFileSync(join(NODES_DIR, file), 'utf8')
  }

  it('⭐ INSTRUMENT CONTROLS: the scanner reads real files and can tell present from absent', () => {
    // Positive control — the sources are non-empty. A probe that read nothing
    // would agree with every absence claim in silence (trap 13).
    for (const { files } of NOUN_PRODUCERS) {
      for (const f of files) {
        expect(nodeSource(f).length, `${f} read empty — the scan is blind, not clean`).toBeGreaterThan(1000)
      }
    }
    // Contrast control — a pattern that IS present matches, and one that is
    // deliberately absent does NOT. Without the negative half, a scanner that
    // matched everything would score a perfect run.
    expect(nodeSource('FactorNode.tsx')).toMatch(/<EstimateMarker\b[^>]*\/>/)
    expect(nodeSource('FactorNode.tsx')).not.toMatch(/<ThisMarkingDoesNotExist\s*\/>/)
    // …and the manifest itself cannot go short: every classified noun is in it.
    expect([...NOUN_PRODUCERS].map(p => p.noun).sort()).toEqual([...CLASSIFIED_METRIC_NOUNS].sort())
  })

  it('⭐⭐ every classified noun still has a card that renders it', () => {
    for (const { noun, files, pattern } of NOUN_PRODUCERS) {
      const hits = files.filter(f => pattern.test(nodeSource(f)))
      expect(
        hits.length,
        `"${noun}" is explained by the key but NO card renders it any more — ` +
        `${pattern} matches none of ${files.join(', ')}. Re-derive the producer; ` +
        `if the marking is genuinely gone, remove its row rather than this probe.`,
      ).toBeGreaterThan(0)
    }
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
