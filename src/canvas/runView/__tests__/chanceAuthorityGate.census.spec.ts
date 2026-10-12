/**
 * ⭐⭐ #2747 RE-SCOPE (DL, after Codex round 2): THE CHANCE AUTHORITY GATE CENSUS.
 *
 * Every goal-chance number a surface shows passes ONE gate (`chanceFigureFromCanonical` / `RunView.chanceFigureOf`,
 * `runView.ts`): a figure only when CEE's matching canonical cell licenses it for a Run known to be current. Codex round 2
 * reproduced the failure this census closes: with the canonical view absent or for another Run, `chanceOf` still gave 46%,
 * and WinGauge said it while the option's own chance cell withheld.
 *
 * THE PRECISE CLAIM (a no-read claim over a named artefact, not a proof of correct wording): no production source under
 * `src/` (tests, fixtures and stories excluded) outside the ALLOWED files below READS a goal-chance number field, or
 * CALLS a raw goal-chance reader. Reads are property accesses, string-keyed element accesses and destructuring; type
 * declarations and object-literal keys (writes) are not reads.
 *
 * ⚠ A SCANNER, NOT A PROOF. It sees these names only. A number copied under another name and carried elsewhere is
 * outside what it can see; the mounted specs (`ResultsBody.batchCGoalChance.spec.tsx`, the chat card and Compare specs)
 * are the behaviour witnesses.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

/** Goal-chance NUMBER fields: the report's, the licence's (wire and parsed), a driver's, and the run delta's. */
const FIELDS = new Set([
  'goal_probability', 'probability_of_goal', 'probability_of_joint_goal',
  'pct_by_option', 'pctByOption', 'pct_if_side', 'pctIfSide', 'goal_chances', 'goalChances',
  // the producer's joint ("all your limits hold") figure, as `goalProbabilityDetails` publishes it
  'jointGoalProbability',
])
/** Raw readers: only the gate may call them. */
const CALLS = new Set(['readGoalChanceLicence', 'readGoalChanceRange', 'selectGoalProbability'])
const NEEDLES = [...FIELDS, ...CALLS]

/** The files that may read them, each with its reason. Nothing that renders is here. */
const ALLOWED: Readonly<Record<string, string>> = {
  'src/canvas/runView/runView.ts': 'THE GATE',
  'src/components/results/utils/goalChanceLicence.ts': 'the licence reader the gate calls (wire pct_by_option / pct_if_side → parsed record)',
  'src/canvas/ui/inspector-v2/useAnalysisResults.ts': 'presence predicate only (hasAnyRealProbability → boolean result presence for the run-state selector); no number leaves it',
  'src/canvas/state/storedGoalCertainty.ts': "CEE's goal-certainty record reader: the 0|1 endpoint only binds an attestation to the figure shown; never shown",
  'src/components/results/utils/selectGoalProbability.ts': 'the report-field reader (goalProbabilityDetails); it publishes the joint figure only as jointGoalProbability (held below) and jointGoalPresent',
  'src/canvas/stores/analysisSnapshotFactory.ts': 'snapshot writer: stores the joint figure; snapshot chance fields have no production display reader',
  'src/v5/mapV5AnalysisToReport.ts': 'wire → report mapper (no display)',
  'src/lib/mappers/mapOptionComparison.ts': 'wire → report mapper (no display)',
  'src/adapters/plot/v2/responseMapper.ts': 'wire → report mapper (no display)',
  'src/components/results/analysisNew/runDeltaView.ts': 'wire run_delta → view mapper (no display); Compare reads it only through the gate',
  'src/components/results/analysis-hero/goalChanceCopy.ts': 'words a driver line from the driver it is handed; the hero hands it only RunView.mainDriverOf (gated) drivers',
}

export interface CensusHit { readonly file: string; readonly line: number; readonly symbol: string; readonly kind: 'read' | 'call' }

const isTypePosition = (node: ts.Node): boolean => {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isTypeNode(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p)) return true
    if (ts.isStatement(p) || ts.isExpressionStatement(p)) return false
  }
  return false
}

/** The census over one source. Exported shape for the controls below. */
export function scanSource(file: string, text: string): CensusHit[] {
  if (!NEEDLES.some(n => text.includes(n))) return []
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const hits: CensusHit[] = []
  const at = (node: ts.Node, symbol: string, kind: CensusHit['kind']) =>
    hits.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, symbol, kind })
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && FIELDS.has(node.name.text) && !isTypePosition(node)) at(node, node.name.text, 'read')
    else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && FIELDS.has(node.argumentExpression.text)) {
      at(node, node.argumentExpression.text, 'read')
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const key = node.propertyName ?? node.name
      if ((ts.isIdentifier(key) || ts.isStringLiteralLike(key)) && FIELDS.has(key.text)) at(node, key.text, 'read')
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && CALLS.has(node.expression.text)) {
      at(node, node.expression.text, 'call')
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

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
const rel = (full: string) => relative(process.cwd(), full).split(sep).join('/')

let cache: CensusHit[] | null = null
function census(): CensusHit[] {
  cache ??= productionFiles(SRC).flatMap(full => scanSource(rel(full), readFileSync(full, 'utf8')))
  return cache
}

describe('⭐ the chance authority gate: no goal-chance number is read for display outside it', () => {
  it('CONTROL: the scanner sees a read, a keyed read, a destructure and a raw call; not a type or a literal key', () => {
    const hits = scanSource('src/components/results/Mutant.tsx', [
      "const a = licence.pctByOption[id]",
      "const b = row['probability_of_goal']",
      "const { goal_probability } = entry",
      "const c = readGoalChanceLicence(warnings)",
      "interface T { goal_probability?: number }",
      "const d = { pct_by_option: {} }",
    ].join('\n'))
    expect(hits.map(h => `${h.line}:${h.symbol}:${h.kind}`)).toEqual([
      '1:pctByOption:read', '2:probability_of_goal:read', '3:goal_probability:read', '4:readGoalChanceLicence:call',
    ])
  })

  it('CONTROL (magnitude): the gate itself is seen, so the probe is not blind', () => {
    const gate = census().filter(h => h.file === 'src/canvas/runView/runView.ts')
    expect(gate.some(h => h.symbol === 'readGoalChanceLicence' && h.kind === 'call')).toBe(true)
    expect(gate.some(h => h.symbol === 'pctByOption')).toBe(true)
  })

  it('⭐ no file outside the gate, its readers and the wire mappers reads a goal-chance number', () => {
    const outside = census().filter(h => !(h.file in ALLOWED)).map(h => `${h.file}:${h.line} ${h.symbol} (${h.kind})`)
    expect(outside, `goal-chance numbers read outside the gate:\n  ${outside.join('\n  ')}`).toEqual([])
  })

  it('⭐ the raw readers are called by the gate only', () => {
    const calls = census().filter(h => h.kind === 'call' && h.file !== 'src/canvas/runView/runView.ts').map(h => `${h.file}:${h.line} ${h.symbol}`)
    expect(calls).toEqual([])
  })

  it('every ALLOWED entry is still needed (a stale entry would widen what passes)', () => {
    const seen = new Set(census().map(h => h.file))
    expect(Object.keys(ALLOWED).filter(f => !seen.has(f))).toEqual([])
  })
})
