// scripts/build-id.mjs
// =============================================================================
// The ONE authority for the `%BUILD_ID%` placeholder in index.html, and the
// Vite plugin that substitutes it.
// =============================================================================
//
// WHAT SHIPPED, AND WHY NOTHING SUBSTITUTED IT
// --------------------------------------------
// `index.html` has carried
//
//     <meta name="x-build-id" content="%BUILD_ID%" />
//
// since b3af4611. It was never substituted. Measured on the deployed staging
// build 8f779ce3 (2026-08-31): the served `index.html` contains the literal
// `content="%BUILD_ID%"`, and the safe screen rendered that literal to users.
//
// The mechanism, derived at vite@5.4.2's own bytes
// (`dist/node/chunks/dep-BzOvws4Y.js`, `htmlEnvHook`):
//
//     const pattern = /%(\S+?)%/g
//     const envPrefix = resolveEnvPrefix({ envPrefix: config.envPrefix })   // ['VITE_']
//     const env = { ...config.env }                                          // VITE_* only
//     for (const key in config.define) {
//       if (key.startsWith('import.meta.env.')) { ...fold into env... }      // (a)
//     }
//     return (html) => html.replace(pattern, (text, key) => {
//       if (key in env) return env[key]
//       if (envPrefix.some(p => key.startsWith(p))) config.logger.warn(...)  // (b)
//       return text                                                          // (c)
//     })
//
// Three facts follow, and together they are the whole defect:
//
//   1. `config.env` is `import.meta.env` — i.e. only keys matching `envPrefix`,
//      which this repo leaves at Vite's default `VITE_`. `BUILD_ID` has no
//      prefix, so `'BUILD_ID' in env` is false.
//   2. The `__BUILD_ID__` entry at vite.config.ts's `define` does NOT help.
//      Branch (a) folds in only define keys that start with `import.meta.env.`;
//      `__BUILD_ID__` is a bare JS define and the HTML hook never sees it. The
//      repo therefore had a build id for JS and a placeholder for HTML, with
//      nothing bridging them.
//   3. Branch (b) is why it was silent for months. Vite warns about an
//      unresolved `%X%` ONLY when `X` starts with an env prefix. `%BUILD_ID%`
//      does not, so Vite took branch (c) and returned the text unchanged —
//      no warning, no error, every build, for the life of the placeholder.
//
// A `%VITE_BUILD_ID%` rename would have been resolvable, but would still have
// gone dark silently whenever the variable was unset (branch (b) warns; it does
// not fail). This plugin substitutes explicitly instead, so the value is a
// deliberate derivation rather than a side effect of env-prefix matching, and
// `scripts/ci/assert-build-id-stamped.mjs` fails the build if a placeholder
// ever survives into `dist/`.
//
// WHY THE COMMIT SHA, AND WHY THE FULL 40 CHARACTERS
// --------------------------------------------------
// The requirement is that the value differ between two builds of different
// commits. The commit SHA is the only candidate here that is *also* directly
// comparable to something already published: `dist/version.json` carries
// `{"commit": "<40 hex>"}`, spliced by the same `git rev-parse HEAD` in
// netlify.toml's build command. Emitting the identical string makes
//
//     document.querySelector('meta[name="x-build-id"]').content === version.commit
//
// a one-line answer to "is this tab running the build the server publishes?".
// That question is why this placeholder is worth fixing at all: `/version.json`
// is fetched over the NETWORK and therefore describes the SERVER, while the meta
// tag is read from the DOM of the document the tab actually loaded. Only the
// second is tab-bound.
//
// A shorter form (7 chars) would still differ between commits, but would not be
// string-equal to `version.json`, so every consumer would need a prefix compare.
//
// PRECEDENCE, AND WHY GIT IS THE FALLBACK RATHER THAN THE PRIMARY
// --------------------------------------------------------------
//   1. `COMMIT_REF`  — Netlify's own variable, the conventional answer there.
//   2. `GITHUB_SHA`  — GitHub Actions, so a CI build stamps the same way.
//   3. `git rev-parse HEAD` — PROVEN to work inside the Netlify build: the
//      deployed `version.json` at 8f779ce3 carries a real 40-char SHA produced
//      by exactly this command, and reports `"branch":"HEAD"`, i.e. a real
//      detached-HEAD git checkout. So this is not a hopeful fallback; it is the
//      mechanism already known to succeed in the environment that matters.
//   4. `unidentified` — the honest answer, never a placeholder and never a
//      fabricated stand-in.
//
// ⚠ ON (4). The reader this replaces did `?.content || new Date().toISOString()`,
// which manufactures a plausible-looking build stamp out of the clock at page
// load. That is worse than saying nothing: it answers "which build is this?"
// with a value that has no relationship to the build. Failure to know is not
// knowledge, so an underivable id is reported as `unidentified` and never
// invented.
//
// WHAT THIS MODULE DELIBERATELY DOES NOT DO
//   · It does not touch `__BUILD_ID__` (vite.config.ts), which still defaults to
//     `new Date().toISOString()` and is therefore not commit-identifying and not
//     reproducible. Out of this lane's scope; reported, not fixed.
//   · It does not rename the placeholder. `public/poc.html` carries the same
//     token and is stamped by the same value (see `closeBundle` below), so a
//     rename would be a two-surface change for no gain.

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/** The literal that appears in HTML sources and must never reach `dist/`. */
export const BUILD_ID_PLACEHOLDER = '%BUILD_ID%'

