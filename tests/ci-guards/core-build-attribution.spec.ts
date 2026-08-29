// tests/ci-guards/core-build-attribution.spec.ts
// =============================================================================
// CAN SYSTEM E ATTRIBUTE ITS RESULT TO A BUILD?
// =============================================================================
//
// THE MEASURED DEFECT, 2026-08-29. Every Core E2E job ever run on `staging` failed:
// 13 of 13. TWELVE failed on `BUILD DRIFTED MID-RUN`, and the drift had one shape —
// the run started on the PREVIOUS commit and ended on the commit that triggered it:
//
//   job 99020413272 (push b7ce774d): started on 7be2140b, ended on b7ce774d — 3 passed
//   job 99014560368 (push 7be2140b): started on 599ba4c6, ended on 7be2140b — 3 passed
//   job 98989074742 (push 30c2ce73): started on d95158c8, ended on 30c2ce73 — 3 passed
//
// The push starts the workflow AND the Netlify build; the job read the alias ~60s in,
// while it still served the previous build, and Netlify published mid-run. So the
// suite has never once measured the commit that triggered it, and EIGHT of those runs
// were 3/3 green about a build that did not contain the push. Only the drift guard
// stopped them being cited as verification.
//
// ⚠ WHAT THIS SUITE PINS, AND WHAT IT CANNOT. These are the DECISIONS — the acceptance
// predicate, the three refusals, the no-fallback rule — executed with injected IO, so
// they are provable without a network, a clock or a deployed build. They are NOT
// evidence that Netlify behaves as described; that is established by driving it, and
// the live both-directions run is recorded in the PR. A green here means the logic is
// right, never that the world is.

import { describe, expect, it } from 'vitest'

import {
  assertAttributableBuild,
  namesABuild,
  targetIsImmutable,
} from '../../e2e/core/lib/manifest'
import {
  classifySample,
  isImmutableTarget,
  readVersionFields,
  resolveImmutableTarget,
} from '../../scripts/core-e2e/resolve-immutable-target.mjs'

const OLD = '7be2140b'
const NEW = 'b7ce774d'
const OLD_FULL = '7be2140b'.padEnd(40, '0')
const NEW_FULL = 'b7ce774d722f98c997cb21e89a5272d84c57a42b'

const DEPLOY_OLD = 'https://6a9223f107b05d0008403457--olumi.netlify.app'
const DEPLOY_NEW = 'https://6a9223f107b05d0008403458--olumi.netlify.app'
const ALIAS = 'https://staging--olumi.netlify.app'

const version = (commit: string, short: string, deployUrl: string | null) => ({
  commit,
  short,
  branch: 'HEAD',
  timestamp: '2026-08-29T00:14:04Z',
  ...(deployUrl
    ? { deploy_id: /\/\/([0-9a-f]+)--/.exec(deployUrl)![1], deploy_url: deployUrl }
    : {}),
})

/**
 * A fake network keyed on URL. `aliasScript` yields one body per call, so the
 * ONE-COMMIT LAG can be replayed exactly: the alias answers "previous build" N times
 * and then "the pushed build".
 */
function net(aliasScript: unknown[], fixed: Record<string, unknown | number> = {}) {
  const calls: string[] = []
  let i = 0
  const fetchImpl = async (url: string) => {
    calls.push(url)
    const base = url.replace(/\/version\.json$/, '')
    if (base === ALIAS) {
      const body = aliasScript[Math.min(i, aliasScript.length - 1)]
      i += 1
      if (typeof body === 'number') return { ok: false, status: body, text: async () => '' }
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    }
    const hit = fixed[base]
    if (hit === undefined) return { ok: false, status: 404, text: async () => 'Not Found' }
    if (typeof hit === 'number') return { ok: false, status: hit, text: async () => '' }
    return { ok: true, status: 200, text: async () => JSON.stringify(hit) }
  }
  return { fetchImpl, calls }
}

