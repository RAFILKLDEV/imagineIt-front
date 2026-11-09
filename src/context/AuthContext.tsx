import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

export type AuthUser = {
  id: string;
  ownerId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  status: string;
  createdAt?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { data } = await api.get<{ user: AuthUser }>('/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const { data } = await api.post<{ user: AuthUser }>('/auth/login', { email, password });
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
  }

  useEffect(() => { void refresh(); }, []);

  const value = useMemo(() => ({ user, loading, refresh, login, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
