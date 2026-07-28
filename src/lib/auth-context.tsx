import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { isOnline } from '@/lib/offline-queue';
import { authStorageKey, supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSession() {
      // getSession() refreshes the token first whenever it's near or past expiry, which
      // is a real network round trip and true for most cold starts (tokens last ~1hr).
      // With no connection that refresh just retries for ~30s with nothing on screen but
      // a spinner. When offline, read the persisted session straight from storage instead
      // so the app opens immediately with whatever's cached — a real refresh still runs
      // normally once back online, via the auth-state listener below.
      if (!(await isOnline())) {
        const raw = await AsyncStorage.getItem(authStorageKey);
        const cached = raw ? (JSON.parse(raw) as Session) : null;
        if (!cancelled && cached) {
          setSession(cached);
          setLoading(false);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    }

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!cancelled) setSession(newSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
