#!/usr/bin/env node
// Local UI for the isolated shared-data experiment. Service keys stay in Vite's
// server-side proxy; the browser receives only a local anon token.
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { createHmac } from 'node:crypto'
import { spawn } from 'node:child_process'

const stateDir = resolve(homedir(), '.codex/workspaces/shared-data-spine-local')
const connection = JSON.parse(readFileSync(resolve(stateDir, 'connection.json'), 'utf8'))
if (connection.supabaseUrl !== 'http://127.0.0.1:55431') throw new Error('Local database required')
const env = { ...process.env }
for (const key of Object.keys(env)) if (/^(VITE_|SUPABASE_|ASSIST_API_KEY|CEE_SERVICE_URL|ENGINE_SERVICE_URL|ISL_SERVICE_URL)/.test(key)) delete env[key]
const credentialFile = resolve(homedir(), 'Documents/GitHub/olumi-assistants-service/.env.staging.local')
for (const line of readFileSync(credentialFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*(ASSIST_API_KEY)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
if (!env.ASSIST_API_KEY) throw new Error('Existing local assist credential is missing')
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: 'anon', exp: Math.floor(Date.now() / 1000) + 86400 })}`
const anonKey = `${unsigned}.${createHmac('sha256', connection.secret).update(unsigned).digest('base64url')}`
Object.assign(env, {
  CEE_SERVICE_URL: 'http://127.0.0.1:8791', ENGINE_SERVICE_URL: 'http://127.0.0.1:8791', ISL_SERVICE_URL: 'http://127.0.0.1:9',
  VITE_SUPABASE_URL: connection.supabaseUrl, VITE_SUPABASE_ANON_KEY: anonKey,
  VITE_AUTH_MODE: 'guest', VITE_POC_ONLY: '1', VITE_STUB_SUPABASE: '0',
  VITE_ENABLE_V5_ORCHESTRATOR: 'true', VITE_V5_CANONICAL_ANALYSIS: 'true',
  VITE_V5_ENDPOINT: 'http://127.0.0.1:8791/proxy/v5/turn',
  VITE_FEATURE_PRE_ANALYSIS_V3: '1', VITE_FEATURE_COMPARE_TAB: '1',
})

// A real, locally signed test user's SDK session. No model/results/local graph
// are seeded; loading this state in a fresh browser still requires server reads.
const token = readFileSync(resolve(stateDir, 'api-user-token.txt'), 'utf8').trim()
const user = JSON.parse(readFileSync(resolve(stateDir, 'api-user.json'), 'utf8'))
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
const storageKey = `sb-${new URL(connection.supabaseUrl).hostname.split('.')[0]}-auth-token`
const sdkSession = { access_token: token, refresh_token: 'local-test-no-refresh', token_type: 'bearer',
  expires_in: claims.exp - Math.floor(Date.now() / 1000), expires_at: claims.exp,
  user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: 'shared-data-local@example.invalid',
    app_metadata: { provider: 'local-test' }, user_metadata: {}, created_at: new Date().toISOString() } }
writeFileSync(resolve(stateDir, 'browser-auth.json'), JSON.stringify({ cookies: [], origins: [
  { origin: 'http://127.0.0.1:5178', localStorage: [{ name: storageKey, value: JSON.stringify(sdkSession) }] },
] }), { mode: 0o600 })
const boot = `const { createServer } = await import('vite');
const server = await createServer({ cacheDir: ${JSON.stringify(resolve(stateDir, 'vite-cache'))},
  server: { host: '127.0.0.1', port: 5178, strictPort: true } });
await server.listen(); server.printUrls();`
const child = spawn(process.execPath, ['--input-type=module', '-e', boot],
  { cwd: new URL('../', import.meta.url), env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', code => process.exit(code ?? 1))
