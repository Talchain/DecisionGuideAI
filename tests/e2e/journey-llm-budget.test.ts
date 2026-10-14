/**
 * The J1 LLM boundary's call budget (DL 87114, 9 Oct): JOURNEY_LLM_MAX_CALLS=0 means ZERO forwards, never "no cap"
 * (a J1 proof run with J1_MAX_CALLS=0 sent 2 real provider calls). The server runs with outbound DNS and HTTPS
 * stubbed to fail, so no code version can reach a provider: a budget refusal answers 400 journey_budget_exhausted
 * and ledgers refused_budget; a forward attempt (the old reading of 0) ends as a 502 upstream_error instead.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SERVER = path.resolve(__dirname, '../../e2e/core/journey/stack/llm-replay-server.mjs')
const NO_NETWORK = 'data:text/javascript,' + encodeURIComponent([
  "import dns from 'node:dns'; import https from 'node:https';",
  "dns.promises.lookup = async () => { throw new Error('network blocked by test') };",
  "https.request = () => { throw new Error('network blocked by test') };",
].join('\n'))

let child: ChildProcess | null = null
afterEach(() => { child?.kill(); child = null })

async function boot(maxCalls: string | undefined): Promise<{ port: number; ledger: string; exit: Promise<number | null> }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'j1-budget-'))
  const ledger = path.join(dir, 'ledger.ndjson')
  const port = 20_000 + Math.floor(Math.random() * 20_000)
  const env: NodeJS.ProcessEnv = { ...process.env, JOURNEY_LLM_MODE: 'record', JOURNEY_LLM_FIXTURES: dir, JOURNEY_LLM_LEDGER: ledger, JOURNEY_LLM_HTTP_PORT: String(port) }
  delete env.JOURNEY_LLM_MAX_CALLS
  if (maxCalls !== undefined) env.JOURNEY_LLM_MAX_CALLS = maxCalls
  const c = spawn(process.execPath, ['--import', NO_NETWORK, SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  child = c
  const exit = new Promise<number | null>((resolve) => c.on('exit', (code) => resolve(code)))
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 10_000)
    c.stdout!.on('data', (b: Buffer) => { if (b.toString().includes('[llm-replay]')) { clearTimeout(t); resolve() } })
    c.on('exit', () => { clearTimeout(t); resolve() })
  })
  return { port, ledger, exit }
}

const providerCall = (port: number) => fetch(`http://127.0.0.1:${port}/v1/responses`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-journey-host': 'api.openai.com' },
  body: JSON.stringify({ model: 'test', input: 'budget row' }),
})
const outcomes = (ledger: string) => fs.readFileSync(ledger, 'utf8').trim().split('\n').map((l) => JSON.parse(l).outcome)

describe('J1 LLM boundary call budget', () => {
  it('MAX_CALLS=0 refuses the first forward (zero means zero)', async () => {
    const { port, ledger } = await boot('0')
    const r = await providerCall(port)
    expect(r.status).toBe(400)
    expect(((await r.json()) as { error?: { type?: string } }).error?.type).toBe('journey_budget_exhausted')
    expect(outcomes(ledger)).toEqual(['refused_budget'])
  }, 30_000)

  it('control: unset budget does not refuse, so the forward is attempted (and fails on the blocked network)', async () => {
    const { port, ledger } = await boot(undefined)
    const r = await providerCall(port)
    expect(r.status).toBe(502)
    expect(outcomes(ledger)).toEqual(['upstream_error'])
  }, 60_000)

  it('a budget that is not a whole number >= 0 stops the server', async () => {
    const { exit } = await boot('-1')
    expect(await exit).toBe(2)
  }, 30_000)
})
