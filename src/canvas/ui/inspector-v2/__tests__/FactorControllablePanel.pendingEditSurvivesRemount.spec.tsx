/**
 * A4b BLOCKING 1 (independent review, PR #2046) — the pending-edit provenance
 * marker must be read from the STORE, so it survives a remount AND a reload,
 * and clears the moment the store stops saying "pending".
 *
 * THE DEFECT. `InspectorRouter` mounts this panel keyed by `nodeId`
 * (`InspectorRouter.tsx:592/600`), so selecting another node and reselecting
 * this one is a FULL REMOUNT — `useState` inside the panel resets to its
 * initial value. When `valueCommitOutcome` lived only in that `useState`,
 * `isValueEditPending` reset to `false` on remount and the context pill fell
 * back to `getExtractionLabel(source)` — reading the never-restamped
 * `observedState.source` — over the user's own unsent number.
 *
 * ⚠ THE FIRST FIX-FORWARD (a module-level map keyed by node id) closed the
 * remount alone, and the second review (5840944379) reproduced three more
 * failures, each a controlled case below:
 *   · RELOAD — a module-level map does not survive a page reload, so the pill
 *     read "Estimated by Olumi" over the user's 0.7 again while the card mark
 *     read "Source not recorded".
 *   · LATER RECEIPT BY ANOTHER SEAM — the map was only ever cleared by this
 *     panel's own next commit, so after the node gained `source:
 *     'user_override'` elsewhere the pill kept saying "not saved" while the
 *     card said "Set by you".
 *   · SAME ID, OTHER GRAPH — CEE ids are semantic, so a re-seeded scenario with
 *     the same id and an untouched estimate inherited the stale "not saved".
 *
 * The pill now reads the store's own persisted signature — `source` AI-kind
 * with the extraction marker WITHDRAWN (`factorValueSourceMark` rule 4) —
 * through the predicate the card mark itself uses, so pill and card answer
 * from one record.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { useCanvasStore } from '../../../store'
import { SEND_BLOCKED } from '../../../conversation/useConversation'
import {
  confirmOptimisticFactorEdit,
  type OptimisticFactorEdit,
} from '../../../conversation/optimisticFactorEdit'
import { factorValueSourceMark } from '../../../nodes/shared/valueSourceMark'

const NODE_ID = 'fac_remount_pending_probe'
const COMMITTED_RAW = 0.8
const NEW_RAW = 0.7
const OTHER_GRAPH_RAW = 0.3

const noop = () => {}

function factorNode(raw: number = COMMITTED_RAW, label = 'Remount Pending Probe'): Node {
  return {
    id: NODE_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: 'factor',
      factor_type: 'lever',
      observedState: {
        value: raw,
        raw_value: raw,
        cap: 1,
        display_value: String(raw),
        source: 'cee_inference',
      },
    },
  } as unknown as Node
}

function seed(nodes: Node[] = [factorNode()]) {
  useCanvasStore.setState(
    { nodes, edges: [], results: { status: 'idle', report: null } } as never,
    false,
  )
}

function renderPanel() {
  return render(
    <FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />,
  )
}

function contextGroup(container: HTMLElement) {
  return container.querySelector('[data-panel-group="context"]')
}

function storedNodeData(): unknown {
  return useCanvasStore.getState().nodes.find(n => n.id === NODE_ID)?.data
}

function commit(next: string) {
  const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement
  fireEvent.change(input, { target: { value: next } })
  fireEvent.blur(input)
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** A blocked commit of NEW_RAW, confirmed pending while mounted, then unmounted. */
async function blockedCommitThenUnmount() {
  sendSystemEvent.mockResolvedValue(SEND_BLOCKED)
  const first = renderPanel()
  commit(String(NEW_RAW))
  await flush()
  // Precondition: while mounted, the pill already says the edit is unsaved.
  expect(contextGroup(first.container)?.textContent).toContain('Your edit')
  expect(contextGroup(first.container)?.textContent).not.toContain('Estimated by Olumi')
  first.unmount()
}

