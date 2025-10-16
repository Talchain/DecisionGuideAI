import { describe, it, expect } from 'vitest'
import { sanitizeLabel } from '../persist'

describe('Import Label Sanitization', () => {
  it('strips HTML tags', () => {
    // Removes tags but keeps content between them
    expect(sanitizeLabel('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello')
    expect(sanitizeLabel('<b>Bold</b> text')).toBe('Bold text')
    // Then removes remaining angle brackets
    expect(sanitizeLabel('<img src="x" onerror="alert(1)">')).toBe('Untitled')
  })

  it('removes angle brackets', () => {
    expect(sanitizeLabel('Test < 100')).toBe('Test  100')
    expect(sanitizeLabel('A > B')).toBe('A  B')
    expect(sanitizeLabel('<<malicious>>')).toBe('Untitled') // All brackets removed = empty = Untitled
    expect(sanitizeLabel('Safe<tag>Text')).toBe('SafeText') // <tag> is removed as HTML tag
  })

  it('removes control characters', () => {
    expect(sanitizeLabel('Hello\x00World')).toBe('HelloWorld')
    expect(sanitizeLabel('Test\x1FData')).toBe('TestData')
    expect(sanitizeLabel('Line\x7FBreak')).toBe('LineBreak')
  })

  it('limits length to 100 characters', () => {
    const longLabel = 'A'.repeat(150)
    expect(sanitizeLabel(longLabel)).toHaveLength(100)
  })

  it('trims whitespace', () => {
    expect(sanitizeLabel('  Hello  ')).toBe('Hello')
    expect(sanitizeLabel('\n\tTest\n\t')).toBe('Test')
  })

  it('returns "Untitled" for empty or invalid input', () => {
    expect(sanitizeLabel('')).toBe('Untitled')
    expect(sanitizeLabel('   ')).toBe('Untitled')
    expect(sanitizeLabel(null)).toBe('Untitled')
    expect(sanitizeLabel(undefined)).toBe('Untitled')
    expect(sanitizeLabel(123)).toBe('Untitled')
    expect(sanitizeLabel({})).toBe('Untitled')
  })

  it('handles combined malicious input', () => {
    const malicious = '<script>alert("xss")</script>\x00\x1F<img src=x onerror=alert(1)>'
    expect(sanitizeLabel(malicious)).toBe('alert("xss")')
  })

  it('preserves safe text', () => {
    expect(sanitizeLabel('Normal Node Label')).toBe('Normal Node Label')
    expect(sanitizeLabel('Node-123')).toBe('Node-123')
    expect(sanitizeLabel('Option A (preferred)')).toBe('Option A (preferred)')
  })
})
