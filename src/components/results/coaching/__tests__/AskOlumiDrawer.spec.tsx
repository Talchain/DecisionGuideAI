/**
 * Parity P1 — "Work through it with Olumi" drawer (prototype #olumiDrawer).
 *
 * The audit's dead-button fix: routed asks open this drawer with a
 * prefilled EDITABLE draft; Send dispatches a conversation-typed turn via
 * the guidance degrade chain; when no conversation callback is registered
 * the Send button is honestly disabled instead of silently no-oping.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { AskOlumiDrawer } from '../AskOlumiDrawer'
import { useAskOlumiStore, openAskOlumi } from '../askOlumiStore'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import {
  registerFocusHelpers,
  unregisterFocusHelpers,
} from '../../../../canvas/utils/focusHelpers'
import { useCanvasStore } from '../../../../canvas/store'

const payload = {
  context: 'Help me check whether this decision classification is right.',
  draft: 'Help me work through: Review risk',
  label: 'Review risk',
  parameters: { classification: 'risk' },
}

beforeEach(() => {
  useAskOlumiStore.setState({ isOpen: false, context: '', draft: '', label: '', targetId: null })
  useGuidanceStore.setState({ _dispatchAction: null, _sendMessage: null } as never)
  unregisterFocusHelpers()
})

describe('AskOlumiDrawer', () => {
  it('renders nothing until opened', () => {
    render(<AskOlumiDrawer />)
    expect(screen.queryByTestId('ask-olumi-drawer')).not.toBeInTheDocument()
  })

  it('opens with the context line and a prefilled editable draft', () => {
    render(<AskOlumiDrawer />)
    act(() => openAskOlumi(payload))
    expect(screen.getByTestId('ask-olumi-drawer')).toBeInTheDocument()
    expect(screen.getByText(payload.context)).toBeInTheDocument()
    const textarea = screen.getByTestId('ask-olumi-draft') as HTMLTextAreaElement
    expect(textarea.value).toBe(payload.draft)
    fireEvent.change(textarea, { target: { value: 'My own words' } })
    expect((screen.getByTestId('ask-olumi-draft') as HTMLTextAreaElement).value).toBe('My own words')
  })

  it('Send dispatches a conversation-typed turn with the EDITED draft, toasts, and closes', () => {
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatch } as never)
    render(<AskOlumiDrawer />)
    act(() => openAskOlumi(payload))
    fireEvent.change(screen.getByTestId('ask-olumi-draft'), { target: { value: 'Edited ask' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: 'discuss',
        message: 'Edited ask',
        label: 'Review risk',
        parameters: { classification: 'risk' },
        source: 'chip',
      }),
    )
    expect(screen.queryByTestId('ask-olumi-drawer')).not.toBeInTheDocument()
    expect(screen.getByTestId('ask-olumi-toast')).toHaveTextContent(
      'Sent to Olumi with the relevant model context',
    )
  })

  it('degrades to _sendMessage when dispatch is unavailable', () => {
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send } as never)
    render(<AskOlumiDrawer />)
    act(() => openAskOlumi(payload))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(send).toHaveBeenCalledWith(payload.draft)
  })

  it('with NO conversation callbacks Send is disabled with an honest hint — never a silent no-op', () => {
    render(<AskOlumiDrawer />)
    act(() => openAskOlumi(payload))
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByText(/conversation is not available/i)).toBeInTheDocument()
  })

  it('Escape closes the drawer', () => {
    render(<AskOlumiDrawer />)
    act(() => openAskOlumi(payload))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('ask-olumi-drawer')).not.toBeInTheDocument()
  })

  it('shows Focus on canvas only when a target is carried, and resolves it', () => {
    const focusNode = vi.fn()
    const focusEdge = vi.fn()
    registerFocusHelpers(focusNode, focusEdge)
    useCanvasStore.setState({
      nodes: [{ id: 'fac_1', type: 'factor', position: { x: 0, y: 0 }, data: {} } as any],
      edges: [],
    })
    render(<AskOlumiDrawer />)
    act(() => openAskOlumi({ ...payload, targetId: 'fac_1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Focus on canvas' }))
    expect(focusNode).toHaveBeenCalledWith('fac_1')
    expect(screen.getByTestId('ask-olumi-toast')).toHaveTextContent(
      'Focused the relevant model elements on the canvas',
    )
  })

  it('hides Focus on canvas when no target is carried', () => {
    render(<AskOlumiDrawer />)
    act(() => openAskOlumi(payload))
    expect(screen.queryByRole('button', { name: 'Focus on canvas' })).not.toBeInTheDocument()
  })

  // ── V7 L6 row 15: the drawer ALWAYS carries the model-limit caveat ──────
  it('always shows the model-limit caveat, even with no context line', () => {
    render(<AskOlumiDrawer />)
    act(() => openAskOlumi({ ...payload, context: '' }))
    const caveat = screen.getByTestId('ask-olumi-model-limit')
    expect(caveat).toBeInTheDocument()
    expect(caveat).toHaveTextContent(/not guarantee the real world/i)
  })
})
