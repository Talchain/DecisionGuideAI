/**
 * RETURNING USER — the first-use placeholder must not be shown to someone who
 * has been here before.
 *
 * THE USER-VISIBLE FAILURE THIS PINS (live on staging, build `27d002c9`,
 * reproduced 2/2 by driving the deployed product 25 Jul 2026):
 * you write a brief, the product drafts a 19-node model and coaches you on it,
 * you close the tab, you come back. The model returns in full — and the chat
 * shows `data-testid="olumi-tab-empty"` carrying
 * "Describe your decision, goal, options, and any assumptions, risks or
 * constraints you're aware of." That element is a factual claim that the user
 * has never been here, and it is false.
 *
 * Root cause: the panel's only restore path was gated behind
 * `VITE_FEATURE_THREAD_HYDRATE` (absent from the deployed env → `false`) and
 * read `scenarios.thread`, a column that does not exist on the live database.
 * Nothing else read the transcript back, so `messages` stayed `[]`.
 *
 * CLAIM TYPE — read this before citing the test: jsdom renders a DOM, not a
 * layout. Every assertion here is about ELEMENT PRESENCE AND TEXT CONTENT in
 * the rendered tree. It does NOT prove anything is visible on screen; the
 * on-screen proof is the live staging before/after in
 * `parallel-briefs/RETURNING-USER-2026-07-25.md`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OlumiTabBody } from '../OlumiTabBody'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useCanvasStore } from '../../store'
import { saveTranscript, TRANSCRIPT_STORAGE_KEY } from '../../conversation/utils/transcriptStore'
import type { ConversationMessage } from '../../conversation/types'

// The panel must never dispatch a turn in this test — we are only exercising
// mount-time restore. Both transports are stubbed to hang.
vi.mock('../../conversation/turnService', () => ({
  callOrchestratorTurn: () => new Promise(() => {}),
  streamOrchestratorTurn: async function* () { /* never yields */ },
  OrchestratorError: class extends Error {},
}))
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: () => new Promise(() => {}),
  getV5Endpoint: () => 'https://example.invalid/v5/turn',
}))

const SID = '561548c3-acd6-4488-b088-399c7cc15631'

const BRIEF =
  'We run a 12-person specialty coffee roastery in Bristol. I have around 80k I could invest.'
const REPLY = 'I have built a first decision model for "Maximise Net Profit in 2 Years".'

function priorSession(): ConversationMessage[] {
  return [
    { id: 'u1', role: 'user', content: BRIEF, timestamp: new Date('2026-07-25T17:38:01Z') },
    { id: 'a1', role: 'assistant', content: REPLY, timestamp: new Date('2026-07-25T17:39:10Z') },
  ]
}

/**
 * Write a transcript and then re-stamp it as belonging to an EARLIER page
 * load — which is what "the user closed the tab and came back" actually is.
 * A transcript the current page load wrote is deliberately NOT restored.
 */
function storePriorSession(messages: ConversationMessage[]) {
  saveTranscript(SID, messages)
  const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
  file[SID].pageLoadId = 'an-earlier-page-load'
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}

function renderPanel() {
  return render(
    <ConversationProvider>
      <OlumiTabBody />
    </ConversationProvider>,
  )
}

describe('returning user — the chat pane after a reload', () => {
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({ currentScenarioId: null })
    // jsdom does not implement scrollIntoView; ConversationPanel's smart-scroll
    // calls it on mount. Stubbing it is a jsdom gap, not a product behaviour.
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {}
    }
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
  })

  it('shows the first-use placeholder when the user really HAS never been here', async () => {
    useCanvasStore.setState({ currentScenarioId: SID })
    renderPanel()
    await waitFor(() => {
      expect(screen.getByTestId('olumi-tab-empty')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Describe your decision, goal, options/i),
    ).toBeInTheDocument()
  })

  it('does NOT show the first-use placeholder when a prior session is stored', async () => {
    storePriorSession(priorSession())
    useCanvasStore.setState({ currentScenarioId: SID })

    renderPanel()

    await waitFor(() => {
      expect(screen.queryByTestId('olumi-tab-empty')).not.toBeInTheDocument()
    })
    expect(
      screen.queryByText(/Describe your decision, goal, options/i),
    ).not.toBeInTheDocument()
  })

  it("restores the user's OWN WORDS and the reply, not a summary of them", async () => {
    storePriorSession(priorSession())
    useCanvasStore.setState({ currentScenarioId: SID })

    const { container } = renderPanel()

    // The bubble renderer wraps numerals in their own spans, so the sentence is
    // split across elements — assert on the bubble's textContent, which is what
    // a reader actually reads.
    await waitFor(() => {
      expect(container.querySelector('[data-testid="message-user"]')).not.toBeNull()
    })
    const userBubble = container.querySelector('[data-testid="message-user"]')!
    expect(userBubble.textContent).toContain('12-person specialty coffee roastery in Bristol')
    expect(userBubble.textContent).toContain('80k I could invest')

    const assistantBubble = container.querySelector('[data-testid="message-assistant"]')!
    expect(assistantBubble.textContent).toContain('Maximise Net Profit in 2 Years')
  })

  it('marks the session boundary so the restored turns read as history', async () => {
    storePriorSession(priorSession())
    useCanvasStore.setState({ currentScenarioId: SID })

    renderPanel()

    await waitFor(() => {
      expect(screen.getByText(/Session resumed/i)).toBeInTheDocument()
    })
  })

  it('SAYS SO on screen when part of the history could not be restored', async () => {
    // 130 turns against a cap of 120 → 10 dropped, and the user must be told.
    const many: ConversationMessage[] = Array.from({ length: 130 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn number ${i}`,
      timestamp: new Date('2026-07-25T17:38:01Z'),
    }))
    storePriorSession(many)
    useCanvasStore.setState({ currentScenarioId: SID })

    renderPanel()

    await waitFor(() => {
      expect(
        screen.getByText(/The earliest 10 messages from this decision could not be restored/i),
      ).toBeInTheDocument()
    })
    // And the placeholder is still not shown — a partial history is history.
    expect(screen.queryByTestId('olumi-tab-empty')).not.toBeInTheDocument()
  })
})

describe('returning repeatedly does not stack session dividers', () => {
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({ currentScenarioId: null })
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {}
    }
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
  })

  it('shows ONE boundary no matter how many times the decision is reopened', async () => {
    // A history that already ends with a divider — i.e. the user came back,
    // said nothing, and is coming back again.
    storePriorSession([
      ...priorSession(),
      {
        id: 'd-old',
        role: 'assistant',
        content: '',
        timestamp: new Date('2026-07-25T21:32:00Z'),
        synthetic: true,
        sessionDivider: 'Session resumed - 25 Jul, 21:32',
      },
    ])
    useCanvasStore.setState({ currentScenarioId: SID })

    const { container } = renderPanel()

    await waitFor(() => {
      expect(container.querySelector('[data-testid="message-user"]')).not.toBeNull()
    })
    const dividers = container.querySelectorAll('[data-testid="session-divider"]')
    expect(dividers).toHaveLength(1)
    // And the real turns are still there — collapsing must not eat history.
    expect(container.querySelectorAll('[data-testid="message-user"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-testid="message-assistant"]')).toHaveLength(1)
  })
})
