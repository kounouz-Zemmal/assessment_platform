import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiGet, apiPost } from '../apiClient';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher' | 'student';
  status: 'active' | 'inactive';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
  isAfterLogin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAfterLogin, setIsAfterLogin] = useState(false);

  // Check if user is already logged in on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setError(null);
    try {
      const response = await apiGet<{ user: User }>("auth/me");
      setUser(response.user);
    } catch (err) {
      // Expected when not authenticated
      setUser(null);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost<{ user: User }>("auth/login", { email, password });
      setUser(response.user);
      setIsAfterLogin(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);

    try {
      await apiPost<{ success: boolean; data: { message: string } }>("auth/logout", {});
    } catch (err) {
      // Logout error, but still clear local state
    } finally {
      setUser(null);
      setIsAfterLogin(false);
      setLoading(false);
      // Clear session storage and redirect
      window.location.href = '/';
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    loading,
    error,
    isAfterLogin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}