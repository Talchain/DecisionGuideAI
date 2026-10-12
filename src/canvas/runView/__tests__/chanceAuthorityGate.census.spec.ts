/**
 * ⭐⭐ #2747 r2: THE CHANCE AUTHORITY GATE — THE LINT RULE'S BACKSTOP.
 *
 * Every chance a surface shows passes ONE gate (`runView.ts`: `chanceFigureOf` / `chanceOf` / `chanceCellOf` /
 * `goalChanceRange` / `mainDriverOf`). The enforcement is lint: `chance-gate/no-raw-chance-read`
 * (`eslint-rules/no-raw-chance-read.js`, ERROR in `eslint.config.js`, run by the required "TypeScript + Lint" check)
 * reports every read of a chance or probability field in display code. The fresh check (r1) found what the previous
 * name census with FILE-wide exemptions could not see; so a read now says why ON ITS OWN LINE, or it fails.
 *
 * This spec asserts, over production sources under `src/` (tests, fixtures and stories excluded):
 *   1. the rule is registered, at error, over the display directories;
 *   2. every disable of it is line-level (never file-wide) and carries `-- chance-gate: <category>: <reason>`, with the
 *      category from the rule's closed set (`CHANCE_GATE_CATEGORIES`) and a reason;
 *   3. `gate` is said only inside `runView.ts`'s gate functions;
 *   4. the rule itself, run in-process with unused-disable reporting, finds ZERO unexplained reads and no stale disable;
 *      a planted bypass is reported (control), and the same line with a reason is not.
 *
 * ⚠ A NAME SCANNER, NOT A PROOF OF CORRECT WORDING. It sees the fields the rule names; a figure copied under another
 * name is outside it. The mounted specs (Results, the chat card, Compare, the Model tab) are the behaviour witnesses.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { Linter } from 'eslint'
import parser from '@typescript-eslint/parser'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import rule, { CHANCE_FIELDS, CHANCE_GATE_CATEGORIES } from '../../../../eslint-rules/no-raw-chance-read.js'

const ROOT = process.cwd()
const DISPLAY_DIRS = ['src/components', 'src/canvas', 'src/v5/blocks']
const RULE = 'chance-gate/no-raw-chance-read'
/** `runView.ts`'s gate functions: the only place a raw read is `gate`. */
const GATE_FUNCTIONS = new Set(['optionsWithGoalFigures', 'gatedFigure', 'gatedRange', 'gatedCompareGoalChances'])
const REASON = /^\s*(?:\/\/|\/\*|\{\/\*)\s*eslint-disable-(next-line|line)\s+chance-gate\/no-raw-chance-read\s+--\s+chance-gate:\s*([a-z-]+):\s*(\S.*?)\s*(?:\*\/\}?)?\s*$/

const EXCLUDED_DIR = new Set(['__tests__', '__fixtures__', 'fixtures', 'test', '__mocks__'])
const EXCLUDED_FILE = /\.(spec|test|stories)\.tsx?$|\.d\.ts$/
function productionFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { if (!EXCLUDED_DIR.has(name)) productionFiles(full, out) }
    else if (/\.tsx?$/.test(name) && !EXCLUDED_FILE.test(name)) out.push(full)
  }
  return out
}
const rel = (full: string) => relative(ROOT, full).split(sep).join('/')

const linter = new Linter({ configType: 'flat' })
const config: Linter.Config[] = [{
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: { parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } } },
  linterOptions: { reportUnusedDisableDirectives: 'error' },
  plugins: { 'chance-gate': { rules: { 'no-raw-chance-read': rule } } },
  rules: { [RULE]: 'error' },
}]
const lint = (file: string, text: string) => linter.verify(text, config, { filename: file })
  .filter(m => m.ruleId === RULE || (m.ruleId === null && m.message.includes(RULE)))

interface Disable { readonly file: string; readonly line: number; readonly kind: string | null; readonly category: string | null; readonly reason: string | null; readonly text: string }

let cache: { disables: Disable[]; reports: string[]; scanned: number } | null = null
function census() {
  if (cache) return cache
  const disables: Disable[] = []
  const reports: string[] = []
  let scanned = 0
  const all = productionFiles(join(ROOT, 'src'))
  for (const full of all) {
    const file = rel(full)
    const text = readFileSync(full, 'utf8')
    text.split('\n').forEach((line, index) => {
      if (!line.includes(RULE)) return
      const m = REASON.exec(line)
      disables.push({ file, line: index + 1, kind: m?.[1] ?? null, category: m?.[2] ?? null, reason: m?.[3] ?? null, text: line.trim() })
    })
    // The rule's own scope (eslint.config.js), prefiltered by its field names so the parse runs only where it can fire.
    if (!DISPLAY_DIRS.some(d => file.startsWith(`${d}/`))) continue
    if (!CHANCE_FIELDS.some(field => text.includes(field)) && !text.includes(RULE)) continue
    scanned += 1
    for (const m of lint(file, text)) reports.push(`${file}:${m.line} ${m.message.slice(0, 90)}`)
  }
  cache = { disables, reports, scanned }
  return cache
}

