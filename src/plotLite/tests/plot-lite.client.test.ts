/// <reference types="vitest" />
import { beforeEach, expect, test, vi } from 'vitest'
import { postDraftFlows } from '../client'

beforeEach(() => {
  ;(global as any).fetch = vi.fn(async () => ({ ok: true, json: async () => ({ drafts: [] }) }))
})

test('uses base URL and posts body', async () => {
  ;(import.meta as any).env = { VITE_PLOT_LITE_BASE_URL: '/plot-lite' }
  await postDraftFlows({ seed: 1, parse_text: 'test' })
  expect(global.fetch).toHaveBeenCalledWith(
    '/plot-lite/draft-flows',
    expect.objectContaining({ method: 'POST' })
  )
})
