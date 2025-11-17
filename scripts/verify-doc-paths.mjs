#!/usr/bin/env node
/**
 * Doc Path Validator (S7-FILEOPS)
 * Verifies that all file paths mentioned in documentation exist in the codebase
 *
 * Usage:
 *   node scripts/verify-doc-paths.mjs
 *   node scripts/verify-doc-paths.mjs --fix  (to update docs with correct paths)
 *
 * Exit codes:
 *   0: All paths valid
 *   1: Invalid paths found
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

// Documentation files to check
const DOC_FILES = [
  'FEATURES_OVERVIEW.md',
  'docs/QA-CHECKLIST-DOCUMENTS.md',
  'docs/PENG_INTEGRATION_REQUIREMENTS.md',
  'CHANGELOG.md',
]

// Regex patterns to match file paths in markdown
// Note: Longer extensions first (tsx before ts, jsx before js) to match greedily
const PATH_PATTERNS = [
  // Inline code with file paths
  /`([a-zA-Z0-9_/.-]+\.(spec\.tsx|spec\.ts|tsx|ts|jsx|js|mjs|md))`/g,
  // File references in lists
  /^[\s-]*(?:\*|-|\d+\.)\s+`?([a-zA-Z0-9_/.-]+\.(spec\.tsx|spec\.ts|tsx|ts|jsx|js|mjs|md))`?/gm,
  // File references in tables
  /\|\s*`?([a-zA-Z0-9_/.-]+\.(spec\.tsx|spec\.ts|tsx|ts|jsx|js|mjs|md))`?\s*\|/g,
  // Files section
  /\*\*Files?\*\*:?\s*\n(?:[\s-]*(?:\*|-|\d+\.)\s+`?([a-zA-Z0-9_/.-]+\.(spec\.tsx|spec\.ts|tsx|ts|jsx|js|mjs|md))`?)/g,
]

// Paths to ignore (e.g., examples, pseudocode, patterns)
const IGNORED_PATHS = [
  'example.ts',
  'example.tsx',
  'path/to/file.ts',
  'your-file.ts',
  '.spec.tsx',  // Generic pattern reference, not a specific file
  '*.spec.tsx', // Generic pattern reference
]

class DocPathValidator {
  constructor() {
    this.errors = []
    this.warnings = []
    this.totalPaths = 0
    this.validPaths = 0
  }

  async validateAllDocs() {
    console.log('🔍 Validating documentation paths...\n')

    for (const docFile of DOC_FILES) {
      const fullPath = path.join(ROOT_DIR, docFile)

      try {
        await fs.access(fullPath)
      } catch {
        this.warnings.push(`Documentation file not found: ${docFile}`)
        continue
      }

      await this.validateDoc(docFile, fullPath)
    }

    this.printReport()
    return this.errors.length === 0
  }

  async validateDoc(docFile, fullPath) {
    console.log(`📄 Checking ${docFile}...`)

    const content = await fs.readFile(fullPath, 'utf-8')
    const paths = this.extractPaths(content)

    if (paths.length === 0) {
      console.log(`   No file paths found\n`)
      return
    }

    for (const filePath of paths) {
      await this.validatePath(docFile, filePath)
    }

    console.log()
  }

  extractPaths(content) {
    const paths = new Set()

    for (const pattern of PATH_PATTERNS) {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        // Extract path from capture group (may be in different groups depending on pattern)
        const filePath = match[1]
        if (filePath && !IGNORED_PATHS.includes(filePath)) {
          paths.add(filePath)
        }
      }
    }

    return Array.from(paths).sort()
  }

  async validatePath(docFile, filePath) {
    this.totalPaths++

    // Try different possible root locations
    const possiblePaths = [
      path.join(ROOT_DIR, filePath),
      path.join(ROOT_DIR, 'src', filePath),
      path.join(ROOT_DIR, 'e2e', filePath),
    ]

    let found = false
    for (const fullPath of possiblePaths) {
      try {
        await fs.access(fullPath)
        found = true
        this.validPaths++
        console.log(`   ✓ ${filePath}`)
        break
      } catch {
        // Try next path
      }
    }

    if (!found) {
      this.errors.push({ docFile, filePath })
      console.log(`   ✗ ${filePath} - NOT FOUND`)
    }
  }

  printReport() {
    console.log('─'.repeat(60))
    console.log('\n📊 Validation Report\n')

    console.log(`Total paths checked: ${this.totalPaths}`)
    console.log(`Valid paths: ${this.validPaths}`)
    console.log(`Invalid paths: ${this.errors.length}`)

    if (this.warnings.length > 0) {
      console.log(`Warnings: ${this.warnings.length}`)
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Invalid Paths:\n')

      const byDoc = {}
      for (const { docFile, filePath } of this.errors) {
        if (!byDoc[docFile]) {
          byDoc[docFile] = []
        }
        byDoc[docFile].push(filePath)
      }

      for (const [docFile, paths] of Object.entries(byDoc)) {
        console.log(`  ${docFile}:`)
        for (const filePath of paths) {
          console.log(`    - ${filePath}`)
        }
        console.log()
      }

      console.log('💡 Tip: Check if these files have been moved or renamed.\n')
    } else {
      console.log('\n✅ All documented paths are valid!\n')
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:\n')
      for (const warning of this.warnings) {
        console.log(`  - ${warning}`)
      }
      console.log()
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2)
  const fix = args.includes('--fix')

  if (fix) {
    console.log('--fix mode not implemented yet\n')
    process.exit(1)
  }

  const validator = new DocPathValidator()
  const success = await validator.validateAllDocs()

  process.exit(success ? 0 : 1)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
