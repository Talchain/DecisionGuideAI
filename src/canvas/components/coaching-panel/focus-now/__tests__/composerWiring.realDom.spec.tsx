/**
 * Real-DOM proof of the composer binding the staging bug lived in.
 *
 * The visible aiPanelV2 composer is AIInputBar, whose textarea is bound directly to
 * ConversationContext `draft`. A Focus action (useFocusNow.onPrefill) writes that
 * draft via `setDraft(mergeComposerDraft(draft, text))`. The placement spec stubs
 * the context; THIS spec uses the REAL ConversationProvider + REAL AIInputBar to
 * prove the click actually reaches the textarea — the kind of real-DOM wiring a
 * mocked-hook test cannot prove. Only the heavyweight conversation runtime is
 * stubbed (the established aiPanelV2 test pattern); the provider still supplies the
 * real draft/setDraft.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  ConversationProvider,
  useOptionalConversationContext,
} from '@/canvas/conversation/ConversationContext'
import { AIInputBar } from '@/canvas/components/AIInputBar'
import { mergeComposerDraft } from '../composerDraft'

vi.mock('@/canvas/conversation/useConversation', () => ({
  useConversation: () => ({
    messages: [],
    sendMessage: vi.fn(),
    isThinking: false,
    cancelTurn: vi.fn(),
  }),
}))

const PROMPT = 'Help me think through a risk worth adding to this decision.'

/**
 * Mirrors the CORE of useFocusNow.onPrefill: merge the prompt into the LIVE
 * conversation draft. (The reveal/forceActivate is covered elsewhere; this isolates
 * the composer-binding contract.)
 */
function PrefillProbe({ text }: { text: string }) {
  const convo = useOptionalConversationContext()
  return (
    <button type="button" onClick={() => convo?.setDraft(mergeComposerDraft(convo.draft, text))}>
      prefill
    </button>
  )
}

function renderHarness() {
  return render(
    <ConversationProvider>
      <AIInputBar variant="strip" testId="probe-bar" />
      <PrefillProbe text={PROMPT} />
    </ConversationProvider>,
  )
}

describe('Focus prefill → real AIInputBar composer', () => {
  it('writing the conversation draft shows the prompt in the real AIInputBar textarea', () => {
    renderHarness()
    const textarea = screen.getByTestId('probe-bar-textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
    fireEvent.click(screen.getByText('prefill'))
    expect(textarea.value).toBe(PROMPT)
  })

  it('appends to an unsent draft the user already typed, never clobbering it', () => {
    renderHarness()
    const textarea = screen.getByTestId('probe-bar-textarea') as HTMLTextAreaElement
    // user types an unsent message directly into the composer
    fireEvent.change(textarea, { target: { value: 'I am leaning towards option A' } })
    expect(textarea.value).toBe('I am leaning towards option A')
    fireEvent.click(screen.getByText('prefill'))
    expect(textarea.value).toBe(`I am leaning towards option A\n\n${PROMPT}`)
  })
})
