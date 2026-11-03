/**
 * On the olumi-core lane nothing is sent to /bff (canvas slice A). olumi-core serving DGAI on one origin has no /bff: a GET there is
 * answered with DGAI's own page (200, HTML), which a caller would read as success. Every same-origin /bff/ request is answered here
 * with "not available on Olumi" (404), without a network call, so
 * each caller takes the refusal it already handles. What the lane does use goes to core itself (src/olumiView/).
 */
export const NOT_ON_OLUMI = 'not available on Olumi'

type Win = { fetch: typeof fetch; location: { href: string } }

const pathOf = (input: RequestInfo | URL, base: string): URL | null => {
  try { return new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, base) } catch { return null }
}

/** Answer /bff/ on this page's origin with a 404, never the network. Installed once, at boot, on the core lane only. */
export function guardBff(win: Win): void {
  const real = win.fetch.bind(win)
  win.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = pathOf(input, win.location.href)
    if (url !== null && url.origin === new URL(win.location.href).origin && url.pathname.startsWith('/bff/')) {
      return Promise.resolve(new Response(JSON.stringify({ error: NOT_ON_OLUMI }), { status: 404, headers: { 'content-type': 'application/json' } }))
    }
    return real(input, init)
  }) as typeof fetch
}
