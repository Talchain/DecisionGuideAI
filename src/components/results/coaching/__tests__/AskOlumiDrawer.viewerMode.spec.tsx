/**
 * A colleague VIEWING a shared decision gets the drawer's context and "Focus on canvas", but no draft and no Send: the
 * conversation is the owner's and the viewer belt refuses a turn (#2449). The drawer says so in AIInputBar's own notice
 * (PANEL review 5951237026) rather than offering a Send that would fail.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

import { AskOlumiDrawer } from '../AskOlumiDrawer'
import { useAskOlumiStore, openAskOlumi } from '../askOlumiStore'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { setViewerScenario, VIEWER_COMPOSER_NOTICE, __resetViewerModeForTests } from '../../../../lib/viewerMode'

const payload = { context: 'Help me check this.', draft: 'Help me work through: Review risk', label: 'Review risk' }

beforeEach(() => {
  useAskOlumiStore.setState({ isOpen: false, context: '', draft: '', label: '', targetId: null })
  // A live conversation exists, so the ONLY reason not to offer Send is the viewer flag.
  useGuidanceStore.setState({ _dispatchAction: vi.fn(), _sendMessage: vi.fn() } as never)
})
afterEach(() => __resetViewerModeForTests())

describe('AskOlumiDrawer in viewer mode', () => {
  it('VIEWER: the notice replaces the draft and Send; the context stays', () => {
    act(() => setViewerScenario('11111111-1111-4111-8111-111111111111'))
    render(<AskOlumiDrawer />)
    act(() => openAskOlumi(payload))
    expect(screen.getByText(payload.context)).toBeInTheDocument()
    expect(screen.getByTestId('viewer-composer-notice')).toHaveTextContent(VIEWER_COMPOSER_NOTICE)
    expect(screen.queryByTestId('ask-olumi-draft')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
  })

  it('CONTRAST, not a viewer (same store): draft and an enabled Send, no notice', () => {
    render(<AskOlumiDrawer />)
    act(() => openAskOlumi(payload))
    expect(screen.getByTestId('ask-olumi-draft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    expect(screen.queryByTestId('viewer-composer-notice')).toBeNull()
  })
})
