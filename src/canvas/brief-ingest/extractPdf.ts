import { MAX_UNITS } from './limits'
import { plural } from './ooxml'
import { BriefIngestError, type Extraction, type Segment } from './types'

export const PDF_NO_TEXT = "This PDF has no selectable text, so Olumi can't read it yet."
const NOT_A_PDF = "Olumi couldn't open this file as a PDF. It may be damaged, or not a PDF."
const PASSWORD = "This PDF is protected by a password, so Olumi can't read it."

/** The slice of a PDF that Olumi reads: the text layer, page by page. Never OCR. */
export interface PdfReader {
  numPages: number
  /** The page's text layer, with line breaks where the PDF ends a line. */
  pageText(pageNumber: number): Promise<string>
  /** How many pictures/charts the page paints (never read, only counted). */
  pagePictures(pageNumber: number): Promise<number>
  destroy(): Promise<void>
}

function tidy(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * Pages 1–40 become `[Page n]` segments. A page with no text layer is said to
 * be not read; a file with no text layer at all is refused with PDF_NO_TEXT.
 */
export async function readPdfPages(reader: PdfReader): Promise<Extraction> {
  const segments: Segment[] = []
  const blank: number[] = []
  const pictureNotes: string[] = []
  const last = Math.min(reader.numPages, MAX_UNITS)
  for (let n = 1; n <= last; n++) {
    const text = tidy(await reader.pageText(n))
    const pictures = await reader.pagePictures(n)
    if (!text) {
      blank.push(n)
      continue
    }
    segments.push({ marker: `Page ${n}`, text, unit: n, countable: true })
    if (pictures > 0) {
      pictureNotes.push(
        `(${pictures} ${plural(pictures, 'picture or chart', 'pictures or charts')} on Page ${n} ${plural(pictures, 'was', 'were')} not read)`,
      )
    }
  }
  if (segments.length === 0) throw new BriefIngestError(PDF_NO_TEXT)
  const notes = [...pictureNotes]
  if (blank.length > 0) {
    notes.unshift(
      `(${blank.length} ${plural(blank.length, 'page has', 'pages have')} no selectable text and ${plural(blank.length, 'was', 'were')} not read: ${blank.map((b) => `Page ${b}`).join(', ')})`,
    )
  }
  return {
    segments,
    notes,
    noun: ['page', 'pages'],
    total: reader.numPages,
    extra: blank.length > 0 ? `${blank.length} had no selectable text` : undefined,
    unitCapped: true,
  }
}

/**
 * Opens a PDF with pdf.js, configured for the live site's Content Security
 * Policy (no `unsafe-eval`, fonts only from self/Google): eval is off — which
 * also closes CVE-2024-4367's code path — and embedded fonts are never loaded.
 * The worker is a same-origin asset, loaded only when a PDF is chosen.
 */
export async function openPdf(bytes: ArrayBuffer): Promise<PdfReader> {
  const head = new TextDecoder('latin1').decode(new Uint8Array(bytes, 0, Math.min(1024, bytes.byteLength)))
  if (!head.includes('%PDF-')) throw new BriefIngestError(NOT_A_PDF)

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (typeof Worker !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerPort) {
    // Bundled by Vite (`?worker`), not copied: it goes through the same build
    // transforms as the app (console/debugger dropped) and is served same-origin.
    const { default: PdfWorker } = await import('pdfjs-dist/legacy/build/pdf.worker.mjs?worker')
    pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
  }
  const imageOps = new Set<number>([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintInlineImageXObject,
    pdfjs.OPS.paintImageMaskXObject,
  ])

  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(bytes.slice(0)),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      disableAutoFetch: true,
      disableStream: true,
      isOffscreenCanvasSupported: false,
    }).promise
  } catch (err) {
    if (err instanceof Error && err.name === 'PasswordException') throw new BriefIngestError(PASSWORD)
    throw new BriefIngestError(NOT_A_PDF)
  }

  return {
    numPages: doc.numPages,
    async pageText(n) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      let text = ''
      for (const item of content.items) {
        if (!('str' in item)) continue
        text += item.str
        text += item.hasEOL ? '\n' : ''
      }
      return text
    },
    async pagePictures(n) {
      const page = await doc.getPage(n)
      const ops = await page.getOperatorList()
      return ops.fnArray.filter((fn) => imageOps.has(fn)).length
    },
    destroy: () => doc.destroy(),
  }
}

export async function extractPdf(bytes: ArrayBuffer, open: (b: ArrayBuffer) => Promise<PdfReader> = openPdf): Promise<Extraction> {
  const reader = await open(bytes)
  try {
    return await readPdfPages(reader)
  } finally {
    await reader.destroy().catch(() => undefined)
  }
}
