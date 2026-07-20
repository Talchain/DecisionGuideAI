/**
 * V14.3: Static prevention — no .message reads in render paths.
 *
 * Raw PLoT critique messages contain internal field names (constraint_fac_,
 * observed_state, intercept=0). Components must ONLY render humanised text
 * (displayText, humanisedTitle, humanisedDescription) or hardcoded fallback
 * strings — never .message directly in JSX.
 *
 * This test scans all .tsx files under src/components/results/ for JSX
 * expressions that render .message on critique/uncertainty objects. It acts
 * as a structural tripwire to prevent the same class of regression.
 *
 * ALLOWED .message access:
 * - assumption.message (AssumptionItem — different type, sanitized upstream)
 * - error.message (Error objects, not critique data)
 * - Non-JSX contexts: console.warn, INTERNAL_PATTERN.test, data-layer mapping
 *
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

const RESULTS_DIR = join(__dirname, '..')

/**
 * Files to skip at scan time — distinct from DEFENCE_IN_DEPTH_FILES.
 *
 * DEFENCE_IN_DEPTH_FILES: renders .message with a live runtime filter; the
 *   scanner matches the render AND asserts the filter is still present.
 *
 * SKIPPED_FILES: the scanner ignores them entirely. Reserved for files that
 *   have no production render path (archived components kept as test
 *   fixtures). Adding a file here is a trust-on-history claim — the file
 *   must remain un-mounted; if a component is revived, remove it from this
 *   list immediately and either sanitise its .message usage or add it to
 *   DEFENCE_IN_DEPTH_FILES with a proper runtime guard.
 *
 * Paths are RELATIVE to RESULTS_DIR so a basename collision elsewhere in
 * src/components/results/ cannot silently inherit this exemption.
 */
const SKIPPED_FILES = new Set<string>([
  // ConfidenceSection.tsx — archived 2026-04-17 (commit c88d5967). No
  // production render path; exists solely as a legacy integration fixture
  // for specs that pre-date the DecisionConfidencePanel rewrite. A late
  // .message render was introduced the same day (commit 3702e773) but is
  // never mounted. Scanner should not treat archived test fixtures as
  // runtime risk. Remove this entry if the component is re-introduced.
  'ConfidenceSection.tsx',
])

/** Recursively collect .tsx source files (excluding __tests__, Debug, Advanced) */
function getSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('__tests__') || entry === 'Debug' || entry === 'Advanced' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...getSourceFiles(full))
    } else if (/\.tsx$/.test(entry)) {
      // Skip by relative-to-RESULTS_DIR path so a basename collision in a
      // different subdirectory does not silently inherit the exemption.
      const rel = relative(RESULTS_DIR, full)
      if (!SKIPPED_FILES.has(rel)) {
        files.push(full)
      }
    }
  }
  return files
}

/**
 * Pattern to detect .message rendered in JSX.
 *
 * V14.3b: Broadened from a narrow variable-name list to catch ANY
 * `<identifier>.message` inside JSX interpolation braces. This prevents
 * regressions from variable renames (e.g. `w.message`, `firstWarning.message`).
 *
 * Matches: {x.message}, {firstWarning.message}, {item.message}, etc.
 *
 * Does NOT match:
 * - .test(item.message) — filter context, not render (caught by SAFE_PATTERNS)
 * - console.warn(..., item.message) — debug context (caught by SAFE_PATTERNS)
 * - .messages, .messageId — different properties (\b ensures word boundary)
 */
const JSX_MESSAGE_RENDER = /\{[^}]*\b\w+\.message\b[^}]*\}/g

/**
 * Allowlist: patterns that are safe despite containing .message in JSX-like context.
 * - assumption.message: AssumptionItem type, sanitized upstream
 * - error.message: Error objects
 * - .test(: filter/guard context
 * - console.: debug context
 * - match(: regex extraction, not rendering
 */
