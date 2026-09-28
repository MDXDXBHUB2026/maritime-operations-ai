import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthSessionStore, type CurrentUser } from '../services/authSession';

interface AuthContextValue {
  user: CurrentUser | null;
}

const AuthContext = createContext<AuthContextValue>({ user: null });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(() => AuthSessionStore.get()?.user ?? null);
  useEffect(() => AuthSessionStore.subscribe((s) => setUser(s?.user ?? null)), []);
  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => useContext(AuthContext);
