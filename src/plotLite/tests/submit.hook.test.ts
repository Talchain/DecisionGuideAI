/// <reference types="vitest" />
import { beforeEach, expect, test, vi } from 'vitest'
import * as client from '../client'
import { flags } from '../../flags'
import { onSubmitDescribeDecision } from '../submit'

beforeEach(() => {
  ;(flags as any).plotLite.enabled = true
  vi.spyOn(client, 'postDraftFlows').mockResolvedValue({ drafts: [] } as any)
})

test('calls postDraftFlows when flag is enabled and text provided', async () => {
  await onSubmitDescribeDecision("We’re considering a price rise")
  expect(client.postDraftFlows).toHaveBeenCalledWith(
    expect.objectContaining({
      seed: expect.any(Number),
      parse_text: expect.stringContaining('price rise'),
    })
  )
})

test('does not call postDraftFlows for empty text', async () => {
  ;(client.postDraftFlows as any).mockClear()
  await onSubmitDescribeDecision('   ')
  expect(client.postDraftFlows).not.toHaveBeenCalled()
})
