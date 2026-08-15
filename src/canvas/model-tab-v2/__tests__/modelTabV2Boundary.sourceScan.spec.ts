/**
 * Model tab v2 — THE LANE BOUNDARY, ENFORCED (design §8, §9.1).
 *
 * This lane makes three claims about itself. Each is the kind of claim that is
 * cheap to write in a comment, invisible when it stops being true, and expensive
 * when it does. So each is a test:
 *
 *   1. NOTHING IS MOUNTED — no file outside this directory references it, so the
 *      whole directory is deletable if Paul vetoes the design.
 *   2. NOTHING WRITES — no file here calls a store mutator or dispatches a turn.
 *      The write authority is Codex's transactional-edit vertical (§9.1), and a
 *      second writer appearing here is exactly how the estate previously ended
 *      up committing one edit through three paths with three provenance stamps.
 *   3. NOTHING FAKES SUCCESS — no runtime module here constructs an `applied`
 *      commit state. `applied` is reachable only from an authority's receipt; a
 *      component that could build one itself would reproduce design §2 F6 inside
 *      the code written to kill it.
 *
 * Every scan is DERIVED by walking the directory, never a hand-listed file set —
 * a new component is in scope the moment it exists. Every absence assertion
 * carries a POSITIVE CONTROL, because a matcher broken by a typo reports a clean
 * sweep by testing nothing.
 *
 * ⚠⚠ TWO OF THESE GUARDS SHIPPED STRUCTURALLY INCAPABLE OF FIRING, AND A
 * MUTATION CHECK IS THE ONLY REASON THIS COMMENT EXISTS. Both originally ran
 * their source text through `blankNonCode`, which blanks the CONTENTS of string
 * literals as well as comments. But the thing scan 1 hunts lives in a string (an
 * import specifier, `'../model-tab-v2/ModelOutline'`) and so does scan 3's
 * (`phase: 'applied'`). So both were reading text with their targets already
 * erased. Adding a real import from outside the directory, and a real fabricated
 * `applied` state, left the whole suite GREEN.
 *
 * The fix is `stripComments`, which blanks comments and treats string literals as
 * CODE. Scan 2 deliberately keeps `blankNonCode`, because a mutator NAME inside a
 * string is not a call and should not redden anything — the two transforms answer
 * different questions and the choice is per-scan, not per-file.
 *
 * ⭐ THE DURABLE LESSON, because it defeated the controls that were already here:
 * the original positive controls tested the bare REGEX against a bare string.
 * They passed. A control must exercise the **same pipeline the real assertion
 * uses** — transform included — or it certifies a matcher that the real scan
 * never gets to use. Every control below now goes through the same helper as the
 * claim it guards.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode, stripComments } from '../../../../tests/helpers/stripSourceComments'

const V2_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(V2_DIR, '..', '..')

const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__mocks__', '__snapshots__'])

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

const v2Files = sourceFilesIn(V2_DIR)

describe('model-tab-v2 — the scan sees the directory it claims to cover', () => {
  it('walks the v2 directory and finds its components', () => {
    const names = v2Files.map(f => basename(f))
    for (const required of [
      'ModelRowView.tsx',
      'ModelOutline.tsx',
      'ModelDetailRegion.tsx',
      'RepairQueueList.tsx',
      'useOutlineKeyboard.ts',
      'types.ts',
      'contracts.ts',
    ]) {
      expect(names).toContain(required)
    }
  })
})

// ── 1. UNMOUNTED ─────────────────────────────────────────────────────────────

/**
 * The directory name as it would appear in any import specifier reaching it.
 * Matching the PATH SEGMENT rather than a component name is deliberate: a mount
 * could import any symbol, or the barrel, or a deep file, and a name-based scan
 * would miss whichever one it did not think of.
 */
const V2_PATH_TOKEN = /model-tab-v2/

/**
 * ⚠ `stripComments`, NOT `blankNonCode` — see the file header. An import
 * specifier IS a string literal, so a transform that blanks string contents
 * erases exactly what this scan exists to find.
 */
function referencesV2(src: string, file: string): boolean {
  return V2_PATH_TOKEN.test(stripComments(src, file))
}

describe('⭐ model-tab-v2 is UNMOUNTED — nothing outside it references it', () => {
  const outsideFiles = sourceFilesIn(SRC_DIR).filter(
    f => !f.startsWith(V2_DIR + '/') && f !== V2_DIR,
  )

  it('POSITIVE CONTROL: the sweep reaches a large, plausible slice of src/', () => {
    // A magnitude check, not a bare non-zero: a walker broken so that it
    // returned only a handful of files would still "find nothing" below, and
    // the clean result would be an instrument failure rather than a fact.
    expect(outsideFiles.length).toBeGreaterThan(1000)
  })

  it('POSITIVE CONTROL: a real import survives the transform and IS detected', () => {
    // ⚠ Through `referencesV2`, i.e. the SAME pipeline the claim below uses.
    // The earlier version of this control tested the bare regex, passed, and
    // certified a scan whose transform had already deleted the import path.
    expect(
      referencesV2("import { ModelOutline } from '@/canvas/model-tab-v2/ModelOutline'", 'x.tsx'),
    ).toBe(true)
    expect(
      referencesV2("import { ModelRowView } from '../../model-tab-v2/ModelRowView'", 'x.ts'),
    ).toBe(true)
  })

  it('POSITIVE CONTROL: a mere mention in a COMMENT is not a mount', () => {
    // The transform must still discriminate: prose referring to the directory
    // is not a reference that mounts anything.
    expect(referencesV2('// the model-tab-v2 design is unmounted\nconst x = 1', 'x.ts')).toBe(false)
  })

  it('no file outside the directory imports or mentions it', () => {
    const offenders: string[] = []
    for (const file of outsideFiles) {
      if (referencesV2(readFileSync(file, 'utf8'), file)) {
        offenders.push(relative(SRC_DIR, file))
      }
    }
    // If this ever goes red, the directory is MOUNTED and three things become
    // due at once: widen the raw-write guard (§9.1), re-read the disabled
    // affordances, and stop describing the design as vetoable-by-deletion.
    expect(offenders).toEqual([])
  })
})

