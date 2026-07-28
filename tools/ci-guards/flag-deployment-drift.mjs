#!/usr/bin/env node
// tools/ci-guards/flag-deployment-drift.mjs
// =============================================================================
// FLAG DEPLOYMENT DRIFT — the DEPLOYED bundle is the truth, repo config is advisory
// =============================================================================
//
// WHY THIS EXISTS
// ---------------
// Feature flags reach the deployed staging site from THREE places:
//   1. `src/flags.ts`      — the `defaultValue` compiled into the code
//   2. `netlify.toml`      — `[build.environment]` / `[context.staging.environment]`
//   3. the Netlify DASHBOARD — invisible to this repo, and it WINS
//
// (3) is why reading (1) or (2) to decide "what does a tester see?" gives the
// wrong answer. Verified 2026-07-28: VITE_V5_CANONICAL_ANALYSIS is ON in the
// deployed staging bundle, appears NOWHERE in netlify.toml, and defaults OFF in
// flags.ts. Same for VITE_FEATURE_COMPARE_TAB and VITE_FEATURE_PRE_ANALYSIS_V3.
// Flag-off code paths therefore look DEAD when they are LIVE — that mis-scoped
// two dispatches in a single day.
//
// HOW IT DERIVES (never a hand-maintained list — that is the defect it replaces)
// -----------------------------------------------------------------------------
//   declared: TypeScript AST walk of the `FLAGS_CONFIG` object literal in
//             src/flags.ts. A declaration form the walker cannot read becomes an
//             UNPARSEABLE entry and FAILS LOUD — it is never silently omitted,
//             because a silent omission is exactly how a mirror goes stale green.
//   repo:     section scan of the real netlify.toml.
//   deployed: Vite bakes `import.meta.env` into the bundle as a literal object,
//             because src/lib/flagFactory.ts snapshots it with a LITERAL
//             `import.meta.env` reference (`envSnapshot = { ...import.meta.env }`).
//             So the served flags chunk carries the true deployed values. The
//             asset filename is content-hashed and is DERIVED from the served
//             index.html -> entry chunk -> flags chunk. Never hard-coded.
//
// POSTURE: REPORTING, NOT BLOCKING.
// --------------------------------
// Exit 0 even when divergences are found. Someone flipping a dashboard flag is
// NORMAL — reddening CI for it would make this the broken alarm it exists to
// replace. `--fail-on-divergence` opts in to blocking for a caller that wants it.
//
// If the network is unreachable the run reports UNVERIFIED and says exactly what
// it could not check. It NEVER reports "no divergences" without having looked —
// an unreachable check that reports green is the precise defect class this closes.
//
// SECRETS: the baked env object contains real credentials (VITE_PLOT_BEARER,
// VITE_SUPABASE_ANON_KEY). This tool prints values ONLY for env keys that
// src/flags.ts declares as feature flags, and even then only after normalising
// them to ON/OFF; anything non-boolean prints as <non-boolean:redacted>. Env
// keys it does not recognise are reported by NAME ONLY, never by value.
//
// Usage:
//   pnpm flags:check                       # human table against staging
//   pnpm flags:check --json                # machine-readable
//   pnpm flags:check --url=https://…       # another deploy
//   pnpm flags:check --fail-on-divergence  # opt-in blocking
// =============================================================================

import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

export const DEFAULT_DEPLOY_URL = 'https://staging--olumi.netlify.app'

