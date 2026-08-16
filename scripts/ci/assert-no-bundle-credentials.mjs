#!/usr/bin/env node
// scripts/ci/assert-no-bundle-credentials.mjs
// =============================================================================
// Fails the build if the EMITTED BUNDLE contains a credential-shaped LITERAL.
// =============================================================================
//
// WHY THIS EXISTS, AND WHY THE EXISTING GUARD COULD NOT DO IT
// -----------------------------------------------------------
// `assert-bundle-env-allowlist.mjs` detects `VITE_NAME:"value"` pairs — a NAME in
// KEY position. It says so itself, at length. That check is correct and stays.
// It is also STRUCTURALLY INCAPABLE of seeing the exposure that shipped:
//
//   Vite replaces `import.meta.env.VITE_X` with the LITERAL at build time. A
//   correctly-NARROWED read therefore emits the value as a BARE STRING with the
//   name compiled entirely away:
//
//       function c(){const c="<64-char secret>";return{Authorization:`Bearer ${c}`}}
//
//   Every name-based check — grep for `VITE_PLOT_BEARER`, the allow-list guard,
//   a source review — returns a confident ALL-CLEAR on that chunk. The name is
//   genuinely absent. The credential is genuinely present, and any visitor can
//   fetch the asset and read it.
//
// So a name-based scan produces a FALSE ALL-CLEAR by construction. This guard
// scans for VALUE SHAPE instead, in the bytes actually emitted.
//
// THE MIRROR THIS REPLACES
// ------------------------
// `bundle-env-allowlist.json` carried a `knownExposed.VITE_PLOT_BEARER` entry with
// `valueStillInlined: true`, and the allow-list guard PRINTED a 🚨 line about it on
// every run — then `return 0`. A loud log that exits zero is not a gate; it is a
// note that becomes furniture. Six weeks of green CI ran over a live credential in
// a public asset. This guard's contribution is not a better description of the
// problem — it is a NON-ZERO EXIT.
//
// DERIVED, NOT MIRRORED (CLAUDE.md trap 12)
// -----------------------------------------
// There is no list of "secrets to look for". The scan derives its verdict from the
// SHAPE of what was emitted plus its CONTEXT. Adding a new credential to the deploy
// cannot slip past a list nobody remembered to update, because there is no list.
//
// The one place judgement is required — values that are PUBLIC BY DESIGN — is
// handled by DERIVATION rather than by broadening the pattern until it stops
// firing (which is how a sentinel quietly becomes decorative):
//
//   · A JWT is DECODED and its `role` claim read. `role: "anon"` is a Supabase
//     anonymous key: public by design, protected by RLS, and reported as ALLOWED
//     with its reason. `role: "service_role"` is the opposite of public and FAILS
//     LOUD. An undecodable or unrecognised JWT FAILS — unknown is not safe.
//   · `sb_publishable_…` is public by design; `sb_secret_…` fails.
//
// Both discriminations read the artefact itself. Neither is a name someone must
// keep in sync with reality.
//
// ANTI-VACUITY (CLAUDE.md trap 13)
// --------------------------------
// An absence assertion is worthless until it has proved it can see a PRESENCE.
//   · `scanChunks` THROWS on zero chunks and on zero bytes — an empty scan can
//     never be reported as clean.
//   · `selfTest()` runs on EVERY invocation, before any verdict: a positive canary
//     MUST be caught and its credential-free twin MUST NOT be. This proves the
//     detector is alive HERE — this Node, this file, this run — not merely that it
//     bit in CI once. A detector that has silently stopped matching is otherwise
//     indistinguishable from a clean bundle.
//   · `tests/ci-guards/no-bundle-credentials.spec.ts` carries the same pairing at
//     spec level. Without the CONTRAST half, a sentinel that matches EVERYTHING
//     passes every positive control and looks identical to a strict one — until it
//     reds an innocent build and gets loosened into decoration.
//
// POSTURE: BLOCKING, in TWO places, deliberately.
//   · `.github/workflows/staging-full-tests.yml` — the `build` job of the "Staging
//     Gate". That is the ONLY check `staging` branch protection requires, so this is
//     where the blocking actually happens.
//   · `.github/workflows/ci.yml` — beside `ci:guard:bundle-env`, for parity with its
//     sibling.
// Neither is wired into `build:ci`, which is what Netlify runs: a false red must gate
// the MERGE, never break the staging DEPLOY for every lane.
// =============================================================================

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '../..')

