import type { ComponentType, ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { getDashboardRouteForUserType, type UserType } from './context/shared';
import { useSession } from './context/SessionContext';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import OwnerDashboardScreen from './screens/OwnerDashboardScreen';
import ClinicDashboardScreen from './screens/ClinicDashboardScreen';
import ClinicAgendaScreen from './screens/ClinicAgendaScreen';
import ClinicHistoryScreen from './screens/ClinicHistoryScreen';
import VeterinarianDashboardScreen from './screens/VeterinarianDashboardScreen';
import VeterinarianScheduleScreen from './screens/VeterinarianScheduleScreen';
import PetRegistrationScreen from './screens/PetRegistrationScreen';
import PetProfileScreen from './screens/PetProfileScreen';
import PetTransferScreen from './screens/PetTransferScreen';
import MedicalHistoryScreen from './screens/MedicalHistoryScreen';
import VaccinationScreen from './screens/VaccinationScreen';
import ExamsScreen from './screens/ExamsScreen';
import AppointmentsScreen from './screens/AppointmentsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ConnectionScreen from './screens/ConnectionScreen';
import OwnerProfileScreen from './screens/OwnerProfileScreen';
import ClinicSettingsScreen from './screens/ClinicSettingsScreen';
import ManageVeterinariansScreen from './screens/ManageVeterinariansScreen';
import VeterinarianSettingsScreen from './screens/VeterinarianSettingsScreen';
import VeterinarianLinksScreen from './screens/VeterinarianLinksScreen';

function PublicOnly({ children }: { children: ReactNode }) {
  const { authReady, isAuthenticated, user } = useSession();

  if (!authReady) return null;
  if (isAuthenticated) {
    return <Navigate to={getDashboardRouteForUserType(user?.userType)} replace />;
  }

  return <>{children}</>;
}

function ProtectedOnly({ children }: { children: ReactNode }) {
  const { authReady, isAuthenticated } = useSession();

  if (!authReady) return null;
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function withPublicOnly(Screen: ComponentType) {
  return function PublicRoute() {
    return (
      <PublicOnly>
        <Screen />
      </PublicOnly>
    );
  };
}

function withProtectedOnly(Screen: ComponentType) {
  return function ProtectedRoute() {
    return (
      <ProtectedOnly>
        <Screen />
      </ProtectedOnly>
    );
  };
}

function withAllowedUserTypes(Screen: ComponentType, allowedTypes: UserType[]) {
  return function RoleGuardedRoute() {
    const { authReady, isAuthenticated, user } = useSession();

    if (!authReady) return null;
    if (!isAuthenticated) return <Navigate to="/" replace />;
    if (allowedTypes.length > 0 && !allowedTypes.includes(user?.userType ?? 'owner')) {
      return <Navigate to={getDashboardRouteForUserType(user?.userType)} replace />;
    }

    return <Screen />;
  };
}

function DashboardRedirect() {
  const { authReady, isAuthenticated, user } = useSession();

  if (!authReady) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return <Navigate to={getDashboardRouteForUserType(user?.userType)} replace />;
}

function ProfileRedirect() {
  const { authReady, isAuthenticated, user } = useSession();

  if (!authReady) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  if (user?.userType === 'clinic') return <Navigate to="/clinic-settings" replace />;
  if (user?.userType === 'veterinarian') return <Navigate to="/veterinarian-settings" replace />;
  return <Navigate to="/settings" replace />;
}

function CatchAllRedirect() {
  const { authReady, isAuthenticated, user } = useSession();

  if (!authReady) return null;
  if (isAuthenticated) {
    return <Navigate to={getDashboardRouteForUserType(user?.userType)} replace />;
  }

  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: withPublicOnly(LoginScreen),
  },
  {
    path: '/register',
    Component: withPublicOnly(RegisterScreen),
  },
  {
    path: '/pet-registration',
    Component: withAllowedUserTypes(PetRegistrationScreen, ['owner']),
  },
  {
    path: '/owner-dashboard',
    Component: withAllowedUserTypes(OwnerDashboardScreen, ['owner']),
  },
  {
    path: '/clinic-dashboard',
    Component: withAllowedUserTypes(ClinicDashboardScreen, ['clinic']),
  },
  {
    path: '/clinic-agenda',
    Component: withAllowedUserTypes(ClinicAgendaScreen, ['clinic']),
  },
  {
    path: '/clinic-history',
    Component: withAllowedUserTypes(ClinicHistoryScreen, ['clinic']),
  },
  {
    path: '/veterinarian-dashboard',
    Component: withAllowedUserTypes(VeterinarianDashboardScreen, ['veterinarian']),
  },  {
    path: '/veterinarian-schedule',
    Component: withAllowedUserTypes(VeterinarianScheduleScreen, ['veterinarian']),
  },

  {
    path: '/pet-profile',
    Component: withAllowedUserTypes(PetProfileScreen, ['owner', 'veterinarian']),
  },
  {
    path: '/pet-transfer',
    Component: withAllowedUserTypes(PetTransferScreen, ['owner']),
  },
  {
    path: '/medical-history',
    Component: withAllowedUserTypes(MedicalHistoryScreen, ['owner', 'veterinarian']),
  },
  {
    path: '/veterinarian-history',
    Component: withAllowedUserTypes(MedicalHistoryScreen, ['veterinarian']),
  },
  {
    path: '/vaccines',
    Component: withAllowedUserTypes(VaccinationScreen, ['owner', 'veterinarian']),
  },
  {
    path: '/exams',
    Component: withAllowedUserTypes(ExamsScreen, ['owner', 'veterinarian']),
  },
  {
    path: '/appointments',
    Component: withProtectedOnly(AppointmentsScreen),
  },
  {
    path: '/notifications',
    Component: withProtectedOnly(NotificationsScreen),
  },
  {
    path: '/clinic-notifications',
    Component: withAllowedUserTypes(NotificationsScreen, ['clinic']),
  },
  {
    path: '/veterinarian-notifications',
    Component: withAllowedUserTypes(NotificationsScreen, ['veterinarian']),
  },
  {
    path: '/connection',
    Component: withAllowedUserTypes(ConnectionScreen, ['owner', 'veterinarian']),
  },
  {
    path: '/settings',
    Component: withAllowedUserTypes(OwnerProfileScreen, ['owner']),
  },
  {
    path: '/clinic-settings',
    Component: withAllowedUserTypes(ClinicSettingsScreen, ['clinic']),
  },
  {
    path: '/clinic-veterinarians',
    Component: withAllowedUserTypes(ManageVeterinariansScreen, ['clinic']),
  },
  {
    path: '/veterinarian-settings',
    Component: withAllowedUserTypes(VeterinarianSettingsScreen, ['veterinarian']),
  },
  {
    path: '/veterinarian-links',
    Component: withAllowedUserTypes(VeterinarianLinksScreen, ['veterinarian']),
  },
  {
    path: '/profile',
    Component: ProfileRedirect,
  },
  {
    path: '/dashboard',
    Component: DashboardRedirect,
  },
  {
    path: '*',
    Component: CatchAllRedirect,
  },
]);



