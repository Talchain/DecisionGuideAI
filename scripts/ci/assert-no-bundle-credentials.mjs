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
//   · `tests/ci-guards/no-bundle-credentials.spec.ts` carries the POSITIVE CONTROL
//     (a synthetic credential-shaped literal beside `Bearer` MUST be caught) and
//     the CONTRAST CONTROL (clean chunks, a public anon JWT, an `Authorization`
//     header name with no credential near it MUST all pass). Without the contrast
//     control a sentinel that matches everything looks identical to a strict one.
//
// POSTURE: BLOCKING, beside `ci:guard:bundle-env` in `.github/workflows/ci.yml`.
// Gates the MERGE, not the Netlify deploy — a false red here must not be able to
// break staging for every lane.
// =============================================================================

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '../..')

/** Files in dist/ worth scanning. Sourcemaps included: a credential in a published map is published. */
const SCANNABLE = /\.(js|mjs|cjs|html|json|css|map)$/i

/** How far from an auth token a literal may sit and still count as "in an auth context". */
export const AUTH_WINDOW = 256

/** Markers that make a nearby high-entropy literal suspicious. */
const AUTH_CONTEXT = /(?:Bearer|Authorization|x-api-key|api[_-]?key|apiKey|secret|token|credential)/gi

/** A string literal in emitted JS: double, single or backtick quoted. */
const STRING_LITERAL = /"((?:[^"\\\n]|\\.){24,})"|'((?:[^'\\\n]|\\.){24,})'|`((?:[^`\\\n]|\\.){24,})`/g

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

/** The object key a literal is assigned to, if any: `foo:"<literal>"` → `foo`. */
export function precedingKey(text, index) {
  const before = text.slice(Math.max(0, index - 80), index)
  const m = before.match(/(?:([A-Za-z_$][\w$]*)|["']([\w.-]+)["'])\s*:\s*$/)
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
      const value = m[1] ?? m[2] ?? m[3]
      if (!value || !isCredentialShaped(value)) continue
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

export function run({ distDir, log = console.log, err = console.error }) {
  if (!existsSync(distDir)) {
    err(`\n❌ ${distDir} not found — run a build first (pnpm run build).\n`)
    return 1
  }

  let result
  try {
    const files = collectFiles(distDir)
    const chunks = files.map((f) => ({
      file: path.relative(distDir, f),
      text: readFileSync(f, 'utf8'),
    }))
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

  log(`✅ No credential-shaped literals in the emitted bundle`)
  log(`   scanned: ${new Set(findings.map((f) => f.file)).size || 0} file(s) with findings · ${bytes.toLocaleString()} bytes`)
  if (allowed.length > 0) {
    log(`\n· ${allowed.length} match(es) allowed as PUBLIC BY DESIGN (derived from the value itself):`)
    for (const a of allowed) log(`     · ${a.file}: ${redact(a.value)} — ${a.reason}`)
  }
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(run({ distDir: path.join(ROOT, 'dist') }))
}
