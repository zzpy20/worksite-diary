import * as Crypto from 'expo-crypto';

import {
  flushQueue,
  getPendingCreateEntry,
  getPendingIds,
  getPendingView,
  isOnline,
  queueCreate,
  queueDelete,
  queueUpdate,
} from '@/lib/offline-queue';
import { supabase } from '@/lib/supabase';
import type { Entry, NewEntryInput } from '@/types/entry';

const PHOTOS_BUCKET = 'entry-photos';

/** Thrown when a photo upload couldn't be confirmed — treated as a connectivity issue, not a real error. */
class UploadIncompleteError extends Error {}

export async function listEntries(): Promise<Entry[]> {
  const [syncedResult, pendingView] = await Promise.all([
    supabase.from('entries').select('*').order('date', { ascending: false }),
    getPendingView(),
  ]);

  if (syncedResult.error && (await isOnline())) {
    // A genuine error, not just lack of connectivity — surface it as before.
    throw syncedResult.error;
  }
  // Offline with nothing cached yet: fall through with an empty synced list, still
  // showing whatever's pending below rather than failing the whole screen.
  const synced = syncedResult.error ? [] : (syncedResult.data as Entry[]);

  const visible = synced
    .filter((entry) => !pendingView.deletedIds.has(entry.id))
    .map((entry) => (pendingView.updatedIds.has(entry.id) ? { ...entry, pending: true } : entry));

  return [...pendingView.createdEntries.map((entry) => ({ ...entry, pending: true })), ...visible];
}

export async function getEntry(id: string): Promise<Entry> {
  const pendingCreate = await getPendingCreateEntry(id);
  if (pendingCreate) return { ...pendingCreate, pending: true };

  const { data, error } = await supabase.from('entries').select('*').eq('id', id).single();
  if (error) throw error;

  const pendingIds = await getPendingIds();
  return { ...(data as Entry), pending: pendingIds.has(id) };
}

/** Distinct site names from the user's most recent entries, most-recently-used first. */
export async function listRecentSites(): Promise<string[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('site')
    .order('date', { ascending: false })
    .limit(200);

  if (error) throw error;

  const seen = new Set<string>();
  const sites: string[] = [];
  for (const row of data ?? []) {
    const site = row.site?.trim();
    if (site && !seen.has(site)) {
      seen.add(site);
      sites.push(site);
    }
  }
  return sites;
}

