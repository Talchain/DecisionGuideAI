/**
 * ⭐⭐ THE OPTION PANEL FENCES ITS OWN WRITERS — AND LEAVES EVERYTHING ELSE ALIVE.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `InspectorRouter` wrapped every panel body in `<fieldset disabled>`, which
 * inerts EVERY form-associated descendant. In `OptionPanel` that reached three
 * controls which write nothing at all — the factor-navigation button on each
 * intervention row, each connection row, and the coaching card — so a reader who
 * opened a node to understand it could not follow the model from the panel built
 * to explain it. The "Add a change" trigger was inert too, so the factor list
 * could not even be OPENED: the affordance was dead twice over.
 *
 * ── WHY THE PANEL MAY BE LET OUT, AND WHAT IT OWES ───────────────────────────
 * The Router already makes this argument once, for the header rename: a blanket
 * "these changes cannot be saved" over a control that does not save is trap 21,
 * two questions under one sentence. The rename needed a durable wire carrier to
 * earn its exemption. Navigation and coaching need nothing — a control that
 * performs no write cannot perform an unsavable one.
 *
 * In exchange the panel takes on a DUTY, and this file is what holds it to it.
 *
 * ── THE PAIR, AND WHY IT MUST BE A PAIR ──────────────────────────────────────
 * Each half alone is satisfiable by doing nothing useful:
 *   · "every writer is disabled"     — passes if the panel disables EVERYTHING,
 *                                      which is the defect it replaced.
 *   · "every non-writer is enabled"  — passes if the panel disables NOTHING,
 *                                      which grants it the authority it must
 *                                      never take.
 * Only both together describe the boundary. Trap 22b: one predicate guarding two
 * opposite harms needs both directions asserted, or the suite applauds a trade.
 *
 * ── THE WRITER SET IS DERIVED FROM THE TREE, NOT FROM ONE FILE ───────────────
 * ⚠ Two of the five writers live in `OptionAdvancedEditor`
 * (`setIntervention` :66, `setDescription` :90), mounted through
 * `TechnicalDisclosure`. My first audit enumerated the `mutations.*` calls
 * spelled in `OptionPanel.tsx` and reported it as "every control in
 * OptionPanel"; a review found the miss. This file therefore asserts over
 * `[data-writer-fence]` markers rather than a hand-listed set of controls, so a
 * writer added inside any nested component is covered the moment it is fenced —
 * and a writer added WITHOUT a fence is what the mount-path test below is for.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, within } from '@testing-library/react'
import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'
// ⭐ DERIVED, never re-typed: the prompt asserted below is the one the panel
// renders, so a reworded placeholder moves this with it instead of quietly
// un-binding the assertion.
import { DESCRIPTION_PLACEHOLDERS, INSPECTOR_DESCRIPTION_EMPTY } from '../inspectorStrings'

// importOriginal-spread, NOT a hand-listed factory: `vi.mock` REPLACES the
// module, so a bare `{ useViewport }` factory silently removes every other
// @xyflow/react export the subtree imports (CLAUDE.md trap 12).
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const FACTOR_ID = 'fac_price'
const FACTOR_LABEL = 'Pro plan price'
const SPARE_FACTOR_ID = 'fac_headcount'
const SPARE_FACTOR_LABEL = 'Engineering headcount'
const RISK_ID = 'risk_churn'
const OPTION_ID = 'opt-raise'
const OPTION_B_ID = 'opt-hold'
const DESC_A = 'Raise the Pro price and ship the billing feature together.'
const DESC_B = 'Hold the price and ship the feature on its own.'

function factorNode(id: string, label: string) {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      kind: 'factor',
      category: 'controllable',
      label,
      observedState: { value: 0.59, raw_value: 59, unit: '£' },
    },
  }
}

function seed() {
  useCanvasStore.setState({
    nodes: [
      factorNode(FACTOR_ID, FACTOR_LABEL),
      factorNode(SPARE_FACTOR_ID, SPARE_FACTOR_LABEL),
      // ⚠ THE CONTRAST BELOW USED A CONTROLLABLE FACTOR, THEN A RISK, AND CAN BE
      // NEITHER NOW. `factor-controllable` joined `AUTHORITY_OWNING_PANELS`
      // first (its value has a durable carrier); `risk` joined it later (A10,
      // 25 Sep 2026) — its two writers now fence themselves inside `RiskPanel`
      // instead of sitting under the Router's blanket. Both stopped being
      // examples of a panel the Router still wraps. An unresolved node kind
      // falls through to `GenericNodePanel`, which owns no fence of its own and
      // is the last node panel the Router still wraps unconditionally.
      {
        id: RISK_ID,
        type: 'milestone',
        position: { x: 0, y: 0 },
        data: { kind: 'milestone', label: 'Churn spikes after the rise' },
      },
      {
        id: OPTION_ID,
        type: 'option',
        position: { x: 0, y: 0 },
        data: {
          kind: 'option',
          label: 'Raise price',
          provenance: 'ai_inferred',
          description: DESC_A,
          interventions: { [FACTOR_ID]: 0.49 },
        },
      },
      {
        id: OPTION_B_ID,
        type: 'option',
        position: { x: 0, y: 0 },
        data: {
          kind: 'option',
          label: 'Hold price',
          provenance: 'ai_inferred',
          description: DESC_B,
          interventions: { [FACTOR_ID]: 0.59 },
        },
      },
    ] as never[],
    edges: [],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function openOption() {
  const utils = render(<InspectorModal nodeId={OPTION_ID} edgeId={null} onClose={vi.fn()} />)
  // PRECONDITION: without the deployed chain mounted every assertion below is
  // about a component the product does not render (trap 3b).
  expect(
    utils.container.querySelector(NODE_INSPECTOR),
    'PRECONDITION: the node inspector dialog must be mounted',
  ).not.toBeNull()
  return utils
}

/**
 * ⚠ `techMode` IS NOT A PROP — it is `useState(false)` inside `InspectorRouter`
 * (`useTechToggle`), reachable only through the shell's own control. I wrote
 * this spec passing `techMode` to `InspectorModal` first; it takes three props
 * and that is not one of them. Driving the real toggle is also the better test:
 * it proves the advanced editor is reachable the way a user reaches it.
 */
