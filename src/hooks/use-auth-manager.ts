'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';

// Custom hook for easier auth management
export const useAuthManager = () => {
  const { session, signIn, signOut, isLoading } = useAuth();

  // Derive isAuthenticated directly from session without using effect
  const isAuthenticated = useMemo(() => !!session?.user, [session]);

  return {
    user: session?.user,
    session,
    isAuthenticated,
    isLoading,
    signIn,
    signOut,
  };
};
