/**
 * mergeComposerDraft — never clobber an unsent draft; append with separation.
 */
import { describe, it, expect } from 'vitest'
import { mergeComposerDraft } from '../composerDraft'

const PROMPT = 'Help me think through a risk worth adding to this decision.'

describe('mergeComposerDraft', () => {
  it('returns just the prompt when there is no draft', () => {
    expect(mergeComposerDraft(null, PROMPT)).toBe(PROMPT)
    expect(mergeComposerDraft(undefined, PROMPT)).toBe(PROMPT)
    expect(mergeComposerDraft('', PROMPT)).toBe(PROMPT)
  })

  it('treats a whitespace-only draft as empty', () => {
    expect(mergeComposerDraft('   \n  ', PROMPT)).toBe(PROMPT)
  })

  it('appends to a non-empty draft with a blank-line separator (never overwrites)', () => {
    expect(mergeComposerDraft('I am leaning towards option A', PROMPT)).toBe(
      `I am leaning towards option A\n\n${PROMPT}`,
    )
  })

  it('trims trailing whitespace on the draft before appending', () => {
    expect(mergeComposerDraft('my draft\n\n', PROMPT)).toBe(`my draft\n\n${PROMPT}`)
  })

  it('is idempotent: a repeat click does not stack the same prompt twice', () => {
    const once = mergeComposerDraft('my draft', PROMPT)
    expect(mergeComposerDraft(once, PROMPT)).toBe(once)
  })

  it('appends a different prompt even when one prompt is already present', () => {
    const first = mergeComposerDraft('my draft', PROMPT)
    const second = 'Help me define what success looks like for this decision.'
    expect(mergeComposerDraft(first, second)).toBe(`${first}\n\n${second}`)
  })
})
