/**
 * A4b BLOCKING 1 (independent review, PR #2046) — the pending-edit provenance
 * marker must survive a remount of the SAME factor, not just the current
 * mount.
 *
 * THE DEFECT. `InspectorRouter` mounts this panel keyed by `nodeId`
 * (`InspectorRouter.tsx:592/600`), so selecting another node and reselecting
 * this one is a FULL REMOUNT — `useState` inside the panel resets to its
 * initial value. Before this fix, `valueCommitOutcome` lived only in that
 * `useState`, so `isValueEditPending` reset to `false` on remount and the
 * context pill fell back to `getExtractionLabel(source)` — reading the
 * never-restamped `observedState.source` — over the user's own unsent number.
 * Reproduced by the review with a blocked send: pill correct while mounted,
 * "Estimated by Olumi" again after reselecting away and back.
 *
 * Uses its own node id, deliberately distinct from
 * `FactorControllablePanel.pendingEditProvenance.spec.tsx`'s, since the fix's
 * cross-remount memory is a MODULE-level map keyed by node id — sharing an id
 * with another spec in the same file's module registry would leak state
 * between tests that never call the writer that would otherwise clear it.
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

const NODE_ID = 'fac_remount_pending_probe'
const COMMITTED_RAW = 0.8
const NEW_RAW = 0.7

const noop = () => {}

function factorNode(): Node {
  return {
    id: NODE_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Remount Pending Probe',
      kind: 'factor',
      factor_type: 'lever',
      observedState: {
        value: COMMITTED_RAW,
        raw_value: COMMITTED_RAW,
        cap: 1,
        display_value: String(COMMITTED_RAW),
        source: 'cee_inference',
      },
    },
  } as unknown as Node
}

function seed() {
  useCanvasStore.setState(
    { nodes: [factorNode()], edges: [], results: { status: 'idle', report: null } } as never,
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

function commit(next: string) {
  const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement
  fireEvent.change(input, { target: { value: next } })
  fireEvent.blur(input)
}

describe('A4b Blocking 1 — the pending marker survives a remount of the same node', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    seed()
  })
  afterEach(() => cleanup())

  it('a blocked send stays "Your edit" after unmount + remount of the SAME node (the reselect reproduction)', async () => {
    sendSystemEvent.mockResolvedValue(SEND_BLOCKED)

    const first = renderPanel()
    commit(String(NEW_RAW))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    // While mounted: correct, per the companion spec.
    expect(contextGroup(first.container)?.textContent).toContain('Your edit')
    expect(contextGroup(first.container)?.textContent).not.toContain('Estimated by Olumi')

    // Simulate the reselect: unmount this panel instance (as InspectorRouter
    // does when `key={nodeId}` changes to another node)...
    first.unmount()
    // ...then mount a FRESH instance for the SAME node (as InspectorRouter
    // does when the user selects it again). Nothing about the store changed:
    // the edit is still exactly as unsent as it was a moment ago.
    const second = renderPanel()

    // RED before the fix: `valueCommitOutcome` reset to `null` on the fresh
    // `useState`, `isValueEditPending` became `false`, and the pill fell back
    // to `getExtractionLabel('cee_inference')` — "Estimated by Olumi" over the
    // user's own unsent 0.7.
    expect(contextGroup(second.container)?.textContent).toContain('Your edit')
    expect(contextGroup(second.container)?.textContent).not.toContain('Estimated by Olumi')
  })

  it('a genuinely SENT edit does not fall back to "pending" on a later remount', async () => {
    // CONTRAST: the map must not pin every node "pending" forever — once the
    // outcome settles to `sent`, a later remount must not resurrect `local_only`.
    sendSystemEvent.mockResolvedValue(undefined)

    const first = renderPanel()
    commit(String(NEW_RAW))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    first.unmount()
    const second = renderPanel()

    expect(contextGroup(second.container)?.textContent).not.toContain('Your edit')
  })
})
