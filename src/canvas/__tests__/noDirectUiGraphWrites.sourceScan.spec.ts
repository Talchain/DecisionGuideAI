/** Whole-src graph writer census. AST nodes exclude prose and quoted code. */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'
import { GRAPH_WRITE_REGISTRY, type GraphWriteRegistryEntry } from '../mutations/graphWriteRegistry'
import { CANONICAL_EDIT_AUTHORITY } from '../mutations/mutationAuthority'

const root = resolve(__dirname, '../../..')
const graphMutators = new Set([
  'updateNode', 'updateEdge', 'updateNodeData', 'updateEdgeData', 'addNode', 'addEdge',
  'addNodeWithEdge', 'updateNodeLabel', 'batchUpdateNodes', 'deleteNode', 'deleteEdge',
  'deleteSelected', 'deleteNodeById', 'deleteEdgeById', 'updateEdgeEndpoints',
  'completeReconnect', 'duplicateSelected', 'pasteClipboard', 'cutSelected',
  'nudgeSelected', 'importCanvas', 'resetCanvas', 'loadScenario', 'adoptScenario',
  'hydrateGraphSlice', 'applyAutoFixChanges', 'applyRepair', 'applyClarifierGraph',
  'undoDraft', 'setGoalThresholdAndUpdateNode', 'onNodesChange', 'onEdgesChange',
  'applyStructuralAddRevert', 'applyStructuralRenameRevert', 'applyStructuralDeleteRevert',
  'applySimpleLayout', 'applyGuidedLayout', 'setNodes', 'setEdges', 'setIntervention',
])
const isMutator = (name: string) => graphMutators.has(name) || /^applyLayout\w*$/.test(name)
type WriteSite = { file: string; line: number; mutator: string; kind: 'access' | 'call' | 'raw' }

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name)
    if (entry.isDirectory()) return /^(?:__tests__|test|tests)$/.test(entry.name) ? [] : sourceFiles(file)
    return /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.(?:spec|test)\./.test(entry.name) ? [file] : []
  })
}

