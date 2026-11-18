/**
 * plainWords: markdown's marks dropped for a plain one-line or text-box place, every word kept in order (Paul, 18 Nov: "## " showed in the
 * right-click menu's Undo row and in the first box of "Record what you will do"). Invented wording throughout.
 */
import { describe, expect, it } from 'vitest'
import { plainWords } from '../plainWords'

describe('plainWords', () => {
  it('drops a heading\'s hashes at a line\'s start and after other words on the line; bold and code marks go; the words stay', () => {
    expect(plainWords('## Find out first\nAsk whether the change caused the rise. **Then** decide.')).toBe('Find out first\nAsk whether the change caused the rise. Then decide.')
    expect(plainWords('Undo: + outside the model: ## Find out first: did the change cause it?')).toBe('Undo: + outside the model: Find out first: did the change cause it?')
    expect(plainWords('Use `churn_rate` as given')).toBe('Use churn_rate as given')
  })
  it('CONTRAST: words that merely contain these characters are left exactly as written', () => {
    for (const same of ['Option #2 costs £600', 'A * B is the product', 'Three #tags and a 5% rise', 'plain words, nothing to drop']) expect(plainWords(same)).toBe(same)
  })
})
