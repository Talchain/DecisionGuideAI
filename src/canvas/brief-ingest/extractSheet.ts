import { MAX_SHEET_ROWS, MAX_WORKBOOK_ROWS } from './limits'
import { isHeaderRow, openZip, plural } from './ooxml'
import { BriefIngestError, type Extraction, type Segment } from './types'

type XLSXModule = typeof import('xlsx')
type WorkBook = import('xlsx').WorkBook
type WorkSheet = import('xlsx').WorkSheet

const DAMAGED = "Olumi couldn't open this file. It may be damaged, or not the type its name says."

/**
 * Decodes CSV bytes as UTF-8, falling back to Windows-1252 when they are not
 * valid UTF-8. Excel in the UK often saves "£" as the single byte 0xA3; read as
 * UTF-8 that becomes "\uFFFD49" and the figure no longer matches the user's file.
 */
export function decodeCsv(bytes: ArrayBuffer): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes)
  }
  return text.replace(/^\uFEFF/, '')
}

export async function extractXlsx(bytes: ArrayBuffer): Promise<Extraction> {
  // Refuse a zip bomb before SheetJS inflates anything.
  await openZip(bytes)
  const XLSX = await import('xlsx')
  let wb: WorkBook
  try {
    wb = XLSX.read(bytes, {
      type: 'array',
      cellStyles: true, // needed for hidden rows and columns
      cellHTML: false,
      cellFormula: false,
      sheetRows: MAX_SHEET_ROWS + 1,
    })
  } catch {
    throw new BriefIngestError(DAMAGED)
  }
  return workbookToExtraction(XLSX, wb, null)
}

export async function extractCsv(bytes: ArrayBuffer, sheetName: string): Promise<Extraction> {
  const XLSX = await import('xlsx')
  let wb: WorkBook
  try {
    // raw: every value stays the text the file holds, never re-typed.
    wb = XLSX.read(decodeCsv(bytes), { type: 'string', raw: true, sheetRows: MAX_SHEET_ROWS + 1 })
  } catch {
    throw new BriefIngestError(DAMAGED)
  }
  return workbookToExtraction(XLSX, wb, sheetName)
}

function cellText(XLSX: XLSXModule, ws: WorkSheet, r: number, c: number): string {
  const cell = ws[XLSX.utils.encode_cell({ r, c })] as { w?: string; v?: unknown } | undefined
  if (!cell || cell.v === undefined || cell.v === null) return ''
  // `w` is the text as formatted in the file ("£49"), `v` the bare value.
  return (cell.w ?? String(cell.v)).replace(/\s+/g, ' ').trim()
}

function workbookToExtraction(XLSX: XLSXModule, wb: WorkBook, csvName: string | null): Extraction {
  const segments: Segment[] = []
  const notes: string[] = []
  let total = 0
  let readRows = 0
  let hiddenRows = 0
  let hiddenCols = 0

  wb.SheetNames.forEach((name, index) => {
    const ws = wb.Sheets[name]
    const label = csvName ?? name
    const hidden = wb.Workbook?.Sheets?.[index]?.Hidden
    if (hidden) {
      notes.push(`(hidden sheet "${label}" was not read)`)
      return
    }
    if (!ws || !ws['!ref']) return
    const full = XLSX.utils.decode_range((ws['!fullref'] as string | undefined) ?? ws['!ref'])
    const range = XLSX.utils.decode_range(ws['!ref'])
    const rowHidden = (r: number) => Boolean(ws['!rows']?.[r]?.hidden)
    const colHidden = (c: number) => Boolean(ws['!cols']?.[c]?.hidden)
    for (let c = range.s.c; c <= range.e.c; c++) if (colHidden(c)) hiddenCols++

    let header: string[] | null = null
    let headingDone = false
    let sheetRows = 0
    let lastReadRow = -1
    let sheetTotal = 0

    for (let r = range.s.r; r <= full.e.r; r++) {
      if (r > range.e.r) {
        sheetTotal++ // rows beyond the read window still count toward the total
        continue
      }
      if (rowHidden(r)) {
        hiddenRows++
        continue
      }
      const cols: number[] = []
      const cells: string[] = []
      for (let c = range.s.c; c <= range.e.c; c++) {
        if (colHidden(c)) continue
        const t = cellText(XLSX, ws, r, c)
        if (t !== '') {
          cols.push(c)
          cells.push(t)
        }
      }
      if (cells.length === 0) continue
      sheetTotal++
      if (readRows >= MAX_WORKBOOK_ROWS || sheetRows >= MAX_SHEET_ROWS) continue

      if (!headingDone) {
        segments.push({ marker: `Sheet "${label}"`, text: '', countable: false })
        headingDone = true
      }
      const first = XLSX.utils.encode_cell({ r, c: cols[0] })
      const last = XLSX.utils.encode_cell({ r, c: cols[cols.length - 1] })
      const marker = `Sheet "${label}" ${first === last ? first : `${first}:${last}`}`

      let text: string
      if (header === null && sheetRows === 0 && isHeaderRow(cells)) {
        const labels: string[] = []
        cols.forEach((c, i) => {
          labels[c] = cells[i]
        })
        header = labels
        text = `Columns: ${cells.join(' | ')}`
      } else if (cells.length === 1) {
        text = cells[0]
      } else {
        // The first filled cell labels the row; each value keeps its column header.
        const values = cols.slice(1).map((c, i) => {
          const h = header?.[c]
          return h ? `${h}: ${cells[i + 1]}` : cells[i + 1]
        })
        text = `${cells[0]}${header ? ' — ' : ': '}${values.join(' | ')}`
      }
      segments.push({ marker, text, countable: true })
      sheetRows++
      readRows++
      lastReadRow = r
    }
    total += sheetTotal
    if (sheetTotal > sheetRows && sheetRows > 0) {
      notes.push(
        `(Olumi read rows up to ${lastReadRow + 1} of "${label}" (${sheetRows} of ${sheetTotal} rows); the rest were not read)`,
      )
    } else if (sheetTotal > 0 && sheetRows === 0) {
      notes.push(`(sheet "${label}" was not read: the row limit was reached)`)
    }
  })

  if (hiddenRows > 0) notes.push(`(${hiddenRows} hidden ${plural(hiddenRows, 'row was', 'rows were')} not read)`)
  if (hiddenCols > 0) notes.push(`(${hiddenCols} hidden ${plural(hiddenCols, 'column was', 'columns were')} not read)`)
  return { segments, notes, noun: ['row', 'rows'], total }
}
