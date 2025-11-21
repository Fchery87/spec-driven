'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useSession, signIn, signOut } from '@/lib/auth-client';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Define the context type
interface AuthContextType {
  session: any; // Better Auth session type
  signIn: any; // Better Auth signIn function
  signOut: any; // Better Auth signOut function
  isLoading: boolean;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { data: session, isPending: isLoading } = useSession();

  return (
    <AuthContext.Provider value={{
      session,
      signIn,
      signOut,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};