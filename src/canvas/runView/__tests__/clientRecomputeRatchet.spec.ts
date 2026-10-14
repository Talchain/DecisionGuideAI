import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

const SRC = join(process.cwd(), 'src')
const RUN_VIEW = 'src/canvas/runView/runView.ts'
const PERSIST_WRITERS = new Set(['src/canvas/store.ts', 'src/canvas/stores/analysisSnapshotFactory.ts'])
const PERSIST_RESIDUAL = 'PERSIST: last-result / AnalysisSnapshot store a client copy of the licensed chance; goes to 0 when snapshots store (revision, Run id) and read S1 typed records'
const KNOWN_CALLER = 'src/canvas/conversation/askAi.ts'
const BASELINE_PATH = join(SRC, 'canvas/runView/__tests__/clientRecomputeRatchet.baseline.json')
const EXCLUDED_DIRS = new Set(['__tests__', '__fixtures__', 'fixtures'])

type Mode = 'call' | 'read' | 'both'
type Kind = 'call' | 'read' | 'def'
type RecomputeClass = 'CHANCE' | 'WITHHELD' | 'DRIVER' | 'STALENESS' | 'GOAL' | 'PROVENANCE' | 'PERSIST'
interface Rule { readonly class: RecomputeClass; readonly symbol: string; readonly mode: Mode }
interface Hit { readonly symbol: string; readonly kind: Kind; readonly start: number; readonly end: number }
interface Row {
  readonly class: RecomputeClass
  readonly symbol: string
  readonly file: string
  call: number
  read: number
  def: number
  readonly sanctioned: boolean
}
interface Baseline {
  readonly originStaging: string
  readonly sanctioned: readonly string[]
  readonly symbols: Readonly<Record<RecomputeClass, readonly string[]>>
  readonly residualClasses: { readonly PERSIST: string }
  readonly sites: readonly Row[]
}

// Seeded from the complete WS5 census (8 Oct). File-only census rows use the
// named resolver at that surface. Keep even dead symbols: their zero is a ban
// on resurrection. Definitions are inventoried separately, never in totals.
const CATALOGUE: Record<RecomputeClass, readonly [string, Mode][]> = {
  // A copy is counted as a residual read of authority, independently of the retired chooser.
  PERSIST: [['licensedChanceCopy', 'read']],
  CHANCE: [
    ['selectGoalProbability', 'call'], ['formatGoalProbability', 'call'],
    ['selectGoalLeader', 'call'], ['goalChanceHeroArmOpen', 'call'], ['goalChanceHeroSays', 'call'],
    ['goal_probability', 'read'], ['probability_of_goal', 'read'], ['probability_of_joint_goal', 'read'],
    ['pct_by_option', 'read'], ['option_probabilities', 'read'],
    ['readGoalChanceLicence', 'call'], ['readGoalChanceInvite', 'call'], ['fromOptionProbabilities', 'call'],
  ],
  WITHHELD: [
    ['deriveDecisionVerdict', 'call'], ['leaderDesignationPermitted', 'both'],
    ['licensesComparativeLeaderClaim', 'call'], ['analysisClaimPolicy', 'call'],
    ['figuresLicensed', 'call'], ['stabilityLicensed', 'call'], ['selectFlipRisk', 'call'],
    ['buildRunDeltaView', 'call'], ['winSharesWithheld', 'call'], ['winShareWithheldReason', 'call'],
    ['resolveLeaderKeys', 'call'],
  ],
  DRIVER: [
    ['rankFactor', 'call'], ['sensitivityLeader', 'call'], ['computeNormalisedInfluences', 'call'],
    ['detectDominantFactorLegacy', 'call'], ['normalizeElasticity', 'call'],
  ],
  STALENESS: [
    ['resolveDisplayedFreshness', 'call'], ['generateGraphHash', 'call'], ['composeAnalysisState', 'call'],
    ['useAnalysisResultsAreCurrent', 'call'], ['analysisResultsAreCurrentIn', 'call'], ['useRunCurrency', 'call'],
    ['hashEqualStaleReasonWords', 'call'], ['deriveCoachingCurrency', 'call'],
    ['resolveFreshnessNotice', 'call'], ['runTurnStaleReason', 'call'], ['isRunTurnCardCurrent', 'call'],
  ],
  GOAL: [
    ['getGoalDirection', 'call'], ['normaliseGoalThresholdForRequest', 'call'],
    ['resolveGoalThresholdCap', 'call'], ['resolveChipGoalThreshold', 'call'], ['resolveGoalTarget', 'call'],
    ['deriveGoalThresholdFromNode', 'call'], ['resolveDisplayableGoalTarget', 'call'],
  ],
  PROVENANCE: [
    ['classifyValueProvenance', 'call'], ['isAiSource', 'call'], ['resolveFactorValueSource', 'call'],
    ['factorValueSourceMark', 'call'], ['edgeProvenance', 'call'], ['driverValueProvenance', 'call'],
    ['nodeProvenanceClaim', 'call'], ['extractionType', 'read'],
  ],
}
const RULES: readonly Rule[] = Object.entries(CATALOGUE).flatMap(([className, symbols]) =>
  symbols.map(([symbol, mode]) => ({ class: className as RecomputeClass, symbol, mode })))
