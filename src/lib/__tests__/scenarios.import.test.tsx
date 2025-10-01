import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mockFlags } from '../../tests/__helpers__/mockFlags'

function setUrl(path: string) {
  try { history.replaceState(null, '', path) } catch {}
}

describe('Scenarios import via URL param', () => {
  beforeEach(() => {
    try { localStorage.clear() } catch {}
  })

  it('Flag ON: importing scenario updates seed/model/budget and shows chip; malformed shows note', async () => {
    mockFlags({ isSseEnabled: () => true, isParamsEnabled: () => true, isScenariosEnabled: () => true })
    const json = { v: 1, name: 'Shared', seed: '444', budget: '2.5', model: 'gpt-4o-mini' }
    const param = (globalThis as any).btoa ? (globalThis as any).btoa(JSON.stringify(json)) : Buffer.from(JSON.stringify(json), 'utf-8').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    setUrl(`/?e2e=1#/sandbox&scenario=${param}`)

    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    // Params should reflect imported
    const seed = await screen.findByTestId('param-seed') as HTMLInputElement
    const budget = screen.getByTestId('param-budget') as HTMLInputElement
    const model = screen.getByTestId('param-model') as HTMLSelectElement
    expect(seed.value).toBe('444')
    expect(budget.value).toBe('2.5')
    expect(model.value).toBe('gpt-4o-mini')
    expect(await screen.findByTestId('scenario-chip')).toBeTruthy()

    // Malformed
    setUrl('/?e2e=1#/sandbox&scenario=not-base64')
    const { default: SandboxStreamPanel2 } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel2 />)
    expect(await screen.findByTestId('scenario-import-note')).toBeTruthy()
  })
})
