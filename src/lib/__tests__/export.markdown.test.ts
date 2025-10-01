import { describe, it, expect } from 'vitest'
import { buildMarkdown } from '../export'

const FIXED_ISO = '2025-01-02T03:04:05.678Z'

describe('buildMarkdown', () => {
  it('includes only present front-matter keys and uses text body when present', () => {
    const md = buildMarkdown({
      status: 'done',
      dateISO: FIXED_ISO,
      sessionId: 'sandbox',
      org: 'local',
      seed: '42',
      budget: 3.5,
      model: 'local-sim',
      costUSD: 0.02,
      text: 'Hello!'
    })
    expect(md).toContain('---')
    expect(md).toContain('status: done')
    expect(md).toContain(`date: ${FIXED_ISO}`)
    expect(md).toContain('sessionId: sandbox')
    expect(md).toContain('org: local')
    expect(md).toContain('seed: 42')
    expect(md).toContain('budget: 3.5')
    expect(md).toContain('model: local-sim')
    expect(md).toContain('costUSD: 0.02')
    expect(md.endsWith('Hello!')).toBe(true)
  })

  it('omits undefined front-matter keys and uses fallback body precedence', () => {
    // Omit many keys, provide text via tokens only
    const md1 = buildMarkdown({ status: 'done', dateISO: FIXED_ISO, tokens: ['A', 'B'] })
    expect(md1).toContain('status: done')
    expect(md1).toContain(`date: ${FIXED_ISO}`)
    expect(md1).not.toMatch(/sessionId:/)
    expect(md1).not.toMatch(/org:/)
    expect(md1).not.toMatch(/seed:/)
    expect(md1).not.toMatch(/budget:/)
    expect(md1).not.toMatch(/model:/)
    expect(md1).not.toMatch(/costUSD:/)
    expect(md1.endsWith('AB')).toBe(true)

    // No text and no tokens → "No transcript."
    const md2 = buildMarkdown({ status: 'done', dateISO: FIXED_ISO, text: '', tokens: [] })
    expect(md2.endsWith('*No transcript.*')).toBe(true)
  })
})
