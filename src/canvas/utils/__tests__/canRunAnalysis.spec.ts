/**
 * canRunAnalysis Utility Tests
 */

import { describe, it, expect, vi } from 'vitest'
import {
  canRunAnalysis,
  getRunButtonTooltip,
  getRunButtonAriaLabel,
  computeCeeCannotSeeModel,
  CEE_DRAFT_FIRST_REFUSAL,
  type CanRunAnalysisParams,
} from '../canRunAnalysis'
import { BLOCKED_REASON_COPY } from '../composeBlockedReason'


const isV5CanonicalRunPathMock = vi.fn(() => true)
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5CanonicalRunPath: () => isV5CanonicalRunPathMock() }
})

describe('canRunAnalysis', () => {
  const defaultParams: CanRunAnalysisParams = {
    graphHealth: null,
    readiness: null,
    hasBlockers: false,
    nodeCount: 3,
    isRunning: false,
  }

  describe('when analysis can run', () => {
    it('returns allowed=true with valid graph', () => {
      const result = canRunAnalysis(defaultParams)

      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('returns allowed=true with readiness can_run_analysis=true', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        readiness: {
          readiness_score: 70,
          readiness_level: 'ready', // ROADMAP 2.635 — was 'strong', the local heuristic's spelling of the top band; that heuristic is deleted and the level with it. `ready` is the producer's own top band at this score.
          can_run_analysis: true,
          confidence_explanation: 'Model looks good',
          improvements: [],
        },
      })

      expect(result.allowed).toBe(true)
    })

    it('includes warning for fair readiness level', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        readiness: {
          readiness_score: 50,
          readiness_level: 'fair',
          can_run_analysis: true,
          confidence_explanation: 'Analysis available',
          improvements: [],
        },
      })

      expect(result.allowed).toBe(true)
      expect(result.warning).toContain('consider improvements')
    })

    it('includes warning for validation warnings', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'warning', code: 'MISSING_LABEL', message: 'Node missing label' },
          ],
        },
      })

      expect(result.allowed).toBe(true)
      expect(result.warning).toContain('1 optional improvement')
    })

    it('includes plural warning for multiple validation warnings', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'warning', code: 'WARN1', message: 'Warning 1' },
            { severity: 'warning', code: 'WARN2', message: 'Warning 2' },
          ],
        },
      })

      expect(result.allowed).toBe(true)
      expect(result.warning).toContain('2 optional improvements')
    })
  })

  describe('when analysis is blocked', () => {
    it('blocks when isRunning=true', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        isRunning: true,
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Analysis is currently running')
    })

    it('blocks when nodeCount=0', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        nodeCount: 0,
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Add some nodes to get started')
    })

    it('blocks when graphHealth has error issues', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error', code: 'ORPHAN_NODE', message: 'Disconnected node found' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Disconnected node found')
      expect(result.blockingReasons).toContain('Disconnected node found')
    })

    it('blocks when graphHealth has blocker issues', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'blocker', code: 'CYCLE_DETECTED', message: 'Circular dependency' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Circular dependency')
    })

    it('blocks when hasBlockers=true', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        hasBlockers: true,
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Critical issues')
    })

    it('blocks when readiness can_run_analysis=false', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        readiness: {
          readiness_score: 20,
          readiness_level: 'needs_work',
          can_run_analysis: false,
          confidence_explanation: 'Graph needs more structure',
          improvements: [],
        },
      })

      expect(result.allowed).toBe(false)
      // ⚠ Contract change, 28 Jul: this asserted `toContain('Graph needs more
      // structure')` — the engine's own sentence, verbatim. That is exactly what
      // reached the user, and CEE's real refusals carry glossary-banned terms and
      // internal node ids, so every surface either degraded to a FALSE fallback
      // or leaked the id. The gate now emits COMPOSED copy derived from the
      // verdict's structured fields; the readiness dimension still gates
      // identically. See utils/composeBlockedReason.ts.
      expect(result.blockingReasons).not.toContain('Graph needs more structure')
      expect(result.blockingReasons).toHaveLength(1)
      expect(result.reason).toBe(BLOCKED_REASON_COPY.unspecified)
    })

    it('combines multiple blocking reasons', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error', code: 'ERROR1', message: 'Error 1' },
            { severity: 'error', code: 'ERROR2', message: 'Error 2' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('+1 more issue')
      expect(result.blockingReasons).toHaveLength(2)
    })

    it('handles multiple blocking reasons with plural', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error', code: 'ERROR1', message: 'Error 1' },
            { severity: 'error', code: 'ERROR2', message: 'Error 2' },
            { severity: 'error', code: 'ERROR3', message: 'Error 3' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('+2 more issues')
    })
  })

  describe('edge cases', () => {
    it('handles null graphHealth', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: null,
      })

      expect(result.allowed).toBe(true)
    })

    it('handles graphHealth with empty issues', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: { issues: [] },
      })

      expect(result.allowed).toBe(true)
    })

    it('handles issue without message', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error', code: 'ORPHAN_NODE' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('ORPHAN_NODE')
    })

    it('handles issue with only type', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error', type: 'VALIDATION_ERROR' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('VALIDATION_ERROR')
    })

    it('handles issue without code, type, or message', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Validation error')
    })
  })

  // UI-SEM-091: runnable-via-scaffold — CEE (#612) rides a scaffold intent on
  // the readiness response; when it will draft the remaining options the panel
  // is runnable even though can_run_analysis is false.
  describe('runnable-via-scaffold (UI-SEM-091)', () => {
    const notRunnable = {
      readiness_score: 20,
      readiness_level: 'needs_work' as const,
      can_run_analysis: false,
      confidence_explanation: 'Two options still need to be drafted.',
      improvements: [],
    }

    it('is runnable when can_run_analysis is false but will_scaffold_options is true', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        readiness: {
          ...notRunnable,
          scaffold_plan: { will_scaffold_options: true, option_count: 2 },
        },
      })

      expect(result.allowed).toBe(true)
      // The readiness refusal must NOT surface as a blocker in this state.
      expect(result.blockingReasons ?? []).not.toContain('Two options still need to be drafted.')
    })

    it('is runnable when will_scaffold_options is true with no option_count', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        readiness: {
          ...notRunnable,
          scaffold_plan: { will_scaffold_options: true },
        },
      })

      expect(result.allowed).toBe(true)
    })

    // Positive control: the OR term only fires on an explicit true.
    it('stays blocked when will_scaffold_options is false', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        readiness: {
          ...notRunnable,
          scaffold_plan: { will_scaffold_options: false },
        },
      })

      expect(result.allowed).toBe(false)
      // Contract change 28 Jul (see 'blocks when readiness can_run_analysis=false'
      // above): a readiness refusal registers a COMPOSED blocker, never the
      // engine's sentence. The gating behaviour under test is unchanged.
      expect(result.blockingReasons).toHaveLength(1)
      expect(result.blockingReasons).not.toContain('Two options still need to be drafted.')
    })

    // Positive control (fail-safe): absent scaffold_plan ⇒ byte-identical to
    // pre-scaffold behaviour (blocked exactly as today).
    it('stays blocked when scaffold_plan is absent', () => {
      const result = canRunAnalysis({ ...defaultParams, readiness: notRunnable })

      expect(result.allowed).toBe(false)
      expect(result.blockingReasons).toHaveLength(1)
      expect(result.blockingReasons).not.toContain('Two options still need to be drafted.')
    })

    // The OR is scoped to the readiness dimension only — real structural
    // blockers still gate even while scaffolding.
    it('validation blockers still gate even when scaffolding', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        readiness: {
          ...notRunnable,
          scaffold_plan: { will_scaffold_options: true, option_count: 2 },
        },
        graphHealth: {
          issues: [{ severity: 'error', code: 'CYCLE', message: 'Circular dependency' }],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.blockingReasons).toContain('Circular dependency')
    })
  })
})

