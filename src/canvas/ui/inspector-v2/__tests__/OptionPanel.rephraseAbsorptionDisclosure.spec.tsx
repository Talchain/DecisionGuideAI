/**
 * ROADMAP 2.1204 — the rephrase-absorption disclosure the user can actually READ.
 *
 * ── WHAT THE PRODUCER ACTUALLY WRITES ────────────────────────────────────
 * Derived at CEE's bytes, tip `ae0b4af`,
 * `src/cee/transforms/option-rephrase-merge.ts:459-462`:
 *
 *     const alsoDraftedAs = `Also drafted as: ${twin.label}`;
 *     const appendDescription = (existing) =>
 *       existing && existing.trim().length > 0
 *         ? `${existing}\n\n${alsoDraftedAs}`
 *         : alsoDraftedAs;
 *
 * So the note is **APPENDED**, separated by a BLANK LINE, and stands alone only
 * when the description was empty. The enclosing loop runs **per twin**, so a
 * second absorption appends again: notes accumulate as a trailing run of
 * `\n\n`-separated lines.
 *
 * ⚠ THE FIRST VERSION OF THIS FILE ASSERTED THE OPPOSITE — that CEE PREFIXES —
 * and its parser used `startsWith`, which is INERT on every option that already
 * had a description. That class is wire-reachable on a first draft (V3
 * `description` = the drafter's `node.body`, CEE `schema-v3.ts:207`).
 *
 * **Why the original corpus could not catch it:** every absorbed option in the
 * closing-witness captures had an EMPTY description — the one class where
 * "whole string" and "leading prefix" coincide, so both the right and the wrong
 * parser agree on all 12 samples (trap 13d — a corpus that omits a class the
 * contract admits cannot certify the code over that class). The producer's join
 * was one grep away and the code was never asked. T7 is that missing class.
 *
 * ── THE DEFECT THIS FILE PINS ────────────────────────────────────────────
 * The note was never invisible: it rendered inside the option's **editable
 * description textarea**. (The closing battery's DOM-2 arm called it "DARK to
 * the reader" because it scraped `body.innerText()`, which cannot see a
 * React-controlled textarea's `value` — the string is a DOM property with no
 * child text node. Its own screenshot shows the sentence on screen.) The real
 * defect is that the note was **unattributed** — indistinguishable from the
 * user's own prose — and **destructible**: typing over it erased the only
 * record that two options had been merged.
 *
 * ── HOW THIS FILE BINDS ──────────────────────────────────────────────────
 * · Mounts `InspectorModal`, the DEPLOYED v2 path (`USE_INSPECTOR_V2 = true`
 *   hardcoded at `InspectorModal.tsx:16`), so a router or flag change that
 *   stops mounting this panel fails loudly rather than silently testing a
 *   component no user loads (trap 3b).
 * · Asserts the inspector is OPEN as an explicit precondition in every test —
 *   a closed inspector satisfies any absence assertion vacuously (trap 13).
 * · Fixtures bind by IDENTITY — exact node id, exact label (trap 19).
 * · Expected user-facing strings are written LITERALLY, never imported from
 *   `inspectorStrings`; importing the constant under test would make the
 *   assertion agree with itself whatever the copy became.
 * · T10 reaches the tech-mode editor THROUGH THE REAL CONTROLS (toggle, then
 *   disclosure) rather than rendering it directly — the erase path is only a
 *   defect because a user can reach it.
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

/** The exact wire sentences, in the producer's own format. */
const ABSORBED_LABEL = 'Hire two Developers'
const NOTE = `Also drafted as: ${ABSORBED_LABEL}`
const SECOND_NOTE = 'Also drafted as: Bring on two engineers'
const USER_PROSE = 'We would run both squads in parallel.'

/** Identity anchors — the deployed v2 mount path. */
const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const INSPECTOR_SHELL = '[role="region"][aria-label="Inspector panel"]'

const SURVIVOR_ID = 'be215545'
const SURVIVOR_LABEL = 'two developers'
const GOAL_ID = 'goal-increase-productivity'
const GOAL_LABEL = 'increase productivity'

const OPTION_PLACEHOLDER = 'What would choosing this option actually mean in practice?'

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

