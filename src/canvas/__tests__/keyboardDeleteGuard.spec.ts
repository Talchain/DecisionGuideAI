/**
 * ⛔ THE KEYBOARD DELETE MUST ASK THE SAME QUESTION THE MENU ASKS.
 *
 * The context menu's Delete goes through `deleteAction`, which assesses the
 * structural impact (`assessNodeDeletion` / `assessEdgeDeletion`) and — when the
 * removal disconnects an option, orphans a node, or takes the last goal or
 * decision — either asks first (`useConfirmDialogStore`) or refuses with a
 * toast. Delete/Backspace on the SAME selection used to call
 * `store.deleteSelected()` straight away: no assessment, no dialog, no refusal.
 * There is no Undo on the canvas, so one keystroke could silently cut an option
 * off from the goal in front of an audience.
 *
 * Every case drives the REAL hook against the REAL canvas store, the REAL
 * confirm-dialog store and the REAL guardrails. Nothing on the delete path is
 * mocked, because the path is the subject.
 *
 * ⚠ EVERY "NOTHING WAS DELETED" ASSERTION IS PAIRED WITH A CONTRAST. The fixed
 * delete settles asynchronously (the menu's `commitValidatedMutation` awaits a
 * dynamic import), so "still present" read too early would pass for the wrong
 * reason. `settle()` is the same window everywhere, and the contrast cases
 * prove a real delete COMPLETES inside it — so absence after `settle()` means
 * absence, not "not yet".
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'

import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { useCanvasStore } from '../store'
import { useConfirmDialogStore } from '../stores/confirmDialogStore'
import { deleteAction } from '../contextMenu/actions'
import type { EdgeTarget, NodeTarget } from '../contextMenu/types'
import { STRUCTURAL_DELETE_STOOD_DOWN_NOTICE } from '../mutations/structuralDelete'
import type { EdgeData } from '../domain/edges'

// ── the graph ────────────────────────────────────────────────────────────────
//
//   decision ──▶ option_a ──▶ factor_price ──▶ goal        factor_loose (unlinked)
//
// Removing `factor_price` (or its edge to the goal) cuts "Raise price" off from
// the goal. `factor_loose` touches nothing, so removing it is not significant.

const GOAL_LABEL = 'Hit revenue target'
const OPTION_LABEL = 'Raise price'
const LINKED_LABEL = 'Price level'
const LOOSE_LABEL = 'Weather'

function node(id: string, type: string, label: string): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { label, kind: type } }
}
function edge(id: string, source: string, target: string): Edge<EdgeData> {
  return { id, source, target, data: {} as EdgeData }
}

const HASH = 'f3d31f75957c5cb5'

function seed(overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: null,
    nodes: [
      node('goal', 'goal', GOAL_LABEL),
      node('decision', 'decision', 'Pricing decision'),
      node('option_a', 'option', OPTION_LABEL),
      node('factor_price', 'factor', LINKED_LABEL),
      node('factor_loose', 'factor', LOOSE_LABEL),
    ],
    edges: [
      edge('e-dec-opt', 'decision', 'option_a'),
      edge('e-opt-price', 'option_a', 'factor_price'),
      edge('e-price-goal', 'factor_price', 'goal'),
    ],
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
    lastServerGraphHash: null,
    lastAuthoritativeGraph: null,
    pendingStructuralDeletes: [],
    _externalMutationActive: 0,
    ...overrides,
  } as never)
}

function select(nodeIds: string[], edgeIds: string[] = []) {
  useCanvasStore.setState({
    selection: { nodeIds: new Set(nodeIds), edgeIds: new Set(edgeIds), anchorPosition: null },
  } as never)
}

const nodeIds = () => useCanvasStore.getState().nodes.map((n) => n.id)
const edgeIds = () => useCanvasStore.getState().edges.map((e) => e.id)
const pending = () => useConfirmDialogStore.getState().pending

/** Everything that reached the canvas's toast bridge (`topbar:show-toast`). */
interface Toast { message: string; level: string }
function captureToasts(): { toasts: Toast[]; dispose: () => void } {
  const toasts: Toast[] = []
  const handler = (e: Event) => {
    const d = (e as CustomEvent<{ message?: string; level?: string }>).detail
    toasts.push({ message: d?.message ?? '', level: d?.level ?? '' })
  }
  window.addEventListener('topbar:show-toast', handler)
  return { toasts, dispose: () => window.removeEventListener('topbar:show-toast', handler) }
}

/** A keydown that bubbles to `window` from `target` (default: the body). */
function press(key: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
}

