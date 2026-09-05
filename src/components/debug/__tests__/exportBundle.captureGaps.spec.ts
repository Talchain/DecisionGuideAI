/**
 * Debug-bundle capture gaps — the four omissions that made
 * `olumi-debug-1679eb88-20260905.json` insufficient for cross-service
 * diagnosis, forcing hand-assembly of evidence and leaving a reviewer
 * judging assistant replies without the prompts they answered.
 *
 * GAP 1  the user's own typed text is nowhere in the bundle
 * GAP 2  only the UI build is captured; cee/plot/isl are null, which
 *        collapses schema_versions.consistency_status to "unknown"
 * GAP 3  `assistant_text` truncates at 1000 chars because it is absent
 *        from the never-truncate key list
 * GAP 4  console capture is dead on staging (render capture is a
 *        separate, deliberately-unbuilt gap — see the `reason` field)
 *
 * Every assertion below binds to its object BY IDENTITY (the exact
 * action id / turn id / key name), never by a value predicate another
 * object in the same bundle could satisfy.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { DebugData } from '../hooks/useDebugData'

vi.mock('../../../lib/version-cache', () => ({
  getClientBuild: () => 'test-build',
  getVersionInfo: () => ({ short: 'test-version', branch: 'main' }),
}))

vi.mock('../../../utils/debugLogBuffer', () => ({
  getBufferedLogs: () => [],
}))

const mockUserActions: Array<{
  actionType: string
  timestamp: string
  payloadSummary?: Record<string, unknown>
}> = []
vi.mock('../../../lib/debug-state', () => ({
  getUserActions: () => [...mockUserActions],
}))

import { buildDebugBundle } from '../utils/exportBundle'
import {
  DEBUG_BUNDLE_REDACTION_OPTIONS,
  redactPayload,
  scrubSecretsInString,
  USER_AUTHORED_TEXT_OMITTED_REASON,
} from '../../../utils/payloadRedaction'
import { selectRecentConversationTurns } from '../../../lib/recentConversationTurns'
import { collectServiceBuilds } from '../../../lib/service-health'

function makeDebugData(overrides: Partial<DebugData> = {}): DebugData {
  return {
    overall: { status: 'success', total_duration_ms: 1200, request_id: 'req-main' },
    services: {
      cee: { name: 'CEE', status: 200, success: true, duration_ms: 245, endpoint: '/cee/draft-graph' },
      plot: { name: 'PLoT', status: 202, success: true, duration_ms: 510, endpoint: '/plot/v2/run' },
      isl: null,
    },
    error: null,
    builds: { ui: 'test-build', cee: null, plot: null, isl: null },
    diagnostics: {
      plot_has_downstream_calls: false,
      downstream_calls_path_found: null,
      downstream_calls_paths_checked: [],
      isl_data_source: 'none',
      cee_trace_present: false,
      cee_degraded: false,
      llm_raw_available: false,
      llm_raw_path_found: null,
      e_values_present: false,
      evpi_present: false,
      confidence_differentiated: false,
      confidence_unique_values: [],
      confidence_source_bootstrap: false,
      intercept_populated: false,
      epsilon_std_present: false,
      response_hash_present: false,
      mca_computed: false,
      isl_edge_e_values_present: false,
      plot_edge_e_values_exposed: false,
      ui_edge_e_values_available: false,
      factor_confidence_differentiated: false,
      factor_confidence_unique_values: [],
    },
    ceeTrace: null,
    corrections: [],
    correctionsSummary: null,
    pipeline: {
      status: 'success',
      total_duration_ms: 1200,
      stages: [],
      llm_metadata: undefined,
      llm_raw: undefined,
      node_extraction: undefined,
      connectivity: { decision_count: 1, option_count: 2, goal_count: 1, factor_count: 3, edge_count: 2 },
    },
    payloads: {
      cee_request: null,
      cee_response: null,
      plot_request: null,
      plot_response: null,
      isl_request: null,
      isl_response: null,
    },
    gates: [],
    validation: { summary: { errors: 0, warnings: 0, info: 0 }, issues: [] },
    winningOption: null,
    robustness: { status: 'unavailable', stability: null, context_label: 'N/A', description: '' },
    hasData: true,
    orchestrator: null,
    v12_4_checks: null,
    request_id_chain: null as never,
    feature_flags_at_request: null as never,
    timing: null,
    schema_versions: null,
    cee_observability: null,
    m1_coaching: null,
    m2_review: null,
    cee_downstream: null,
    cee_operations: null,
    diagnostic_trace: null,
    ...overrides,
  }
}

beforeEach(() => {
  mockUserActions.length = 0
})

afterEach(() => {
  vi.unstubAllEnvs()
})

/**
 * Push the one action whose detail carries user prose, plus a second
 * action that carries none. Every assertion about the first binds to it by
 * its action name, so it cannot be satisfied by the second.
 */
