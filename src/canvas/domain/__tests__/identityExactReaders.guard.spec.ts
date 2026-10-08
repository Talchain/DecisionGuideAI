/**
 * IDENTITY-EXACT GUARD (DL 8 Oct): every production reader of the placeholder predicate is listed here and has been
 * reviewed for exactness (an operand link of an identity the current Run evaluated is exact, not unsized). A NEW
 * caller fails this spec until it is reviewed and added. Counted per file, with a contrast symbol so a blind scan
 * cannot pass by finding nothing.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..')
/** file → reviewed call count, and how exactness reaches it. */
const REVIEWED: Record<string, number> = {
  'canvas/domain/strengthPlaceholder.ts': 2, // the predicate + strengthForWords (callers branch on exactness first)
  'canvas/edges/StyledEdge.tsx': 1, // useIdentityExactWords
  'canvas/ui/inspector-v2/panels/EdgePanel.tsx': 2, // useIdentityExactWords
  'canvas/ui/inspector-v2/edgeInspectorSentence.ts': 1, // input.identityExact branch first
  'canvas/conversation/askAi.ts': 1, // selectIdentityExactLinks
  'canvas/conversation/zones/GuidanceRows.tsx': 1, // selectIdentityExactLinks
  'components/results/analysisNew/sections/UnsizedLinkActions.tsx': 1, // selectIdentityExactLinks
  'components/results/useResultsSectionData.ts': 1, // selectIdentityExactLinks
  'canvas/edges/edgePresentation.ts': 1, // isEdgeStrengthNotSet: StyledEdge gates it; provenanceKey legend = residual
  'canvas/ui/inspector-v2/examine/examineLinkView.ts': 1, // basis wording only; residual (no size ask)
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(p, out) }
    else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name)) out.push(p)
  }
  return out
}
const count = (re: RegExp) => {
  const m = new Map<string, number>()
  for (const f of walk(ROOT)) {
    const n = (readFileSync(f, 'utf8').match(re) ?? []).length
    if (n > 0) m.set(f.slice(ROOT.length + 1).replace(/\\/g, '/'), n)
  }
  return m
}

describe('identity-exact: every placeholder-predicate reader is reviewed', () => {
  it('the production callers of isStrengthPlaceholder( equal the reviewed list, per file', () => {
    expect(Object.fromEntries([...count(/isStrengthPlaceholder\(/g)].sort())).toEqual(Object.fromEntries(Object.entries(REVIEWED).sort()))
  })
  it('CONTRAST: the same scan finds the definitional predicate in many files (the probe sees code)', () => {
    expect(count(/isStrengthDefinitional\(/g).size).toBeGreaterThanOrEqual(10)
  })
})
