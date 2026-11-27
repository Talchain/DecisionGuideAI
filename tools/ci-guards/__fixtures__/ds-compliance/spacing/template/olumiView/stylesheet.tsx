const stylesheet = (selector: string, inset: number, extra: string) => `
  ${selector} {
    /* padding: 90px; */
    padding-bottom: 22px;
    margin: calc(${inset}px + 4px);
    row-gap: var(--space-2);
    column-gap: 1px;
    ${extra}
    gap:
      6px;
  }
`

export const CardStyles = () => <style>{stylesheet('.card', 4, 'position: relative;')}{`.option { margin-left: -4px }`}</style>