describe('getRunButtonTooltip', () => {
  it('returns reason when not allowed', () => {
    const tooltip = getRunButtonTooltip({
      allowed: false,
      reason: 'Fix validation errors',
    })

    expect(tooltip).toBe('Fix validation errors')
  })

  it('returns warning when allowed with warning', () => {
    const tooltip = getRunButtonTooltip({
      allowed: true,
      warning: '2 optional improvements available',
    })

    expect(tooltip).toBe('2 optional improvements available')
  })

  it('returns undefined when allowed without warning', () => {
    const tooltip = getRunButtonTooltip({
      allowed: true,
    })

    expect(tooltip).toBeUndefined()
  })
})

describe('getRunButtonAriaLabel', () => {
  it('returns running message when isRunning', () => {
    const label = getRunButtonAriaLabel({ allowed: true }, true)

    expect(label).toBe('Analysis running…')
  })

  it('returns blocked message with reason when not allowed', () => {
    const label = getRunButtonAriaLabel({
      allowed: false,
      reason: 'Disconnected node found',
    }, false)

    expect(label).toContain('blocked')
    expect(label).toContain('Disconnected node found')
  })

  it('returns default blocked message when no reason', () => {
    const label = getRunButtonAriaLabel({
      allowed: false,
    }, false)

    expect(label).toContain('blocked')
    expect(label).toContain('issues need to be resolved')
  })

  it('returns standard label when allowed', () => {
    const label = getRunButtonAriaLabel({ allowed: true }, false)

    expect(label).toBe('Run analysis')
  })
})

