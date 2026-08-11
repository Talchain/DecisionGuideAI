/**
 * transcriptStore — the store behind returning-user continuity.
 *
 * These are unit pins. The USER-VISIBLE pin (the first-use placeholder is no
 * longer rendered over restored work) lives in
 * `src/canvas/components/__tests__/OlumiTabBody.returningUser.spec.tsx`.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { ConversationMessage } from '../../types'
import {
  saveTranscript,
  loadTranscript,
  clearTranscript,
  __resetTranscriptTombstonesForTests,
  formatTruncationNotice,
  TRANSCRIPT_STORAGE_KEY,
  MAX_MESSAGES_PER_SCENARIO,
} from '../transcriptStore'

const SID = '561548c3-acd6-4488-b088-399c7cc15631'

function msg(over: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: over.id ?? crypto.randomUUID(),
    role: over.role ?? 'user',
    content: over.content ?? 'hello',
    timestamp: over.timestamp ?? new Date('2026-07-25T17:38:01.000Z'),
    ...over,
  }
}

describe('transcriptStore', () => {
  beforeEach(() => {
    localStorage.clear()
    // `clearTranscript` now tombstones an id for the page load, so a later
    // `saveTranscript` for that id is refused — that is the point: without it the
    // clear is undone on its own React commit. The tombstone is MODULE state and
    // `localStorage.clear()` does not touch it, so a case that clears SID would
    // silently disable saving for every later case using SID. Reset it here, as
    // any module-level singleton must be between tests. No assertion below is
    // weakened; the tombstone has its own coverage in
    // `useConversation.resetTranscript.spec.tsx`.
    __resetTranscriptTombstonesForTests()
  })

  it('round-trips the real turns verbatim, not a summary of them', () => {
    const brief =
      'We run a 12-person specialty coffee roastery in Bristol. I have around 80k I could invest.'
    saveTranscript(SID, [
      msg({ id: 'u1', role: 'user', content: brief }),
      msg({ id: 'a1', role: 'assistant', content: 'I have built a first decision model.' }),
    ])

    const out = loadTranscript(SID)
    expect(out).not.toBeNull()
    expect(out!.messages).toHaveLength(2)
    expect(out!.messages[0].content).toBe(brief)
    expect(out!.messages[0].role).toBe('user')
    expect(out!.messages[1].content).toBe('I have built a first decision model.')
    expect(out!.messages[0].timestamp).toBeInstanceOf(Date)
    expect(out!.droppedCount).toBe(0)
  })

  it('keeps blocks so a restored assistant turn still renders its cards', () => {
    saveTranscript(SID, [
      msg({
        id: 'a1',
        role: 'assistant',
        content: 'Overconfidence',
        blocks: [{ type: 'commentary', text: 'no hard budget ceiling node' }] as never,
      }),
    ])
    const out = loadTranscript(SID)
    expect(out!.messages[0].blocks).toHaveLength(1)
  })

  it('returns null when nothing is stored — the placeholder is TRUE then', () => {
    expect(loadTranscript(SID)).toBeNull()
    expect(loadTranscript(null)).toBeNull()
  })

  it('never commits a user turn the server never served', () => {
    saveTranscript(SID, [
      msg({ id: 'u-fail', role: 'user', content: 'never delivered', deliveryState: 'failed' }),
      msg({ id: 'u-pending', role: 'user', content: 'still in flight', deliveryState: 'pending' }),
      msg({ id: 'u-ok', role: 'user', content: 'delivered', deliveryState: 'sent' }),
    ])
    const out = loadTranscript(SID)
    expect(out!.messages.map((m) => m.content)).toEqual(['delivered'])
  })

  it('drops synthetic chrome but keeps session dividers', () => {
    saveTranscript(SID, [
      msg({ id: 's1', role: 'assistant', content: 'welcome banner', synthetic: true }),
      msg({
        id: 'd1',
        role: 'assistant',
        content: '',
        synthetic: true,
        sessionDivider: 'Session resumed - 25 Jul, 17:38',
      }),
      msg({ id: 'u1', role: 'user', content: 'real turn' }),
    ])
    const out = loadTranscript(SID)
    expect(out!.messages.map((m) => m.id)).toEqual(['d1', 'u1'])
  })

  it('DISCLOSES truncation rather than silently shortening the history', () => {
    const many = Array.from({ length: MAX_MESSAGES_PER_SCENARIO + 7 }, (_, i) =>
      msg({ id: `m${i}`, content: `turn ${i}` }),
    )
    const dropped = saveTranscript(SID, many)
    expect(dropped).toBe(7)

    const out = loadTranscript(SID)
    expect(out!.messages).toHaveLength(MAX_MESSAGES_PER_SCENARIO)
    expect(out!.droppedCount).toBe(7)
    // The oldest survived message is the first one AFTER the dropped run.
    expect(out!.messages[0].content).toBe('turn 7')
    expect(formatTruncationNotice(7)).toBe(
      'The earliest 7 messages from this decision could not be restored',
    )
    expect(formatTruncationNotice(1)).toBe(
      'The earliest message from this decision could not be restored',
    )
  })

  it('keeps transcripts separate per scenario', () => {
    const OTHER = '2c288003-5ae0-478b-8307-45ac9cc41dea'
    saveTranscript(SID, [msg({ id: 'a', content: 'roastery' })])
    saveTranscript(OTHER, [msg({ id: 'b', content: 'something else' })])
    expect(loadTranscript(SID)!.messages[0].content).toBe('roastery')
    expect(loadTranscript(OTHER)!.messages[0].content).toBe('something else')
  })

  it('clearTranscript forgets one scenario and leaves the others', () => {
    const OTHER = 'aead8bbf-e8f8-4f98-bca4-99e7f3ffa35b'
    saveTranscript(SID, [msg({ id: 'a', content: 'roastery' })])
    saveTranscript(OTHER, [msg({ id: 'b', content: 'other' })])
    clearTranscript(SID)
    expect(loadTranscript(SID)).toBeNull()
    expect(loadTranscript(OTHER)).not.toBeNull()
  })

  it('survives a corrupt payload without throwing into a render path', () => {
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, '{not json')
    expect(() => loadTranscript(SID)).not.toThrow()
    expect(loadTranscript(SID)).toBeNull()
    expect(() => saveTranscript(SID, [msg()])).not.toThrow()
    expect(loadTranscript(SID)).not.toBeNull()
  })

  it('degrades to a shorter, DECLARED history when the quota is exhausted', () => {
    const real = Storage.prototype.setItem
    let allowed = false
    Storage.prototype.setItem = function (k: string, v: string) {
      // Refuse everything until the payload has been halved twice.
      if (k === TRANSCRIPT_STORAGE_KEY && !allowed && v.length > 400) {
        const e = new Error('QuotaExceededError')
        e.name = 'QuotaExceededError'
        throw e
      }
      return real.call(this, k, v)
    }
    try {
      const many = Array.from({ length: 40 }, (_, i) =>
        msg({ id: `m${i}`, content: `turn ${i} ${'x'.repeat(60)}` }),
      )
      const dropped = saveTranscript(SID, many)
      expect(dropped).not.toBeNull()
      expect(dropped!).toBeGreaterThan(0)
      allowed = true
      const out = loadTranscript(SID)
      expect(out).not.toBeNull()
      // Whatever survived, the shortfall is on the record.
      expect(out!.droppedCount).toBeGreaterThan(0)
      expect(out!.messages.length).toBeLessThan(40)
    } finally {
      Storage.prototype.setItem = real
    }
  })
})

describe('transcriptStore — previous-session discrimination', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetTranscriptTombstonesForTests() // module state — see the note above
  })

  it('a transcript THIS page load wrote is not "from a previous session"', () => {
    saveTranscript(SID, [msg({ id: 'a', content: 'live turn' })])
    expect(loadTranscript(SID)!.fromPreviousSession).toBe(false)
  })

  it('a transcript an EARLIER page load wrote IS from a previous session', () => {
    saveTranscript(SID, [msg({ id: 'a', content: 'yesterday' })])
    const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    file[SID].pageLoadId = 'an-earlier-page-load'
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
    expect(loadTranscript(SID)!.fromPreviousSession).toBe(true)
  })

  it('a legacy record with no stamp is treated as a previous session', () => {
    saveTranscript(SID, [msg({ id: 'a', content: 'pre-upgrade' })])
    const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    delete file[SID].pageLoadId
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
    expect(loadTranscript(SID)!.fromPreviousSession).toBe(true)
  })
})
