/**
 * S-B ACTION SYSTEM, slice 0 — `ACTION_REGISTRY` is the ONE press mapping.
 *
 * Rows are bound by IDENTITY: action ids, catalogue method ids and the exact
 * chip id each action sends at each stage. The spec table below is the contract;
 * the registry must match it, and `askAi` must send what the registry says.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { ACTION_IDS, ACTION_REGISTRY, actionOfAsk, actionOfMethod, pressIdOf, typedPressIdOf, type ActionId } from '../actionRegistry'
import { buildAskAiQuestion } from '../askAi'
import { QUESTIONS, type AskStage } from '../askAiQuestions'
import { METHOD_CATALOGUE } from '../../../components/results/decision-overview/actionsCatalogue'
import { useCanvasStore } from '../../store'
import { selectRunAffirmedCurrent } from '../../state/analysisStateSelector'
import { selectRunWithholdsFigures } from '../../ui/inspector-v2/useAnalysisResults'

vi.mock('../../state/analysisStateSelector', () => ({ selectRunAffirmedCurrent: vi.fn(() => false) }))
vi.mock('../../ui/inspector-v2/useAnalysisResults', () => ({ selectRunWithholdsFigures: vi.fn(() => false) }))

const STAGES: readonly AskStage[] = ['drafted', 'ran-current', 'stale', 'withheld']

/** The contract: the chip id each action sends, by stage. `typed` ids are CEE's own handlers. */
const SENDS: Readonly<Record<ActionId, Readonly<Record<AskStage, string>>>> = {
  review: { drafted: 'ask:review', 'ran-current': 'agent-next-review-decision', stale: 'ask:review', withheld: 'ask:review' },
  what_changes: { drafted: 'ask:what-would-change', 'ran-current': 'agent-next-what-would-change', stale: 'ask:what-would-change', withheld: 'ask:what-would-change' },
  strengthen: { drafted: 'ask:strengthen', 'ran-current': 'agent-next-strengthen', stale: 'ask:strengthen', withheld: 'ask:strengthen' },
  pre_mortem: { drafted: 'ask:pre-mortem', 'ran-current': 'agent-next-pre-mortem', stale: 'ask:pre-mortem', withheld: 'agent-next-pre-mortem' },
  more_options: { drafted: 'ask:widen', 'ran-current': 'agent-next-widen', stale: 'ask:widen', withheld: 'ask:widen' },
  reframe: { drafted: 'ask:method-reframe', 'ran-current': 'ask:method-reframe', stale: 'ask:method-reframe', withheld: 'ask:method-reframe' },
  opposite_case: { drafted: 'ask:method-opposite', 'ran-current': 'ask:method-opposite', stale: 'ask:method-opposite', withheld: 'ask:method-opposite' },
  outside_view: { drafted: 'ask:method-outside-view', 'ran-current': 'ask:method-outside-view', stale: 'ask:method-outside-view', withheld: 'ask:method-outside-view' },
  trade_offs: { drafted: 'ask:compare-options', 'ran-current': 'ask:compare-options', stale: 'ask:compare-options', withheld: 'ask:compare-options' },
  bias_check: { drafted: 'ask:method-bias', 'ran-current': 'ask:method-bias', stale: 'ask:method-bias', withheld: 'ask:method-bias' },
}

/** ⚠ INTERIM: the actions with no typed CEE handler yet. Moving one to `typed` is a deliberate edit here. */
const PROSE: readonly ActionId[] = ['reframe', 'opposite_case', 'outside_view', 'trade_offs', 'bias_check']

const setStage = (stage: AskStage) => {
  useCanvasStore.setState({
    nodes: [], edges: [], hasCompletedFirstRun: stage !== 'drafted', v5AnalysisFact: null,
    results: stage === 'drafted' ? { status: 'idle' } : { status: 'complete', report: {} },
  } as never)
  vi.mocked(selectRunAffirmedCurrent).mockReturnValue(stage === 'ran-current' || stage === 'withheld')
  vi.mocked(selectRunWithholdsFigures).mockReturnValue(stage === 'withheld')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the table is well formed', () => {
  it('holds exactly the declared action ids', () => {
    expect(Object.keys(ACTION_REGISTRY).sort()).toEqual([...ACTION_IDS].sort())
    expect(Object.keys(SENDS).sort()).toEqual([...ACTION_IDS].sort())
  })

  it('every action asks a registered question, and no two actions share one', () => {
    const asks = ACTION_IDS.map((id) => ACTION_REGISTRY[id].ask)
    for (const ask of asks) expect(typeof QUESTIONS[ask], ask).toBe('function')
    expect(new Set(asks).size).toBe(asks.length)
    for (const id of ACTION_IDS) expect(actionOfAsk(ACTION_REGISTRY[id].ask)).toBe(id)
  })

  it('no two actions share a typed press id', () => {
    const ids = ACTION_IDS.flatMap((id) => {
      const handler = ACTION_REGISTRY[id].handler
      return handler.kind === 'typed' ? [handler.press_id] : []
    })
    expect(ids.length).toBeGreaterThanOrEqual(5)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the PROSE (interim) rows are exactly the five methods with no typed CEE handler', () => {
    expect(ACTION_IDS.filter((id) => ACTION_REGISTRY[id].handler.kind === 'prose').sort()).toEqual([...PROSE].sort())
  })

  it('every catalogue method is exactly one action (DERIVED from the catalogue)', () => {
    expect(METHOD_CATALOGUE.length).toBeGreaterThanOrEqual(7)
    const actions = METHOD_CATALOGUE.map((m) => actionOfMethod(m.id))
    for (const [i, action] of actions.entries()) expect(action, `${METHOD_CATALOGUE[i]!.id} is no action: its press would fall back to the drawer`).toBeDefined()
    expect(new Set(actions).size).toBe(actions.length)
    expect(actionOfMethod('not_a_method')).toBeUndefined()
  })
})