const RULE_BY_SYMBOL = new Map(RULES.map(rule => [rule.symbol, rule]))
const CLASSES = Object.keys(CATALOGUE) as RecomputeClass[]
const SYMBOLS = Object.fromEntries(CLASSES.map(className =>
  [className, CATALOGUE[className].map(([symbol]) => symbol)]))

function isProductionSource(file: string): boolean {
  const parts = file.split('/')
  return file.startsWith('src/') && !file.startsWith('src/test/') &&
    !parts.some(part => EXCLUDED_DIRS.has(part)) && file !== 'src/routes/HeroGallery.tsx' &&
    /\.(?:[cm]?[jt]sx?)$/.test(file) && !/\.(?:spec|test)\./.test(file) && !/\.d\.[cm]?ts$/.test(file)
}

function productionSources(): Map<string, string> {
  const sources = new Map<string, string>()
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name)
      const file = `src/${relative(SRC, full).split(sep).join('/')}`
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name) && file !== 'src/test') walk(full)
      } else if (isProductionSource(file)) {
        sources.set(file, readFileSync(full, 'utf8'))
      }
    }
  }
  walk(SRC)
  return sources
}

function nameOf(node: ts.Node | undefined): string | undefined {
  return node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : undefined
}

function unwrap(node: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) {
    node = node.expression
  }
  return node
}

/** AST scan, following optionChanceAuthority.sourceScan: no imports, types,
 * comments, string mentions or write-only property assignments count as reads.
 * Dot, optional, bracket and destructured reads do; a call is counted just once.
 */
function recomputeHits(source: string, file: string): Hit[] {
  const parsed = ts.createSourceFile(file, stripComments(source, file), ts.ScriptTarget.Latest, true,
    /\.[cm]?tsx$/.test(file) ? ts.ScriptKind.TSX : /\.[cm]?jsx?$/.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.TS)
  const aliases = new Map<string, string>()
  for (const statement of parsed.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)) {
      for (const binding of statement.importClause.namedBindings.elements) {
        aliases.set(binding.name.text, (binding.propertyName ?? binding.name).text)
      }
    }
  }
  const hits: Hit[] = []
  const add = (symbol: string | undefined, kind: Kind, node: ts.Node): void => {
    const rule = symbol === undefined ? undefined : RULE_BY_SYMBOL.get(symbol)
    if (rule && (kind === 'def' || rule.mode === 'both' || rule.mode === kind)) {
      hits.push({ symbol: rule.symbol, kind, start: node.getStart(parsed), end: node.end })
    }
  }
  const isCallTarget = (node: ts.Expression): boolean => {
    let parent: ts.Node = node.parent
    let target: ts.Node = node
    while (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) ||
      ts.isTypeAssertionExpression(parent) || ts.isNonNullExpression(parent) || ts.isSatisfiesExpression(parent)) {
      target = parent
      parent = parent.parent
    }
    return ts.isCallExpression(parent) && parent.expression === target
  }
  const isWriteOnly = (node: ts.Node): boolean => {
    let target = node
    while (ts.isParenthesizedExpression(target.parent)) target = target.parent
    return (ts.isBinaryExpression(target.parent) && target.parent.left === target &&
      target.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) || ts.isDeleteExpression(target.parent)
  }
  const visit = (node: ts.Node): void => {
    // These two stored goal fields remain client copies even after their chooser calls retire.
    // Count named/shorthand assignments, so a raw-value mutant remains a counted residual.
    if (PERSIST_WRITERS.has(file) &&
      (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && nameOf(node.name) === 'goalProbability') {
      add('licensedChanceCopy', 'read', node)
    }
    // Entire type/declaration/import/export subtrees contain no runtime reads.
    if (ts.isTypeNode(node) || ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression)
      const name = ts.isIdentifier(callee) ? aliases.get(callee.text) ?? callee.text :
        ts.isPropertyAccessExpression(callee) ? callee.name.text :
          ts.isElementAccessExpression(callee) ? nameOf(callee.argumentExpression) : undefined
      add(name, 'call', node)
    } else if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
      add(nameOf(node.name), 'def', node)
    } else if ((ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) &&
      node.initializer && (ts.isArrowFunction(unwrap(node.initializer)) || ts.isFunctionExpression(unwrap(node.initializer)))) {
      add(nameOf(node.name), 'def', node)
    } else if (ts.isPropertyAccessExpression(node)) {
      if (!isCallTarget(node) && !isWriteOnly(node)) add(node.name.text, 'read', node)
    } else if (ts.isElementAccessExpression(node)) {
      if (!isCallTarget(node) && !isWriteOnly(node)) add(nameOf(node.argumentExpression), 'read', node)
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      add(nameOf(node.propertyName ?? node.name), 'read', node)
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return hits
}

