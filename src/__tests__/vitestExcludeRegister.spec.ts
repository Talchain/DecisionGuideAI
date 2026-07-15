/**
 * THE EXCLUDE REGISTER — a guard against silently-dead tests.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * `src/canvas/components/__tests__/OutputsDock.dom.spec.tsx` held 51 tests that
 * executed NOWHERE — not locally, not in CI — for seven months. Nothing failed.
 * Nothing warned. The mechanism was three innocuous parts combining:
 *
 *   1. the file sat in `vitest.config.ts`'s `exclude` list;
 *   2. CI runs the DEFAULT config (`vitest run --shard=N/4`), so the exclude
 *      applies there too — there was never a second config that ran it;
 *   3. `passWithNoTests: true` turns "I collected nothing" into exit code 0.
 *
 * So a targeted run printed `No test files found, exiting with code 0` — green —
 * and a sharded CI run simply never saw the file. Meanwhile lanes kept ADDING
 * tests to it (124 lines as late as 2026-07-15) and citing them as coverage.
 *
 * The cost was not hypothetical:
 *   • A P1 regression (the analysis-narration clock measuring banner MOUNT
 *     rather than run start, suppressing the accurate "Taking longer than
 *     expected" line) was caught by a HUMAN reviewer — precisely because the
 *     spec that covers it cannot run.
 *
 * ─── A CORRECTION TO THIS FILE'S OWN ARGUMENT (read it; it is the point) ────
 * The first version of this docstring made a second, bigger claim: that commit
 * `69ab0daf` deleted a ~400-line CompareTabBody chain as "dead" PARTLY BECAUSE
 * its only coverage was excluded — that the hole "manufactured the false
 * evidence that live code was dead, and the code was removed on it."
 *
 * THAT CLAIM WAS FALSE. It was written by this lane, on an inference about
 * another commit's motive, and it was never checked. Checked afterwards, at
 * `69ab0daf^`:
 *   • the excluded `OutputsDock.dom.spec.tsx` contained ZERO references to the
 *     deleted chain — it never covered it, so the exclusion cost that deletion
 *     exactly nothing;
 *   • the local `CompareTabBody` was NOT exported and had NO call site — the
 *     thing actually rendered was `<CompareTabBodyV2 />` (`OutputsDock.tsx:1796`);
 *   • the file already carried an explicit `// Dead code: replaced by
 *     CompareTabBodyV2` comment at `:1872`, written BEFORE the deletion.
 * `69ab0daf` was a correct, well-evidenced removal. The accusation is withdrawn.
 *
 * It is kept here rather than quietly deleted because the failure is worth more
 * than the file it damaged: a guard against unaccountable claims was itself
 * built on an unaccountable claim, and it was the most rhetorically useful
 * sentence in the file — which is precisely why nobody checked it. The 51 tests
 * are real and are reason enough. An argument that needs embellishment to land
 * is an argument you have not finished verifying.
 *
 * And the exclusion was documented DISHONESTLY, by degrees:
 *   2026-02-18 `620fad99`  excluded under an accurate header —
 *                          "── Known-broken tests (pre-existing, tracked for
 *                           future repair) ──" (one of 29 files).
 *   2026-03-15 `a6a9567f`  REPLACED that with
 *                          "── Complex DOM integration tests… ──" and
 *                          "// needs network mock (fetch /bff/cee); CI-only".
 * The label did not go stale. An honest "we broke this and owe it a repair" was
 * overwritten with a technical-sounding excuse that reads like an arrangement.
 * Both halves of it were false: nothing ran it in CI, and the real blocker was
 * bit-rot (a hand-listed `vi.mock` flags allowlist), not networking.
 *
 * ─── WHAT THIS GUARD DOES ───────────────────────────────────────────────────
 * Excluding a spec is sometimes legitimate. Excluding one SILENTLY never is.
 * So: every entry in `vitest.config.ts`'s `exclude` MUST be registered below
 * with a reason and an owner, and every registered path MUST still exist.
 * Drift fails LOUD, in both directions:
 *   • exclude an file without registering it        → this test fails
 *   • register a file that is no longer excluded    → this test fails
 *   • register a path that no longer exists on disk → this test fails
 *
 * You cannot silence a spec without writing down why, in a file that fails if
 * you don't. That is the whole point.
 *
 * ─── WHY A REGISTER AND NOT `passWithNoTests: false` ────────────────────────
 * Flipping that flag would make legitimate filtered runs fail (`vitest run
 * --changed` with no affected tests collects nothing and SHOULD be green — it
 * is the documented Tier-1 workflow). The flag is not the defect; an
 * unaccountable exclude list is. This guard is loud without breaking the flag.
 *
 * ─── DESIGN RULE THIS FOLLOWS: DERIVE, DON'T MIRROR ─────────────────────────
 * This repo's dominant defect is the hand-maintained mirror — a list a human
 * must remember to sync with reality, which drifts in silence. Known specimens:
 * this spec's own `vi.mock` flags allowlist, `KNOWN_OLUMI_TOP_LEVEL_KEYS`,
 * `LEGACY_SCHEMA_KNOWN_BLOCK_TYPES`, two same-named `generateGraphHash`
 * functions, the typecheck baseline — and the exclude list itself.
 * Where a mirror is unavoidable (a reason for excluding cannot be derived from
 * code), it MUST fail loud on drift rather than assume-good. That is what this
 * file is: the register is a mirror, and this test is the alarm on it.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '../..')

/**
 * Every path excluded from the vitest run, with WHY and WHO.
 *
 * Adding an entry is a claim that these tests provide no value in vitest —
 * make that claim explicitly, in writing, with an owner and a route back.
 * `reason` must say what is ACTUALLY wrong (not what sounds plausible), and
 * `route` must name the real path to re-enabling it or retiring it honestly.
 */
