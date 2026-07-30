// src/lib/__tests__/posthogInitPosture.spec.ts
// =============================================================================
// ROADMAP 1.68 / 2.150 · S3 — the ACTIVATION POSTURE pin.
// =============================================================================
//
// WHAT THIS EXISTS TO PREVENT
// ---------------------------
// `posthog-js@1.369.1`'s measured defaults are `autocapture: true`,
// `capture_pageview: true`, `disable_session_recording: false`,
// `mask_all_text: false`. On THIS product the clickable elements are the user's
// own decision nodes, option labels, factor labels and the chat surface — so
// with the shipped defaults, one boot on a real tester's canvas harvests
// exactly the user-authored content `src/lib/posthog.ts`'s own file header
// promises never to send. That capture is UNRECOVERABLE: it is a write to a
// third party, not a local state we can roll back.
//
// The posture therefore has to be in the code BEFORE any key can ever be set,
// which is why this spec lands in a slot where the PostHog project does not yet
// exist. There is no ordering in which "set the key first, tighten later" is
// safe.
//
// CLAIM TYPE
// ----------
// This is a call-shape pin on `posthog.init`'s SECOND argument. It does not
// claim the SDK honours the options (that is posthog-js's contract, not ours),
// and it does not claim the project-side session-recording setting is off —
// no client option substitutes for that, and it is recorded as Paul's item.
//
// MUTATION EVIDENCE (each of the four proven to bite independently — remove one
// option from src/lib/posthog.ts and exactly that assertion REDs by name):
// see PHASE0-EVIDENCE-2026-07-28/measurement-seam-build.md § S3.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import posthog from 'posthog-js'

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}))

// `import.meta.env` is a live object under vitest (the reads under test use
// `import.meta.env?.X`, which Vite cannot narrow), so assigning to it is how
// this suite already drives these paths — same pattern as posthogKeyUnify.spec.
const env = import.meta.env as unknown as Record<string, unknown>
const MANAGED = ['VITE_POSTHOG_KEY', 'VITE_POSTHOG_HOST'] as const
let saved: Record<string, unknown> = {}

beforeEach(() => {
  saved = {}
  for (const name of MANAGED) if (name in env) saved[name] = env[name]
  env.VITE_POSTHOG_KEY = 'phc_synthetic_posture_key'
  env.VITE_POSTHOG_HOST = 'https://posthog.example.test'
  vi.resetModules()
  vi.clearAllMocks()
})

afterEach(() => {
  for (const name of MANAGED) {
    if (name in saved) env[name] = saved[name]
    else delete env[name]
  }
})

async function initAndCaptureOptions(): Promise<Record<string, unknown>> {
  const { initPostHog } = await import('../posthog')
  initPostHog()

  // ANTI-VACUITY (trap 13): every assertion below reads a property off the
  // options object. If init were never called, `options` would be undefined and
  // each `toBe` would fail with an unhelpful TypeError rather than a named
  // posture failure — so prove the presence FIRST.
  expect(
    posthog.init,
    'posthog.init was never called — the posture assertions below would pass ' +
      'vacuously against an options object that does not exist',
  ).toHaveBeenCalledTimes(1)

  const options = (posthog.init as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1]
  expect(options, 'posthog.init was called with no options object at all').toBeTypeOf('object')
  return options as Record<string, unknown>
}

describe('1.68 · initPostHog activation posture — the four options that must land WITH any key', () => {
  it('autocapture is DISABLED — canvas click targets are the user\'s own decision content', async () => {
    const options = await initAndCaptureOptions()
    expect(
      options.autocapture,
      'autocapture is not explicitly false. posthog-js defaults it TRUE, and on this ' +
        'canvas the clickable elements are node labels, option labels and factor labels — ' +
        'i.e. exactly the user-authored text src/lib/posthog.ts promises never to send.',
    ).toBe(false)
  })

  it('capture_pageview is DISABLED — hash routes carry scenario ids', async () => {
    const options = await initAndCaptureOptions()
    expect(
      options.capture_pageview,
      'capture_pageview is not explicitly false. Automatic pageviews send the URL, and ' +
        'this app\'s routes carry scenario ids. Journey events are emitted explicitly instead.',
    ).toBe(false)
  })

  it('disable_session_recording is TRUE — a recording is a verbatim content capture', async () => {
    const options = await initAndCaptureOptions()
    expect(
      options.disable_session_recording,
      'disable_session_recording is not explicitly true. Session replay records the ' +
        'rendered canvas verbatim — every label, every threshold, every chat message.',
    ).toBe(true)
  })

  it('mask_all_text is TRUE — belt-and-braces if recording is ever enabled project-side', async () => {
    const options = await initAndCaptureOptions()
    expect(
      options.mask_all_text,
      'mask_all_text is not explicitly true. This is the second line of defence: the ' +
        'client cannot see the PostHog project settings, so if recording is turned on ' +
        'there, this option is what stops the text reaching the wire.',
    ).toBe(true)
  })

  it('the DEV opt-out survives — development boots must not capture', async () => {
    const options = await initAndCaptureOptions()
    expect(
      typeof options.loaded,
      'the loaded() callback is gone — it carries the development-mode opt_out_capturing',
    ).toBe('function')
  })

  it('the api_host is still the configured host (the posture edit did not drop it)', async () => {
    const options = await initAndCaptureOptions()
    expect(options.api_host).toBe('https://posthog.example.test')
  })
})
