'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

// Custom hook for easier auth management
export const useAuthManager = () => {
  const { session, signIn, signOut, isLoading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(!!session?.user);
  }, [session]);

  return {
    user: session?.user,
    session,
    isAuthenticated,
    isLoading,
    signIn,
    signOut,
  };
};