describe('A4b Blocking 1 — the pending marker is read from the store, not panel memory', () => {
  beforeEach(() => {
    sendSystemEvent.mockReset()
    seed()
  })
  afterEach(() => cleanup())

  it('a blocked send stays "Your edit" after unmount + remount of the SAME node (the reselect reproduction)', async () => {
    await blockedCommitThenUnmount()
    // ...then mount a FRESH instance for the SAME node (as InspectorRouter
    // does when the user selects it again). Nothing about the store changed:
    // the edit is still exactly as unsent as it was a moment ago.
    const second = renderPanel()

    expect(contextGroup(second.container)?.textContent).toContain('Your edit')
    expect(contextGroup(second.container)?.textContent).not.toContain('Estimated by Olumi')
  })

  it('a SENT edit whose receipt landed does not read "pending" on a later remount', async () => {
    // CONTRAST: the real dispatcher resolves AFTER ingesting the response and
    // confirming the optimistic write, which stamps the receipt onto the
    // store. That stamp — not the panel's memory of `sent` — is what ends the
    // pending claim. The receipt writer here is the production one.
    sendSystemEvent.mockImplementation(
      async (_event: unknown, opts?: { optimisticFactorEdit?: OptimisticFactorEdit }) => {
        if (opts?.optimisticFactorEdit) confirmOptimisticFactorEdit(opts.optimisticFactorEdit)
        return undefined
      },
    )

    const first = renderPanel()
    commit(String(NEW_RAW))
    await flush()
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    first.unmount()
    const second = renderPanel()

    expect(contextGroup(second.container)?.textContent).not.toContain('Your edit')
    expect(contextGroup(second.container)?.textContent).toContain('Set by you')
  })

  it('LATER RECEIPT BY ANOTHER SEAM: once the store stamps `user_override`, a remount reads "Set by you", not "not saved"', async () => {
    await blockedCommitThenUnmount()

    // Another seam (`useModelEditAuthority`'s stamp, an applied patch) earns
    // the receipt while this panel is unmounted: the node gains `source:
    // 'user_override'` and its extraction markers stay cleared.
    useCanvasStore.setState(
      {
        nodes: useCanvasStore.getState().nodes.map(n => {
          if (n.id !== NODE_ID) return n
          const data = n.data as Record<string, unknown>
          const obs = data.observedState as Record<string, unknown>
          return { ...n, data: { ...data, observedState: { ...obs, source: 'user_override' } } }
        }),
      } as never,
      false,
    )
    expect(factorValueSourceMark(storedNodeData())).toEqual({ kind: 'you', label: 'Set by you' })

    const second = renderPanel()
    // RED on the module map: the map still held `local_only` for this id, so
    // the pill read "Your edit — not saved to the model yet" while the card
    // read "Set by you".
    expect(contextGroup(second.container)?.textContent).not.toContain('Your edit')
    expect(contextGroup(second.container)?.textContent).toContain('Set by you')
  })

  it('SAME ID, OTHER GRAPH: an untouched estimate on a re-seeded scenario is not "Your edit"', async () => {
    await blockedCommitThenUnmount()

    // A different scenario loads with the SAME semantic id and an untouched
    // `cee_inference` 0.3 — nobody typed anything into this one.
    seed([factorNode(OTHER_GRAPH_RAW, 'Other Scenario Probe')])
    expect(factorValueSourceMark(storedNodeData())?.kind).toBe('olumi')

    const second = renderPanel()
    // RED on the module map: the id collided, so the pill read "Your edit —
    // not saved to the model yet" over a value the card marks as Olumi's.
    expect(contextGroup(second.container)?.textContent).not.toContain('Your edit')
    expect(contextGroup(second.container)?.textContent).toContain('Estimated by Olumi')
  })

  it('RELOAD: after a JSON round trip and a fresh module graph, the pill still reads "Your edit", agreeing with the card', async () => {
    await blockedCommitThenUnmount()

    // What a reload does: the store is persisted as JSON (autosave) and
    // restored into a FRESH module graph — no panel memory survives.
    const persisted = JSON.parse(JSON.stringify(useCanvasStore.getState().nodes)) as Node[]
    vi.resetModules()
    const { FactorControllablePanel: ReloadedPanel } = await import('../panels/FactorControllablePanel')
    const { useCanvasStore: reloadedStore } = await import('../../../store')
    reloadedStore.setState(
      { nodes: persisted, edges: [], results: { status: 'idle', report: null } } as never,
      false,
    )
    const reloadedData = reloadedStore.getState().nodes.find(n => n.id === NODE_ID)?.data
    // The card's reading of the same persisted record (A4c: the withdrawal
    // survives serialisation as `null`).
    expect(factorValueSourceMark(reloadedData)?.kind).toBe('unknown')

    const { container } = render(
      <ReloadedPanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />,
    )
    // RED on the module map: a fresh module has an empty map, so the pill fell
    // back to `getExtractionLabel('cee_inference')` — "Estimated by Olumi" over
    // the user's own unsent 0.7 — while the card read "Source not recorded".
    expect(contextGroup(container)?.textContent).toContain('Your edit')
    expect(contextGroup(container)?.textContent).not.toContain('Estimated by Olumi')
  })
})
