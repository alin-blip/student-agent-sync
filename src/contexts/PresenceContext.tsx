import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence, PresenceMap } from "@/hooks/usePresence";

const PresenceContext = createContext<PresenceMap>({});

export const usePresenceMap = () => useContext(PresenceContext);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const presenceMap = usePresence(user?.id);

  return (
    <PresenceContext.Provider value={presenceMap}>
      {children}
    </PresenceContext.Provider>
  );
}
