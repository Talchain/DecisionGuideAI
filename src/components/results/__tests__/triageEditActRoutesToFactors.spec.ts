/**
 * The triage "edit" act must route to the Model tab's FACTORS group.
 *
 * ⚠ WRITTEN BECAUSE THE FIRST VERSION PASSED THE WRONG STRING AND NOTHING RED.
 * `requestModelTabSection` takes a section NAME; `MODEL_SECTION_TARGET` maps that
 * name to a testid, and its consumer coalesces a miss to the panel top
 * (`ModelTabBody.tsx:243`, `?? 'model-tab-v2-panel'`). So passing the TESTID is
 * silently degrading, never throwing: the user lands at the top of the outline
 * with nothing selected. A silent fallback on a navigation target is exactly the
 * shape that survives a green suite.
 *
 * This asserts the argument is a KEY OF THE MAP — not that it equals a particular
 * string, which a future rename would satisfy while pointing nowhere.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

/*
 * ⚠ THE CALLER MOVED, AND THE GUARD MOVED WITH IT (20 Sep 2026). The three-call
 * route was duplicated in `TriageActionCardsBody.tsx` and absent from the
 * pre-analysis sibling, which still opened the Inspector — one act, two
 * destinations. Both now call `openModelValueEditor`, so that module is where
 * the section key is stated and where this guard has to look. Pointing it at
 * the old file would have left it asserting a literal that is no longer there,
 * which this spec's own `expect(m, 'no literal ... found')` catches loudly
 * rather than passing vacuously.
 */
const CALLER = 'src/canvas/nodes/shared/openModelValueEditor.ts'
const MAP_HOST = 'src/canvas/components/ModelTabBody.tsx'

describe('the triage edit act targets a real Model-tab section', () => {
  const caller = readFileSync(CALLER, 'utf8')
  const host = readFileSync(MAP_HOST, 'utf8')

  it('both files are tracked and non-empty (positive control)', () => {
    for (const f of [CALLER, MAP_HOST]) {
      expect(execFileSync('git', ['ls-files', f], { encoding: 'utf8' }).trim()).toBe(f)
    }
    expect(caller.length).toBeGreaterThan(500)
    expect(host.length).toBeGreaterThan(1000)
  })

  /** The map's KEYS, derived from the host — never restated here (trap 12). */
  const sectionKeys = (): string[] => {
    const i = host.indexOf('const MODEL_SECTION_TARGET')
    expect(i, 'MODEL_SECTION_TARGET not found — has it been renamed?').toBeGreaterThan(-1)
    // ⚠ ENDS AT THE CLOSING BRACE AT COLUMN 0, NOT AT THE FIRST `}` (repaired
    // 9 Sep 2026). The map's values became OBJECTS (`{ group: 'factors' }`, so
    // one entry carries both the scroll target and the group to open), and
    // `indexOf('}')` then stopped inside the FIRST VALUE — the derived key set
    // collapsed to a single entry. The parse went blind; it did not go wrong
    // quietly, because `keys.length >= 4` below caught it immediately. That
    // assertion is why this repair is a parser fix and not a rewritten guard.
    //
    // The key regex is unchanged and still correct: it is anchored to the start
    // of a line, so an entry's INNER field names (`group`, `testId`) are never
    // mistaken for section keys.
    const end = host.indexOf('\n}', i)
    expect(end, 'MODEL_SECTION_TARGET has no closing brace at column 0').toBeGreaterThan(i)
    const block = host.slice(i, end)
    return [...block.matchAll(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)].map(m => m[1])
  }

  it('derives a plausible key set (guards against a blind parse)', () => {
    const keys = sectionKeys()
    expect(keys.length).toBeGreaterThanOrEqual(4)
    expect(keys).toContain('factors')
    // Contrast: the TESTID must NOT be a key. If it ever is, this spec's whole
    // premise is void and it must fail rather than quietly pass.
    expect(keys).not.toContain('model-group-v2-factors')
  })

  /**
   * ⚠ THE LITERAL MOVED INTO THE SIGNATURE (22 Sep 2026) AND THIS GUARD GOT
   * STRONGER RATHER THAN LOOSER. `openModelValueEditor` now takes the section
   * as a parameter — `'factors'` still the default, so the triage act is
   * unmoved — because the goal card needs the same act pointed at its own
   * group, and a SECOND copy of this route is the defect the caller's own
   * header is about.
   *
   * So the old assertion (one literal inside the function body) can no longer
   * hold: `requestModelTabSection(section)` passes a variable. Restating it
   * against the default alone would guard LESS than before, because the real
   * risk has changed shape — it is now that a CALL SITE passes a string that is
   * not a key. That is exactly the silent degradation the header describes, and
   * there is now more than one call site to get it wrong.
   *
   * ⛔ THIS THEREFORE CHECKS EVERY CALL SITE IN THE TREE, not the caller alone,
   * and it derives the call sites rather than listing them.
   */
  it('the default section is a KEY of the map, not a testid', () => {
    const m = caller.match(/section:\s*ModelTabSectionId\s*=\s*'([^']+)'/)
    expect(m, "no defaulted `section: ModelTabSectionId = '…'` found in the caller").toBeTruthy()
    const arg = m![1]
    expect(
      sectionKeys(),
      `the default section '${arg}' is not a key of MODEL_SECTION_TARGET, so the `
        + "consumer's `?? 'model-tab-v2-panel'` fallback will land the user at the panel "
        + 'top with nothing selected.',
    ).toContain(arg)
    expect(arg).toBe('factors')
    // And the request itself must pass the parameter through — a re-hardcoded
    // literal here would silently ignore every caller's destination.
    expect(caller).toMatch(/requestModelTabSection\(\s*section\s*\)/)
  })

  it('EVERY call site passes a section that is a key of the map', () => {
    const files = execFileSync('git', ['grep', '-l', 'openModelValueEditor(', '--', 'src'], {
      encoding: 'utf8',
    })
      .split('\n')
      // ⚠ AND THIS FILE EXCLUDES ITSELF, because its own failure message spells
      // `openModelValueEditor(…, '${a}')` and the sweep matched that template —
      // a probe reading its own text as evidence. Caught on the first run.
      .filter(
        f =>
          f.length > 0
          && !f.endsWith('openModelValueEditor.ts')
          && !f.endsWith('triageEditActRoutesToFactors.spec.ts'),
      )
    // Positive control: the sweep must find call sites at all. A renamed export
    // would otherwise make this pass by finding nothing.
    expect(files.length, 'no call sites found — has the export been renamed?').toBeGreaterThan(0)

    const keys = sectionKeys()
    const args: string[] = []
    for (const f of files) {
      const body = readFileSync(f, 'utf8')
      for (const mm of body.matchAll(/openModelValueEditor\(\s*[^,)]+,\s*'([^']+)'\s*\)/g)) {
        args.push(mm[1])
      }
    }
    // Contrast control, in this run: a fabricated section must be rejected by
    // the very predicate the real arguments are judged with. Without it, an
    // empty `args` would read as a clean pass.
    expect(keys.includes('not-a-real-section')).toBe(false)
    for (const a of args) {
      expect(keys, `openModelValueEditor(…, '${a}') is not a key of MODEL_SECTION_TARGET`).toContain(a)
    }
  })
})