/**
 * One fixed window for a delete to finish. The menu's execute path awaits a
 * dynamic import; warming it here keeps the window short and the SAME for the
 * cases that must see a delete and the cases that must not.
 */
async function settle() {
  await import('../../adapters/plot')
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

const LAST_GOAL_REFUSAL = 'Every model needs a goal. Add a different goal before removing this one.'

const LINKED_TITLE = `Remove "${LINKED_LABEL}"?`
const LINKED_MESSAGE =
  `Removing "${LINKED_LABEL}" breaks the path from "${OPTION_LABEL}" to your goal. ` +
  `The analysis won't be able to evaluate that option. ` +
  `"${GOAL_LABEL}" will be left disconnected and won't affect the analysis.`

let toastCapture: ReturnType<typeof captureToasts>

beforeEach(() => {
  seed()
  useConfirmDialogStore.setState({ pending: null })
  toastCapture = captureToasts()
})

afterEach(() => {
  toastCapture.dispose()
  useConfirmDialogStore.setState({ pending: null })
})

describe('keyboard Delete applies the menu\'s impact check', () => {
  it('(a) Delete on a card whose removal cuts an option off → the confirm dialog opens, and the card stays', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['factor_price'])

    press('Delete')
    await settle()

    // Bound by the dialog store's own state, by exact title and message.
    expect(pending()?.title).toBe(LINKED_TITLE)
    expect(pending()?.message).toBe(LINKED_MESSAGE)
    expect(pending()?.confirmLabel).toBe('Remove')
    expect(nodeIds()).toContain('factor_price')
    expect(edgeIds()).toContain('e-price-goal')
    expect(toastCapture.toasts).toEqual([])
  })

  it('(a′) Backspace is the same gesture — it asks too', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['factor_price'])

    press('Backspace')
    await settle()

    expect(pending()?.title).toBe(LINKED_TITLE)
    expect(nodeIds()).toContain('factor_price')
  })

  it('(b) confirming deletes the card through the structural-delete path — one intent naming exactly it', async () => {
    // A server-backed scenario with a CAS base, so the store's structural-delete
    // chokepoint records an intent we can bind to by id.
    seed({ currentScenarioId: 's1', lastServerGraphHash: HASH })
    renderHook(() => useKeyboardShortcuts())
    select(['factor_price'])

    press('Delete')
    await settle()
    expect(nodeIds()).toContain('factor_price')
    expect(useCanvasStore.getState().pendingStructuralDeletes).toEqual([])

    // What `StoreConfirmDialog` does on "Remove".
    pending()!.onConfirm()
    useConfirmDialogStore.getState().dismiss()
    await settle()

    expect(nodeIds()).not.toContain('factor_price')
    expect(nodeIds()).toContain('option_a')
    const queued = useCanvasStore.getState().pendingStructuralDeletes
    expect(queued).toHaveLength(1)
    expect(queued[0].removedNodeIds).toEqual(['factor_price'])
    expect(queued[0].baseGraphHash).toBe(HASH)
  })

  it('(b′) cancelling leaves the graph exactly as it was', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['factor_price'])
    const before = { nodes: nodeIds(), edges: edgeIds() }

    press('Delete')
    await settle()
    useConfirmDialogStore.getState().dismiss()
    await settle()

    expect({ nodes: nodeIds(), edges: edgeIds() }).toEqual(before)
  })

  it('(c) CONTRAST: Delete on an unlinked factor deletes it immediately — no dialog, no toast', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['factor_loose'])

    press('Delete')
    await settle()

    expect(pending()).toBeNull()
    expect(toastCapture.toasts).toEqual([])
    expect(nodeIds()).not.toContain('factor_loose')
    // Nothing else went with it.
    expect(nodeIds()).toEqual(['goal', 'decision', 'option_a', 'factor_price'])
  })

  it('(d) the last goal → the menu\'s refusal toast, and nothing is deleted', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['goal'])

    press('Delete')
    await settle()

    expect(toastCapture.toasts).toEqual([{ message: LAST_GOAL_REFUSAL, level: 'warning' }])
    expect(pending()).toBeNull()
    expect(nodeIds()).toContain('goal')
    expect(edgeIds()).toContain('e-price-goal')
  })

  it('(f) Backspace/Delete typed in a text field deletes nothing — even an unlinked factor', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['factor_loose'])
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    document.body.append(input, textarea)
    try {
      press('Backspace', input)
      press('Delete', input)
      press('Backspace', textarea)
      await settle()
    } finally {
      input.remove()
      textarea.remove()
    }

    // `factor_loose` is the case (c) deletes on a canvas keypress, so its
    // survival here is the text-entry guard, not the impact check.
    expect(nodeIds()).toContain('factor_loose')
    expect(pending()).toBeNull()
    expect(toastCapture.toasts).toEqual([])
  })

  it('nothing selected → nothing happens (no dialog, no toast, no freshness change)', async () => {
    useCanvasStore.setState({ analysisFreshnessDirty: false } as never)
    renderHook(() => useKeyboardShortcuts())

    press('Delete')
    await settle()

    expect(pending()).toBeNull()
    expect(toastCapture.toasts).toEqual([])
    expect(nodeIds()).toHaveLength(5)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })
})