function rowKey(row: Pick<Row, 'class' | 'symbol' | 'file'>): string {
  return `${row.class}\t${row.symbol}\t${row.file}`
}

function census(sources: ReadonlyMap<string, string>): Row[] {
  const rows = new Map<string, Row>()
  for (const [file, source] of sources) {
    for (const hit of recomputeHits(source, file)) {
      const rule = RULE_BY_SYMBOL.get(hit.symbol)!
      const identity = { class: rule.class, symbol: hit.symbol, file }
      const key = rowKey(identity)
      const row = rows.get(key) ?? { ...identity, call: 0, read: 0, def: 0, sanctioned: file === RUN_VIEW }
      row[hit.kind]++
      rows.set(key, row)
    }
  }
  return [...rows.values()].sort((a, b) => rowKey(a).localeCompare(rowKey(b)))
}

function classTotals(rows: readonly Row[]): Record<RecomputeClass, number> {
  const totals = Object.fromEntries(CLASSES.map(className => [className, 0])) as Record<RecomputeClass, number>
  for (const row of rows) if (!row.sanctioned) totals[row.class] += row.call + row.read
  return totals
}

const NEW_SITE = 'net-new client recompute site — read RunView / the canonical view instead (WS5)'
function ratchetViolations(current: readonly Row[], baseline: readonly Row[]): string[] {
  const actual = new Map(current.map(row => [rowKey(row), row]))
  const expected = new Map(baseline.map(row => [rowKey(row), row]))
  const violations: string[] = []
  for (const key of [...new Set([...actual.keys(), ...expected.keys()])].sort()) {
    const now = actual.get(key)
    const before = expected.get(key)
    const identity = now ?? before!
    // RunView is the sanctioned owner; moving authority into it is permitted.
    if (identity.file === RUN_VIEW) continue
    for (const kind of ['call', 'read', 'def'] as const) {
      const count = now?.[kind] ?? 0
      const limit = before?.[kind] ?? 0
      if (count > limit) violations.push(`${NEW_SITE}: ${identity.symbol} in ${identity.file} (${kind}: ${limit} → ${count})`)
      if (count < limit) violations.push(`ratchet: lower the baseline to ${count} for ${identity.symbol} in ${identity.file} (a site was removed — lock the gain) [${kind}]`)
    }
  }
  return violations
}

function withAddedCall(sources: ReadonlyMap<string, string>): Map<string, string> {
  const copy = new Map(sources)
  copy.set(KNOWN_CALLER, `${copy.get(KNOWN_CALLER)!}\nselectGoalProbability(report, optionId);\n`)
  return copy
}

function withRemovedCall(sources: ReadonlyMap<string, string>): Map<string, string> {
  const copy = new Map(sources)
  const source = copy.get(KNOWN_CALLER)!
  const hit = recomputeHits(source, KNOWN_CALLER).find(hit => hit.symbol === 'selectGoalProbability' && hit.kind === 'call')!
  copy.set(KNOWN_CALLER, source.slice(0, hit.start) + 'undefined' + source.slice(hit.end))
  return copy
}

const SOURCES = productionSources()
const CURRENT = census(SOURCES)
const BASELINE = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline

