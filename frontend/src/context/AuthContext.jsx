import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Ensure all cross-site requests send and receive HTTP-only session cookies
axios.defaults.withCredentials = true;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing session cookie on initial page load
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/me`);
      if (res.data && res.data.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      // 401 or network error means user is not authenticated
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email,
      password,
      remember_me: rememberMe
    });
    const loggedInUser = res.data.user;
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (name, email, password, confirmPassword) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/register`, {
      name,
      email,
      password,
      confirm_password: confirmPassword
    });
    const registeredUser = res.data.user;
    setUser(registeredUser);
    return registeredUser;
  };

  const logout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`);
    } catch (err) {
      console.warn("Logout request completed with notice:", err);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
    checkSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
