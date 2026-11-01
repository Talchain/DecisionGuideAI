import type { TeamScenario } from '../team/types'

/** A scenario view as olumi-core 2b84912 serves it (shapes read from a live scripted core, 1 Nov 2026). */
export function scenario(over: Partial<TeamScenario> = {}): TeamScenario {
  return {
    id: 's_75ba67edc0e5', title: 'Capacity', you: 'Ada',
    members: [{ id: '1', name: 'Ada' }, { id: '5', name: 'Bea' }],
    views: [], waiting: ['Ada', 'Bea'], reveal: { state: 'open', at: null },
    commitments: [], evidence: [], pending: null,
    version: {
      id: 4, n: 1,
      form: {
        records: [
          { id: 'per_specialist', family: 'quantity', label: 'Tickets added per specialist' },
          { id: 'add_one', family: 'option', label: 'Add one specialist' },
          { id: 'morale_link', family: 'relation' },
          { id: 'lead_doubt', family: 'dissent', holder: 'our team lead', position: 'A new hire may unsettle the team.' },
        ],
      },
    },
    ...over,
  }
}

/** A fake of the `/api` proxy: records every call and answers from a handler. */
export function fakeApi(handler: (method: string, path: string, body: unknown) => { status?: number; json: unknown }) {
  const calls: Array<{ method: string; path: string; body: unknown; headers: Record<string, string> }> = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method: init?.method ?? 'GET', path, body, headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)) })
    const r = handler(init?.method ?? 'GET', path, body)
    const status = r.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => r.json } as Response
  }) as typeof fetch
  return { calls, fetchImpl }
}
