import { describe, it, expect } from 'vitest'
import { formatDownloadName } from '../../lib/filename'

describe('formatDownloadName', () => {
  it('includes seed and model when provided and appends a single extension', () => {
    const name = formatDownloadName('report', { seed: '123', model: 'gpt-4o-mini', ext: 'json' })
    expect(name).toBe('report_seed-123_model-gpt-4o-mini.json')
  })

  it('omits missing model/seed cleanly and handles dot-prefixed extensions', () => {
    const a = formatDownloadName('report', { seed: '123', ext: '.md' })
    expect(a).toBe('report_seed-123.md')
    const b = formatDownloadName('report', { model: 'claude-haiku', ext: '.txt' })
    expect(b).toBe('report_model-claude-haiku.txt')
    const c = formatDownloadName('report', { ext: 'txt' })
    expect(c).toBe('report.txt')
  })

  it('sanitises odd characters in model/seed', () => {
    const name = formatDownloadName('report', { seed: ' 42 ', model: 'claude:haiku 200k', ext: 'json' })
    expect(name).toBe('report_seed-42_model-claude-haiku-200k.json')
  })

  it('does not produce double dots in extension handling', () => {
    const name = formatDownloadName('report', { ext: '.json' })
    expect(name).toBe('report.json')
  })
})
