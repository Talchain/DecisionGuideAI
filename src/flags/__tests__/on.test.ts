import { describe, it, expect } from 'vitest'
import { on } from '../on'

describe('flags/on', () => {
  it('accepts truthy strings and numbers', () => {
    const truthy = ['1', 'true', 'TRUE', ' yes ', 'On', 1]
    for (const v of truthy) expect(on(v)).toBe(true)
  })
  it('rejects falsy variants', () => {
    const falsy = ['0', 'false', 'no', 'off', '', undefined, null, 0]
    for (const v of falsy) expect(on(v as any)).toBe(false)
  })
})
