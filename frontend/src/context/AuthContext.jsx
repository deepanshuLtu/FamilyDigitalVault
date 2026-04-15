import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [loading, setLoading] = useState(true);

  const syncSession = (nextToken, nextUser) => {
    setToken(nextToken || '');
    setUser(nextUser || null);

    if (nextToken && nextUser) {
      localStorage.setItem('token', nextToken);
      localStorage.setItem('user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  };

  useEffect(() => {
    let active = true;

    const restore = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = readStoredUser();

      if (!storedToken) {
        if (active) {
          setUser(null);
          setToken('');
          setLoading(false);
        }
        return;
      }

      if (storedUser) {
        setUser(storedUser);
        setToken(storedToken);
      }

      try {
        const { data } = await api.get('/api/auth/me');
        if (!active) return;
        const normalized = {
          ...data,
          _id: data?._id || data?.id,
          username: data?.username,
          requests: Array.isArray(data?.requests) ? data.requests : [],
        };
        syncSession(storedToken, normalized);
      } catch {
        if (!active) return;
        syncSession('', null);
      } finally {
        if (active) setLoading(false);
      }
    };

    restore();

    return () => {
      active = false;
    };
  }, []);

  const login = async ({ email, password }) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    const nextUser = {
      _id: data._id,
      name: data.name,
      username: data.username,
      email: data.email,
      role: data.role,
      familyId: data.familyId,
      requests: Array.isArray(data.requests) ? data.requests : [],
    };
    syncSession(data.token, nextUser);
    return nextUser;
  };

  const signup = async ({ name, username, email, password, role }) => {
    const { data } = await api.post('/api/auth/signup', { name, username, email, password, role });
    const nextUser = {
      _id: data._id,
      name: data.name,
      username: data.username,
      email: data.email,
      role: data.role,
      familyId: data.familyId,
      requests: Array.isArray(data.requests) ? data.requests : [],
    };
    syncSession(data.token, nextUser);
    return nextUser;
  };

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return null;

    const { data } = await api.get('/api/auth/me');
    const normalized = {
      ...data,
      _id: data?._id || data?.id,
      requests: Array.isArray(data?.requests) ? data.requests : [],
    };
    syncSession(storedToken, normalized);
    return normalized;
  };

  const updateUser = (partialUser) => {
    setUser((prev) => {
      if (!prev || !partialUser) return prev;
      const nextUser = { ...prev, ...partialUser };
      localStorage.setItem('user', JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const logout = () => {
    syncSession('', null);
  };

  const value = useMemo(
    () => ({ user, token, loading, login, signup, logout, refreshUser, updateUser }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