/**
 * The ARTEFACT CLASS this guard covers. Name it, do not imply it.
 *
 * ⚠ AN ABSENCE CLAIM ABOUT `dist/*.js` IS NOT AN ABSENCE CLAIM ABOUT `dist/`.
 * A register row was minted on exactly that generalisation five days before this
 * guard was written: a crawler that searched the JS chunk graph reported "no commit
 * stamp in the deployed UI", and the stamp was sitting in `dist/version.json` the
 * whole time. So this scans the whole of `dist/` recursively, and the extensions
 * below are printed in the output on every run — a reader must never have to assume
 * what was covered.
 *
 * `.map` is included deliberately. A source map carries `sourcesContent`, i.e. the
 * ORIGINAL source; a credential removed from the minified chunk but still present in
 * a published map is still published. Files with no extension (`_redirects`,
 * `_headers`) are NOT scanned — they are Netlify build directives, and are reported
 * as skipped rather than silently ignored.
 */
const SCANNABLE = /\.(js|mjs|cjs|html|json|css|map)$/i
const SCANNED_CLASS = 'dist/**/*.{js,mjs,cjs,html,json,css,map}'

/** How far from an auth token a literal may sit and still count as "in an auth context". */
export const AUTH_WINDOW = 256

/** Markers that make a nearby high-entropy literal suspicious. */
const AUTH_CONTEXT = /(?:Bearer|Authorization|x-api-key|api[_-]?key|apiKey|secret|token|credential)/gi

/** A string literal in emitted JS: double, single or backtick quoted. */
const STRING_LITERAL = /"((?:[^"\\\n]|\\.){24,})"|'((?:[^'\\\n]|\\.){24,})'|`((?:[^`\\\n]|\\.){24,})`/g

/**
 * An auth scheme carrying its credential INSIDE the same literal:
 * `"Bearer <secret>"`, `"Basic <secret>"`, `"Token <secret>"`.
 *
 * MEASURED GAP. The defect that shipped put the secret in its OWN literal
 * (`const c="<secret>"`) with `Bearer ${c}` as a separate template, so the literal
 * WAS the credential. The far more ordinary shape — one string containing both the
 * scheme and the secret — was invisible: `isCredentialShaped` rejects it because of
 * the space and the word `Bearer`. Found by planting a secret in a source map and
 * watching the guard pass.
 *
 * Extracting the operand is deliberately narrow. The alternative considered and
 * rejected was scanning credential-shaped substrings anywhere inside any literal,
 * which reintroduces the minified-identifier false positives measured earlier.
 * Here the scheme keyword is what licenses the extraction, so there is no guessing.
 */
const AUTH_SCHEME_VALUE = /^\s*(?:Bearer|Basic|Token|ApiKey|Api-Key)\s+(\S+)\s*$/i

/**
 * Every candidate secret a literal yields: the literal itself, plus the operand of
 * an auth scheme it carries. Order matters only for reporting.
 */
function candidatesFrom(value) {
  const out = [value]
  const m = value.match(AUTH_SCHEME_VALUE)
  if (m) out.push(m[1])
  return out
}

/**
 * SOURCE MAPS NEED DECODING, NOT A BLUNTER REGEX. Both alternatives were MEASURED.
 *
 * A credential inside a map is nested in a JSON string with ESCAPED quotes:
 *
 *     "sourcesContent":["const h={Authorization:\"Bearer <secret>\"}"]
 *
 * so the literal scan captures the whole escaped line — spaces and braces included —
 * which fails `isCredentialShaped` and is dropped. Scanning `.map` files with the
 * literal regex alone is therefore a FALSE COVERAGE CLAIM: worse than not scanning
 * them, because it reads as assurance. Proven by planting a secret in a map: not
 * caught.
 *
 * The obvious fix — scan bare credential-alphabet TOKENS anywhere, ignoring quoting —
 * was tried and REJECTED on measurement: it caught the planted map secret and also
 * produced **15 false positives on a clean 89-chunk build**, matching minified
 * identifier runs near the words `token`, `Token`, `SECRET` and `Credential`. A guard
 * that reds a clean build is a guard that gets loosened until it stops working.
 *
 * So maps are DECODED and only `sourcesContent` — the original source text — is
 * scanned, with the ordinary literal rules. The other fields are deliberately
 * excluded, and `mappings` is the reason it matters: it is a single enormous
 * high-entropy base64-VLQ string that any entropy-based scan would flag for ever.
 * `sources` and `names` are identifiers, not values.
 */
