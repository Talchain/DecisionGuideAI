#!/usr/bin/env node
// scripts/core-e2e/resolve-immutable-target.mjs
// =============================================================================
// RESOLVE THE IMMUTABLE DEPLOY THE CORE SUITE WILL MEASURE — BEFORE IT STARTS.
// =============================================================================
//
// THE DEFECT THIS CLOSES, MEASURED 2026-08-29 ACROSS ALL 13 CORE E2E JOBS EVER RUN
// ON `staging`. Every one failed. TWELVE failed on `BUILD DRIFTED MID-RUN`, and the
// drift was not random: in EVERY case the run started on the PREVIOUS commit and
// ended on the commit that triggered it.
//
//   started on 7be2140b, ended on b7ce774d   (job 99020413272, push of b7ce774d)
//   started on 599ba4c6, ended on 7be2140b   (job 99014560368, push of 7be2140b)
//   started on d95158c8, ended on 30c2ce73   (job 98989074742, push of 30c2ce73)
//   ... 12 of 13, same shape.
//
// The push that starts the workflow ALSO starts the Netlify build. The job reached
// its "record the target" step ~60s later, while the alias was still serving the
// PREVIOUS build, and Netlify published underneath the run. So the suite has NEVER
// ONCE MEASURED THE COMMIT THAT TRIGGERED IT. Eight of those runs were 3/3 green —
// greens about a build that did not contain the push. Only the drift guard stopped
// them being reported as verification of the pushed commit.
//
// ⭐ THE ONE-COMMIT LAG IS THE NORMAL CASE, NOT AN EDGE CASE. Any design that reads
// the alias once and proceeds is not "slightly racy" here — it is wrong ~92% of the
// time, and wrong in the direction that certifies the wrong build.
//
// ── WHY THIS IS NOT THE SAME RACE ONE LAYER UP ──────────────────────────────────
// The obvious fix — "read the alias at job start, take its deploy_url" — pins
// ATTRIBUTION but not TARGETING. It would have driven the previous build in 12 of 13
// runs and said so accurately. Accurate about the wrong build is still the wrong
// build.
//
// So the alias is used ONLY AS A DISCOVERY CHANNEL, never as the target, and the
// predicate that decides acceptance is `commit === CORE_EXPECT_COMMIT` — a property
// of the SAMPLE, not of the clock. That is what makes this non-racy:
//
//   1. TARGETING cannot go wrong. A concurrent deploy can only make us poll longer
//      or time out. It can never make us accept the wrong build, because a wrong
//      build fails the predicate. There is no window in which the wrong answer is
//      accepted — only windows in which no answer is yet available.
//   2. ATTRIBUTION cannot go wrong. Acceptance pins to `deploy_url` from the SAME
//      atomic JSON body that carried the matching commit, and a Netlify deploy
//      permalink is immutable by construction. Once pinned, `globalSetup`'s and
//      `globalTeardown`'s reads of `/version.json` are reads of a FIXED artefact, so
//      drift is impossible BY CONSTRUCTION rather than by luck.
//   3. THE PIN IS VERIFIED, NOT ASSUMED. Before the browser starts we fetch the
//      permalink itself and assert it is 200, that its `commit` equals the commit we
//      matched, and that its `deploy_id` equals the id embedded in its own hostname.
//      A permalink that 404s is a HARD ERROR here, which is the only place it can be
//      turned into one before 5 minutes of browser time are spent on it.
//
// ⛔ THERE IS NO FALLBACK TO THE ALIAS. Not on timeout, not on 404, not on a
// malformed body. Falling back would reintroduce exactly the defect above while
// printing a reassuring line about having tried. If this script cannot name the
// build, the run does not start.
//
// ── WHY NOT THE NETLIFY API (SHA -> DEPLOY, DIRECTLY) ────────────────────────────
// It would be the better instrument and it is not available. DERIVED 2026-08-29,
// with a contrast control rather than a bare absence claim:
//   · `gh api repos/Talchain/DecisionGuideAI/actions/secrets` -> ["PACKAGES_READ_TOKEN"].
//     One secret, and it is not a Netlify token. (Contrast: the call returns a
//     populated list, so the probe can see secrets when they exist.)
//   · `/deployments` -> 0, `/commits/<sha>/status` -> total_count 0. Netlify posts
//     neither a GitHub Deployment nor a commit status on this repo, so the SHA ->
//     deploy map does not exist on the GitHub side either.
// If a NETLIFY_AUTH_TOKEN is ever added, `GET /api/v1/sites/{site}/deploys` filtered
// on `commit_ref` + `state == "ready"` is a strictly better discovery channel and
// slots in at `discover()` below WITHOUT changing the acceptance predicate, the pin
// verification, or the no-fallback rule — which are the parts that carry the
// correctness argument.
//
// ⚠ THE RESIDUAL RACE, STATED RATHER THAN HIDDEN. If two pushes land close enough
// that the alias never once serves the expected commit (it jumps straight past it),
// this script never matches and FAILS on budget. It does not mis-attribute. That is
// the deliberate trade: a missing verdict, never a false one. In this repo the newer
// push also cancels the older run (`concurrency.cancel-in-progress`), so the usual
// outcome is a cancelled run rather than a red one.

