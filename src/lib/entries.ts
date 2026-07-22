import { supabase } from '@/lib/supabase';
import type { Entry, NewEntryInput } from '@/types/entry';

const PHOTOS_BUCKET = 'entry-photos';

export async function listEntries(): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('date', { ascending: false });

  if (error) throw error;
  return data as Entry[];
}

export async function getEntry(id: string): Promise<Entry> {
  const { data, error } = await supabase.from('entries').select('*').eq('id', id).single();

  if (error) throw error;
  return data as Entry;
}

async function uploadPhoto(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const extension = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}` });

  if (uploadError) throw uploadError;

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

export async function createEntry(input: NewEntryInput): Promise<Entry> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const photo_urls = await Promise.all(input.photoUris.map((uri) => uploadPhoto(user.id, uri)));

  const { data, error } = await supabase
    .from('entries')
    .insert({ user_id: user.id, ...entryFields(input), photo_urls })
    .select()
    .single();

  if (error) throw error;
  return data as Entry;
}

/**
 * `input.photoUris` is the final desired photo list: a mix of already-uploaded
 * remote URLs (kept as-is) and new local file URIs (uploaded here). Any of
 * `originalPhotoUrls` that are no longer present are deleted from storage.
 */
export async function updateEntry(
  id: string,
  input: NewEntryInput,
  originalPhotoUrls: string[]
): Promise<Entry> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const { data, error } = await supabase
    .from('entries')
    .update({ ...entryFields(input), photo_urls })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Entry;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}