export function expandSourceMap(file, text) {
  if (!/\.map$/i.test(file)) return []
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    // An unparseable .map is not evidence of safety. Scan it as raw text so a
    // malformed or hand-edited map cannot become a blind spot.
    return [{ file: `${file} (unparseable — scanned raw)`, text }]
  }
  const contents = Array.isArray(parsed?.sourcesContent) ? parsed.sourcesContent : []
  const sources = Array.isArray(parsed?.sources) ? parsed.sources : []
  return contents
    .map((src, i) => ({
      file: `${file} → sourcesContent[${i}]${sources[i] ? ` (${sources[i]})` : ''}`,
      text: typeof src === 'string' ? src : '',
    }))
    .filter((c) => c.text.length > 0)
}

/**
 * Context-free credential formats. These are self-identifying: no proximity needed,
 * because nothing legitimate emits them into a browser bundle.
 *
 * Each entry: { id, re, verdict } where verdict('match') returns null to ALLOW
 * (public by design, with a reason) or a string reason to FAIL.
 */
export const SIGNATURES = [
  {
    id: 'jwt',
    re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    verdict: (match) => classifyJwt(match),
  },
  {
    id: 'supabase-secret-key',
    re: /\bsb_secret_[A-Za-z0-9_-]{16,}/g,
    verdict: () => 'Supabase SECRET key (sb_secret_…) — server-side only, never the browser.',
  },
  {
    id: 'supabase-publishable-key',
    re: /\bsb_publishable_[A-Za-z0-9_-]{16,}/g,
    verdict: () => null, // public by design
  },
  {
    id: 'openai-key',
    re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
    verdict: () => 'OpenAI API key shape (sk-…).',
  },
  {
    id: 'github-token',
    re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{50,}/g,
    verdict: () => 'GitHub token shape.',
  },
  {
    id: 'aws-access-key-id',
    re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    verdict: () => 'AWS access key id shape.',
  },
  {
    id: 'slack-token',
    re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
    verdict: () => 'Slack token shape.',
  },
  {
    id: 'google-api-key',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    verdict: () => 'Google API key shape.',
  },
  {
    id: 'private-key-block',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    verdict: () => 'A private key block.',
  },
]

/** Shannon entropy in bits per character. */
export function shannonEntropy(s) {
  if (s.length === 0) return 0
  const freq = new Map()
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1)
  let h = 0
  for (const n of freq.values()) {
    const p = n / s.length
    h -= p * Math.log2(p)
  }
  return h
}

const HEX_32 = /^[A-Fa-f0-9]{32,}$/
const B64_32 = /^[A-Za-z0-9+/_=-]{32,}$/
const LETTERS_ONLY = /^[A-Za-z]+$/

/**
 * Words joined by `_` or `-`: `scientific_validation_available_count`.
 *
 * MEASURED FALSE POSITIVE, not a hypothetical. A telemetry key list in
 * `clipboard-*.js` sits directly beside a REDACTION pattern definition
 * (`/\bbearer\s+\S+/i`, `token|secret|password|authorization`) — so the auth-context
 * window is satisfied by code whose entire purpose is to STRIP credentials, and the
 * "credential" is an ordinary snake_case identifier in the base64 alphabet.
 *
 * Rejecting this shape costs no real detection: a 32+ character credential composed
 * exclusively of dictionary-shaped alphabetic segments, with no digit anywhere, does
 * not occur. Note this is a TIGHTENING of what counts as credential-shaped, not a
 * widening of what is excused.
 */
const WORD_SEGMENTS = /^[A-Za-z]+(?:[_-][A-Za-z]+)+$/

