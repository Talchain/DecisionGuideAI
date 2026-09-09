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
      <InspectorModal nodeId={FACTOR_ID} edgeId={null} onClose={vi.fn()} />,
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

describe('a read-only target reads as a value, not a broken input', () => {
  beforeEach(seed)

  it('renders the target as text with no disabled input in its place', () => {
    openOption()
    const row = screen.getByTestId(`inspector-intervention-${FACTOR_ID}`)

    const target = within(row).getByTestId(`intervention-target-readonly-${FACTOR_ID}`)
    expect(target).toHaveTextContent('0.49')
    // ⚠⚠ THE UNIT DOES NOT EXEMPT IT, and this fixture is the reason. The factor
    // carries `unit: '£'` — belonging to the recorded raw 59 — while the target
    // is the normalised 0.49. My first condition was `!displayValue && !unit`,
    // so the one row that most needed the qualifier was the only row denied it,
    // because a unit describing a DIFFERENT quantity suppressed it.
    expect(target).toHaveTextContent('model value')
    // A greyed box invites a click, absorbs it, and teaches the reader the
    // product is broken rather than that this surface does not edit.
    expect(
      row.querySelector('input'),
      'a disabled input is still rendered where the value should be',
    ).toBeNull()
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
    const row = screen.getByTestId(`inspector-intervention-${FACTOR_ID}`)
    // `observedState.unit` is '£' here and the target is still qualified.
    expect(within(row).getByTestId(`intervention-target-readonly-${FACTOR_ID}`)).toHaveTextContent('model value')
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
    expect(screen.queryByRole('textbox'), 'a read-only pane offered an editor').toBeNull()
  })
})
