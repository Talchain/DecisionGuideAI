/**
 * R5 (the design lead's R3 look check, item 5): in the Summary, each option's finding sentence (core's chance-row `text`, R3) was drawn in
 * oversized type (about 18 px, just above the next option's heading): its line carried no type of its own and took the page's. It now wears
 * the panel's body type, the same as the row it follows. Fixture: core's european golden (its findings at 1dd2ca9).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewBriefBody } from '../ViewBrief'

afterEach(cleanup)
const european: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8'))

describe('the Summary\'s finding lines wear the panel\'s body type', () => {
  it('each finding under a chance row has the same type as that row', () => {
    const c = render(<ViewBriefBody model={european.model!} />).container
    const findings = [...c.querySelectorAll<HTMLElement>('[data-view$=".text"][data-view*=".rows."]')]
    expect(findings.length).toBeGreaterThan(0)
    for (const f of findings) {
      const at = f.dataset['view']!.replace(/\.text$/, ''), [card, , i] = at.split('.')
      const row = c.querySelector<HTMLElement>(`[data-view-brief-row="${card}.${i}"]`)!
      expect(f.className, at).toBe(row.className)
    }
  })
})