function showTechnicalDetail() {
  // ⚠⚠ TWO GATES, NOT ONE, AND MY FIRST VERSION ONLY OPENED THE OUTER ONE.
  // The shell's toggle sets `techMode`, which merely lets `TechnicalDisclosure`
  // RENDER; the disclosure then keeps its OWN `open` state and shows nothing
  // until its "Show model detail" button is pressed. So the advanced editor —
  // and the two writers inside it — never mounted, and the fence sweep was
  // measuring a subtree that was not there. Caught in review.
  fireEvent.click(screen.getByRole('button', { name: 'Show technical detail' }))
  fireEvent.click(screen.getByRole('button', { name: 'Show model detail' }))
}

describe('the option panel owns its authority boundary', () => {
  beforeEach(seed)

  it('is NOT wrapped by the Router — the outer blanket is gone for this panel', () => {
    const { container } = openOption()
    expect(
      container.querySelector('[data-authority="disabled"]'),
      'the Router still wrapped the option panel; navigation and coaching stay dead',
    ).toBeNull()
  })

  it('CONTRAST — every OTHER panel keeps the Router wrap, unchanged', () => {
    // ⭐ Without this, the assertion above passes on a change that deleted the
    // blanket everywhere — which would silently un-fence four other panels that
    // have taken on no duty at all.
    const { container } = render(
      <InspectorModal nodeId={RISK_ID} edgeId={null} onClose={vi.fn()} />,
    )
    expect(container.querySelector(NODE_INSPECTOR)).not.toBeNull()
    expect(
      container.querySelector('[data-authority="disabled"]'),
      'a non-opted-in panel lost the Router wrap — it owns no fence of its own',
    ).not.toBeNull()
  })
})

