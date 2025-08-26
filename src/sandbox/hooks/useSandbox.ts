import { useEffect } from 'react';
import { isSandboxEnabled, initializeSandbox, cleanupSandbox } from '..';

export function useSandbox() {
  useEffect(() => {
    if (isSandboxEnabled) {
      initializeSandbox();
      
      return () => {
        cleanupSandbox();
      };
    }
  }, []);
  
  return { isEnabled: isSandboxEnabled };
}