export const DEFAULT_ALIAS = 'https://staging--olumi.netlify.app'

/**
 * A Netlify deploy permalink: `https://<deploy id>--<site>.netlify.app`.
 *
 * The id is hex and Netlify currently mints 24 characters, but the LENGTH is not
 * ours to pin — a narrower pattern would silently stop recognising permalinks if
 * Netlify widened the id, and `isImmutableTarget` returning false would push a
 * legitimate pinned target down the polling path. Anchored at both ends so a URL
 * with a path or query is NOT treated as a bare permalink.
 */
export const DEPLOY_PERMALINK_RE =
  /^https:\/\/([0-9a-f]{8,64})--([a-z0-9][a-z0-9-]*)\.netlify\.app\/?$/

/** `{ deployId, site }` for a deploy permalink, else null. */
export function parseDeployPermalink(url) {
  if (typeof url !== 'string') return null
  const m = DEPLOY_PERMALINK_RE.exec(url.trim())
  return m ? { deployId: m[1], site: m[2] } : null
}

/** True when the URL cannot move under a running suite. */
export function isImmutableTarget(url) {
  return parseDeployPermalink(url) !== null
}

/** Strip a trailing slash so `${target}/version.json` never doubles it. */
export const normaliseTarget = (url) => String(url ?? '').trim().replace(/\/+$/, '')

/**
 * The fields this resolver needs out of `/version.json`.
 *
 * Returns null for anything it cannot read, and the CALLER decides whether that is
 * transient or fatal. Deliberately does NOT default a missing commit to a placeholder:
 * a placeholder that flows into an equality check is how "unknown === unknown" becomes
 * a pass, which is the shape of the hole this whole change exists to close.
 */
export function readVersionFields(body) {
  let j = body
  if (typeof body === 'string') {
    try {
      j = JSON.parse(body)
    } catch {
      return null
    }
  }
  if (!j || typeof j !== 'object') return null
  const commit = typeof j.commit === 'string' && j.commit ? j.commit : null
  if (!commit) return null
  return {
    commit,
    short: typeof j.short === 'string' && j.short ? j.short : commit.slice(0, 8),
    deployId: typeof j.deploy_id === 'string' && j.deploy_id ? j.deploy_id : null,
    deployUrl: typeof j.deploy_url === 'string' && j.deploy_url ? j.deploy_url : null,
  }
}