describe('every writer is fenced, and every non-writer is not', () => {
  beforeEach(seed)

  it('disables EVERY writer fence the panel declares', () => {
    const { container } = openOption()
    showTechnicalDetail() // mounts OptionAdvancedEditor, which holds two writers
    // ⚠⚠ AND THE FACTOR LIST MUST BE OPENED, WHICH MY FIRST VERSION MISSED.
    // The `add-factor` fence lives inside `{showDropdown && …}` and the dropdown
    // is closed at mount, so the sweep saw two fences and my `>= 3` precondition
    // — written to PREVENT a vacuous sweep — was itself asserting a fence that
    // could not be in the DOM. Caught in review.
    fireEvent.click(screen.getByTestId('option-explore-factors'))
    const fences = [...container.querySelectorAll('fieldset[data-writer-fence]')]

    // PRECONDITION PINNED IN-TEST: a sweep over zero fences agrees with every
    // other sweep over zero fences (trap 13). Named rather than counted, so a
    // renamed or unmounted fence fails HERE with its own name rather than
    // shifting a number nobody reads.
    const names = fences.map(f => f.getAttribute('data-writer-fence')).sort()
    expect(names).toEqual(['add-factor', 'advanced-editor', 'description'])

    for (const fence of fences) {
      expect(
        (fence as HTMLFieldSetElement).disabled,
        `fence "${fence.getAttribute('data-writer-fence')}" is not disabled`,
      ).toBe(true)
    }
  })

  it('names the advanced editor among them — the two writers a file sweep misses', () => {
    const { container } = openOption()
    showTechnicalDetail()
    const names = [...container.querySelectorAll('fieldset[data-writer-fence]')]
      .map(f => f.getAttribute('data-writer-fence'))
    // `OptionAdvancedEditor` calls `setIntervention` and `setDescription`, and
    // neither is spelled in OptionPanel.tsx. Bound by name so removing the fence
    // REDs rather than quietly re-opening a write path.
    expect(names).toContain('advanced-editor')
  })

  it('keeps FACTOR NAVIGATION alive — the control the blanket should never have reached', () => {
    openOption()
    const row = screen.getByTestId(`inspector-intervention-${FACTOR_ID}`)
    const navigate = within(row).getByRole('button', { name: FACTOR_LABEL })
    expect(
      (navigate as HTMLButtonElement).disabled,
      'the factor-navigation button is disabled; a reader cannot follow the model',
    ).toBe(false)
  })

  it('keeps the factor list OPENABLE, and its trigger says what it does', () => {
    openOption()
    // ⭐ "Add a change" promised an action this route cannot perform, and it was
    // inert as well — so the list could not be opened to see what it offered.
    const trigger = screen.getByTestId('option-explore-factors')
    expect((trigger as HTMLButtonElement).disabled, 'the trigger is still inert').toBe(false)
    expect(trigger).toHaveTextContent('Explore other factors')
    expect(trigger.textContent).not.toContain('Add a change')

    fireEvent.click(trigger)
    // The inventory is the part worth keeping: a reader who cannot edit still
    // learns which factors this option could act on.
    expect(screen.getByText(SPARE_FACTOR_LABEL)).toBeInTheDocument()
  })

  it('explains the edit route ONCE, never per row', () => {
    openOption()
    fireEvent.click(screen.getByTestId('option-explore-factors'))
    expect(screen.getAllByTestId('option-explore-factors-route')).toHaveLength(1)
  })
})

/**
 * ⚠⚠ THIS BLOCK REVERSED, AND THE REVERSAL IS THE POINT OF THE CHANGE ABOVE IT.
 *
 * It used to assert the target renders as TEXT, because this row wrote LOCALLY
 * and a control that cannot save should not look like one. That reasoning was
 * right and its premise has gone: the row now dispatches
 * `option_intervention_edit`, so the value it shows is one the reader can
 * actually change.
 *
 * ⭐ WHAT IS KEPT VERBATIM IS THE HALF THAT SURVIVES THE REVERSAL: the number
 * still says WHICH SCALE IT IS ON. `InterventionRow`'s editable branch carries
 * the same qualifier as its read-only one, in its own words — *"THE BOX NEEDS
 * THE SAME TRUTH THE VALUE DOES. Being editable never made an unlabelled
 * number scientifically valid."* Enabling an edit while dropping a disclosure
 * would be a worse trade than the fence ever was, so that is asserted here
 * rather than assumed.
 *
 * ⛔ AND THE READ-ONLY BRANCH IS NOT DELETED. `InterventionRow` still honours
 * `disabled`; this panel simply no longer passes it for this row. A component
 * keeping a capability no current caller uses is not dead code to tidy — it is
 * what makes the next fenced caller possible.
 */
