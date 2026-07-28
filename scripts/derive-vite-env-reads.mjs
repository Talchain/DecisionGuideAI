// scripts/derive-vite-env-reads.mjs
// =============================================================================
// Derives every `VITE_*` variable the SOURCE reads by name.
// =============================================================================
//
// WHY THIS EXISTS — the mechanism, measured at the bytes on 2026-07-28.
//
// Vite gives `import.meta.env.VITE_X` a specific `define` ONLY for variables that
// are SET at build time. For a variable that is READ by the code but NOT SET, no
// specific define matches, so the longest match esbuild can make is
// `import.meta.env` itself — and that replaces the expression with the ENTIRE env
// object, inlined into that chunk, with every variable's VALUE.
//
// That is the wholesale-inline defect, and this is the part that is easy to get
// wrong: it is NOT caused by the code being written carelessly. A single read of
// ONE unset variable poisons its whole chunk, and it happens with BOTH
// `import.meta.env.VITE_X` and `import.meta.env?.VITE_X`. Narrowing the source
// alone therefore CANNOT remove it — proven by measurement: after every
// value-position spread was narrowed, four chunks still carried the full env,
// each traced to exactly one read of an unset variable
// (`VITE_PLOT_PROXY_BASE`, `VITE_DEBUG_BUNDLE_V2`, `VITE_FEATURE_COMPARE_DEBUG`).
// `VITE_PLOT_PROXY_BASE` is unset on the REAL deploy too, so this was a genuine
// production exposure and not an artefact of a test env.
//
// The fix is to give every read variable an explicit define, so no read can ever
// fall back to the whole object. `vite.config.ts` defines the unset ones as
// literal `undefined` — which is EXACTLY what they evaluate to today, so this
// changes no behaviour (including under `??`, where `''` would NOT be equivalent).
//
// DERIVED, NOT MIRRORED (CLAUDE.md trap 12): the list comes from the source at
// build time. Adding a new `import.meta.env.VITE_NEW` read needs no list update.
// =============================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/** Matches `import.meta.env.VITE_X` and `import.meta.env?.VITE_X`. */
const READ = /import\.meta\s*\.\s*env\s*\??\s*\.\s*(VITE_[A-Z0-9_]+)/g

/**
 * Strip comments so a doc comment naming a variable cannot invent a "read".
 * Only ever removes text, so it can never fabricate one.
 */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(name)) out.push(full)
  }
  return out
}

/** Every VITE_* name read by literal reference anywhere under `srcDir`. */
export function deriveViteEnvReads(srcDir) {
  const found = new Set()
  for (const file of walk(srcDir)) {
    const text = stripComments(readFileSync(file, 'utf8'))
    for (const m of text.matchAll(READ)) found.add(m[1])
  }
  return [...found].sort()
}

/**
 * `define` entries pinning every READ-but-UNSET variable to literal `undefined`,
 * so Vite never substitutes the whole env object for the expression.
 */
export function buildNarrowEnvDefines(srcDir, env) {
  const defines = {}
  for (const key of deriveViteEnvReads(srcDir)) {
    if (env[key] === undefined) defines[`import.meta.env.${key}`] = 'undefined'
  }
  return defines
}
