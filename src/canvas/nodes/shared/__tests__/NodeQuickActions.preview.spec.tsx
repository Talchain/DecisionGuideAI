import { createRef } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Tooltip from '../../../../components/Tooltip'
import { usePopoverHover } from '../../../hooks/usePopoverHover'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useMenuItems } from '../../../contextMenu/useMenuItems'
import { isMenuItem } from '../../../contextMenu/types'
import { NodeQuickActions } from '../NodeQuickActions'

const option = { id: 'option-b', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Two developers' } }

function NodeWithPreview() {
  const { showPopover, nodeHandlers, nodeElRef } = usePopoverHover()
  return (
    <div ref={nodeElRef as React.Ref<HTMLDivElement>} {...nodeHandlers} data-testid="node">
      <span data-testid="body">Two developers</span>
      <NodeQuickActions nodeId={option.id} nodeType="option" label={option.data.label} alwaysVisible />
      {showPopover && <div data-testid="preview">What this option changes</div>}
    </div>
  )
}

const advance = async (time = 350) => { await act(async () => { vi.advanceTimersByTime(time) }) }

describe('node preview and action tooltip priority', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useCanvasStore.setState({ nodes: [
      { ...option, id: 'other-option' }, option,
    ] } as never)
    useGuidanceStore.setState({ _sendMessage: vi.fn(), _prefillChat: vi.fn() } as never)
  })
  afterEach(() => { vi.useRealTimers() })

  it('replaces an open preview with the action tooltip, then restores body hover', async () => {
    render(<NodeWithPreview />)
    fireEvent.mouseEnter(screen.getByTestId('node'))
    await advance()
    expect(screen.getByTestId('preview')).toBeInTheDocument()
    const action = screen.getByRole('button', { name: 'Challenge Two developers' })
    fireEvent.mouseEnter(action)
    await advance()
    expect(screen.queryByTestId('preview')).toBeNull()
    expect(screen.getByRole('tooltip')).toHaveTextContent('what could be wrong or missing?')
    expect(action).toHaveAttribute('title', '')
    fireEvent.mouseLeave(action, { relatedTarget: screen.getByTestId('body') })
    fireEvent.mouseEnter(screen.getByTestId('body'))
    await advance()
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.getByTestId('preview')).toBeInTheDocument()
  })

  it('cancels a pending preview when the pointer goes directly to an action', async () => {
    render(<NodeWithPreview />)
    fireEvent.mouseEnter(screen.getByTestId('node'))
    await advance(100)
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'More actions for Two developers' }))
    await advance(1000)
    expect(screen.queryByTestId('preview')).toBeNull()
    expect(screen.getAllByRole('tooltip')).toHaveLength(1)
  })

  it('discloses on keyboard focus and dismisses with Escape without firing an action', async () => {
    render(<NodeWithPreview />)
    fireEvent.mouseEnter(screen.getByTestId('node'))
    await advance()
    const action = screen.getByRole('button', { name: 'Challenge Two developers' })
    await act(async () => { action.focus() })
    expect(screen.queryByTestId('preview')).toBeNull()
    expect(action).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)
    fireEvent.keyDown(action, { key: 'Escape' })
    await advance()
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.queryByTestId('preview')).toBeNull()
    expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
    expect(useGuidanceStore.getState()._prefillChat).not.toHaveBeenCalled()
  })

  it('dismisses a body preview until the pointer leaves and returns', async () => {
    render(<NodeWithPreview />)
    const node = screen.getByTestId('node')
    fireEvent.mouseEnter(node)
    await advance()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.mouseOver(screen.getByTestId('body'))
    await advance()
    expect(screen.queryByTestId('preview')).toBeNull()
    fireEvent.mouseLeave(node)
    fireEvent.mouseEnter(node)
    await advance()
    expect(screen.getByTestId('preview')).toBeInTheDocument()
  })

  it('keeps details in the real menu, bound to the named option without AI', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useMenuItems({
      target: { kind: 'node', nodeId: option.id, nodeType: 'option', node: option, screenPos: { x: 0, y: 0 } },
      onClose, showToast: vi.fn(), screenToFlowPosition: p => p,
    }))
    const details = result.current.filter(isMenuItem).find(item => item.id === 'open-details')!
    expect(details.enabled).toBe(true)
    const opened = vi.fn()
    window.addEventListener('olumi:open-full-inspector', opened)
    act(() => { details.action() })
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([option.id])
    expect(opened).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
    expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
    window.removeEventListener('olumi:open-full-inspector', opened)
  })

  it('attaches the tooltip to the real control while preserving its ref and handlers', async () => {
    const ref = createRef<HTMLButtonElement>()
    const click = vi.fn()
    const focus = vi.fn()
    render(<div title="Outside your control"><Tooltip asChild content="Full explanation"><button ref={ref} onClick={click} onFocus={focus} aria-label="Explain">?</button></Tooltip></div>)
    const button = screen.getByRole('button', { name: 'Explain' })
    expect(ref.current).toBe(button)
    expect(button).toHaveAttribute('title', '')
    await act(async () => { button.focus() })
    expect(focus).toHaveBeenCalledOnce()
    expect(button).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)
    fireEvent.click(button)
    expect(click).toHaveBeenCalledOnce()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
