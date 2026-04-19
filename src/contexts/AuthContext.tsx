import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

interface ProfileData {
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  company_id: string | null;
  branch_id: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  /** Currently active role (used for routing/UI) */
  role: AppRole | null;
  /** All roles assigned to the user */
  roles: AppRole[];
  /** Switch the active role (must be one of the user's roles) */
  setActiveRole: (role: AppRole) => void;
  profile: ProfileData | null;
  companyId: string | null;
  branchId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const ACTIVE_ROLE_STORAGE_KEY = "active_role";

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  roles: [],
  setActiveRole: () => {},
  profile: null,
  companyId: null,
  branchId: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoleAndProfile = async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("profiles")
        .select("full_name, email, phone, avatar_url, company_id, branch_id")
        .eq("id", userId)
        .single(),
    ]);

    const userRoles = (rolesRes.data ?? []).map((r: any) => r.role as AppRole);
    setRoles(userRoles);

    // Determine active role: stored preference if valid, else first role
    const stored = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY) as AppRole | null;
    const active = stored && userRoles.includes(stored) ? stored : userRoles[0] ?? null;
    setRole(active);

    if (profileRes.data && !("error" in profileRes.data)) {
      setProfile(profileRes.data as ProfileData);
    }
  };

  const setActiveRole = useCallback((next: AppRole) => {
    if (!roles.includes(next)) return;
    localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, next);
    setRole(next);
  }, [roles]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchRoleAndProfile(session.user.id), 0);
        } else {
          setRole(null);
          setRoles([]);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoleAndProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setRoles([]);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        roles,
        setActiveRole,
        profile,
        companyId: profile?.company_id ?? null,
        branchId: profile?.branch_id ?? null,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
