import { StorageService } from './storage';

const COLLECTION = 'userSyncBackups';
const SYNC_TIMEOUT_MS = 20000;

type ExportedUserData = Awaited<ReturnType<typeof StorageService.exportUserData>>;

export interface CloudSyncMeta {
  syncId: string;
  updatedAt: string | null;
  deviceName?: string;
}

interface FirestoreField {
  stringValue?: string;
  integerValue?: string;
  timestampValue?: string;
  mapValue?: { fields?: Record<string, FirestoreField> };
  arrayValue?: { values?: FirestoreField[] };
  booleanValue?: boolean;
  doubleValue?: number;
  nullValue?: null;
}

interface FirestoreDocument {
  fields?: Record<string, FirestoreField>;
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

function cleanForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}

function createTimeoutError(): Error {
  return createError('SYNC_TIMEOUT', 'クラウド同期がタイムアウトしました。通信状態を確認してもう一度お試しください。');
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

function firestoreBaseUrl(): string {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) {
    throw createError('FIREBASE_CONFIG_MISSING', 'Firebase設定が不足しています。');
  }
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${COLLECTION}`;
}

function firestoreDocUrl(syncId: string): string {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  return `${firestoreBaseUrl()}/${encodeURIComponent(syncId)}?key=${apiKey}`;
}

function toFirestoreDocument(syncId: string, data: ExportedUserData): FirestoreDocument {
  const exportedAt = data.exportedAt;
  return {
    fields: {
      syncId: { stringValue: syncId },
      schemaVersion: { integerValue: String(data.schemaVersion) },
      exportedAt: { stringValue: exportedAt },
      updatedAt: { timestampValue: exportedAt },
      payloadJson: { stringValue: JSON.stringify(cleanForFirestore(data)) },
    },
  };
}

function readString(fields: Record<string, FirestoreField> | undefined, key: string): string | null {
  const value = fields?.[key]?.stringValue;
  return typeof value === 'string' ? value : null;
}

function parsePayload(fields: Record<string, FirestoreField> | undefined): Partial<ExportedUserData> {
  const payloadJson = readString(fields, 'payloadJson');
  if (payloadJson) {
    try {
      return JSON.parse(payloadJson) as ExportedUserData;
    } catch {
      throw createError('INVALID_CLOUD_DATA', 'クラウドデータの形式が壊れています。');
    }
  }

  return {
    exportedAt: readString(fields, 'exportedAt') ?? undefined,
  };
}

async function parseFirestoreError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    const code = body?.error?.status ?? `HTTP_${response.status}`;
    const message = body?.error?.message ?? 'Firestoreへの接続に失敗しました。';
    return createError(code, message);
  } catch {
    return createError(`HTTP_${response.status}`, 'Firestoreへの接続に失敗しました。');
  }
}

async function fetchDocument(syncId: string): Promise<FirestoreDocument | null> {
  const response = await withSyncTimeout(fetch(firestoreDocUrl(syncId)));
  if (response.status === 404) return null;
  if (!response.ok) throw await parseFirestoreError(response);
  return response.json() as Promise<FirestoreDocument>;
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
    if (!syncId.match(/^kh-[a-z0-9]{5}-[a-z0-9]{5}$/)) throw createError('INVALID_SYNC_ID', '同期IDの形式が正しくありません。');

    const data = await StorageService.exportUserData();
    const response = await withSyncTimeout(fetch(firestoreDocUrl(syncId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFirestoreDocument(syncId, data)),
    }));
    if (!response.ok) throw await parseFirestoreError(response);

    return { syncId, updatedAt: data.exportedAt };
  },

  async getMeta(syncIdInput: string): Promise<CloudSyncMeta | null> {
    const syncId = normalizeSyncId(syncIdInput);
    if (!syncId.match(/^kh-[a-z0-9]{5}-[a-z0-9]{5}$/)) return null;

    const doc = await fetchDocument(syncId);
    if (!doc) return null;
    const payload = parsePayload(doc.fields);
    return {
      syncId,
      updatedAt: payload.exportedAt ?? readString(doc.fields, 'exportedAt'),
    };
  },

  async restore(syncIdInput: string): Promise<CloudSyncMeta> {
    const syncId = normalizeSyncId(syncIdInput);
    if (!syncId.match(/^kh-[a-z0-9]{5}-[a-z0-9]{5}$/)) throw createError('INVALID_SYNC_ID', '同期IDの形式が正しくありません。');

    const doc = await fetchDocument(syncId);
    if (!doc) throw createError('NOT_FOUND', 'この同期IDのクラウドデータはありません。');
    const payload = parsePayload(doc.fields);

    await StorageService.importUserData({
      watchlist: Array.isArray(payload.watchlist) ? payload.watchlist : [],
      articles: Array.isArray(payload.articles) ? payload.articles : [],
      settings: payload.settings,
    });

    return {
      syncId,
      updatedAt: payload.exportedAt ?? readString(doc.fields, 'exportedAt'),
    };
  },
};
