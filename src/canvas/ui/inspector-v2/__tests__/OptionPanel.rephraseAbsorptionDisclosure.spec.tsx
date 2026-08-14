/**
 * ROADMAP 2.1204 — the rephrase-absorption disclosure the user can actually READ.
 *
 * ── WHAT THE WIRE CARRIES ────────────────────────────────────────────────
 * When CEE's drafter (#953) absorbs a rephrase-twin option, the surviving
 * option's `description` carries `"Also drafted as: <absorbed label>"`.
 * Ruling R2 (Paul): auto-merge is correct, but the user must be able to SEE
 * that it happened.
 *
 * ── ⭐⭐ THE PREMISE THIS FILE CORRECTS ────────────────────────────────────
 * Row 2.1204 was minted from the closing battery's DOM-2 arm, which reported
 * the trace **"appears NOWHERE in the rendered page"**. That is FALSE, and the
 * refutation sits inside DOM-2's own output directory: its screenshot
 * (`closing-witness-20260814/driver/dom-postbatch/dom2-final/d2-inspector.png`)
 * shows `Also drafted as: Hire two Developers` rendering in the option
 * inspector's Context group.
 *
 * DOM-2 scraped with `page.locator('body').innerText()`. `OptionPanel` renders
 * the description into a **React-controlled `<textarea>`**, and React sets a
 * controlled textarea's `value` as a DOM *property* with no child text node —
 * so the string is fully visible to a human and carries ZERO text content.
 * The probe was structurally blind to the one element class its claim rested
 * on. Both of its controls fired and neither could have caught this: they read
 * a canvas label and `PanelGroup` headings, both ordinary text nodes (trap 13e
 * — a control proves the probe sees SOMETHING, never that it sees the thing
 * under test).
 *
 * ── SO THE REAL DEFECT IS NOT ABSENCE. IT IS ATTRIBUTION AND DESTRUCTION ──
 * The note renders **inside the user's own editable description field**:
 *   1. UNATTRIBUTED — it reads as the user's own prose; nothing says a drafter
 *      wrote it, which is precisely what R2 asks the user to be able to see.
 *   2. DESTRUCTIVE — that textarea is the description editor and `onBlur`
 *      commits it. A user typing their own description silently and
 *      permanently destroys the absorption provenance.
 *   3. OBSTRUCTIVE — it squats in the description field, so a user wanting to
 *      describe the option must first delete machine-authored text, and
 *      `EmptyDescriptionPrompt` never invites them to write one at all.
 *
 * The fix therefore SEPARATES rather than adds: the note is lifted out of the
 * editable description into a distinct attributed line, and is recomposed on
 * write-back so editing the description cannot destroy it.
 *
 * ── HOW THIS FILE BINDS ──────────────────────────────────────────────────
 * · It mounts `InspectorModal`, the DEPLOYED v2 path (`USE_INSPECTOR_V2 = true`
 *   is hardcoded at `InspectorModal.tsx:16`), not a panel in isolation — so a
 *   flag or router change that stops mounting this panel fails the file loudly
 *   rather than silently testing a component no user loads (trap 3b).
 * · Every test asserts the INSPECTOR IS OPEN as its own precondition, by the
 *   exact identity anchors `role="dialog" aria-label="Node inspector"` and
 *   `role="region" aria-label="Inspector panel"`. A closed inspector satisfies
 *   any absence assertion vacuously (trap 13), so the absence claims in T4/T5
 *   are worthless without it.
 * · Fixtures bind by IDENTITY — exact node id, exact label — never by a value
 *   predicate another node could satisfy (trap 19).
 * · Expected user-facing strings are written out LITERALLY here rather than
 *   imported from `inspectorStrings`. Importing the constant under test would
 *   make the assertion agree with itself whatever the copy became.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'

// importOriginal-spread, NOT a hand-listed factory: `vi.mock` REPLACES the
// module, so a bare `{ useViewport }` factory silently removes every other
// @xyflow/react export the subtree imports (CLAUDE.md trap 12).
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

/** The exact wire sentence, from the live capture (node `be215545`). */
const ABSORBED_LABEL = 'Hire two Developers'
const WIRE_NOTE = `Also drafted as: ${ABSORBED_LABEL}`

/** Identity anchors — the deployed v2 mount path. */
const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const INSPECTOR_SHELL = '[role="region"][aria-label="Inspector panel"]'

/** The survivor option, bound by exact id and exact label. */
const SURVIVOR_ID = 'be215545'
const SURVIVOR_LABEL = 'two developers'

/** A non-option node carrying the SAME description — the scoping control. */
const GOAL_ID = 'goal-increase-productivity'
const GOAL_LABEL = 'increase productivity'

