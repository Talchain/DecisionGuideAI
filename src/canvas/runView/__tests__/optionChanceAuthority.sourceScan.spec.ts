import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

const SRC = join(process.cwd(), 'src')
const RUN_VIEW = 'canvas/runView/runView.ts'
const OPTION_CARD_FILES = [
  'canvas/nodes/OptionNode.tsx',
  'canvas/nodes/shared/lodMetricLine.ts',
] as const
const OUTCOME_PANEL = 'canvas/ui/inspector-v2/panels/OutcomePanel.tsx'
const CHANCE_SELECTOR_CONTROL = 'canvas/conversation/askAi.ts'
const EXCLUDED_DIRS = new Set(['__tests__', '__fixtures__', '__mocks__', 'fixtures', 'tests', 'test', 'node_modules'])

function productionSources(): Map<string, string> {
  const sources = new Map<string, string>()
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(full)
      } else if (/\.(?:tsx?|[cm]?jsx?)$/.test(entry.name) && !/\.(?:spec|test)\./.test(entry.name)) {
        sources.set(relative(SRC, full).split(sep).join('/'), stripComments(readFileSync(full, 'utf8'), entry.name))
      }
    }
  }
  walk(SRC)
  return sources
}

type AuthorityRule = 'readGoalChanceLicence' | 'goalChanceOptionLines' | 'pct_by_option' | 'withheldOptionIds'
interface AuthorityHit { readonly rule: AuthorityRule; readonly line: number }
const CALLS = new Set<AuthorityRule>(['readGoalChanceLicence', 'goalChanceOptionLines'])
const FIELDS = new Set<AuthorityRule>(['pct_by_option', 'withheldOptionIds'])

/** Parse the comment-stripped source so function declarations and field types are not mistaken for readers. */
function authorityHits(source: string, file: string): AuthorityHit[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.TS)
  const hits: AuthorityHit[] = []
  const add = (name: string | undefined, rules: ReadonlySet<AuthorityRule>, node: ts.Node): void => {
    if (name !== undefined && rules.has(name as AuthorityRule)) {
      hits.push({ rule: name as AuthorityRule, line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1 })
    }
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      add(ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined,
        CALLS, node)
    } else if (ts.isPropertyAccessExpression(node)) {
      add(node.name.text, FIELDS, node)
    } else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      add(node.argumentExpression.text, FIELDS, node)
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const name = node.propertyName ?? node.name
      add(ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined, FIELDS, node)
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return hits
}

/** These are shared parser/formatter internals, not independent surface chance authorities. */
const ALLOWED_INTERNAL_READS: Readonly<Record<string, Readonly<Partial<Record<AuthorityRule, string>>>>> = {
  'components/results/utils/goalChanceLicence.ts': {
    pct_by_option: 'The existing wire parser validates CEE licence fields; RunView is its sole production caller.',
  },
  'components/results/analysis-hero/goalChanceCopy.ts': {
    withheldOptionIds: 'The existing shared sentence formatter preserves CEE withholding words; RunView owns its display resolution.',
  },
}

