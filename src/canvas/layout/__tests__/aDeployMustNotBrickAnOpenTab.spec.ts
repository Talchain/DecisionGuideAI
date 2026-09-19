/**
 * ⭐⭐ THE END-TO-END CLAIM: a tab older than the deploy is told to RELOAD, and
 * an ordinary failure is still told to RETRY.
 *
 * Both halves are asserted here because each is the other's failure mode. Lose
 * the first and the founder's incident returns — an affordance that cannot
 * succeed, pressed forever. Lose the second and every genuine layout bug tells
 * the user to reload, they reload, it recurs, and the real defect is invisible.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { handleLayoutWithRecovery } from '../handleLayoutWithRecovery'
import { useLayoutProgressStore } from '../../layoutProgressStore'

const FOUNDER_CAPTURE =
  'Failed to fetch dynamically imported module: https://staging--olumi.netlify.app/assets/elk.bundled-BgtF8tzk.js'

const settle = () => new Promise<void>(r => setTimeout(r, 0))

describe('a deploy under an open tab', () => {
  beforeEach(() => { useLayoutProgressStore.getState().cancel() })

  it('⭐ the founder\'s exact rejection offers RELOAD, and says the version changed', async () => {
    handleLayoutWithRecovery(() => Promise.reject(new TypeError(FOUNDER_CAPTURE)))
    await settle()

    const s = useLayoutProgressStore.getState()
    expect(s.status).toBe('error')
    expect(s.actionLabel).toBe('Reload')
    expect(s.message).toMatch(/new version/i)
    expect(s.message).toMatch(/nothing in your model is lost/i)
    // The sentence he actually saw, and which sent him to a button that could
    // not work. It must not be what this state says.
    expect(s.message).not.toMatch(/try again/i)
    expect(s.canRetry).toBe(true)
  })

  it('⛔ DISCRIMINATION: an ordinary ELK failure still offers RETRY', async () => {
    handleLayoutWithRecovery(() => Promise.reject(new Error('ELK: node has no dimensions')))
    await settle()

    const s = useLayoutProgressStore.getState()
    expect(s.status).toBe('error')
    expect(s.actionLabel).toBe('Retry')
    expect(s.message).toMatch(/try again/i)
    expect(s.message).not.toMatch(/new version/i)
  })

  it('⛔ DISCRIMINATION: a DECLINED layout is unchanged — it is a different fact', async () => {
    // `{laidOut: false}` means the attempt resolved and committed nothing (a
    // superseded request). Retrying that CAN work, so it keeps its verb.
    handleLayoutWithRecovery(() => Promise.resolve({ laidOut: false }))
    await settle()

    const s = useLayoutProgressStore.getState()
    expect(s.status).toBe('error')
    expect(s.actionLabel).toBe('Retry')
  })

  it('a successful layout clears the banner and resets the verb', async () => {
    handleLayoutWithRecovery(() => Promise.reject(new TypeError(FOUNDER_CAPTURE)))
    await settle()
    expect(useLayoutProgressStore.getState().actionLabel).toBe('Reload')

    handleLayoutWithRecovery(() => Promise.resolve())
    await settle()
    const s = useLayoutProgressStore.getState()
    expect(s.status).toBe('idle')
    expect(s.actionLabel).toBe('Retry')
  })
})
