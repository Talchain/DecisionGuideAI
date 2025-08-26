import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'draft';

interface ThemeContextType {
  theme: Theme;
  isDraft: boolean;
  toggleDraft: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const isDraft = theme === 'draft';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleDraft = () => {
    setTheme(prev => {
      const newTheme = prev === 'draft' ? 'light' : 'draft';
      console.log('Theme toggled:', { from: prev, to: newTheme, isDraft: newTheme === 'draft' });
      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, isDraft, toggleDraft }}>
      {children}
      {isDraft && (
        <div className="fixed bottom-4 right-4 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium shadow-lg z-50">
          Draft Mode
        </div>
      )}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