const SAFE_PATTERNS = [
  /assumption\.message/,
  /error\.message/,
  /\.test\(/,
  /console\./,
  /\.match\(/,
]

/**
 * Unsafe `.message` renders in `content`, comments stripped first so a
 * commented-out `{item.message}` or a JSX block comment mentioning `.message`
 * can no longer false-red (the #386/#403 footgun). String and TEMPLATE literals are
 * KEPT as code — a real `{`${w.message}`}` interpolation still trips, so this
 * uses stripComments, not the string-blanking blankNonCode. filePath only
 * steers .css vs .js dispatch (scanned files are .tsx).
 */
function findMessageRenders(content: string, filePath: string): string[] {
  const matches = stripComments(content, filePath).match(JSX_MESSAGE_RENDER) || []
  return matches.filter((match) => !SAFE_PATTERNS.some((safe) => safe.test(match)))
}

/**
 * V14.3b: Files that render .message BUT have runtime defence-in-depth filtering.
 * Map of basename → regex that MUST be present in the file source for the exemption
 * to hold. If someone removes the runtime filter, this test starts failing — keeping
 * the structural guard tight without pattern-allowlisting specific variable names.
 *
 * WarningBanner.tsx: renders w.message / firstWarning.message, but only from
 * `safeWarnings` which filters via INTERNAL_PATTERN. Behavioural coverage in
 * WarningBanner.spec.tsx (lines 195-267) verifies internal tokens are stripped.
 */
const DEFENCE_IN_DEPTH_FILES: Record<string, RegExp> = {
  'WarningBanner.tsx': /INTERNAL_PATTERN\.test\(/,
  // ChallengeSection.tsx: InferenceWarningCard renders warning.message with a
  // hardcoded fallback (Inference warning: ${code}). The message comes from ISL
  // inference warnings, not PLoT critique data — structurally different type.
  // Guard: the fallback pattern must be present.
  'ChallengeSection.tsx': /Inference warning.*warning\.code/,
  // AdvancedSection.tsx: exemption REMOVED (P0-3 fold, external review
  // 2026-07-14). It previously rendered raw `w.message` for ISL inference
  // warnings behind a non-empty-string filter — but that filter does NOT
  // sanitise internal identifiers (e.g. `constraint_fac_… observed_state.value
  // intercept=0`), so the "ISL warnings are structurally safe" rationale was
  // false. It now humanises by `code` via the shared view model
  // (selectHumanisedInferenceWarnings) and holds zero `.message` access, so the
  // scanner enforces the invariant with no exemption.
  // InferenceWarningStrip.tsx: the JSX itself renders ONLY humaniseCritique's
  // sanitised `.title` (never `.message`) — fixed here after the PR #236
  // regression that rendered `w.message` verbatim. The two remaining matches
  // the naive brace scanner still flags are non-render code: the
  // severity+non-empty-message VISIBILITY FILTER (selectWarningSeverityEntries)
  // and the small object literal that hands `message` to humaniseCritique as
  // an *input* — humaniseCritique never echoes raw `.message` back out except
  // through its own internal-token guard. Presence of the filter's literal
  // predicate is the attestation that the filter (not a raw render) is what
  // the scanner is tripping on.
  'InferenceWarningStrip.tsx': /typeof w\.message === 'string' && w\.message\.trim\(\)\.length > 0/,
}

/** V14.3b: Additional files that render warning/critique-like data */
const EXTRA_FILES = [
  join(__dirname, '..', '..', '..', 'canvas', 'components', 'WarningBanner.tsx'),
]

describe('V14.3: No .message renders in results components', () => {
  const sourceFiles = [...getSourceFiles(RESULTS_DIR), ...EXTRA_FILES.filter(f => {
    try { statSync(f); return true } catch { return false }
  })]

  for (const filePath of sourceFiles) {
    const fileName = relative(join(RESULTS_DIR, '..', '..'), filePath)

    it(`${fileName} does not render critique .message in JSX`, () => {
      const content = readFileSync(filePath, 'utf-8')
      // Scan with comments stripped; attestations below still read RAW content
      // (a defence-in-depth filter's literal predicate can legitimately live in
      // a string, which stripComments keeps — but raw is unambiguous).
      const unsafe = findMessageRenders(content, filePath)

      if (unsafe.length > 0) {
        // V14.3b: Files with runtime defence-in-depth get a conditional pass —
        // but ONLY if the runtime filter is still present in the source.
        // If someone removes the filter, this test starts failing.
        const baseName = filePath.split('/').pop() ?? ''
        const guard = DEFENCE_IN_DEPTH_FILES[baseName]
        if (guard) {
          if (!guard.test(content)) {
            throw new Error(
              `${fileName} renders .message in JSX and its runtime filter ` +
              `(${guard}) is missing. Either restore the filter or stop ` +
              `rendering .message directly.`,
            )
          }
          return // runtime filter present — safe
        }

        throw new Error(
          `Found .message rendered in JSX in ${fileName}:\n` +
          unsafe.map(m => `  ${m}`).join('\n') +
          '\n\nUse humanisedTitle/humanisedDescription/displayText instead of .message.',
        )
      }
    })
  }
})

/**
 * Both-directions mutation proof for the comment-strip (#386/#403 remediation).
 * Real renders still trip; comment-borne mentions no longer do. Mutation-checked
 * (2026-07-20): removing the strip turns the commented-out cases RED while every
 * "STILL catches" case stays green.
 */
describe('V14.3 — detector contract (RED power preserved)', () => {
  it('STILL catches a live {item.message} render', () => {
    expect(findMessageRenders('<span>{item.message}</span>', 'x.tsx').length).toBeGreaterThan(0)
  })

  it('STILL catches a renamed variable {firstWarning.message}', () => {
    expect(findMessageRenders('<p>{firstWarning.message}</p>', 'x.tsx').length).toBeGreaterThan(0)
  })

  it('STILL catches a template-literal render {`${w.message}`} (blankNonCode would miss this)', () => {
    // Keeping template literals as code is why this guard uses stripComments.
    expect(findMessageRenders('<p>{`prefix ${w.message}`}</p>', 'x.tsx').length).toBeGreaterThan(0)
  })

  it('does NOT flag the SAFE patterns (error.message / .test / console)', () => {
    expect(findMessageRenders('<p>{error.message}</p>', 'x.tsx')).toEqual([])
    expect(findMessageRenders('{INTERNAL.test(w.message)}', 'x.tsx')).toEqual([])
  })

  it('does NOT trip on a `//`-commented render', () => {
    expect(findMessageRenders('// <span>{item.message}</span>', 'x.tsx')).toEqual([])
  })

  it('does NOT trip on a render inside a JSX {/* … */} comment', () => {
    expect(findMessageRenders('<div>{/* was {item.message} */}</div>', 'x.tsx')).toEqual([])
  })

  it('does NOT trip on a render inside a /* block comment */', () => {
    expect(findMessageRenders('/* <span>{w.message}</span> */', 'x.tsx')).toEqual([])
  })
})
