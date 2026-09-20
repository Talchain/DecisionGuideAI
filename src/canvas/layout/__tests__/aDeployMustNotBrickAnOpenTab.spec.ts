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
import { STALE_BUILD_NOTICE_COPY, STALE_BUILD_ACTION_COPY } from '../../../lib/staleBuildRecovery'

const FOUNDER_CAPTURE =
  'Failed to fetch dynamically imported module: https://staging--olumi.netlify.app/assets/elk.bundled-BgtF8tzk.js'

/**
 * ⭐ THE SHAPE MY OWN DETECTOR MISSED, and the reason this file now delegates.
 * A SPA fallback answers 200 text/html where JS was expected. The existing
 * authority has witnessed it; the competing corpus I wrote did not contain it,
 * so the same retired-asset failure still reached the futile Retry path.
 */
const MIME_FALLBACK =
  'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".'

const settle = () => new Promise<void>(r => setTimeout(r, 0))

describe('a deploy under an open tab', () => {
  beforeEach(() => { useLayoutProgressStore.getState().cancel() })

  it.each([
    ["the founder's exact rejection", FOUNDER_CAPTURE],
    ['the MIME/SPA-fallback shape my own corpus missed', MIME_FALLBACK],
  ])('%s offers RELOAD with the shared notice', async (_name, message) => {
    handleLayoutWithRecovery(() => Promise.reject(new TypeError(message)))
    await settle()

    const s = useLayoutProgressStore.getState()
    expect(s.status).toBe('error')
    expect(s.actionLabel).toBe(STALE_BUILD_ACTION_COPY)
    // ⚠ THE SHARED SENTENCE, ASSERTED BY IDENTITY. My own copy promised
    // "nothing in your model is lost" — a claim `reloadForCurrentBuild`
    // verifies nowhere. Binding to the constant means a reword of the estate's
    // line cannot leave this path saying something else.
    expect(s.message).toBe(STALE_BUILD_NOTICE_COPY)
    // The sentence he actually saw, and which sent him to a button that could
    // not work.
    expect(s.message).not.toMatch(/try again/i)
    expect(s.canRetry).toBe(true)
  })

  it('⭐ it walks `cause` — the wrapper is what this path is handed', async () => {
    // `runLayoutWithProgress` re-throws; a detector reading only the top-level
    // message answers about the wrapper, not the failure.
    const wrapped = new Error('Layout step failed') as Error & { cause?: unknown }
    wrapped.cause = new TypeError(FOUNDER_CAPTURE)
    handleLayoutWithRecovery(() => Promise.reject(wrapped))
    await settle()
    expect(useLayoutProgressStore.getState().actionLabel).toBe(STALE_BUILD_ACTION_COPY)
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
    expect(useLayoutProgressStore.getState().actionLabel).toBe(STALE_BUILD_ACTION_COPY)

    handleLayoutWithRecovery(() => Promise.resolve())
    await settle()
    const s = useLayoutProgressStore.getState()
    expect(s.status).toBe('idle')
    expect(s.actionLabel).toBe('Retry')
  })
})
