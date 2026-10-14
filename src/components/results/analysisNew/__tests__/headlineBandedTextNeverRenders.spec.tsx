import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { normalizeHeadlineBanded } from '../../../../lib/decisionVerdict'

const forbiddenRead = /\b(headline_banded|headlineBanded)(\?\.|\.|\[['"])text\b/

const productionSources = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : productionSources(path)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.(spec|test)\./.test(entry.name) ? [path] : []
  })

describe('headline-banded prose is never rendered', () => {
  it('has no text reader in production source, with a live field-name contrast', () => {
    const files = productionSources('src')
    expect(files.length, 'zero source files scanned').toBeGreaterThan(0)
    const reads = files.filter(file => forbiddenRead.test(readFileSync(resolve(process.cwd(), file), 'utf8')))
    expect(reads).toEqual([])
    expect(readFileSync(resolve(process.cwd(), 'src/lib/decisionVerdict.ts'), 'utf8').match(/headline_banded/g)?.length ?? 0).toBeGreaterThan(0)
  })

  it('normalises identity fields only, dropping captured producer prose', () => {
    const fixture = JSON.parse(readFileSync(resolve(process.cwd(), 'src/v5/__tests__/fixtures/live-analysis-turn-T3-20260808T155759Z.json'), 'utf8'))
    const raw = fixture.blocks[0].enrichment.decision_brief.headline_banded
    expect(raw.text).toContain('is clearly ahead.')
    expect(normalizeHeadlineBanded(raw)).not.toHaveProperty('text')
  })

  it('kills a direct text-reader mutant', () => {
    expect(forbiddenRead.test('const copy = report.decision_brief?.headline_banded?.text')).toBe(true)
  })
})
