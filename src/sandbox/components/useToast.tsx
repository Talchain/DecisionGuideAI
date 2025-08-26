import { useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const showToast = useCallback((message: string, type: 'error' | 'success' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  const Toast = toast ? (
    <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow z-50 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
      role="status" aria-live="polite">
      {toast.message}
    </div>
  ) : null;
  return { showToast, Toast };
}
