import '@testing-library/jest-dom/vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useViewStore } from '../../../store'
import { LoopDots } from '../LoopDots'
import { PanelLevel } from '../PanelLevel'
import { ExplainButton, StatusRow } from '../StatusRow'

afterEach(() => {
  cleanup()
  useViewStore.setState({ panelLevels: { reasoning: 'glance' }, explanationReturn: null })
})

it('keeps literal font sizes and inline styles out of chart primitives and their CSS rules', () => {
  const dir = 'src/olumiView/v12/charts'
  const files = readdirSync(dir).filter((name) => name.endsWith('.tsx'))
  expect(files.sort()).toEqual(['KindName.tsx', 'LoopDots.tsx', 'PanelLevel.tsx', 'StatusRow.tsx'])
  for (const name of files) {
    const source = readFileSync(`${dir}/${name}`, 'utf8')
    expect(source, name).not.toMatch(/\bstyle\s*=|font[Ss]ize|font-size|\btext-(?:\[|xs\b|sm\b|base\b|lg\b|xl\b)/)
    if (name !== 'LoopDots.tsx') expect(source, name).toMatch(/\btypography\.viewPanel\w+\b/)
  }
  const css = readFileSync('src/olumiView/look/olumiLook.css', 'utf8')
  for (const rule of css.matchAll(/[^{}]*\.ok-loop-[^{}]*\{([^}]*)\}/g)) {
    expect(rule[1]).not.toMatch(/font-size\s*:/)
  }
})

it('makes all four loop states readable and leaves the marks out of the tab order', () => {
  render(<LoopDots steps={[true, false, true, false]} />)
  const marks = screen.getByRole('img', { name: 'Assumption: present, Evidence: open, Examined: present, Next: open' })
  expect(marks).not.toHaveAttribute('tabindex')
  expect([...marks.children].map((e) => e.getAttribute('data-complete'))).toEqual(['true', 'false', 'true', 'false'])
})

it('tabs through the level and explanation controls and remembers the chosen level across mounts', async () => {
  const user = userEvent.setup()
  const view = render(<><PanelLevel panel="reasoning" /><dl>
    <StatusRow label="Evidence" icon="file-read" value="No evidence linked"
      explain={<ExplainButton label="Explain evidence for churn" passage="evidence" onExplain={() => {}} />} />
  </dl></>)
  await user.tab()
  expect(screen.getByRole('button', { name: 'Glance' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Detail' })).toHaveFocus()
  await user.keyboard('{Enter}')
  await user.tab()
  expect(screen.getByRole('button', { name: 'Explain evidence for churn' })).toHaveFocus()
  view.unmount()
  render(<PanelLevel panel="reasoning" />)
  expect(screen.getByRole('button', { name: 'Detail' })).toHaveAttribute('aria-pressed', 'true')
})