function pushTypedMessage(text: string): void {
  mockUserActions.push({
    actionType: 'sent chat message',
    timestamp: '2026-09-05T10:00:00.000Z',
    payloadSummary: {
      action_type: 'sent chat message',
      raw_message: text,
      source: 'composer',
    },
  })
  mockUserActions.push({
    actionType: 'clicked chip',
    timestamp: '2026-09-05T10:00:05.000Z',
    payloadSummary: { action_type: 'clicked chip', label: 'Run analysis' },
  })
}

function typedActionDetail(): Record<string, unknown> | undefined {
  const bundle = buildDebugBundle(makeDebugData()) as unknown as {
    user_actions: Array<{ action: string; detail?: Record<string, unknown> }>
  }
  return bundle.user_actions.find((a) => a.action === 'sent chat message')?.detail
}

// ===========================================================================
// GAP 1 — the user's own text
// ===========================================================================

describe('GAP 1 — user-authored text reaches the bundle', () => {
  it('preserves the user message text on the user_actions entry that carried it', () => {
    mockUserActions.push({
      actionType: 'sent chat message',
      timestamp: '2026-09-05T10:00:00.000Z',
      payloadSummary: {
        action_type: 'sent chat message',
        raw_message: 'We are deciding whether to acquire the smaller competitor.',
        source: 'composer',
      },
    })
    // A SECOND action with no user text — the assertion below must not be
    // satisfiable by this one (identity binding, not a value predicate).
    mockUserActions.push({
      actionType: 'clicked chip',
      timestamp: '2026-09-05T10:00:05.000Z',
      payloadSummary: { action_type: 'clicked chip', label: 'Run analysis' },
    })

    const bundle = buildDebugBundle(makeDebugData()) as unknown as {
      user_actions: Array<{ action: string; detail?: Record<string, unknown> }>
    }

    const typed = bundle.user_actions.find((a) => a.action === 'sent chat message')
    expect(typed).toBeDefined()
    expect(typed!.detail?.user_text).toBe(
      'We are deciding whether to acquire the smaller competitor.',
    )
    // The structural metadata that was already captured must survive.
    expect(typed!.detail?.message_length).toBe(
      'We are deciding whether to acquire the smaller competitor.'.length,
    )
    // The raw key itself is not re-exposed under its original name.
    expect(typed!.detail).not.toHaveProperty('raw_message')
  })

  it('scrubs secret-shaped substrings from user text rather than omitting the text', () => {
    mockUserActions.push({
      actionType: 'sent chat message',
      timestamp: '2026-09-05T10:01:00.000Z',
      payloadSummary: {
        action_type: 'sent chat message',
        raw_message: 'my key is api_key=sk-live-abc123 and the margin floor is 78%',
        source: 'composer',
      },
    })

    const bundle = buildDebugBundle(makeDebugData()) as unknown as {
      user_actions: Array<{ action: string; detail?: Record<string, unknown> }>
    }
    const text = bundle.user_actions.find((a) => a.action === 'sent chat message')!.detail
      ?.user_text as string

    expect(text).toContain('[REDACTED]')
    expect(text).not.toContain('sk-live-abc123')
    // Redaction, not omission — the diagnostic content survives.
    expect(text).toContain('margin floor is 78%')
  })

  // The PR title claims "untruncated". `assistant_text`'s cap has a positive
  // control (GAP 3); `user_text`'s did not, so the truncation branch at
  // `exportBundle.ts:2610-2611` had no test at any scope and the completeness
  // claim rested on the other half alone. These two are that control.
  //
  // Derived, not assumed: `USER_TEXT_MAX_CHARS` is `DEBUG_LLM_RAW_MAX_CHARS`,
  // which defaults to 8000 (`payloadRedaction.ts:65-73`), and this path does
  // NOT go through `redactPayload` — `collectUserActions` assigns
  // `redactUserActionDetail(...)` straight onto the entry
  // (`exportBundle.ts:2418`) — so the 8000 cap is the only bound and is
  // genuinely observable in the bundle. `user_text` is deliberately absent
  // from `neverTruncateKeys`.
  it('caps an over-long user_text and names the cap that cut it', () => {
    pushTypedMessage('C'.repeat(8001))

    const detail = typedActionDetail()
    const text = detail!.user_text as string

    // Bind by the exact marker string, not by a length predicate the
    // safety-cap branch or a future cap could also satisfy.
    expect(text).toContain('[truncated_by: user_text_cap, 8001 chars total]')
    expect(text.startsWith('C'.repeat(8000))).toBe(true)
    expect(text).not.toContain('C'.repeat(8001))
  })

  it('leaves a user_text exactly at the cap untruncated', () => {
    pushTypedMessage('D'.repeat(8000))

    const detail = typedActionDetail()
    const text = detail!.user_text as string

    // The boundary twin: without it, a cap that fired one char early would
    // still satisfy the case above.
    expect(text).toHaveLength(8000)
    expect(text).not.toContain('truncated_by')
  })

  it('pairs each captured turn with the user message that prompted it', () => {
    const result = selectRecentConversationTurns([
      {
        id: 'trace-1',
        service: 'cee',
        endpoint: '/proxy/v5/turn',
        timestamp: 1_757_000_000_000,
        completed: true,
        status: 200,
        request: {
          headers: {},
          body: { kind: 'message', message: 'Which option is most robust?', source: 'composer' },
        },
        response: { body: { assistant_text: 'Acquire leads at 44%.' } },
      } as never,
    ])

    expect(result.captured_count).toBe(1)
    const turn = result.turns.find((t) => t.trace_id === 'trace-1')
    expect(turn).toBeDefined()
    expect(turn!.user_message).toBe('Which option is most robust?')
    expect(turn!.has_user_message).toBe(true)
    expect(turn!.user_message_source).toBe('composer')
    // Reply and prompt are now readable together on the same record.
    expect(turn!.assistant_text).toBe('Acquire leads at 44%.')
    expect(result.user_authored_count).toBe(1)
  })
})