/** Captures selector/property access as well as calls through destructured aliases. */
function scanSource(file: string, source: string): WriteSite[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const storeNames = new Set(['useCanvasStore'])
  const storeBindings = new Set<string>()
  const selectedMutators = new Map<string, string>()
  const declarations = new Map<string, ts.Expression>()
  const sites = new Map<string, WriteSite>()
  const add = (node: ts.Node, mutator: string, kind: WriteSite['kind']) => {
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
    sites.set(`${node.pos}:${mutator}`, { file, line, mutator, kind })
  }
  const visitAll = (node: ts.Node, visit: (child: ts.Node) => void) => { visit(node); ts.forEachChild(node, child => visitAll(child, visit)) }
  // Imports may rename the hook. Store-shaped applicators/revert helpers accept
  // the store as a parameter; their graph mutator calls belong to the census too.
  visitAll(ast, node => {
    if (ts.isImportSpecifier(node) && (node.propertyName?.text ?? node.name.text) === 'useCanvasStore') storeNames.add(node.name.text)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.set(node.name.text, node.initializer)
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.type) {
      if (/(?:Store|CanvasState|CanvasStore)/.test(node.type.getText(ast))) storeBindings.add(node.name.text)
      if (isMutator(node.name.text) && ts.isFunctionTypeNode(node.type)) selectedMutators.set(node.name.text, node.name.text)
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && storeNames.has(node.expression.text)) {
      const selector = node.arguments[0]
      if (selector && (ts.isArrowFunction(selector) || ts.isFunctionExpression(selector)) && selector.parameters[0] && ts.isIdentifier(selector.parameters[0].name)) storeBindings.add(selector.parameters[0].name.text)
    }
  })
  const isStore = (node: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) return isStore(node.expression)
    if (ts.isIdentifier(node)) return storeNames.has(node.text) || storeBindings.has(node.text)
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && storeNames.has(node.expression.text)) return true
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'getState') return isStore(node.expression.expression)
    }
    return false
  }
  // Fixed point handles aliases assigned after another alias, regardless of
  // declaration order. Selecting the whole state also gives a store binding.
  for (let pass = 0; pass < 4; pass++) visitAll(ast, node => {
    if (!ts.isVariableDeclaration(node) || !node.initializer) return
    if (ts.isIdentifier(node.name) && isStore(node.initializer)) storeBindings.add(node.name.text)
    if (ts.isObjectBindingPattern(node.name) && isStore(node.initializer)) for (const element of node.name.elements) {
      const name = element.propertyName?.getText(ast) ?? element.name.getText(ast)
      if (isMutator(name)) { add(element, name, 'access'); if (ts.isIdentifier(element.name)) selectedMutators.set(element.name.text, name) }
    }
    if (ts.isIdentifier(node.name) && ts.isPropertyAccessExpression(node.initializer) && isStore(node.initializer.expression) && isMutator(node.initializer.name.text)) selectedMutators.set(node.name.text, node.initializer.name.text)
    if (!ts.isCallExpression(node.initializer) || !ts.isIdentifier(node.initializer.expression) || !storeNames.has(node.initializer.expression.text)) return
    const selector = node.initializer.arguments[0]
    if (!selector || !(ts.isArrowFunction(selector) || ts.isFunctionExpression(selector))) return
    const parameter = selector.parameters[0]?.name
    if (!parameter || !ts.isIdentifier(parameter)) return
    storeBindings.add(parameter.text)
    if (ts.isIdentifier(selector.body) && selector.body.text === parameter.text && ts.isIdentifier(node.name)) storeBindings.add(node.name.text)
    if (ts.isPropertyAccessExpression(selector.body) && isMutator(selector.body.name.text) && ts.isIdentifier(node.name)) selectedMutators.set(node.name.text, selector.body.name.text)
    if (ts.isObjectBindingPattern(node.name) && ts.isParenthesizedExpression(selector.body) && ts.isObjectLiteralExpression(selector.body.expression)) {
      for (const property of selector.body.expression.properties) if (ts.isPropertyAssignment(property) && ts.isPropertyAccessExpression(property.initializer) && isMutator(property.initializer.name.text)) {
        const binding = node.name.elements.find(element => (element.propertyName?.getText(ast) ?? element.name.getText(ast)) === property.name.getText(ast))
        if (binding && ts.isIdentifier(binding.name)) selectedMutators.set(binding.name.text, property.initializer.name.text)
      }
    }
  })
  const graphKeys = (node: ts.Node, seen = new Set<string>()): Set<string> => {
    const keys = new Set<string>()
    const merge = (child: ts.Node) => { for (const key of graphKeys(child, new Set(seen))) keys.add(key) }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) merge(node.expression)
    else if (ts.isObjectLiteralExpression(node)) for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) merge(property.expression)
      else if (/^(nodes|edges)$/.test(property.name.getText(ast).replace(/['"]/g, ''))) keys.add(property.name.getText(ast).replace(/['"]/g, ''))
    }
    else if (ts.isIdentifier(node) && declarations.has(node.text) && !seen.has(node.text)) {
      seen.add(node.text)
      merge(declarations.get(node.text)!)
    }
    else if (ts.isConditionalExpression(node)) { merge(node.whenTrue); merge(node.whenFalse) }
    else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      if (!ts.isBlock(node.body)) merge(node.body)
      else {
        const returns = (child: ts.Node) => {
          if (ts.isReturnStatement(child) && child.expression) merge(child.expression)
          else if (!ts.isFunctionLike(child)) ts.forEachChild(child, returns)
        }
        ts.forEachChild(node.body, returns)
      }
    }
    return keys
  }
  visitAll(ast, node => {
    if (ts.isPropertyAccessExpression(node) && isStore(node.expression) && isMutator(node.name.text)) add(node, node.name.text, 'access')
    if (!ts.isCallExpression(node)) return
    if (ts.isIdentifier(node.expression) && selectedMutators.has(node.expression.text)) add(node, selectedMutators.get(node.expression.text)!, 'call')
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'setState' && isStore(node.expression.expression)) {
      for (const argument of node.arguments) for (const key of graphKeys(argument)) add(node, `setState.${key}`, 'raw')
    }
  })
  return [...sites.values()]
}

function unregistered(sites: WriteSite[], registry: GraphWriteRegistryEntry[] = GRAPH_WRITE_REGISTRY): WriteSite[] {
  return sites.filter(site => !registry.some(entry => entry.file === site.file && entry.mutators.includes(site.mutator)))
}
const sources = new Map(sourceFiles(resolve(root, 'src')).map(file => [relative(root, file), readFileSync(file, 'utf8')]))
const sites = [...sources].flatMap(([file, source]) => scanSource(file, source))