/**
 * The value stamped when no commit SHA is derivable. A real word, not a
 * placeholder and not a fabricated id — see the header.
 */
export const UNIDENTIFIED_BUILD_ID = 'unidentified'

/**
 * The shape a stamped build id must have. Kept deliberately loose at the low
 * end (7) so an abbreviated SHA from some future caller still validates, while
 * still excluding `%BUILD_ID%`, the empty string, and an ISO timestamp.
 */
export const BUILD_ID_PATTERN = /^[0-9a-f]{7,40}$/

function normaliseSha(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return BUILD_ID_PATTERN.test(trimmed) ? trimmed : null
}

function gitHeadSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

/**
 * Derive the build id. Injectable arguments so the unit test can drive every
 * branch — including the git-unavailable one — without a real repository.
 *
 * @param {Record<string, string | undefined>} env
 * @param {() => string | null} readGitHead
 * @returns {string} a 40-char lowercase SHA, or `UNIDENTIFIED_BUILD_ID`
 */
export function resolveBuildId(env = process.env, readGitHead = gitHeadSha) {
  return (
    normaliseSha(env.COMMIT_REF) ??
    normaliseSha(env.GITHUB_SHA) ??
    normaliseSha(readGitHead()) ??
    UNIDENTIFIED_BUILD_ID
  )
}

/**
 * Substitute every occurrence of the placeholder. A literal split/join rather
 * than a regex, so nothing in the token needs escaping and no partial match is
 * possible.
 */
export function stampBuildId(html, buildId) {
  return html.split(BUILD_ID_PLACEHOLDER).join(buildId)
}

function htmlFilesIn(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...htmlFilesIn(full))
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full)
  }
  return out
}

/**
 * The Vite plugin.
 *
 * `transformIndexHtml` covers the templated entry (`index.html`) in BOTH `vite
 * build` and `vite dev`, so the dev server and the deployed artefact agree.
 *
 * `closeBundle` then sweeps any remaining `.html` under `outDir`. That exists
 * for `public/poc.html`, which Vite copies VERBATIM — `prepareOutDir` copies the
 * public directory before Rollup starts (vite@5.4.2, `prepareOutDir` →
 * `copyDir(config.publicDir, outDir)`), and no HTML transform is ever applied to
 * it. Without this sweep the same placeholder would keep shipping on
 * `/poc.html`, and the build guard would have to carve out an exception for the
 * one file it could not cover — a guard whose scope was chosen to match what the
 * fix happened to reach. One derivation, one value, every published HTML file.
 *
 * @param {{ buildId?: string }} [options] — `buildId` is for tests only.
 */
export function buildIdPlugin(options = {}) {
  const buildId = options.buildId ?? resolveBuildId()
  let outDir = null

  return {
    name: 'olumi-build-id',
    enforce: 'pre',

    configResolved(config) {
      if (config.command === 'build') {
        outDir = path.resolve(config.root, config.build.outDir)
      }
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return stampBuildId(html, buildId)
      },
    },

    closeBundle() {
      if (!outDir) return
      for (const file of htmlFilesIn(outDir)) {
        const before = fs.readFileSync(file, 'utf8')
        if (!before.includes(BUILD_ID_PLACEHOLDER)) continue
        fs.writeFileSync(file, stampBuildId(before, buildId))
      }
    },
  }
}