/**
 * Property names whose value is a CONTENT DIGEST, not a credential.
 *
 * A SHA-256 hex digest and a 64-character hex secret are BYTE-INDISTINGUISHABLE.
 * No amount of entropy or charset analysis can separate them, so shape cannot decide
 * this one and pretending otherwise would mean either permanent false positives or a
 * weakened threshold that stops catching the real thing.
 *
 * The discriminator is therefore the emitted KEY NAME — `captureSha256:"…"` — which
 * is in the artefact itself and needs no list kept in sync with reality. Reported as
 * ALLOWED WITH ITS REASON rather than silently dropped, so the exemption stays
 * visible on every run.
 */
const DIGEST_KEY = /(?:sha\d*|md5|digest|hash|checksum|integrity|etag|fingerprint)$/i

/**
 * The object key a value is assigned to, if any: `foo:"<value>"` → `foo`.
 *
 * `index` may point at the opening quote OR at the first character of the value
 * itself (the token scan yields the latter), and the quote may be JSON-escaped
 * inside a source map — so an optional `\"`, `"`, `'` or backtick is stripped first.
 * Without that, every digest inside a `.map` would lose its exemption and red.
 */
export function precedingKey(text, index) {
  const before = text.slice(Math.max(0, index - 80), index).replace(/(?:\\?["'`])\s*$/, '')
  const m = before.match(/(?:([A-Za-z_$][\w$]*)|\\?["']([\w.-]+)\\?["'])\s*:\s*$/)
  return m ? (m[1] ?? m[2]) : null
}

/**
 * Is this literal credential-SHAPED?
 *
 * Deliberately NOT "is it long". A minified bundle is full of long strings — CSS,
 * SVG path data, copy, data: URIs. The discriminators:
 *   · a credential charset (hex, or base64/base64url) with NO spaces or punctuation
 *     outside that alphabet — this alone removes prose, MIME types, URLs, CSS;
 *   · length ≥ 32 — shorter than that and entropy is not a reliable signal;
 *   · entropy ≥ 3.2 bits/char — removes padding, repeated characters, `0000…`;
 *   · NOT letters-only — removes long camelCase identifiers, which sit in the
 *     base64 alphabet and would otherwise be the dominant false positive;
 *   · NOT word-segments — removes snake_case/kebab-case identifiers (measured).
 *
 * Every one of these was derived by running the scan against a REAL build and
 * examining each hit, not by reasoning about what a bundle might contain.
 */
export function isCredentialShaped(value) {
  if (value.length < 32) return false
  if (LETTERS_ONLY.test(value)) return false
  if (WORD_SEGMENTS.test(value)) return false
  if (!HEX_32.test(value) && !B64_32.test(value)) return false
  return shannonEntropy(value) >= 3.2
}

/** base64url → utf8, tolerant of missing padding. */
function decodeB64Url(segment) {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded + '='.repeat((4 - (padded.length % 4)) % 4), 'base64').toString('utf8')
}

/**
 * Decode a JWT and decide from its OWN CLAIMS whether it is public by design.
 *
 * This is the derived alternative to "add the anon key to an allow-list". A
 * Supabase anonymous key carries `role: "anon"` and is meant to reach the browser
 * (RLS is what protects the data, not hiding this string). The same shape carrying
 * `role: "service_role"` bypasses RLS entirely and is a critical exposure. One
 * decode tells the two apart; no list can, because they are the same shape.
 *
 * Returns null to ALLOW, or a reason string to FAIL.
 */
export function classifyJwt(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return 'Malformed JWT-shaped literal.'
  let payload
  try {
    payload = JSON.parse(decodeB64Url(parts[1]))
  } catch {
    return 'A JWT-shaped literal whose payload could not be decoded — unknown is not safe.'
  }
  const role = typeof payload?.role === 'string' ? payload.role : undefined
  if (role === 'anon') return null // public by design
  if (role === 'service_role') {
    return 'A Supabase SERVICE_ROLE JWT. This bypasses RLS entirely — critical exposure.'
  }
  if (role === undefined) {
    return `A JWT with no \`role\` claim (keys: ${Object.keys(payload ?? {}).sort().join(', ') || 'none'}). Not recognised as public by design.`
  }
  return `A JWT with role "${role}" — only role "anon" is public by design.`
}

export class VacuousScanError extends Error {}

/** Every scannable file under dir, recursively. */
export function collectFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) collectFiles(full, out)
    else if (SCANNABLE.test(name)) out.push(full)
  }
  return out
}

/** EVERY file under dir, scannable or not — so the output can report what it SKIPPED. */
export function collectAll(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) collectAll(full, out)
    else out.push(full)
  }
  return out
}

