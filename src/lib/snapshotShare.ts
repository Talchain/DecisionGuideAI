// src/lib/snapshotShare.ts
import { deflateRaw, inflateRaw } from 'pako'

export type SnapshotSharePayloadV1 = { v: 1; seed: string; model: string; data: any }

const MAX_URL_PARAM_BYTES = 8 * 1024
const COMPRESS_THRESHOLD = 1500 // bytes

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

export function encodeSnapshotToUrlParam(p: SnapshotSharePayloadV1): string {
  const json = JSON.stringify(p)
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

export function tryDecodeSnapshotParam(param: string): SnapshotSharePayloadV1 | null {
  try {
    let bytes: Uint8Array
    if (param.startsWith('z:')) {
      const b = param.slice(2)
      bytes = inflateRaw(base64UrlDecodeToBytes(b))
    } else {
      bytes = base64UrlDecodeToBytes(param)
    }
    const obj = JSON.parse(new TextDecoder().decode(bytes))
    if (obj && obj.v === 1 && obj.data != null) {
      return {
        v: 1,
        seed: String(obj.seed ?? ''),
        model: String(obj.model ?? ''),
        data: obj.data,
      }
    }
  } catch {}
  return null
}
