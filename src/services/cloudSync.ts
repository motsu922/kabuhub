import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { StorageService } from './storage';

const COLLECTION = 'userSyncBackups';
const SYNC_TIMEOUT_MS = 20000;

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

function cleanForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createTimeoutError(): Error {
  const error = new Error('クラウド同期がタイムアウトしました。通信状態を確認してもう一度お試しください。');
  (error as Error & { code: string }).code = 'SYNC_TIMEOUT';
  return error;
}

async function withSyncTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(createTimeoutError()), SYNC_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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
    await withSyncTimeout(
      setDoc(syncDoc(syncId), {
        ...cleanForFirestore(data),
        syncId,
        updatedAt: serverTimestamp(),
      })
    );

    return { syncId, updatedAt: data.exportedAt };
  },

  async getMeta(syncIdInput: string): Promise<CloudSyncMeta | null> {
    const syncId = normalizeSyncId(syncIdInput);
    if (syncId.length < 8) return null;

    const snap = await withSyncTimeout(getDoc(syncDoc(syncId)));
    if (!snap.exists()) return null;
    const data = snap.data();
    const updatedAt = typeof data.exportedAt === 'string' ? data.exportedAt : null;
    return { syncId, updatedAt };
  },

  async restore(syncIdInput: string): Promise<CloudSyncMeta> {
    const syncId = normalizeSyncId(syncIdInput);
    if (syncId.length < 8) throw new Error('INVALID_SYNC_ID');

    const snap = await withSyncTimeout(getDoc(syncDoc(syncId)));
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