/**
 * Findings for one chunk. A finding is {kind, id, file, value, reason, near}.
 *
 * `value` is retained ONLY so the caller can fingerprint it. It is never printed:
 * `redact()` is the single exit point and it emits a sha256 prefix.
 */
export function scanChunk({ file, text }) {
  const findings = []

  // ── Context-free signatures ────────────────────────────────────────────────
  for (const sig of SIGNATURES) {
    sig.re.lastIndex = 0
    for (const m of text.matchAll(sig.re)) {
      const reason = sig.verdict(m[0])
      findings.push({
        kind: reason === null ? 'allowed' : 'violation',
        id: sig.id,
        file,
        value: m[0],
        reason: reason ?? publicReason(sig.id),
        near: null,
      })
    }
  }

  // ── High-entropy literal in an AUTH CONTEXT ────────────────────────────────
  // The plotAuthHeaders shape: a bare literal whose only tell is what surrounds it.
  const authSpans = []
  AUTH_CONTEXT.lastIndex = 0
  for (const m of text.matchAll(AUTH_CONTEXT)) {
    authSpans.push([m.index - AUTH_WINDOW, m.index + m[0].length + AUTH_WINDOW, m[0]])
  }

  if (authSpans.length > 0) {
    STRING_LITERAL.lastIndex = 0
    for (const m of text.matchAll(STRING_LITERAL)) {
      const literal = m[1] ?? m[2] ?? m[3]
      if (!literal) continue
      // The literal itself, or the operand of an auth scheme it carries.
      const value = candidatesFrom(literal).find((c) => isCredentialShaped(c))
      if (!value) continue
      const at = m.index
      const span = authSpans.find(([lo, hi]) => at >= lo && at <= hi)
      if (!span) continue
      // A JWT here was already judged on its claims by the signature pass; do not
      // double-report it (and never override an `anon` ALLOW with a shape guess).
      if (/^eyJ[A-Za-z0-9_-]{8,}\./.test(value)) continue

      // A CONTENT DIGEST is byte-identical to a hex secret. Only the key name can
      // separate them — reported as allowed, with its reason, never dropped silently.
      const key = precedingKey(text, at)
      if (key && DIGEST_KEY.test(key)) {
        findings.push({
          kind: 'allowed',
          id: 'content-digest',
          file,
          value,
          reason: `Assigned to \`${key}\` — a content digest, not a credential. Shape alone cannot distinguish the two; the key name is the discriminator.`,
          near: span[2],
        })
        continue
      }

      findings.push({
        kind: 'violation',
        id: AUTH_CONTEXT_ID,
        file,
        value,
        reason:
          `A ${value.length}-character high-entropy literal (entropy ` +
          `${shannonEntropy(value).toFixed(2)} bits/char) sits within ${AUTH_WINDOW} ` +
          `characters of \`${span[2]}\`. This is the shape a build-time-inlined ` +
          `credential takes once its variable name has been compiled away.`,
        near: span[2],
      })
    }
  }

  return dedupe(findings)
}

/** The generic proximity rule's id — the least specific classifier we have. */
const AUTH_CONTEXT_ID = 'high-entropy-literal-in-auth-context'

/**
 * One value, one finding.
 *
 * A value can be matched twice: once by a named SIGNATURE and again by the generic
 * proximity rule. `sb_secret_…` does it to itself — the literal contains the word
 * "secret", which supplies its own auth context — so it reported as two violations
 * of the same secret. Not a correctness problem (it still fails) but it inflates the
 * count, and a guard that miscounts is a guard whose output nobody trusts.
 *
 * A named signature always wins: it knows WHAT the value is, including whether it is
 * public by design, whereas the proximity rule only knows the value looks random and
 * sits near an auth word. Dropping the specific verdict in favour of the vague one
 * would let a signature's ALLOW be overridden by a shape guess.
 */