describe('WS5 client recompute census ratchet', () => {
  it('CONTROL: includes production sources and excludes tests, fixtures, gallery and declarations', () => {
    expect(SOURCES.has(KNOWN_CALLER)).toBe(true)
    expect(SOURCES.has(RUN_VIEW)).toBe(true)
    for (const file of [
      'src/a/__tests__/helper.ts', 'src/a/example.spec.tsx', 'src/a/example.test.js',
      'src/test/guards/clientRecomputeRatchet.spec.ts', 'src/a/__fixtures__/sample.ts',
      'src/a/fixtures/sample.ts', 'src/routes/HeroGallery.tsx', 'src/a/types.d.ts',
    ]) expect(isProductionSource(file), file).toBe(false)
    expect(isProductionSource('src/a/production.tsx')).toBe(true)
  })

  it('CONTROL: the retired askAi call is zero and the real CHANCE total stays positive', () => {
    const row = CURRENT.find(row => row.symbol === 'selectGoalProbability' && row.file === KNOWN_CALLER)
    expect(row?.call ?? 0).toBe(0)
    expect(classTotals(CURRENT).CHANCE).toBeGreaterThan(0)
    console.info(`CONTROL: ${KNOWN_CALLER} selectGoalProbability call=${row?.call ?? 0}; CHANCE > 0`)
  })

  it('CONTROL: planted calls count, comments and string mentions do not; definitions are separate', () => {
    const hits = recomputeHits(`
      // selectGoalProbability(report, id)
      /* selectGoalProbability(report, id) */
      const mention = 'selectGoalProbability(report, id)'
      function selectGoalProbability(report: unknown, id: string) { return report }
      selectGoalProbability(report, id)
      const rankFactor = (rows: unknown) => rows
      const sensitivityLeader = function(rows: unknown) { return rows }
    `, 'control.ts')
    expect(hits.map(({ symbol, kind }) => [symbol, kind])).toEqual([
      ['selectGoalProbability', 'def'], ['selectGoalProbability', 'call'],
      ['rankFactor', 'def'], ['sensitivityLeader', 'def'],
    ])
    console.info('CONTROL: planted call=1; commented/string calls=0; definitions=3 (excluded from totals)')
  })

  it('CONTROL: recognises raw reads and aliased/optional calls without counting types or writes', () => {
    const hits = recomputeHits(`
      import { selectGoalProbability as pick } from './selector'
      interface Wire { goal_probability: number; leaderDesignationPermitted?: boolean }
      const wire: { pct_by_option: unknown } = { pct_by_option: {} }
      wire.goal_probability = 0.5
      delete wire.option_probabilities
      wire.goal_probability
      wire?.probability_of_goal
      wire['probability_of_joint_goal']
      const { pct_by_option: percentages, option_probabilities } = wire
      rec.leaderDesignationPermitted
      rec.leaderDesignationPermitted()
      pick(report, id);
      (api['selectGoalProbability'] as Function)?.(report, id)
    `, 'control.ts')
    expect(hits.map(({ symbol, kind }) => [symbol, kind])).toEqual([
      ['goal_probability', 'read'], ['probability_of_goal', 'read'], ['probability_of_joint_goal', 'read'],
      ['pct_by_option', 'read'], ['option_probabilities', 'read'], ['leaderDesignationPermitted', 'read'],
      ['leaderDesignationPermitted', 'call'], ['selectGoalProbability', 'call'], ['selectGoalProbability', 'call'],
    ])
  })

  it('CONTROL: RunView is inventoried as sanctioned and contributes zero to totals or violations', () => {
    const owner = census(new Map([[RUN_VIEW, 'selectGoalProbability(report, id); wire.pct_by_option']]))
    expect(owner.every(row => row.sanctioned)).toBe(true)
    expect(owner).toHaveLength(2)
    expect(classTotals(owner).CHANCE).toBe(0)
    expect(ratchetViolations(owner, [])).toEqual([])
  })

  it('CONTROL: baseline records the complete symbol catalogue, unique rows and sanctioned owner', () => {
    expect(BASELINE.originStaging).toMatch(/^[a-f0-9]{40}$/)
    expect(BASELINE.symbols).toEqual(SYMBOLS)
    expect(BASELINE.residualClasses.PERSIST).toBe(PERSIST_RESIDUAL)
    expect(BASELINE.sanctioned).toEqual([RUN_VIEW])
    expect(new Set(BASELINE.sites.map(rowKey)).size).toBe(BASELINE.sites.length)
    for (const row of BASELINE.sites) {
      expect(RULE_BY_SYMBOL.get(row.symbol)?.class).toBe(row.class)
      expect(row.sanctioned).toBe(row.file === RUN_VIEW)
      expect(isProductionSource(row.file)).toBe(true)
      expect(Object.keys(row).sort()).toEqual(['call', 'class', 'def', 'file', 'read', 'sanctioned', 'symbol'])
      for (const count of [row.call, row.read, row.def]) expect(Number.isInteger(count) && count >= 0).toBe(true)
    }
  })

  it('PERSIST residual: both stored chance copies stay counted until snapshots read S1 typed records', () => {
    const copies = CURRENT.filter(row => row.class === 'PERSIST')
    expect(copies.map(row => [row.file, row.read])).toEqual([...PERSIST_WRITERS].map(file => [file, 1]))
    expect(classTotals(CURRENT).PERSIST).toBe(2)
    console.info(`${PERSIST_RESIDUAL}; copies=2`)
    const file = 'src/canvas/store.ts'
    const additional = new Map(SOURCES)
    additional.set(file, `${additional.get(file)}\nconst planted = { goalProbability: chance.pct / 100 };`)
    expect(ratchetViolations(census(additional), BASELINE.sites)[0]).toContain('licensedChanceCopy')
    const rawMutant = new Map(SOURCES)
    rawMutant.set(file, rawMutant.get(file)!.replace("chance.kind === 'figure' ? chance.pct / 100 : null", 'prob.goal_probability'))
    expect(classTotals(census(rawMutant)).PERSIST).toBe(2)
    const removed = new Map(SOURCES)
    removed.set(file, removed.get(file)!.replace(/goalProbability: chance.kind === 'figure' \? chance.pct \/ 100 : null,/, ''))
    expect(ratchetViolations(census(removed), BASELINE.sites).join('\n')).toContain('lower the baseline to 0 for licensedChanceCopy')
  })

  it('S1 PR-2b: no production chooser calls remain; keep the unused definition', () => {
    const callers = CURRENT.filter(row => row.symbol === 'selectGoalProbability' && row.call > 0)
    expect(callers).toEqual([])
    expect(CURRENT.filter(row => row.symbol === 'selectGoalProbability' && row.def > 0)
      .map(row => [row.file, row.def])).toEqual([['src/components/results/utils/selectGoalProbability.ts', 1]])
    console.info('selectGoalProbability production calls=0; definitions=1 (retained); PERSIST copies=2')
  })

  it('MUTANT (a): an additional production call and a new caller file both fail', () => {
    const increased = ratchetViolations(census(withAddedCall(SOURCES)), BASELINE.sites)
    expect(increased).toHaveLength(1)
    expect(increased[0]).toContain(NEW_SITE)
    const newFile = new Map(SOURCES)
    newFile.set('src/plantedProduction.ts', 'selectGoalProbability(report, id)')
    expect(ratchetViolations(census(newFile), BASELINE.sites)).toEqual([
      `${NEW_SITE}: selectGoalProbability in src/plantedProduction.ts (call: 0 → 1)`,
    ])
    console.info(`MUTANT (a) RED captured: ${increased[0]}`)
  })

  it('MUTANT (b): removing a production call requires lowering the baseline, including to zero', () => {
    // The live caller is retired. Plant one to exercise removal against a one-call baseline.
    const planted = withAddedCall(SOURCES)
    const plantedBaseline = census(planted)
    const reduced = ratchetViolations(census(withRemovedCall(planted)), plantedBaseline)
    expect(reduced).toHaveLength(1)
    const original = plantedBaseline.find(row => row.symbol === 'selectGoalProbability' && row.file === KNOWN_CALLER)!
    expect(reduced[0]).toContain(`ratchet: lower the baseline to ${original.call - 1} for selectGoalProbability in ${KNOWN_CALLER}`)
    const singleton = census(new Map([['src/control.ts', 'selectGoalProbability(report, id)']]))
    expect(ratchetViolations([], singleton)[0]).toContain('ratchet: lower the baseline to 0')
    console.info(`MUTANT (b) RED captured: ${reduced[0]}`)
  })

  it('requires exact per-symbol/file counts: no additions and every removal locks the gain', () => {
    const totals = classTotals(CURRENT)
    console.info(`WS5 client recompute totals (calls + reads; excludes def and sanctioned RunView): ${CLASSES.map(name => `${name} ${totals[name]}`).join(', ')}`)
    expect(ratchetViolations(CURRENT, BASELINE.sites).join('\n')).toBe('')
  })
})
