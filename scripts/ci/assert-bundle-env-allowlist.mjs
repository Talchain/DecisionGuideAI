#!/usr/bin/env node
// scripts/ci/assert-bundle-env-allowlist.mjs
// =============================================================================
// Fails the build if the BUILT BUNDLE bakes a `VITE_*` variable that no source
// file actually reads — i.e. if a wholesale `import.meta.env` inline has returned.
// =============================================================================
//
// THE DEFECT THIS CLOSES (measured at the bytes, 2026-07-28)
// ----------------------------------------------------------
// Vite replaces `import.meta.env.VITE_X` with that one value, but it cannot
// narrow a reference that puts the env object in VALUE position — a spread
// (`{ ...import.meta.env }`), an assignment (`const env = import.meta.env`), a
// default parameter (`env = import.meta.env`), or a `|| {}` fallback
// (`(import.meta as any)?.env || {}`). At every such site it inlines the ENTIRE
// env object into that chunk: every `VITE_*` the DEPLOY defines, with its value,
// whether or not the file reads it.
//
// So the exposed set was driven by what the deploy SET, not by what the code READ.
// A credential-free measurement proved it: a variable referenced NOWHERE in `src/`
// was baked into five separate chunks.
//
// TWO CHECKS, AND CHECK 1 IS THE REAL ONE
// ---------------------------------------
// 1. DERIVED (no mirror to maintain — CLAUDE.md trap 12). Every baked key must be
//    EXPLAINED: either a literal `import.meta.env(?.)VITE_X` read somewhere in
//    `src/`, or an entry in the generated `src/lib/flagEnv.ts`. A key that is baked
//    but read nowhere can only have arrived via a wholesale inline. This catches a
//    reintroduced spread directly, and needs no list kept in sync with reality.
//
// 2. DECLARED ALLOW-LIST (`bundle-env-allowlist.json`, sibling file). The baked set
//    must be a SUBSET of the declared set. This is a deliberate hand-maintained
//    mirror, and it is safe to be one BECAUSE IT FAILS LOUD: a new `VITE_*` in the
//    bundle reds the guard and forces a human to classify it — "is this a secret?"
//    — instead of it appearing silently. It never assumes-good.
//
// `knownExposed` records variables that ARE deliberately in the bundle today, with
// the reason and the work that removes them. Reported loudly on every run so the
// remaining exposure stays visible rather than becoming furniture.
//
// ANTI-VACUITY (CLAUDE.md trap 13): an absence assertion must first prove it can
// see a PRESENCE. `extractBakedKeys` throwing on an empty scan, and the positive
// controls in `tests/ci-guards/bundle-env-allowlist.spec.ts`, are what stop this
// guard from passing by testing nothing.
//
// POSTURE: BLOCKING, wired into `.github/workflows/ci.yml` beside
// `ci:bundle-policy` — NOT into `build:ci`. That is deliberate: `build:ci` is what
// Netlify runs, and a false red there would break staging deploys for every lane.
// This gates the MERGE, not the DEPLOY.
// =============================================================================

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '../..')
export const ALLOWLIST_PATH = path.join(HERE, 'bundle-env-allowlist.json')

/**
 * A baked env entry: `VITE_NAME:<literal VALUE>` with VITE_NAME in KEY position.
 *
 * `void 0` / `undefined` are deliberately NOT accepted as values, for two reasons:
 *
 *  1. They carry no data. A NAME with no value is not an exposure, and the whole
 *     point of this guard is what a bundle reader can HARVEST.
 *  2. Accepting them produced a FALSE POSITIVE. Minified ternaries of the form
 *     `…typeof e.VITE_ORG==="string"?e.VITE_ORG:void 0` end in the exact byte
 *     sequence `VITE_ORG:void 0`, so the guard reported two keys as baked-but-
 *     unread when nothing was baked at all. Caught on the guard's first real run
 *     against a build — which is the argument for running a new guard against
 *     reality before trusting either its greens OR its reds.
 */
const BAKED_PAIR =
  /(VITE_[A-Z0-9_]+)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|!0|!1|true|false|-?\d+(?:\.\d+)?)/g
/** A literal source read: `import.meta.env.VITE_X` or `import.meta.env?.VITE_X`. */
const SOURCE_READ = /import\.meta\s*\.\s*env\s*\??\s*\.\s*(VITE_[A-Z0-9_]+)/g
/** A generated flagEnv entry. */
const FLAG_ENV_ENTRY = /^\s*(VITE_[A-Z0-9_]+)\s*:\s*import\.meta\.env\?\./gm

