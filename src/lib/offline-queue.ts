import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import type { Entry, NewEntryInput } from '@/types/entry';

const QUEUE_KEY = 'worksite-diary.pendingQueue';

export type PendingOperation =
  | { type: 'create'; entry: Entry }
  | { type: 'update'; id: string; input: NewEntryInput; originalPhotoUrls: string[]; originalVideoUrls: string[] }
  | { type: 'delete'; id: string };

async function loadQueue(): Promise<PendingOperation[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as PendingOperation[]) : [];
}

async function saveQueue(queue: PendingOperation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}

/** Full local Entry for anything not yet synced at all — used so a just-created entry is viewable offline. */
export async function getPendingCreateEntry(id: string): Promise<Entry | null> {
  const queue = await loadQueue();
  const op = queue.find((o) => o.type === 'create' && o.entry.id === id);
  return op && op.type === 'create' ? op.entry : null;
}

export async function getPendingIds(): Promise<Set<string>> {
  const queue = await loadQueue();
  const ids = new Set<string>();
  for (const op of queue) ids.add(op.type === 'create' ? op.entry.id : op.id);
  return ids;
}

/** Everything the entries list needs to reconcile pending changes into what it renders. */
export async function getPendingView(): Promise<{
  createdEntries: Entry[];
  deletedIds: Set<string>;
  updatedIds: Set<string>;
}> {
  const queue = await loadQueue();
  const createdEntries: Entry[] = [];
  const deletedIds = new Set<string>();
  const updatedIds = new Set<string>();
  for (const op of queue) {
    if (op.type === 'create') createdEntries.push(op.entry);
    else if (op.type === 'delete') deletedIds.add(op.id);
    else updatedIds.add(op.id);
  }
  return { createdEntries, deletedIds, updatedIds };
}

export async function queueCreate(entry: Entry): Promise<void> {
  const queue = await loadQueue();
  queue.push({ type: 'create', entry });
  await saveQueue(queue);
}

/**
 * Returns the merged local Entry if this was still an unsynced create (so the caller can
 * render it immediately), or null if it's queued as a normal update against a synced row.
 */
export async function queueUpdate(
  id: string,
  input: NewEntryInput,
  originalPhotoUrls: string[],
  originalVideoUrls: string[]
): Promise<Entry | null> {
  const queue = await loadQueue();
  const createIndex = queue.findIndex((op) => op.type === 'create' && op.entry.id === id);
  if (createIndex !== -1) {
    const createOp = queue[createIndex] as Extract<PendingOperation, { type: 'create' }>;
    const merged: Entry = {
      ...createOp.entry,
      date: input.date,
      site: input.site,
      start_time: input.start_time || null,
      finish_time: input.finish_time || null,
      comments: input.comments || null,
      tasks: input.tasks || null,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address,
      photo_urls: input.photoUris,
      video_urls: input.videoUris,
    };
    queue[createIndex] = { type: 'create', entry: merged };
    await saveQueue(queue);
    return merged;
  }

  const filtered = queue.filter((op) => !(op.type === 'update' && op.id === id));
  filtered.push({ type: 'update', id, input, originalPhotoUrls, originalVideoUrls });
  await saveQueue(filtered);
  return null;
}

export async function queueDelete(id: string): Promise<void> {
  const queue = await loadQueue();
  const createIndex = queue.findIndex((op) => op.type === 'create' && op.entry.id === id);
  if (createIndex !== -1) {
    // Never synced — nothing on the server to delete, just drop it.
    queue.splice(createIndex, 1);
    await saveQueue(queue);
    return;
  }
  const filtered = queue.filter((op) => !((op.type === 'update' || op.type === 'delete') && op.id === id));
  filtered.push({ type: 'delete', id });
  await saveQueue(filtered);
}

type SyncHandlers = {
  create: (entry: Entry) => Promise<void>;
  update: (id: string, input: NewEntryInput, originalPhotoUrls: string[], originalVideoUrls: string[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/** Processes the queue in order, stopping (and keeping the rest queued) at the first failure. */
export async function flushQueue(handlers: SyncHandlers): Promise<void> {
  if (!(await isOnline())) return;

  let queue = await loadQueue();
  while (queue.length > 0) {
    const op = queue[0];
    try {
      if (op.type === 'create') await handlers.create(op.entry);
      else if (op.type === 'update') await handlers.update(op.id, op.input, op.originalPhotoUrls, op.originalVideoUrls);
      else await handlers.remove(op.id);
    } catch {
      return;
    }
    queue = queue.slice(1);
    await saveQueue(queue);
  }
}
