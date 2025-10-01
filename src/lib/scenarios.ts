// src/lib/scenarios.ts
import { deflateRaw, inflateRaw } from 'pako'

export type ScenarioV1 = { v: 1; id: string; name: string; desc?: string; seed: string; budget: string; model: string }
export type ScenarioStoreV1 = { version: 1; items: ScenarioV1[]; lastId?: string; remember?: boolean }

const LS_KEY = 'scenarios.v1'
const MAX_URL_PARAM_BYTES = 8 * 1024
const COMPRESS_THRESHOLD = 1500 // bytes

function readStore(): ScenarioStoreV1 {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { version: 1, items: [] }
    const parsed = JSON.parse(raw)
    // Migrate old record-map → array if needed
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.items == null) {
      const items = Object.values(parsed as Record<string, ScenarioV1>).filter(Boolean) as ScenarioV1[]
      return { version: 1, items }
    }
    if (parsed && parsed.version === 1 && Array.isArray(parsed.items)) return parsed as ScenarioStoreV1
  } catch {}
  return { version: 1, items: [] }
}

function writeStore(s: ScenarioStoreV1): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}

export function listScenarios(): ScenarioV1[] {
  return readStore().items.slice()
}

export function getScenarioById(id: string): ScenarioV1 | undefined {
  return readStore().items.find(x => x.id === id)
}

export function saveScenario(s: ScenarioV1): void {
  const store = readStore()
  const i = store.items.findIndex(x => x.id === s.id)
  if (i >= 0) store.items[i] = s
  else store.items.push(s)
  writeStore(store)
}

export function deleteScenario(id: string): void {
  const store = readStore()
  store.items = store.items.filter(x => x.id !== id)
  if (store.lastId === id) delete store.lastId
  writeStore(store)
}

export function getRemember(): boolean {
  const store = readStore()
  return !!store.remember
}
export function setRemember(v: boolean): void {
  const store = readStore()
  store.remember = !!v
  writeStore(store)
}
export function getLastId(): string | undefined {
  return readStore().lastId
}
export function setLastId(id?: string): void {
  const store = readStore()
  if (id) store.lastId = id
  else delete store.lastId
  writeStore(store)
}

// ---- Share codec (URL param) ----

type SharePayload = { v: 1; name: string; desc?: string; seed: string; budget: string; model: string }

function base64UrlEncode(bytes: Uint8Array): string {
  const b64 = (typeof btoa !== 'undefined')
    ? btoa(String.fromCharCode(...bytes))
    : Buffer.from(bytes).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecodeToBytes(param: string): Uint8Array {
  const b64 = param.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const rawStr = (typeof atob !== 'undefined')
    ? atob(b64 + pad)
    : Buffer.from(b64 + pad, 'base64').toString('binary')
  const out = new Uint8Array(rawStr.length)
  for (let i = 0; i < rawStr.length; i++) out[i] = rawStr.charCodeAt(i)
  return out
}

export function encodeScenarioToUrlParam(s: SharePayload): string {
  const json = JSON.stringify(s)
  const utf8 = new TextEncoder().encode(json)
  let param: string
  if (utf8.byteLength > COMPRESS_THRESHOLD) {
    const deflated = deflateRaw(utf8)
    param = 'z:' + base64UrlEncode(deflated)
  } else {
    param = base64UrlEncode(utf8)
  }
  if (param.length > MAX_URL_PARAM_BYTES) {
    throw new Error('Link too large; please use Export/Import JSON')
  }
  return param
}

export function tryDecodeScenarioParam(param: string): SharePayload | null {
  try {
    let bytes: Uint8Array
    if (param.startsWith('z:')) {
      const b = param.slice(2)
      bytes = inflateRaw(base64UrlDecodeToBytes(b))
    } else {
      bytes = base64UrlDecodeToBytes(param)
    }
    const obj = JSON.parse(new TextDecoder().decode(bytes))
    if (obj && obj.v === 1 && typeof obj.name === 'string') {
      return {
        v: 1,
        name: String(obj.name),
        desc: obj.desc ? String(obj.desc) : undefined,
        seed: String(obj.seed ?? ''),
        budget: String(obj.budget ?? ''),
        model: String(obj.model ?? '')
      }
    }
  } catch {}
  return null
}
