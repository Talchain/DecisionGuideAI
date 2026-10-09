/**
 * Accel P24 / SCI-10, the consumer chain end to end: a served wire turn carrying `_method_result` at its root (as CEE
 * emits it beside `_action`) → `parseV5Response` (an undeclared root key rides `__additive__`) → `routeV5Response` →
 * `readMethodResult` → the message → the card under the reply in the chat thread, link ends named from the canvas.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({
  supabase: {},
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

import { parseV5Response } from '../../../v5/responseParser'
import { routeV5Response } from '../../../v5/responseRouter'
import { readMethodResult, type MethodResultV1 } from '../../../v5/readMethodResult'
import { useCanvasStore } from '../../store'
import { ChatThread } from '../zones/ChatThread'
import { METHOD_RESULT_CARD_TESTID, testedLinkHeading } from '../MethodResultCard'
import type { ConversationMessage } from '../types'
import served from './fixtures/chat-served-turns.bf-20260927.json'
import testLink from './fixtures/method-result-v1-test-link.json'

type Wire = Record<string, unknown>
const original = useCanvasStore.getState()
afterEach(() => { cleanup(); useCanvasStore.setState(original, true) })

/** A served turn, carrying the probe's reply and its sidecar at the ROOT, exactly where CEE puts it. */
function servedProbeTurn(): Wire {
  const body = JSON.parse(JSON.stringify((served as Array<{ body: Wire }>)[3]!.body)) as Wire
  body.assistant_text = testLink.assistant_text
  delete body._answer_shape
  body._method_result = JSON.parse(JSON.stringify(testLink.response.__additive__._method_result))
  return body
}

async function readThroughTheParser(body: Wire): Promise<ReturnType<typeof readMethodResult>> {
  const res = new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const target = routeV5Response(await parseV5Response(res))
  if (target.kind !== 'blocks' && target.kind !== 'text_only') throw new Error(target.kind)
  return readMethodResult(target.response)
}

function thread(messages: ConversationMessage[]) {
  return render(
    <ChatThread
      {...({
        messages, isThinking: false, longRunningHint: null, nodeCount: 12, patchBlockStates: new Map(), patchRejections: new Map(),
        onChipClick: vi.fn(async () => {}), onPatchAccept: () => {}, onPatchDismiss: () => {}, onFeedback: () => {}, onRetry: () => {}, compact: true,
      } as unknown as React.ComponentProps<typeof ChatThread>)}
    />,
  )
}

const reply = (methodResult: MethodResultV1 | undefined, content = testLink.assistant_text): ConversationMessage => ({
  id: 'probe-1', role: 'assistant', content, timestamp: new Date('2026-10-07T21:04:00.000Z'), ...(methodResult ? { methodResult } : {}),
})

describe('a probe reply carries its card from the wire to the thread', () => {
  it('the parser keeps the root sidecar and the reader reads it (control: the same turn without it reads absent)', async () => {
    const withIt = await readThroughTheParser(servedProbeTurn())
    expect(withIt.status).toBe('available')
    const without = servedProbeTurn()
    delete without._method_result
    expect(await readThroughTheParser(without)).toEqual({ status: 'unavailable', reason: 'absent' })
  })

  it('the card sits under the reply, its link named from the canvas; a reply that does not say the rows shows none', async () => {
    const read = await readThroughTheParser(servedProbeTurn())
    if (read.status !== 'available') throw new Error('unreadable')
    useCanvasStore.setState({
      nodes: [
        { id: 'fac_price_rise', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price rise' } },
        { id: 'out_customers_lost', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Customers lost from price rise' } },
      ] as never,
    })
    thread([reply(read.methodResult)])
    const card = screen.getByTestId(METHOD_RESULT_CARD_TESTID)
    expect(within(card).getByTestId(`${METHOD_RESULT_CARD_TESTID}-heading`)).toHaveTextContent(testedLinkHeading('Price rise', 'Customers lost from price rise'))
    expect(within(card).getAllByRole('listitem')).toHaveLength(read.methodResult.rows.length)
    cleanup()
    // Control: the same sidecar under a reply that says something else — no card.
    thread([reply(read.methodResult, 'A different reply.')])
    expect(screen.queryByTestId(METHOD_RESULT_CARD_TESTID)).toBeNull()
    cleanup()
    // Control: no sidecar — no card.
    thread([reply(undefined)])
    expect(screen.queryByTestId(METHOD_RESULT_CARD_TESTID)).toBeNull()
  })
})
