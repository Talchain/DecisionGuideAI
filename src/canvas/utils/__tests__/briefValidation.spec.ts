import { describe, it, expect } from 'vitest'
import { validateBrief } from '../briefValidation'

describe('validateBrief', () => {
  // ------- Hard gate: character count -------
  it('rejects empty string', () => {
    expect(validateBrief('').isValid).toBe(false)
  })

  it('rejects whitespace-only string', () => {
    expect(validateBrief('   \t\n  ').isValid).toBe(false)
  })

  it('rejects string with < 30 chars after trim', () => {
    expect(validateBrief('Short decision brief').isValid).toBe(false)
  })

  it('rejects string that is exactly 29 chars', () => {
    // 29 chars: "abcde fghij klmno pqrst uvwxy"
    const input = 'abcde fghij klmno pqrst uvwxy'
    expect(input.trim().length).toBe(29)
    expect(validateBrief(input).isValid).toBe(false)
  })

  it('trims leading/trailing whitespace before checking', () => {
    const padded = '   Short brief   '
    expect(validateBrief(padded).isValid).toBe(false)
  })

  // ------- Hard gate: word count -------
  it('rejects a single long word (no spaces, >= 30 chars)', () => {
    const singleWord = 'a'.repeat(50)
    expect(singleWord.length).toBeGreaterThanOrEqual(30)
    expect(validateBrief(singleWord).isValid).toBe(false)
  })

  it('rejects input with >= 30 chars but only 1 word', () => {
    const oneWord = 'abcdefghijklmnopqrstuvwxyz12345'
    expect(oneWord.trim().split(/\s+/).length).toBe(1)
    expect(validateBrief(oneWord).isValid).toBe(false)
  })

  it('counts words correctly with multiple spaces between them', () => {
    const input = 'Should   we   launch   the   premium   tier?'
    expect(validateBrief(input).isValid).toBe(true)
  })

  // ------- Valid inputs -------
  it('accepts string with >= 30 chars and >= 2 words', () => {
    const input = 'Should we launch the premium tier this quarter?'
    expect(input.trim().length).toBeGreaterThanOrEqual(30)
    expect(validateBrief(input).isValid).toBe(true)
  })

  it('accepts exactly 30 chars with 2 words', () => {
    // 30 chars: "abcdefghijklmn opqrstuvwxyz123"
    const input = 'abcdefghijklmn opqrstuvwxyz123'
    expect(input.trim().length).toBe(30)
    expect(input.trim().split(/\s+/).length).toBe(2)
    expect(validateBrief(input).isValid).toBe(true)
  })

  it('returns no soft warning for normal English text', () => {
    const input = 'Should we expand into the European market this year or focus on US growth?'
    const result = validateBrief(input)
    expect(result.isValid).toBe(true)
    expect(result.hasSoftWarning).toBe(false)
    expect(result.warningText).toBeNull()
  })

  // ------- Soft warning: non-alpha ratio -------
  it('returns soft warning when >60% non-alpha characters', () => {
    // 40 chars, mostly numbers/symbols with 2 words
    const input = '123456789012345 !@#$%^&*()+=[] 78901234'
    const result = validateBrief(input)
    expect(result.isValid).toBe(true)
    expect(result.hasSoftWarning).toBe(true)
    expect(result.warningText).toBeTruthy()
  })

  it('does not warn for text with moderate non-alpha chars', () => {
    // Normal text with some numbers and punctuation
    const input = 'We need to decide: option A costs $150k, option B costs $200k.'
    const result = validateBrief(input)
    expect(result.isValid).toBe(true)
    expect(result.hasSoftWarning).toBe(false)
  })

  // ------- Edge cases -------
  it('handles gibberish like "zvz√v∫" (short + no words)', () => {
    expect(validateBrief('zvz√v∫').isValid).toBe(false)
  })

  it('handles 30 repeated chars without space', () => {
    expect(validateBrief('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').isValid).toBe(false)
  })
})
