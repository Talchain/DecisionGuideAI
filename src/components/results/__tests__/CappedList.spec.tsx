import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CappedList } from '../CappedList'

interface TestItem {
  id: string
  label: string
}

describe('CappedList', () => {
  const testItems: TestItem[] = [
    { id: 'a', label: 'Item A' },
    { id: 'b', label: 'Item B' },
    { id: 'c', label: 'Item C' },
    { id: 'd', label: 'Item D' },
  ]

  it('should render correctly with getKey prop', () => {
    render(
      <CappedList<TestItem>
        items={testItems}
        maxVisible={2}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
      />
    )

    expect(screen.getByText('Item A')).toBeInTheDocument()
    expect(screen.getByText('Item B')).toBeInTheDocument()
    expect(screen.queryByText('Item C')).not.toBeInTheDocument()
  })

  it('should render correctly without getKey (backward compatible)', () => {
    render(
      <CappedList<TestItem>
        items={testItems}
        maxVisible={2}
        renderItem={(item) => <span>{item.label}</span>}
      />
    )

    expect(screen.getByText('Item A')).toBeInTheDocument()
    expect(screen.getByText('Item B')).toBeInTheDocument()
  })

  it('should expand to show all items', () => {
    render(
      <CappedList<TestItem>
        items={testItems}
        maxVisible={2}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
      />
    )

    // Initially only 2 visible
    expect(screen.queryByText('Item C')).not.toBeInTheDocument()
    expect(screen.queryByText('Item D')).not.toBeInTheDocument()

    // Click expand
    fireEvent.click(screen.getByRole('button'))

    // Now all visible
    expect(screen.getByText('Item C')).toBeInTheDocument()
    expect(screen.getByText('Item D')).toBeInTheDocument()
  })

  it('should show overflow count', () => {
    render(
      <CappedList<TestItem>
        items={testItems}
        maxVisible={2}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
      />
    )

    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('should show empty message when no items', () => {
    render(
      <CappedList<TestItem>
        items={[]}
        maxVisible={3}
        renderItem={(item) => <span>{item.label}</span>}
        emptyMessage="No items available"
      />
    )

    expect(screen.getByText('No items available')).toBeInTheDocument()
  })
})