/**
 * ⭐ THE ACCEPTANCE PREDICATE — the whole correctness argument lives here.
 *
 * Verdicts:
 *   'malformed'  — could not read a commit. TRANSIENT: a deploy swap can serve a
 *                  partial body for an instant. Keep polling; the budget still fails.
 *   'wait'       — a commit was read and it is NOT the one this run must measure.
 *                  This is the ONLY branch the one-commit lag can reach, and it can
 *                  never turn into 'accept' for the wrong build.
 *   'unpinnable' — the RIGHT build, with no immutable address. FATAL: waiting cannot
 *                  produce a deploy stamp for a build that shipped without one, and
 *                  the alternative is the alias, which is the defect.
 *   'accept'     — the right build AND an immutable address for it.
 *
 * ORDER IS THE CONTRACT. The commit check comes BEFORE the pinnability check on
 * purpose: while we are waiting for our commit, the alias is serving somebody else's,
 * and an unstamped build sitting there is not this run's problem. Checking
 * pinnability first would turn another build's defect into this run's fatal error.
 */
export function classifySample(sample, expectedCommit) {
  if (!sample || !sample.commit) {
    return { verdict: 'malformed', reason: 'no commit field in /version.json' }
  }
  if (expectedCommit && sample.commit !== expectedCommit) {
    return {
      verdict: 'wait',
      reason:
        `serving ${sample.short} (${sample.commit}); waiting for ` +
        `${String(expectedCommit).slice(0, 8)} (${expectedCommit})`,
    }
  }
  if (!sample.deployUrl || !sample.deployId) {
    return {
      verdict: 'unpinnable',
      reason:
        `build ${sample.short} serves no deploy_id/deploy_url in /version.json, so it ` +
        `has no immutable address. This build cannot be measured attributably.`,
    }
  }
  if (!isImmutableTarget(sample.deployUrl)) {
    return {
      verdict: 'unpinnable',
      reason: `deploy_url ${sample.deployUrl} is not a Netlify deploy permalink`,
    }
  }
  return { verdict: 'accept', reason: `build ${sample.short} at ${sample.deployUrl}` }
}

/**
 * Prove the permalink we are about to hand to the suite is the build we matched.
 *
 * Three separate claims, each of which has to hold:
 *   · the permalink RESPONDS (a 404 is fatal HERE, not 5 minutes into a browser run);
 *   · it serves the SAME COMMIT as the sample that made us accept it;
 *   · its `deploy_id` equals the id in its OWN HOSTNAME — a self-consistency check,
 *     which is what licenses the claim that reading it twice cannot disagree.
 *
 * `pin` is null when the fetch failed, and that is a distinct message from a
 * mismatch: "unreachable" and "wrong" are different findings and a single
 * "verification failed" would hide which one happened.
 */
export function assertPinVerified({ pinUrl, matched, pin, httpStatus }) {
  const host = parseDeployPermalink(pinUrl)
  if (!host) {
    throw new Error(
      `[core] PIN REJECTED: ${pinUrl} is not a Netlify deploy permalink, so it is not immutable.`,
    )
  }
  if (!pin) {
    throw new Error(
      `[core] PIN UNREACHABLE: ${pinUrl}/version.json did not return a readable body ` +
        `(HTTP ${httpStatus ?? 'no response'}).\n` +
        `  An immutable URL that 404s must NOT degrade into "use the alias" or "skip" — a\n` +
        `  suite that cannot reach its target has measured nothing, and a run that measured\n` +
        `  nothing must not report a verdict about any build.`,
    )
  }
  if (pin.commit !== matched.commit) {
    throw new Error(
      `[core] PIN INCONSISTENT: the alias reported ${matched.short} (${matched.commit}) at\n` +
        `  ${pinUrl}, but that URL itself serves ${pin.short} (${pin.commit}).\n` +
        `  These must agree. Refusing to run rather than guess which one is the build.`,
    )
  }
  if (pin.deployId !== host.deployId) {
    throw new Error(
      `[core] PIN INCONSISTENT: ${pinUrl} serves deploy_id ${pin.deployId}, which is not the\n` +
        `  id in its own hostname (${host.deployId}). The permalink does not identify itself,\n` +
        `  so a later read of it cannot be trusted to describe the same artefact.`,
    )
  }
  return { url: normaliseTarget(pinUrl), commit: pin.commit, short: pin.short, deployId: pin.deployId }
}

