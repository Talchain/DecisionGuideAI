/**
 * #2747 re-scope 2 round 2 (DL A and B, 12 Oct): THE CENSUS'S INPUTS, DERIVED FROM THE CODE — never listed from memory.
 *
 *  A. `payloadChanceFields`: every numeric field of the Run's payload types whose NAME (an underscore-separated token) or
 *     DOC matches prob / pct / share / chance / win / switch / percent / likelihood / frequency — read from the vendored
 *     `@talchain/schemas` boundary types and the UI's own payload type files (any source file declaring a payload anchor
 *     such as `option_comparison`) — plus every wire-style (snake_case) field the production code READS whose name matches,
 *     which is how an untyped passthrough (`inference_warnings`, `constraint_analysis`) is seen. The payload is snake_case
 *     on the wire; a camelCase name is the UI's own copy of a wire field and is seeded through it.
 *  B. `productionModules` is the runtime import closure of `src/main.tsx` (static and dynamic imports; `import type` is
 *     erased and not followed). `chanceReaderComponents` are its `.tsx` files that read a chance-like identifier;
 *     `textBuilderFiles` are its files that copy, print, download or share (clipboard, `window.print`, `Blob`, `download`,
 *     `mailto:`, `navigator.share`).
 *
 * Plain text scans (no AST), so the derivation is fast enough for a CI runner (memory: a scan-the-tree guard that parsed
 * every file timed out on CI).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'

const ROOT = process.cwd()
const rel = (abs: string): string => relative(ROOT, abs).split('\\').join('/')

const NAME_STEMS = ['prob', 'pct', 'share', 'chance', 'win', 'switch', 'percent', 'likelihood', 'frequency']
const nameMatches = (name: string): boolean => name.split('_').some(t => NAME_STEMS.some(s => t.startsWith(s)))
const DOC_MATCH = /\b(?:prob\w*|pct|share\w*|chance\w*|win\w*|switch\w*|percent\w*|likelihood\w*|frequenc\w*)/i
const WIRE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/

/** The chance-like identifiers a surface could render: wire fields, the UI's camelCase copies, and the gate's readers. */
export const CHANCE_IDENTIFIERS = new RegExp(`\\b(?:${[
  'probability_of_goal', 'probability_of_joint_goal', 'goal_probability', 'win_probability', 'win_probabilities',
  'option_probabilities', 'pct_by_option', 'pct_if_side', 'low_pct', 'high_pct', 'goal_chances', 'prob_satisfied',
  'joint_probability', 'constraint_probabilities', 'conditional_probability', 'marginal_probability', 'switch_probability',
  'marginal_switch_probability', 'evpi_percentage_points', 'recommendation_stability', 'p_win_sensitivity', 'winner_pct',
  'goalProbability', 'winProbability', 'switchProbability', 'jointProbability', 'jointGoalProbability', 'probSatisfied',
  'conditionalProbability', 'marginalProbability', 'recommendationStability', 'evpiPercentagePoints', 'pctByOption',
  'pctIfSide', 'lowPct', 'highPct', 'winShare', 'winShares', 'optionProbabilities', 'chanceCellOf', 'chanceFigureOf',
  'servedCellOf', 'chanceOf',
].join('|')})\\b`)

const TEXT_BUILDER = /clipboard\.write|writeText\(|window\.print|\.print\(\)|new Blob\(|\.download\s*=|download=|mailto:|navigator\.share|createObjectURL/

const SKIP_DIR = /(?:^|\/)(?:__tests__|__fixtures__|__mocks__|test|tests|stories)(?:\/|$)/
const SKIP_FILE = /\.(?:spec|test|stories)\.tsx?$|\.d\.ts$/

let cachedSources: Map<string, string> | null = null
/** Every non-test source file under `src/`, by repo-relative path. */
export function sourceFiles(): Map<string, string> {
  if (cachedSources) return cachedSources
  const out = new Map<string, string>()
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      const r = rel(abs)
      if (statSync(abs).isDirectory()) { if (!SKIP_DIR.test(`${r}/`)) walk(abs); continue }
      if (/\.tsx?$/.test(name) && !SKIP_FILE.test(name)) out.set(r, readFileSync(abs, 'utf8'))
    }
  }
  walk(join(ROOT, 'src'))
  cachedSources = out
  return out
}

const EXTENSIONS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
function resolveImport(from: string, spec: string, sources: Map<string, string>): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(ROOT, 'src', spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(ROOT, dirname(from), spec)
  else return null
  for (const ext of EXTENSIONS) {
    const r = rel(base + ext)
    if (sources.has(r)) return r
  }
  return null
}

const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s+(type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*(?:\/\*[\s\S]*?\*\/\s*)?['"]([^'"]+)['"]\s*\)/g

