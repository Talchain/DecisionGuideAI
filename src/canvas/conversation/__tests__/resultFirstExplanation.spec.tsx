/**
 * Result-first, two requests (AI HARNESS 5931099857; CEE #2470), the UI half: the reader, the transcript, the stage.
 * The auto-send itself (live only, once per run_key, hidden, foreign dropped) is pinned in `useConversation.hook.spec.ts`.
 */
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { readNarration, isForeignExplanation, namesALatestRun, explainRunChipId } from '../narrationTurn'
import { saveTranscript, loadTranscript } from '../utils/transcriptStore'
import { ChatThread } from '../zones/ChatThread'
import { WAITING_LINES } from '../zones/ThinkingDots'
import type { ConversationMessage } from '../types'

const savedScroll = Element.prototype.scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = function () {}
})
afterAll(() => {
  Element.prototype.scrollIntoView = savedScroll
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('readNarration: the contract, and nothing looser', () => {
  it('reads top level, then the additive sidecar', () => {
    expect(readNarration({ narration: { status: 'pending', run_key: 'rk' } })).toEqual({ status: 'pending', runKey: 'rk' })
    expect(readNarration({ __additive__: { narration: { status: 'ready', run_key: 'rk' } } })).toEqual({ status: 'ready', runKey: 'rk' })
  })

  it('⛔ an unknown status, a blank key or a non-object is not a narration', () => {
    expect(readNarration({ narration: { status: 'done', run_key: 'rk' } })).toBeNull()
    expect(readNarration({ narration: { status: 'pending', run_key: ' ' } })).toBeNull()
    expect(readNarration({ narration: 'pending' })).toBeNull()
    expect(readNarration(null)).toBeNull()
  })

  it('request 1 names the latest Run; only a READY explanation can be foreign', () => {
    expect(namesALatestRun({ status: 'pending', runKey: 'a' })).toBe(true)
    expect(namesALatestRun({ status: 'ready', runKey: 'a' })).toBe(false)
    expect(isForeignExplanation({ status: 'ready', runKey: 'old' }, 'new')).toBe(true)
    expect(isForeignExplanation({ status: 'ready', runKey: 'new' }, 'new')).toBe(false)
    expect(isForeignExplanation({ status: 'stale', runKey: 'old' }, 'new')).toBe(false)
    expect(explainRunChipId('rk')).toBe('agent-explain-run:rk')
  })
})

describe('load 2 keeps the narration identity (the #2388 two-load lesson)', () => {
  it('the Run line and its ONE explanation come back with their run_key', () => {
    const t = new Date()
    const msgs: ConversationMessage[] = [
      { id: 'u1', role: 'user', content: 'Run the analysis', timestamp: t },
      { id: 'a1', role: 'assistant', content: 'Run complete.', narration: { status: 'pending', runKey: 'rk_1' }, timestamp: t },
      { id: 'a2', role: 'assistant', content: 'Here is what drives it.', narration: { status: 'ready', runKey: 'rk_1' }, timestamp: t },
    ]
    saveTranscript('scn-rf', msgs)
    const loaded = loadTranscript('scn-rf')
    const byId = Object.fromEntries((loaded?.messages ?? []).map((m) => [m.id, m]))
    expect(byId.a1?.narration).toEqual({ status: 'pending', runKey: 'rk_1' })
    expect(byId.a2?.narration).toEqual({ status: 'ready', runKey: 'rk_1' })
    expect((loaded?.messages ?? []).filter((m) => m.narration?.status === 'ready')).toHaveLength(1)
  })
})

describe('the real stage while request 2 runs', () => {
  const draw = (explainingRun: boolean) =>
    render(
      <ChatThread
        messages={[
          { id: 'u1', role: 'user', content: 'Run it', timestamp: new Date() },
          { id: 'a1', role: 'assistant', content: 'Run complete.', timestamp: new Date() },
        ]}
        isThinking={true}
        longRunningHint={null}
        nodeCount={4}
        explainingRun={explainingRun}
        patchBlockStates={new Map()}
        patchRejections={new Map()}
        onChipClick={async () => {}}
        onPatchAccept={() => {}}
        onPatchDismiss={() => {}}
        onFeedback={() => {}}
        onRetry={() => {}}
      />,
    )

  it('"Preparing explanation…" with the coach\'s preparing_explanation line', () => {
    draw(true)
    expect(screen.getByTestId('thinking-label')).toHaveTextContent('Preparing explanation…')
    const line = screen.getByTestId('thinking-coaching-line')
    expect(line).toHaveAttribute('data-phase', 'preparing_explanation')
    expect(line.textContent).toBe(WAITING_LINES.preparing_explanation[0])
  })

  it('CONTRAST: an ordinary turn on an existing model shows no explanation stage and no guessed line', () => {
    draw(false)
    expect(screen.queryByText('Preparing explanation…')).toBeNull()
    expect(screen.queryByTestId('thinking-coaching-line')).toBeNull()
  })
})