const DELIBERATELY_UNRUN: Record<string, { reason: string; owner: string; route: string }> = {
  'src/canvas/__tests__/ReactFlowGraph.layout.dom.spec.tsx': {
    reason:
      'Asserts CSS-variable dock offsets and layout geometry. jsdom has NO layout engine — ' +
      'every measurement it takes is 0, so these assertions cannot be made true here by any ' +
      'amount of mocking. NOT YET INDEPENDENTLY ADJUDICATED by this lane.',
    owner: 'UI/Experience',
    route:
      'Adjudicate individually (queued): either port to the browser-driven suite where layout ' +
      'is real, or retire honestly. Do NOT un-exclude into a false green — a layout assertion ' +
      'that passes in jsdom is proving nothing.',
  },
  'src/canvas/__tests__/canvas.run-gating.dom.spec.tsx': {
    reason:
      'Requires a full canvas pipeline mount for toast rendering. NOT YET INDEPENDENTLY ' +
      'ADJUDICATED by this lane — the OutputsDock exclusion carried an equally plausible ' +
      'reason ("needs network mock") that turned out to be false on both counts, so this ' +
      'stated reason is recorded as a CLAIM, not a finding.',
    owner: 'UI/Experience',
    route:
      'Adjudicate individually (queued): verify the stated blocker at the bytes by removing ' +
      'the exclude and reading the real failure, exactly as OutputsDock was. Then repair, ' +
      'port, or retire.',
  },
}

function excludeListFromConfig(): string[] {
  const cfg = readFileSync(resolve(REPO_ROOT, 'vitest.config.ts'), 'utf8')
  const block = cfg.match(/exclude:\s*\[([\s\S]*?)\]/)
  if (!block) throw new Error('Could not find the `exclude:` array in vitest.config.ts')
  return [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
}

describe('vitest exclude register — no spec is silenced without an accountable reason', () => {
  it('every excluded path is registered with a reason and an owner', () => {
    const unregistered = excludeListFromConfig().filter((p) => !(p in DELIBERATELY_UNRUN))
    expect(
      unregistered,
      'A spec was added to vitest.config.ts `exclude` without being registered in ' +
        'DELIBERATELY_UNRUN (see this file). An excluded spec runs NOWHERE — not locally, ' +
        'not in CI — and `passWithNoTests: true` makes that look green. 51 tests hid in ' +
        'exactly this gap for seven months, lanes kept adding to them, and a ~400-line ' +
        'chain of live product code was deleted as "dead" on the strength of the silence. ' +
        'Register it with an honest reason and an owner, or do not exclude it.',
    ).toEqual([])
  })

  it('every registered path is still actually excluded (a stale register is a lie)', () => {
    const excluded = new Set(excludeListFromConfig())
    const stale = Object.keys(DELIBERATELY_UNRUN).filter((p) => !excluded.has(p))
    expect(
      stale,
      'These paths are registered as deliberately-unrun but are NOT in vitest.config.ts ' +
        '`exclude` any more. Either they were re-enabled (delete the register entry and ' +
        'celebrate) or the register has drifted. A register that describes a world that no ' +
        'longer exists is the same defect it was built to prevent.',
    ).toEqual([])
  })

  it('every registered path still exists on disk', () => {
    const missing = Object.keys(DELIBERATELY_UNRUN).filter(
      (p) => !existsSync(resolve(REPO_ROOT, p)),
    )
    expect(
      missing,
      'These registered paths no longer exist. Remove them from BOTH the register and ' +
        'vitest.config.ts `exclude` — a dangling exclude silently pre-approves the next ' +
        'file that lands at that path.',
    ).toEqual([])
  })

  it('the register states a reason, an owner and a route back for each entry', () => {
    for (const [path, entry] of Object.entries(DELIBERATELY_UNRUN)) {
      expect(entry.reason.length, `${path}: reason must be substantive`).toBeGreaterThan(40)
      expect(entry.owner.length, `${path}: owner must be named`).toBeGreaterThan(0)
      expect(entry.route.length, `${path}: route back must be substantive`).toBeGreaterThan(20)
    }
  })
})
