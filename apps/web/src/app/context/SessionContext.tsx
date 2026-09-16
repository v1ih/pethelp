import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  decodeJwtPayload,
  getApiBase,
  getAuthHeaders,
  mapApiUserTypeToUi,
  mapProfileToUser,
  type RegisterPayload,
  type User,
  type UserType,
} from './shared';

interface SessionContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (email: string, password: string, userType: UserType) => Promise<UserType>;
  register: (payload: RegisterPayload) => Promise<UserType>;
  updateCurrentUserProfile: (payload: { name?: string; phone?: string | null; cpf?: string | null }) => Promise<User>;
  updateClinicProfile: (payload: {
    tradeName?: string;
    corporateName?: string | null;
    cnpj?: string | null;
    phone?: string | null;
    address?: string;
    services?: string[] | null;
    workingHours?: Record<string, unknown> | null;
    language?: string | null;
  }) => Promise<User>;
  updateVeterinarianProfile: (payload: {
    name?: string;
    email?: string;
    crmv?: string;
    crmvUf?: string;
    specialty?: string;
    phone?: string | null;
  }) => Promise<User>;
  deactivateCurrentUserAccount: () => Promise<void>;
  deleteCurrentUserAccount: () => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const API_BASE = getApiBase();

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setAuthReady(true);
        return;
      }

      const payload = decodeJwtPayload(token);
      const userId = payload?.sub;
      if (!userId) {
        localStorage.removeItem('token');
        setAuthReady(true);
        return;
      }

      try {
        const resp = await fetch(`${API_BASE}/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!resp.ok) {
          localStorage.removeItem('token');
          setAuthReady(true);
          return;
        }

        const { data: profile } = await resp.json();
        setUser(mapProfileToUser(profile));
      } catch (error) {
        console.error('bootstrap session error', error);
      } finally {
        setAuthReady(true);
      }
    };

    void bootstrap();
  }, [API_BASE]);

  const login = async (email: string, password: string, userType: UserType) => {
    // Descarta qualquer sessão anterior antes de tentar, para nunca misturar contas.
    localStorage.removeItem('token');

    let resp: Response;
    try {
      resp = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      // fetch só lança quando não conseguiu falar com o servidor (offline/CORS).
      throw new Error('Não foi possível falar com o servidor. Verifique se o backend está rodando.');
    }

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Login failed');
    }

    const data = await resp.json();
    const { id, token, userType: apiUserType } = data;
    localStorage.setItem('token', token);

    const profileResp = await fetch(`${API_BASE}/api/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const uiUserType = mapApiUserTypeToUi(apiUserType ?? userType);

    if (profileResp.ok) {
      const { data: profile } = await profileResp.json();
      setUser(mapProfileToUser(profile));
    } else {
      setUser({ id, name: '', email, userType: uiUserType });
    }

    return uiUserType;
  };

  const register = async (payload: RegisterPayload) => {
    const resp = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        userType: payload.userType,
        cpf: payload.cpf,
        clinicName: payload.clinicName,
        tradeName: payload.tradeName,
        address: payload.address,
        phone: payload.phone,
        crmv: payload.crmv,
        crmvUf: payload.crmvUf,
        specialty: payload.specialty,
        corporateName: payload.corporateName,
        cnpj: payload.cnpj,
        connectionCode: payload.connectionCode,
        services: payload.services,
      }),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Register failed');
    }

    const { id, token, userType } = await resp.json();
    localStorage.setItem('token', token);

    const profileResp = await fetch(`${API_BASE}/api/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const uiUserType = mapApiUserTypeToUi(userType);

    if (profileResp.ok) {
      const { data: profile } = await profileResp.json();
      setUser(mapProfileToUser(profile));
    } else {
      setUser({ id, name: payload.name ?? '', email: payload.email, userType: uiUserType });
    }

    return uiUserType;
  };

  const updateCurrentUserProfile = async (payload: { name?: string; phone?: string | null; cpf?: string | null }) => {
    const resp = await fetch(`${API_BASE}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Profile update failed');
    }

    const { data: profile } = await resp.json();
    const nextUser = mapProfileToUser(profile);
    setUser(nextUser);
    return nextUser;
  };

  const updateClinicProfile = async (payload: {
    tradeName?: string;
    corporateName?: string | null;
    cnpj?: string | null;
    phone?: string | null;
    address?: string;
    services?: string[] | null;
    workingHours?: Record<string, unknown> | null;
    language?: string | null;
  }) => {
    const resp = await fetch(`${API_BASE}/api/users/clinic/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Clinic profile update failed');
    }

    const { data: profile } = await resp.json();
    const nextUser = mapProfileToUser(profile);
    setUser(nextUser);
    return nextUser;
  };

  const updateVeterinarianProfile = async (payload: {
    name?: string;
    email?: string;
    crmv?: string;
    crmvUf?: string;
    specialty?: string;
    phone?: string | null;
  }) => {
    const resp = await fetch(`${API_BASE}/api/users/veterinarian/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Veterinarian profile update failed');
    }

    const { data: profile } = await resp.json();
    const nextUser = mapProfileToUser(profile);
    setUser(nextUser);
    return nextUser;
  };

  const logout = () => {
    setUser(null);
    // Reset completo: apaga qualquer sessão/estado guardado no navegador para evitar
    // "login embolado" ao trocar de conta, e recarrega numa tela limpa.
    try {
      localStorage.clear();
    } catch {
      localStorage.removeItem('token');
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  const deactivateCurrentUserAccount = async () => {
    const resp = await fetch(`${API_BASE}/api/users/me/deactivate`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });

    if (!resp.ok && resp.status !== 204) {
      throw new Error((await resp.json()).message ?? 'Account deactivation failed');
    }

    logout();
  };

  const deleteCurrentUserAccount = async () => {
    const resp = await fetch(`${API_BASE}/api/users/me`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!resp.ok && resp.status !== 204) {
      throw new Error((await resp.json()).message ?? 'Account deletion failed');
    }

    logout();
  };

  return (
    <SessionContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated: !!user,
        authReady,
        login,
        register,
        updateCurrentUserProfile,
        updateClinicProfile,
        updateVeterinarianProfile,
        deactivateCurrentUserAccount,
        deleteCurrentUserAccount,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}