async function uploadPhoto(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('Selected photo could not be read from your device.');
  }

  const extension = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const path = `${userId}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}` });

  if (uploadError) throw uploadError;

  // `.upload()` can resolve without an error on a flaky connection even when the
  // transfer didn't fully land — confirm the object is actually in storage, at the
  // right size, via Storage's own listing API rather than trusting a public HEAD
  // fetch (which depends on CDN header behavior we don't fully control).
  const { data: listing, error: listError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .list(userId, { search: filename });
  const stored = listing?.find((f) => f.name === filename);
  if (listError || !stored || stored.metadata?.size !== arrayBuffer.byteLength) {
    throw new UploadIncompleteError('Photo upload did not complete.');
  }

  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function pathFromPublicUrl(url: string): string | null {
  const marker = `/${PHOTOS_BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : url.slice(index + marker.length);
}

function entryFields(input: NewEntryInput) {
  return {
    date: input.date,
    site: input.site,
    start_time: input.start_time || null,
    finish_time: input.finish_time || null,
    comments: input.comments || null,
    tasks: input.tasks || null,
    latitude: input.latitude,
    longitude: input.longitude,
    address: input.address,
  };
}

async function queueNewEntry(userId: string, input: NewEntryInput): Promise<Entry> {
  const entry: Entry = {
    id: Crypto.randomUUID(),
    user_id: userId,
    ...entryFields(input),
    photo_urls: input.photoUris,
    created_at: new Date().toISOString(),
  };
  await queueCreate(entry);
  return { ...entry, pending: true };
}

export async function createEntry(input: NewEntryInput): Promise<Entry> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not signed in');

  if (!(await isOnline())) {
    return queueNewEntry(user.id, input);
  }

  try {
    const photo_urls = await Promise.all(input.photoUris.map((uri) => uploadPhoto(user.id, uri)));

    const { data, error } = await supabase
      .from('entries')
      .insert({ user_id: user.id, ...entryFields(input), photo_urls })
      .select()
      .single();

    if (error) throw error;
    return data as Entry;
  } catch (err) {
    if (err instanceof UploadIncompleteError) return queueNewEntry(user.id, input);
    throw err;
  }
}

async function queueEntryUpdate(id: string, input: NewEntryInput, originalEntry: Entry): Promise<Entry> {
  const merged = await queueUpdate(id, input, originalEntry.photo_urls);
  const pendingEntry = merged ?? { ...originalEntry, ...entryFields(input), photo_urls: input.photoUris };
  return { ...pendingEntry, pending: true };
}

/**
 * `input.photoUris` is the final desired photo list: a mix of already-uploaded
 * remote URLs (kept as-is) and new local file URIs (uploaded here). Any photos in
 * `originalEntry.photo_urls` that are no longer present are deleted from storage.
 */
export async function updateEntry(id: string, input: NewEntryInput, originalEntry: Entry): Promise<Entry> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not signed in');

  if (!(await isOnline())) {
    return queueEntryUpdate(id, input, originalEntry);
  }

  try {
    const keptRemoteUrls = input.photoUris.filter((uri) => uri.startsWith('http'));
    const newLocalUris = input.photoUris.filter((uri) => !uri.startsWith('http'));
    const uploadedUrls = await Promise.all(newLocalUris.map((uri) => uploadPhoto(user.id, uri)));
    const photo_urls = [...keptRemoteUrls, ...uploadedUrls];

    const removedPaths = originalEntry.photo_urls
      .filter((url) => !keptRemoteUrls.includes(url))
      .map(pathFromPublicUrl)
      .filter((p): p is string => !!p);
    if (removedPaths.length > 0) {
      await supabase.storage.from(PHOTOS_BUCKET).remove(removedPaths);
    }

    const { data, error } = await supabase
      .from('entries')
      .update({ ...entryFields(input), photo_urls })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Entry;
  } catch (err) {
    if (err instanceof UploadIncompleteError) return queueEntryUpdate(id, input, originalEntry);
    throw err;
  }
}

export async function deleteEntry(id: string): Promise<void> {
  if (!(await isOnline())) {
    await queueDelete(id);
    return;
  }
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}

async function syncCreate(entry: Entry): Promise<void> {
  const photo_urls = await Promise.all(entry.photo_urls.map((uri) => uploadPhoto(entry.user_id, uri)));
  const { error } = await supabase.from('entries').insert({
    id: entry.id,
    user_id: entry.user_id,
    date: entry.date,
    site: entry.site,
    start_time: entry.start_time,
    finish_time: entry.finish_time,
    comments: entry.comments,
    tasks: entry.tasks,
    latitude: entry.latitude,
    longitude: entry.longitude,
    address: entry.address,
    photo_urls,
  });
  if (error) throw error;
}

async function syncUpdate(id: string, input: NewEntryInput, originalPhotoUrls: string[]): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not signed in');

  const keptRemoteUrls = input.photoUris.filter((uri) => uri.startsWith('http'));
  const newLocalUris = input.photoUris.filter((uri) => !uri.startsWith('http'));
  const uploadedUrls = await Promise.all(newLocalUris.map((uri) => uploadPhoto(user.id, uri)));
  const photo_urls = [...keptRemoteUrls, ...uploadedUrls];

  const removedPaths = originalPhotoUrls
    .filter((url) => !keptRemoteUrls.includes(url))
    .map(pathFromPublicUrl)
    .filter((p): p is string => !!p);
  if (removedPaths.length > 0) {
    await supabase.storage.from(PHOTOS_BUCKET).remove(removedPaths);
  }

  const { error } = await supabase
    .from('entries')
    .update({ ...entryFields(input), photo_urls })
    .eq('id', id);
  if (error) throw error;
}

async function syncDelete(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}

/** Attempts to push everything in the local pending queue to the server. Safe to call anytime. */
export async function flushPendingQueue(): Promise<void> {
  await flushQueue({ create: syncCreate, update: syncUpdate, remove: syncDelete });
}
