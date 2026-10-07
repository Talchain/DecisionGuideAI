import { assembleBrief, type AssembledBrief } from './assemble'
import { MAX_FILE_BYTES } from './limits'
import { cleanFilename } from './cleanFilename'
import { BriefIngestError, type Extraction } from './types'

export { BriefIngestError } from './types'
export { ACCEPT_ATTRIBUTE } from './limits'
export type { AssembledBrief } from './assemble'
export { assembleBrief } from './assemble'

async function readBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Reads ONE file entirely in the browser into located segments. Nothing is
 * uploaded: the parsers load on demand (dynamic import) and run on this
 * device. Every thrown message is written for the user.
 */
export async function extractBriefDocument(file: File): Promise<Extraction> {
  if (file.size > MAX_FILE_BYTES) {
    throw new BriefIngestError('This file is over 10 MB, so Olumi can’t read it.')
  }
  const ext = (file.name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase()
  try {
    const bytes = await readBytes(file)
    let extraction: Extraction
    switch (ext) {
      case '.xlsx': {
        const { extractXlsx } = await import('./extractSheet')
        extraction = await extractXlsx(bytes)
        break
      }
      case '.csv': {
        const { extractCsv } = await import('./extractSheet')
        extraction = await extractCsv(bytes, cleanFilename(file.name).replace(/\.[^.]+$/, ''))
        break
      }
      case '.pptx': {
        const { extractPptx } = await import('./extractPptx')
        extraction = await extractPptx(bytes)
        break
      }
      case '.docx': {
        const { extractDocx } = await import('./extractDocx')
        extraction = await extractDocx(bytes)
        break
      }
      case '.pdf': {
        const { extractPdf } = await import('./extractPdf')
        extraction = await extractPdf(bytes)
        break
      }
      default:
        throw new BriefIngestError('Olumi can read .xlsx, .csv, .pptx, .docx and .pdf files.')
    }
    return extraction
  } catch (err) {
    if (err instanceof BriefIngestError) throw err
    throw new BriefIngestError("Olumi couldn't open this file. It may be damaged, or not the type its name says.")
  }
}

/** Reads a file and appends it to `existing` (extract + assemble in one step). */
export async function readBriefDocument(file: File, existing: string): Promise<AssembledBrief> {
  return assembleBrief(existing, file.name, await extractBriefDocument(file))
}
