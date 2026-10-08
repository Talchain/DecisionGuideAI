/** The new picker introduces no graph/value writer and keeps toast mounting safe. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')
const optionPath = 'src/canvas/ui/inspector-v2/panels/OptionPanel.tsx'
const pickerPath = 'src/canvas/ui/inspector-v2/shared/InspectorConnectPicker.tsx'
const gesturePath = 'src/canvas/hooks/useConnectGesture.ts'

describe('Inspector connect — one existing writer', () => {
  it('the option picker and shared picker never call the local intervention writer or addEdge', () => {
    for (const path of [optionPath, pickerPath]) {
      const text = source(path)
      expect(text, path).not.toMatch(/\bsetIntervention\s*\(/)
      expect(text, path).not.toMatch(/\baddEdge\s*\(/)
    }
  })

  it('the shared createUserEdge function is the single addEdge caller in the gesture module', () => {
    const text = source(gesturePath)
    expect(text.match(/\baddEdge\s*\(/g)).toHaveLength(1)
    const sharedFunction = text.match(/export function createUserEdge\s*\([\s\S]*?\n\}/)?.[0]
    expect(sharedFunction, 'the create path must be exported for both UI callers').toBeDefined()
    expect(sharedFunction).toMatch(/\.addEdge\s*\(\s*\{\s*\.\.\.connection,\s*data:\s*USER_EDGE_DEFAULTS\s*\}\s*\)/)
    expect(sharedFunction).toMatch(/reportManualEdit\s*\(\s*\{\s*edit:\s*\{\s*kind:\s*'structural_add_edge'/)
    const hook = text.slice(text.indexOf('export function useConnectGesture'))
    expect(hook).not.toMatch(/\baddEdge\s*\(/)
    expect(hook).toMatch(/createUserEdge\s*\(\s*connection,\s*showToast\s*\)/)
    expect(hook).toMatch(/createUserEdge\s*\(\s*\{\s*source,\s*target,[\s\S]*?\},\s*showToast\s*\)/)
  })

  it('the inspector picker uses the real drag hook and its validator, with the safe toast hook', () => {
    const text = source(pickerPath)
    expect(text).toMatch(/useConnectGesture\s*\(/)
    expect(text).toMatch(/isValidConnection\s*\(/)
    expect(text).toMatch(/onConnect\s*\(/)
    expect(text).toMatch(/useShowToastSafe\s*\(/)
    expect(text).not.toMatch(/\buseShowToast\s*\(/)
  })
})

// Codex head review P1 (3b-ii): the external factor's advanced editor keeps an EDITABLE range (`setPriorRange`), so its
// notice must not call every technical field read-only. It names the range as a judgement, then "other" fields.
import { INSPECTOR_FACTOR_EXTERNAL_REASON } from '../useInspectorMutations'
describe('external factor notice is true of its editable range', () => {
  it('names the range, and only OTHER technical fields as read-only', () => {
    expect(INSPECTOR_FACTOR_EXTERNAL_REASON).toContain('A range you set here is a judgement for Olumi')
    expect(INSPECTOR_FACTOR_EXTERNAL_REASON).toContain('Other technical fields and the description are read-only')
    expect(INSPECTOR_FACTOR_EXTERNAL_REASON).not.toMatch(/(?<!Other )technical fields here are read-only/)
  })
})
