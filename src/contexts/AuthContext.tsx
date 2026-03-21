import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DbUser = Database["public"]["Tables"]["users"]["Row"];

interface AuthContextType {
  session: Session | null;
  authUser: SupabaseUser | null;
  user: DbUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrCreateDbUser = useCallback(async (supaUser: SupabaseUser) => {
    // Try to find user by auth id first, then by email
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", supaUser.email!)
      .maybeSingle();

    if (existingUser) {
      setUser(existingUser);
      return;
    }

    // Create new user entry
    const meta = supaUser.user_metadata ?? {};
    const firstName = meta.first_name || meta.full_name?.split(" ")[0] || "";
    const lastName = meta.last_name || meta.full_name?.split(" ").slice(1).join(" ") || "";

    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        email: supaUser.email!,
        first_name: firstName || "Neuer",
        last_name: lastName || "Benutzer",
      })
      .select()
      .single();

    if (!error && newUser) {
      setUser(newUser);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setAuthUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(() => fetchOrCreateDbUser(newSession.user), 0);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchOrCreateDbUser(currentSession.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchOrCreateDbUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAuthUser(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, authUser, user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