describe('one source of truth — the keyboard\'s answer IS the menu\'s answer', () => {
  it('the dialog the keyboard opens is field-for-field the dialog the menu opens', async () => {
    const target: NodeTarget = {
      kind: 'node',
      nodeId: 'factor_price',
      nodeType: 'factor',
      node: useCanvasStore.getState().nodes.find((n) => n.id === 'factor_price')!,
      screenPos: { x: 0, y: 0 },
    }
    const menuToasts: Array<[string, string]> = []
    await deleteAction(target, (m, t) => { menuToasts.push([m, t]) })
    const fromMenu = pending()
    expect(fromMenu?.title).toBe(LINKED_TITLE)
    useConfirmDialogStore.setState({ pending: null })

    renderHook(() => useKeyboardShortcuts())
    select(['factor_price'])
    press('Delete')
    await settle()
    const fromKeyboard = pending()

    expect({
      title: fromKeyboard?.title,
      message: fromKeyboard?.message,
      confirmLabel: fromKeyboard?.confirmLabel,
    }).toEqual({
      title: fromMenu?.title,
      message: fromMenu?.message,
      confirmLabel: fromMenu?.confirmLabel,
    })
    expect(menuToasts).toEqual([])
  })

  it('the refusal the keyboard shows is the refusal the menu shows', async () => {
    const target: NodeTarget = {
      kind: 'node',
      nodeId: 'goal',
      nodeType: 'goal',
      node: useCanvasStore.getState().nodes.find((n) => n.id === 'goal')!,
      screenPos: { x: 0, y: 0 },
    }
    const menuToasts: Toast[] = []
    await deleteAction(target, (message, level) => { menuToasts.push({ message, level }) })
    expect(menuToasts).toEqual([{ message: LAST_GOAL_REFUSAL, level: 'warning' }])

    renderHook(() => useKeyboardShortcuts())
    select(['goal'])
    press('Delete')
    await settle()

    expect(toastCapture.toasts).toEqual(menuToasts)
  })
})

describe('multi-selection: one question for the whole gesture', () => {
  it('(g) one significant card among several → ONE dialog, nothing deleted until confirmed', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['factor_price', 'factor_loose'])

    press('Delete')
    await settle()

    expect(pending()?.title).toBe('Remove "2 elements"?')
    expect(pending()?.message).toContain(`"${OPTION_LABEL}"`)
    expect(nodeIds()).toEqual(expect.arrayContaining(['factor_price', 'factor_loose']))

    pending()!.onConfirm()
    useConfirmDialogStore.getState().dismiss()
    await settle()
    expect(nodeIds()).not.toContain('factor_price')
    expect(nodeIds()).not.toContain('factor_loose')
  })

  it('(h) a blocked card among several → the refusal, and NOTHING is deleted (not even the harmless one)', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['goal', 'factor_loose'])

    press('Delete')
    await settle()

    expect(toastCapture.toasts).toEqual([{ message: LAST_GOAL_REFUSAL, level: 'warning' }])
    expect(pending()).toBeNull()
    expect(nodeIds()).toEqual(expect.arrayContaining(['goal', 'factor_loose']))
  })

  it('(i) a selected CONNECTION whose removal cuts an option off counts too', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['factor_loose'], ['e-price-goal'])

    press('Delete')
    await settle()

    expect(pending()?.title).toBe('Remove "2 elements"?')
    expect(pending()?.message).toContain(`"${OPTION_LABEL}"`)
    expect(edgeIds()).toContain('e-price-goal')
    expect(nodeIds()).toContain('factor_loose')
  })

  it('(i′) TWIN: an option deleted together with its own link is not warned about — it is going too', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['option_a'], ['e-opt-price'])

    press('Delete')
    await settle()

    expect(pending()).toBeNull()
    expect(toastCapture.toasts).toEqual([])
    expect(nodeIds()).not.toContain('option_a')
    expect(edgeIds()).not.toContain('e-opt-price')
  })
})

