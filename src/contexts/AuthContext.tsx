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

  const fetchOrCreateDbUser = useCallback(async (supaUser: SupabaseUser): Promise<DbUser | null> => {
    // Lookup MUSS per id (= auth.users.id) erfolgen — Lookup per email ist anfällig
    // für Duplikate (maybeSingle() wirft bei N>1 → null → Insert-Loop legt Junk an).
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", supaUser.id)
      .maybeSingle();

    if (existingUser) {
      return existingUser;
    }

    const meta = supaUser.user_metadata ?? {};
    const firstName = meta.first_name || meta.full_name?.split(" ")[0] || "";
    const lastName = meta.last_name || meta.full_name?.split(" ").slice(1).join(" ") || "";

    // Upsert mit explizitem id = supaUser.id koppelt public.users an auth.users 1:1.
    // onConflict 'id' macht den Call idempotent bei Race-Conditions oder wenn
    // ein DB-Trigger die Row bereits erzeugt hat.
    const { data: newUser, error } = await supabase
      .from("users")
      .upsert(
        {
          id: supaUser.id,
          email: supaUser.email!,
          first_name: firstName || "Neuer",
          last_name: lastName || "Benutzer",
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (!error && newUser) {
      return newUser;
    }

    return null;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncAuthState = async (nextSession: Session | null, event?: string) => {
      if (!isMounted) return;

      setSession(nextSession);
      setAuthUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      let dbUser: DbUser | null = null;
      try {
        dbUser = await fetchOrCreateDbUser(nextSession.user);
      } catch (err) {
        console.error("Failed to fetch/create DB user, proceeding with session only:", err);
      }

      if (!isMounted) return;

      setUser(dbUser);
      setLoading(false);

      // Update last_sign_in_at on sign-in events
      if (dbUser && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        supabase
          .from("users")
          .update({ last_sign_in_at: new Date().toISOString() })
          .eq("id", dbUser.id)
          .then(() => {});
      }
    };

    setLoading(true);

    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Use setTimeout to avoid Supabase client deadlock
        setTimeout(() => {
          void syncAuthState(newSession, event);
        }, 0);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      void syncAuthState(currentSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
