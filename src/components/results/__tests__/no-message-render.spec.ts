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
 * Matches JSX expressions like: {item.message}, {critique.message},
 * {u.message}, etc. inside curly braces.
 *
 * Does NOT match:
 * - .test(item.message) — filter context, not render
 * - console.warn(..., item.message) — debug context
 * - .messages, .messageId — different properties
 */
const JSX_MESSAGE_RENDER = /\{[^}]*\b(?:item|critique|uncertainty|warning|u|c)\.message\b[^}]*\}/g

/**
 * Allowlist: patterns that are safe despite containing .message in JSX-like context.
 * - assumption.message: AssumptionItem type, sanitized upstream
 * - error.message: Error objects
 * - .test(: filter/guard context
 * - console.: debug context
 * - match(: regex extraction, not rendering
 * - safeMessageFallback(: guard function that strips internal tokens before render
 */
const SAFE_PATTERNS = [
  /assumption\.message/,
  /error\.message/,
  /\.test\(/,
  /console\./,
  /\.match\(/,
  /safeMessageFallback\(/,
]

describe('V14.3: No .message renders in results components', () => {
  const sourceFiles = getSourceFiles(RESULTS_DIR)

  for (const filePath of sourceFiles) {
    const fileName = relative(RESULTS_DIR, filePath)

    it(`${fileName} does not render critique .message in JSX`, () => {
      const content = readFileSync(filePath, 'utf-8')
      const matches = content.match(JSX_MESSAGE_RENDER) || []

      // Filter out known safe patterns
      const unsafe = matches.filter(match =>
        !SAFE_PATTERNS.some(safe => safe.test(match)),
      )

      if (unsafe.length > 0) {
        throw new Error(
          `Found .message rendered in JSX in ${fileName}:\n` +
          unsafe.map(m => `  ${m}`).join('\n') +
          '\n\nUse humanisedTitle/humanisedDescription/displayText instead of .message.',
        )
      }
    })
  }
})
