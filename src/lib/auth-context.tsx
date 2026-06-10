"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { User } from "@/lib/types";

type AuthContextType = {
  authUser: AuthUser | null;
  profile: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  authUser: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProfile = useCallback(
    async (userId: string, email?: string, metadata?: any) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching profile:", error);
          return;
        }

        if (data) {
          setProfile(data as User);
        } else if (email) {
          // Profile doesn't exist, let's create it on the fly
          const fullName = metadata?.full_name || metadata?.name || "User";
          const avatarUrl = metadata?.avatar_url || null;

          const { data: newProfile, error: insertError } = await supabase
            .from("profiles")
            .insert({
              id: userId,
              full_name: fullName,
              email: email,
              avatar_url: avatarUrl,
            })
            .select()
            .single();

          if (insertError) {
            console.error("Failed to auto-create profile:", insertError);
          } else if (newProfile) {
            setProfile(newProfile as User);
          }
        }
      } catch (error) {
        console.error("Error fetching/syncing profile:", error);
      }
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (authUser) {
      await fetchProfile(authUser.id, authUser.email, authUser.user_metadata);
    }
  }, [authUser, fetchProfile]);

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setAuthUser(user);
        if (user) {
          await fetchProfile(user.id, user.email, user.user_metadata);
        }
      } catch (error) {
        console.error("Error getting user:", error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setAuthUser(user);
      if (user) {
        await fetchProfile(user.id, user.email, user.user_metadata);
        if (session?.provider_refresh_token) {
          try {
            await supabase
              .from("profiles")
              .update({ google_drive_refresh_token: session.provider_refresh_token })
              .eq("id", user.id);
          } catch (tokenErr) {
            console.error("Error saving provider refresh token:", tokenErr);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ authUser, profile, loading, signOut, refreshProfile }}
    >
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
