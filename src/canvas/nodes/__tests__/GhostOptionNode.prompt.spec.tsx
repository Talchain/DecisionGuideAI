/**
 * The pre-analysis option door sends a sentence built from THIS model.
 *
 * ⭐ THE ONE DOOR `#1060` DID NOT REACH, AND WHY IT WAS INVISIBLE.
 *
 * `#1060` gave every frontier door a prompt composed from the model it stands
 * beside, and `ghostTiers.ts` holds up the sentence this component used to send
 * — "Suggest an additional option I haven't considered for this decision" — as
 * the bad example that work existed to abolish. It stayed live anyway, because
 * the canvas never routed the OPTION tier through `withGhostTiers`:
 * `ReactFlowGraph.tsx` filters that tier out (`tierGhosts`) and builds the
 * legacy `ghost-option` node itself, historically with `data: {}`. So the
 * hardcoded string inside this component was what actually fired, and
 * `ghostTiersPrompt.spec.ts` was green about `GHOST_TIERS`' option prompt — a
 * prompt the canvas never asked for. A spec bound to a path the deployment does
 * not take is the estate's signature test defect, and this file is the runtime
 * half of the repair.
 *
 * ⚠ WHAT THIS FILE ASSERTS THAT A SOURCE-TEXT GUARD CANNOT. It RENDERS the
 * component and CLICKS it, so the assertion is about the bytes that reach
 * `guidanceStore._sendMessage` — the user's own transcript, under the user's own
 * name. `ghostTiersPrompt.spec.ts` proves the composer builds the right
 * sentence and that the mount hands it over; this proves the door sends what it
 * was handed and invents nothing when it is handed nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GhostOptionNode } from '../GhostOptionNode'
import { GHOST_OPTION_NODE_ID, GHOST_OPTION_DOOR_LABEL, ghostOptionPrompt } from '../../utils/ghostTiers'
import { useGuidanceStore } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/** The literal this component used to send, spelled once, for the guards. */
const STATIC_SENTENCE = "Suggest an additional option I haven't considered for this decision"

const n = (id: string, type: string, label: string): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: { label, type } }) as Node

const MODEL: Node[] = [
  n('d1', 'decision', 'Replace our customer data platform before the March renewal'),
  n('o1', 'option', 'Segment'),
  n('o2', 'option', 'RudderStack'),
  n('f1', 'factor', 'Annual platform cost'),
]

/**
 * Mount the door exactly as the canvas mounts it — id and all.
 *
 * The id is passed rather than defaulted so the node under test is the one the
 * mount builds (`GHOST_OPTION_NODE_ID`), not a lookalike this file invented.
 */
function mount(data: Record<string, unknown>) {
  const props = {
    id: GHOST_OPTION_NODE_ID,
    type: 'ghost-option',
    data,
    selected: false,
    zIndex: 0,
    isConnectable: false,
    xPos: 0,
    yPos: 0,
    dragging: false,
  } as unknown as NodeProps
  return render(
    <ReactFlowProvider>
      <GhostOptionNode {...props} />
    </ReactFlowProvider>,
  )
}

/** Install a spy as the store's send channel and return it. */
function captureSends(): { calls: string[] } {
  const calls: string[] = []
  useGuidanceStore.setState({ _sendMessage: (text: string) => { calls.push(text) } })
  return { calls }
}

beforeEach(() => {
  useGuidanceStore.setState({ _sendMessage: null })
})

