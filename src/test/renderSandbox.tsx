import React from 'react'
import { render } from '@testing-library/react'
import { FlagsProvider, SandboxFlags } from '@/lib/flags'
import { ThemeProvider } from '@/contexts/ThemeContext'

// Generic test render helper for Sandbox UI
// Additional providers (e.g., QueryClientProvider) can be added here if needed
export function renderSandbox(ui: React.ReactElement, flags?: Partial<SandboxFlags>) {
  return render(
    <ThemeProvider>
      <FlagsProvider value={flags}>{ui}</FlagsProvider>
    </ThemeProvider>
  )
}
