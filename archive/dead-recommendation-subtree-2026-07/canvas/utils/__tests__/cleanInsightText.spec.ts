import { describe, it, expect } from 'vitest'
import { cleanInsightText, escapeRegex, quoteOptionNames } from '../cleanInsightText'

describe('cleanInsightText', () => {
  it('returns null for null/undefined input', () => {
    expect(cleanInsightText(null)).toBeNull()
    expect(cleanInsightText(undefined)).toBeNull()
  })

  it('returns empty string unchanged', () => {
    expect(cleanInsightText('')).toBeNull() // Empty string is falsy
  })

  it('removes "(X.XX units)" patterns', () => {
    expect(cleanInsightText("'Option A' outperforms 'Option B' by 1% (0.01 units)"))
      .toBe("'Option A' outperforms 'Option B' by 1%")

    expect(cleanInsightText('Result improved (0.5 units)'))
      .toBe('Result improved')

    expect(cleanInsightText('Changed by (1 unit)'))
      .toBe('Changed by')
  })

  it('removes "by X.XX units" patterns', () => {
    expect(cleanInsightText('Outcome increased by 0.01 units'))
      .toBe('Outcome increased')

    expect(cleanInsightText('Value decreased by 2.5 units over time'))
      .toBe('Value decreased over time')
  })

  it('converts "+X pts" to "+X%"', () => {
    expect(cleanInsightText('Outcome improved by +50 pts'))
      .toBe('Outcome improved by +50%')

    expect(cleanInsightText('+25 pts better than baseline'))
      .toBe('+25% better than baseline')

    expect(cleanInsightText('-10 pts worse'))
      .toBe('-10% worse')
  })

  it('handles multiple patterns in same text', () => {
    expect(cleanInsightText("'A' beats 'B' by +50 pts (0.5 units)"))
      .toBe("'A' beats 'B' by +50%")
  })

  it('cleans up double spaces', () => {
    expect(cleanInsightText('Some  text  with   spaces'))
      .toBe('Some text with spaces')
  })

  it('trims whitespace', () => {
    expect(cleanInsightText('  trimmed text  '))
      .toBe('trimmed text')
  })

  it('preserves text without patterns', () => {
    expect(cleanInsightText('This is a clean insight'))
      .toBe('This is a clean insight')
  })
})

describe('escapeRegex', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegex('a.b*c?d')).toBe('a\\.b\\*c\\?d')
    expect(escapeRegex('[test]')).toBe('\\[test\\]')
    expect(escapeRegex('(group)')).toBe('\\(group\\)')
    expect(escapeRegex('a+b$c^d')).toBe('a\\+b\\$c\\^d')
  })

  it('leaves normal text unchanged', () => {
    expect(escapeRegex('hello world')).toBe('hello world')
    expect(escapeRegex('option-name')).toBe('option-name')
  })
})

describe('quoteOptionNames', () => {
  it('returns original text for empty input', () => {
    expect(quoteOptionNames('', ['A', 'B'])).toBe('')
    expect(quoteOptionNames('Some text', [])).toBe('Some text')
  })

  it('wraps option names in single quotes', () => {
    expect(quoteOptionNames(
      'Implement software outperforms Do nothing',
      ['Implement software', 'Do nothing']
    )).toBe("'Implement software' outperforms 'Do nothing'")
  })

  it('does not double-quote already quoted names', () => {
    expect(quoteOptionNames(
      "'Option A' is better",
      ['Option A']
    )).toBe("'Option A' is better")
  })

  it('handles longer labels first to avoid partial matches', () => {
    // "Do nothing extra" should be quoted as whole, not just "Do nothing"
    expect(quoteOptionNames(
      'Do nothing extra vs Do nothing',
      ['Do nothing', 'Do nothing extra']
    )).toBe("'Do nothing extra' vs 'Do nothing'")
  })

  it('skips very short labels', () => {
    expect(quoteOptionNames('A vs B option', ['A', 'B option']))
      .toBe("A vs 'B option'")
  })

  it('handles special regex characters in labels', () => {
    expect(quoteOptionNames(
      'Option (A) vs Option [B]',
      ['Option (A)', 'Option [B]']
    )).toBe("'Option (A)' vs 'Option [B]'")
  })
})
