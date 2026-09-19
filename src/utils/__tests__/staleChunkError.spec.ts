/**
 * ⭐⭐ THE FOUNDER'S OWN ERROR STRING IS THE FIRST CASE IN THIS FILE.
 *
 * 19 Sep 2026: his tab was built at `f22e15fd`; staging deployed `09411c54` at
 * 18:12:44Z and replaced the hashed assets; at 18:16 the canvas reached for ELK
 * — fetched lazily at first use by `utils/layout.ts:618` — and got a 404. The
 * product showed "Layout failed. Try again." He pressed Retry, then
 * Auto-arrange. Neither could ever have worked: the chunk is gone from the
 * origin permanently.
 *
 * ⛔ THE CORPUS IS NOT FROM MY HEAD (CLAUDE.md trap 22). One entry is the
 * verbatim capture; the rest are the same condition on engines we ship to and
 * did not witness. A detector written only against the message we happened to
 * see would be a report about Chromium, not about the condition.
 */
import { describe, it, expect } from 'vitest'
import { isStaleChunkError, STALE_CHUNK_MESSAGE, STALE_CHUNK_ACTION_LABEL } from '../staleChunkError'

/** ⭐ VERBATIM from the founder's console, 19 Sep 2026. */
const FOUNDER_CAPTURE =
  'TypeError: Failed to fetch dynamically imported module: https://staging--olumi.netlify.app/assets/elk.bundled-BgtF8tzk.js'

describe('a deploy under an open tab is recognised, and nothing else is', () => {
  describe('POSITIVE — the same condition across engines', () => {
    it.each([
      ['Chromium (the founder\'s capture)', FOUNDER_CAPTURE],
      ['Firefox', 'Error loading dynamically imported module: https://x/assets/elk-abc.js'],
      ['Safari', 'Importing a module script failed.'],
      ['webpack-style loader', 'ChunkLoadError: Loading chunk 42 failed.'],
      ['Vite CSS preload', 'Unable to preload CSS for /assets/index-abc.css'],
    ])('%s', (_engine, message) => {
      expect(isStaleChunkError(new TypeError(message))).toBe(true)
      // A plain string reaches this path too — some wrappers re-throw the text.
      expect(isStaleChunkError(message)).toBe(true)
    })

    it('walks `cause`, because the rejection is re-thrown by wrappers', () => {
      // `runLayoutWithProgress` wraps. A detector reading only the top-level
      // message answers about the wrapper, not the failure.
      const wrapped = new Error('Layout step failed', { cause: new TypeError(FOUNDER_CAPTURE) })
      expect(isStaleChunkError(wrapped)).toBe(true)
    })

    it('a cyclic `cause` cannot hang the error path', () => {
      const a = new Error('outer') as Error & { cause?: unknown }
      const b = new Error('inner') as Error & { cause?: unknown }
      a.cause = b; b.cause = a
      expect(() => isStaleChunkError(a)).not.toThrow()
      expect(isStaleChunkError(a)).toBe(false)
    })
  })

  describe('⛔ NEGATIVE — a real fault must NOT be dressed up as a stale deploy', () => {
    // If these matched, a genuine bug in our layout code would tell the user to
    // reload, they would reload, it would happen again, and the real defect
    // would be invisible. This half matters as much as the half above.
    it.each([
      ['an ELK failure with a real cause', new Error('ELK: cannot layout a node with no dimensions')],
      ['a type error in our own code', new TypeError("Cannot read properties of undefined (reading 'width')")],
      ['a network timeout', new Error('Request timed out after 30000ms')],
      ['an ordinary 500', new Error('HTTP 500 Internal Server Error')],
      ['an abort', new DOMException('The operation was aborted.', 'AbortError')],
      ['nothing at all', undefined],
      ['null', null],
      ['an empty string', ''],
      ['a bare object', {}],
    ])('%s is not a stale chunk', (_name, err) => {
      expect(isStaleChunkError(err)).toBe(false)
    })
  })

  describe('the copy claims the right thing', () => {
    it('names the cause and the cure, and never blames the model', () => {
      expect(STALE_CHUNK_MESSAGE).toMatch(/new version/i)
      expect(STALE_CHUNK_MESSAGE).toMatch(/reload/i)
      expect(STALE_CHUNK_MESSAGE).toMatch(/nothing in your model is lost/i)
      // "failed" reads as *your graph is broken*. It is not.
      expect(STALE_CHUNK_MESSAGE.toLowerCase()).not.toContain('failed')
    })

    it('the action is Reload, never Retry — retrying is what could not work', () => {
      expect(STALE_CHUNK_ACTION_LABEL).toBe('Reload')
      expect(STALE_CHUNK_ACTION_LABEL).not.toBe('Retry')
    })
  })
})
