/**
 * S4-COPY: British English Verification
 *
 * Validates that all user-facing copy uses British English spelling:
 * - visualisation (not visualization)
 * - analyse (not analyze)
 * - colour (not color)
 * - behaviour (not behavior)
 * - optimise (not optimize)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

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
    'centered': 'centred'
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
    const content = readFileSync(filePath, 'utf-8')
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

  describe('User-Facing Copy', () => {
    it('should use British spelling for "visualisation"', () => {
      const canvasDir = join(process.cwd(), 'src/canvas')
      const files = getCanvasFiles(canvasDir)

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
      const canvasDir = join(process.cwd(), 'src/canvas')
      const files = getCanvasFiles(canvasDir)

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
      const canvasDir = join(process.cwd(), 'src/canvas')
      const files = getCanvasFiles(canvasDir)

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
      const canvasDir = join(process.cwd(), 'src/canvas')
      const files = getCanvasFiles(canvasDir)

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
})
