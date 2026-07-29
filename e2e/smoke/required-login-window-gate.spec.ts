// e2e/smoke/required-login-window-gate.spec.ts
// =============================================================================
// ROADMAP 2.126(b) — the required-login smoke that GATES the user-testing window.
// Spec source: TESTER-READINESS-PACK-2026-07-29.md §3 (charter-ratified 28 Jul).
// =============================================================================
//
// ⚠ THIS SPEC HAS NEVER BEEN EXECUTED AGAINST A LIVE ENVIRONMENT, DELIBERATELY.
//
// Required-login is NOT flipped on staging: `VITE_REQUIRE_LOGIN` exists in the
// UI (src/lib/poc.ts + src/flags.ts `isRequireLoginEnabled`) but the deployed
// build still serves guest mode, so every assertion below would be asserting
// against the wrong posture today. Flipping it is a Netlify env + redeploy
// decision that is Paul's window-posture call. **Live execution is deferred to
// the flip day.** What lands here is the gate itself, written and reviewed in
// advance so that on flip day the only remaining work is `pnpm e2e:staging:v5`
// with the env below set.
//
// Nothing in this file creates an account, sends a request, or touches staging
// unless an operator explicitly opts in via env (see GATING). A default run —
// local, CI, or otherwise — is SKIPPED and inert.
//
// -----------------------------------------------------------------------------
// TEST-ACCOUNT CREDENTIALS — THE TWO ENV VAR NAMES (never hardcode either)
// -----------------------------------------------------------------------------
//   SMOKE_EMAIL
//       The disposable smoke account's address. NEVER a real tester's address —
//       this account's rows are the deletion-runbook rehearsal (pack §2/§1.115).
//
//   SMOKE_SUPABASE_SERVICE_ROLE_KEY
//       Supabase service-role key for the staging project, used for exactly two
//       calls: provision the smoke account if absent, and mint its sign-in link.
//       Never logged, never asserted on, never written to a trace.
//
// ⚠ THE PACK PROPOSED `SMOKE_EMAIL` + `SMOKE_PASSWORD`. `SMOKE_PASSWORD` IS
//   UNIMPLEMENTABLE AND WAS NOT USED — verified at the bytes on staging tip
//   fe11ef9e:
//     · There is NO password auth in this UI. `LoginPage.tsx` offers exactly a
//       magic-link email field and Google OAuth. `AuthContext`'s `signIn`/`signUp`
//       are declared legacy no-ops that return
//       `new Error('Password auth removed — use magic link')`.
//     · Self-signup is IMPOSSIBLE: `signInWithMagicLink` calls
//       `supabase.auth.signInWithOtp({ …, options: { shouldCreateUser: false } })`,
//       and Google OAuth is gated by a dashboard "Before User Created" allowlist
//       hook. An unknown email gets the enumeration-safe "if this email is
//       registered…" state and NO account.
//   Naming an env var for a mechanism that does not exist is the false-label
//   defect (CLAUDE.md trap 14), so the pair above replaces it, and the account
//   is provisioned through the Supabase Admin API instead — which is the same
//   key and the same project the pack's §2 deletion runbook already uses.
//
//   ⚠⚠ CONSEQUENCE FOR THE WINDOW ITSELF, beyond this spec: the pilot-kit
//   invitation text ("each participant creates a free account at the start")
//   and pack §3 step 2 ("Create account") are NOT achievable through the
//   product. The 4 tester accounts MUST be pre-provisioned before the session.
//   Pack §4 already recommended pre-provisioning to dodge the built-in-SMTP
//   confirmation-email throttle; the real reason is harder than that — without
//   pre-provisioning, testers simply cannot get in at all.
//
// -----------------------------------------------------------------------------
// ENVIRONMENT
// -----------------------------------------------------------------------------
//   RUN_STAGING_E2E=1                 opt-in switch shared with the other staging gates
//   STAGING_UI_URL                    deployed UI origin, e.g. https://staging--olumi.netlify.app
//   STAGING_SUPABASE_URL              staging Supabase project URL
//   SMOKE_EMAIL                       (above)
//   SMOKE_SUPABASE_SERVICE_ROLE_KEY   (above)
//   REQUIRE_LOGIN_EXPECTED=1          OPTIONAL. Gate-day switch — see SKIP CONDITION.
//
// -----------------------------------------------------------------------------
// SKIP CONDITION (why this suite is runnable-but-skipped by default)
// -----------------------------------------------------------------------------
// A red suite on an environment that was never flipped is a BROKEN ALARM
// (CLAUDE.md trap 7): everyone learns to ignore it, and it is then worthless on
// the one morning it matters. So the suite skips in two distinct ways, and the
// distinction is the whole design:
//
//   (1) ENV ABSENT — module-scope `test.skip`. No browser, no network, no
//       account, no credential read. This is the default everywhere.
//
//   (2) ENV PRESENT BUT THE FLAG IS OFF — a POSTURE PROBE runs first, in a
//       fresh unauthenticated context with NO credentials, and opens
//       `/#/canvas`:
//         · login surface  → `VITE_REQUIRE_LOGIN` is ON  → the suite RUNS.
//         · canvas/guest   → `VITE_REQUIRE_LOGIN` is OFF → every remaining test
//                            SKIPS with that reason, and NO ACCOUNT IS CREATED
//                            (provisioning happens only inside the first
//                            running test, never in the probe).
//         · probe error    → HARD FAIL. The operator opted in explicitly; an
//                            unreachable deployed UI is a real red, not noise.
//
//   (3) `REQUIRE_LOGIN_EXPECTED=1` INVERTS case (2): a guest canvas becomes a
//       LOUD FAILURE instead of a skip. This is what pack §3 step 1 demands on
//       gate day — "if a guest canvas appears, the flag is OFF and the window is
//       NOT gated: fail loudly, don't skip". Set it on every gate run, from the
//       flip onward. It is deliberately NOT the default, because before the flip
//       the honest verdict is "not applicable", not "broken".
//
// GATE RULE (pack §3): GREEN on the morning of each session day, against the
// deployed staging build, before the team arrives, with REQUIRE_LOGIN_EXPECTED=1.
// Any RED and the window does not open that day. Keep the trace.
//
// -----------------------------------------------------------------------------
// WHAT THIS SPEC DOES NOT DO
// -----------------------------------------------------------------------------
// It does NOT delete anything. Teardown signs out and PRINTS the smoke account's
// user id and the scenario id it created, so an operator can run the pack §2
// deletion runbook against them. §2 executes only on Paul's explicit word, and a
// test that hard-deletes staging rows on its own would take that decision away.
//
// -----------------------------------------------------------------------------
// SELECTOR PROVENANCE (all derived at staging tip fe11ef9e — RE-CHECK ON FLIP DAY)
// -----------------------------------------------------------------------------
//   login email input      #login-email                      LoginPage.tsx
//   login submit           button "Send magic link"          LoginPage.tsx
//   first-use composer     [data-testid="first-use-composer"] FirstUseComposer.tsx:262
//   composer textarea      aria-label "Describe your decision" FirstUseComposer.tsx:314
//   send                   button[aria-label="Send"]          AIInputBar.tsx:516
//   graph nodes            .react-flow__node                  ReactFlowGraph
//   run analysis           [data-testid="btn-run-analysis"]    CanvasToolbar.tsx:347
//   results surface        [data-testid="outputs-dock"]        OutputsDock.tsx:1812
//   honest can't-confirm   [data-testid="results-tab-cannot-confirm-icon"] OutputsDock.tsx:1892
//   error banner           [data-testid="outputs-error-banner"] OutputsDock.tsx:2022,2120
//   routing                HashRouter; /canvas and / sit inside <AuthGuard>    AppPoC.tsx:909
// =============================================================================

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Gating (case 1) — module scope, evaluated before any fixture is created
// ---------------------------------------------------------------------------

