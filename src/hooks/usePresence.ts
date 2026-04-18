import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PresenceEntry {
  is_online: boolean;
  last_seen_at: string;
}

export type PresenceMap = Record<string, PresenceEntry>;

const HEARTBEAT_INTERVAL = 60_000; // 60s
const ONLINE_THRESHOLD = 2 * 60_000; // 2 minutes

function deriveOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD;
}

export function usePresence(userId: string | undefined) {
  const [presenceMap, setPresenceMap] = useState<PresenceMap>({});
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const upsertPresence = useCallback(
    async (online: boolean) => {
      if (!userId) return;
      await supabase.from("user_presence" as any).upsert(
        { user_id: userId, is_online: online, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    },
    [userId]
  );

  const fetchPresence = useCallback(async () => {
    const { data } = await supabase.from("user_presence" as any).select("user_id, is_online, last_seen_at");
    if (data) {
      const map: PresenceMap = {};
      for (const row of data as any[]) {
        map[row.user_id] = {
          is_online: deriveOnline(row.last_seen_at),
          last_seen_at: row.last_seen_at,
        };
      }
      setPresenceMap(map);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    upsertPresence(true);
    fetchPresence();

    // Heartbeat + re-derive online status
    intervalRef.current = setInterval(() => {
      upsertPresence(true);
      // Re-derive all statuses based on time
      setPresenceMap((prev) => {
        const updated: PresenceMap = {};
        for (const [uid, entry] of Object.entries(prev)) {
          updated[uid] = {
            ...entry,
            is_online: uid === userId ? true : deriveOnline(entry.last_seen_at),
          };
        }
        return updated;
      });
    }, HEARTBEAT_INTERVAL);

    // Realtime subscription
    const channel = supabase
      .channel("user-presence-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        (payload: any) => {
          const row = payload.new as any;
          if (row?.user_id) {
            setPresenceMap((prev) => ({
              ...prev,
              [row.user_id]: {
                is_online: deriveOnline(row.last_seen_at),
                last_seen_at: row.last_seen_at,
              },
            }));
          }
        }
      )
      .subscribe();

    // Go offline on tab close using sendBeacon with proper headers
    const handleUnload = () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `${supabaseUrl}/rest/v1/user_presence?user_id=eq.${userId}`;
      const body = JSON.stringify({ is_online: false, last_seen_at: new Date().toISOString() });

      // sendBeacon doesn't support custom headers, so we use fetch with keepalive instead
      try {
        fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Prefer: "return=minimal",
          },
          body,
          keepalive: true,
        });
      } catch {
        // Best-effort
      }
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", handleUnload);
      supabase.removeChannel(channel);
      upsertPresence(false);
    };
  }, [userId, upsertPresence, fetchPresence]);

  return presenceMap;
}
