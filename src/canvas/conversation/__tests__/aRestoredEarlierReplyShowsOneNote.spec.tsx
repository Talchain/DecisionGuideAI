/**
 * ⭐ THE RESTORED CHAT SAYS "EARLIER" ONCE (AIQ 5925678816, Panel 5925667290, 1 Oct 2026).
 *
 * Paul's step-5 reload on R3's `4644486f` (UI `e66b8c27`): "These replies came before the current analysis; their figures
 * may not match it." sat under 8 restored replies. AIQ: one note after the last earlier reply, and a two-word tag on each
 * earlier figure reply, so an old figure read on its own is still marked. The builder rows are in
 * `serverConversationTurns.spec.ts`; these rows bind what the reader SEES: the tag on the bubble, and the one note
 * closing the last earlier reply (in `content`, so it survives the saved transcript: Canvas 5925780066).
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import { RESTORED_EARLIER_TAG, RESTORED_STALE_FIGURES_NOTE } from '../serverConversationTurns'
import type { ConversationMessage } from '../types'

const reply = (over: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: 'restored-assistant-t1', role: 'assistant', content: 'The £57 option reaches the target in about 24.7% of model runs.',
  timestamp: new Date(), ...over,
})
const noop = async () => {}

afterEach(cleanup)

describe('⭐ an earlier reply is tagged, and the note is said once', () => {
  it('an earlier figure reply shows the tag, and its own words are unchanged', () => {
    render(<MessageBubble message={reply({ restoredTag: RESTORED_EARLIER_TAG })} onChipClick={noop} />)
    expect(screen.getByTestId('message-restored-tag')).toHaveTextContent('Earlier analysis')
    expect(screen.getByTestId('message-body-text')).toHaveTextContent('about 24.7% of model runs.')
    expect(screen.getByTestId('message-assistant')).not.toHaveTextContent(RESTORED_STALE_FIGURES_NOTE)
  })

  it('CONTROL: a reply without the tag shows none', () => {
    render(<MessageBubble message={reply()} onChipClick={noop} />)
    expect(screen.queryByTestId('message-restored-tag')).toBeNull()
  })

  it('the last earlier reply closes with the one note, in its own words (AIQ 5925678816)', () => {
    render(<MessageBubble message={reply({ restoredTag: RESTORED_EARLIER_TAG, content: `Earlier words.\n\n${RESTORED_STALE_FIGURES_NOTE}` })} onChipClick={noop} />)
    expect(screen.getByTestId('message-body-text')).toHaveTextContent(RESTORED_STALE_FIGURES_NOTE)
    expect(RESTORED_STALE_FIGURES_NOTE).toBe('The replies above came before the current analysis, so their figures may not match it.')
  })
})
