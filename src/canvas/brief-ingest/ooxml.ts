import { MAX_UNZIPPED_BYTES } from './limits'
import { BriefIngestError } from './types'

import type JSZip from 'jszip'

type Zip = JSZip

const DAMAGED = "Olumi couldn't open this file. It may be damaged, or not the type its name says."

/**
 * Opens an Office file's zip WITHOUT inflating anything: only the central
 * directory is read, so the declared expanded size can be refused before any
 * part (and never an image or media part) is decompressed.
 */
export async function openZip(bytes: ArrayBuffer): Promise<Zip> {
  const { default: JSZipCtor } = await import('jszip')
  let zip: Zip
  try {
    zip = await JSZipCtor.loadAsync(bytes)
  } catch {
    throw new BriefIngestError(DAMAGED)
  }
  let declared = 0
  zip.forEach((_path: string, entry: JSZip.JSZipObject) => {
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
    declared += typeof size === 'number' ? size : 0
  })
  if (declared > MAX_UNZIPPED_BYTES) {
    throw new BriefIngestError('This file expands to more than 50 MB, so Olumi can’t read it.')
  }
  return zip
}

/** Reads one named XML part as text, or null when the part is absent. */
export async function readPart(zip: Zip, path: string): Promise<string | null> {
  const entry = zip.file(path)
  return entry ? entry.async('string') : null
}

export function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) throw new BriefIngestError(DAMAGED)
  return doc
}

/** Descendants by local name, any namespace, in document order. */
export function all(node: Element | Document, local: string): Element[] {
  return Array.from(node.getElementsByTagNameNS('*', local))
}

/** Direct children by local name. */
export function kids(node: Element, local?: string): Element[] {
  return Array.from(node.children).filter((c) => local === undefined || c.localName === local)
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** "a | b" table row; the first row is a header when it reads as labels. */
export function looksNumeric(value: string): boolean {
  return /^[-+(]?\s*[£$€¥]?\s*[\d.,]+\s*(%|[kKmMbB]n?)?\)?$/.test(value.trim())
}

export function isHeaderRow(cells: string[]): boolean {
  const filled = cells.filter((c) => c.trim() !== '')
  return filled.length >= 2 && filled.every((c) => !looksNumeric(c))
}

/** Writes each value with its column header, so no figure loses its column. */
export function withHeaders(cells: string[], header: string[] | null): string {
  if (!header) return cells.filter((c) => c !== '').join(' | ')
  return cells
    .map((c, i) => (c === '' ? '' : header[i] ? `${header[i]}: ${c}` : c))
    .filter((c) => c !== '')
    .join(' | ')
}
