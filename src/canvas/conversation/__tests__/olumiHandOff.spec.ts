/**
 * olumiHandOff — FRONT FIRST, THEN SEND.
 *
 * ## The defect
 *
 * Every send-to-AI control on the Model tab called `onSendMessage` directly, so a
 * real turn was posted into a panel that could stay hidden. The user clicked
 * "Add a factor" and nothing visibly happened — an affordance terminating in
 * silence, which is preamble P8's harm and the same family as the Research CTA.
 *
 * ## Binding
 *
 * ⚠ ORDER IS THE WHOLE POINT, so it is asserted as ORDER, not as "both were
 * called". A test that only checked both happened would pass on send-then-front,
 * which is the same defect one frame later. The two mocks write into ONE shared
 * log and the log's sequence is the object of the assertion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const log: string[] = []
const mocks = vi.hoisted(() => ({ fronted: true }))

vi.mock('../revealOlumi', () => ({
  revealOlumiSurface: () => {
    log.push('front')
    return mocks.fronted
  },
}))

import { createOlumiHandOff } from '../olumiHandOff'

beforeEach(() => {
  log.length = 0
  mocks.fronted = true
})

describe('createOlumiHandOff — no sender means no affordance', () => {
  it('returns null when there is no sender, so the caller cannot render a dead end', () => {
    expect(createOlumiHandOff(undefined)).toBeNull()
    expect(createOlumiHandOff(null)).toBeNull()
  })

  it('returns a callable when a sender exists — the contrast control', () => {
    expect(typeof createOlumiHandOff(vi.fn())).toBe('function')
  })
})

describe('createOlumiHandOff — fronts BEFORE it sends', () => {
  it('the fronting call precedes the send call, in that order', () => {
    const send = vi.fn(() => {
      log.push('send')
    })
    const handOff = createOlumiHandOff(send)!
    handOff({ message: 'I want to add a new factor to the model' })
    expect(log).toEqual(['front', 'send'])
  })

  it('sends the message verbatim', () => {
    const send = vi.fn()
    createOlumiHandOff(send)!({ message: "I'd like to add a causal relationship" })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toBe("I'd like to add a causal relationship")
  })

  it('carries the reason as the debug source, and omits the option when absent', () => {
    const send = vi.fn()
    const handOff = createOlumiHandOff(send)!
    handOff({ message: 'm', reason: 'model-tab-v2:factors-add' })
    expect(send.mock.calls[0][1]).toEqual({ debugSource: 'model-tab-v2:factors-add' })
    handOff({ message: 'm' })
    expect(send.mock.calls[1][1]).toBeUndefined()
  })

  it('never marks a user gesture hidden — the turn belongs in the transcript', () => {
    const send = vi.fn()
    createOlumiHandOff(send)!({ message: 'm', reason: 'r' })
    expect(send.mock.calls[0][1]).not.toHaveProperty('hidden', true)
  })
})

describe('createOlumiHandOff — it reports what the primitive reports', () => {
  it('"fronted" when a surface came to the front', () => {
    mocks.fronted = true
    expect(createOlumiHandOff(vi.fn())!({ message: 'm' })).toBe('fronted')
  })

  it('"deferred" when nothing did — and the turn is STILL sent', () => {
    mocks.fronted = false
    const send = vi.fn()
    expect(createOlumiHandOff(send)!({ message: 'm' })).toBe('deferred')
    // The opposite-direction twin: reporting the failure must not also swallow
    // the turn. A turn the user can find by opening the panel themselves is
    // strictly better than no turn, and the return value is what keeps the
    // product from CLAIMING it fronted.
    expect(send).toHaveBeenCalledTimes(1)
  })
})
