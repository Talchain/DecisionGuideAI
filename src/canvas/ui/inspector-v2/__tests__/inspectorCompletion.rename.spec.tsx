/**
 * Inspector completion — L-04 (node title editing very difficult).
 *
 * RED-first. Three separate defects, three separate pins:
 *
 * 1. NO VISIBLE AFFORDANCE. The rename control was a bare `<button>` carrying
 *    only `cursor-text` — nothing on screen said "you can rename this".
 *
 * 2. THE DRAG HANDLE SWALLOWED IT. The control sits inside the panel header,
 *    which is the drag surface; a pointerdown on the label started a panel drag.
 *
 * 3. SILENT TRUNCATION. The input allowed 500 characters; the store setter
 *    sliced to 100 and told nobody. One honest limit — the store's — surfaced
 *    to the user.
 *
 * Plus the EXPORTED ENTRY the workspace lane consumes: `requestNodeRename(id)`
 * mounts the label in editing state so a canvas double-click lands the user in
 * the field.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { EditableLabel } from '../shared/EditableLabel'
import { InspectorShell } from '../InspectorShell'
import {
  requestNodeRename,
  clearNodeRename,
  useRenameIntentStore,
} from '../renameIntent'
import { NODE_LABEL_MAX_LENGTH } from '../useInspectorMutations'

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const shellProps = {
  topBarColor: 'var(--option)',
  nodeKind: 'option' as const,
  nodeId: 'optA',
  typePill: 'Option',
  techMode: false,
  onTechToggleChange: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  clearNodeRename()
})

// ─────────────────────────────────────────────────────────────────────
// 1 · A real, visible affordance
// ─────────────────────────────────────────────────────────────────────

describe('L-04 · the rename control is a visible affordance', () => {
  it('exposes an identified rename trigger with an accessible name', () => {
    render(<EditableLabel value="Team productivity" onSave={vi.fn()} />)
    const trigger = screen.getByTestId('inspector-rename-trigger')
    expect(trigger.getAttribute('aria-label')).toMatch(/rename/i)
    expect(trigger.getAttribute('title')).toMatch(/rename/i)
  })

  it('renders a visible edit cue alongside the text, not a bare button', () => {
    render(<EditableLabel value="Team productivity" onSave={vi.fn()} />)
    expect(screen.getByTestId('inspector-rename-cue')).toBeTruthy()
  })

  it('renders no trigger at all in read-only mode (no onSave)', () => {
    render(<EditableLabel value="Team productivity" />)
    expect(screen.queryByTestId('inspector-rename-trigger')).toBeNull()
    expect(screen.queryByTestId('inspector-rename-cue')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
// 2 · The header drag handler must not swallow the rename press
// ─────────────────────────────────────────────────────────────────────

describe('L-04 · the panel drag handle does not swallow the rename control', () => {
  function renderShell() {
    const onPointerDown = vi.fn()
    const dragHandlers = {
      onPointerDown,
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
      onPointerCancel: vi.fn(),
      isDragging: false,
    }
    render(
      <InspectorShell {...shellProps} label="Team productivity" onLabelChange={vi.fn()} dragHandlers={dragHandlers}>
        <div>body</div>
      </InspectorShell>,
    )
    return { onPointerDown }
  }

  it('does not start a panel drag when the press lands on the rename trigger', () => {
    const { onPointerDown } = renderShell()
    fireEvent.pointerDown(screen.getByTestId('inspector-rename-trigger'), { bubbles: true })
    expect(onPointerDown).not.toHaveBeenCalled()
  })

  it('STILL starts a panel drag when the press lands on the header elsewhere', () => {
    // Discriminating twin: proves the fix is scoped to the rename control and
    // has not simply disabled dragging.
    const { onPointerDown } = renderShell()
    fireEvent.pointerDown(screen.getByText('Option'), { bubbles: true })
    expect(onPointerDown).toHaveBeenCalledTimes(1)
  })

  it('enters editing state when the trigger is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('inspector-rename-trigger'))
    expect(screen.getByTestId('inspector-rename-input')).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────
// 3 · One honest limit — the store's — surfaced, never silently applied
// ─────────────────────────────────────────────────────────────────────

describe('L-04 · one honest length limit, surfaced', () => {
  it('the store setter exports its own limit as the single source of truth', () => {
    expect(NODE_LABEL_MAX_LENGTH).toBe(100)
  })

  it('the input enforces the STORE limit, not a larger UI one', () => {
    render(
      <InspectorShell {...shellProps} label="Team productivity" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    fireEvent.click(screen.getByTestId('inspector-rename-trigger'))
    const input = screen.getByTestId('inspector-rename-input') as HTMLInputElement
    expect(input.maxLength).toBe(NODE_LABEL_MAX_LENGTH)
  })

  it('surfaces remaining characters once the user approaches the limit', () => {
    const onSave = vi.fn()
    render(<EditableLabel value="short" onSave={onSave} />)
    fireEvent.click(screen.getByTestId('inspector-rename-trigger'))
    const input = screen.getByTestId('inspector-rename-input') as HTMLInputElement

    // Below the warning threshold: no counter (no permanent chrome).
    expect(screen.queryByTestId('inspector-rename-counter')).toBeNull()

    fireEvent.change(input, { target: { value: 'x'.repeat(NODE_LABEL_MAX_LENGTH - 5) } })
    const counter = screen.getByTestId('inspector-rename-counter')
    expect(counter.textContent).toContain(String(NODE_LABEL_MAX_LENGTH))
  })

  it('saves what the user can see — no silent slice on commit', () => {
    const onSave = vi.fn()
    render(<EditableLabel value="short" onSave={onSave} />)
    fireEvent.click(screen.getByTestId('inspector-rename-trigger'))
    const input = screen.getByTestId('inspector-rename-input') as HTMLInputElement
    const atLimit = 'y'.repeat(NODE_LABEL_MAX_LENGTH)
    fireEvent.change(input, { target: { value: atLimit } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith(atLimit)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 4 · The exported entry the workspace lane consumes
// ─────────────────────────────────────────────────────────────────────

describe('L-04 · requestNodeRename mounts the label in editing state', () => {
  it('records the intent against the requested node id', () => {
    requestNodeRename('optA')
    expect(useRenameIntentStore.getState().renameNodeId).toBe('optA')
  })

  it('mounts the shell label in editing state for the REQUESTED node', () => {
    requestNodeRename('optA')
    render(
      <InspectorShell {...shellProps} nodeId="optA" label="Team productivity" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    expect(screen.getByTestId('inspector-rename-input')).toBeTruthy()
  })

  it('does NOT mount another node in editing state', () => {
    // Discriminating twin: the intent is bound to an id, not a global "edit now".
    requestNodeRename('someOtherNode')
    render(
      <InspectorShell {...shellProps} nodeId="optA" label="Team productivity" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    expect(screen.queryByTestId('inspector-rename-input')).toBeNull()
    expect(screen.getByTestId('inspector-rename-trigger')).toBeTruthy()
  })

  it('consumes the intent so a later re-render does not reopen the editor', () => {
    requestNodeRename('optA')
    const { unmount } = render(
      <InspectorShell {...shellProps} nodeId="optA" label="Team productivity" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    expect(useRenameIntentStore.getState().renameNodeId).toBeNull()
    unmount()

    render(
      <InspectorShell {...shellProps} nodeId="optA" label="Team productivity" onLabelChange={vi.fn()}>
        <div>body</div>
      </InspectorShell>,
    )
    expect(screen.queryByTestId('inspector-rename-input')).toBeNull()
  })
})