/** Mounts the inspector and PROVES IT OPENED before returning. */
function openInspector(nodeId: string) {
  const utils = render(<InspectorModal nodeId={nodeId} edgeId={null} onClose={vi.fn()} />)

  const dialog = utils.container.querySelector(NODE_INSPECTOR)
  expect(dialog, 'PRECONDITION: the node inspector dialog must be mounted').not.toBeNull()
  const shell = utils.container.querySelector(INSPECTOR_SHELL)
  expect(shell, 'PRECONDITION: the InspectorShell must have rendered inside it').not.toBeNull()

  return { ...utils, dialog: dialog as HTMLElement }
}

/** The option description editor, bound by its exact placeholder. */
function descriptionEditor(): HTMLTextAreaElement | null {
  return screen.queryByPlaceholderText(OPTION_PLACEHOLDER) as HTMLTextAreaElement | null
}

/** What is actually stored on the node right now. */
function storedDescription(nodeId = SURVIVOR_ID): string {
  return String(
    useCanvasStore.getState().nodes.find(n => n.id === nodeId)?.data?.description ?? '',
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  seedStore([])
})

describe('ROADMAP 2.1204 — the absorption note is disclosed as a DRAFTING note', () => {
  it('⭐ T1 renders the wire sentence on an attributed drafting-note line', () => {
    seedStore([optionNode(NOTE)])
    const { dialog } = openInspector(SURVIVOR_ID)

    expect(within(dialog).getByText(SURVIVOR_LABEL)).toBeTruthy()

    const note = within(dialog).getByTestId('option-drafting-note')
    // The wire sentence, verbatim. No invented copy about what was merged.
    expect(note.textContent).toContain(NOTE)
    // ⭐ AND IT IS ATTRIBUTED — the half ruling R2 actually asks for.
    expect(note.textContent).toContain('Drafted by Olumi')
  })

  it('⭐ T2 does NOT leave the note squatting in the editable description', () => {
    seedStore([optionNode(NOTE)])
    openInspector(SURVIVOR_ID)

    expect(descriptionEditor()).toBeNull()
    expect(screen.getByText(OPTION_PLACEHOLDER)).toBeTruthy()
  })

  it('⭐⭐ T7 PRODUCER FORM — a DESCRIBED option carries the note at the END', () => {
    // THE CLASS THE ORIGINAL CORPUS OMITTED. CEE appends `\n\n<note>` to an
    // existing description; a `startsWith` parser is inert on every option in
    // this class, which is reachable on a first draft.
    seedStore([optionNode(`${USER_PROSE}\n\n${NOTE}`)])
    const { dialog } = openInspector(SURVIVOR_ID)

    const note = within(dialog).getByTestId('option-drafting-note')
    expect(note.textContent).toContain(NOTE)
    // The user's prose must NOT be swept into the drafting note.
    expect(note.textContent).not.toContain(USER_PROSE)

    const editor = descriptionEditor()
    expect(editor, 'the user description must still be editable').not.toBeNull()
    expect(editor!.value).toBe(USER_PROSE)
    expect(editor!.value).not.toContain('Also drafted as:')
  })

  it('⭐⭐ T8 STACKED absorptions — every note is attributed, none left in the body', () => {
    // The producer loop runs per twin, so two absorptions append twice.
    seedStore([optionNode(`${USER_PROSE}\n\n${NOTE}\n\n${SECOND_NOTE}`)])
    const { dialog } = openInspector(SURVIVOR_ID)

    const note = within(dialog).getByTestId('option-drafting-note')
    expect(note.textContent).toContain(NOTE)
    expect(note.textContent).toContain(SECOND_NOTE)

    expect(descriptionEditor()!.value).toBe(USER_PROSE)
  })

  it('⭐⭐ T9 ROUND-TRIP — the edit is stored back in the PRODUCER’s exact format', () => {
    // Not a third storage format: what we write must be what CEE would write,
    // or the next consumer parses something no producer emits.
    seedStore([optionNode(`${USER_PROSE}\n\n${NOTE}`)])
    openInspector(SURVIVOR_ID)

    const editor = descriptionEditor()!
    fireEvent.change(editor, { target: { value: 'Two hires, starting in Q3.' } })
    fireEvent.blur(editor)

    expect(storedDescription()).toBe(`Two hires, starting in Q3.\n\n${NOTE}`)
  })

  it('⭐⭐ T10 TECH MODE — the advanced editor cannot erase the note either', () => {
    // Reached through the REAL controls: this path is only a defect because a
    // user can get to it. Enumerating EVERY path that reaches the marking is
    // the review-doctrine rule the first round of this work missed.
    seedStore([optionNode(`${USER_PROSE}\n\n${NOTE}`)])
    openInspector(SURVIVOR_ID)

    fireEvent.click(screen.getByLabelText('Show technical detail'))
    fireEvent.click(screen.getByText('Show model detail'))

    const advanced = screen.getByPlaceholderText('Option description') as HTMLTextAreaElement
    expect(
      advanced.value,
      'PRECONDITION: the advanced editor must show the user body, not the raw note',
    ).toBe(USER_PROSE)

    fireEvent.change(advanced, { target: { value: 'Rewritten in tech mode.' } })
    fireEvent.blur(advanced)

    const stored = storedDescription()
    expect(stored).toContain(NOTE)
    expect(stored).toContain('Rewritten in tech mode.')
  })

  it('⭐ T11 KNOWN LIMIT (F3) — user prose that OPENS with the literal is re-attributed', () => {
    // Documented, not fixed: with the note carried in a free-text description
    // there is no way to tell a drafter's line from a user who typed the same
    // words. The durable fix is a dedicated wire field, which rides the
    // contract wave with OPTION_REPHRASE_ABSORBED. This test exists so the
    // behaviour is PINNED rather than discovered — it REDs if the boundary
    // moves in either direction.
    seedStore([optionNode('Also drafted as: my own shorthand for this plan')])
    const { dialog } = openInspector(SURVIVOR_ID)

    expect(within(dialog).getByTestId('option-drafting-note').textContent).toContain(
      'Also drafted as: my own shorthand for this plan',
    )
  })

  it('⭐ T12 tolerates the legacy single-newline form and MIGRATES it on commit', () => {
    // A form only this UI ever produced (first round of 2.1204). Tolerated on
    // read so nothing is stranded, and rewritten to the producer's format the
    // first time the description is committed.
    seedStore([optionNode(`${NOTE}\n${USER_PROSE}`)])
    const { dialog } = openInspector(SURVIVOR_ID)

    expect(within(dialog).getByTestId('option-drafting-note').textContent).toContain(NOTE)
    const editor = descriptionEditor()!
    expect(editor.value).toBe(USER_PROSE)

    fireEvent.change(editor, { target: { value: 'Migrated body.' } })
    fireEvent.blur(editor)
    expect(storedDescription()).toBe(`Migrated body.\n\n${NOTE}`)
  })

  it('⭐ T4 renders NO drafting-note line when the description carries no note', () => {
    seedStore([optionNode(USER_PROSE)])
    const { dialog } = openInspector(SURVIVOR_ID)

    expect(descriptionEditor()!.value).toBe(USER_PROSE)
    expect(within(dialog).queryByTestId('option-drafting-note')).toBeNull()
  })

  it('⭐ T5 SCOPING — a non-option node with the same description gets no note line', () => {
    seedStore([goalNode(`${USER_PROSE}\n\n${NOTE}`)])
    const { dialog } = openInspector(GOAL_ID)

    // Positive control: this really is the goal inspector, open and populated.
    expect(within(dialog).getByText(GOAL_LABEL)).toBeTruthy()
    expect(within(dialog).queryByTestId('option-drafting-note')).toBeNull()
  })

  it('⭐ T6 editing a previously-empty description does not DESTROY the trace', () => {
    seedStore([optionNode(NOTE)])
    openInspector(SURVIVOR_ID)

    fireEvent.click(screen.getByText(OPTION_PLACEHOLDER))
    const editor = descriptionEditor()
    expect(editor, 'PRECONDITION: clicking the prompt must open the editor').not.toBeNull()

    fireEvent.change(editor!, { target: { value: 'Two hires, starting in Q3.' } })
    fireEvent.blur(editor!)

    expect(storedDescription()).toBe(`Two hires, starting in Q3.\n\n${NOTE}`)
  })
})
