import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { request } from "../api/client";
import { useSession } from "../contexts/Session";
import { cacheGet, cachePut } from "../storage/database";
export function useData(path: string | null, persist = false) {
  const { user, offline } = useSession();
  return useQuery({
    queryKey: [user?.id, path],
    enabled: !!path && !!user,
    queryFn: async ({ signal }) => {
      const key = `${user!.id}:${path}`;
      if (persist && offline) {
        const saved = await cacheGet(key);
        if (saved) return { ...saved, offlineCache: true };
      }
      try {
        const value = await request(path!, { signal });
        if (persist) await cachePut(key, value);
        return value;
      } catch (error: any) {
        if (persist && error.status === 0 && error.code !== "CANCELLED") {
          const saved = await cacheGet(key);
          if (saved) return { ...saved, offlineCache: true };
        }
        throw error;
      }
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}
export function useRefresh() {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries(), [client]);
}