const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetch and parse `<target>/version.json`. Never throws: the caller's polling loop
 * decides what a failure means, and a throw here would collapse "transient blip"
 * and "permanently wrong" into one outcome.
 */
async function readVersion(target, fetchImpl, timeoutMs = 30_000) {
  try {
    // ⚠ PER-REQUEST TIMEOUT, OR THE "BOUNDED" WAIT IS NOT BOUNDED. Found by using this
    // script rather than by reading it: `fetch` has no default timeout, and the budget
    // is only consulted BETWEEN samples — so one stalled connection hangs the resolver
    // past any budget, and a hang looks exactly like a slow deploy. `AbortSignal` is
    // only attached when the runtime provides it, so an injected `fetchImpl` in a test
    // is unaffected.
    const init = { cache: 'no-store' }
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      init.signal = AbortSignal.timeout(timeoutMs)
    }
    const r = await fetchImpl(`${normaliseTarget(target)}/version.json`, init)
    const text = await r.text()
    return { status: r.status, fields: r.ok ? readVersionFields(text) : null }
  } catch (e) {
    return { status: null, fields: null, error: String((e && e.message) || e) }
  }
}

/**
 * Resolve the immutable target the suite must drive.
 *
 * IO is injected (`fetchImpl`, `sleep`, `now`, `log`) so the acceptance behaviour —
 * including the timeout path and the one-commit lag — is provable in the required
 * test suite without a network, a clock, or a deployed build.
 */