// Addenda 1 and 3 pin the existing debt keys and scanner record counts.
// Remove keys with their source writers and registration; lower counts as
// records disappear. Never add a key or increase its frozen count.
type FrozenUnresolvedWriter = Readonly<{ key: string; records: number }>
const FROZEN_UNRESOLVED_WRITERS = Object.freeze([
  { key: 'src/canvas/ReactFlowGraph.tsx|addEdge', records: 2 },
  { key: 'src/canvas/ReactFlowGraph.tsx|applyRepair', records: 2 },
  { key: 'src/canvas/components/DraftChat.tsx|resetCanvas', records: 2 },
  { key: 'src/canvas/components/ImportExportDialog.tsx|importCanvas', records: 2 },
  { key: 'src/canvas/components/ScenarioSwitcher.tsx|loadScenario', records: 3 },
  { key: 'src/canvas/components/SnapshotManager.tsx|importCanvas', records: 2 },
  { key: 'src/canvas/components/StarterProvenanceBanner.tsx|resetCanvas', records: 1 },
  { key: 'src/canvas/components/StarterProvenanceBanner.tsx|undoDraft', records: 1 },
  { key: 'src/canvas/conversation/useConversation.ts|resetCanvas', records: 1 },
  { key: 'src/canvas/conversation/useConversation.ts|undoDraft', records: 1 },
  { key: 'src/canvas/hooks/useConnectGesture.ts|addEdge', records: 1 },
  { key: 'src/canvas/mutations/commitGraphMutation.ts|setState.nodes', records: 1 },
  { key: 'src/canvas/mutations/commitGraphMutation.ts|setState.edges', records: 1 },
  { key: 'src/canvas/mutations/commitValidatedMutation.ts|setState.nodes', records: 1 },
  { key: 'src/canvas/mutations/commitValidatedMutation.ts|setState.edges', records: 1 },
  { key: 'src/canvas/ui/inspector-v2/panels/EdgePanel.tsx|updateEdgeData', records: 1 },
  { key: 'src/canvas/ui/inspector-v2/useInspectorMutations.ts|updateNode', records: 2 },
  { key: 'src/canvas/ui/inspector-v2/useInspectorMutations.ts|updateEdge', records: 2 },
  { key: 'src/components/layout/KebabMenu.tsx|resetCanvas', records: 2 },
].map(writer => Object.freeze(writer)))

function unresolvedDebtErrors(
  sourceSites: WriteSite[],
  registry: GraphWriteRegistryEntry[] = GRAPH_WRITE_REGISTRY,
  frozen: readonly FrozenUnresolvedWriter[] = FROZEN_UNRESOLVED_WRITERS,
): string[] {
  const pinned = new Set(frozen.map(writer => writer.key))
  const recordCounts = new Map<string, number>()
  for (const site of sourceSites) {
    const key = `${site.file}|${site.mutator}`
    recordCounts.set(key, (recordCounts.get(key) ?? 0) + 1)
  }
  const writers = new Set(recordCounts.keys())
  const debt = new Set(registry.filter(entry => entry.class === 'known_unresolved')
    .flatMap(entry => entry.mutators.map(mutator => `${entry.file}|${mutator}`)))
  const errors: string[] = []
  for (const key of debt) {
    if (!pinned.has(key)) errors.push(`${key}: new unresolved writer: route it through the transaction or register it with a revert/gate`)
  }
  for (const key of pinned) {
    if (!writers.has(key)) errors.push(`${key}: writer is gone from source; remove it from the frozen list and registry`)
    else if (!debt.has(key)) errors.push(`${key}: debt removed from the list but the writer remains`)
  }
  for (const { key, records } of frozen) {
    const live = recordCounts.get(key) ?? 0
    // A vanished key already fails (f), requiring removal rather than a zero pin.
    if (live === 0) continue
    if (live > records) errors.push(`${key}: new call to a writer under named debt: route it, or add a revert/gate (${live} records; frozen ${records})`)
    else if (live < records) errors.push(`${key}: writer record count fell; lower the frozen count (${live} records; frozen ${records})`)
  }
  return errors
}

