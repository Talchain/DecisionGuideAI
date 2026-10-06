// J1 local record only: `node --import ./llm-redirect-preload.mjs dist/src/server.js`.
//
// On the CI runner the provider hosts are redirected by /etc/hosts. A developer Mac
// has no passwordless sudo, so CEE's own fetch is redirected instead: a request to
// api.openai.com / api.anthropic.com goes to JOURNEY_LLM_REDIRECT (the boundary's
// plain-HTTP listener) with the original host in `x-journey-host`. The boundary then
// records it exactly as it would on the runner. Everything else is untouched.
//
// Installed before CEE's first import, so any module that captures `fetch` captures
// this one. A call that bypasses fetch is not recorded, and shows up as a replay
// MISS in CI rather than passing silently.
const target = process.env.JOURNEY_LLM_REDIRECT
if (target) {
  const HOSTS = new Set(['api.openai.com', 'api.anthropic.com'])
  const original = globalThis.fetch
  globalThis.fetch = async function journeyRedirect(input, init) {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url
    let url
    try { url = new URL(href) } catch { return original(input, init) }
    if (!HOSTS.has(url.hostname)) return original(input, init)
    const req = new Request(input, init)
    const headers = new Headers(req.headers)
    headers.set('x-journey-host', url.hostname)
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer()
    return original(`${target}${url.pathname}${url.search}`, {
      method: req.method, headers, body, signal: init?.signal ?? req.signal, redirect: 'manual',
    })
  }
  console.log(`[llm-redirect] provider hosts → ${target}`)
}
