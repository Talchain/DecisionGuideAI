/**
 * Paul, 27 Sep 2026: "Ensure consistent spacing within the panel, and limit us
 * to a maximum of three font sizes."
 *
 * A SOURCE census of the Reasoning tab (`analysisNew`, non-test files):
 *   1. Type comes only from the panel tokens, whose sizes are 14 / 12 / 11 px.
 *      No raw size class (`text-xs`, `text-[13px]` …) may appear in a className.
 *   2. Spacing is on the 4px grid. Hairline/optical nudges of 1–2px are allowed;
 *      3/5/6/7/9/10/11/13/15px and Tailwind's `x.5` steps are not.
 * Comment lines are skipped: they cite historical classes on purpose.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { typography } from '../../../../styles/typography'

const ROOT = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sourceFiles(p)
    return /\.tsx?$/.test(name) ? [p] : []
  })
}

function codeLines(file: string): Array<[number, string]> {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((l, i): [number, string] => [i + 1, l])
    .filter(([, l]) => !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(l))
}

const FILES = sourceFiles(ROOT)
const RAW_SIZE = /(?<![\w-])text-(xs|sm|base|lg|xl|2xl|3xl|\[\d+(\.\d+)?px\])(?![\w-])/
const OFF_GRID = /(?<![\w-])!?-?(m|p|gap|space-y|space-x)(?:[tbyxlr]|-[xy])?-(\[(3|5|6|7|9|10|11|13|14|15|17|18|19|21|22|23)px\]|[1-9]\.5)(?![\w.\]-])/
const PX: Record<string, number> = { 'text-xs': 12, 'text-sm': 14, 'text-[11px]': 11 }

describe('the Reasoning tab: three font sizes, one spacing grid', () => {
  it('PRECONDITION: the census sees the tab (dozens of files, and the tokens it relies on)', () => {
    expect(FILES.length).toBeGreaterThan(30)
    expect(FILES.some((f) => f.endsWith('AnalysisNewTabBody.tsx'))).toBe(true)
  })

  it('the panel tokens the tab uses resolve to exactly three sizes: 14, 12 and 11px', () => {
    const used = new Set<string>()
    for (const f of FILES) for (const [, l] of codeLines(f)) for (const m of l.matchAll(/typography\.(\w+)/g)) used.add(m[1])
    expect(used.size).toBeGreaterThan(2)
    const sizes = new Set<number>()
    for (const name of used) {
      const cls = (typography as Record<string, string>)[name]
      expect(cls, `typography.${name}`).toBeTruthy()
      const size = cls.split(/\s+/).find((c) => c in PX)
      expect(size, `typography.${name} = "${cls}" is not one of the three panel sizes`).toBeDefined()
      sizes.add(PX[size!])
    }
    expect([...sizes].sort((a, b) => b - a)).toEqual([14, 12, 11])
  })

  it('no raw font-size class bypasses the tokens', () => {
    const hits = FILES.flatMap((f) => codeLines(f).filter(([, l]) => RAW_SIZE.test(l)).map(([n, l]) => `${relative(ROOT, f)}:${n} ${l.trim().slice(0, 90)}`))
    expect(hits).toEqual([])
  })

  it('no spacing class is off the 4px grid (1–2px optical nudges excepted)', () => {
    const hits = FILES.flatMap((f) => codeLines(f).filter(([, l]) => OFF_GRID.test(l)).map(([n, l]) => `${relative(ROOT, f)}:${n} ${l.trim().slice(0, 90)}`))
    expect(hits).toEqual([])
  })

  it('CONTROL: both patterns catch what they are meant to', () => {
    expect(RAW_SIZE.test('className="text-[13px] font-sans"')).toBe(true)
    expect(RAW_SIZE.test('className="text-xs"')).toBe(true)
    expect(RAW_SIZE.test('className="text-text-light"')).toBe(false)
    expect(OFF_GRID.test('className="mt-[7px]"')).toBe(true)
    expect(OFF_GRID.test('className="gap-1.5"')).toBe(true)
    expect(OFF_GRID.test('className="gap-x-2.5"')).toBe(true)
    expect(OFF_GRID.test('className="!mt-[11px] pt-3"')).toBe(true)
    expect(OFF_GRID.test('className="mt-[2px] gap-2 -mx-4 mt-0.5"')).toBe(false)
  })
})
