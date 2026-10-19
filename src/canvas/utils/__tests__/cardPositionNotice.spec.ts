/**
 * A moved card is kept for this visit only, and the canvas says so once (DL-3 ruling (1), 19 Oct 2026; verifier,
 * staging fe4e4b9d: a drag sent no request and the card returned to the layout on reopen).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CARD_POSITION_NOTICE, noteCardMoved, resetCardPositionNoticeForTests } from '../cardPositionNotice'
import { CANVAS_TOAST_EVENT } from '../heldCanvasNotices'

const toasts: string[] = []
const listen = (e: Event) => toasts.push((e as CustomEvent).detail.message)

beforeEach(() => {
  toasts.length = 0
  resetCardPositionNoticeForTests()
  window.addEventListener(CANVAS_TOAST_EVENT, listen)
})
afterEach(() => window.removeEventListener(CANVAS_TOAST_EVENT, listen))

describe('the card-position notice', () => {
  it('the first drag of a visit says what a drag keeps', () => {
    noteCardMoved()
    expect(toasts).toEqual([CARD_POSITION_NOTICE])
    expect(CARD_POSITION_NOTICE).toBe("Card positions are for this visit; the model's layout is restored when you reopen.")
  })

  it('CONTRAST: later drags in the same visit say nothing', () => {
    noteCardMoved()
    noteCardMoved()
    noteCardMoved()
    expect(toasts).toHaveLength(1)
  })

  it('the canvas calls it when a drag ends, and drag stays on offer', () => {
    const src = readFileSync(join(__dirname, '../../ReactFlowGraph.tsx'), 'utf8')
    const stop = /const onNodeDragStop = useCallback\(\(\) => \{[\s\S]*?\n {2}\}, \[\]\)/.exec(src)?.[0] ?? ''
    expect(stop).toContain('noteCardMoved()')
    expect(src).toContain("nodesDraggable={effectiveMode === 'select'}")
  })
})
