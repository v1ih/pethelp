import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getDashboardRouteForUserType, getSettingsRouteForUserType, type UserType } from './context/shared';
import { usePets } from './context/PetsContext';
import { useSession } from './context/SessionContext';

export function getPetContextRoute(userType?: UserType | null, hasCurrentPet?: boolean) {
  return hasCurrentPet ? '/pet-profile' : getDashboardRouteForUserType(userType);
}

export function useAppNavigation() {
  const navigate = useNavigate();
  const { logout, user } = useSession();
  const { currentPet } = usePets();

  const goToLogin = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  const goToDashboard = useCallback((userType: UserType | null | undefined = user?.userType) => {
    navigate(getDashboardRouteForUserType(userType), { replace: true });
  }, [navigate, user?.userType]);

  const goToSettings = useCallback((userType: UserType | null | undefined = user?.userType) => {
    navigate(getSettingsRouteForUserType(userType), { replace: true });
  }, [navigate, user?.userType]);

  const goToPetContext = useCallback(() => {
    navigate(getPetContextRoute(user?.userType, !!currentPet), { replace: true });
  }, [navigate, user?.userType, currentPet]);

  const confirmAndLogout = useCallback((message = 'Deseja realmente sair da conta?') => {
    if (!confirm(message)) return false;
    logout();
    goToLogin();
    return true;
  }, [goToLogin, logout]);

  return {
    goToLogin,
    goToDashboard,
    goToSettings,
    goToPetContext,
    confirmAndLogout,
  };
}

export function useDashboardBackLogout(message = 'Deseja realmente sair da conta?') {
  const { confirmAndLogout } = useAppNavigation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.history.pushState({ dashboardGuard: true }, '', window.location.href);

    const handlePopState = () => {
      confirmAndLogout(message);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [confirmAndLogout, message]);
}