describe('⭐ the chance authority gate: enforced by lint, every exception explained on its own line', () => {
  it('1. the rule is registered at ERROR over the display directories (the required lint check runs it)', () => {
    const cfg = readFileSync(join(ROOT, 'eslint.config.js'), 'utf8')
    expect(cfg).toContain("import noRawChanceRead from './eslint-rules/no-raw-chance-read.js'")
    expect(cfg).toContain("'chance-gate': { rules: { 'no-raw-chance-read': noRawChanceRead } }")
    expect(cfg).toContain(`'${RULE}': 'error'`)
    expect(cfg).toContain("files: ['src/components/**/*.{ts,tsx}', 'src/canvas/**/*.{ts,tsx}', 'src/v5/blocks/**/*.{ts,tsx}']")
  })

  it('CONTROL: the field list names every quantity the DL listed (and the per-target field the r1 check found)', () => {
    for (const field of ['probability', 'probability_of_goal', 'probability_of_joint_goal', 'win_probability', 'goalProbability',
      'pct', 'low_pct', 'high_pct', 'lowPct', 'highPct', 'pct_by_option', 'pct_if_side', 'driver_by_option', 'prob_satisfied']) {
      expect(CHANCE_FIELDS).toContain(field)
    }
  })

  it('CONTROL: a planted bypass is reported (read, keyed read, destructure); a type or a literal key is not; a reason clears only its own line', () => {
    const planted = [
      'const a = licence.pctByOption[id]',
      "const b = row['probability_of_goal']",
      'const { goal_probability } = entry',
      'type T = { goal_probability?: number }',
      'const d = { pct_by_option: {} }',
      `// eslint-disable-next-line ${RULE} -- chance-gate: presence: control`,
      'const e = typeof x.win_probability === "number"',
      'const f = x.win_probability',
    ].join('\n')
    expect(lint('src/components/results/Mutant.tsx', planted).map(m => m.line)).toEqual([1, 2, 3, 8])
  })

  it('CONTROL (magnitude): the backstop parses the display files that can fire, and sees the gate\'s own reasons', () => {
    const { scanned, disables } = census()
    expect(scanned).toBeGreaterThanOrEqual(40)
    expect(disables.filter(d => d.file === 'src/canvas/runView/runView.ts' && d.category === 'gate').length).toBeGreaterThan(0)
  })

  it('2. every disable is LINE-level, with a known category and a reason (never file-wide, never unexplained)', () => {
    const bad = census().disables.filter(d => d.kind === null || d.category === null || !(d.category in CHANCE_GATE_CATEGORIES) || !d.reason)
    expect(bad.map(d => `${d.file}:${d.line} ${d.text}`)).toEqual([])
  })

  it('3. `gate` is said only inside runView.ts\'s gate functions', () => {
    const gate = census().disables.filter(d => d.category === 'gate')
    const runView = readFileSync(join(ROOT, 'src/canvas/runView/runView.ts'), 'utf8')
    const sf = ts.createSourceFile('runView.ts', runView, ts.ScriptTarget.Latest, true)
    const enclosing = (line: number): string | null => {
      let name: string | null = null
      const pos = sf.getPositionOfLineAndCharacter(line, 0)
      const visit = (n: ts.Node) => {
        if (n.getStart(sf) <= pos && pos < n.getEnd()) {
          if (ts.isFunctionDeclaration(n) && n.name) name = n.name.text
          ts.forEachChild(n, visit)
        }
      }
      visit(sf)
      return name
    }
    expect(gate.filter(d => d.file !== 'src/canvas/runView/runView.ts' || !GATE_FUNCTIONS.has(enclosing(d.line) ?? '')).map(d => `${d.file}:${d.line}`)).toEqual([])
  })

  it('4. ⭐ the rule finds ZERO unexplained reads, and no reason is stale', () => {
    expect(census().reports, `chance fields read outside the gate:\n  ${census().reports.join('\n  ')}`).toEqual([])
  })
}, 120_000)
