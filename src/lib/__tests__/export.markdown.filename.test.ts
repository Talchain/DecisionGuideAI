import { describe, it, expect } from 'vitest'
import { buildMarkdownFilename } from '../export'

describe('buildMarkdownFilename', () => {
  it('formats critique-YYYYMMDD-HHmm.md with zero padding (local time)', () => {
    // Construct Date in local time to avoid timezone-dependent flake
    const d = new Date(2025, 0, 2, 3, 4) // Jan 2, 2025 03:04 local time
    const name = buildMarkdownFilename(d)
    expect(name).toBe('critique-20250102-0304.md')
  })

  it('pads single-digit month/day/hour/minute', () => {
    const d = new Date(2025, 9, 11, 0, 5) // Oct 11, 2025 00:05 local time
    const name = buildMarkdownFilename(d)
    expect(name).toBe('critique-20251011-0005.md')
  })
})
