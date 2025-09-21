// Flag-gated submit hook that populates ghost state. Behaviour-neutral while flag is OFF.
import { setGhost } from './state'
import { postDraftFlows } from './client'
import { flags } from '../flags'

export async function onSubmitDescribeDecision(parseText: string): Promise<void> {
  const seed = 1
  const text = (parseText ?? '').trim()
  if (!flags.plotLite.enabled || !text) return
  try {
    const resp = await postDraftFlows({ seed, parse_text: text })
    setGhost({ drafts: resp.drafts, lastSeed: seed, lastHash: resp.drafts[0]?.parse_json_hash })
  } catch {
    // swallow to keep behaviour identical
  }
}
