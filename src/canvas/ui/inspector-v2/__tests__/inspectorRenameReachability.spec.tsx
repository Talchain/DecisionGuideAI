/**
 * THE RENAME AFFORDANCE IS REACHABLE, AND IT IS THE ONE THAT ALREADY EXISTED.
 *
 * ⭐⭐ WHAT WAS ACTUALLY WRONG, because it is not what it looks like. The brief
 * for this lane said an existing rename control "may look live and do nothing"
 * because `InspectorRouter` wraps every panel in an unconditional
 * `<fieldset disabled>`. Measured here rather than inherited: **that is not the
 * mechanism.** `EditableLabel` lives in the InspectorShell HEADER, which is
 * OUTSIDE both fieldsets (`InspectorRouter.tsx:221` wraps `EdgePanel`, `:334`
 * wraps `PanelComponent` — the shell's children, never its header). The title
 * was inert for a different and simpler reason: `InspectorRouter` passed no
 * `onLabelChange`, and `EditableLabel:124` returns a bare `<span>` when `onSave`
 * is absent. So it did not look live and do nothing — it rendered as static text
 * and offered no affordance at all, which is why nobody reported it.
 *
 * That distinction is load-bearing for this spec: the test that proves the fix
 * must assert the TRIGGER RENDERS, not that a disabled attribute lifted. A spec
 * written against the fieldset premise would have passed before and after.
 *
 * ⭐ AND THE AFFORDANCE IS NOT NEW. `requestNodeRename` → `useRenameIntentStore`
 * → `InspectorShell:64` `autoEditLabel` → `EditableLabel` `autoEdit` is a
 * COMPLETE canvas-double-click-to-rename path that was already built and already
 * tested (`inspectorCompletion.rename.spec.tsx`), and it terminated in a
 * component that could never open its editor. This lane supplies the missing
 * `onSave`; it invents no gesture.
 *
 * ⚠ THE READ-ONLY NOTICE IS PART OF THE CLAIM. Wiring a durable rename under a
 * notice reading "these changes cannot yet be saved to the shared model" would
 * ship a contradiction — the estate's trap 21, two authorities answering
 * different questions. The notice now scopes itself to the panel BODY, which is
 * still genuinely unsavable, and the assertions below pin BOTH halves so neither
 * can drift without a red.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { InspectorRouter } from '../InspectorRouter'
import { INSPECTOR_READ_ONLY_REASON } from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'

const NODE_ID = 'fac_monthly_eng_cost'
const SIBLING_ID = 'fac_sibling'
/** Two nodes, ONE label — so a value predicate cannot bind, only an id can. */
const SHARED_LABEL = 'Monthly eng cost'

function seedCanvas() {
  useCanvasStore.setState({
    nodes: [
      {
        id: NODE_ID,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: SHARED_LABEL, kind: 'factor', category: 'external' },
      },
      {
        id: SIBLING_ID,
        type: 'factor',
        position: { x: 200, y: 0 },
        data: { label: SHARED_LABEL, kind: 'factor', category: 'external' },
      },
    ] as never,
    edges: [] as never,
  })
}

describe('the inspector rename affordance is reachable', () => {
  beforeEach(() => {
    seedCanvas()
    vi.restoreAllMocks()
  })

  it('renders the rename TRIGGER for a node — the affordance exists on screen', () => {
    render(<InspectorRouter nodeId={NODE_ID} edgeId={null} onClose={vi.fn()} />)
    expect(screen.getByTestId('inspector-rename-trigger')).toBeInTheDocument()
  })

  it('the trigger opens a real input the user can type into', async () => {
    const user = userEvent.setup()
    render(<InspectorRouter nodeId={NODE_ID} edgeId={null} onClose={vi.fn()} />)
    await user.click(screen.getByTestId('inspector-rename-trigger'))
    const input = await screen.findByTestId('inspector-rename-input')
    expect(input).toBeInTheDocument()
    expect(input).not.toBeDisabled()
  })

  it('a committed rename writes THE NAMED NODE, bound by id — its same-labelled sibling is untouched', async () => {
    const user = userEvent.setup()
    render(<InspectorRouter nodeId={NODE_ID} edgeId={null} onClose={vi.fn()} />)
    await user.click(screen.getByTestId('inspector-rename-trigger'))
    const input = await screen.findByTestId('inspector-rename-input')
    await user.clear(input)
    await user.type(input, 'Monthly engineering spend{Enter}')

    const nodes = useCanvasStore.getState().nodes
    const target = nodes.find((n) => n.id === NODE_ID)
    const sibling = nodes.find((n) => n.id === SIBLING_ID)
    // BY IDENTITY. Both nodes started on the same label, so an assertion that
    // merely found "the node labelled X" would have been satisfied by either.
    expect((target?.data as { label?: string } | undefined)?.label).toBe(
      'Monthly engineering spend',
    )
    expect((sibling?.data as { label?: string } | undefined)?.label).toBe(SHARED_LABEL)
  })

  it('TWIN — the panel BODY is still inert: the authority fieldset survives', () => {
    const { container } = render(<InspectorRouter nodeId={NODE_ID} edgeId={null} onClose={vi.fn()} />)
    const fieldset = container.querySelector('fieldset[data-authority="disabled"]')
    expect(fieldset).not.toBeNull()
    expect(fieldset).toHaveAttribute('disabled')
    // And the rename trigger is NOT inside it — which is the structural fact
    // that makes one control savable while the body is not.
    expect(fieldset?.contains(screen.getByTestId('inspector-rename-trigger'))).toBe(false)
  })

  it('TWIN — the read-only notice no longer claims the NAME cannot be saved', () => {
    render(<InspectorRouter nodeId={NODE_ID} edgeId={null} onClose={vi.fn()} />)
    expect(screen.getByTestId('inspector-authority-notice')).toBeInTheDocument()
    // The copy must not make a blanket claim over a control that now saves.
    expect(INSPECTOR_READ_ONLY_REASON).not.toMatch(/^This inspector is read-only\b/)
    expect(INSPECTOR_READ_ONLY_REASON.toLowerCase()).toContain('name')
  })
})
