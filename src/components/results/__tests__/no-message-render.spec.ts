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
 * KNOWN-BROKEN — pre-existing failure awaiting fix.
 *
 * As of 2026-04-08, 1 test in this file fails:
 *   "components/results/ChallengeSection.tsx does not render critique .message in JSX"
 *
 * Status: not tracked in an issue. Failure is present on baseline,
 * confirmed independent of the v2 pre-analysis panel regroup work.
 *
 * Action needed: ChallengeSection.tsx contains a .message render the static
 * scan flags. Either update the component to render humanised text or add
 * the call site to the allowlist if it has been verified safe.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const RESULTS_DIR = join(__dirname, '..')

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
      files.push(full)
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
      const matches = content.match(JSX_MESSAGE_RENDER) || []

      // Filter out known safe patterns
      const unsafe = matches.filter(match =>
        !SAFE_PATTERNS.some(safe => safe.test(match)),
      )

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