export class VacuousScanError extends Error {}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(name)) out.push(full)
  }
  return out
}

/**
 * The VITE_* keys baked as key:value pairs across a set of {file, text} chunks.
 * THROWS rather than returning an empty set — an empty result would make every
 * downstream assertion pass by testing nothing (trap 13).
 */
export function extractBakedKeys(chunks) {
  const byChunk = new Map()
  const all = new Set()
  if (chunks.length === 0) {
    throw new VacuousScanError('Scanned ZERO .js chunks — refusing to report green from an empty scan.')
  }
  for (const { file, text } of chunks) {
    for (const m of text.matchAll(BAKED_PAIR)) {
      all.add(m[1])
      if (!byChunk.has(file)) byChunk.set(file, new Set())
      byChunk.get(file).add(m[1])
    }
  }
  if (all.size === 0) {
    throw new VacuousScanError(
      `Scanned ${chunks.length} chunk(s) but found ZERO baked VITE_* values. That is not a pass — ` +
        `the app declares feature flags, so a real build always bakes some. Either the extraction is ` +
        `broken or this is not a real build output.`,
    )
  }
  return { all, byChunk }
}

/**
 * Strip `//` and block comments so a COMMENT cannot excuse a baked key.
 *
 * This matters: the derived check asks "is this key read anywhere?". Without
 * stripping, a doc comment that merely NAMES a variable — and several of the
 * comments added by this very change do — would count as a read and silently
 * whitelist it. That would hollow out check 1 exactly the way trap 13 describes.
 * Crude but conservative: it only ever removes text, so it cannot invent a read.
 */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** Keys a literal, narrowable source read explains. Derived from src/, no mirror. */
export function deriveExplainedKeys({ srcDir, flagEnvPath }) {
  const readInSource = new Set()
  for (const file of walk(srcDir)) {
    const text = stripComments(readFileSync(file, 'utf8'))
    for (const m of text.matchAll(SOURCE_READ)) readInSource.add(m[1])
  }
  const flagEnvKeys = new Set()
  if (existsSync(flagEnvPath)) {
    for (const m of readFileSync(flagEnvPath, 'utf8').matchAll(FLAG_ENV_ENTRY)) flagEnvKeys.add(m[1])
  }
  if (flagEnvKeys.size === 0) {
    throw new VacuousScanError(
      `Derived ZERO keys from ${flagEnvPath} — the derivation is broken; refusing to report green.`,
    )
  }
  return { readInSource, flagEnvKeys, explained: new Set([...readInSource, ...flagEnvKeys]) }
}

/** Pure verdict. Returns { unexplained, undeclared } — both empty means PASS. */
export function computeVerdict({ baked, explained, allowed }) {
  return {
    unexplained: [...baked].filter((k) => !explained.has(k)).sort(),
    undeclared: [...baked].filter((k) => !allowed.has(k)).sort(),
  }
}

const UNEXPLAINED_HELP =
  `\n\n   A key can only get into the bundle unread via a WHOLESALE \`import.meta.env\` INLINE.\n` +
  `   Vite cannot narrow a reference that puts the env object in VALUE position, so it bakes the\n` +
  `   WHOLE env object — every variable the deploy defines, with its value, credentials included.\n\n` +
  `   Find the offending site:\n` +
  `     grep -rnE '\\.\\.\\.import\\.meta\\.env|= *\\(?import\\.meta( as any)?\\)?\\??\\.env( *\\|\\| *\\{\\})?$' src/\n` +
  `   Fix: read the values you need BY NAME — \`import.meta.env?.VITE_X\`.\n` +
  `   For a dynamic lookup over the flag set, use \`FLAG_ENV\` (src/lib/flagEnv.ts).`

const UNDECLARED_HELP =
  `\n\n   Every variable that reaches the browser is readable by anyone who loads the site.\n` +
  `   Classify each one before allowing it:\n` +
  `     · Is it a credential, token, key or secret?  → it must NOT be \`VITE_\`-prefixed.\n` +
  `       Move it server-side (see netlify/edge-functions/isl-proxy.ts for the pattern).\n` +
  `     · Is it genuinely public config (a base URL, a feature flag, a public anon key)?\n` +
  `       → add it to scripts/ci/bundle-env-allowlist.json with a one-line reason.\n`

