#!/usr/bin/env node
// scripts/ci/assert-build-id-stamped.mjs
// =============================================================================
// Fails the build if any published HTML file still carries the `%BUILD_ID%`
// placeholder, or carries a build id that is not a build id.
// =============================================================================
//
// WHAT SHIPPED
// ------------
// The deployed staging build 8f779ce3 (measured 2026-08-31) served
//
//     <meta name="x-build-id" content="%BUILD_ID%" />
//
// and the safe screen rendered that literal string to any user who reached it.
// The placeholder had been unsubstituted since b3af4611. Mechanism, and why
// Vite never even warned, in the header of scripts/build-id.mjs.
//
// ⚠ WHY THIS GUARD SCANS BUILD OUTPUT AND NOT `index.html`.
// A vitest spec asserting `index.html` contains `%BUILD_ID%` would have been
// GREEN for the entire life of the defect — the template is *supposed* to carry
// the placeholder; the failure is that nothing replaced it. Equally, a spec
// asserting the plugin's transform works proves the transform works, not that
// the artefact Netlify publishes went through it. Only reading the emitted file
// distinguishes "a substituter exists" from "the published bytes are stamped".
// That distinction is the whole reason this file is a build step and not a test.
//
// WHAT THIS GUARD CAN SEE
//   · Every `.html` under the output directory, recursively — including
//     `public/` files Vite copies verbatim, which no HTML transform reaches.
//   · That the placeholder token appears nowhere in any of them.
//   · That each `meta[name="x-build-id"]` carries either a 7–40 char lowercase
//     hex SHA or the exact word `unidentified`.
//   · That under CI or Netlify the id is a real SHA, never `unidentified` — in
//     both environments a commit SHA is derivable (COMMIT_REF / GITHUB_SHA /
//     `git rev-parse HEAD`), so `unidentified` there means the derivation broke
//     and the honest fallback is masking it.
//
// WHAT THIS GUARD CANNOT SEE — state it, do not imply coverage
//   · Whether the SHA is the RIGHT commit. It checks shape and presence, not
//     provenance. A wrong-but-well-formed SHA passes here; comparing the meta
//     tag against `/version.json`'s `commit` on a live deploy is what settles
//     that, and it is a witness's job, not a build guard's.
//   · Anything about the DEPLOYED site. It reads `dist/` on this machine. A CDN
//     serving a stale `index.html` is invisible to it.
//   · Non-HTML surfaces. `__BUILD_ID__` (vite.config.ts) is a separate JS define
//     that still defaults to a wall-clock timestamp; this guard says nothing
//     about it.
//
// POSITIVE CONTROL. An absence assertion over files that do not exist passes by
// testing nothing — a `dist/` that failed to build, or an output directory typo,
// would otherwise read as a clean green. So the guard HARD-FAILS unless it found
// at least one HTML file AND at least one `x-build-id` meta tag inside them.
// Without that, "no placeholder found" is not evidence of absence; it is
// evidence the probe was pointed at nothing.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  BUILD_ID_PLACEHOLDER,
  BUILD_ID_PATTERN,
  UNIDENTIFIED_BUILD_ID,
} from '../build-id.mjs'

const META_RE = /<meta\s+name=["']x-build-id["']\s+content=["']([^"']*)["']/gi

function htmlFilesIn(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...htmlFilesIn(full))
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full)
  }
  return out
}

/**
 * @param {string} outDir
 * @param {{ requireSha?: boolean }} [options]
 * @returns {{ ok: boolean, errors: string[], checked: Array<{file: string, id: string}> }}
 */
export function assertBuildIdStamped(outDir, options = {}) {
  const requireSha = options.requireSha ?? false
  const errors = []
  const checked = []

  if (!fs.existsSync(outDir)) {
    return {
      ok: false,
      errors: [`output directory not found: ${outDir} — the build did not run, or ran elsewhere`],
      checked,
    }
  }

  const files = htmlFilesIn(outDir)
  if (files.length === 0) {
    return {
      ok: false,
      errors: [`no .html files under ${outDir} — nothing to check, so a pass here would be vacuous`],
      checked,
    }
  }

  let metaTagsSeen = 0

  for (const file of files) {
    const rel = path.relative(outDir, file)
    const html = fs.readFileSync(file, 'utf8')

    if (html.includes(BUILD_ID_PLACEHOLDER)) {
      errors.push(
        `${rel}: still contains the literal ${BUILD_ID_PLACEHOLDER} — it was never substituted, ` +
          `and this string is rendered to users on the safe screen`,
      )
    }

    for (const match of html.matchAll(META_RE)) {
      metaTagsSeen++
      const id = match[1]
      checked.push({ file: rel, id })

      if (id === UNIDENTIFIED_BUILD_ID) {
        if (requireSha) {
          errors.push(
            `${rel}: x-build-id is "${UNIDENTIFIED_BUILD_ID}", but this is a CI/Netlify build where a ` +
              `commit SHA is derivable (COMMIT_REF / GITHUB_SHA / git rev-parse HEAD). The honest ` +
              `fallback is masking a broken derivation.`,
          )
        }
        continue
      }

      if (!BUILD_ID_PATTERN.test(id)) {
        errors.push(
          `${rel}: x-build-id is ${JSON.stringify(id)}, which is neither a commit SHA nor ` +
            `"${UNIDENTIFIED_BUILD_ID}". A build id that is not a build id is worse than none — ` +
            `it reads as an answer.`,
        )
      }
    }
  }

  if (metaTagsSeen === 0) {
    errors.push(
      `positive control FAILED: scanned ${files.length} HTML file(s) under ${outDir} and found no ` +
        `meta[name="x-build-id"] at all. The absence assertions above therefore proved nothing. ` +
        `Either the tag was removed, or this guard is pointed at the wrong directory.`,
    )
  }

  return { ok: errors.length === 0, errors, checked }
}

function main() {
  const outDir = path.resolve(process.argv[2] ?? 'dist')
  // Netlify sets NETLIFY=true; GitHub Actions sets CI=true.
  const requireSha = Boolean(process.env.CI || process.env.NETLIFY)

  const { ok, errors, checked } = assertBuildIdStamped(outDir, { requireSha })

  for (const { file, id } of checked) {
    console.log(`[BUILD-ID] ${file} → ${id}`)
  }

  if (!ok) {
    console.error('\n[BUILD-ID] ❌ build id stamping FAILED:')
    for (const e of errors) console.error(`  · ${e}`)
    console.error(
      '\nThe stamp is applied by scripts/build-id.mjs, wired as a Vite plugin in vite.config.ts.',
    )
    process.exit(1)
  }

  console.log(
    `[BUILD-ID] ✅ ${checked.length} build-id meta tag(s) stamped, no placeholder in ${outDir}` +
      (requireSha ? ' (CI: a real commit SHA was required)' : ''),
  )
}

// Only run when invoked directly, so the unit test can import the assertion.
//
// `pathToFileURL` rather than a `file://` + argv[1] concatenation: the naive
// form differs from `import.meta.url` for any path needing percent-encoding (a
// space, a non-ASCII character), and it fails SILENTLY — main() simply never
// runs, the build step exits 0, and a guard that never executed is
// indistinguishable from a guard that found nothing. That is the exact failure
// class this file exists to close, so it must not be reintroduced by its own
// entry point.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
