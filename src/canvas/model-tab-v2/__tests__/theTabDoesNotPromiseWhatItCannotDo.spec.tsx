/**
 * ⭐⭐ THE MODEL TAB MAY NOT INSTRUCT AN ACTION IT CANNOT PERFORM.
 *
 * Three sentences on the live Model tab, measured at `bdf4fb89`, told the user to
 * do something this surface has no affordance for. They are one defect class, not
 * three bugs: the copy describes a product that was designed and the wiring
 * describes the one that shipped.
 *
 * The standing ruling this applies: a GAP is acceptable where a LIE is not. In
 * every case below the instruction is what gives way, and the honest half — the
 * provenance, the state, the distinction — is kept.
 *
 * ── THE MEASUREMENT THAT UNDERWRITES ALL THREE ───────────────────────────────
 *
 * There is NO label-write affordance anywhere in `model-tab-v2/`. Swept at
 * `bdf4fb89`: `EditableLabel|onRename|structuralRename|contentEditable|
 * renameNode` returns ZERO across all 17 non-test source files of this
 * directory. Two controls fired in the same sweep, so the zero is a fact about
 * the directory and not about the probe:
 *   · app-wide contrast: the same symbols hit 34 files under `src/`;
 *   · in-directory contrast: `onFocusOnCanvas` hits 12 files HERE.
 * And `ModelDetailRegion.tsx:261` renders the label as a read-only `<h3>`.
 *
 * ⛔ NO WRITER IS ADDED BY THIS CHANGE. A label editor on this surface is a
 * separate capability and is deliberately not smuggled in behind a copy fix.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import { ValueProvenanceKey } from '../ValueProvenanceKey'
import { ATTENTION_MARK, ATTENTION_LABEL, UNWRITTEN_QUESTION_TITLE } from '../rowPresentation'
import type { ModelRow } from '../types'
import {
  GOAL_LABEL_FROM_BRIEF_TESTID,
  GOAL_LABEL_FROM_BRIEF_COPY,
} from '../../domain/goalLabelProvenance'
import { DECISION_NODE_LABEL, UNCONFIRMED_ESTIMATE_LABEL } from '../../domain/vocabulary'

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

// ── DEFECT 2 · the goal row ──────────────────────────────────────────────────

/**
 * WAS: 'Taken from your brief — not yet confirmed as your goal. Edit it to say
 *       what you want to achieve.'
 * NOW: 'Taken from your brief — not yet confirmed as your goal.'
 *
 * The imperative was unperformable HERE. The row's own neighbouring comment had
 * already conceded it — "the one place to act stays the Analysis tab" — a tab
 * Paul has ruled out of scope, so the sentence was pointing off the product.
 */
describe('⭐ DEFECT 2 — the goal row states provenance and stops there', () => {
  const EXPECTED = 'Taken from your brief. Not yet confirmed as your goal.'

  it('renders the no-editor notice, asserted as the exact string', () => {
    render(
      <>
        <ModelRowView row={row({ id: 'g1', kind: 'goal', group: 'goal', labelFromBrief: true })} tier="plain" />
        {/* A confusable sibling: same group, NOT from the brief. A query that
            matched the wrong node would fail rather than pass quietly. */}
        <ModelRowView row={row({ id: 'g2', kind: 'goal', group: 'goal' })} tier="plain" />
      </>,
    )

    const pills = screen.getAllByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)
    expect(pills).toHaveLength(1)
    // ⚠ EXACT, not `toContain`. Reverting to `.notice` appends the imperative,
    // which `toContain` would still accept — the whole defect would survive the
    // guard written to stop it.
    expect(pills[0]).toHaveAttribute('title', EXPECTED)
  })

  it('⚠ carries NO imperative — the specific words that were false here', () => {
    render(<ModelRowView row={row({ id: 'g1', kind: 'goal', group: 'goal', labelFromBrief: true })} tier="plain" />)

    const title = screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID).getAttribute('title') ?? ''
    // ⚠ CASE-INSENSITIVE, AND NOT PEDANTRY. The sibling assertion in the D3 block
    // used a case-SENSITIVE `not.toContain` and a mutant that restored the
    // imperative with different capitalisation walked straight past it — the
    // estate's own mint-check lesson, reproduced inside a guard written to stop it.
    expect(title).not.toMatch(/edit it/i)
    expect(title).not.toMatch(/\bedit\b/i)
  })

  /**
   * ⚠⚠ THE OPPOSITE-DIRECTION TWIN, AND IT IS THE ASSERTION THAT STOPS THIS FIX
   * BECOMING THE NEXT DEFECT.
   *
   * The imperative is TRUE on `pre-analysis-v3/hero/HeroSection.tsx:237-244`,
   * where the notice is VISIBLE TEXT sitting directly beneath a goal field that
   * really writes the label (`InlineField` → `store.updateNodeLabel`). Deleting
   * it from the shared constant would have removed a true, useful instruction
   * from that surface in order to fix a false one here.
   *
   * So the two sentences must BOTH continue to exist, distinctly. A later
   * "tidy-up" that collapses them in either direction REDs here:
   *   · folding `noticeNoEditHere` back into `notice` → first assertion fails;
   *   · stripping the imperative from `notice` too → second fails.
   */
  it('⚠ the editable-surface sentence KEEPS its imperative — two claims, not one', () => {
    expect(GOAL_LABEL_FROM_BRIEF_COPY.notice).toBe(
      'Taken from your brief — not yet confirmed as your goal. Edit it to say what you want to achieve.',
    )
    expect(GOAL_LABEL_FROM_BRIEF_COPY.noticeNoEditHere).toBe(EXPECTED)
    expect(GOAL_LABEL_FROM_BRIEF_COPY.notice).not.toBe(GOAL_LABEL_FROM_BRIEF_COPY.noticeNoEditHere)
  })
})

