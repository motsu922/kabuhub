import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { StorageService } from './storage';

const COLLECTION = 'userSyncBackups';

export interface CloudSyncMeta {
  syncId: string;
  updatedAt: string | null;
  deviceName?: string;
}

function normalizeSyncId(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function generateSyncId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 10; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `kh-${suffix.slice(0, 5)}-${suffix.slice(5)}`;
}

function syncDoc(syncId: string) {
  return doc(db, COLLECTION, syncId);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : error.name;
    return `${code}: ${error.message}`;
  }
  return 'UNKNOWN_ERROR';
}

export const CloudSyncService = {
  generateSyncId,
  normalizeSyncId,
  formatError,

  async upload(syncIdInput: string): Promise<CloudSyncMeta> {
    const syncId = normalizeSyncId(syncIdInput);
    if (syncId.length < 8) throw new Error('INVALID_SYNC_ID');

    const data = await StorageService.exportUserData();
    await setDoc(syncDoc(syncId), {
      ...data,
      syncId,
      updatedAt: serverTimestamp(),
    });

    return { syncId, updatedAt: data.exportedAt };
  },

  async getMeta(syncIdInput: string): Promise<CloudSyncMeta | null> {
    const syncId = normalizeSyncId(syncIdInput);
    if (syncId.length < 8) return null;

    const snap = await getDoc(syncDoc(syncId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const updatedAt = typeof data.exportedAt === 'string' ? data.exportedAt : null;
    return { syncId, updatedAt };
  },

  async restore(syncIdInput: string): Promise<CloudSyncMeta> {
    const syncId = normalizeSyncId(syncIdInput);
    if (syncId.length < 8) throw new Error('INVALID_SYNC_ID');

    const snap = await getDoc(syncDoc(syncId));
    if (!snap.exists()) throw new Error('NOT_FOUND');
    const data = snap.data();

    await StorageService.importUserData({
      watchlist: Array.isArray(data.watchlist) ? data.watchlist : [],
      articles: Array.isArray(data.articles) ? data.articles : [],
      settings: data.settings,
    });

    return {
      syncId,
      updatedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
    };
  },
};
