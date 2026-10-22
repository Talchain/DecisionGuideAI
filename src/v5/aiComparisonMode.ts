/**
 * `core-route` (contract v1.6, DL 22 Oct): CEE's thin core route, read only through `coreTurnContract.ts`. It is the staging
 * default; `?ai=core` (PATH-B's old surface, which it replaces) reaches it too, so an old link never lands elsewhere.
 * `openai` and `conventional` stay explicit comparison surfaces.
 */
export type AiComparisonMode = 'conventional' | 'openai' | 'core-route'

export const AI_MODE_HEADER = 'x-olumi-ai-mode' as const

/**
 * The `ai` value as pasted or typed: case, spaces and trailing punctuation are not part of it (Paul's session of 19 Oct
 * 23:24Z opened `#/canvas?ai=core.` from a sentence, fell to the default lane silently and tested the A lane as core).
 * Only those are folded: any other spelling ("cored") is still no mode.
 */
const normalisedMode = (raw: string | null): string | null => (raw === null ? null : raw.trim().toLowerCase().replace(/[^a-z]+$/, ''))

function explicitModeFromUrl(url: URL): AiComparisonMode | null {
  const pageMode = url.searchParams.get('ai')
  const hash = url.hash ?? ''
  const queryIndex = hash.indexOf('?')
  const hashParams =
    queryIndex >= 0 ? new URLSearchParams(hash.slice(queryIndex + 1)) : new URLSearchParams()
  const mode = normalisedMode(hashParams.get('ai') ?? pageMode)
  if (mode === 'core') return 'core-route'
  return mode === 'openai' || mode === 'conventional' || mode === 'core-route' ? mode : null
}

function isOlumiStagingHost(hostname: string): boolean {
  return hostname === 'staging--olumi.netlify.app' || hostname.endsWith('--olumi.netlify.app')
}

/**
 * Comparison mode is explicit on staging:
 *   #/canvas?ai=conventional  -> original/conventional CEE route
 *   #/canvas?ai=openai       -> OpenAI Agent route
 *
 * Staging defaults to the core route (DL 22 Oct; before, OpenAI, from Paul's
 * OpenAI-only constraint of 24 Sep 18:15Z): a plain link, bookmark or shared URL
 * must never reach the conventional route, which calls Anthropic. The conventional control stays
 * reachable, but only explicitly via ?ai=conventional. Production keeps its
 * deployment-configured behaviour unless a future product decision explicitly
 * introduces a selector there.
 */
export function resolveAiComparisonMode(href?: string): AiComparisonMode | null {
  if (typeof window === 'undefined' && href == null) return null
  const source = href ?? window.location.href
  let url: URL
  try {
    url = new URL(source)
  } catch {
    return null
  }
  const explicit = explicitModeFromUrl(url)
  if (explicit !== null) return explicit
  return isOlumiStagingHost(url.hostname) ? 'core-route' : null
}

export function aiComparisonHeaders(href?: string): Record<string, string> {
  const mode = resolveAiComparisonMode(href)
  return mode === null ? {} : { [AI_MODE_HEADER]: mode }
}

/**
 * The engine label the product panel SHOWS: whichever engine is serving, the staging default included (DL-3, 20 Oct:
 * Paul's 23:24Z session ran the default lane while he tested core, and the panel said nothing; this replaces the 26 Sep
 * "no default label" rule, v3.1 design gap #30). A tester must never compare two engines under an identical-looking surface.
 * Production carries a label only for an explicit mode (it has no default).
 */
export function aiComparisonBadge(href?: string): string | null {
  if (typeof window === 'undefined' && href == null) return null
  return resolveAiComparisonMode(href ?? window.location.href) === null ? null : aiComparisonLabel(href ?? window.location.href)
}

/** Every OpenAI surface reaches the OpenAI Agent route; none may make an Anthropic call from the browser. */
export function isOpenAiLane(mode: AiComparisonMode | null): boolean {
  return mode === 'openai' || mode === 'core-route'
}

export function aiComparisonLabel(href?: string): string | null {
  const mode = resolveAiComparisonMode(href)
  if (mode === 'core-route') return 'OpenAI core route'
  if (mode === 'openai') return 'OpenAI'
  if (mode === 'conventional') return 'Conventional'
  return null
}
