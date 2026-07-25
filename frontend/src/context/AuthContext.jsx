import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

// NB: pas de localStorage dans ce sandbox de démo -> la session vit en mémoire
// (React state). Dans un déploiement réel, stockez le token de façon sécurisée
// (ex: cookie httpOnly côté serveur, ou SecureStore côté app mobile).
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (identifier, password) => {
    const data = await api.login({ identifier, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.register(payload);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.me(token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (token) refreshMe(); }, [token]); // eslint-disable-line

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
