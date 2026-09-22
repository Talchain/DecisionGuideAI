/**
 * ⭐⭐⭐ THE OPENAI READ-ONLY PREVIEW — one predicate, two consumers.
 *
 * Paul's brief: *"the smallest internal/staging-only transport switch that lets
 * the existing Olumi composer send conversational turns to the OpenAI
 * `/agent/v1/turn` route instead of current CEE… reuse the existing AI
 * panel/composer… keep the current CEE path fully reversible/available."*
 *
 * So this is a TRANSPORT switch and nothing else. It adds no panel, no route
 * and no second composer. `v5Adapter.resolveEndpoint` is the single place the
 * turn URL is decided, and this is consulted there, first.
 *
 * ## ⛔ ONE PREDICATE, BECAUSE THE BANNER MUST NOT BE ABLE TO LIE
 *
 * The banner says *"OpenAI preview — model changes are not committed"*. If the
 * banner and the transport asked two different questions, a reader could be
 * told they are in a preview while their turns went to CEE and were COMMITTED —
 * or the reverse, which is worse. `openAiPreviewEndpoint()` is therefore the
 * only question either of them asks: the banner renders exactly when the
 * transport is redirected, by construction rather than by anyone remembering.
 *
 * ## ⛔ FAIL CLOSED, AND THE HALF-FLIPPED FLAG IS THE REASON
 *
 * The preview is active only when the flag is ON **and** an endpoint is
 * configured. A flag turned on with no endpoint falls through to the normal CEE
 * path rather than throwing or posting nowhere — because the flag is meant to
 * be flipped from a browser console on staging, where the two settings cannot
 * be applied atomically, and a product that breaks between the two keystrokes
 * is not "fully reversible".
 *
 * ## WHY localStorage AND NOT ONLY AN ENV VAR
 *
 * Two reasons, and the first is mechanical:
 *
 *  1. **Vite constant-folds `import.meta.env` reads.** `v5Adapter`'s own header
 *     records that its endpoint resolver folded at build time to a single
 *     literal, so which rung was chosen came from dashboard state nobody could
 *     see. A `localStorage` read cannot be folded, so the preview is decided in
 *     the browser, at turn dispatch, where it can be observed and reversed.
 *  2. **The Agent route's contract is not settled yet** (asked on
 *     `olumi-programme-docs#63`). Keeping the endpoint overridable means Paul
 *     can point the preview at the real route the moment it is named, with no
 *     rebuild and no redeploy.
 *
 * ⚠ NO KEY EVER RIDES HERE. If the route needs credentials they must be
 * proxied; this module carries a URL and nothing else, and a client bundle is
 * public.
 */
import { makeFlag } from '../lib/flagFactory'

/** Flip the preview on: `localStorage.setItem('feature.openAiPreview', '1')`. */
export const OPENAI_PREVIEW_STORAGE_KEY = 'feature.openAiPreview'

/**
 * Point the preview at the Agent route:
 * `localStorage.setItem('feature.openAiPreview.endpoint', 'https://…/agent/v1/turn')`
 */
export const OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY = 'feature.openAiPreview.endpoint'

/**
 * The banner, exactly as briefed. Exported so the component and its spec bind
 * to one string rather than two copies of it.
 */
export const OPENAI_PREVIEW_BANNER = 'OpenAI preview — model changes are not committed'

const isOpenAiPreviewFlagOn = makeFlag({
  envKey: 'VITE_FEATURE_OPENAI_PREVIEW',
  storageKey: OPENAI_PREVIEW_STORAGE_KEY,
  defaultValue: false,
})

/** A configured endpoint, from the runtime override first, then the build env. */
function configuredEndpoint(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY)
      if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim()
    }
  } catch {
    // Private browsing / blocked storage: fall through to the env value.
  }
  const fromEnv: unknown = import.meta.env?.VITE_OPENAI_AGENT_ENDPOINT
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim()
  return null
}

/**
 * The preview's endpoint, or `null` when the product should behave exactly as
 * it does today.
 *
 * ⛔ THE ONLY QUESTION. Both the transport and the banner call this; nothing
 * calls the flag directly, so there is no second predicate to drift from.
 */
export function openAiPreviewEndpoint(): string | null {
  if (!isOpenAiPreviewFlagOn()) return null
  return configuredEndpoint()
}

/** Whether the preview is live — derived, never independently asserted. */
export function isOpenAiPreviewActive(): boolean {
  return openAiPreviewEndpoint() !== null
}
