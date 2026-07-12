/**
 * Typography enforcement for aiPanelV2 surfaces.
 *
 * Per the brief's Step 8 and addendum F, every new aiPanelV2 component must
 * route text through typo('panelHeader' | 'panelBody' | 'panelMeta'). This
 * test greps the source files for forbidden raw Tailwind size / weight
 * classes that would bypass the strict 3-size system.
 *
 * Forbidden in className strings:
 *   text-lg / text-xl / text-base
 *   font-bold / font-semibold / font-medium   (use typo() for weight)
 *
 * Permitted:
 *   typo('panelHeader' | 'panelBody' | 'panelMeta')
 *   text-text-body / text-text-light / text-info / text-warning (colour tokens)
 *   text-xs / text-sm                                 (size tokens inside typo)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..', '..')
const AI_PANEL_V2_FILES = [
  'src/canvas/components/AIInputBar.tsx',
  'src/canvas/components/PersistentInputStrip.tsx',
  'src/canvas/components/SelectionPill.tsx',
  'src/canvas/components/FloatingOlumiPanel.tsx',
  'src/canvas/components/FirstUseComposer.tsx',
  'src/canvas/components/CogPopover.tsx',
  'src/canvas/components/OlumiTabBody.tsx',
] as const

// Look for raw size or weight classes inside double- or single- or
// backtick-quoted className strings. The regex is intentionally narrow:
// it requires the token to be a standalone class (surrounded by space /
// quote / backtick), so unrelated occurrences inside comments or
// imports are not flagged.
const FORBIDDEN_TOKENS = [
  'text-lg',
  'text-xl',
  'text-base',
  'font-bold',
  'font-semibold',
  'font-medium',
] as const

function classnameViolations(source: string): { token: string; line: number; snippet: string }[] {
  const lines = source.split('\n')
  const out: { token: string; line: number; snippet: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Skip pure comments (single-line // or */ /* …)
    const trimmed = line.trimStart()
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
    for (const token of FORBIDDEN_TOKENS) {
      const re = new RegExp(`[\\s"'\`]${token}[\\s"'\`]`)
      if (re.test(line)) {
        out.push({ token, line: i + 1, snippet: line.trim() })
      }
    }
  }
  return out
}

describe('aiPanelV2 typography sweep', () => {
  for (const rel of AI_PANEL_V2_FILES) {
    it(`${rel} uses only typo() for size/weight (no raw font classes)`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      const violations = classnameViolations(src)
      if (violations.length > 0) {
        const msg = violations
          .map((v) => `  ${rel}:${v.line}  '${v.token}' in: ${v.snippet}`)
          .join('\n')
        throw new Error(`Found ${violations.length} forbidden raw font class(es):\n${msg}`)
      }
      expect(violations).toEqual([])
    })
  }
})