// ── 2. NO WRITES ─────────────────────────────────────────────────────────────

/**
 * The store mutators that accept a free-form patch, plus the turn emitter. These
 * are the three ways a Model-tab surface has historically written: a raw store
 * patch, a sanctioned setter, and a system event on the wire.
 */
const BANNED_WRITE = /\b(updateNode|updateEdge|updateEdgeData|sendSystemEvent|setIntervention|setStrength|setDirection|setExistsProbability|setObservedSource|setObservedBaseline|setPriorRange|setGoalThresholdAndUpdateNode)\s*\(/g

function bannedWritesIn(src: string): string[] {
  return [...blankNonCode(src).matchAll(BANNED_WRITE)].map(m => m[1])
}

describe('⭐ model-tab-v2 NEVER WRITES — the write authority is another lane', () => {
  it('POSITIVE CONTROL: the matcher sees every banned call when one is present', () => {
    const synthetic = [
      'updateNode(id, { data })',
      'updateEdge(edgeId, { data })',
      'updateEdgeData(edgeId, { weight: 1 })',
      "sendSystemEvent('factor_value_edit', payload)",
      'setIntervention(optionId, factorId, 30)',
      'setStrength(edgeId, 0.6)',
      'setObservedSource(nodeId, "user")',
    ].join('\n')
    expect(new Set(bannedWritesIn(synthetic))).toEqual(
      new Set([
        'updateNode',
        'updateEdge',
        'updateEdgeData',
        'sendSystemEvent',
        'setIntervention',
        'setStrength',
        'setObservedSource',
      ]),
    )
  })

  it('POSITIVE CONTROL: a banned call inside a comment is NOT counted', () => {
    expect(bannedWritesIn('// updateNode(id, { data })\nconst x = 1')).toEqual([])
  })

  it('no v2 file calls a store mutator or emits a turn', () => {
    const offenders: string[] = []
    for (const file of v2Files) {
      const found = bannedWritesIn(readFileSync(file, 'utf8'))
      if (found.length > 0) offenders.push(`${basename(file)}: ${[...new Set(found)].join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('no v2 file reaches into a store at all — components take projections as props', () => {
    const STORE_IMPORT = /\b(useCanvasStore|useUIStore|useInspectorMutations|useNodeMutations|useEdgeMutations)\b/
    // Control first: the token must be able to match.
    expect(STORE_IMPORT.test("import { useCanvasStore } from '../store'")).toBe(true)

    const offenders = v2Files.filter(f =>
      STORE_IMPORT.test(blankNonCode(readFileSync(f, 'utf8'))),
    )
    expect(offenders.map(f => basename(f))).toEqual([])
  })
})

// ── 3. NO FAKE SUCCESS ───────────────────────────────────────────────────────

/**
 * SCOPE, stated precisely: every v2 module EXCEPT `types.ts`, which DECLARES the
 * `EditCommitState` union and is therefore the one legitimate place the token
 * appears. The exclusion is proven real by a control below — if `types.ts` ever
 * stopped containing it, the exclusion would be silently pointless and this
 * whole guard would be scoped around nothing.
 */
const APPLIED_LITERAL = /phase:\s*['"]applied['"]/

/**
 * ⚠ `stripComments`, NOT `blankNonCode` — see the file header. `'applied'` is a
 * string literal, so blanking string contents erases the target.
 */
function fabricatesApplied(src: string, file: string): boolean {
  return APPLIED_LITERAL.test(stripComments(src, file))
}

describe('⭐ model-tab-v2 NEVER FABRICATES A SUCCESS STATE', () => {
  it('POSITIVE CONTROL: a constructed applied state survives the transform and IS detected', () => {
    // ⚠ Through `fabricatesApplied` — the same pipeline as the claim below.
    expect(fabricatesApplied("setCommit({ phase: 'applied', value: '60 days' })", 'x.tsx')).toBe(true)
    expect(fabricatesApplied('setCommit({ phase: "applied", value: v })', 'x.tsx')).toBe(true)
  })

  it('POSITIVE CONTROL: an applied state named in a COMMENT is not a fabrication', () => {
    expect(fabricatesApplied("// never write phase: 'applied' here\nconst x = 1", 'x.ts')).toBe(false)
  })

  it('POSITIVE CONTROL: types.ts DOES carry the token, so the exclusion is real', () => {
    // Guards against the exclusion quietly becoming a no-op — a scope carved
    // around a file that no longer contains what it was carved around.
    const types = v2Files.find(f => basename(f) === 'types.ts')!
    expect(fabricatesApplied(readFileSync(types, 'utf8'), types)).toBe(true)
  })

  it('no runtime module constructs an applied commit state', () => {
    const offenders = v2Files
      .filter(f => basename(f) !== 'types.ts')
      .filter(f => fabricatesApplied(readFileSync(f, 'utf8'), f))
    // A component that can build its own receipt can report an edit it never
    // made — which is design §2 F6, the defect this entire surface exists to
    // close, re-created one layer up.
    expect(offenders.map(f => basename(f))).toEqual([])
  })
})