const RUN_STAGING_E2E = process.env.RUN_STAGING_E2E === '1'
const STAGING_UI_URL = process.env.STAGING_UI_URL
const STAGING_SUPABASE_URL = process.env.STAGING_SUPABASE_URL
const SMOKE_EMAIL = process.env.SMOKE_EMAIL
const SMOKE_SUPABASE_SERVICE_ROLE_KEY = process.env.SMOKE_SUPABASE_SERVICE_ROLE_KEY
const REQUIRE_LOGIN_EXPECTED = process.env.REQUIRE_LOGIN_EXPECTED === '1'

const SHOULD_RUN =
  RUN_STAGING_E2E &&
  !!STAGING_UI_URL &&
  !!STAGING_SUPABASE_URL &&
  !!SMOKE_EMAIL &&
  !!SMOKE_SUPABASE_SERVICE_ROLE_KEY

test.skip(
  !SHOULD_RUN,
  'required-login window gate disabled (set RUN_STAGING_E2E=1 + STAGING_UI_URL + ' +
    'STAGING_SUPABASE_URL + SMOKE_EMAIL + SMOKE_SUPABASE_SERVICE_ROLE_KEY). ' +
    'No browser opened, no account created.',
)

// ---------------------------------------------------------------------------
// Budgets — a real V5 draft is 40–60 s; analysis is slower again.
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 45_000
const DRAFT_TIMEOUT_MS = 110_000
const ANALYSIS_TIMEOUT_MS = 150_000

