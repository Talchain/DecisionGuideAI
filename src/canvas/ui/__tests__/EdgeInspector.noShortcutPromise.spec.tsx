/**
 * EdgeInspector — the delete notice must not promise a keyboard shortcut.
 *
 * ── WHY THIS PIN EXISTS, AND HOW IT WAS MISSED FIRST TIME ───────────────────
 * `handleDelete` announced "Connector deleted — press ⌘Z to undo." ⌘Z does not
 * undo: `useKeyboardShortcuts` gates its undo AND redo branches on
 * `hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations)`,
 * an authority fixed at `'disabled'`. Nothing redeems the promise — the context
 * menu strips its undo/redo entries and the left-rail buttons are permanently
 * disabled.
 *
 * ⚠ THIS PATH IS LIVE, AND AN EARLIER PASS OF THIS WORK RECORDED IT AS DEAD by
 * inheriting that claim instead of tracing it. The chain is:
 *   edge click → `InspectorModal` (imported and mounted by `ReactFlowGraph`)
 *              → `EdgeInspector` → "Delete connector" → `handleDelete`.
 * `PropertiesPanel` is a second live importer. No flag, no `disabled`, no
 * authority gate anywhere on it.
 *
 * THE LESSON THIS PIN ENCODES: the first sweep looked at the components it was
 * already editing, and these strings lived somewhere it was not. Sweep by the
 * LITERAL across the whole tree, not by the surfaces already in hand.
 *
 * BINDING: resolved through the toast this component actually raises, by
 * spying on `showToast` — not by searching the document for "deleted", which
 * several surfaces emit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { EdgeInspector } from '../EdgeInspector'

/**
 * ⚠ THE REAL STORE, DELIBERATELY. An earlier draft of this spec mocked
 * `../../store` wholesale — which is precisely the weakness a reviewer found in
 * the sibling toast pin, where a wholesale mock left the whole producer side of
 * the change unguarded. Only the toast surface is stubbed here, because the
 * assertion is about what THIS component hands to it.
 */
const showToast = vi.fn()
vi.mock('../../ToastContext', () => ({
  useShowToast: () => showToast,
  useToast: () => ({ showToast, removeToast: vi.fn(), toasts: [] }),
}))

function seedOneEdge() {
  useCanvasStore.setState({
    nodes: [
      { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'b', type: 'factor', position: { x: 200, y: 0 }, data: { label: 'B' } },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b', data: { weight: 0.5, belief: 0.5 } }],
    history: { past: [], future: [] },
  } as never)
}

describe('EdgeInspector delete notice names no keyboard shortcut', () => {
  beforeEach(() => {
    showToast.mockClear()
    useCanvasStore.getState().reset()
    seedOneEdge()
  })

  function deleteTheConnector() {
    render(<EdgeInspector edgeId="e1" onClose={vi.fn()} />)
    // Bound by testid, not by the visible text: "Delete" appears on several
    // controls across the inspector surfaces.
    fireEvent.click(screen.getByTestId('btn-edge-delete'))
    return showToast.mock.calls[0] ?? []
  }

  it('does not tell the user to press a key to undo', () => {
    const [message] = deleteTheConnector()

    expect(String(message)).not.toMatch(/⌘|ctrl|cmd|press .* to undo/i)
  })

  /**
   * PRECONDITION — without it the assertion above would also pass on a build
   * where the delete button never fired, or the toast never raised.
   */
  it('PRECONDITION: the delete fired and still announced what happened', () => {
    const [message] = deleteTheConnector()

    expect(useCanvasStore.getState().edges.find((e) => e.id === 'e1')).toBeUndefined()
    expect(String(message)).toMatch(/connector deleted/i)
  })
})
