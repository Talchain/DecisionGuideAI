// The shape of fakeCore.mjs for the specs that import it from TypeScript (the .mjs itself stays plain JavaScript, outside the gate).
export function startFakeCore(): Promise<{
  url: string
  calls: { method: string; path: string; token: string | null; body: unknown; site: string | null }[]
  addPerson(token: string, id: string, name: string): void
  seed(token: string, view: unknown, after?: { approve?: unknown; edit?: unknown }): string
  close(): Promise<void>
  [key: string]: unknown
}>