function seedStore(nodes: unknown[]) {
  useCanvasStore.setState({
    nodes: nodes as never[],
    edges: [],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function optionNode(description?: string) {
  return {
    id: SURVIVOR_ID,
    type: 'option',
    position: { x: 0, y: 0 },
    data: {
      kind: 'option',
      label: SURVIVOR_LABEL,
      provenance: 'from_brief',
      ...(description === undefined ? {} : { description }),
    },
  }
}

function goalNode(description?: string) {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: {
      kind: 'goal',
      label: GOAL_LABEL,
      ...(description === undefined ? {} : { description }),
    },
  }
}

/**
 * Mounts the inspector for `nodeId` and PROVES IT OPENED before returning.
 *
 * This is the precondition, asserted in-test rather than assumed: without it
 * "the note is not on screen" would pass on an inspector that never mounted.
 */
function openInspector(nodeId: string) {
  const utils = render(<InspectorModal nodeId={nodeId} edgeId={null} onClose={vi.fn()} />)

  const dialog = utils.container.querySelector(NODE_INSPECTOR)
  expect(dialog, 'PRECONDITION: the node inspector dialog must be mounted').not.toBeNull()

  const shell = utils.container.querySelector(INSPECTOR_SHELL)
  expect(shell, 'PRECONDITION: the InspectorShell must have rendered inside it').not.toBeNull()

  return { ...utils, dialog: dialog as HTMLElement, shell: shell as HTMLElement }
}

/** The option description editor, bound by its exact placeholder. */
function descriptionEditor(): HTMLTextAreaElement | null {
  return screen.queryByPlaceholderText(
    'What would choosing this option actually mean in practice?',
  ) as HTMLTextAreaElement | null
}

beforeEach(() => {
  vi.clearAllMocks()
  seedStore([])
})

describe('ROADMAP 2.1204 — the absorption note is disclosed as a DRAFTING note', () => {
  it('⭐ T1 renders the wire sentence on an attributed drafting-note line', () => {
    seedStore([optionNode(WIRE_NOTE)])
    const { dialog } = openInspector(SURVIVOR_ID)

    // The panel really is the survivor's — identity, not a value predicate.
    expect(within(dialog).getByText(SURVIVOR_LABEL)).toBeTruthy()

    const note = within(dialog).getByTestId('option-drafting-note')

    // The wire sentence, verbatim. No invented copy about what was merged.
    expect(note.textContent).toContain(WIRE_NOTE)

    // ⭐ AND IT IS ATTRIBUTED. This is the half R2 actually asks for: the user
    // must be able to tell a drafter wrote this, not them.
    expect(note.textContent).toContain('Drafted by Olumi')
  })

  it('⭐ T2 does NOT leave the note squatting in the editable description', () => {
    seedStore([optionNode(WIRE_NOTE)])
    openInspector(SURVIVOR_ID)

    // With the note lifted out there is no user description left, so the
    // description field is genuinely empty and the user is invited to write
    // one — the prompt the raw note used to suppress.
    expect(descriptionEditor()).toBeNull()
    expect(
      screen.getByText('What would choosing this option actually mean in practice?'),
    ).toBeTruthy()
  })

  it('⭐ T3 separates the note from a description the user HAS written', () => {
    seedStore([optionNode(`${WIRE_NOTE}\nWe would run both squads in parallel.`)])
    const { dialog } = openInspector(SURVIVOR_ID)

    const note = within(dialog).getByTestId('option-drafting-note')
    expect(note.textContent).toContain(WIRE_NOTE)
    // The user's own prose must NOT be swept into the drafting note.
    expect(note.textContent).not.toContain('We would run both squads in parallel.')

    const editor = descriptionEditor()
    expect(editor).not.toBeNull()
    expect(editor!.value).toBe('We would run both squads in parallel.')
    expect(editor!.value).not.toContain('Also drafted as:')
  })

  it('⭐ T4 renders NO drafting-note line when the description carries no note', () => {
    // The absence claim below is only meaningful because openInspector has
    // already proven the inspector mounted AND the editor below proves the
    // description reached this panel.
    seedStore([optionNode('We would run both squads in parallel.')])
    const { dialog } = openInspector(SURVIVOR_ID)

    expect(descriptionEditor()!.value).toBe('We would run both squads in parallel.')
    expect(within(dialog).queryByTestId('option-drafting-note')).toBeNull()
  })

  it('⭐ T5 SCOPING — a non-option node with the same description gets no note line', () => {
    seedStore([goalNode(WIRE_NOTE)])
    const { dialog } = openInspector(GOAL_ID)

    // Positive control: this is genuinely the goal inspector, open and
    // populated. Without it "no note line" would pass on an empty render.
    expect(within(dialog).getByText(GOAL_LABEL)).toBeTruthy()

    expect(within(dialog).queryByTestId('option-drafting-note')).toBeNull()
  })

  it('⭐ T6 editing the description does not DESTROY the absorption trace', () => {
    seedStore([optionNode(WIRE_NOTE)])
    openInspector(SURVIVOR_ID)

    // Start typing a description: the empty prompt opens the editor.
    fireEvent.click(
      screen.getByText('What would choosing this option actually mean in practice?'),
    )
    const editor = descriptionEditor()
    expect(editor, 'PRECONDITION: clicking the prompt must open the editor').not.toBeNull()

    fireEvent.change(editor!, { target: { value: 'Two hires, starting in Q3.' } })
    fireEvent.blur(editor!)

    // The committed description carries BOTH: the user's words and the trace.
    // This case CAN trigger the write-back path — a "does no harm" test whose
    // fixture cannot reach the transformation asserts nothing (trap 22b).
    const committed = String(
      useCanvasStore.getState().nodes.find(n => n.id === SURVIVOR_ID)?.data?.description ?? '',
    )
    expect(committed).toContain(WIRE_NOTE)
    expect(committed).toContain('Two hires, starting in Q3.')
  })
})