function importedSource(file: string, seen = new Set<string>()): string {
  if (seen.has(file)) return ''
  seen.add(file)
  const source = sources.get(file) ?? ''
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  let combined = source
  ast.forEachChild(node => {
    if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return
    const specifier = node.moduleSpecifier.text
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return
    const base = specifier.startsWith('@/') ? resolve(root, 'src', specifier.slice(2)) : resolve(root, dirname(file), specifier)
    const target = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(suffix => base + suffix).find(candidate => existsSync(candidate) && sources.has(relative(root, candidate)))
    if (target) combined += '\n' + importedSource(relative(root, target), seen)
  })
  return combined
}

describe('every UI graph writer is registered, reversible and guarded', () => {
  it('(a) rejects every unregistered file/mutator across src', () => {
    const gaps = unregistered(sites).map(site => `${site.file}:${site.line} ${site.mutator} (${site.kind})`)
    expect(gaps, gaps.join('\n')).toEqual([])
  })
  it('(b) every optimistic registration reaches its named revert through imports', () => {
    const gaps = GRAPH_WRITE_REGISTRY.filter(entry => entry.class === 'optimistic' && (!entry.revert || !new RegExp(`\\b${entry.revert}\\b`).test(importedSource(entry.file))))
    expect(gaps.map(entry => `${entry.file}: missing revert ${entry.revert ?? '(unnamed)'}`)).toEqual([])
  })
  it('(b) prior_range_edit names a refusal revert at its sender', () => {
    const source = sources.get('src/canvas/ui/inspector-v2/useInspectorMutations.ts') ?? ''
    expect(source, 'prior_range_edit gap: the sender must restore the captured prior on refusal/not-sent').toMatch(/\brevertOptimisticPriorRangeEdit\s*\(/)
  })
  it('(c) gated registrations keep their named authority disabled', () => {
    const gaps = GRAPH_WRITE_REGISTRY.filter(entry => entry.class === 'gated_off').flatMap(entry => {
      if (entry.gate === 'no_live_importer') return []
      const key = entry.gate?.replace(/^CANONICAL_EDIT_AUTHORITY\./, '')
      return key && Object.prototype.hasOwnProperty.call(CANONICAL_EDIT_AUTHORITY, key) && CANONICAL_EDIT_AUTHORITY[key as keyof typeof CANONICAL_EDIT_AUTHORITY] === 'disabled' ? [] : [`${entry.file}: ${entry.gate ?? '(unnamed gate)'} is not disabled`]
    })
    expect(gaps, gaps.join('\n')).toEqual([])
  })
  it('(d) a planted caller is refused and its listed reply-apply contrast passes', () => {
    const mutant = 'useCanvasStore.getState().updateNode("node", { data: {} })'
    expect(unregistered(scanSource('src/planted/UnregisteredWriter.tsx', mutant))).toHaveLength(1)
    const listed = GRAPH_WRITE_REGISTRY.find(entry => entry.class === 'reply_apply' && entry.mutators.includes('updateNode'))!
    expect(scanSource(listed.file, mutant)).toHaveLength(1)
    expect(unregistered(scanSource(listed.file, mutant))).toEqual([])
  })
  it('(d) selectors, renamed destructures and raw state writes remain detectable', () => {
    const fixture = `const edit = useCanvasStore(s => s.updateEdge); edit('e', {});
      const { updateNode: rename } = useCanvasStore.getState(); rename('n', {});
      useCanvasStore.setState(s => ({ nodes: s.nodes, edges: [] }));`
    const found = scanSource('src/planted/AliasedWriter.tsx', fixture)
    expect(new Set(found.map(site => site.mutator))).toEqual(new Set(['updateEdge', 'updateNode', 'setState.nodes', 'setState.edges']))
    expect(unregistered(found)).toHaveLength(found.length)
    expect(found.filter(site => site.kind === 'call')).toHaveLength(2)
    expect(scanSource('src/planted/Metadata.ts', 'useCanvasStore.setState({ runMeta: { nodes: [] } })')).toEqual([])
  })
  it('(e) contrast census sees at least forty graph mutation sites', () => {
    expect(sites.length, `probe found only ${sites.length} sites`).toBeGreaterThanOrEqual(40)
  })
  it('(f)/(f2) known unresolved keys and record counts may only shrink with their source and frozen list', () => {
    const gaps = unresolvedDebtErrors(sites)
    expect(gaps, gaps.join('\n')).toEqual([])
  })
  it('(f) a planted unresolved addition fails and the unchanged frozen list passes', () => {
    const existing: GraphWriteRegistryEntry = {
      file: 'src/planted/ExistingDebt.tsx', mutators: ['updateNode'], class: 'known_unresolved',
      reason: 'Fixture writer', owner: 'EDIT-UX mutation transaction', reopen: 'slice-ii-local-fallback',
    }
    const frozen = Object.freeze([{ key: `${existing.file}|updateNode`, records: 1 }])
    const fixture = 'useCanvasStore.getState().updateNode("node", { data: {} })'
    const existingSites = scanSource(existing.file, fixture)
    expect(unresolvedDebtErrors(existingSites, [existing], frozen)).toEqual([])

    const planted: GraphWriteRegistryEntry = { ...existing, file: 'src/planted/NewDebt.tsx' }
    expect(unresolvedDebtErrors([...existingSites, ...scanSource(planted.file, fixture)], [existing, planted], frozen))
      .toEqual([`${planted.file}|updateNode: new unresolved writer: route it through the transaction or register it with a revert/gate`])
  })
  it('(f) removing debt while its writer remains fails even if reclassified', () => {
    const file = 'src/planted/RemainingDebt.tsx'
    const writer = scanSource(file, 'useCanvasStore.getState().updateNode("node", {})')
    const frozen = Object.freeze([{ key: `${file}|updateNode`, records: 1 }])
    const error = [`${file}|updateNode: debt removed from the list but the writer remains`]
    expect(unresolvedDebtErrors(writer, [], frozen)).toEqual(error)
    expect(unresolvedDebtErrors(writer, [{ file, mutators: ['updateNode'], class: 'reply_apply' }], frozen)).toEqual(error)
  })
  it('(f) a vanished writer forces the frozen list down; a completed shrink passes', () => {
    const frozen = Object.freeze([{ key: 'src/planted/RemovedDebt.tsx|updateNode', records: 1 }])
    expect(unresolvedDebtErrors([], [], frozen))
      .toEqual([`${frozen[0].key}: writer is gone from source; remove it from the frozen list and registry`])
    expect(unresolvedDebtErrors([], [], Object.freeze([]))).toEqual([])
  })
  it("(f2) an extra updateEdge call under named debt fails and today's counts pass", () => {
    const file = 'src/canvas/ui/inspector-v2/useInspectorMutations.ts'
    const existing: GraphWriteRegistryEntry = {
      file, mutators: ['updateEdge'], class: 'known_unresolved',
      reason: 'Fixture writer', owner: 'EDIT-UX mutation transaction', reopen: 'slider-slice',
    }
    const frozen = Object.freeze([{ key: `${file}|updateEdge`, records: 2 }])
    const fixture = "const updateEdge = useCanvasStore(s => s.updateEdge); updateEdge('edge', {});"
    const current = scanSource(file, fixture)
    expect(current).toHaveLength(2)
    expect(unresolvedDebtErrors(current, [existing], frozen)).toEqual([])

    const planted = scanSource(file, fixture + "\nupdateEdge('planted', {});")
    expect(planted).toHaveLength(3)
    expect(planted.filter(site => site.kind === 'call')).toHaveLength(2)
    expect(unresolvedDebtErrors(planted, [existing], frozen))
      .toEqual([`${file}|updateEdge: new call to a writer under named debt: route it, or add a revert/gate (3 records; frozen 2)`])
  })
  it('(f2) a reduced record count fails until its frozen count is lowered', () => {
    const file = 'src/canvas/ui/inspector-v2/useInspectorMutations.ts'
    const existing: GraphWriteRegistryEntry = {
      file, mutators: ['updateEdge'], class: 'known_unresolved',
      reason: 'Fixture writer', owner: 'EDIT-UX mutation transaction', reopen: 'slider-slice',
    }
    const current = scanSource(file, 'const updateEdge = useCanvasStore(s => s.updateEdge);')
    expect(current).toHaveLength(1)
    expect(unresolvedDebtErrors(current, [existing], Object.freeze([{ key: `${file}|updateEdge`, records: 2 }])))
      .toEqual([`${file}|updateEdge: writer record count fell; lower the frozen count (1 records; frozen 2)`])
    expect(unresolvedDebtErrors(current, [existing], Object.freeze([{ key: `${file}|updateEdge`, records: 1 }])))
      .toEqual([])
  })
})