/** Three sentences, deliberately messy, no PII — mirrors the pilot brief shape. */
const FIXTURE_BRIEF =
  'We run a 12-person consultancy and we are deciding whether to open a second office ' +
  'in Manchester next year or stay remote-first and spend the money on senior hires. ' +
  'We are worried about culture, our lease costs, and whether clients actually care.'

const uiUrl = (hashPath: string): string =>
  `${STAGING_UI_URL!.replace(/\/$/, '')}/#${hashPath}`

/** Bounded, non-leaky host token for triage logs. */
function hostFor(url: string | undefined): string {
  try {
    return new URL(url!).host
  } catch {
    return '<invalid-url>'
  }
}

/** Redact an email for logs: keep the domain, drop the local part. */
function redactEmail(email: string): string {
  const at = email.lastIndexOf('@')
  return at < 0 ? '<redacted>' : `<redacted>${email.slice(at)}`
}

// ---------------------------------------------------------------------------
// Supabase Admin API — the ONLY two privileged calls this spec makes
// ---------------------------------------------------------------------------

function adminHeaders(): Record<string, string> {
  return {
    apikey: SMOKE_SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${SMOKE_SUPABASE_SERVICE_ROLE_KEY!}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Provision the smoke account if it does not already exist, and return its id.
 *
 * This IS the "fresh account signup" step, performed by the test — adapted to
 * the fact that the product itself cannot create accounts (shouldCreateUser:
 * false + invite-only OAuth hook). Idempotent, so a re-run on the same morning
 * signs into the account the first run made rather than failing.
 *
 * Called ONLY from inside a running test, never from the posture probe.
 */
async function provisionSmokeAccount(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const base = STAGING_SUPABASE_URL!.replace(/\/$/, '')

  const lookup = await request.get(
    `${base}/auth/v1/admin/users?filter=${encodeURIComponent(SMOKE_EMAIL!)}`,
    { headers: adminHeaders(), timeout: 20_000 },
  )
  expect(lookup.ok(), `admin user lookup failed with ${lookup.status()}`).toBe(true)
  const existing = (await lookup.json()) as { users?: Array<{ id: string; email: string }> }
  const found = (existing.users ?? []).find(
    (u) => u.email?.toLowerCase() === SMOKE_EMAIL!.toLowerCase(),
  )
  if (found) return found.id

  const created = await request.post(`${base}/auth/v1/admin/users`, {
    headers: adminHeaders(),
    data: { email: SMOKE_EMAIL, email_confirm: true },
    timeout: 20_000,
  })
  expect(
    created.ok(),
    `admin user create failed with ${created.status()} — cannot provision the smoke account`,
  ).toBe(true)
  const body = (await created.json()) as { id?: string }
  expect(body.id, 'admin user create returned no id').toBeTruthy()
  return body.id!
}

/**
 * Mint a single-use sign-in link for the smoke account.
 *
 * This is the headless substitute for opening the magic-link email — the same
 * link Supabase would have mailed. It does not bypass the auth surface: the
 * link lands on `/auth/callback`, which is exactly where a tester's emailed
 * link lands, and the UI establishes the session by the same code path.
 */
async function mintSignInLink(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const base = STAGING_SUPABASE_URL!.replace(/\/$/, '')
  const response = await request.post(`${base}/auth/v1/admin/generate_link`, {
    headers: adminHeaders(),
    data: {
      type: 'magiclink',
      email: SMOKE_EMAIL,
      options: { redirect_to: uiUrl('/auth/callback') },
    },
    timeout: 20_000,
  })
  expect(
    response.ok(),
    `admin generate_link failed with ${response.status()} — cannot sign the smoke account in`,
  ).toBe(true)
  const body = (await response.json()) as {
    action_link?: string
    properties?: { action_link?: string }
  }
  const link = body.action_link ?? body.properties?.action_link
  expect(link, 'generate_link returned no action_link').toBeTruthy()
  return link!
}

// ---------------------------------------------------------------------------
// Posture probe (case 2) — unauthenticated, credential-free, account-free
// ---------------------------------------------------------------------------

type Posture = 'required-login-on' | 'guest-mode'

async function probePosture(browser: Browser): Promise<Posture> {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.goto(uiUrl('/canvas'), { waitUntil: 'commit', timeout: PROBE_TIMEOUT_MS })

    const loginSurface = page.locator('#login-email')
    const guestSurface = page.locator(
      '[data-testid="first-use-composer"], .react-flow, [data-testid="outputs-dock"]',
    )

    await expect(loginSurface.or(guestSurface).first()).toBeVisible({
      timeout: PROBE_TIMEOUT_MS,
    })

    return (await loginSurface.isVisible()) ? 'required-login-on' : 'guest-mode'
  } finally {
    await context.close()
  }
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' })

test.describe('required-login window gate (ROADMAP 2.126b)', () => {
  let posture: Posture
  let context: BrowserContext
  let page: Page
  let smokeUserId = '<not provisioned>'
  let scenarioUrl = '<none>'

  const OFF_REASON =
    'VITE_REQUIRE_LOGIN is OFF on the deployed build — the window is not gated yet, ' +
    'so this suite would assert against the wrong posture. Not a failure: flip the ' +
    'flag (Netlify env + redeploy, Paul-gated) and re-run with REQUIRE_LOGIN_EXPECTED=1.'

  test.beforeAll(async ({ browser }) => {
    // Belt-and-braces: the module-scope `test.skip` already marks every test
    // skipped without env, but hook-execution semantics are a runner detail and
    // this hook makes a NETWORK CALL. Depending on the runner to skip it would
    // make the inert default state depend on something this file does not own —
    // and with STAGING_UI_URL unset the probe would navigate to `undefined/#/canvas`
    // and red the suite for everyone. Explicit guard, no inference.
    if (!SHOULD_RUN) return
    posture = await probePosture(browser)
    // eslint-disable-next-line no-console
    console.log(
      `[required-login-gate] host=${hostFor(STAGING_UI_URL)} posture=${posture} ` +
        `expected_on=${REQUIRE_LOGIN_EXPECTED} account=${redactEmail(SMOKE_EMAIL!)}`,
    )
    if (posture === 'required-login-on') {
      context = await browser.newContext()
      page = await context.newPage()
    }
  })

  test.afterAll(async () => {
    if (context) await context.close()
  })

  // ── Step 1 — the posture itself (pack §3 step 1) ──────────────────────────
  test('1 · unauthenticated /#/canvas lands on the login surface, never a guest canvas', async ({
    browser,
  }) => {
    // Case (3): on gate day this is the loud failure the pack demands. Written
    // as an explicit branch, not a conditional expectation — a `toBe(cond ? a :
    // posture)` would compare the value with itself in the off branch and pass
    // by asserting nothing (trap 12b: a control pinned to "current" is vacuous).
    if (REQUIRE_LOGIN_EXPECTED) {
      expect(
        posture,
        'REQUIRE_LOGIN_EXPECTED=1 but the deployed build served a GUEST CANVAS to an ' +
          'unauthenticated visitor. The required-login posture is NOT in force and the ' +
          'user-testing window is NOT gated. Do not open the window.',
      ).toBe('required-login-on')
    }
    // Case (2): before the flip, skip rather than red.
    test.skip(posture !== 'required-login-on', OFF_REASON)

    const fresh = await browser.newContext()
    const freshPage = await fresh.newPage()
    try {
      await freshPage.goto(uiUrl('/canvas'), { waitUntil: 'commit', timeout: PROBE_TIMEOUT_MS })
      await expect(freshPage.locator('#login-email')).toBeVisible({ timeout: PROBE_TIMEOUT_MS })
      await expect(freshPage.locator('.react-flow__node')).toHaveCount(0)
      // No guest session was minted — the guest branch sets a synthetic user.
      const storage = await fresh.storageState()
      expect(
        JSON.stringify(storage).includes('guest@poc'),
        'a guest session was minted despite the login surface being shown',
      ).toBe(false)
    } finally {
      await fresh.close()
    }
  })

  // ── Step 2 — the real login surface + sign-in (pack §3 step 2) ────────────
  test('2 · the real login surface accepts the smoke account and a session is established', async ({
    request,
  }) => {
    test.skip(posture !== 'required-login-on', OFF_REASON)
    test.setTimeout(PROBE_TIMEOUT_MS * 3)

    // Provisioning happens HERE — inside a running test — never in the probe,
    // so a skipped run creates nothing.
    smokeUserId = await provisionSmokeAccount(request)

    // Drive the real surface first: this is the affordance a tester will use.
    await page.goto(uiUrl('/login'), { waitUntil: 'commit', timeout: PROBE_TIMEOUT_MS })
    await page.locator('#login-email').fill(SMOKE_EMAIL!)
    await page.getByRole('button', { name: 'Send magic link' }).click()
    // Apostrophe-agnostic on purpose: the copy is "…you'll receive a sign-in
    // link shortly", and a curly-vs-straight apostrophe swap in the copy must
    // not red the window gate.
    await expect(
      page.getByText(/receive a sign-in link/i),
      'the login form did not reach its link-sent state',
    ).toBeVisible({ timeout: PROBE_TIMEOUT_MS })

    // Then complete the journey headlessly with the equivalent link.
    const actionLink = await mintSignInLink(request)
    await page.goto(actionLink, { waitUntil: 'commit', timeout: PROBE_TIMEOUT_MS })

    // AuthCallback redirects to the hub on SIGNED_IN; AuthGuard must let us past.
    await expect(page.locator('#login-email')).toHaveCount(0, { timeout: PROBE_TIMEOUT_MS })
    const sessionPresent = await page.evaluate(() =>
      Object.keys(window.localStorage).some((k) => /^sb-.*-auth-token$/.test(k)),
    )
    expect(sessionPresent, 'no Supabase session token after the sign-in link').toBe(true)
  })

  // ── Step 3 — canvas mounts (pack §3 step 3) ──────────────────────────────
  test('3 · the canvas mounts with the first-use composer', async () => {
    test.skip(posture !== 'required-login-on', OFF_REASON)

    await page.goto(uiUrl('/canvas'), { waitUntil: 'commit', timeout: PROBE_TIMEOUT_MS })
    await expect(page.locator('[data-testid="first-use-composer"]')).toBeVisible({
      timeout: PROBE_TIMEOUT_MS,
    })
    await expect(page.getByLabel('Describe your decision').first()).toBeVisible()
  })

  // ── Steps 4+5 — draft, and the authenticated wire contract (pack §3 4–5) ─
  test('4 · the draft turn carries an Authorization: Bearer header and returns a graph', async () => {
    test.skip(posture !== 'required-login-on', OFF_REASON)
    test.setTimeout(DRAFT_TIMEOUT_MS + 30_000)

    // Capture the request BEFORE sending, so the assertion cannot race the turn.
    const turnRequest = page.waitForRequest(
      (r) => r.url().includes('/proxy/v5/turn') && r.method() === 'POST',
      { timeout: DRAFT_TIMEOUT_MS },
    )
    const turnResponse = page.waitForResponse(
      (r) => r.url().includes('/proxy/v5/turn') && r.request().method() === 'POST',
      { timeout: DRAFT_TIMEOUT_MS },
    )

    await page.getByLabel('Describe your decision').first().fill(FIXTURE_BRIEF)
    await page.locator('button[aria-label="Send"]').click()

    const req = await turnRequest
    const authHeader = (await req.headerValue('authorization')) ?? ''
    expect(
      /^Bearer\s+\S+/.test(authHeader),
      'the turn went to CEE WITHOUT an Authorization: Bearer header — the required-login ' +
        'wire contract is not in force even though the UI showed a login surface ' +
        '(see src/v5/turnAuthHeaders.ts and CEE extractJwtCandidate)',
    ).toBe(true)
    // The header must never be logged; only its shape is asserted.

    const res = await turnResponse
    expect(res.status(), 'CEE turn did not return 200').toBe(200)

    // Draft lands on the canvas.
    await expect
      .poll(async () => page.locator('.react-flow__node').count(), {
        timeout: DRAFT_TIMEOUT_MS,
        message: 'the draft never produced a graph on the canvas',
      })
      .toBeGreaterThanOrEqual(5)

    await expect(page.locator('[data-testid="outputs-error-banner"]')).toHaveCount(0)
    scenarioUrl = page.url()
  })

  // ── Step 6 — run the analysis (pack §3 step 6) ───────────────────────────
  test('6 · the analysis runs, or says honestly that it cannot recommend', async () => {
    test.skip(posture !== 'required-login-on', OFF_REASON)
    test.setTimeout(ANALYSIS_TIMEOUT_MS + 30_000)

    const runButton = page.locator('[data-testid="btn-run-analysis"]')
    await expect(runButton, 'no run control on the canvas after a draft').toBeVisible({
      timeout: PROBE_TIMEOUT_MS,
    })
    await runButton.click()

    // EITHER outcome passes. What fails is a silent stall: the pass condition is
    // that the product reaches a stated verdict — a result, or a typed honest
    // "can't recommend, because…". An empty dock after the budget is the FAIL.
    const results = page.locator('[data-testid="outputs-dock"]')
    const cannotConfirm = page.locator('[data-testid="results-tab-cannot-confirm-icon"]')
    const errorBanner = page.locator('[data-testid="outputs-error-banner"]')

    await expect(results.or(cannotConfirm).or(errorBanner).first()).toBeVisible({
      timeout: ANALYSIS_TIMEOUT_MS,
    })
    // The analysis must have finished, not merely started.
    await expect(page.locator('[data-testid="cancel-analysis-button"]')).toHaveCount(0, {
      timeout: ANALYSIS_TIMEOUT_MS,
    })
  })

  // ── Step 7 — the session and the work survive a reload (pack §3 step 7) ──
  test('7 · reload keeps the session and re-loads the same scenario', async () => {
    test.skip(posture !== 'required-login-on', OFF_REASON)
    test.setTimeout(DRAFT_TIMEOUT_MS)

    await page.reload({ waitUntil: 'commit', timeout: PROBE_TIMEOUT_MS })
    await expect(
      page.locator('#login-email'),
      'the reload bounced back to the login surface — the session did not survive',
    ).toHaveCount(0, { timeout: PROBE_TIMEOUT_MS })
    await expect
      .poll(async () => page.locator('.react-flow__node').count(), {
        timeout: DRAFT_TIMEOUT_MS,
        message: 'the scenario did not re-load after a reload',
      })
      .toBeGreaterThanOrEqual(5)
  })

  // ── Step 8 — teardown (pack §3 step 8, deletion deliberately NOT automated) ─
  test('8 · sign out, and report what the deletion runbook must clean up', async () => {
    test.skip(posture !== 'required-login-on', OFF_REASON)

    await page.evaluate(async () => {
      const keys = Object.keys(window.localStorage).filter((k) => /^sb-.*-auth-token$/.test(k))
      for (const k of keys) window.localStorage.removeItem(k)
    })
    await page.goto(uiUrl('/canvas'), { waitUntil: 'commit', timeout: PROBE_TIMEOUT_MS })
    await expect(
      page.locator('#login-email'),
      'signing out did not return the visitor to the login surface',
    ).toBeVisible({ timeout: PROBE_TIMEOUT_MS })

    // Deletion is Paul-gated (pack §2). Report, do not execute.
    // eslint-disable-next-line no-console
    console.log(
      `[required-login-gate] TEARDOWN — deletion runbook (pack §2) input:\n` +
        `    smoke account uid : ${smokeUserId}\n` +
        `    account email     : ${redactEmail(SMOKE_EMAIL!)} (full value is in SMOKE_EMAIL)\n` +
        `    scenario url      : ${scenarioUrl}\n` +
        `    This spec deleted NOTHING. Run pack §2 against the uid above on Paul's word;\n` +
        `    that run doubles as the deletion-runbook rehearsal (ROADMAP 1.115).`,
    )
  })
})
