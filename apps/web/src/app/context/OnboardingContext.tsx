import * as React from 'react';
import { useSession } from './SessionContext';
import OnboardingModal from '../components/onboarding/OnboardingModal';
import type { UserType } from './shared';

type OnboardingContextValue = {
  /** Reabre o tutorial/ajuda a qualquer momento (usado pelo botão "?"). */
  openHelp: () => void;
};

const OnboardingContext = React.createContext<OnboardingContextValue>({ openHelp: () => {} });

export function useOnboarding() {
  return React.useContext(OnboardingContext);
}

function storageKey(userId?: string | null) {
  return userId ? `pethelp-onboarded:${userId}` : null;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, authReady } = useSession();
  const [open, setOpen] = React.useState(false);
  const userType = (user?.userType ?? 'owner') as UserType;

  // Abre o tutorial automaticamente na primeira vez que cada usuário entra.
  React.useEffect(() => {
    if (!authReady || !isAuthenticated || !user?.id) return;
    const key = storageKey(user.id);
    if (!key) return;
    let seen = false;
    try {
      seen = localStorage.getItem(key) === '1';
    } catch {
      seen = false;
    }
    if (!seen) setOpen(true);
  }, [authReady, isAuthenticated, user?.id]);

  const markSeen = React.useCallback(() => {
    const key = storageKey(user?.id);
    if (!key) return;
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* ignora indisponibilidade do localStorage */
    }
  }, [user?.id]);

  const openHelp = React.useCallback(() => setOpen(true), []);

  const handleClose = React.useCallback(() => {
    setOpen(false);
    markSeen();
  }, [markSeen]);

  return (
    <OnboardingContext.Provider value={{ openHelp }}>
      {children}
      {isAuthenticated ? <OnboardingModal open={open} userType={userType} onClose={handleClose} /> : null}
    </OnboardingContext.Provider>
  );
}