let cachedProduction: Set<string> | null = null
/** The runtime import closure of `src/main.tsx`: the modules the production bundle holds. */
export function productionModules(): Set<string> {
  if (cachedProduction) return cachedProduction
  const sources = sourceFiles()
  const seen = new Set<string>()
  const queue = ['src/main.tsx']
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const text = sources.get(file) ?? ''
    for (const m of text.matchAll(IMPORT_RE)) {
      if (m[1]) continue // `import type … from` is erased at build time
      const spec = (m[2] ?? m[3] ?? '').replace(/\?.*$/, '')
      const target = resolveImport(file, spec, sources)
      if (target !== null && !seen.has(target)) queue.push(target)
    }
  }
  cachedProduction = seen
  return seen
}

/** Code without its comments (block and line; a `//` after a colon is kept, so URLs survive). */
export const withoutComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/.*$/gm, '$1')

/** Production `.tsx` files whose CODE (not a comment) names a chance-like identifier. */
export function chanceReaderComponents(): string[] {
  const sources = sourceFiles()
  return [...productionModules()].filter(f => f.endsWith('.tsx') && CHANCE_IDENTIFIERS.test(withoutComments(sources.get(f) ?? ''))).sort()
}

/** Production files that copy, print, download or share. */
export function textBuilderFiles(): string[] {
  const sources = sourceFiles()
  return [...productionModules()].filter(f => TEXT_BUILDER.test(sources.get(f) ?? '')).sort()
}

/** The exported component names a file defines (what React names its fibers; a bundler may suffix a digit). */
export function componentNamesOf(file: string): string[] {
  const text = sourceFiles().get(file) ?? ''
  const names = new Set<string>()
  for (const m of text.matchAll(/export\s+(?:default\s+)?(?:const|function)\s+([A-Z]\w*)/g)) names.add(m[1])
  for (const m of text.matchAll(/(?:memo|forwardRef)\(\s*function\s+([A-Z]\w*)/g)) names.add(m[1])
  for (const m of text.matchAll(/export\s+const\s+[A-Z]\w*\s*=\s*(?:React\.)?(?:memo|forwardRef)\(\s*([A-Z]\w*)\s*[,)]/g)) names.add(m[1])
  for (const m of text.matchAll(/export\s+default\s+([A-Z]\w*)\s*;?\s*$/gm)) names.add(m[1])
  return [...names]
}

const PAYLOAD_ANCHOR = /^\s*(?:readonly\s+)?["']?(?:option_comparison|inference_warnings|fragile_edges|canonical_analysis_view|goal_chances|win_probabilities|run_delta)["']?\??\s*:/m
const PROPERTY = /^\s*(?:readonly\s+)?["']?([A-Za-z_][A-Za-z0-9_]*)["']?\??\s*:\s*(.*)$/
const NUMERIC = /\bZodNumber\b|(?<![\w.])number\b/
const READ = /(?:\?\.|\.)([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b|\[['"]([a-z][a-z0-9]*(?:_[a-z0-9]+)+)['"]\]/g

/** A: every chance-like numeric payload field, with how it was found ('type', 'doc', 'read'). */
export function payloadChanceFields(): Map<string, Set<'type' | 'doc' | 'read'>> {
  const out = new Map<string, Set<'type' | 'doc' | 'read'>>()
  const add = (name: string, how: 'type' | 'doc' | 'read') => {
    if (!out.has(name)) out.set(name, new Set())
    out.get(name)!.add(how)
  }
  const schemaDir = join(ROOT, 'node_modules/@talchain/schemas/dist/boundary')
  const schemaTexts = readdirSync(schemaDir).filter(f => f.endsWith('.d.ts')).map(f => readFileSync(join(schemaDir, f), 'utf8'))
  const sources = sourceFiles()
  const production = productionModules()
  const typed = [...sources.entries()].filter(([, t]) => PAYLOAD_ANCHOR.test(t)).map(([, t]) => t)
  for (const text of [...schemaTexts, ...typed]) {
    let inDoc = false
    let doc = ''
    let buf: string[] = []
    let docEnd = -9
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const s = lines[i].trim()
      if (s.startsWith('/**')) { inDoc = true; buf = [] }
      if (inDoc) {
        buf.push(s)
        if (s.endsWith('*/')) { inDoc = false; doc = buf.join(' '); docEnd = i }
        continue
      }
      const m = PROPERTY.exec(lines[i])
      if (m === null || !WIRE.test(m[1]) || !NUMERIC.test(m[2])) continue
      if (nameMatches(m[1])) add(m[1], 'type')
      else if (docEnd >= i - 1 && DOC_MATCH.test(doc)) add(m[1], 'doc')
    }
  }
  for (const file of production) {
    for (const m of (sources.get(file) ?? '').matchAll(READ)) {
      const name = m[1] ?? m[2]
      if (nameMatches(name)) add(name, 'read')
    }
  }
  return out
}
