/* eslint-disable react-refresh/only-export-components */
// src/context/AuthContext.tsx
import React, {createContext,useContext,useEffect,useState,type ReactNode,} from "react";
import { supabase } from "../supabaseClient";

type AuthUser = {
  id: string;
  email?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, fullName: string,organization: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>; 
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On app load, check if there is an active session
  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const {data: { session }, error,} = await supabase.auth.getSession();

        if (error) {console.error("Error getting session", error);}

        if (session?.user) {
          setUser({id: session.user.id, email: session.user.email ?? undefined,});
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Unexpected error while getting session", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes (login, logout, token refresh)
    const {data: { subscription },} = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? undefined,
        });
      } else {
        setUser(null);
      }
    });

    return () => {subscription.unsubscribe();};
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({email,password,});

    if (error) {
      console.error("Login error:", error);
      return { error: error.message };
    }

    if (data.user) {
      setUser({
        id: data.user.id,
        email: data.user.email ?? undefined,
      });
    }

    return {};
  };

  //Register: only sign up. Profile is created by DB trigger.
  const register = async (
    email: string,
    password: string,
    fullName: string,
    organization: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organization: organization,
        },
      },
    });

    if (error) {
      console.error("Register error:", error);
      return { error: error.message };
    }
    return {};
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
      }
    } finally {
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