// ── DEFECT 3 · the headline question row ─────────────────────────────────────

/**
 * WAS: 'Your question is not written yet — open this to write it.'
 * NOW: 'Your question is not written yet — this highlights it on the canvas.'
 *
 * Wrong twice. (a) Clicking that very label opens nothing: it does
 * `e.stopPropagation(); onFocusOnCanvas?.(row.id)`, which reaches
 * `useFocusCamera`'s `handleFocusNode` — `selectNodeWithoutHistory` +
 * `setFocusDim` + a conditional camera fit, i.e. it selects and highlights the
 * node on the canvas. (b) The detail region a ROW click opens renders the label
 * as a read-only `<h3>` with no writer in it.
 */
describe('⭐ DEFECT 3 — the placeholder question names what the click does', () => {
  const EXPECTED = 'Your question is not written yet. This highlights it on the canvas.'

  /** A decision row still carrying the type default is the placeholder case. */
  const unwritten = () =>
    row({ id: 'q1', kind: 'decision', group: 'goal', label: DECISION_NODE_LABEL })

  it('renders the corrected sentence, asserted as the exact string', () => {
    render(<ModelRowView row={unwritten()} tier="plain" />)

    expect(screen.getByTestId('model-row-v2-q1-label')).toHaveAttribute('title', EXPECTED)
  })

  it('⚠ no longer promises a writer — neither "open" nor "write it"', () => {
    render(<ModelRowView row={unwritten()} tier="plain" />)

    const title = screen.getByTestId('model-row-v2-q1-label').getAttribute('title') ?? ''
    // ⚠ CASE-INSENSITIVE — PROVEN NECESSARY BY MEASUREMENT. As
    // `not.toContain('open this')` this assertion PASSED against a mutant reading
    // "Open this to write it.", because the revert capitalised the sentence. Only
    // the exact-string test above caught it, so this one was decorative until
    // measured.
    expect(title).not.toMatch(/open this to write it/i)
    expect(title).not.toMatch(/open this/i)
    expect(title).not.toMatch(/to write it/i)
  })

  /**
   * ⚠⚠ THE SENTENCE IS BOUND TO THE BEHAVIOUR, NOT JUST TO ITSELF. Without this,
   * the copy assertions above would keep passing if the click were rewired to do
   * something else entirely — which is precisely how the original sentence became
   * false. The new words claim a canvas highlight; this proves the click asks for
   * one, for THIS row's id.
   */
  it('⚠ and the click really does focus THIS row on the canvas', () => {
    const onFocusOnCanvas = vi.fn()
    render(
      <>
        <ModelRowView row={unwritten()} tier="plain" onFocusOnCanvas={onFocusOnCanvas} />
        {/* A confusable sibling — also a decision row, also unwritten. A click
            handler bound to the wrong row would satisfy a bare "was called". */}
        <ModelRowView
          row={row({ id: 'q2', kind: 'decision', group: 'goal', label: DECISION_NODE_LABEL })}
          tier="plain"
          onFocusOnCanvas={onFocusOnCanvas}
        />
      </>,
    )

    fireEvent.click(screen.getByTestId('model-row-v2-q1-label'))

    expect(onFocusOnCanvas).toHaveBeenCalledTimes(1)
    expect(onFocusOnCanvas).toHaveBeenCalledWith('q1')
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. The placeholder sentence must appear ONLY on the
   * placeholder. A row whose question the user has written gets its own label as
   * the title — if this greyed-out sentence leaked onto real questions it would
   * be a worse defect than the one being fixed.
   */
  it('⚠ a WRITTEN question gets its own label as the title, never the placeholder', () => {
    render(
      <ModelRowView
        row={row({ id: 'q3', kind: 'decision', group: 'goal', label: 'Do we open in Berlin?' })}
        tier="plain"
      />,
    )

    const label = screen.getByTestId('model-row-v2-q3-label')
    expect(label).toHaveAttribute('title', 'Do we open in Berlin?')
    expect(label.getAttribute('title')).not.toBe(EXPECTED)
  })
})

// ── DEFECT 4 · the legend ────────────────────────────────────────────────────

/**
 * WAS: '⚠ marks a value that still needs checking — a separate question from
 *       where it came from.'
 * NOW: 'The marks beside a row say what still needs attention — a separate
 *       question from where its value came from. Each one names itself on hover.'
 *
 * Wrong twice, and the legend was the LAST SURVIVING RENDER of a mark the
 * product had already stopped drawing. (a) That `⚠` was the only renderable
 * warning-sign glyph in this whole directory — rows draw lucide COMPONENTS from
 * `ATTENTION_MARK`, and DS §9.9 names `'⚠'` explicitly as banned. (b) The only
 * triangle drawn is `fragile`, whose meaning is 'Could flip the result' — a
 * claim about the ANSWER changing, not "a value that still needs checking",
 * which is `unconfirmed-estimate` and draws a `HelpCircle`.
 */
describe('⭐ DEFECT 4 — the legend describes the marks actually drawn', () => {
  const EXPECTED =
    'The marks beside a row say what still needs attention, not where its value ' +
    'came from. Each one names itself on hover.'

  function openKey() {
    render(<ValueProvenanceKey />)
    fireEvent.click(screen.getByTestId('model-tab-v2-provenance-key-toggle'))
    return screen.getByTestId('model-tab-v2-provenance-key')
  }

  it('renders the corrected sentence, asserted as the exact normalised text', () => {
    const key = openKey()

    // Normalised for JSX line wrapping only — the words and their order are
    // asserted whole, so any rewording REDs.
    const text = (key.textContent ?? '').replace(/\s+/g, ' ').trim()
    expect(text).toContain(EXPECTED)
  })

  it('⚠ renders NO bare warning-sign glyph anywhere in the key', () => {
    const key = openKey()

    // The glyph was this directory's last rendered `⚠`. DS §9.9 bans it, and the
    // `emoji-icon` guard could not see a bare JSX text node — which is how it
    // survived here.
    expect(key.textContent ?? '').not.toContain('⚠')
  })

  it('⚠ no longer claims the mark means "needs checking"', () => {
    const key = openKey()

    const text = (key.textContent ?? '').replace(/\s+/g, ' ').trim()
    // Case-insensitive for the same reason as the two above.
    expect(text).not.toMatch(/marks a value that still needs checking/i)
    expect(text).not.toMatch(/needs checking/i)
  })

  /**
   * ⚠⚠ WHY THE OLD SENTENCE WAS WRONG, PINNED AT THE REGISTER RATHER THAN
   * ASSERTED IN PROSE. Derived from the same maps the row renders from, so if
   * `fragile` ever did come to mean "needs checking" — or if the triangle were
   * reassigned to `unconfirmed-estimate` — this REDs and the legend's wording
   * becomes a live question again instead of quietly going stale.
   */
  it('⚠ the only triangle is `fragile`, and it does NOT mean "needs checking"', () => {
    const triangles = (Object.keys(ATTENTION_MARK) as Array<keyof typeof ATTENTION_MARK>)
      .filter(reason => ATTENTION_MARK[reason] === ATTENTION_MARK.fragile)
    expect(triangles).toEqual(['fragile'])

    expect(ATTENTION_LABEL.fragile).toBe('Could flip the result')
    // The state the old sentence actually described belongs to a DIFFERENT mark.
    expect(ATTENTION_LABEL['unconfirmed-estimate']).toBe(UNCONFIRMED_ESTIMATE_LABEL)
    expect(ATTENTION_MARK['unconfirmed-estimate']).not.toBe(ATTENTION_MARK.fragile)
  })

  /**
   * ⚠ "ON HOVER" IS A CLAIM, SO IT IS CHECKED. The marks carry both `title` and
   * `aria-label` from `ATTENTION_LABEL`. The sentence deliberately does NOT say
   * "on focus": the marks are `<span>`s with no `tabIndex`, so a keyboard user
   * cannot reach them, and promising focus would replace one false promise with
   * another.
   */
  it('⚠ each mark really does name itself on hover, and is NOT keyboard-reachable', () => {
    render(
      <ModelRowView
        row={row({ id: 'f9', attention: ['fragile', 'unconfirmed-estimate'] })}
        tier="plain"
      />,
    )

    const fragile = screen.getByTestId('model-row-v2-f9-attention-fragile')
    expect(fragile).toHaveAttribute('title', ATTENTION_LABEL.fragile)
    expect(fragile).toHaveAttribute('aria-label', ATTENTION_LABEL.fragile)
    // The honest limit of "on hover": no tab stop, so the sentence must not
    // promise focus.
    expect(fragile).not.toHaveAttribute('tabIndex')

    const unconfirmed = screen.getByTestId('model-row-v2-f9-attention-unconfirmed-estimate')
    expect(unconfirmed).toHaveAttribute('title', ATTENTION_LABEL['unconfirmed-estimate'])
  })
})

// ── THE HOUSE STYLE, ENFORCED RATHER THAN REMEMBERED ─────────────────────────

/**
 * ⭐ NO EM DASH IN PRODUCT COPY — Paul's standing ruling, 10 Sep 2026: an em dash
 * is where a hedge gets bolted on; split into sentences or cut, and keep the copy
 * tight.
 *
 * ⚠ THIS EXISTS BECAUSE THE FIRST DRAFT OF ALL THREE SENTENCES BROKE IT. The
 * strings this PR authored each carried one, inherited from the originals they
 * replaced, and nothing in the repo would have caught it. A style ruling that
 * lives only in someone's memory is re-broken by the next author, so it is
 * asserted over the ACTUAL EXPORTED STRINGS here rather than left as prose.
 *
 * ⚠ EN DASH IS BANNED TOO. It is the substitution a careful author reaches for
 * when told not to use an em dash, and it reads the same way on screen.
 *
 * ⛔ SCOPE, STATED SO THE GAP IS NOT MISTAKEN FOR COVERAGE. This covers the
 * strings THIS change authored. It is deliberately NOT a sweep of every product
 * string in the estate — `GOAL_LABEL_FROM_BRIEF_COPY.notice` still carries an em
 * dash and is asserted as unchanged above, because it belongs to the
 * pre-analysis hero rather than to this surface. A repo-wide guard is a separate
 * piece of work and would need its own allowlist discussion.
 */
describe('⭐ the copy this change authored carries no em or en dash', () => {
  const DASHES = /[—–]/

  it.each([
    ['goal notice (no writer on this surface)', GOAL_LABEL_FROM_BRIEF_COPY.noticeNoEditHere],
    ['unwritten-question title', UNWRITTEN_QUESTION_TITLE],
  ])('%s', (_name, copy) => {
    expect(copy).not.toMatch(DASHES)
    // And it is still a real sentence, not an empty string passing by default.
    expect(copy.length).toBeGreaterThan(20)
  })

  it('the provenance key legend', () => {
    render(<ValueProvenanceKey />)
    fireEvent.click(screen.getByTestId('model-tab-v2-provenance-key-toggle'))
    const legend = screen.getByTestId('model-tab-v2-provenance-key').textContent ?? ''
    expect(legend).not.toMatch(DASHES)
    expect(legend.length).toBeGreaterThan(20)
  })

  /**
   * ⚠ THE CONTROL. Without it the regex could be wrong — or the strings empty —
   * and every assertion above would pass by testing nothing. The hero's sentence
   * is the one string this change deliberately left carrying an em dash, so it
   * is the honest positive control: the probe must SEE a dash where one exists.
   */
  it('⚠ POSITIVE CONTROL: the probe detects a dash that really is there', () => {
    expect(GOAL_LABEL_FROM_BRIEF_COPY.notice).toMatch(DASHES)
  })
})
