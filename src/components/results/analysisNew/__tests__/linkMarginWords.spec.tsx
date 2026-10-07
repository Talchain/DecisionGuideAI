import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, uncertaintyDerivedFindings } from './analysisNewFixtures'
import type { UncertaintyItem } from '../../types'
import { fragileEValueNote, linkMarginSentence } from '../../utils/fragileEdgeCopy'
import { humaniseCritique } from '../../utils/humaniseCritique'

const sentence = "How far this link's strength could be off before the comparison between options changes: about ×2.0."
const retiredFigureWords = /E-value|Change margin|evidence|confounding|robust/i

const findingFor = (eValue?: number) => {
  const uncertainty: UncertaintyItem = {
    code: 'SENSITIVE_ASSUMPTION',
    message: 'This relationship may change the comparison.',
    displayText: 'This relationship may change the comparison.',
    affectedNodes: ['from', 'to'],
    ...(eValue === undefined ? {} : { eValue }),
  }
  const data = makeData({ confidence: { evidenceGapsAssessed: true, uncertainties: [uncertainty] } })
  return uncertaintyDerivedFindings(buildAnalysisNewViewModel({
    data, recommendations: [], isPreRun: false, isRunning: false, isStale: false,
  }))[0]
}

describe('Link margin words', () => {
  it('formats the inspect row through the single sentence owner and omits an absent figure', () => {
    expect(findingFor(2.04).inspect.find(row => row.label === 'Link margin')).toEqual({
      label: 'Link margin', value: sentence,
    })
    expect(findingFor().inspect.find(row => row.label === 'Link margin')).toBeUndefined()
    expect(linkMarginSentence(2.04)).toBe(sentence)
  })

  it('uses the same words for the expert note and canvas inspector', () => {
    const note = fragileEValueNote({ eValue: 2.04, designationsWithheld: false, flipEvidenceAttestsNoFlip: false })
    expect(note).toBe(`Link margin. ${sentence}`)
    expect(note).not.toMatch(retiredFigureWords)

    const panel = readFileSync(resolve(process.cwd(), 'src/canvas/ui/inspector-v2/panels/EdgePanel.tsx'), 'utf8')
    expect(panel).toContain("{LINK_MARGIN_LABEL}. {linkMarginSentence(edgeEValue)}")
  })

  it.each([
    ['E_VALUES_UNAVAILABLE', 'Link margin analysis was skipped for time.'],
    ['STABILITY_BANDS_UNAVAILABLE', 'Flip-stability bands ride on the Link margin sweep'],
    ['EDGE_E_VALUE_NON_FINITE_DROPPED', 'absent from the Link margin list rather than empty'],
  ])('updates the %s description', (code, fragment) => {
    const copy = humaniseCritique({ code, message: 'diagnostic', displayText: 'diagnostic' })
    expect(copy.description).toContain(fragment)
    expect(copy.description).not.toMatch(retiredFigureWords)
  })

  it('kills the formatter mutant that restores the retired label', () => {
    expect(linkMarginSentence(2.04)).not.toContain('Change margin')
  })
})
