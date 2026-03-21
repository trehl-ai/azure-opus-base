import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PresenceUser {
  user_id: string;
  name: string;
  page: string;
}

export function usePresence(page: string) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users: PresenceUser[] = [];
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            if (p.user_id !== user.id && p.page === page) {
              users.push(p);
            }
          });
        });
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            page,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, page]);

  return onlineUsers;
}