describe('the chip id a press sends, by stage', () => {
  it.each(ACTION_IDS.flatMap((id) => STAGES.map((stage) => [id, stage] as const)))('%s at %s', (id, stage) => {
    expect(pressIdOf(id, stage)).toBe(SENDS[id][stage])
    const typed = SENDS[id][stage].startsWith('agent-next-') ? SENDS[id][stage] : undefined
    expect(typedPressIdOf(id, stage)).toBe(typed)
  })

  it.each(ACTION_IDS.flatMap((id) => STAGES.map((stage) => [id, stage] as const)))(
    'askAi sends the registry’s id for %s at %s',
    (id, stage) => {
      setStage(stage)
      expect(buildAskAiQuestion({ intent: ACTION_REGISTRY[id].ask }).id).toBe(SENDS[id][stage])
    },
  )

  it('⛔ CONTRAST — an ask that is no action keeps its own `ask:` id at every stage', () => {
    expect(actionOfAsk('limits')).toBeUndefined()
    for (const stage of STAGES) {
      setStage(stage)
      expect(buildAskAiQuestion({ intent: 'limits' }).id).toBe('ask:limits')
    }
  })

  it('a caller’s own press id still wins (the link presses choose theirs)', () => {
    setStage('ran-current')
    expect(buildAskAiQuestion({ intent: 'review', pressId: 'caller-press' }).id).toBe('caller-press')
  })
})

/**
 * ⭐ THE TABLE IS THE SINGLE SOURCE. A typed press id spelled as a string in any
 * other non-test source file is a second mapper. Comments are stripped first, so
 * a docblock that names an id is not a spelling of it.
 */
describe('no typed press id is spelled outside the registry', () => {
  const SRC = join(process.cwd(), 'src')
  const REGISTRY_FILE = 'canvas/conversation/actionRegistry.ts'
  /**
   * Press ids that are not registry actions yet, by exact file and id. Each is
   * another system's door: "Add this as a risk" is the model-widening door (S-C).
   */
  const NOT_YET_REGISTRY: ReadonlyArray<readonly [file: string, id: string]> = [
    ['components/results/analysisNew/sections/PreMortemWorksheet.tsx', 'agent-next-suggest-risks'],
    ['v5/readPremortemWorksheet.ts', 'agent-next-suggest-risks'],
  ]

  const sourceFiles = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) {
        if (entry === '__tests__' || entry === 'node_modules') continue
        sourceFiles(p, out)
      } else if (/\.tsx?$/.test(p) && !/\.(spec|test)\.tsx?$/.test(p)) out.push(p)
    }
    return out
  }
  const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  const spelled = (): Array<readonly [string, string]> =>
    sourceFiles(SRC).flatMap((file) => {
      const ids = stripComments(readFileSync(file, 'utf8')).match(/(['"`])agent-next-[a-z-]{1,40}\1/g) ?? []
      return [...new Set(ids.map((quoted) => quoted.slice(1, -1)))].map((id) => [file.slice(SRC.length + 1), id] as const)
    })

  it('POSITIVE CONTROL — the scan sees the registry’s own typed ids', () => {
    const inRegistry = spelled().filter(([file]) => file === REGISTRY_FILE).map(([, id]) => id).sort()
    const typed = ACTION_IDS.flatMap((id) => {
      const handler = ACTION_REGISTRY[id].handler
      return handler.kind === 'typed' ? [handler.press_id] : []
    }).sort()
    expect(inRegistry).toEqual(typed)
  })

  it('every other spelling is a listed not-yet-registry door, and every listed door still exists', () => {
    const elsewhere = spelled().filter(([file]) => file !== REGISTRY_FILE).map(([file, id]) => `${file} ${id}`).sort()
    expect(elsewhere).toEqual(NOT_YET_REGISTRY.map(([file, id]) => `${file} ${id}`).sort())
  })
})
