import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface GuestData {
  decisions: any[];
  preferences: Record<string, any>;
}

interface GuestContextType {
  guestId: string | null;
  guestData: GuestData;
  saveGuestData: (data: Partial<GuestData>) => void;
  clearGuestData: () => void;
  isGuest: boolean;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestData, setGuestData] = useState<GuestData>({ decisions: [], preferences: {} });

  useEffect(() => {
    // Initialize guest session
    const storedGuestId = localStorage.getItem('guestId');
    const storedData = localStorage.getItem('guestData');

    if (storedGuestId) {
      setGuestId(storedGuestId);
      if (storedData) {
        setGuestData(JSON.parse(storedData));
      }
    } else {
      const newGuestId = uuidv4();
      setGuestId(newGuestId);
      localStorage.setItem('guestId', newGuestId);
    }
  }, []);

  const saveGuestData = (data: Partial<GuestData>) => {
    setGuestData(prev => {
      const newData = { ...prev, ...data };
      localStorage.setItem('guestData', JSON.stringify(newData));
      return newData;
    });
  };

  const clearGuestData = () => {
    localStorage.removeItem('guestId');
    localStorage.removeItem('guestData');
    setGuestId(null);
    setGuestData({ decisions: [], preferences: {} });
  };

  return (
    <GuestContext.Provider value={{
      guestId,
      guestData,
      saveGuestData,
      clearGuestData,
      isGuest: true
    }}>
      {children}
    </GuestContext.Provider>
  );
}

function useGuest() {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return context;
}