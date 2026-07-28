import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local (see .env.local.example).'
  );
}

// AsyncStorage's web backend reads `window.localStorage`, which doesn't exist
// during Expo Router's server-side render pass. Guard each call so SSR no-ops
// instead of crashing; the browser re-hydrates and reads real storage after.
const ssrSafeStorage = {
  getItem: (key: string) => (typeof window === 'undefined' ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) =>
    typeof window === 'undefined' ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    typeof window === 'undefined' ? Promise.resolve() : AsyncStorage.removeItem(key),
};

// Pinned explicitly (this matches supabase-js's own default derivation) so auth-context.tsx
// can read the persisted session directly from AsyncStorage under this exact key when
// opening offline, without depending on an internal default that could change.
export const authStorageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ssrSafeStorage,
    storageKey: authStorageKey,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
