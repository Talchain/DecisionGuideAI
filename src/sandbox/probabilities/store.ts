import * as Y from 'yjs'

export type ConfidenceRecord = { conf: number; updatedAt: number }

const local: Map<string, Map<string, ConfidenceRecord>> = new Map()

function ensureLocal(decisionId: string): Map<string, ConfidenceRecord> {
  let m = local.get(decisionId)
  if (!m) { m = new Map(); local.set(decisionId, m) }
  return m
}

// Optional context to reach a Yjs doc when available
type Ctx = { doc?: Y.Doc | null }

export function getConfidence(decisionId: string, optionId: string, ctx?: Ctx): ConfidenceRecord | null {
  const d = ctx?.doc
  try {
    if (d) {
      const mock = d.getMap('sandboxMock') as Y.Map<unknown>
      const yProbs = mock.get('probRows') as Y.Array<Y.Map<unknown>>
      if (yProbs) {
        const item = yProbs.toArray().find(m => m.get('id') === optionId)
        if (item) {
          const conf = Number(item.get('conf')) || 1
          const updatedAt = Number(item.get('updatedAt')) || Date.now()
          return { conf, updatedAt }
        }
      }
    }
  } catch {}
  const m = local.get(decisionId)
  if (m && m.has(optionId)) return m.get(optionId)!
  return null
}

export function setConfidence(decisionId: string, optionId: string, conf: number, updatedAt = Date.now(), ctx?: Ctx): void {
  const d = ctx?.doc
  try {
    if (d) {
      const mock = d.getMap('sandboxMock') as Y.Map<unknown>
      let yProbs = mock.get('probRows') as Y.Array<Y.Map<unknown>>
      if (!yProbs) {
        yProbs = new Y.Array<Y.Map<unknown>>()
        mock.set('probRows', yProbs)
      }
      const list = yProbs.toArray()
      const idx = list.findIndex(m => m.get('id') === optionId)
      if (idx >= 0) {
        list[idx].set('conf', conf)
        list[idx].set('updatedAt', updatedAt)
      } else {
        const m = new Y.Map<unknown>()
        m.set('id', optionId); m.set('conf', conf); m.set('updatedAt', updatedAt)
        yProbs.push([m])
      }
      return
    }
  } catch {}
  const m = ensureLocal(decisionId)
  m.set(optionId, { conf, updatedAt })
}