export function run({ distAssets, srcDir, flagEnvPath, allowlistPath, log = console.log, err = console.error }) {
  if (!existsSync(distAssets)) {
    err(`\n❌ ${distAssets} not found — run a build first (pnpm run build).\n`)
    return 1
  }
  const chunks = readdirSync(distAssets)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => ({ file: f, text: readFileSync(path.join(distAssets, f), 'utf8') }))

  let baked, byChunk, explained, flagEnvKeys
  try {
    ;({ all: baked, byChunk } = extractBakedKeys(chunks))
    ;({ explained, flagEnvKeys } = deriveExplainedKeys({ srcDir, flagEnvPath }))
  } catch (e) {
    err(`\n❌ ${e.message}\n`)
    return 1
  }

  const declared = JSON.parse(readFileSync(allowlistPath, 'utf8'))
  const allowed = new Set([...(declared.allowed ?? []), ...flagEnvKeys])
  const { unexplained, undeclared } = computeVerdict({ baked, explained, allowed })

  if (unexplained.length > 0) {
    err(
      `\n❌ ${unexplained.length} VITE_* key(s) are BAKED INTO THE BUNDLE but read NOWHERE in src/:\n\n` +
        unexplained.map((k) => `     · ${k}`).join('\n') +
        UNEXPLAINED_HELP +
        '\n',
    )
    return 1
  }
  if (undeclared.length > 0) {
    err(
      `\n❌ ${undeclared.length} VITE_* key(s) are in the bundle but NOT in the declared allow-list:\n\n` +
        undeclared.map((k) => `     · ${k}`).join('\n') +
        UNDECLARED_HELP,
    )
    return 1
  }

  const known = declared.knownExposed ?? {}
  const namedInBundle = Object.keys(known).filter((k) => baked.has(k)).sort()
  const notNamedInBundle = Object.keys(known).filter((k) => !baked.has(k)).sort()

  log(`✅ Bundle env allow-list OK`)
  log(`   chunks: ${chunks.length} · baked VITE_* keys: ${baked.size} · declared-flag keys: ${flagEnvKeys.size}`)
  const widest = [...byChunk.entries()].sort((a, b) => b[1].size - a[1].size)[0]
  if (widest) log(`   widest chunk: ${widest[0]} (${widest[1].size} keys)`)

  // ── RESIDUAL RISK — always printed, never inferred from name-absence ────────
  //
  // ⚠ THIS GUARD DETECTS NAMES, NOT VALUES, AND THE DIFFERENCE IS THE WHOLE POINT.
  //
  // A wholesale inline emits `VITE_SECRET:"<value>"` — name AND value, which this
  // guard sees. A correctly-NARROWED read emits the value as a BARE STRING LITERAL
  // with the name compiled away (`const t="<value>"`). The narrowed form is still
  // fully readable by anyone who opens the asset; it is simply no longer
  // greppable by variable name.
  //
  // So "not baked as a named key" MUST NOT be reported as "no longer exposed".
  // Any entry carrying `valueStillInlined: true` is reported as STILL EXPOSED
  // regardless of whether its name appears, because only removing the READ (or
  // the variable) can remove the value.
  const residual = Object.entries(known).filter(([, v]) => typeof v === 'object' && v.valueStillInlined)
  if (residual.length > 0) {
    log(`\n🚨 ${residual.length} credential(s) STILL PRESENT IN THE CLIENT BUNDLE BY VALUE:`)
    for (const [k, v] of residual) log(`     · ${k} — ${v.reason}`)
    log(`   Their NAMES may be absent (narrowing compiles the name away) — that is NOT containment.`)
    log(`   Only the same-origin proxy removes the value. Do not read a green above as "fixed".`)
  }

  const trackedNamed = namedInBundle.filter((k) => !residual.some(([r]) => r === k))
  if (trackedNamed.length > 0) {
    log(`\n⚠️  ${trackedNamed.length} tracked variable(s) appear as NAMED keys in the bundle:`)
    for (const k of trackedNamed) log(`     · ${k} — ${describe(known[k])}`)
  }
  const cleared = notNamedInBundle.filter((k) => !residual.some(([r]) => r === k))
  if (cleared.length > 0) {
    log(`\n· ${cleared.length} tracked variable(s) are not present as a named key in THIS build:`)
    for (const k of cleared) log(`     · ${k}`)
    log(`   Note: absent-by-name only. If a variable is unset at build time it was never`)
    log(`   baked at all, so this is not evidence that anything was removed.`)
  }
  return 0
}

function describe(entry) {
  return typeof entry === 'string' ? entry : entry?.reason ?? ''
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(
    run({
      distAssets: path.join(ROOT, 'dist/assets'),
      srcDir: path.join(ROOT, 'src'),
      flagEnvPath: path.join(ROOT, 'src/lib/flagEnv.ts'),
      allowlistPath: ALLOWLIST_PATH,
    }),
  )
}
