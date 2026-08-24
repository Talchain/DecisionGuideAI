import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(process.cwd(), 'src')

/**
 * Brief B4's complete mounted-consumer census. Keeping the list executable is
 * deliberate: a fix that reaches only the post-analysis nudge cannot silently
 * claim closure while a pre-analysis row still projects a score as a share.
 */
const MOUNTED_CONSUMERS = [
  'components/results/TriageActionCardsBody.tsx',
  'components/shared/TriageCard.tsx',
  'canvas/components/pre-analysis/PreAnalysisPanel.tsx',
  'canvas/components/pre-analysis/WorthInvestigating.tsx',
  'canvas/components/pre-analysis/AllImprovements.tsx',
  'canvas/components/pre-analysis/mapImprovementToTriageCard.ts',
  'canvas/components/pre-analysis/sectionCoaching.ts',
] as const

const POLICY_BINDING_BY_CONSUMER: Record<(typeof MOUNTED_CONSUMERS)[number], string> = {
  'components/results/TriageActionCardsBody.tsx': 'resolveDriverClaimBasis',
  'components/shared/TriageCard.tsx': 'analysisMetricTitle',
  'canvas/components/pre-analysis/PreAnalysisPanel.tsx': 'resolveAnalysisMetric',
  'canvas/components/pre-analysis/WorthInvestigating.tsx': 'resolveAnalysisMetric',
  'canvas/components/pre-analysis/AllImprovements.tsx': 'resolveAnalysisMetric',
  'canvas/components/pre-analysis/mapImprovementToTriageCard.ts': 'resolveAnalysisMetric',
  'canvas/components/pre-analysis/sectionCoaching.ts': 'analysisMetricPredicate',
}

// Repository-wide scan exclusions are explicit and bounded. `DriverChips`
// has no JSX mount in production (the live results surface uses DriversSection),
// while `pages/sandbox-guide` is a separate prototype surface. If either path
// changes or a new candidate appears, this census goes red for review.
const NON_MOUNTED_REPOSITORY_CANDIDATES = [
  'canvas/components/DriverChips.tsx',
  'pages/sandbox-guide/components/canvas/NodeBadge.tsx',
] as const

const FORBIDDEN_PARTITION_OR_VARIANCE = [
  /drives?\s+[^\n`]*%\s+of\s+(?:the\s+)?(?:outcome|result|variance)/i,
  /accounts?\s+for\s+[^\n`]*%\s+of\s+(?:the\s+)?(?:outcome|result|variance)/i,
  /contributes?\s+[^\n`]*%\s+to\s+(?:the\s+)?(?:outcome|result|variance)/i,
  /drives?\s+most\s+of\s+(?:the\s+)?(?:outcome|result|variance)/i,
]

describe('Brief B4 mounted analysis-copy consumer census', () => {
  it('names existing repository files, not prose-only pseudo-paths', () => {
    for (const relative of MOUNTED_CONSUMERS) {
      expect(fs.existsSync(path.join(ROOT, relative)), relative).toBe(true)
    }
  })

  it('contains no mounted score-as-partition or score-as-variance candidate', () => {
    for (const relative of MOUNTED_CONSUMERS) {
      const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
      for (const forbidden of FORBIDDEN_PARTITION_OR_VARIANCE) {
        expect(source, `${relative} matched ${forbidden}`).not.toMatch(forbidden)
      }
    }
  })

  it('binds every mounted consumer to the central resolver/copy policy', () => {
    for (const relative of MOUNTED_CONSUMERS) {
      const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
      expect(source, relative).toContain(POLICY_BINDING_BY_CONSUMER[relative])
    }
  })

  it('censuses every remaining repository render candidate as explicitly non-mounted', () => {
    const renderFiles: string[] = []
    const visit = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') visit(absolute)
        } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
          renderFiles.push(path.relative(ROOT, absolute))
        }
      }
    }
    visit(ROOT)

    const candidates = renderFiles.filter((relative) => {
      const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
      return FORBIDDEN_PARTITION_OR_VARIANCE.some((pattern) => pattern.test(source))
    }).sort()

    expect(candidates).toEqual([...NON_MOUNTED_REPOSITORY_CANDIDATES].sort())

    const productionSource = renderFiles
      .filter((relative) => relative !== 'canvas/components/DriverChips.tsx')
      .map((relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8'))
      .join('\n')
    expect(productionSource).not.toContain('<DriverChips')
  })

  it('keeps the scanner live with an attached share-language mutant', () => {
    const mutant = 'Dominant factor drives 100% of the outcome'
    expect(FORBIDDEN_PARTITION_OR_VARIANCE.some((pattern) => pattern.test(mutant))).toBe(true)
  })
})
