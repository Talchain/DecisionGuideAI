/**
 * S4-COPY: British English Verification
 *
 * Validates that all user-facing copy uses British English spelling:
 * - visualisation (not visualization)
 * - analyse (not analyze)
 * - colour (not color)
 * - behaviour (not behavior)
 * - optimise (not optimize)
 *
 * SCOPE: user-facing copy only. Comments and JSDoc are stripped before scanning
 * (shared literal-aware tokeniser, tests/helpers/stripSourceComments), so a
 * design-note that merely mentions an American spelling does not redden the guard
 * — the #386 comment-scanning-footgun fix, applied here. See the
 * "comment-aware scanning" describe block for the both-directions mutation proof.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { stripComments } from '../../../tests/helpers/stripSourceComments'

describe('S4-COPY: British English Verification', () => {
  // American spellings that should be British
  const americanToBritish: Record<string, string> = {
    'visualization': 'visualisation',
    'visualizations': 'visualisations',
    'analyze': 'analyse',
    'analyzes': 'analyses',
    'analyzed': 'analysed',
    'analyzing': 'analysing',
    'analyzer': 'analyser',
    'analyzers': 'analysers',
    'optimize': 'optimise',
    'optimizes': 'optimises',
    'optimized': 'optimised',
    'optimizing': 'optimising',
    'optimizer': 'optimiser',
    'optimizers': 'optimisers',
    'color': 'colour',
    'colors': 'colours',
    'colored': 'coloured',
    'coloring': 'colouring',
    'behavior': 'behaviour',
    'behaviors': 'behaviours',
    'behavioral': 'behavioural',
    'favorite': 'favourite',
    'favorites': 'favourites',
    'center': 'centre',
    'centers': 'centres',
    'centered': 'centred',
    'customize': 'customise',
    'customizes': 'customises',
    'customized': 'customised',
    'customizing': 'customising',
    'customizable': 'customisable'
  }

  // Exceptions: Technical terms, APIs, library names that must use American spelling
  const exceptions = [
    'color:', // CSS property
    'color=', // URL parameter
    'backgroundColor', // CSS/JS property
    'textColor', // Property name
    'borderColor', // Property name
    'behavior:', // CSS property
    'analyzer:', // Technical term in AST/babel context
    'Analyzer', // Class name in technical context
    'center:', // CSS property
    'textAlign: "center"', // CSS value
    'justifyContent: "center"', // CSS value
    'alignItems: "center"', // CSS value
    './colors', // Module import for color utilities
    'colors.', // Property access on colors helper
    "alignItems: 'center'", // CSS-in-JS/Tailwind style value
    'items-center', // Tailwind utility class
    'justify-center', // Tailwind utility class
    'transition-colors', // Tailwind utility class
    'Center above cursor', // Technical layout comment in EdgeEditPopover
    'colorClass', // Variable name for colour CSS class
    'thresholdColour', // Import/function name (already British in code)
    'getThresholdColour', // Import/function name (already British in code)
    'constraintConfidenceColour', // Import/function name (already British in code)
    'text-center', // Tailwind utility class
    'Color', // React/CSS type name (e.g., CSSProperties.color)
  ]

  /**
   * Check if a line contains an exception
   */
  function isException(line: string): boolean {
    return exceptions.some(exc => line.includes(exc))
  }

  /**
   * Find American spellings in user-facing strings
   */
  function findAmericanSpellings(filePath: string): Array<{ line: number; text: string; american: string; british: string }> {
    const raw = readFileSync(filePath, 'utf-8')
    // Comments are NOT user-facing copy. Strip them (literal-aware, comment chars
    // → spaces so line numbers stay accurate) BEFORE the scan, so a design-note or
    // JSDoc that merely MENTIONS an American spelling — e.g. the wire field name
    // `analyze_sentiment` documented in ceeRecovery.ts — can never redden this
    // guard. This is the same footgun PR #386 fixed in the alpha-emission guard;
    // both now share tests/helpers/stripSourceComments. String, template and JSX
    // literals survive stripping, so genuinely rendered copy is still scanned.
    // Markdown/README files carry no code comments and are user-facing prose end
    // to end, so they are scanned whole.
    const content = /\.(tsx?|jsx?|css)$/.test(filePath)
      ? stripComments(raw, filePath)
      : raw
    const lines = content.split('\n')
    const violations: Array<{ line: number; text: string; american: string; british: string }> = []

    lines.forEach((line, index) => {
      // Skip if it's an exception
      if (isException(line)) return

      // Check for American spellings in user-facing strings
      // Look for strings in quotes, comments, or JSX text
      const isUserFacing =
        line.includes('"') || // String literals
        line.includes("'") || // String literals
        line.includes('//') || // Comments
        line.includes('/*') || // Block comments
        line.includes('*') || // JSDoc
        line.match(/>([^<]+)</) // JSX text content

      if (isUserFacing) {
        for (const [american, british] of Object.entries(americanToBritish)) {
          // Use word boundary regex to avoid false positives
          const regex = new RegExp(`\\b${american}\\b`, 'i')

          if (regex.test(line)) {
            violations.push({
              line: index + 1,
              text: line.trim(),
              american,
              british
            })
          }
        }
      }
    })

    return violations
  }

  /**
   * Get all TypeScript/TSX files in canvas directory
   */
  function getCanvasFiles(dir: string, fileList: string[] = []): string[] {
    const files = readdirSync(dir, { withFileTypes: true })

    for (const file of files) {
      const filePath = join(dir, file.name)

      if (file.isDirectory()) {
        // Skip node_modules, dist, etc.
        if (!['node_modules', 'dist', '.git', 'build', '__tests__'].includes(file.name)) {
          getCanvasFiles(filePath, fileList)
        }
      } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
        fileList.push(filePath)
      }
    }

    return fileList
  }

  // Directories containing user-facing copy
  const userFacingDirs = [
    join(process.cwd(), 'src/canvas'),
    join(process.cwd(), 'src/components/results'),
    join(process.cwd(), 'src/components/assistants'),
  ]

  function getAllUserFacingFiles(): string[] {
    const allFiles: string[] = []
    for (const dir of userFacingDirs) {
      try {
        getCanvasFiles(dir, allFiles)
      } catch {
        // Directory may not exist
      }
    }
    return allFiles
  }

  describe('User-Facing Copy', () => {
    it('should use British spelling for "visualisation"', () => {
      const files = getAllUserFacingFiles()

      const violations: Array<{ file: string; line: number; text: string }> = []

      files.forEach(file => {
        const issues = findAmericanSpellings(file)
        issues.forEach(issue => {
          if (issue.american.includes('visualiz')) {
            violations.push({
              file: file.replace(process.cwd(), ''),
              line: issue.line,
              text: issue.text
            })
          }
        })
      })

      if (violations.length > 0) {
        console.log('\n❌ Found American spelling "visualization" in user-facing copy:')
        violations.forEach(v => {
          console.log(`   ${v.file}:${v.line}`)
          console.log(`   ${v.text}`)
        })
      }

      expect(violations.length).toBe(0)
    })

    it('should use British spelling for "analyse"', () => {
      const files = getAllUserFacingFiles()

      const violations: Array<{ file: string; line: number; text: string }> = []

      files.forEach(file => {
        const issues = findAmericanSpellings(file)
        issues.forEach(issue => {
          if (issue.american.includes('analyz')) {
            violations.push({
              file: file.replace(process.cwd(), ''),
              line: issue.line,
              text: issue.text
            })
          }
        })
      })

      if (violations.length > 0) {
        console.log('\n❌ Found American spelling "analyze" in user-facing copy:')
        violations.forEach(v => {
          console.log(`   ${v.file}:${v.line}`)
          console.log(`   ${v.text}`)
        })
      }

      expect(violations.length).toBe(0)
    })

    it('should use British spelling for "optimise"', () => {
      const files = getAllUserFacingFiles()

      const violations: Array<{ file: string; line: number; text: string }> = []

      files.forEach(file => {
        const issues = findAmericanSpellings(file)
        issues.forEach(issue => {
          if (issue.american.includes('optimiz')) {
            violations.push({
              file: file.replace(process.cwd(), ''),
              line: issue.line,
              text: issue.text
            })
          }
        })
      })

      if (violations.length > 0) {
        console.log('\n❌ Found American spelling "optimize" in user-facing copy:')
        violations.forEach(v => {
          console.log(`   ${v.file}:${v.line}`)
          console.log(`   ${v.text}`)
        })
      }

      expect(violations.length).toBe(0)
    })

    it('should use British spelling for "behaviour"', () => {
      const files = getAllUserFacingFiles()

      const violations: Array<{ file: string; line: number; text: string }> = []

      files.forEach(file => {
        const issues = findAmericanSpellings(file)
        issues.forEach(issue => {
          if (issue.american.includes('behavior')) {
            violations.push({
              file: file.replace(process.cwd(), ''),
              line: issue.line,
              text: issue.text
            })
          }
        })
      })

      if (violations.length > 0) {
        console.log('\n❌ Found American spelling "behavior" in user-facing copy:')
        violations.forEach(v => {
          console.log(`   ${v.file}:${v.line}`)
          console.log(`   ${v.text}`)
        })
      }

      expect(violations.length).toBe(0)
    })
  })

  describe('Component-Specific Verification', () => {
    it('should verify BaseNode.tsx uses British English', () => {
      const filePath = join(process.cwd(), 'src/canvas/nodes/BaseNode.tsx')
      const issues = findAmericanSpellings(filePath)

      if (issues.length > 0) {
        console.log('\n❌ BaseNode.tsx has American spellings:')
        issues.forEach(issue => {
          console.log(`   Line ${issue.line}: "${issue.american}" → "${issue.british}"`)
          console.log(`   ${issue.text}`)
        })
      }

      expect(issues.length).toBe(0)
    })

    it('should verify UnknownKindWarning.tsx uses British English', () => {
      const filePath = join(process.cwd(), 'src/canvas/components/UnknownKindWarning.tsx')
      const issues = findAmericanSpellings(filePath)

      if (issues.length > 0) {
        console.log('\n❌ UnknownKindWarning.tsx has American spellings:')
        issues.forEach(issue => {
          console.log(`   Line ${issue.line}: "${issue.american}" → "${issue.british}"`)
          console.log(`   ${issue.text}`)
        })
      }

      expect(issues.length).toBe(0)
    })

    it('should verify EdgeEditPopover.tsx uses British English', () => {
      const filePath = join(process.cwd(), 'src/canvas/edges/EdgeEditPopover.tsx')
      const issues = findAmericanSpellings(filePath)

      if (issues.length > 0) {
        console.log('\n❌ EdgeEditPopover.tsx has American spellings:')
        issues.forEach(issue => {
          console.log(`   Line ${issue.line}: "${issue.american}" → "${issue.british}"`)
          console.log(`   ${issue.text}`)
        })
      }

      expect(issues.length).toBe(0)
    })

    it('should verify backendKinds adapter uses British English', () => {
      const filePath = join(process.cwd(), 'src/canvas/adapters/backendKinds.ts')
      const issues = findAmericanSpellings(filePath)

      if (issues.length > 0) {
        console.log('\n❌ backendKinds.ts has American spellings:')
        issues.forEach(issue => {
          console.log(`   Line ${issue.line}: "${issue.american}" → "${issue.british}"`)
          console.log(`   ${issue.text}`)
        })
      }

      expect(issues.length).toBe(0)
    })
  })

  describe('Documentation', () => {
    it('should verify README files use British English', () => {
      const canvasDir = join(process.cwd(), 'src/canvas')

      // Find README files
      const findReadmes = (dir: string): string[] => {
        const readmes: string[] = []
        try {
          const files = readdirSync(dir, { withFileTypes: true })

          for (const file of files) {
            const filePath = join(dir, file.name)

            if (file.isDirectory() && !['node_modules', 'dist'].includes(file.name)) {
              readmes.push(...findReadmes(filePath))
            } else if (file.name.toLowerCase().includes('readme')) {
              readmes.push(filePath)
            }
          }
        } catch {
          // Directory may not exist
        }

        return readmes
      }

      const readmes = findReadmes(canvasDir)
      const violations: Array<{ file: string; line: number; text: string }> = []

      readmes.forEach(file => {
        const issues = findAmericanSpellings(file)
        issues.forEach(issue => {
          violations.push({
            file: file.replace(process.cwd(), ''),
            line: issue.line,
            text: issue.text
          })
        })
      })

      if (violations.length > 0) {
        console.log('\n❌ Found American spellings in README files:')
        violations.forEach(v => {
          console.log(`   ${v.file}:${v.line}`)
          console.log(`   ${v.text}`)
        })
      }

      expect(violations.length).toBe(0)
    })
  })

  /**
   * MUTATION PROOF (both directions), the #386 discipline applied to this guard.
   *
   * The guard's INPUT is now comment-stripped, so two things must hold at once:
   *   (i)  a real American spelling in RENDERED copy (a string literal / JSX text
   *        that reaches the UI) is still caught — the positive control, without
   *        which every "no violations" assertion above is vacuous; and
   *   (ii) a bare American spelling that lives ONLY inside a comment / JSDoc no
   *        longer trips it (the footgun that forced ceeRecovery.ts to spell its
   *        example `analyze_sentiment` to dodge the guard).
   *
   * These call the real `findAmericanSpellings` against tiny on-disk files, so
   * they exercise the exact read → strip → scan path the guard uses in CI.
   */
  describe('comment-aware scanning (footgun parity with #386)', () => {
    let dir: string
    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'british-english-guard-'))
    })
    afterAll(() => rmSync(dir, { recursive: true, force: true }))

    const scan = (name: string, source: string) => {
      const p = join(dir, name)
      writeFileSync(p, source)
      return findAmericanSpellings(p)
    }

    it('POSITIVE CONTROL: an American spelling in a user-facing STRING LITERAL is caught', () => {
      const v = scan('violation.tsx', "export const label = 'Analyze results'\n")
      expect(v.map((x) => x.american)).toContain('analyze')
    })

    it('a bare "analyze" that lives ONLY in a // line comment does not trip', () => {
      const v = scan(
        'line-comment.tsx',
        '// we deliberately analyze producer prose upstream\nexport const A = 1\n',
      )
      expect(v).toEqual([])
    })

    it('a bare "analyze" in a /* */ block comment / JSDoc does not trip', () => {
      const v = scan(
        'block-comment.tsx',
        '/**\n * We do not analyze producer prose here — see the note below.\n' +
          ' * A wire field name like `analyze_sentiment` stays verbatim.\n */\n' +
          'export const B = 2\n',
      )
      expect(v).toEqual([])
    })

    it('a genuine violation SURVIVES when a comment on the same line is stripped', () => {
      // The string literal is user-facing (RED); the trailing comment that also
      // says "optimize" is stripped (not counted). Proves stripping is surgical.
      const v = scan('mixed.tsx', "export const t = 'Customize your view' // optimize later\n")
      const words = v.map((x) => x.american)
      expect(words).toContain('customize')
      expect(words).not.toContain('optimize')
    })
  })
})