function dedupe(findings) {
  const bySignature = new Set(
    findings.filter((f) => f.id !== AUTH_CONTEXT_ID).map((f) => `${f.file} ${f.value}`),
  )
  const seen = new Set()
  const out = []
  for (const f of findings) {
    const key = `${f.file} ${f.value}`
    if (f.id === AUTH_CONTEXT_ID && bySignature.has(key)) continue
    const dedupeKey = `${f.id} ${key}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    out.push(f)
  }
  return out
}

/**
 * Scan every chunk. THROWS rather than returning empty — an empty scan must never
 * be reportable as clean (trap 13).
 */
export function scanChunks(chunks) {
  if (chunks.length === 0) {
    throw new VacuousScanError('Scanned ZERO files — refusing to report clean from an empty scan.')
  }
  const bytes = chunks.reduce((n, c) => n + c.text.length, 0)
  if (bytes === 0) {
    throw new VacuousScanError(
      `Scanned ${chunks.length} file(s) totalling ZERO bytes — the read is broken, not the bundle clean.`,
    )
  }
  const findings = []
  for (const chunk of chunks) findings.push(...scanChunk(chunk))
  return {
    findings,
    violations: findings.filter((f) => f.kind === 'violation'),
    allowed: findings.filter((f) => f.kind === 'allowed'),
    bytes,
  }
}

function publicReason(id) {
  if (id === 'jwt') return 'Supabase anonymous key (role "anon") — public by design; RLS protects the data.'
  if (id === 'supabase-publishable-key') return 'Supabase publishable key — public by design.'
  return 'Public by design.'
}

/**
 * The ONLY way a matched value leaves this module. A guard that prints the
 * credential it found has published it a second time, into CI logs.
 */
export function redact(value) {
  const digest = createHash('sha256').update(value).digest('hex').slice(0, 8)
  return `<${value.length} chars, sha256:${digest}>`
}

/**
 * A synthetic credential in exactly the shape that shipped. NOT a real value.
 * Used only by the runtime self-test below; never written anywhere.
 */
const CANARY_POSITIVE =
  'function a(){const a="f1e9c40b7a6d2358e0c94b17fa5d8e26c3079b1f4a8e5d2c6b093f17e5a2d840";' +
  'return{Authorization:`Bearer ${a}`}}'

/** The same chunk with the secret removed — an auth header name and nothing to find. */
const CANARY_CONTRAST = 'function a(t){return{Authorization:`Bearer ${t}`,"Content-Type":"application/json"}}'

/**
 * PROVE THE DETECTOR IS ALIVE ON THIS RUN, before believing a clean result.
 *
 * The spec proves the detector bites in CI. This proves it bites HERE — against this
 * Node version, this file on disk, right now. An absence assertion is worthless until
 * it has demonstrated it can see a presence (trap 13), and a guard whose detector has
 * silently stopped matching is indistinguishable from a clean bundle.
 *
 * BOTH halves are required and they are not redundant:
 *   · POSITIVE — the canary MUST be caught. A detector matching nothing would
 *     otherwise report every bundle clean, for ever.
 *   · CONTRAST — its credential-free twin MUST NOT be caught. A detector matching
 *     everything would pass the positive control while being useless, and would be
 *     "fixed" by loosening it until it stopped firing.
 * One without the other proves nothing about the property that matters.
 */
function selfTest(err) {
  const pos = scanChunk({ file: '<self-test:positive>', text: CANARY_POSITIVE })
  const neg = scanChunk({ file: '<self-test:contrast>', text: CANARY_CONTRAST })
  const posViolations = pos.filter((f) => f.kind === 'violation').length
  const negViolations = neg.filter((f) => f.kind === 'violation').length
  if (posViolations !== 1 || negViolations !== 0) {
    err(
      `\n❌ SELF-TEST FAILED — this guard is not reporting on the bundle, it is reporting on itself.\n\n` +
        `     positive canary: expected 1 violation, got ${posViolations}\n` +
        `     contrast canary: expected 0 violations, got ${negViolations}\n\n` +
        `   ${posViolations === 0 ? 'The detector matched NOTHING: a clean result here would be vacuous.\n   ' : ''}` +
        `${negViolations > 0 ? 'The detector matched a credential-FREE chunk: it would red every build.\n   ' : ''}` +
        `Do not "fix" this by loosening the pattern. Fix the detector.\n`,
    )
    return false
  }
  return true
}

export function run({ distDir, log = console.log, err = console.error }) {
  if (!selfTest(err)) return 1

  if (!existsSync(distDir)) {
    err(`\n❌ ${distDir} not found — run a build first (pnpm run build).\n`)
    return 1
  }

  let result
  let chunks = []
  try {
    const files = collectFiles(distDir)
    for (const f of files) {
      const rel = path.relative(distDir, f)
      const text = readFileSync(f, 'utf8')
      chunks.push({ file: rel, text })
      // A published source map embeds the ORIGINAL source; a credential removed
      // from the minified chunk but still present in its map is still published.
      chunks.push(...expandSourceMap(rel, text))
    }
    result = scanChunks(chunks)
  } catch (e) {
    err(`\n❌ ${e.message}\n`)
    return 1
  }

  const { violations, allowed, bytes, findings } = result

  if (violations.length > 0) {
    err(`\n❌ ${violations.length} CREDENTIAL-SHAPED LITERAL(S) IN THE EMITTED BUNDLE:\n`)
    for (const v of violations) {
      err(`     · ${v.file}`)
      err(`       ${redact(v.value)}  [${v.id}]`)
      err(`       ${v.reason}`)
      err('')
    }
    err(
      `   Anything in dist/ is served to every visitor. A value here is PUBLISHED,\n` +
        `   whether or not its variable name survives minification.\n\n` +
        `   ⚠ THE NAME IS NOT THE EXPOSURE. Vite inlines \`import.meta.env.VITE_X\` as a\n` +
        `   bare literal, so grepping the bundle for the variable name finds nothing\n` +
        `   whether or not the secret is baked in. Do not "verify" this by grepping.\n\n` +
        `   Fix: remove the browser-side READ. Move the credential server-side behind\n` +
        `   an edge function that injects it (netlify/edge-functions/isl-proxy.ts and\n` +
        `   netlify/edge-functions/plot-proxy.ts are the working patterns), and have the\n` +
        `   browser call the same-origin /bff/* path with no credential of its own.\n\n` +
        `   If a match is genuinely public by design, do NOT loosen the pattern —\n` +
        `   make it self-identifying (see classifyJwt: a Supabase anon key is allowed\n` +
        `   because its own \`role\` claim says so, not because it is on a list).\n`,
    )
    return 1
  }

  // NAME WHAT WAS COVERED. A reader must never have to infer the artefact class from
  // a green tick — "no credentials in dist/*.js" and "no credentials in dist/" are
  // different claims, and conflating them is how a wrong absence claim gets recorded.
  const byExt = new Map()
  for (const c of chunks) {
    const ext = path.extname(c.file).toLowerCase() || '(no extension)'
    byExt.set(ext, (byExt.get(ext) ?? 0) + 1)
  }
  const skipped = collectAll(distDir).length - chunks.length

  log(`✅ No credential-shaped literals in the emitted bundle`)
  log(`   self-test: detector caught the positive canary and cleared its contrast twin`)
  log(`   covered:   ${SCANNED_CLASS}`)
  log(
    `   scanned:   ${chunks.length} file(s) · ${bytes.toLocaleString()} bytes · ` +
      [...byExt.entries()].sort().map(([e, n]) => `${e}×${n}`).join(' '),
  )
  if (skipped > 0) {
    log(`   NOT scanned: ${skipped} file(s) outside that class (e.g. _redirects, _headers, images).`)
  }
  if (allowed.length > 0) {
    log(`\n· ${allowed.length} match(es) allowed as PUBLIC BY DESIGN (derived from the value itself):`)
    for (const a of allowed) log(`     · ${a.file}: ${redact(a.value)} — ${a.reason}`)
  }
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(run({ distDir: path.join(ROOT, 'dist') }))
}
