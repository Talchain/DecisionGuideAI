import { all, isHeaderRow, kids, openZip, parseXml, plural, readPart, withHeaders } from './ooxml'
import { BriefIngestError, type Extraction, type Segment } from './types'

interface Tally {
  hiddenText: boolean
  drawings: number
}

/** A run is hidden when its properties carry w:vanish (not w:vanish w:val="0"). */
function isHiddenRun(run: Element): boolean {
  const rPr = kids(run, 'rPr')[0]
  const vanish = rPr ? kids(rPr, 'vanish')[0] : undefined
  if (!vanish) return false
  const val = vanish.getAttribute('w:val') ?? vanish.getAttributeNS(vanish.namespaceURI, 'val')
  return val !== '0' && val !== 'false'
}

function paragraphText(p: Element, tally: Tally): string {
  let text = ''
  for (const run of all(p, 'r')) {
    const pieces = kids(run)
      .map((k) => (k.localName === 't' ? k.textContent ?? '' : k.localName === 'tab' ? ' ' : ''))
      .join('')
    if (isHiddenRun(run)) {
      if (pieces.trim()) tally.hiddenText = true
      continue
    }
    text += pieces
  }
  tally.drawings += all(p, 'drawing').length + all(p, 'pict').length + all(p, 'object').length
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Body paragraphs in document order, and tables row by row with each value
 * written under its column header. Hidden text, pictures and charts are said
 * to be "not read".
 */
export async function extractDocx(bytes: ArrayBuffer): Promise<Extraction> {
  const zip = await openZip(bytes)
  const xml = await readPart(zip, 'word/document.xml')
  if (!xml) throw new BriefIngestError("Olumi couldn't open this file. It may be damaged, or not the type its name says.")
  const body = all(parseXml(xml), 'body')[0]
  const segments: Segment[] = []
  const tally: Tally = { hiddenText: false, drawings: 0 }
  let paragraphs = 0
  let tables = 0

  const walk = (parent: Element) => {
    for (const el of kids(parent)) {
      if (el.localName === 'p') {
        const text = paragraphText(el, tally)
        if (!text) continue
        paragraphs++
        segments.push({ marker: `Paragraph ${paragraphs}`, text, countable: true })
      } else if (el.localName === 'tbl') {
        tables++
        let header: string[] | null = null
        kids(el, 'tr').forEach((tr, i) => {
          const cells = kids(tr, 'tc').map((tc) =>
            all(tc, 'p')
              .map((p) => paragraphText(p, tally))
              .filter(Boolean)
              .join(' '),
          )
          if (cells.every((c) => c === '')) return
          if (i === 0 && isHeaderRow(cells)) header = cells
          const text = header && i === 0 ? cells.join(' | ') : withHeaders(cells, header)
          segments.push({ marker: `Table ${tables}, row ${i + 1}`, text, countable: true })
        })
      } else if (el.localName === 'sdt') {
        const content = kids(el, 'sdtContent')[0]
        if (content) walk(content)
      }
    }
  }
  if (body) walk(body)

  const notes: string[] = []
  if (tally.drawings > 0) {
    notes.push(`(${tally.drawings} ${plural(tally.drawings, 'picture or chart was', 'pictures or charts were')} not read)`)
  }
  if (tally.hiddenText) notes.push('(hidden text was not read)')
  return { segments, notes, noun: 'paragraphs and table rows', total: segments.length }
}
