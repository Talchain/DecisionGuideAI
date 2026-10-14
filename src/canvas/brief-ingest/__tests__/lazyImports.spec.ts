/**
 * The parsers must never reach the main entry chunk: xlsx and jszip are only
 * imported with a dynamic import() anywhere in src/ (tests aside).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : files(p)
    return /\.(ts|tsx)$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name) ? [p] : []
  })
}

describe('brief upload parsers load lazily', () => {
  const sources = files(join(process.cwd(), 'src')).map((p) => [p, readFileSync(p, 'utf8')] as const)

  it('has a positive control: the dynamic imports exist', () => {
    const dynamic = sources.filter(([, s]) => /import\(\s*['"](xlsx|jszip)['"]\s*\)/.test(s))
    expect(dynamic.length).toBeGreaterThanOrEqual(2)
  })

  it('never imports xlsx, jszip or pdfjs-dist statically', () => {
    const offenders = sources
      .filter(([, s]) => /^\s*import\s+(?!type\b)[^;'"]*?from\s+['"](xlsx|jszip|pdfjs-dist)(\/[^'"]*)?['"]/m.test(s))
      .map(([p]) => p)
    expect(offenders).toEqual([])
  })
})
