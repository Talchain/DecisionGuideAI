// PostHog analytics — gated on VITE_POSTHOG_KEY + VITE_POSTHOG_HOST.
// Data minimisation: never send scenario content, brief text, graph data,
// or user-entered descriptions. Only IDs and coarse metadata.

import posthog from 'posthog-js'

let initialised = false

export function initPostHog(): void {
  const key = import.meta.env?.VITE_POSTHOG_KEY as string | undefined
  const host = import.meta.env?.VITE_POSTHOG_HOST as string | undefined
  if (!key || !host) return

  // ACTIVATION POSTURE — ROADMAP 1.68.
  //
  // Every option below overrides a posthog-js DEFAULT that is wrong for this
  // product, and each one is pinned by src/lib/__tests__/posthogInitPosture.spec.ts
  // with an independently-mutation-proven assertion. Measured defaults in
  // posthog-js@1.369.1 `dist/module.js`: autocapture true, capture_pageview on,
  // disable_session_recording false, mask_all_text false.
  //
  // These MUST ship in the same deploy as any key, never after it. One boot with
  // autocapture on, on a real tester's canvas, is an unrecoverable content
  // capture — a write to a third party, not a local state we can roll back.
  posthog.init(key, {
    api_host: host,
    // The clickable elements on this canvas ARE the user's decision content:
    // node labels, option labels, factor labels, the chat surface. Autocapture
    // would harvest exactly what this file's header promises never to send.
    autocapture: false,
    // Routes carry scenario ids. Journey events are emitted explicitly.
    capture_pageview: false,
    // Session replay records the rendered canvas verbatim.
    disable_session_recording: true,
    // Second line of defence: the client cannot read the PostHog PROJECT
    // settings, so if recording is ever enabled there, this is what stops the
    // text reaching the wire. (The project-side check is still required and is
    // recorded as a human item — no client option substitutes for it.)
    mask_all_text: true,
    loaded(ph) {
      if (import.meta.env.MODE === 'development') ph.opt_out_capturing()
    },
  })
  initialised = true
}

export function identifyUser(userId: string, email: string, displayName?: string): void {
  if (!initialised) return
  posthog.identify(userId, {
    email,
    ...(displayName ? { display_name: displayName } : {}),
  })
}

export function resetPostHog(): void {
  if (!initialised) return
  posthog.reset()
}

export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  if (!initialised) return
  posthog.capture(event, properties)
}
