import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import { ApiError, onExpired, request, setSessionToken } from "../api/client";
import { clearCache } from "../storage/database";
import { User } from "../types";
type Session = {
  user: User | null;
  loading: boolean;
  offline: boolean;
  message: string;
  login: (body: any, register?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  verify: () => Promise<void>;
};
const Context = createContext<Session>(null!);
export const useSession = () => useContext(Context);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [offline, setOffline] = useState(false),
    [message, setMessage] = useState("");
  const current = useRef<User | null>(null);
  const client = useQueryClient();
  const generation = useRef(0);
  const assign = useCallback((value: User | null) => {
    current.current = value;
    setUser(value);
  }, []);
  const logout = useCallback(async () => {
    generation.current++;
    setSessionToken(null);
    assign(null);
    await client.cancelQueries();
    client.clear();
    await SecureStore.deleteItemAsync("wildguard.session");
    await clearCache();
  }, [assign, client]);
  const verify = useCallback(async () => {
    const epoch = generation.current;
    try {
      const result = await request("/auth/me");
      if (epoch !== generation.current) return;
      assign(result.user);
      setMessage("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      setMessage(
        error instanceof Error ? error.message : "Unable to verify session.",
      );
    }
  }, [assign]);
  useEffect(() => {
    onExpired(() => {
      setMessage(
        "Your session expired. Sign in again. Pending field records are retained for your account.",
      );
      void logout().catch(() =>
        setMessage("Unable to clear local session. Restart and sign in again."),
      );
    });
    void (async () => {
      try {
        const saved = await SecureStore.getItemAsync("wildguard.session");
        if (saved) {
          const session = JSON.parse(saved);
          setSessionToken(session.token);
          assign(session.user);
          await verify();
        }
      } catch {
        setMessage("Unable to restore your secure session. Please sign in.");
      } finally {
        setLoading(false);
      }
    })();
    const network = NetInfo.addEventListener((state) => {
      const down =
        state.isConnected === false || state.isInternetReachable === false;
      setOffline(down);
      if (!down && current.current) void verify();
    });
    const app = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
      if (state === "active" && current.current) void verify();
    });
    return () => {
      network();
      app.remove();
      onExpired(() => {});
    };
  }, [assign, logout, verify]);
  async function login(body: any, register = false) {
    const session = await request(register ? "/auth/register" : "/auth/login", {
      method: "POST",
      body,
      public: true,
    });
    // No passwords are persisted. SecureStore protects the token and minimal offline identity.
    await SecureStore.setItemAsync(
      "wildguard.session",
      JSON.stringify({ token: session.token, user: session.user }),
    );
    generation.current++;
    client.clear();
    setSessionToken(session.token);
    assign(session.user);
    setMessage("");
  }
  return (
    <Context.Provider
      value={{ user, loading, offline, message, login, logout, verify }}
    >
      {children}
    </Context.Provider>
  );
}