export async function resolveImmutableTarget({
  aliasUrl = DEFAULT_ALIAS,
  expectedCommit = '',
  budgetMs = 600_000,
  pollMs = 10_000,
  fetchTimeoutMs = 30_000,
  fetchImpl = fetch,
  sleep = sleepReal,
  now = () => Date.now(),
  log = () => {},
} = {}) {
  const target = normaliseTarget(aliasUrl)
  const expected = String(expectedCommit || '').trim()

  // ── ALREADY PINNED ────────────────────────────────────────────────────────────
  // A permalink cannot move, so there is nothing to wait for. It is still VERIFIED:
  // "immutable" is a claim about change over time, not a claim that the URL exists
  // or that it holds the build somebody thinks it holds.
  if (isImmutableTarget(target)) {
    const { status, fields } = await readVersion(target, fetchImpl, fetchTimeoutMs)
    // ⚠ HONEST NOTE ON WHICH LIMBS BITE HERE. There is no separate alias sample on
    // this path, so `matched` and `pin` are the same object and the commit-equality
    // limb is trivially satisfied — it is NOT evidence on this path. The two limbs
    // that are load-bearing here are REACHABILITY (a 404 permalink is fatal) and the
    // deploy_id/hostname SELF-CONSISTENCY check. Said out loud because a check that
    // compares a value with itself reads exactly like a check that passed.
    const verified = assertPinVerified({
      pinUrl: target,
      matched: fields ?? { commit: null, short: 'n/a' },
      pin: fields,
      httpStatus: status,
    })
    if (expected && verified.commit !== expected) {
      throw new Error(
        `[core] PINNED TO THE WRONG BUILD: ${target} serves ${verified.short} ` +
          `(${verified.commit}),\n  but this run was told to measure ${expected.slice(0, 8)} ` +
          `(${expected}).\n  Refusing: a green here would be a verdict about a build nobody asked about.`,
      )
    }
    log(`[core] target is already immutable: ${target} (build ${verified.short})`)
    return { ...verified, waitedMs: 0, samples: 1, discoveredVia: 'pinned' }
  }

  // ── DISCOVERY ─────────────────────────────────────────────────────────────────
  const started = now()
  let samples = 0
  let last = 'no sample taken'
  for (;;) {
    samples += 1
    const { status, fields, error } = await readVersion(target, fetchImpl, fetchTimeoutMs)
    const c = classifySample(fields, expected)

    if (c.verdict === 'accept') {
      log(`[core] alias resolved after ${samples} sample(s): ${c.reason}`)
      const pinUrl = fields.deployUrl
      const p = await readVersion(pinUrl, fetchImpl, fetchTimeoutMs)
      const verified = assertPinVerified({
        pinUrl,
        matched: fields,
        pin: p.fields,
        httpStatus: p.status,
      })
      return {
        ...verified,
        waitedMs: now() - started,
        samples,
        discoveredVia: expected ? 'alias-matched-expected-commit' : 'alias-first-sample',
      }
    }

    // FATAL, and NOT retried: waiting cannot conjure a deploy stamp onto a build
    // that shipped without one.
    if (c.verdict === 'unpinnable') {
      throw new Error(
        `[core] TARGET CANNOT BE PINNED: ${c.reason}\n` +
          `  Not falling back to the mutable alias ${target} — that is the defect this\n` +
          `  resolver exists to remove.`,
      )
    }

    last =
      c.verdict === 'malformed'
        ? `${c.reason}${error ? ` (${error})` : ''}${status ? ` [HTTP ${status}]` : ''}`
        : c.reason

    const elapsed = now() - started
    if (elapsed + pollMs > budgetMs) {
      // ⭐ REQUIREMENT: "a deploy for the commit may not exist yet". This is that case,
      // and the decision is to WAIT WITH A BOUND and then FAIL — never to fall back.
      throw new Error(
        `[core] NO DEPLOY FOR THIS COMMIT WITHIN ${Math.round(budgetMs / 1000)}s.\n` +
          `  Alias      : ${target}\n` +
          `  Last seen  : ${last}\n` +
          `  Samples    : ${samples} over ${Math.round(elapsed / 1000)}s\n` +
          (expected
            ? `  Expected   : ${expected}\n` +
              `  Netlify had not published this commit before the budget expired, or it was\n` +
              `  superseded by a newer push before this run ever sampled it.\n`
            : `  The alias never served a readable /version.json.\n`) +
          `  NOT FALLING BACK TO THE ALIAS. Driving the alias is what made 12 of the last 13\n` +
          `  Core E2E runs unattributable, and 8 of those were 3/3 green about the WRONG BUILD.\n` +
          `  Raise CORE_RESOLVE_BUDGET_MS, or re-run once the deploy is live.`,
      )
    }
    log(`[core] waiting ${Math.round(pollMs / 1000)}s — ${last}`)
    await sleep(pollMs)
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────────
// Prints ONLY the resolved URL on stdout, so a caller can do
// `CORE_UI_URL=$(node scripts/core-e2e/resolve-immutable-target.mjs)`.
// Everything human goes to stderr. Exit 1 with the reason on any failure.
const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
  } catch {
    return false
  }
})()

if (isMain) {
  const out = await resolveImmutableTarget({
    aliasUrl: process.env.CORE_UI_URL || DEFAULT_ALIAS,
    expectedCommit: process.env.CORE_EXPECT_COMMIT || '',
    budgetMs: Number(process.env.CORE_RESOLVE_BUDGET_MS || 600_000),
    pollMs: Number(process.env.CORE_RESOLVE_POLL_MS || 10_000),
    fetchTimeoutMs: Number(process.env.CORE_RESOLVE_FETCH_TIMEOUT_MS || 30_000),
    log: (m) => process.stderr.write(`${m}\n`),
  }).catch((e) => {
    process.stderr.write(`${e.message}\n`)
    process.exit(1)
  })

  process.stderr.write(
    `[core] RESOLVED: ${out.url}\n` +
      `[core]   build     ${out.short} (${out.commit})\n` +
      `[core]   deploy_id ${out.deployId}\n` +
      `[core]   waited    ${Math.round(out.waitedMs / 1000)}s over ${out.samples} sample(s), via ${out.discoveredVia}\n`,
  )
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `url=${out.url}\nbuild=${out.commit}\nshort=${out.short}\ndeploy_id=${out.deployId}\n`,
    )
  }
  process.stdout.write(`${out.url}\n`)
}