/** A deterministic clock: every sleep advances it, so a budget expires without waiting. */
function clock() {
  let t = 0
  return { now: () => t, sleep: async (ms: number) => { t += ms } }
}

// ═════════════════════════════════════════════════════════════════════════════
describe('the three refusals — a run that cannot name its build must not pass', () => {
  // ── DIRECTION 1: what the guard must now REFUSE ────────────────────────────
  it('REFUSES a run whose start build was never established', () => {
    expect(() => assertAttributableBuild('unknown', NEW)).toThrow(/CANNOT NAME ITS BUILD/)
  })

  it('REFUSES a run whose target became unreadable by teardown', () => {
    expect(() => assertAttributableBuild(NEW, 'unreachable')).toThrow(/UNREADABLE AT TEARDOWN/)
  })

  it('REFUSES a run whose build moved underneath it', () => {
    expect(() => assertAttributableBuild(OLD, NEW)).toThrow(/BUILD DRIFTED MID-RUN/)
  })

  // ── DIRECTION 2: what it must still ALLOW ─────────────────────────────────
  // Without this half, `throw new Error()` unconditionally would pass every test
  // above, and the suite could never be green.
  it('ALLOWS a run that began and ended on the same named build', () => {
    expect(() => assertAttributableBuild(NEW, NEW)).not.toThrow()
    expect(() => assertAttributableBuild(NEW_FULL, NEW_FULL)).not.toThrow()
  })

  // ⭐ THE REGRESSION PIN — THE HOLE, EXECUTED. This is the guard that SHIPPED,
  // reproduced verbatim. Both cases below are ones it lets through, and the two
  // assertions in each `it` are a discriminating pair: the old expression does NOT
  // fire, the new one does. If someone reinstates either leading conjunct "to reduce
  // noise", these go red and name what was traded away.
  const shippedGuardFires = (started: string, ended: string): boolean =>
    started !== 'unknown' && ended !== 'unreachable' && started !== ended

  it('the SHIPPED guard was disarmed by its own first conjunct — pinned', () => {
    expect(shippedGuardFires('unknown', NEW)).toBe(false) // silently passed
    expect(() => assertAttributableBuild('unknown', NEW)).toThrow() // now refuses
  })

  it('the SHIPPED guard was disarmed by an unreachable teardown read — pinned', () => {
    expect(shippedGuardFires(NEW, 'unreachable')).toBe(false) // silently passed
    expect(() => assertAttributableBuild(NEW, 'unreachable')).toThrow() // now refuses
  })

  it('NOTHING THAT FAILED BEFORE NOW PASSES: the drift limb is unchanged', () => {
    // The change must be strictly stronger. Where the shipped guard fired, so must this.
    for (const [a, b] of [[OLD, NEW], [NEW, OLD], ['aaaaaaa', 'bbbbbbb']]) {
      expect(shippedGuardFires(a, b)).toBe(true)
      expect(() => assertAttributableBuild(a, b)).toThrow()
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('namesABuild is a positive predicate, not a sentinel list', () => {
  it('accepts short and full commits', () => {
    expect(namesABuild(NEW)).toBe(true)
    expect(namesABuild(NEW_FULL)).toBe(true)
  })

  // The reason it is written as "looks like a commit" rather than
  // "!== 'unknown' && !== 'unreachable'": a THIRD placeholder invented later is
  // rejected automatically. A sentinel list would have to be remembered.
  it('rejects any placeholder, including ones nobody has invented yet', () => {
    for (const p of ['unknown', 'unreachable', '', 'pending', 'n/a', 'TBD', 'null']) {
      expect(namesABuild(p)).toBe(false)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('the two immutability implementations must agree — fail-loud on drift', () => {
  // `manifest.ts` (TypeScript, compiled by the typecheck gate) and the resolver
  // (`.mjs`, runs before Playwright exists) each carry the rule. This is the guard
  // that makes the duplication safe: edit one alone and this goes red.
  const CORPUS: Array<[string, boolean]> = [
    [DEPLOY_NEW, true],
    ['https://6a9223f107b05d0008403458--olumi.netlify.app/', true],
    ['https://deadbeef--some-site.netlify.app', true],
    [ALIAS, false], // the mutable alias — the whole point
    ['https://olumi.netlify.app', false],
    ['https://6a9223f107b05d0008403458--olumi.netlify.app/canvas', false], // has a path
    ['https://6a9223f107b05d0008403458--olumi.example.com', false],
    ['http://6a9223f107b05d0008403458--olumi.netlify.app', false], // not https
    ['https://ZZZZ--olumi.netlify.app', false], // not hex
    ['', false],
  ]

  it.each(CORPUS)('%s -> %s, in BOTH implementations', (url, expected) => {
    expect(targetIsImmutable(url)).toBe(expected)
    expect(isImmutableTarget(url)).toBe(expected)
  })

  // A corpus of all-true or all-false cases would pass against a constant function.
  it('the corpus discriminates — it contains both verdicts', () => {
    expect(CORPUS.some(([, v]) => v)).toBe(true)
    expect(CORPUS.some(([, v]) => !v)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('readVersionFields refuses to invent a commit', () => {
  it('reads the real staging body', () => {
    const f = readVersionFields(JSON.stringify(version(NEW_FULL, NEW, DEPLOY_NEW)))
    expect(f).toMatchObject({ commit: NEW_FULL, short: NEW, deployUrl: DEPLOY_NEW })
  })

  // A placeholder that flows into an equality check is how `unknown === unknown`
  // becomes a pass — the exact shape of the hole this change closes.
  it('returns null rather than a placeholder for an unusable body', () => {
    for (const b of ['', 'not json', '{}', '{"commit":""}', '{"short":"abc"}']) {
      expect(readVersionFields(b)).toBeNull()
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('the acceptance predicate — targeting cannot go wrong', () => {
  const right = readVersionFields(JSON.stringify(version(NEW_FULL, NEW, DEPLOY_NEW)))
  const wrong = readVersionFields(JSON.stringify(version(OLD_FULL, OLD, DEPLOY_OLD)))
  const unstamped = readVersionFields(JSON.stringify(version(NEW_FULL, NEW, null)))

  it('WAITS on the previous build — the one-commit lag, which is the normal case', () => {
    expect(classifySample(wrong, NEW_FULL).verdict).toBe('wait')
  })

  it('ACCEPTS the expected build', () => {
    expect(classifySample(right, NEW_FULL).verdict).toBe('accept')
  })

  // The discriminating pair: 'wait' must be about the COMMIT, not about the sample
  // being second, or malformed, or anything else that happens to co-occur.
  it('accepts the SAME sample once it is the expected one', () => {
    expect(classifySample(wrong, OLD_FULL).verdict).toBe('accept')
    expect(classifySample(right, OLD_FULL).verdict).toBe('wait')
  })

  it('ACCEPTS anything when no commit is demanded — attribution without targeting', () => {
    expect(classifySample(wrong, '').verdict).toBe('accept')
  })

  it('refuses a build with no immutable address rather than using the alias', () => {
    expect(classifySample(unstamped, NEW_FULL).verdict).toBe('unpinnable')
  })

  // ⭐ ORDER IS THE CONTRACT. While we wait for our commit the alias serves someone
  // else's, and an unstamped build sitting there is not this run's problem. If
  // pinnability were checked first, another build's defect would kill this run.
  it('an UNSTAMPED build that is not ours is a WAIT, never a fatal error', () => {
    const otherUnstamped = readVersionFields(JSON.stringify(version(OLD_FULL, OLD, null)))
    expect(classifySample(otherUnstamped, NEW_FULL).verdict).toBe('wait')
  })

  it('treats an unreadable body as transient, not as an answer', () => {
    expect(classifySample(null, NEW_FULL).verdict).toBe('malformed')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('resolveImmutableTarget — end to end, with injected IO', () => {
  // ⭐ THE HEADLINE CASE: replay the exact production shape. The alias serves the
  // PREVIOUS build for three samples, then Netlify publishes. The resolver must land
  // on the pushed commit's permalink and must NEVER return the previous one.
  it('waits out the one-commit lag and pins the PUSHED commit', async () => {
    const { fetchImpl } = net(
      [
        version(OLD_FULL, OLD, DEPLOY_OLD),
        version(OLD_FULL, OLD, DEPLOY_OLD),
        version(OLD_FULL, OLD, DEPLOY_OLD),
        version(NEW_FULL, NEW, DEPLOY_NEW),
      ],
      {
        [DEPLOY_NEW]: version(NEW_FULL, NEW, DEPLOY_NEW),
        [DEPLOY_OLD]: version(OLD_FULL, OLD, DEPLOY_OLD),
      },
    )
    const out = await resolveImmutableTarget({
      aliasUrl: ALIAS, expectedCommit: NEW_FULL, fetchImpl, ...clock(),
    })
    expect(out.url).toBe(DEPLOY_NEW)
    expect(out.commit).toBe(NEW_FULL)
    expect(out.samples).toBe(4)
    expect(out.url).not.toBe(DEPLOY_OLD)
    expect(out.url).not.toBe(ALIAS)
  })

  // ⚠ REQUIREMENT: "beware the case where a deploy for the commit does not exist yet".
  // The decision is BOUNDED WAIT, THEN FAIL — and the assertion that matters is the
  // second one: no alias anywhere in the outcome.
  it('FAILS on budget when the deploy never appears — and never falls back', async () => {
    const { fetchImpl } = net([version(OLD_FULL, OLD, DEPLOY_OLD)], {
      [DEPLOY_OLD]: version(OLD_FULL, OLD, DEPLOY_OLD),
    })
    await expect(
      resolveImmutableTarget({
        aliasUrl: ALIAS, expectedCommit: NEW_FULL,
        budgetMs: 60_000, pollMs: 10_000, fetchImpl, ...clock(),
      }),
    ).rejects.toThrow(/NO DEPLOY FOR THIS COMMIT WITHIN 60s[\s\S]*NOT FALLING BACK TO THE ALIAS/)
  })

  it('the timeout message names what it was waiting for and what it saw', async () => {
    const { fetchImpl } = net([version(OLD_FULL, OLD, DEPLOY_OLD)], {})
    const err = await resolveImmutableTarget({
      aliasUrl: ALIAS, expectedCommit: NEW_FULL, budgetMs: 30_000, fetchImpl, ...clock(),
    }).catch((e: Error) => e.message)
    expect(err).toContain(NEW_FULL)
    expect(err).toContain(OLD_FULL)
  })

  // ⚠ REQUIREMENT: an immutable URL that 404s must not degrade into skip or pass.
  it('HARD-FAILS when the resolved permalink 404s', async () => {
    const { fetchImpl } = net([version(NEW_FULL, NEW, DEPLOY_NEW)], {}) // permalink absent -> 404
    await expect(
      resolveImmutableTarget({ aliasUrl: ALIAS, expectedCommit: NEW_FULL, fetchImpl, ...clock() }),
    ).rejects.toThrow(/PIN UNREACHABLE[\s\S]*HTTP 404/)
  })

  it('HARD-FAILS when the permalink serves a different build than the alias claimed', async () => {
    const { fetchImpl } = net([version(NEW_FULL, NEW, DEPLOY_NEW)], {
      [DEPLOY_NEW]: version(OLD_FULL, OLD, DEPLOY_NEW),
    })
    await expect(
      resolveImmutableTarget({ aliasUrl: ALIAS, expectedCommit: NEW_FULL, fetchImpl, ...clock() }),
    ).rejects.toThrow(/PIN INCONSISTENT/)
  })

  it('HARD-FAILS when a permalink does not identify itself', async () => {
    // deploy_id in the body disagrees with the id in its own hostname.
    const lying = { ...version(NEW_FULL, NEW, DEPLOY_NEW), deploy_id: 'ffffffffffffffffffffffff' }
    const { fetchImpl } = net([version(NEW_FULL, NEW, DEPLOY_NEW)], { [DEPLOY_NEW]: lying })
    await expect(
      resolveImmutableTarget({ aliasUrl: ALIAS, expectedCommit: NEW_FULL, fetchImpl, ...clock() }),
    ).rejects.toThrow(/does not identify itself/)
  })

  it('passes an ALREADY-PINNED target straight through, after verifying it', async () => {
    const { fetchImpl, calls } = net([], { [DEPLOY_NEW]: version(NEW_FULL, NEW, DEPLOY_NEW) })
    const out = await resolveImmutableTarget({
      aliasUrl: DEPLOY_NEW, expectedCommit: NEW_FULL, fetchImpl, ...clock(),
    })
    expect(out.url).toBe(DEPLOY_NEW)
    expect(out.discoveredVia).toBe('pinned')
    // It cannot move, so there is nothing to poll: exactly one read, and no alias read.
    expect(calls).toEqual([`${DEPLOY_NEW}/version.json`])
  })

  it('REFUSES an already-pinned target that holds the wrong build', async () => {
    const { fetchImpl } = net([], { [DEPLOY_OLD]: version(OLD_FULL, OLD, DEPLOY_OLD) })
    await expect(
      resolveImmutableTarget({
        aliasUrl: DEPLOY_OLD, expectedCommit: NEW_FULL, fetchImpl, ...clock(),
      }),
    ).rejects.toThrow(/PINNED TO THE WRONG BUILD/)
  })

  // Attribution without targeting: no expected commit, so whatever is live is taken —
  // but it is still PINNED, so the run is still attributable. This is the PR path.
  it('with no expected commit, pins the first live sample rather than the alias', async () => {
    const { fetchImpl } = net([version(OLD_FULL, OLD, DEPLOY_OLD)], {
      [DEPLOY_OLD]: version(OLD_FULL, OLD, DEPLOY_OLD),
    })
    const out = await resolveImmutableTarget({ aliasUrl: ALIAS, fetchImpl, ...clock() })
    expect(out.url).toBe(DEPLOY_OLD)
    expect(out.commit).toBe(OLD_FULL)
  })

  // ⭐ THE PROPERTY THAT MAKES THE TEARDOWN GUARD A PROOF RATHER THAN A SAMPLE:
  // repeated reads of a resolved permalink return the same build, EVEN AS THE ALIAS
  // MOVES ON underneath. This is the drift guard's precondition, executed.
  it('a resolved permalink keeps answering the same build while the alias moves', async () => {
    const { fetchImpl } = net(
      [version(NEW_FULL, NEW, DEPLOY_NEW), version(OLD_FULL, OLD, DEPLOY_OLD)],
      { [DEPLOY_NEW]: version(NEW_FULL, NEW, DEPLOY_NEW) },
    )
    const out = await resolveImmutableTarget({
      aliasUrl: ALIAS, expectedCommit: NEW_FULL, fetchImpl, ...clock(),
    })
    const r1 = readVersionFields(await (await fetchImpl(`${out.url}/version.json`)).text())
    const r2 = readVersionFields(await (await fetchImpl(`${out.url}/version.json`)).text())
    expect(r1!.commit).toBe(r2!.commit)
    expect(r1!.commit).toBe(NEW_FULL)
    // Meanwhile the alias has moved — which is exactly what used to break the run.
    const alias = readVersionFields(await (await fetchImpl(`${ALIAS}/version.json`)).text())
    expect(alias!.commit).not.toBe(NEW_FULL)
    // ...and assertAttributableBuild is satisfied on the pinned target, not on the alias.
    expect(() => assertAttributableBuild(r1!.short, r2!.short)).not.toThrow()
    expect(() => assertAttributableBuild(r1!.short, alias!.short)).toThrow(/DRIFTED/)
  })
})
