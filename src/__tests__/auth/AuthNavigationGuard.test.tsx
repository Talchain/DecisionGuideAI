import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthNavigationGuard } from '@/components/auth/AuthNavigationGuard';
import { AuthProvider } from '@/contexts/AuthContext';

const TestHome = () => <div data-testid="home">Home</div>;
const TestSandbox = () => <div data-testid="sandbox">Sandbox</div>;

describe('AuthNavigationGuard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('allows access to sandbox with valid access token', () => {
    // Set up valid access
    window.localStorage.setItem('dga_access_validated', 'true');
    
    render(
      <MemoryRouter initialEntries={['/sandbox']}>
        <AuthProvider>
          <AuthNavigationGuard>
            <Routes>
              <Route path="/" element={<TestHome />} />
              <Route path="/sandbox" element={<TestSandbox />} />
            </Routes>
          </AuthNavigationGuard>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('sandbox')).toBeInTheDocument();
  });

  it('redirects to home when no access token', () => {
    render(
      <MemoryRouter initialEntries={['/sandbox']}>
        <AuthProvider>
          <AuthNavigationGuard>
            <Routes>
              <Route path="/" element={<TestHome />} />
              <Route path="/sandbox" element={<TestSandbox />} />
            </Routes>
          </AuthNavigationGuard>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('home')).toBeInTheDocument();
  });
});
