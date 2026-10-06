import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useBriefDocumentUpload, BRIEF_UPLOAD_COPY } from '../BriefDocumentUpload'

function Harness({ initial }: { initial: string }) {
  const [draft, setDraft] = useState(initial)
  const { trigger, feedback } = useBriefDocumentUpload({ draft, setDraft })
  return (
    <>
      <div data-testid="box">
        <textarea aria-label="brief" value={draft} onChange={(e) => setDraft(e.target.value)} />
        {trigger}
      </div>
      {feedback}
    </>
  )
}

const brief = () => screen.getByLabelText<HTMLTextAreaElement>('brief')
const choose = (file: File) =>
  fireEvent.change(screen.getByLabelText(BRIEF_UPLOAD_COPY.label), { target: { files: [file] } })

describe('BriefDocumentUpload', () => {
  it('is a real labelled file input, one file at a time', () => {
    render(<Harness initial="" />)
    const input = screen.getByLabelText<HTMLInputElement>(BRIEF_UPLOAD_COPY.label)
    expect(input.type).toBe('file')
    expect(input.multiple).toBe(false)
    expect(input.accept).toBe('.xlsx,.csv,.pptx,.docx')
    expect(screen.getByText(BRIEF_UPLOAD_COPY.privacy)).toBeTruthy()
  })

  it('is an icon inside the box, with its name for screen readers and a hover hint', () => {
    render(<Harness initial="" />)
    const trigger = screen.getByTestId('brief-document-trigger')
    expect(screen.getByTestId('box').contains(trigger)).toBe(true)
    expect(trigger.getAttribute('title')).toBe(BRIEF_UPLOAD_COPY.hint)
    expect(trigger.querySelector('svg')).not.toBeNull()
  })

  it('appends the file’s text to what the user wrote, and can remove exactly that', async () => {
    render(<Harness initial="Should we raise prices?" />)
    choose(new File(['Starter price,£49\n'], 'prices.csv'))
    await waitFor(() =>
      expect(brief().value).toBe('Should we raise prices?\n\nFrom prices.csv:\n[Sheet "prices"]\n[Sheet "prices" A1:B1] Starter price: £49'),
    )
    expect(screen.getByRole('status').textContent).toBe(`Olumi read 1 of 1 row. ${BRIEF_UPLOAD_COPY.check}`)

    fireEvent.click(screen.getByText(BRIEF_UPLOAD_COPY.remove))
    expect(brief().value).toBe('Should we raise prices?')
  })

  it('announces an error', async () => {
    render(<Harness initial="" />)
    choose(new File(['x'], 'notes.txt'))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Olumi can read .xlsx, .csv, .pptx and .docx files.'),
    )
    expect(brief().value).toBe('')
  })
})