const SOURCES = productionSources()
const SHARE_CALL = /\bOPTION_RESULT_COPY\s*\.\s*share\s*\(/
const SHARE_PART = /\b(?:sharePrefix|shareUnit)\b/
const CARD_CHANCE_DERIVATION = /\b(?:selectGoalProbability|formatGoalProbability|option_probabilities)\b/
const GOAL_PROBABILITY_CALL = /\bselectGoalProbability\s*\(/

describe('the RunView is the option chance display authority', () => {
  it('CONTROL: scans production RunView and sees its actual licence read', () => {
    expect(SOURCES.has(RUN_VIEW)).toBe(true)
    expect(authorityHits(SOURCES.get(RUN_VIEW)!, RUN_VIEW).map(hit => hit.rule)).toContain('readGoalChanceLicence')
  })

  it('CONTROL: ignores comments and declarations, while finding calls and raw field reads', () => {
    const file = 'control.ts'
    const source = stripComments(`
      // readGoalChanceLicence(warnings); source.pct_by_option
      /* goalChanceOptionLines(licence, labels); licence.withheldOptionIds */
      function readGoalChanceLicence(warnings: unknown) { return warnings }
      readGoalChanceLicence(warnings)
      goalChanceOptionLines(licence, labels)
      source.pct_by_option
      licence['withheldOptionIds']
      const { withheldOptionIds: withheld } = licence
    `, file)
    expect(authorityHits(source, file).map(hit => hit.rule)).toEqual([
      'readGoalChanceLicence', 'goalChanceOptionLines', 'pct_by_option', 'withheldOptionIds', 'withheldOptionIds',
    ])
  })

  it('has no surface licence reader, chance-line resolver, or raw chance/withholding reader outside RunView', () => {
    const offenders = [...SOURCES.entries()].flatMap(([file, source]) => {
      if (file === RUN_VIEW) return []
      return authorityHits(source, file)
        .filter(hit => ALLOWED_INTERNAL_READS[file]?.[hit.rule] === undefined)
        .map(hit => `${file}:${hit.line} ${hit.rule}`)
    }).sort()
    expect(offenders, 'Surface readers must use RunView; parser/formatter exceptions each state their reason above.').toEqual([])
  })
})

describe('option card headlines never use the supporting share of runs', () => {
  it('CONTROL: sees the existing share call in OutcomePanel.tsx', () => {
    expect(SOURCES.has(OUTCOME_PANEL)).toBe(true)
    expect(SOURCES.get(OUTCOME_PANEL)).toMatch(SHARE_CALL)
  })

  it.each(OPTION_CARD_FILES)('%s has no share headline call or sharePrefix/shareUnit render', file => {
    expect(SOURCES.has(file)).toBe(true)
    const source = SOURCES.get(file)!
    const patterns = [SHARE_CALL, SHARE_PART]
    const offenders = patterns.flatMap(pattern => [...source.matchAll(new RegExp(pattern.source, 'g'))]
      .map(match => `${file}:${source.slice(0, match.index).split('\n').length} ${match[0]}`))
    expect(offenders).toEqual([])
  })
})

describe('option cards never derive a second chance figure', () => {
  it('CONTROL: sees the existing selectGoalProbability call in askAi.ts', () => {
    expect(SOURCES.has(CHANCE_SELECTOR_CONTROL)).toBe(true)
    expect(SOURCES.get(CHANCE_SELECTOR_CONTROL)).toMatch(GOAL_PROBABILITY_CALL)
  })

  it.each(OPTION_CARD_FILES)('%s has no client chance selector, formatter, or option_probabilities reference', file => {
    expect(SOURCES.has(file)).toBe(true)
    const source = SOURCES.get(file)!
    const offenders = [...source.matchAll(new RegExp(CARD_CHANCE_DERIVATION.source, 'g'))]
      .map(match => `${file}:${source.slice(0, match.index).split('\n').length} ${match[0]}`)
    expect(offenders, 'Option cards must read the Results chance cell and caveats through the canvas provider.').toEqual([])
  })
})

const CLIENT_CELL_WORDS = /\b(?:OPTION_CHANCE_WITHHELD|RUN_AGAIN_FOR_CHANCE|licensedOptionChanceLines|goalChanceOptionLines)\b/g
function clientCellWordHits(source: string): string[] {
  const parsed = ts.createSourceFile('runView.ts', stripComments(source, 'runView.ts'), ts.ScriptTarget.Latest, true)
  const hits: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && /ChanceCell/.test(node.name?.text ?? '') && node.body) {
      hits.push(...[...node.body.getText(parsed).matchAll(CLIENT_CELL_WORDS)].map(hit => hit[0]))
    } else if (ts.isPropertyAssignment(node) && node.name.getText(parsed) === 'chanceCellOf') {
      hits.push(...[...node.initializer.getText(parsed).matchAll(CLIENT_CELL_WORDS)].map(hit => hit[0]))
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return hits
}
describe('S1 canonical cell words have no client fallback', () => {
  it('CONTROL: catches a composer and both constants in cell functions, ignoring comments', () => {
    expect(clientCellWordHits(`
      function optionChanceCell() {
        // goalChanceOptionLines(licence, labelOf)
        return licensedOptionChanceLines(licence, labels) ?? OPTION_CHANCE_WITHHELD ?? RUN_AGAIN_FOR_CHANCE
      }
      const view = { chanceCellOf: () => goalChanceOptionLines(licence, labels) }
    `)).toEqual(['licensedOptionChanceLines', 'OPTION_CHANCE_WITHHELD', 'RUN_AGAIN_FOR_CHANCE', 'goalChanceOptionLines'])
  })
  it('RunView cell functions never reference client chance words or licence-line composers', () => {
    expect(clientCellWordHits(SOURCES.get(RUN_VIEW)!)).toEqual([])
  })
})