/** Thrown when the deployed bundle could not be reached or read. Never swallowed. */
export class DeployUnreachableError extends Error {
  constructor(message, { url, cause } = {}) {
    super(message)
    this.name = 'DeployUnreachableError'
    this.url = url
    this.cause = cause
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DECLARED — TypeScript AST walk of FLAGS_CONFIG in src/flags.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk `src/flags.ts` and return every flag declaration it contains.
 *
 * Deliberately strict. Any property whose shape this walker cannot fully read
 * is returned in `unparseable` rather than dropped, and callers treat a
 * non-empty `unparseable` as a hard failure. A walker that silently skips what
 * it does not understand is a hand-maintained mirror with extra steps.
 *
 * @returns {{ flags: Array<{name,envKey,storageKey,defaultValue}>, unparseable: Array<{name,reason}> }}
 */
export function deriveDeclaredFlags(sourceText, fileName = 'flags.ts') {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true)

  let configObject = null
  const visit = (node) => {
    if (configObject) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'FLAGS_CONFIG') {
      let init = node.initializer
      // Unwrap `{...} as const` / `<const>{...}` / parenthesised forms.
      while (init && (ts.isAsExpression(init) || ts.isTypeAssertionExpression(init) || ts.isParenthesizedExpression(init))) {
        init = init.expression
      }
      if (init && ts.isObjectLiteralExpression(init)) configObject = init
      else {
        throw new Error(
          `FLAGS_CONFIG in ${fileName} is not an object literal (got ${init ? ts.SyntaxKind[init.kind] : 'nothing'}). ` +
          `The flag-drift walker cannot derive the declared set — fix the walker, do not fall back to a hand-listed array.`
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)

  if (!configObject) {
    throw new Error(
      `Could not find a FLAGS_CONFIG declaration in ${fileName}. ` +
      `The flag-drift walker derives the declared set from that object; without it there is nothing to compare ` +
      `and reporting "no divergences" would be a lie.`
    )
  }

  const flags = []
  const unparseable = []

  for (const prop of configObject.properties) {
    // Only plain `name: { ... }` assignments are readable. Spread, shorthand,
    // methods and computed keys are reported, never skipped.
    if (!ts.isPropertyAssignment(prop)) {
      unparseable.push({
        name: prop.name && ts.isIdentifier(prop.name) ? prop.name.text : `<${ts.SyntaxKind[prop.kind]}>`,
        reason: `unsupported property kind ${ts.SyntaxKind[prop.kind]} (spread/shorthand/method are not readable)`,
      })
      continue
    }
    if (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name)) {
      unparseable.push({ name: '<computed>', reason: 'computed property name' })
      continue
    }
    const name = prop.name.text
    if (!ts.isObjectLiteralExpression(prop.initializer)) {
      unparseable.push({ name, reason: `initializer is ${ts.SyntaxKind[prop.initializer.kind]}, expected an object literal` })
      continue
    }

    let envKey = null
    let storageKey = null
    let defaultValue = false
    let bad = null

    for (const f of prop.initializer.properties) {
      if (!ts.isPropertyAssignment(f) || !(ts.isIdentifier(f.name) || ts.isStringLiteral(f.name))) {
        bad = `field of kind ${ts.SyntaxKind[f.kind]} is not readable`
        break
      }
      const field = f.name.text
      const v = f.initializer
      if (field === 'envKey' || field === 'storageKey') {
        if (!ts.isStringLiteral(v) && !ts.isNoSubstitutionTemplateLiteral(v)) {
          bad = `${field} is ${ts.SyntaxKind[v.kind]}, expected a string literal`
          break
        }
        if (field === 'envKey') envKey = v.text
        else storageKey = v.text
      } else if (field === 'defaultValue') {
        if (v.kind === ts.SyntaxKind.TrueKeyword) defaultValue = true
        else if (v.kind === ts.SyntaxKind.FalseKeyword) defaultValue = false
        else {
          bad = `defaultValue is ${ts.SyntaxKind[v.kind]}, expected a boolean literal`
          break
        }
      }
      // Unknown extra fields are harmless — they do not affect resolution.
    }

    if (bad) { unparseable.push({ name, reason: bad }); continue }
    if (!envKey) { unparseable.push({ name, reason: 'no envKey string literal found' }); continue }

    flags.push({ name, envKey, storageKey, defaultValue })
  }

  return { flags, unparseable }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. REPO CONFIG — scan the real netlify.toml
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract env assignments from netlify.toml's build + staging contexts.
 * A deliberate small scanner rather than a dependency: netlify.toml env blocks
 * are flat `KEY = "value"` lines. Comments (`#`) are ignored.
 */
export function parseNetlifyEnv(tomlText) {
  const sections = { build: {}, staging: {} }
  const SECTION_OF = {
    '[build.environment]': 'build',
    '[context.staging.environment]': 'staging',
  }
  let current = null
  for (const rawLine of tomlText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('#') || line === '') continue
    if (line.startsWith('[')) { current = SECTION_OF[line] ?? null; continue }
    if (!current) continue
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/)
    if (!m) continue
    let value = m[2].trim().replace(/\s+#.*$/, '').trim()
    const q = value.match(/^"((?:[^"\\]|\\.)*)"$/) || value.match(/^'([^']*)'$/)
    sections[current][m[1]] = q ? q[1] : value
  }
  return sections
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DEPLOYED — extract the baked import.meta.env snapshot from a served chunk
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pull the Vite-baked env object out of bundle text.
 *
 * Anchors on the Vite-injected `BASE_URL:"` marker and brace-matches the object
 * around it, so it reads the real `import.meta.env` replacement rather than any
 * incidental `VITE_x:"y"` pair elsewhere in the file.
 *
 * Throws when it finds no env object at all. It must never return `{}` and let
 * a caller print "no divergences" — see the anti-vacuity spec.
 */
export function extractDeployedEnv(chunkText, { sourceLabel = 'bundle' } = {}) {
  const out = {}
  let anchorsSeen = 0

  for (const m of chunkText.matchAll(/BASE_URL\s*:\s*["']/g)) {
    // Walk back to the object's opening brace.
    let open = -1
    for (let i = m.index; i >= 0; i--) {
      if (chunkText[i] === '{') { open = i; break }
      if (chunkText[i] === '}' || chunkText[i] === ';') break
    }
    if (open === -1) continue

    // Brace-match forward, skipping string contents.
    let depth = 0, close = -1, quote = null
    for (let i = open; i < chunkText.length; i++) {
      const c = chunkText[i]
      if (quote) {
        if (c === '\\') { i++; continue }
        if (c === quote) quote = null
        continue
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '{') depth++
      else if (c === '}') { depth--; if (depth === 0) { close = i; break } }
    }
    if (close === -1) continue

    anchorsSeen++
    const slice = chunkText.slice(open, close + 1)
    for (const p of slice.matchAll(/(VITE_[A-Z0-9_]+)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|!0|!1|true|false|-?\d+(?:\.\d+)?)/g)) {
      out[p[1]] = coerceBakedLiteral(p[2])
    }
  }

  if (anchorsSeen === 0) {
    throw new DeployUnreachableError(
      `No Vite import.meta.env object found in the served ${sourceLabel}. ` +
      `Either the asset chain was resolved to the wrong file, or flagFactory.ts stopped snapshotting ` +
      `\`{ ...import.meta.env }\` with a literal reference (which is what makes the values readable). ` +
      `Refusing to report "no divergences" from a bundle whose env could not be read.`
    )
  }
  if (Object.keys(out).length === 0) {
    throw new DeployUnreachableError(
      `Found a Vite env object in the served ${sourceLabel} but it contained ZERO VITE_* keys. ` +
      `That is not a green result — it means the extraction is broken or the deploy defines no flags at all.`
    )
  }
  return out
}

function coerceBakedLiteral(raw) {
  if (raw === '!0' || raw === 'true') return 'true'
  if (raw === '!1' || raw === 'false') return 'false'
  if (raw.startsWith('"') || raw.startsWith("'")) return raw.slice(1, -1)
  return raw
}

/** Mirror of flagFactory.makeFlag's env coercion. Anything else is not a boolean. */
export function coerceFlagValue(raw) {
  if (raw === '1' || raw === 1 || raw === true || raw === 'true') return true
  if (raw === '0' || raw === 0 || raw === false || raw === 'false') return false
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FETCH — derive the content-hashed asset chain from the served index.html
// ─────────────────────────────────────────────────────────────────────────────

async function getText(url, timeoutMs) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow' })
    if (!res.ok) throw new DeployUnreachableError(`HTTP ${res.status} ${res.statusText} for ${url}`, { url })
    return await res.text()
  } catch (err) {
    if (err instanceof DeployUnreachableError) throw err
    throw new DeployUnreachableError(`Could not fetch ${url}: ${err?.message || err}`, { url, cause: err })
  } finally {
    clearTimeout(t)
  }
}

/**
 * index.html -> entry chunk -> flags chunk. Every filename is content-hashed and
 * therefore DERIVED at each hop; nothing here is hard-coded.
 *
 * Both the flags chunk and the entry chunk are scanned, so this keeps working if
 * Vite's chunking moves the env snapshot between them.
 */
export async function fetchDeployedEnv(baseUrl = DEFAULT_DEPLOY_URL, { timeoutMs = 20000, log = () => {} } = {}) {
  const base = baseUrl.replace(/\/+$/, '')
  const chain = []

  const html = await getText(`${base}/`, timeoutMs)
  chain.push(`${base}/`)

  const entryPaths = [...html.matchAll(/(?:src|href)\s*=\s*"(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
  if (entryPaths.length === 0) {
    throw new DeployUnreachableError(`No /assets/*.js entry chunk referenced by ${base}/ — cannot derive the asset chain.`, { url: `${base}/` })
  }

  const texts = []
  for (const p of entryPaths) {
    const entryUrl = `${base}${p}`
    const entryText = await getText(entryUrl, timeoutMs)
    chain.push(entryUrl)
    texts.push({ label: p, text: entryText })

    for (const m of entryText.matchAll(/["'](?:\.\/)?(?:assets\/)?(flags-[A-Za-z0-9_-]+\.js)["']/g)) {
      const flagsUrl = `${base}/assets/${m[1]}`
      if (chain.includes(flagsUrl)) continue
      const flagsText = await getText(flagsUrl, timeoutMs)
      chain.push(flagsUrl)
      texts.push({ label: `assets/${m[1]}`, text: flagsText })
    }
  }
  log(`  asset chain: ${chain.map((u) => u.replace(base, '')).join('  ->  ')}`)

  const merged = {}
  const errors = []
  for (const { label, text } of texts) {
    try { Object.assign(merged, extractDeployedEnv(text, { sourceLabel: label })) } catch (e) { errors.push(`${label}: ${e.message}`) }
  }
  if (Object.keys(merged).length === 0) {
    throw new DeployUnreachableError(
      `Fetched ${texts.length} chunk(s) from ${base} but extracted ZERO VITE_* values.\n  ` + errors.join('\n  '),
      { url: base }
    )
  }
  return { env: merged, chain }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DIVERGENCE
// ─────────────────────────────────────────────────────────────────────────────

export const VERDICT = {
  OK: 'OK',
  DRIFT: 'DRIFT',
  DASHBOARD: 'DRIFT (dashboard-set)',
  NONBOOL: 'NON-BOOLEAN',
}

/**
 * Compare what the repo predicts against what is actually deployed.
 *
 * `repoExpected` follows Netlify's own precedence: the staging context overrides
 * [build.environment], and with neither the compiled `defaultValue` wins.
 */
export function computeDivergences({ declared, netlify, deployed }) {
  const rows = declared.map((f) => {
    const inStaging = Object.prototype.hasOwnProperty.call(netlify.staging, f.envKey)
    const inBuild = Object.prototype.hasOwnProperty.call(netlify.build, f.envKey)
    const repoRaw = inStaging ? netlify.staging[f.envKey] : inBuild ? netlify.build[f.envKey] : null
    const repoSource = inStaging ? 'netlify.toml[staging]' : inBuild ? 'netlify.toml[build]' : 'flags.ts default'
    const repoExpected = repoRaw === null ? f.defaultValue : (coerceFlagValue(repoRaw) ?? f.defaultValue)

    const inDeploy = Object.prototype.hasOwnProperty.call(deployed, f.envKey)
    const deployRaw = inDeploy ? deployed[f.envKey] : null
    const deployCoerced = inDeploy ? coerceFlagValue(deployRaw) : null
    // Absent from the bundle => nothing overrides the compiled default.
    const deployEffective = inDeploy ? (deployCoerced ?? f.defaultValue) : f.defaultValue

    let verdict
    if (inDeploy && deployCoerced === null) verdict = VERDICT.NONBOOL
    else if (deployEffective !== repoExpected) verdict = inDeploy && !inStaging && !inBuild ? VERDICT.DASHBOARD : VERDICT.DRIFT
    else verdict = VERDICT.OK

    return {
      name: f.name,
      envKey: f.envKey,
      declaredDefault: f.defaultValue,
      netlifyValue: repoRaw,
      repoSource,
      repoExpected,
      deployedRaw: deployCoerced === null && inDeploy ? '<non-boolean:redacted>' : deployRaw,
      deployedPresent: inDeploy,
      deployEffective,
      dashboardOnly: inDeploy && !inStaging && !inBuild,
      verdict,
    }
  })

  const declaredKeys = new Set(declared.map((f) => f.envKey))
  // NAMES ONLY. These are undeclared env keys and may be credentials.
  const undeclaredInDeploy = Object.keys(deployed).filter((k) => !declaredKeys.has(k)).sort()

  return {
    rows,
    divergences: rows.filter((r) => r.verdict !== VERDICT.OK),
    undeclaredInDeploy,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. RENDER
// ─────────────────────────────────────────────────────────────────────────────

const onOff = (b) => (b ? 'ON' : 'OFF')

export function renderTable(rows) {
  const head = ['FLAG', 'ENV KEY', 'flags.ts', 'netlify.toml', 'DEPLOYED', 'VERDICT']
  const body = rows.map((r) => [
    r.name,
    r.envKey,
    onOff(r.declaredDefault),
    r.netlifyValue === null ? '—' : `"${r.netlifyValue}"`,
    r.deployedPresent ? `${onOff(r.deployEffective)} ("${r.deployedRaw}")` : '— (absent)',
    r.verdict,
  ])
  const all = [head, ...body]
  const w = head.map((_, i) => Math.max(...all.map((r) => String(r[i]).length)))
  const line = (cells, pad = ' ') => cells.map((c, i) => String(c).padEnd(w[i], pad)).join(pad === '-' ? '-+-' : ' | ')
  return [line(head), line(w.map(() => ''), '-'), ...body.map((r) => line(r))].join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. CLI
// ─────────────────────────────────────────────────────────────────────────────

export async function run(argv = [], { cwd = process.cwd(), log = console.log, err = console.error } = {}) {
  const asJson = argv.includes('--json')
  const failOnDivergence = argv.includes('--fail-on-divergence')
  const urlArg = argv.find((a) => a.startsWith('--url='))
  const baseUrl = urlArg ? urlArg.slice('--url='.length) : DEFAULT_DEPLOY_URL
  const say = asJson ? () => {} : log

  const flagsSource = await fs.readFile(path.join(cwd, 'src/flags.ts'), 'utf8')
  const { flags: declared, unparseable } = deriveDeclaredFlags(flagsSource, 'src/flags.ts')
  const netlify = parseNetlifyEnv(await fs.readFile(path.join(cwd, 'netlify.toml'), 'utf8'))

  if (declared.length === 0) {
    err('FATAL: derived ZERO flag declarations from src/flags.ts.')
    err('A zero-length declared set cannot diverge from anything, so this run would report a')
    err('vacuous PASS. Treating it as a failure of the derivation, not as a clean result.')
    return 2
  }
  if (unparseable.length > 0) {
    err(`FATAL: ${unparseable.length} declaration(s) in src/flags.ts could not be parsed:`)
    for (const u of unparseable) err(`  - ${u.name}: ${u.reason}`)
    err('Refusing to report on a partial declared set — silently omitting these is exactly the')
    err('hand-maintained-mirror drift this check exists to prevent. Fix the walker.')
    return 2
  }

  say('')
  say('='.repeat(100))
  say('FLAG DEPLOYMENT DRIFT')
  say('='.repeat(100))
  say(`Declared flags derived from src/flags.ts (AST walk of FLAGS_CONFIG): ${declared.length}`)
  say(`netlify.toml: ${Object.keys(netlify.build).length} key(s) in [build.environment], ` +
      `${Object.keys(netlify.staging).length} in [context.staging.environment]`)
  say(`Deploy under test: ${baseUrl}`)
  say('')

  let deployed = null
  let chain = []
  let unreachable = null
  try {
    const r = await fetchDeployedEnv(baseUrl, { log: say })
    deployed = r.env
    chain = r.chain
  } catch (e) {
    if (!(e instanceof DeployUnreachableError)) throw e
    unreachable = e
  }

  if (unreachable) {
    const payload = {
      status: 'UNVERIFIED',
      reason: unreachable.message,
      baseUrl,
      declaredCount: declared.length,
      verifiedFlags: [],
      unverifiedFlags: declared.map((f) => f.envKey),
    }
    if (asJson) { log(JSON.stringify(payload, null, 2)); return 0 }
    err('')
    err('#'.repeat(100))
    err('## STATUS: UNVERIFIED — THE DEPLOYED BUNDLE COULD NOT BE READ')
    err('#'.repeat(100))
    err(`## ${unreachable.message}`)
    err('##')
    err(`## NOT CHECKED: all ${declared.length} declared flags. Their true deployed values are UNKNOWN.`)
    err('## This is NOT a pass. The repo columns below cannot tell you what a tester sees, because')
    err('## Netlify dashboard variables override them and are invisible to this repo.')
    err('##')
    err(`## Fix the reason above (network access, or the asset chain / extraction), or read the`)
    err(`## baked env by hand: ${baseUrl}/assets/flags-*.js — derive the filename from index.html.`)
    err('#'.repeat(100))
    err('')
    return 0
  }

  const { rows, divergences, undeclaredInDeploy } = computeDivergences({ declared, netlify, deployed })

  if (asJson) {
    log(JSON.stringify({
      status: divergences.length ? 'DIVERGENCES' : 'ALIGNED',
      baseUrl, assetChain: chain, declaredCount: declared.length,
      rows, divergences, undeclaredInDeploy,
    }, null, 2))
    return failOnDivergence && divergences.length ? 1 : 0
  }

  log(`Deployed env keys read from the served bundle: ${Object.keys(deployed).length}`)
  log('')
  log('  ⚠ THE **DEPLOYED** COLUMN IS THE TRUTH.')
  log('    `flags.ts` and `netlify.toml` are ADVISORY ONLY: Netlify dashboard variables override')
  log('    both and are invisible to this repo. Never decide what a tester sees from the repo columns.')
  log('')
  log(renderTable(rows))
  log('')

  if (divergences.length === 0) {
    log(`✅ No divergences. All ${rows.length} declared flags deploy exactly as repo config predicts.`)
  } else {
    log(`⚠️  ${divergences.length} DIVERGENCE(S) — repo config does not describe the deployed reality:`)
    log('')
    for (const d of divergences) {
      log(`  • ${d.envKey}  (src/flags.ts \`${d.name}\`)`)
      log(`      repo says : ${onOff(d.repoExpected)}  (via ${d.repoSource})`)
      log(`      deployed  : ${d.deployedPresent ? `${onOff(d.deployEffective)}  ("${d.deployedRaw}")` : 'absent'}`)
      if (d.dashboardOnly) {
        log('      cause     : set in the NETLIFY DASHBOARD — absent from netlify.toml entirely.')
        log('                  Record it in [context.staging.environment] so the repo stops lying.')
      } else if (d.verdict === VERDICT.NONBOOL) {
        log('      cause     : deployed value is not boolean-ish, so flagFactory falls through to the default.')
      }
      log('')
    }
    log('  This is REPORTED, not enforced. Flipping a dashboard flag is normal and must not red CI.')
  }

  if (undeclaredInDeploy.length > 0) {
    log('')
    log(`ℹ️  ${undeclaredInDeploy.length} VITE_* key(s) in the deploy are not declared in src/flags.ts`)
    log('   (infra/env config or flags declared elsewhere, e.g. src/lib/featureFlags.ts).')
    log('   NAMES ONLY — values withheld, since this set contains credentials:')
    for (const k of undeclaredInDeploy) log(`     - ${k}`)
  }

  log('')
  return failOnDivergence && divergences.length ? 1 : 0
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  const here = path.dirname(fileURLToPath(import.meta.url))
  run(process.argv.slice(2), { cwd: path.resolve(here, '../..') })
    .then((code) => { process.exitCode = code })
    .catch((e) => { console.error(`FATAL: ${e?.stack || e?.message || e}`); process.exitCode = 2 })
}
