/**
 * P0.2 round 2: report consumers must preserve the report's reading withhold.
 * A new per-entry goal selector call is RED unless its dormant site has an
 * explicit allowance and reason. AST calls exclude comments and quoted text.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..') // src/
const OWNER = 'components/results/utils/selectGoalProbability.ts'
const ALLOWLIST: Record<string, { calls: number; reason: string }> = {
  'canvas/components/DecisionSummary.tsx': {
    calls: 1,
    reason: 'Dormant legacy card; migrate to the report accessor before restoring a production consumer.',
  },
  'canvas/components/model-tab/buildGoalFitRows.ts': {
    calls: 1,
    reason: 'Dormant since Model-tab removal; migrate to the report accessor if the retained builder resurfaces.',
  },
  'lib/discriminationFallback.ts': {
    calls: 1,
    reason: 'Dormant legacy fallback; migrate to the report accessor before restoring its goal-figure path.',
  },
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__' || entry.name === 'tests' || entry.name === 'node_modules') return []
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:[cm]?[jt]s|[jt]sx)$/.test(entry.name) && !/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(entry.name)
      ? [path]
      : []
  })
}

function perEntryCalls(file: string, text: string): number[] {
  if (!/\bselectGoalProbability\b/.test(text)) return []
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const names = new Set(['selectGoalProbability'])
  // An aliased import remains the same bypass; it is not a new selector owner.
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const binding of bindings.elements) {
      if ((binding.propertyName ?? binding.name).text === 'selectGoalProbability') names.add(binding.name.text)
    }
  }
  const lines: number[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      let callee: ts.Expression = node.expression
      while (ts.isParenthesizedExpression(callee)) callee = callee.expression
      if ((ts.isIdentifier(callee) && names.has(callee.text)) ||
          (ts.isPropertyAccessExpression(callee) && callee.name.text === 'selectGoalProbability')) {
        lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return lines
}

function unapprovedCalls(root: string): string[] {
  return sourceFiles(root).flatMap((file) => {
    const path = relative(root, file).split('\\').join('/')
    if (path === OWNER) return []
    const lines = perEntryCalls(file, readFileSync(file, 'utf8'))
    const allowance = ALLOWLIST[path]
    if (allowance?.reason.trim()) return lines.slice(allowance.calls).map((line) => `src/${path}:${line}`)
    return lines.map((line) => `src/${path}:${line}`)
  })
}

function assertReportSelectors(root: string): void {
  const hits = unapprovedCalls(root)
  if (hits.length) throw new Error(`Per-entry goal selector bypasses report reading gate:\n${hits.join('\n')}`)
}

describe('goal figures read from reports use the report-level accessor', () => {
  it('all non-test source calls are owned or explicitly allowed with a reason', () => {
    expect(sourceFiles(ROOT).length).toBeGreaterThan(500)
    expect(() => assertReportSelectors(ROOT)).not.toThrow()
  })

  it('dormant allowances name a reason and cover only their existing call', () => {
    for (const [path, allowance] of Object.entries(ALLOWLIST)) {
      expect(allowance.reason.trim(), path).not.toBe('')
      expect(perEntryCalls(path, readFileSync(join(ROOT, path), 'utf8')), path).toHaveLength(allowance.calls)
    }
  })

  it('RED control: a planted mutant in a temporary source copy is rejected, then removed', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'p02-report-selector-mutant-'))
    const root = join(temporary, 'src')
    const path = 'canvas/nodes/OptionNode.tsx'
    const copy = join(root, path)
    try {
      mkdirSync(dirname(copy), { recursive: true })
      copyFileSync(join(ROOT, path), copy)
      expect(() => assertReportSelectors(root)).not.toThrow()
      const before = readFileSync(copy, 'utf8')
      const line = before.split('\n').length + 1
      writeFileSync(copy, `${before}\nselectGoalProbability({ goal_probability: 0.45 })\n`)
      expect(unapprovedCalls(root)).toEqual([`src/${path}:${line}`])
      expect(() => assertReportSelectors(root)).toThrow(`src/${path}:${line}`)
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  })

  it('call detection ignores comments and strings but catches aliased calls', () => {
    const text = [
      '// selectGoalProbability(entry)',
      'const words = "selectGoalProbability(entry)"',
      'import { selectGoalProbability as chooseGoal } from "./selectGoalProbability"',
      'chooseGoal(entry)',
    ].join('\n')
    expect(perEntryCalls('control.ts', text)).toEqual([4])
  })
})
