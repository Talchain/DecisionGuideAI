/**
 * Craft pass (8 Nov, Paul's visual gate): the Analysis panel puts the options straight under core's lead, which introduces them (it
 * ends with a colon), and core's which-option-leads line after them. The grade found that line pushing the options below the fold.
 * Core's words are unchanged; this binds order only, by identity. Core-produced Views: the bakery golden and the AN-01 studio fixture.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { viewOf } from './viewAt'

const put = (view: View) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
afterEach(cleanup)

describe('the Analysis panel: core\'s lead, then the options, then which option leads', () => {
  for (const n of ['golden/bakery', 'core/an01-studio'] as const) {
    it(`${n}: lead before the first option row; every option row before core's most-likely line; each said once`, () => {
      const view = viewOf(n), run = view.model!.run!
      expect([typeof run.lead, typeof run.most_likely?.text]).toEqual(['string', 'string'])
      put(view); render(<PortAnalysisTab />)
      const lead = document.querySelectorAll('[data-view="run.lead"]'), ml = document.querySelectorAll('[data-view="run.most_likely.text"]')
      expect([lead.length, ml.length]).toEqual([1, 1])
      expect(ml[0]!.textContent).toBe(run.most_likely!.text)
      const rows = [...document.querySelectorAll('[data-testid="port-option-row"]')]
      expect(rows.length).toBeGreaterThan(1)
      expect(before(lead[0]!, rows[0]!)).toBe(true)
      for (const r of rows) expect(before(r, ml[0]!)).toBe(true)
    })
  }
})
