/** On the olumi-core lane nothing reaches /bff: every same-origin /bff/ request is refused as the adapter page refused it (canvas A). */
import { describe, expect, it } from 'vitest'
import { guardBff, NOT_ON_OLUMI } from '../bffGuard'

const page = () => {
  const sent: string[] = []
  const win = {
    location: { href: 'https://olumi.example/#/scenario/1b4e28ba-2fa1-41d2-883f-0016d3cca427' },
    fetch: (async (input: RequestInfo | URL) => { sent.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); return new Response('{}', { status: 200 }) }) as typeof fetch,
  }
  guardBff(win)
  return { win, sent }
}

describe('the /bff guard on the core lane', () => {
  it.each([
    ['a path', '/bff/cee/scenarios/1b4e28ba-2fa1-41d2-883f-0016d3cca427/versions'],
    ['a full URL on this origin', 'https://olumi.example/bff/orchestrate/v2/turn'],
    ['a URL object', new URL('https://olumi.example/bff/collab/state')],
    ['a Request', new Request('https://olumi.example/bff/engine/v1/run', { method: 'POST', body: '{}' })],
  ])('refuses %s with the adapter\'s 404 and sends nothing', async (_, input) => {
    const { win, sent } = page()
    const res = await win.fetch(input as RequestInfo)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: NOT_ON_OLUMI })
    expect(sent).toEqual([])
  })

  it.each([
    ['core\'s API', '/api/scenarios/s_0123456789ab/view'],
    ['another origin\'s /bff', 'https://cee.example/bff/cee/x'],
    ['a path that only starts with the letters', '/bffx/thing'],
  ])('lets %s through', async (_, input) => {
    const { win, sent } = page()
    expect((await win.fetch(input)).status).toBe(200)
    expect(sent).toHaveLength(1)
  })
})