describe('the connected target is editable and still says which scale it is on', () => {
  beforeEach(seed)

  it('⭐ offers a real input where it used to offer text — the fence lifted with the carrier', () => {
    openOption()
    // ⭐ POSTURE MOVE, RECORDED (DEFECT 5 + ED #63 §9, served `a4434670`): on
    // this £ factor the DEFAULT view now prints the card's reading ("£49") and
    // no box — "0.49 model value" beside a card saying "£49" was the witnessed
    // defect — and the model-scale box lives under technical detail. The
    // property this test pins is unchanged: the connected writer is LIVE, not
    // fenced. It is asserted where the box now is, reached the way a user
    // reaches it.
    expect(
      screen.getByTestId(`intervention-readout-${FACTOR_ID}`),
      'the default view no longer prints the card\'s reading',
    ).toHaveTextContent('£49')
    fireEvent.click(screen.getByRole('button', { name: 'Show technical detail' }))
    const row = screen.getByTestId(`inspector-intervention-${FACTOR_ID}`)

    const input = row.querySelector('input')
    expect(input, 'the connected writer is still fenced').toBeTruthy()
    expect((input as HTMLInputElement).disabled, 'the input is rendered but inert').toBe(false)
    expect(
      within(row).queryByTestId(`intervention-target-readonly-${FACTOR_ID}`),
      'the read-only readout is still rendered beside an editable input',
    ).toBeNull()
    // ⚠ THE VALUE MOVED FROM textContent INTO THE BUFFER, which is what an
    // editable row means. Asserting it on the element would pass vacuously on
    // an empty input sitting beside the label.
    expect((input as HTMLInputElement).value).toBe('0.49')
    // ⚠⚠ THE UNIT DOES NOT EXEMPT IT, and this fixture is the reason. The factor
    // carries `unit: '£'` — belonging to the recorded raw 59 — while the target
    // is the normalised 0.49. My first condition was `!displayValue && !unit`,
    // so the one row that most needed the qualifier was the only row denied it,
    // because a unit describing a DIFFERENT quantity suppressed it.
    // (DEFECT 5: the qualifier now names the scale in full — the box is on the
    // model's internal scale, which is what "model value" was trying to say.)
    expect(row).toHaveTextContent("model's internal scale (0–1)")
  })

  it('⛔ CONTRAST — the panel\'s OTHER writers stay fenced, so this is per-WRITER and not per-panel', () => {
    openOption()
    // Unfencing the panel wholesale is what the Router's blanket did. The two
    // writers with no server carrier must still be inert, or the pair above
    // proves nothing about the boundary.
    const fences = Array.from(document.querySelectorAll('[data-writer-fence]'))
    expect(fences.length, 'the panel declares no writer fences at all').toBeGreaterThan(0)
    for (const f of fences) {
      expect((f as HTMLFieldSetElement).disabled, `${f.getAttribute('data-writer-fence')} is not fenced`).toBe(true)
    }
  })
})

describe('the description belongs to the option on screen', () => {
  beforeEach(seed)

  /**
   * ⚠ THE SAME WRONG-OPTION-VALUE FAMILY AS #1343, one level up. `OptionPanel`
   * seeded its description buffer with `useState(descriptionBody)` and never
   * synced it, and the Router rendered the panel with NO KEY — so switching
   * options reconciled A's instance onto B and kept A's text, while the drafting
   * notes beside it (derived) updated. One option's description under another's
   * notes.
   *
   * I fixed the row's identity in #1343 and did not look at the panel around it.
   * Caught in review.
   */
  it('shows the NEW option\'s description after switching, not the previous one', () => {
    const { rerender, container } = render(
      <InspectorModal nodeId={OPTION_ID} edgeId={null} onClose={vi.fn()} />,
    )
    expect(container.querySelector(NODE_INSPECTOR)).not.toBeNull()
    expect(screen.getByTestId('option-description-readonly')).toHaveTextContent(DESC_A)

    rerender(<InspectorModal nodeId={OPTION_B_ID} edgeId={null} onClose={vi.fn()} />)
    const shown = screen.getByTestId('option-description-readonly')
    expect(shown).toHaveTextContent(DESC_B)
    expect(shown.textContent, 'the previous option\'s description survived the switch').not.toContain(DESC_A)
  })

  it('follows a SAME-option change made outside the panel', () => {
    // ⭐ The other cause, and no key can catch it: a chat edit, an undo, or a CEE
    // absorption note changes the description of the option already on screen.
    render(<InspectorModal nodeId={OPTION_ID} edgeId={null} onClose={vi.fn()} />)
    expect(screen.getByTestId('option-description-readonly')).toHaveTextContent(DESC_A)

    const rewritten = 'Rewritten somewhere else entirely.'
    act(() => {
      useCanvasStore.setState({
        nodes: useCanvasStore.getState().nodes.map(n =>
          n.id === OPTION_ID ? { ...n, data: { ...n.data, description: rewritten } } : n,
        ),
      } as never)
    })

    expect(screen.getByTestId('option-description-readonly')).toHaveTextContent(rewritten)
  })
})

