import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection, addDoc, onSnapshot, query,
  orderBy, limit, serverTimestamp, doc, updateDoc, increment,
} from 'firebase/firestore';
import { db } from './firebase';

export type CommentMode = 'OFF' | 'LIVE';
export type CommentStatus = 'active' | 'hidden' | 'reported';

export interface CommentDoc {
  id: string;
  symbol: string;
  text: string;
  userId: string;
  createdAt: Date;
  chartTime: string;
  status: CommentStatus;
  reportCount: number;
}

// ─── 定数 ────────────────────────────────────────────────
const RATE_LIMIT_MS = 10_000;       // 連投制限 10秒
const MAX_TEXT_LENGTH = 50;
const FETCH_LIMIT_LIVE = 50;

const NG_WORDS = [
  '死ね', '殺', 'バカ', 'アホ', 'うざい', 'きもい',
  'クズ', 'カス', 'ゴミ', 'マジで', 'fuck', 'shit', 'damn',
];

const STORAGE_KEYS = {
  userId:    '@kabuhub_user_id',
  lastPost:  '@kabuhub_last_post',
};

// ─── ユーザーID（匿名・永続） ──────────────────────────
async function getOrCreateUserId(): Promise<string> {
  const stored = await AsyncStorage.getItem(STORAGE_KEYS.userId);
  if (stored) return stored;
  const id = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  await AsyncStorage.setItem(STORAGE_KEYS.userId, id);
  return id;
}

// ─── NGワードチェック ─────────────────────────────────
function containsNG(text: string): boolean {
  const lower = text.toLowerCase();
  return NG_WORDS.some((w) => lower.includes(w.toLowerCase()));
}

// ─── Firestoreパス ────────────────────────────────────
function messagesRef(symbol: string) {
  return collection(db, 'comments', symbol, 'messages');
}

// ─── コメント投稿 ─────────────────────────────────────
export const CommentService = {
  async post(
    symbol: string,
    text: string,
    chartTime: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const trimmed = text.trim();

    if (!trimmed) return { ok: false, error: 'コメントが空です' };
    if (trimmed.length > MAX_TEXT_LENGTH)
      return { ok: false, error: `${MAX_TEXT_LENGTH}文字以内で入力してください` };
    if (containsNG(trimmed))
      return { ok: false, error: '不適切な言葉が含まれています' };

    // 連投チェック
    const lastPost = await AsyncStorage.getItem(STORAGE_KEYS.lastPost);
    if (lastPost && Date.now() - Number(lastPost) < RATE_LIMIT_MS) {
      const remain = Math.ceil((RATE_LIMIT_MS - (Date.now() - Number(lastPost))) / 1000);
      return { ok: false, error: `あと${remain}秒待ってください` };
    }

    const userId = await getOrCreateUserId();
    await addDoc(messagesRef(symbol), {
      symbol,
      text: trimmed,
      userId,
      createdAt: serverTimestamp(),
      chartTime,
      status: 'active',
      reportCount: 0,
    });

    await AsyncStorage.setItem(STORAGE_KEYS.lastPost, String(Date.now()));
    return { ok: true };
  },

  // ─── リアルタイム購読 ─────────────────────────────
  subscribe(
    symbol: string,
    mode: Exclude<CommentMode, 'OFF'>,
    onComments: (comments: CommentDoc[]) => void,
  ): () => void {
    const q = query(
      messagesRef(symbol),
      orderBy('createdAt', 'desc'),
      limit(FETCH_LIMIT_LIVE),
    );

    return onSnapshot(q, (snap) => {
      const docs: CommentDoc[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            symbol: data.symbol,
            text: data.text,
            userId: data.userId,
            createdAt: data.createdAt?.toDate() ?? new Date(),
            chartTime: data.chartTime ?? '',
            status: data.status ?? 'active',
            reportCount: data.reportCount ?? 0,
          } as CommentDoc;
        })
        .filter((c) => c.status === 'active');

      onComments(docs);
    });
  },

  // ─── 残りクールダウン秒数 ─────────────────────────
  async remainingCooldown(): Promise<number> {
    const last = await AsyncStorage.getItem(STORAGE_KEYS.lastPost);
    if (!last) return 0;
    return Math.max(0, Math.ceil((RATE_LIMIT_MS - (Date.now() - Number(last))) / 1000));
  },

  // ─── 通報 ─────────────────────────────────────────
  async report(symbol: string, messageId: string): Promise<void> {
    const ref = doc(db, 'comments', symbol, 'messages', messageId);
    await updateDoc(ref, {
      reportCount: increment(1),
      status: 'reported',
    });
  },
};
