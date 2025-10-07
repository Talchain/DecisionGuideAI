// tests/pack-lint.test.ts
import { describe, it, expect } from 'vitest'
import { namePattern } from '../tools/pack-lint/bin/lint.mjs'

describe('pack-lint regex', () => {
  it('accepts compact and dashed date formats with 7-char sha', () => {
    expect(namePattern.test('engine_pack_20251006_d66e076.zip')).toBe(true)
    expect(namePattern.test('engine_pack_2025-10-06_d66e076.zip')).toBe(true)
  })

  it('rejects invalid names', () => {
    expect(namePattern.test('engine-pack-20251006_d66e076.zip')).toBe(false)
    expect(namePattern.test('engine_pack_20251006_d66e07.zip')).toBe(false)
    expect(namePattern.test('engine_pack_2025-10-06_d66e0768.zip')).toBe(false)
  })
})