describe('the numeric fallback says which scale it is on', () => {
  beforeEach(seed)

  it('qualifies the target even when the factor carries a unit — the paired case', () => {
    openOption()
    // ⭐ POSTURE MOVE, RECORDED (DEFECT 5): the default view no longer shows the
    // internal number at all on a £ row — it shows the card's reading — so
    // there is nothing there to qualify, and the absence is asserted rather
    // than assumed. The unqualified-number harm this test exists for can only
    // occur where the number is, which is now technical detail.
    const before = screen.getByTestId(`inspector-intervention-${FACTOR_ID}`)
    expect(before).toHaveTextContent('£49')
    expect(before.textContent, 'the internal number leaked into the default view').not.toContain('0.49')

    fireEvent.click(screen.getByRole('button', { name: 'Show technical detail' }))
    const row = screen.getByTestId(`inspector-intervention-${FACTOR_ID}`)
    // `observedState.unit` is '£' here and the target is still qualified.
    // The row is editable now; the qualifier rides the INPUT, which is where
    // `InterventionRow` puts it and why the box carries the same truth.
    expect(row).toHaveTextContent("model's internal scale (0–1)")
    expect(row.querySelector('input'), 'the paired case lost its editor').toBeTruthy()
  })

  it('does NOT qualify a target the producer framed itself — the twin', () => {
    // ⭐ The pair is what proves the rule is "a CEE-authored display_value is
    // the only exemption" rather than "always qualify", which would be noise on
    // every row the producer had already explained.
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.map(n =>
        n.id === OPTION_ID
          ? { ...n, data: { ...n.data, interventions: { [FACTOR_ID]: { value: 0.49, display_value: 'Cut to £49' } } } }
          : n,
      ),
    } as never)
    openOption()
    const row = screen.getByTestId(`inspector-intervention-${FACTOR_ID}`)
    expect(row).toHaveTextContent('Cut to £49')
    expect(row.textContent, 'a producer-framed value does not need our qualifier').not.toContain('model value')
  })
})

describe('the permitted controls are exercised, not merely enabled', () => {
  beforeEach(seed)

  it('factor navigation actually selects the factor', () => {
    // ⚠ `disabled === false` proves a control is not inert; it does not prove
    // it does anything. This fires it and reads the store.
    openOption()
    const row = screen.getByTestId(`inspector-intervention-${FACTOR_ID}`)
    fireEvent.click(within(row).getByRole('button', { name: FACTOR_LABEL }))
    expect([...useCanvasStore.getState().selection.nodeIds]).toContain(FACTOR_ID)
  })

  it('shows the static empty-description branch when the record has no description', () => {
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.map(n =>
        n.id === OPTION_ID ? { ...n, data: { ...n.data, description: '' } } : n,
      ),
    } as never)
    openOption()
    // No description and no editor: the pane must still say something rather
    // than rendering an empty region that reads as a loading state.
    expect(screen.queryByTestId('option-description-readonly')).toBeNull()
    // ⚠ SCOPED TO THE DESCRIPTION FENCE, and it had to be. This read
    // `queryByRole('textbox')` over the WHOLE pane, which was a true statement
    // only while every control on the panel was fenced; the intervention row is
    // an input now. Widening the assertion back would make this test fail for a
    // reason that has nothing to do with the description.
    const descriptionFence = document.querySelector('[data-writer-fence="description"]')
    expect(descriptionFence, 'the description fence is gone').toBeTruthy()
    expect(
      descriptionFence!.querySelector('textarea, input[type="text"]'),
      'a read-only description offered an editor',
    ).toBeNull()
    // ⚠⚠ AND THE ASSERTION THAT ACTUALLY DISCRIMINATES. "No textarea exists"
    // passed on a dead button — `EmptyDescriptionPrompt` with a no-op
    // `onStartEditing` still rendered `role="button"` and a tab stop, so the
    // pane offered an action that answers nothing and this test said fine.
    // v3.1 (DESIGN-GAP-v31 row 32): the read-only empty state is stated as an
    // ABSENCE, not an italic prompt question that reads as content.
    expect(screen.getByTestId('inspector-description-empty')).toHaveTextContent(INSPECTOR_DESCRIPTION_EMPTY)
    expect(screen.queryByText(DESCRIPTION_PLACEHOLDERS.option)).toBeNull()
    expect(screen.queryByRole('button', { name: DESCRIPTION_PLACEHOLDERS.option }), 'the empty prompt is still a tab stop').toBeNull()
  })
})
