/**
 * prefillInto — routes a chat prefill to whichever composer is visible.
 *
 * Regression guard for the "AI panel opens but the prompt never appears" bug:
 * under aiPanelV2 the legacy ChatComposer is unmounted (ref null), so a prefill
 * MUST fall through to the ConversationContext draft (which AIInputBar renders)
 * instead of silently no-opping against the null ref.
 */
import { describe, it, expect, vi } from 'vitest'
import { prefillInto } from '../prefillTarget'

describe('prefillInto', () => {
  it('writes to the legacy composer ref when one is mounted (replace)', () => {
    const replaceText = vi.fn()
    const setDraft = vi.fn()
    prefillInto({ replaceText }, setDraft, 'hello')
    expect(replaceText).toHaveBeenCalledWith('hello')
    // the live draft is NOT touched when the legacy composer owns the textarea
    expect(setDraft).not.toHaveBeenCalled()
  })

  it('writes to the ConversationContext draft when the legacy composer is absent', () => {
    // This is the fix: composer ref is null under hideComposer (aiPanelV2), so
    // the prefill must reach the live draft, not vanish.
    const setDraft = vi.fn()
    prefillInto(null, setDraft, 'hello')
    expect(setDraft).toHaveBeenCalledWith('hello')
  })

  it('does not throw when neither target exists (no live conversation)', () => {
    expect(() => prefillInto(null, undefined, 'hello')).not.toThrow()
  })
})
