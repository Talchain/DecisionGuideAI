/**
 * Registry matrix + boundary-rule static assertions:
 * - exact signal id set (banned signals cannot exist),
 * - no dead-end intents anywhere in the v3 source,
 * - readiness_level never read in the v3 source,
 * - every copy string passes the communication glossary scan.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { stripComments } from '../../../../../../tests/helpers/stripSourceComments'
import { SIGNAL_REGISTRY, type SignalDetectionInput } from '../registry'
import {
  ACTIONS_MENU,
  ATTRIBUTION_COPY,
  FOOTER_COPY,
  HERO_COPY,
  LADDER_COPY,
  MODEL_VIEW_COPY,
  PANEL_COPY,
  RANK_LABEL_COPY,
  SIGNAL_COPY,
  SPARK_PROMPTS,
} from '../../constants'
import { findBannedTerm } from '../../../../../test/glossaryBannedTerms'
import { BLOCKED_REASON_COPY } from '../../../../utils/composeBlockedReason'

function input(overrides: Partial<SignalDetectionInput> = {}): SignalDetectionInput {
  return {
    goalPresent: true,
    successSet: true,
    optionCount: 2,
    riskCount: 2,
    risksAllOlumi: true,
    aiEstimatedCount: 6,
    topUncalibrated: { id: 'f1', label: 'Tech lead impact' },
    narrowFramingDetail: null,
    biasFindingExplanation: null,
    ...overrides,
  }
}

describe('signal registry — exact id set (banned signals cannot exist)', () => {
  it('contains exactly the six audited signals', () => {
    expect(SIGNAL_REGISTRY.map(d => d.signal_id).sort()).toEqual([
      'sig_cee_bias',
      'sig_estimates',
      'sig_goal_missing',
      'sig_option_breadth',
      'sig_risk_count',
      'sig_success_missing',
    ])
  })
})

describe('signal detections — presence/count/structure only', () => {
  it('goal missing fires only without a goal', () => {
    const def = SIGNAL_REGISTRY.find(d => d.signal_id === 'sig_goal_missing')!
    expect(def.detect(input({ goalPresent: false }))).not.toBeNull()
    expect(def.detect(input())).toBeNull()
  })

  it('success missing requires a goal to exist', () => {
    const def = SIGNAL_REGISTRY.find(d => d.signal_id === 'sig_success_missing')!
    expect(def.detect(input({ successSet: false }))).not.toBeNull()
    expect(def.detect(input({ goalPresent: false, successSet: false }))).toBeNull()
    expect(def.detect(input())).toBeNull()
  })

  it('option breadth fires below three options with count copy', () => {
    const def = SIGNAL_REGISTRY.find(d => d.signal_id === 'sig_option_breadth')!
    expect(def.detect(input({ optionCount: 1 }))!.copy.lead).toBe('Only one option so far.')
    expect(def.detect(input({ optionCount: 2 }))!.copy.lead).toBe('You are comparing two options.')
    expect(def.detect(input({ optionCount: 3 }))).toBeNull()
  })

  it('option breadth swaps in CEE narrow-framing text verbatim when live', () => {
    const def = SIGNAL_REGISTRY.find(d => d.signal_id === 'sig_option_breadth')!
    const detail = 'Both options are hiring routes through the same mechanism.'
    const detection = def.detect(input({ narrowFramingDetail: detail }))!
    expect(detection.ceeOverride?.text).toBe(detail)
    expect(detection.ceeOverride?.attribution).toEqual({ kind: 'olumi' })
    expect(def.detect(input())!.ceeOverride).toBeUndefined()
  })

  it('risk count fires at two or fewer, with provenance-attributed count copy', () => {
    const def = SIGNAL_REGISTRY.find(d => d.signal_id === 'sig_risk_count')!
    expect(def.detect(input({ riskCount: 0 }))!.copy.lead).toBe('No risks captured yet.')
    expect(def.detect(input({ riskCount: 2, risksAllOlumi: true }))!.copy.lead).toBe(
      "2 risks captured, all Olumi's so far.",
    )
    expect(def.detect(input({ riskCount: 2, risksAllOlumi: false }))!.copy.lead).toBe(
      '2 risks captured.',
    )
    expect(def.detect(input({ riskCount: 3 }))).toBeNull()
  })

  it('estimates fires while an AI estimate is uncalibrated, hedged', () => {
    const def = SIGNAL_REGISTRY.find(d => d.signal_id === 'sig_estimates')!
    const detection = def.detect(input())!
    expect(detection.copy.lead).toBe('Olumi estimated 6 values from your brief.')
    expect(detection.copy.emphasis).toContain('may matter most')
    expect(def.detect(input({ topUncalibrated: null }))).toBeNull()
    expect(def.detect(input({ aiEstimatedCount: 0 }))).toBeNull()
  })

  it('CEE bias row renders only when live, verbatim, with no resolved confirmation', () => {
    const def = SIGNAL_REGISTRY.find(d => d.signal_id === 'sig_cee_bias')!
    expect(def.detect(input())).toBeNull()
    const text = 'One or more highly connected factors may overweight senior opinions.'
    const detection = def.detect(input({ biasFindingExplanation: text }))!
    expect(detection.ceeOverride?.text).toBe(text)
    expect(def.resolvedCopy).toBeNull()
  })
})

describe('boundary rules — static source assertions over the v3 directory', () => {
  const v3Root = path.resolve(__dirname, '../..')
  const sources: string[] = []
  const collect = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') collect(full)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        // stripComments blanks comments but KEEPS strings as code, so a comment
        // mentioning a dead-end intent no longer false-reds (the #386/#403
        // footgun) while a real `intent: 'confirm_factor'` string literal or a
        // `x['readiness_level']` bracket-key read is still caught. blankNonCode
        // would blank those strings and go blind to a real intent reference, so
        // it is the wrong tool (reclassified from the "blankNonCode class").
        sources.push(stripComments(fs.readFileSync(full, 'utf8'), entry.name))
      }
    }
  }
  collect(v3Root)
  const blob = sources.join('\n')

  it('never references the dead-end intents', () => {
    for (const intent of ['confirm_factor', 'edit_factor', 'gather_evidence', 'run_pre_mortem', 'run_premortem']) {
      expect(blob.includes(intent), `dead-end intent ${intent} found in v3 source`).toBe(false)
    }
  })

  it('never branches on readiness_level (live enum drift)', () => {
    expect(blob.includes('readiness_level')).toBe(false)
  })

  it('never uses dangerouslySetInnerHTML', () => {
    expect(blob.includes('dangerouslySetInnerHTML')).toBe(false)
  })

  it('comment-strip both directions: comment mentions ignored, string/bracket-key still caught', () => {
    const strip = (s: string) => stripComments(s, 'x.ts')
    // A comment mentioning a dead-end intent is blanked → not scanned:
    expect(strip('// never add confirm_factor here').includes('confirm_factor')).toBe(false)
    // A real intent STRING literal is kept and still caught:
    expect(strip("const intent = 'confirm_factor'").includes('confirm_factor')).toBe(true)
    // A bracket-key read of the banned enum survives (why we keep strings):
    expect(strip("const r = data['readiness_level']").includes('readiness_level')).toBe(true)
  })
})

describe('glossary — every copy string passes the banned-terms scan', () => {
  const strings: Array<[string, string]> = []
  const push = (context: string, value: unknown) => {
    if (typeof value === 'string' && value.length > 0) strings.push([context, value])
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'function') continue
        push(`${context}.${k}`, v)
      }
    }
  }
  push('PANEL_COPY', PANEL_COPY)
  push('LADDER_COPY', {
    ...LADDER_COPY,
    calibrate_top: LADDER_COPY.calibrate_top('Tech lead impact'),
    // UI-SEM-091: invoke the runnable-via-scaffold rung so its copy is scanned.
    run_scaffold: LADDER_COPY.run_scaffold(2),
  })
  push('SIGNAL_COPY', {
    ...SIGNAL_COPY,
    optionBreadth: SIGNAL_COPY.optionBreadth(2),
    riskCount: SIGNAL_COPY.riskCount(2, true),
    estimates: SIGNAL_COPY.estimates(6, 'Tech lead impact'),
    estimatesNoTop: SIGNAL_COPY.estimates(1, null),
  })
  push('ATTRIBUTION_COPY', ATTRIBUTION_COPY)
  push('RANK_LABEL_COPY', RANK_LABEL_COPY)
  push('MODEL_VIEW_COPY', { ...MODEL_VIEW_COPY, estimatesMeta: MODEL_VIEW_COPY.estimatesMeta(1, 6, 0), goalRow: MODEL_VIEW_COPY.goalRow('Increase output') })
  // UI-SEM-091: invoke the runnable-via-scaffold subline so its copy is scanned.
  push('FOOTER_COPY', { ...FOOTER_COPY, scaffoldSub: FOOTER_COPY.scaffoldSub(2) })
  // The composed blocked-state copy (Paul 28 Jul) — every rung invoked so the
  // sweep sees the actual sentences a blocked user is shown, not the factories.
  // The interpolated option label is guarded separately by safeInterpolatedLabel.
  push('BLOCKED_REASON_COPY', {
    ...BLOCKED_REASON_COPY,
    oneOption: BLOCKED_REASON_COPY.oneOption('Buy a vendor platform'),
    twoOptions: BLOCKED_REASON_COPY.twoOptions('Buy a vendor platform', 'Build in house'),
    manyOptionsSingular: BLOCKED_REASON_COPY.manyOptions(1),
    manyOptions: BLOCKED_REASON_COPY.manyOptions(3),
  })
  push('HERO_COPY', HERO_COPY)
  push('ACTIONS_MENU', ACTIONS_MENU)
  push('SPARK_PROMPTS', SPARK_PROMPTS)
  for (const def of SIGNAL_REGISTRY) {
    push(`resolved.${def.signal_id}`, def.resolvedCopy ?? '')
  }

  it.each(strings)('%s: "%s" contains no banned terms', (_context, value) => {
    expect(findBannedTerm(value)).toBeNull()
  })

  it('no em dashes anywhere in copy', () => {
    for (const [context, value] of strings) {
      expect(value.includes('—'), `em dash in ${context}`).toBe(false)
    }
  })
})
