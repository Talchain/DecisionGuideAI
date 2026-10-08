/**
 * Data layer Phase 1 — SHRINK-ONLY guard: outside `canvas/domain`, no production file may ADD a direct read of a
 * relationship's authorship (the predicates `edgeProvenance` composes, or the raw fields behind them). Each file's
 * count may only fall; a new file fails. PR2b (canvas/inspector, after Paul's approval) takes these toward 0.
 * Contrast: the same scan finds `edgeProvenance(` callers (the probe sees code).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..', '..')
const DIRECT = /isStrengthPlaceholder\(|isStrengthDefinitional\(|isStrengthStated\(|isStrengthAccepted\(|edgeValueSource\([^)]*'weight'|naturalEffect\??\.author/g
/** Counts at PR2a (8 Oct). Lower a number when a reader moves; never raise one. */
const ALLOWED: Record<string, number> = {
  'canvas/components/ModelTabBody.tsx': 1,
  'canvas/conversation/askAi.ts': 3,
  'canvas/conversation/edgeStrengthEdit.ts': 1,
  'canvas/edges/StyledEdge.tsx': 4,
  'canvas/edges/directionStroke.ts': 1,
  'canvas/edges/edgeAffordance.ts': 1,
  'canvas/edges/edgePresentation.ts': 1,
  'canvas/edges/edgeSizePhrase.ts': 1,
  'canvas/model-tab-v2/adapters.ts': 1,
  'canvas/nodes/shared/EdgePills.tsx': 3,
  'canvas/nodes/shared/metricVocabulary.ts': 1,
  'canvas/ui/inspector-v2/InspectorRouter.tsx': 1,
  'canvas/ui/inspector-v2/coachingConfig.ts': 1,
  'canvas/ui/inspector-v2/edgeInspectorSentence.ts': 2,
  'canvas/ui/inspector-v2/editors/EdgeAdvancedEditor.tsx': 1,
  'canvas/ui/inspector-v2/examine/examineLinkView.ts': 6,
  'canvas/ui/inspector-v2/panels/EdgePanel.tsx': 11,
  'components/results/strengthElicitation/selectAssumedStrengthToResolve.ts': 3,
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(p, out) }
    else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name)) out.push(p)
  }
  return out
}
const scan = (re: RegExp) => {
  const m = new Map<string, number>()
  for (const f of walk(SRC)) {
    const rel = f.slice(SRC.length + 1).replace(/\\/g, '/')
    if (rel.startsWith('canvas/domain/')) continue
    const n = (readFileSync(f, 'utf8').match(re) ?? []).length
    if (n > 0) m.set(rel, n)
  }
  return m
}

describe('edge provenance readers: shrink-only', () => {
  it('no file outside canvas/domain adds a direct authorship read', () => {
    const over: string[] = []
    for (const [file, n] of scan(DIRECT)) if (n > (ALLOWED[file] ?? 0)) over.push(`${file}: ${n} > ${ALLOWED[file] ?? 0}`)
    expect(over).toEqual([])
  })
  it('CONTRAST: the scan finds the classifier\'s own callers', () => {
    expect(scan(/edgeProvenance\(|isUnsizedRelationship\(/g).size).toBeGreaterThanOrEqual(5)
  })
})