/**
 * ⛔ A DELETE THE STORE REFUSES MUST NOT MARK THE RESULTS UNCONFIRMED.
 *
 * With a server scenario and no current CAS base, the store's fail-closed gate
 * (`recordStructuralDeleteIntent`, reason `no_server_graph_hash`) refuses the
 * removal and says "Nothing was removed". `commitValidatedMutation` used to
 * mark the freshness overlay dirty after `localApply` regardless — so a
 * keypress whose own toast says nothing changed downgraded a retained `fresh`
 * verdict to "cannot confirm", and only a NEW analysis cleared it. The three
 * execute paths (node, connection, multi) each reach a different store action,
 * so each is driven here; the contrast proves the same seed with a hash DOES
 * delete and DOES mark, inside the same `settle()`.
 */
describe('a refused delete leaves analysis freshness alone', () => {
  const refusedSeed = () =>
    seed({ currentScenarioId: 's1', lastServerGraphHash: null, analysisFreshnessDirty: false })
  const dirty = () => useCanvasStore.getState().analysisFreshnessDirty
  const STOOD_DOWN = { message: STRUCTURAL_DELETE_STOOD_DOWN_NOTICE, level: 'warning' }

  it('(j) keyboard, one unlinked card: kept, the stood-down toast, and freshness NOT dirty', async () => {
    refusedSeed()
    renderHook(() => useKeyboardShortcuts())
    select(['factor_loose'])

    press('Backspace')
    await settle()

    expect(nodeIds()).toContain('factor_loose')
    expect(useCanvasStore.getState().pendingStructuralDeletes).toEqual([])
    expect(toastCapture.toasts).toEqual([STOOD_DOWN])
    expect(dirty()).toBe(false)
  })

  it('(j) CONTRAST: the same card with a CAS base is deleted and freshness IS dirty', async () => {
    seed({ currentScenarioId: 's1', lastServerGraphHash: HASH, analysisFreshnessDirty: false })
    renderHook(() => useKeyboardShortcuts())
    select(['factor_loose'])

    press('Backspace')
    await settle()

    expect(nodeIds()).not.toContain('factor_loose')
    expect(toastCapture.toasts).toEqual([])
    expect(dirty()).toBe(true)
  })

  it('(j′) a confirmed multi-delete the store refuses: both kept, freshness NOT dirty', async () => {
    refusedSeed()
    renderHook(() => useKeyboardShortcuts())
    select(['factor_price', 'factor_loose'])

    press('Delete')
    await settle()
    pending()!.onConfirm()
    useConfirmDialogStore.getState().dismiss()
    await settle()

    expect(nodeIds()).toEqual(expect.arrayContaining(['factor_price', 'factor_loose']))
    expect(toastCapture.toasts).toEqual([STOOD_DOWN])
    expect(dirty()).toBe(false)
  })

  it('(j″) the menu\'s connection delete the store refuses: kept, freshness NOT dirty', async () => {
    refusedSeed()
    const target: EdgeTarget = {
      kind: 'edge',
      edgeId: 'e-price-goal',
      edge: useCanvasStore.getState().edges.find((e) => e.id === 'e-price-goal')! as EdgeTarget['edge'],
      isStructural: false,
      screenPos: { x: 0, y: 0 },
    }
    await deleteAction(target, () => {})
    // Removing this link cuts the option off, so the menu asks first.
    pending()!.onConfirm()
    useConfirmDialogStore.getState().dismiss()
    await settle()

    expect(edgeIds()).toContain('e-price-goal')
    expect(toastCapture.toasts).toEqual([STOOD_DOWN])
    expect(dirty()).toBe(false)
  })
})

describe('one keypress, one delete attempt', () => {
  it('(k) a held key (auto-repeat) does not re-run the delete — one refusal toast, not a column', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['goal'])

    press('Backspace')
    press('Backspace', document.body, { repeat: true })
    press('Backspace', document.body, { repeat: true })
    await settle()

    expect(toastCapture.toasts).toEqual([{ message: LAST_GOAL_REFUSAL, level: 'warning' }])
  })

  it('(l) Delete while the confirm dialog is open does not re-open it', async () => {
    renderHook(() => useKeyboardShortcuts())
    select(['factor_price'])

    press('Delete')
    await settle()
    const first = pending()
    expect(first?.title).toBe(LINKED_TITLE)

    // Focus sits on the dialog's Remove button; a second Backspace lands there.
    const button = document.createElement('button')
    document.body.append(button)
    try {
      press('Backspace', button)
      await settle()
    } finally {
      button.remove()
    }

    expect(pending()).toBe(first)
    expect(nodeIds()).toContain('factor_price')
  })
})
