/** The option inspector's in/out control (#2890): what it sends, and the older edit note it clears (Codex R2). */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const sendSystemEvent = vi.fn(() => new Promise(() => {}))
vi.mock('../../../../../lib/supabase', () => ({ getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })), supabase: {} }))
vi.mock('../../../../conversation/ConversationContext', () => ({ useOptionalConversationContext: () => ({ sendSystemEvent }) }))

import { OptionStatusControl, OPTION_STATUS_COPY } from '../OptionStatusControl'
import { useCanvasStore } from '../../../../store'
import { useEditNoteStore } from '../../../../editNotes/editNoteStore'

describe('OptionStatusControl', () => {
  it('⭐ takes a compared option out with the status last read; an older note is cleared at the press, whatever the reply', () => {
    useCanvasStore.setState({ lastServerGraphHash: 'f3d31f75957c5cb5' } as never)
    useEditNoteStore.setState({ note: { check: 'S1', elementId: 'ab' } } as never)
    render(<OptionStatusControl optionId="push" data={{ label: 'Push' }} />)
    fireEvent.click(screen.getByText(OPTION_STATUS_COPY.takeOut))
    expect(sendSystemEvent).toHaveBeenCalledWith({ type: 'option_status_edit', payload: { option_node_id: 'push', expected_status: 'feasible', status: 'removed', base_graph_hash: 'f3d31f75957c5cb5' } }, { deferIfBusy: false })
    expect(useEditNoteStore.getState().note).toBeNull()
  })

  it('a taken-out option offers to put it back; with no saved hash there is no control', () => {
    useCanvasStore.setState({ lastServerGraphHash: 'f3d31f75957c5cb5' } as never)
    const { unmount } = render(<OptionStatusControl optionId="push" data={{ option_status: 'removed' }} />)
    expect(screen.getByText(OPTION_STATUS_COPY.putBack)).toBeTruthy()
    unmount()
    useCanvasStore.setState({ lastServerGraphHash: null } as never)
    const { container } = render(<OptionStatusControl optionId="push" data={{}} />)
    expect(container.innerHTML).toBe('')
  })
})