describe('canRunAnalysis — #343 honest stopgap (model invisible to CEE)', () => {
  const base = {
    graphHealth: null,
    readiness: null,
    hasBlockers: false,
    nodeCount: 5,
  }

  it('blocks with CEE\'s own refusal sentence when the model cannot be seen by CEE', () => {
    // The reason string must be CEE's own refusal sentence so panel and chat
    // agree (#343). Deliberately the raw literal, NOT the exported constant:
    // this pin is what catches the constant drifting from CEE's actual copy.
    const result = canRunAnalysis({ ...base, ceeCannotSeeModel: true })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Draft or save a model first, then run analysis.')
  })

  it('does not block when the model is CEE-visible (flag false/omitted)', () => {
    expect(canRunAnalysis({ ...base, ceeCannotSeeModel: false }).allowed).toBe(true)
    expect(canRunAnalysis({ ...base }).allowed).toBe(true)
  })

  it('empty canvas still wins over the CEE-visibility blocker (more fundamental reason first)', () => {
    const result = canRunAnalysis({ ...base, nodeCount: 0, ceeCannotSeeModel: true })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Add some nodes to get started')
  })
})

describe('computeCeeCannotSeeModel — the ONE home for the honest-gate predicate', () => {
  const templateNodes = [{ data: { templateId: 'hiring-v1' } }, { data: {} }]
  const draftedNodes = [{ data: {} }, { data: { label: 'x' } }]

  it('true only for template provenance on the CEE-routed path', () => {
    isV5CanonicalRunPathMock.mockReturnValue(true)
    expect(computeCeeCannotSeeModel(templateNodes)).toBe(true)
    expect(computeCeeCannotSeeModel(draftedNodes)).toBe(false)
  })

  it('false off the canonical path — a V2-direct run CAN analyse canvas graphs', () => {
    isV5CanonicalRunPathMock.mockReturnValue(false)
    expect(computeCeeCannotSeeModel(templateNodes)).toBe(false)
  })

  it('the exported refusal constant IS the sentence the gate emits (one home, no drift)', () => {
    isV5CanonicalRunPathMock.mockReturnValue(true)
    const result = canRunAnalysis({ graphHealth: null, readiness: null, hasBlockers: false, nodeCount: 5, ceeCannotSeeModel: computeCeeCannotSeeModel(templateNodes) })
    expect(result.reason).toBe(CEE_DRAFT_FIRST_REFUSAL)
  })
})