describe('the pre-analysis option door sends the model-aware sentence', () => {
  it('sends EXACTLY what the composer built for this model — bound by equality, not by keyword', () => {
    // ⚠ BOUND TO THE COMPOSER, NOT TO A PHRASE. Asserting only that the sent
    // text "contains Segment" would pass for any sentence that happened to
    // mention an option; asserting equality with `ghostOptionPrompt(MODEL)`
    // means the door cannot send a second, divergent sentence about the same
    // model — which is the failure mode that produced this defect in the first
    // place (two derivations of one list, and they disagreed).
    const sent = captureSends()
    mount({ prompt: ghostOptionPrompt(MODEL) })
    fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL }))

    expect(sent.calls).toHaveLength(1)
    expect(sent.calls[0]).toBe(ghostOptionPrompt(MODEL))
  })

  it('that sentence actually names this model — the CONTRAST CONTROL for the equality above', () => {
    // Equality with the composer would hold even if the composer returned a
    // constant. This binds the sent bytes to THIS model's contents by identity:
    // the two option labels and the decision subject, all of which appear
    // nowhere in the component.
    const sent = captureSends()
    mount({ prompt: ghostOptionPrompt(MODEL) })
    fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL }))

    const text = sent.calls[0]
    expect(text).toContain('Segment')
    expect(text).toContain('RudderStack')
    expect(text).toContain('Replace our customer data platform before the March renewal')
    expect(text).toContain('2 options')
  })

  it('⛔ NEVER the static sentence — the exact string this door used to send', () => {
    const sent = captureSends()
    mount({ prompt: ghostOptionPrompt(MODEL) })
    fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL }))

    expect(sent.calls[0]).not.toContain(STATIC_SENTENCE)
    expect(sent.calls[0]).not.toContain('an additional option I haven')
  })

  it('DISCRIMINATION: two models that differ only in their options are not sent the same sentence', () => {
    // A door that read nothing would satisfy every assertion above on a single
    // fixture. This is the pair that proves it is reading, and it fails the
    // moment the prompt goes back to being a constant.
    const other: Node[] = [
      n('d1', 'decision', 'Replace our customer data platform before the March renewal'),
      n('o1', 'option', 'Snowplow'),
      n('f1', 'factor', 'Annual platform cost'),
    ]

    const first = captureSends()
    const a = mount({ prompt: ghostOptionPrompt(MODEL) })
    fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL }))
    a.unmount()

    const second = captureSends()
    mount({ prompt: ghostOptionPrompt(other) })
    fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL }))

    expect(first.calls[0]).not.toBe(second.calls[0])
    expect(second.calls[0]).toContain('Snowplow')
    expect(second.calls[0]).not.toContain('Segment')
  })

  it('sends NOTHING rather than a generic sentence when it is handed no prompt', () => {
    // ⭐ THE FALLBACK IS THE DEFECT. Keeping the static string as a safety net
    // would mean any path that forgot to compose one silently re-opens exactly
    // what this change closes — a hand-maintained mirror in a click handler,
    // green in every test that passes a prompt. A door that does nothing is a
    // visible failure; a door that sends a model-blind sentence is confident
    // wrongness, and this estate ranks those in that order.
    //
    // `GhostTierNode` already sends nothing without a prompt; the two doors now
    // agree rather than each inventing a policy.
    const sent = captureSends()
    mount({})
    fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL }))

    expect(sent.calls).toEqual([])
  })

  it('does not throw when the store has no send channel at all', () => {
    // The pre-existing null-guard, re-pinned: the click path now reads two
    // things that can be absent instead of one.
    useGuidanceStore.setState({ _sendMessage: null })
    mount({ prompt: ghostOptionPrompt(MODEL) })
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL })),
    ).not.toThrow()
  })
})

describe('the static sentence is gone from the component, not merely unreached', () => {
  const source = readFileSync(join(__dirname, '../GhostOptionNode.tsx'), 'utf-8')

  it('POSITIVE CONTROL: the file was actually read', () => {
    // Without this an empty read would make both assertions below vacuous —
    // an absence probe with nothing proving it can see a presence.
    expect(source.length).toBeGreaterThan(500)
    expect(source).toContain('GhostOptionNode')
  })

  it('carries no hardcoded sentence for the door to fall back to', () => {
    expect(source).not.toContain(STATIC_SENTENCE)
    expect(source).not.toContain('an additional option I haven')
  })
})

/**
 * ⚠⚠ THE VISIBLE TEXT WAS UNPINNED, AND A MUTANT PROVED IT (3 Sep 2026).
 *
 * Every lookup in this file finds the door by ACCESSIBLE NAME. So replacing the
 * rendered `{GHOST_OPTION_DOOR_LABEL}` with a hardcoded "+ Explore another
 * option" — restoring, exactly, the drift this PR closed — left the whole file
 * GREEN: the `aria-label` still read the constant, so every `getByRole` still
 * matched, and nothing in the suite ever looked at what a sighted user reads.
 *
 * That is the defect itself, not a hypothetical: the door SHIPPED with a
 * visible "+ Explore another option" beside an `aria-label` of "Add another
 * option", two hand-kept strings for one idea, and no test could see the
 * difference between them.
 */
describe('the visible sentence and the accessible name are the same string', () => {
  it('renders GHOST_OPTION_DOOR_LABEL as text, not only as the accessible name', () => {
    mount({ prompt: 'anything' })
    const door = screen.getByRole('button', { name: GHOST_OPTION_DOOR_LABEL })
    // The load-bearing half: the accessible-name lookup above passes whatever
    // the visible text says, so the visible text is asserted separately.
    expect(door.textContent?.trim()).toBe(GHOST_OPTION_DOOR_LABEL)
    expect(door).toHaveAttribute('aria-label', GHOST_OPTION_DOOR_LABEL)
    // And it is a question, bound to the tier table rather than restated here.
    expect(GHOST_OPTION_DOOR_LABEL.trim().endsWith('?')).toBe(true)
  })
})
