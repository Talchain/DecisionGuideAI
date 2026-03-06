// PostHog analytics — gated on VITE_POSTHOG_KEY + VITE_POSTHOG_HOST.
// Data minimisation: never send scenario content, brief text, graph data,
// or user-entered descriptions. Only IDs and coarse metadata.

import posthog from 'posthog-js'

let initialised = false

export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  const host = import.meta.env.VITE_POSTHOG_HOST as string | undefined
  if (!key || !host) return

  posthog.init(key, {
    api_host: host,
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
