/**
 * `core` (PATH-B, Paul 19 Oct): the same OpenAI Agent route, where CEE runs the turn on the OpenAI Agents SDK and Olumi adds or
 * rewrites no reply prose (`#/canvas?ai=core`; CEE ignores it in production). A staging comparison surface, like `conventional`.
 */
export type AiComparisonMode = 'conventional' | 'openai' | 'core'

export const AI_MODE_HEADER = 'x-olumi-ai-mode' as const

function explicitModeFromUrl(url: URL): AiComparisonMode | null {
  const pageMode = url.searchParams.get('ai')
  const hash = url.hash ?? ''
  const queryIndex = hash.indexOf('?')
  const hashParams =
    queryIndex >= 0 ? new URLSearchParams(hash.slice(queryIndex + 1)) : new URLSearchParams()
  const mode = hashParams.get('ai') ?? pageMode
  return mode === 'openai' || mode === 'conventional' || mode === 'core' ? mode : null
}

function isOlumiStagingHost(hostname: string): boolean {
  return hostname === 'staging--olumi.netlify.app' || hostname.endsWith('--olumi.netlify.app')
}

/**
 * Comparison mode is explicit on staging:
 *   #/canvas?ai=conventional  -> original/conventional CEE route
 *   #/canvas?ai=openai       -> OpenAI Agent route
 *
 * Staging defaults to OpenAI (25 Sep 2026, Paul's OpenAI-only constraint of
 * 24 Sep 18:15Z): a plain link, bookmark or shared URL must never reach the
 * conventional route, which calls Anthropic. The conventional control stays
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
  return isOlumiStagingHost(url.hostname) ? 'openai' : null
}

export function aiComparisonHeaders(href?: string): Record<string, string> {
  const mode = resolveAiComparisonMode(href)
  return mode === null ? {} : { [AI_MODE_HEADER]: mode }
}

/**
 * The engine label worth SHOWING in the product panel: only a mode that differs from what this host uses anyway.
 * Staging defaults to OpenAI, so "AI: OpenAI" on every screen was debug chrome in the Olumi tab (v3.1 design gap
 * #30; Paul, 26 Sep: "needs to be a premium design"). An explicit ?ai=conventional session still says so, which
 * is what the label exists for: a tester must never compare two engines under an identical-looking surface.
 */
export function aiComparisonBadge(href?: string): string | null {
  if (typeof window === 'undefined' && href == null) return null
  const source = href ?? window.location.href
  let url: URL
  try {
    url = new URL(source)
  } catch {
    return null
  }
  const mode = resolveAiComparisonMode(source)
  const hostDefault: AiComparisonMode | null = isOlumiStagingHost(url.hostname) ? 'openai' : null
  if (mode === null || mode === hostDefault) return null
  return aiComparisonLabel(source)
}

/** Both OpenAI surfaces reach the OpenAI Agent route; neither may make an Anthropic call from the browser. */
export function isOpenAiLane(mode: AiComparisonMode | null): boolean {
  return mode === 'openai' || mode === 'core'
}

export function aiComparisonLabel(href?: string): string | null {
  const mode = resolveAiComparisonMode(href)
  if (mode === 'core') return 'OpenAI core'
  if (mode === 'openai') return 'OpenAI'
  if (mode === 'conventional') return 'Conventional'
  return null
}
