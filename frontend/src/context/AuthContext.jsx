import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .post('/auth/refresh')
      .then((response) => {
        if (!active) return;
        setAccessToken(response.data.accessToken);
        setUser(response.data.user);
      })
      .catch(() => {
        if (!active) return;
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      async login(payload) {
        const response = await api.post('/auth/login', payload);
        setAccessToken(response.data.accessToken);
        setUser(response.data.user);
        return response.data.user;
      },
      async register(payload) {
        const response = await api.post('/auth/register', payload);
        setAccessToken(response.data.accessToken);
        setUser(response.data.user);
        return response.data.user;
      },
      async logout() {
        await api.post('/auth/logout').catch(() => {});
        setAccessToken(null);
        setUser(null);
      },
      setUser,
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