// ===========================================================================
// GAP 2 — service builds
// ===========================================================================

describe('GAP 2 — all four service builds are captured', () => {
  it('probes each service health seam and returns its build', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/bff/cee/health')
        return new Response(JSON.stringify({ commit: 'd818ef5', version: '1.12.0' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      if (url === '/bff/engine/health')
        return new Response(JSON.stringify({ status: 'ok', build: 'd37c8cf' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      if (url === '/bff/isl/health')
        return new Response(JSON.stringify({ status: 'healthy', build: '7781ca4' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      throw new Error(`unexpected url ${url}`)
    })

    const builds = await collectServiceBuilds({ fetchImpl: fetchMock as never })

    expect(builds.cee.build).toBe('d818ef5')
    expect(builds.plot.build).toBe('d37c8cf')
    expect(builds.isl.build).toBe('7781ca4')
    // Every service reports HOW it was captured, so a reader can tell a
    // successful probe from a default.
    expect(builds.cee.source).toBe('health_probe')
    expect(builds.plot.source).toBe('health_probe')
    expect(builds.isl.source).toBe('health_probe')
  })

  it('records WHY a build is missing rather than leaving a bare null', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/bff/isl/health')
        return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403 })
      // A dead proxy path answers with the SPA index: HTTP 200, text/html.
      return new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    })

    const builds = await collectServiceBuilds({ fetchImpl: fetchMock as never })

    expect(builds.isl.build).toBeNull()
    expect(builds.isl.unavailable_reason).toContain('403')
    expect(builds.cee.build).toBeNull()
    // The SPA-catch-all failure mode must be named, not reported as a
    // generic parse error — it is the exact defect that made
    // SERVICE_ENDPOINTS.plot a dead path.
    expect(builds.cee.unavailable_reason).toContain('non_json')
  })

  it('points the PLoT probe at the seam that actually proxies PLoT', async () => {
    const seen: string[] = []
    const fetchMock = vi.fn(async (url: string) => {
      seen.push(url)
      return new Response(JSON.stringify({ build: 'x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    await collectServiceBuilds({ fetchImpl: fetchMock as never })

    // Measured on deployed staging 2026-09-05: /bff/plot/health has no
    // route and is answered by the SPA catch-all (200 text/html);
    // /bff/engine/health returns PLoT's real build.
    expect(seen).toContain('/bff/engine/health')
    expect(seen).not.toContain('/bff/plot/health')
  })
})

// ===========================================================================
// GAP 3 — assistant_text truncation
// ===========================================================================

describe('GAP 3 — assistant_text is not truncated at 1000 chars', () => {
  it('carries a long assistant_text through redaction intact', () => {
    const long = 'A'.repeat(4000)
    const out = redactPayload(
      { assistant_text: long },
      DEBUG_BUNDLE_REDACTION_OPTIONS,
    ) as { assistant_text: string }

    expect(out.assistant_text).toHaveLength(4000)
    expect(out.assistant_text).not.toContain('truncated_by')
  })

  it('still applies the never-truncate safety cap to assistant_text', () => {
    const huge = 'B'.repeat(20_000)
    const out = redactPayload(
      { assistant_text: huge },
      DEBUG_BUNDLE_REDACTION_OPTIONS,
    ) as { assistant_text: string }

    expect(out.assistant_text).toContain('bundle_redaction_safety_cap')
  })

  it('derives meta.redaction.never_truncate_keys from the policy constant', () => {
    const bundle = buildDebugBundle(makeDebugData()) as unknown as {
      meta: { redaction: { never_truncate_keys?: string[] } }
    }
    // A hand-copied second list is how the policy and its advertised
    // description drift apart. Bind the bundle's claim to the constant
    // the redactor actually consumes.
    expect(bundle.meta.redaction.never_truncate_keys).toEqual(
      DEBUG_BUNDLE_REDACTION_OPTIONS.neverTruncateKeys,
    )
    expect(bundle.meta.redaction.never_truncate_keys).toContain('assistant_text')
  })
})

// ===========================================================================
// GAP 4 — render/console capture reasons
// ===========================================================================

// ===========================================================================
// PRIVACY — the one admission, executed in BOTH directions
//
// The cold review's finding: no test executed either gate, which is how a
// two-gate defect reached review. `user_text` is the bundle-side half;
// `user_message` is covered in `lib/__tests__/userAuthoredTextAdmission.spec.ts`
// alongside the matrix that pins the subset claim between the two gates.
// ===========================================================================

describe('user_text honours the one user-prose admission', () => {
  it('CONTAINS the text and claims no omission in a capturing environment', () => {
    vi.stubEnv('DEV', true)
    pushTypedMessage('We are deciding whether to acquire the smaller competitor.')

    const detail = typedActionDetail()
    expect(detail).toBeDefined()
    expect(detail!.user_text).toBe(
      'We are deciding whether to acquire the smaller competitor.',
    )
    // Opposite-direction assertion: a bundle that HOLDS the text must not
    // also carry a marker saying it withheld it.
    expect(detail).not.toHaveProperty('user_text_omitted_reason')
  })

  it('OMITS the text and SAYS SO in the one reachable non-capturing state', () => {
    // MEASURED, not assumed. Of the 20 combinations of DEV x VITE_APP_ENV x
    // opt-in, exactly ONE has the debug panel mountable (so a bundle can
    // exist at all) while the admission is false: a production-mode build
    // with VITE_APP_ENV UNSET and no opt-in. That is also production's real
    // posture per `netlify.toml` — `VITE_APP_ENV = "staging"` is set only
    // under `[context.staging.environment]` (:90) and the production context
    // inherits only `[build.environment]` (:60-62), which does not set it.
    //
    // The previous version of this case pinned VITE_APP_ENV='production',
    // where `shouldShowDebugPanel` is false and no bundle can be produced —
    // a guard that cannot fire on any reachable artefact.
    //
    // '' faithfully models an absent key for all three predicates:
    // `'' || 'development'` === `undefined || 'development'` for the panel,
    // and the trace store disables on both ('' -> empty_app_env_..., absent
    // -> missing_app_env_...).
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_APP_ENV', '')
    vi.stubEnv('VITE_ENABLE_PAYLOAD_INSPECTION', '')
    pushTypedMessage('We are deciding whether to acquire the smaller competitor.')

    const detail = typedActionDetail()
    expect(detail).toBeDefined()
    expect(detail).not.toHaveProperty('user_text')
    expect(detail!.user_text_omitted_reason).toBe(USER_AUTHORED_TEXT_OMITTED_REASON)
    // The structural metadata still lands — this withholds the prose, it
    // does not hide that a message was sent.
    expect(detail!.message_length).toBe(
      'We are deciding whether to acquire the smaller competitor.'.length,
    )
  })

  // -------------------------------------------------------------------------
  // The two REACHABLE states in which the narrow gate would have lied.
  //
  // ⚠ The state this pair replaces was VITE_APP_ENV='production' + opt-in,
  // named in the PR body, a code comment and two specs as "the reviewed
  // defect's exact state". It is not reachable: `shouldShowDebugPanel`
  // (`debugPanelVisibility.ts:20-22`) returns false unless VITE_APP_ENV is
  // 'staging' or 'development' (or absent, which falls open to
  // 'development'), and `exportDebugBundleAsync` has exactly one non-test
  // caller — `DebugPanelV2.tsx:88`, inside that panel. No artefact, no lie.
  //
  // Measured over all 20 DEV x VITE_APP_ENV x opt-in combinations, running
  // the real panel gate, the real trace-store gate and both predicates,
  // `panel && storeEnabled && !narrow` holds in exactly three states — the
  // two below, plus VITE_APP_ENV='development' WITH the opt-in, which is
  // the same admission disjunct as the second.
  // -------------------------------------------------------------------------

  it('CONTAINS the text with VITE_APP_ENV unset and the inspection opt-in', () => {
    // Reachable state 1. Production's real VITE_APP_ENV posture is unset,
    // so this is the one an opt-in actually reaches in a deployed build.
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_APP_ENV', '')
    vi.stubEnv('VITE_ENABLE_PAYLOAD_INSPECTION', 'true')
    pushTypedMessage('We are deciding whether to acquire the smaller competitor.')

    const detail = typedActionDetail()
    expect(detail!.user_text).toBe(
      'We are deciding whether to acquire the smaller competitor.',
    )
    expect(detail).not.toHaveProperty('user_text_omitted_reason')
  })

  it('CONTAINS the text with VITE_APP_ENV=development and NO opt-in at all', () => {
    // Reachable state 2, and the one the previous write-up missed entirely:
    // the exposure needs no opt-in flag. A production-MODE build with
    // VITE_APP_ENV='development' mounts the panel, enables the trace store
    // (`app_env_development_enabled`) and leaves the narrow gate false — so
    // the narrow gate would deny holding prose the bundle holds.
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_APP_ENV', 'development')
    vi.stubEnv('VITE_ENABLE_PAYLOAD_INSPECTION', '')
    pushTypedMessage('We are deciding whether to acquire the smaller competitor.')

    const detail = typedActionDetail()
    expect(detail!.user_text).toBe(
      'We are deciding whether to acquire the smaller competitor.',
    )
    expect(detail).not.toHaveProperty('user_text_omitted_reason')
  })

  it('names the DATA CLASS, not an environment-wide policy', () => {
    // The previous string claimed `detailed_capture_disabled_in_this_
    // environment`, i.e. more than the gate decides. Pinned by identity so
    // the wider claim cannot return.
    expect(USER_AUTHORED_TEXT_OMITTED_REASON).toBe(
      'user_authored_text_capture_disabled_in_this_environment',
    )
  })
})

describe('GAP 4 — unavailable capture states say why', () => {
  it('states the reason render_summary is unavailable', () => {
    const bundle = buildDebugBundle(makeDebugData()) as unknown as {
      render_summary: { available: boolean; source: string | null; reason?: string }
    }
    expect(bundle.render_summary.available).toBe(false)
    // A bare `available: false` cannot be told apart from a capture that
    // was attempted and failed.
    expect(bundle.render_summary.reason).toBeTruthy()
    expect(bundle.render_summary.reason).toContain('not_implemented')
  })

  // -------------------------------------------------------------------------
  // Console capture: the finding, not an attempted fix.
  //
  // Interception was moved off `import.meta.env.DEV` in the first version
  // of this change and reverted: the staging Netlify build is a
  // `mode === 'production'` build, so `vite.config.ts`'s
  // `esbuild.drop: ['console']` removes the call sites before any listener
  // could see them (CI's `ci:no-console` asserts `dist` holds none), and
  // running the repo's own transform over `debugLogBuffer.ts` shows
  // `console.log.bind(console)` folding to `void 0` while the wrapper
  // ASSIGNMENTS survive — executed, it throws
  // `TypeError: originalConsole.log is not a function`.
  //
  // What ships instead is the honest statement, in the same shape as the
  // Gap-4 `not_implemented` marker.
  // -------------------------------------------------------------------------

  /** Read the marker under an explicitly-stated MODE/DEV state. */
  function consoleMarkerUnder(mode: string, dev: boolean) {
    vi.stubEnv('MODE', mode)
    vi.stubEnv('DEV', dev)
    return (buildDebugBundle(makeDebugData()) as unknown as {
      console_logs_capture: {
        available: boolean
        producers_stripped_at_build: boolean
        unavailable_reason?: string
      }
    }).console_logs_capture
  }

  it('says console capture is impossible in a default `vite build`', () => {
    // mode==='production' + build output: BOTH strippers fire.
    const m = consoleMarkerUnder('production', false)
    expect(m.producers_stripped_at_build).toBe(true)
    expect(m.available).toBe(false)
    expect(m.unavailable_reason).toContain('not_capturable_in_this_build')
    // The reason must name the BUILD-TIME cause, so the next reader does
    // not re-attempt interception.
    expect(m.unavailable_reason).toContain('BUILD time')
    // ...and it must name the UNCONDITIONAL stripper, because naming only
    // the mode-gated one is what made the old derivation permissive.
    expect(m.unavailable_reason).toContain('UNCONDITIONAL')
  })

  it('says stripped for a `--mode staging` build, where only terser fires', () => {
    // THE PERMISSIVE HOLE THIS CASE EXISTS TO CLOSE. `producers_stripped_at_
    // build` used to read `import.meta.env.MODE === 'production'` alone,
    // under a comment claiming it read "the same expression vite.config.ts
    // switches esbuild.drop on". `grep -n "mode ===" vite.config.ts` returns
    // exactly one line (:199, esbuild.drop) — terser's `drop_console`
    // (:163-168) is UNCONDITIONAL. So a `vite build --mode staging` lost
    // every call site to terser while this marker reported the console
    // record as trustworthy. Wrong in the permissive direction, in the one
    // field whose job is to stop a reader trusting an empty channel.
    const m = consoleMarkerUnder('staging', false)
    expect(m.producers_stripped_at_build).toBe(true)
    expect(m.available).toBe(false)
  })

  it('claims no unavailability under the dev server, where the producers survive', () => {
    // Opposite-direction twin. Without it, a marker hardcoded to
    // "unavailable" would pass the cases above while saying nothing.
    // Under the Vite dev server there is no minify step at all and
    // `debugLogBuffer` auto-enables, so `available: true` is correct.
    const m = consoleMarkerUnder('development', true)
    expect(m.producers_stripped_at_build).toBe(false)
    expect(m.available).toBe(true)
    expect(m).not.toHaveProperty('unavailable_reason')
  })

  it('keeps the mode disjunct load-bearing: neither signal is redundant', () => {
    // mode==='production' with DEV true — the terser proxy says "not a
    // build", the esbuild disjunct still reports stripped. Delete either
    // disjunct and one of these four console cases REDs.
    const m = consoleMarkerUnder('production', true)
    expect(m.producers_stripped_at_build).toBe(true)
    expect(m.available).toBe(false)
  })

  it('KNOWN GAP, pinned as a SET: `NODE_ENV=development` AND `--mode <non-production>`', () => {
    // Terser's `drop_console` is unconditional, so it strips in these builds
    // too — but its condition cannot be READ (there is none), and the proxy
    // used for "this is build output", `!import.meta.env.DEV`, is false
    // here. That artefact is indistinguishable at runtime from the dev
    // server; separating them needs a build-time flag in `vite.config.ts`,
    // which this change does not touch.
    //
    // The gap needs BOTH conditions, and it is a SET of states, not one.
    // Measured on this repo's pinned Vite 5.4.21 by running the builds, and
    // derived at its bytes: `build()` calls `resolveConfig(cfg, 'build',
    // 'production', 'production')` and defaults `NODE_ENV` only when unset,
    // so `DEV` follows `NODE_ENV` alone and `--mode` moves `MODE` alone.
    //
    // Pinned as an explicit KNOWN-DROPPED SET rather than left silent, so
    // this REDs if the gap grows OR shrinks — including if someone closes
    // it properly and forgets to retire this case.

    // Member 1 — `NODE_ENV=development vite build --mode development`
    // (also the dev server's runtime state, which is why they cannot be told apart).
    const m = consoleMarkerUnder('development', true)
    expect(m.producers_stripped_at_build).toBe(false)
    // Member 2 — `NODE_ENV=development vite build --mode staging`.
    expect(consoleMarkerUnder('staging', true).producers_stripped_at_build).toBe(false)

    // CONTRAST — each neighbour sets only ONE of the two conditions, and is COVERED:
    // `vite build --mode development`   (mode only)     -> terser proxy fires
    expect(consoleMarkerUnder('development', false).producers_stripped_at_build).toBe(true)
    // `NODE_ENV=development vite build` (NODE_ENV only) -> MODE is still 'production',
    // so the mode disjunct fires. This case's title used to name THIS command as the
    // gap; it is covered, and naming it would have invited a later reader to run it,
    // watch the marker read true, and retire a case guarding a reachable state.
    expect(consoleMarkerUnder('production', true).producers_stripped_at_build).toBe(true)
  })
})

// ===========================================================================
// Shared scrubber promotion (GAP 1 depends on it)
// ===========================================================================

describe('scrubSecretsInString is available as a shared util', () => {
  it('redacts JWT, bearer and key=value shapes', () => {
    expect(scrubSecretsInString('eyJhbGciOi.eyJzdWIi.SflKxwRJ')).toContain('[REDACTED:JWT]')
    expect(scrubSecretsInString('Authorization: bearer abc123')).toContain('[REDACTED]')
    expect(scrubSecretsInString('token=hunter2')).toContain('[REDACTED]')
  })
})
