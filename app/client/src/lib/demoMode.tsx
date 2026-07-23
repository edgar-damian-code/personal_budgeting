import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// Demo mode is a client-only presentation toggle: when on, real analytics rows are
// pseudonymized in the browser (see lib/demoData.ts) so the app can be shown off
// without exposing real finances. Persisted to localStorage so it survives reloads.
const STORAGE_KEY = 'hod.demoMode';

type DemoModeContextValue = {
  demoMode: boolean;
  setDemoMode: (on: boolean) => void;
  toggleDemoMode: () => void;
};

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

function readInitial(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState<boolean>(readInitial);

  const setDemoMode = useCallback((on: boolean) => {
    setDemoModeState(on);
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false');
    } catch {
      // Ignore persistence failures (private browsing, storage disabled).
    }
  }, []);

  const toggleDemoMode = useCallback(() => setDemoMode(!demoMode), [demoMode, setDemoMode]);

  // Mirror the flag onto <html> so a `[data-demo]` styling hook is available if wanted.
  useEffect(() => {
    const root = document.documentElement;
    if (demoMode) root.setAttribute('data-demo', 'true');
    else root.removeAttribute('data-demo');
  }, [demoMode]);

  const value = useMemo(
    () => ({ demoMode, setDemoMode, toggleDemoMode }),
    [demoMode, setDemoMode, toggleDemoMode],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error('useDemoMode must be used within a DemoModeProvider');
  return ctx;
}
