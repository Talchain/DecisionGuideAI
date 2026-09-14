/**
 * THE ONE CALL SITE THAT MATTERS MUST SUPPLY `hasCompletedFirstRun`.
 *
 * `ComposeAnalysisStateInput.hasCompletedFirstRun` is OPTIONAL, defaulting to
 * `true`, so that ~50 existing fixtures keep their behaviour rather than being
 * mass-edited. That default is safe for a FIXTURE and unsafe for the PRODUCT: if
 * `useAnalysisState` ever stopped passing it, every surface would silently go
 * back to claiming a never-run model had changed, and no test would fail —
 * exactly the "a call site can forget" hazard `importHold` is required to avoid.
 *
 * This is the guard that closes it, and it is why the field could be optional at
 * all. Derivation proves agreement between call sites and never that the set of
 * call sites is complete (trap 12d), so this asserts the ONE site by name.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(__dirname, '..', 'analysisStateSelector.ts'), 'utf8')

describe('useAnalysisState supplies the run fact', () => {
  it('subscribes to hasCompletedFirstRun from the store', () => {
    expect(SRC).toMatch(/useCanvasStore\(\(s\) => s\.hasCompletedFirstRun\)/)
  })

  it('passes it into composeAnalysisState', () => {
    const call = SRC.slice(SRC.indexOf('export function useAnalysisState'))
    expect(call).toContain('hasCompletedFirstRun,')
  })

  it('keeps it in the memo dependency list, so a completed run recomputes', () => {
    // Without this the value freezes at mount and the panel goes on saying the
    // model has never been analysed AFTER the first run completes.
    const memoDeps = SRC.slice(SRC.lastIndexOf('    ['), SRC.lastIndexOf('    ],'))
    expect(memoDeps).toContain('hasCompletedFirstRun')
  })

  it('CONTRAST CONTROL: the same scan sees a sibling that is genuinely present', () => {
    // Proves the scan can see SOMETHING — an absence assertion over a source
    // file is worthless without one.
    expect(SRC).toMatch(/useCanvasStore\(\(s\) => s\.analysisFreshnessDirty\)/)
  })
})
