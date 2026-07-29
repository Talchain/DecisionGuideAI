/**
 * ROADMAP 2.121 slice 1 — no Model-tab SECTION may write the canvas store
 * directly. Every value-bearing edit goes through the sanctioned mutation
 * setters (`useNodeMutations` / `useEdgeMutations`, whose written fields the
 * `EDITOR_WRITTEN_FIELDS` manifest guard enforces) or, for the goal target,
 * through the canonical `setGoalThresholdAndUpdateNode` store action.
 *
 * WHY A SOURCE SCAN AND NOT ONLY BEHAVIOURAL TESTS
 * -----------------------------------------------
 * `modelTabEditsAreTurns.spec.tsx` proves the NINE handlers that exist today
 * behave. It cannot prove anything about the TENTH, added next month. And the
 * tenth is exactly how this defect happened the first time: #513 closed the
 * store-only-edit class for the inspector, and the Model tab kept its own
 * hand-rolled `updateNode` calls, so the killed class stayed live through a
 * different door — invisible to every test the inspector fix shipped with.
 *
 * The scan is DERIVED from the directory, never a hand-listed file set (trap 12:
 * the hand-maintained mirror is this codebase's dominant defect, and a guard
 * whose scope is a list someone must remember to extend drifts silently green).
 * A new section file is in scope the moment it exists.
 *
 * WHAT IT ASSERTS, precisely
 * --------------------------
 * SCOPE: every non-test `.ts`/`.tsx` file under
 * `src/canvas/components/model-tab/`, **recursively**. That is the complete set
 * of Model-tab section components — enumerated at run time, never quoted here.
 *
 * The walk was FLAT in the first version of this guard, and the adversarial
 * review proved the hole: a scratch `model-tab/subsections/EvilSection.tsx`
 * carrying a raw `updateNode(` call passed silently, in the same run where the
 * same call in `StatusBar.tsx` correctly turned the guard RED. The scope
 * sentence was honest about "directly under" — but a section added one directory
 * down would have re-opened the raw-write door unwatched, which is the whole
 * failure mode this guard exists to prevent. Recursive now, with a control
 * (below) that fails if the recursion is ever removed.
 *
 * CLAIM: none of those files contains a call to `updateNode(`, `updateEdge(` or
 * `updateEdgeData(` — the three store mutators that accept an arbitrary `data`
 * patch and therefore bypass both the written-fields manifest and the wire
 * emitter. This is a NO-CALL claim about that directory. It is deliberately NOT
 * a claim that no Model-tab code anywhere writes the store: `ModelTabBody.tsx`
 * (the tab's container, one level up) still calls `updateEdge` in
 * `handleResolveContested`, for the reason recorded there — no sanctioned setter
 * writes edge `validation`, and `setStrength` hard-codes `weightSource: 'user'`,
 * which would launder a producer pass-2 estimate as a user number. Rowed as an
 * honest deviation rather than swept under a wildcard exception here.
 *
 * POSITIVE CONTROL (trap 13: an absence assertion must first prove it can see a
 * presence): the same matcher is run against a synthetic source string carrying
 * each banned call, and must find all three. Without it, a matcher broken by a
 * regex typo would report "zero raw writes" by testing nothing.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../../../tests/helpers/stripSourceComments'

const MODEL_TAB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The store mutators that take a free-form `data` patch. These are the ones that
 * can write ANY field, which is what makes them the bypass: the setters in
 * `useInspectorMutations` are constrained by a manifest a guard spec enforces,
 * and these are not.
 */
const BANNED_CALL = /\b(updateNode|updateEdge|updateEdgeData)\s*\(/g

const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__mocks__', '__snapshots__'])

/** Recursive walk — a section one directory down is in scope (review F3). */
function sourceFilesIn(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(entry)) out.push(...sourceFilesIn(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\.(ts|tsx)$/.test(entry)) continue
    out.push(full)
  }
  return out
}

function bannedCallsIn(src: string): string[] {
  const code = blankNonCode(src)
  return [...code.matchAll(BANNED_CALL)].map(m => m[1])
}

describe('Model-tab sections never write the canvas store directly (2.121 slice 1)', () => {
  const files = sourceFilesIn(MODEL_TAB_DIR)

  it('the scan covers the whole model-tab directory (scope is derived, not listed)', () => {
    // Not an exact count — that would be a mirror of its own. The assertion is
    // that the directory was actually walked and the known sections are in it.
    expect(files.length).toBeGreaterThan(15)
    const names = files.map(f => basename(f))
    for (const required of [
      'FactorsSection.tsx',
      'GoalSection.tsx',
      'OptionsSection.tsx',
      'RelationshipsSection.tsx',
    ]) {
      expect(names).toContain(required)
    }
  })

  it('POSITIVE CONTROL: the walk RECURSES — a section one directory down is in scope', () => {
    // Hermetic: a scratch tree, so the control proves the walker's behaviour
    // without writing a decoy into the repo. Reverting to a flat `readdirSync`
    // drops `sub/Nested.tsx` and fails this — which is the exact hole the
    // adversarial review proved with a `model-tab/subsections/` probe.
    const root = mkdtempSync(join(tmpdir(), 'modeltab-scan-'))
    try {
      writeFileSync(join(root, 'Top.tsx'), 'export const a = 1\n')
      mkdirSync(join(root, 'sub'))
      writeFileSync(join(root, 'sub', 'Nested.tsx'), 'export const b = 2\n')
      mkdirSync(join(root, '__tests__'))
      writeFileSync(join(root, '__tests__', 'Ignored.spec.tsx'), 'export const c = 3\n')
      writeFileSync(join(root, 'Ignored.spec.tsx'), 'export const d = 4\n')

      expect(sourceFilesIn(root).map(f => basename(f)).sort()).toEqual(['Nested.tsx', 'Top.tsx'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('POSITIVE CONTROL: the matcher sees every banned call when one is present', () => {
    const synthetic = [
      "updateNode(id, { data: { ...data, observedState: { value: 1 } } })",
      "updateEdge(edgeId, { data: { ...data, weight: 1 } })",
      "updateEdgeData(edgeId, { weight: 1 })",
    ].join('\n')
    expect(bannedCallsIn(synthetic).sort()).toEqual(
      ['updateEdge', 'updateEdgeData', 'updateNode'],
    )
  })

  it('POSITIVE CONTROL: a banned call inside a comment is NOT counted', () => {
    expect(bannedCallsIn('// updateNode(id, { data })\nconst x = 1')).toEqual([])
  })

  it('no model-tab section file calls updateNode / updateEdge / updateEdgeData', () => {
    const offenders: string[] = []
    for (const file of files) {
      const found = bannedCallsIn(readFileSync(file, 'utf8'))
      if (found.length > 0) offenders.push(`${basename(file)}: ${[...new Set(found)].join(', ')}`)
    }
    expect(offenders).toEqual([])
  })
})
