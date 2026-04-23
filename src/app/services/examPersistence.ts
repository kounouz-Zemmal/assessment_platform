type AttemptOutboxItem = {
  key: string;
  assessmentId: string;
  kind: "save" | "submit";
  answers: Record<string, string>;
  autoSubmitted?: boolean;
  updatedAt: string;
};

export type ExamSessionState = {
  assessmentId: string;
  answers: Record<string, string>;
  currentQuestionIndex: number;
  startedAtMs: number;
  durationSeconds: number;
  questionStartedAtMs?: number;
  questionTimeLimitSeconds?: number | null;
  examSnapshot?: unknown;
  updatedAt: string;
};

const DRAFT_PREFIX = "exam-draft:";
const DB_NAME = "assessment-offline-db";
const DB_VERSION = 2;
const STORE_NAME = "attempt_outbox";
const SESSION_STORE = "exam_session_state";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: "assessmentId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function ensureStore(storeName: string): Promise<IDBDatabase> {
  let db = await openDb();
  if (db.objectStoreNames.contains(storeName)) {
    return db;
  }

  db.close();
  // Force recreation if an old schema slipped through.
  await new Promise<void>((resolve, reject) => {
    const del = indexedDB.deleteDatabase(DB_NAME);
    del.onsuccess = () => resolve();
    del.onerror = () => reject(del.error);
    del.onblocked = () => reject(new Error("Database upgrade blocked by another tab."));
  });
  db = await openDb();
  return db;
}

export function getDraftKey(assessmentId: string) {
  return `${DRAFT_PREFIX}${assessmentId}`;
}

export function saveDraft(assessmentId: string, payload: unknown) {
  localStorage.setItem(getDraftKey(assessmentId), JSON.stringify(payload));
}

export function readDraft<T>(assessmentId: string): T | null {
  const raw = localStorage.getItem(getDraftKey(assessmentId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearDraft(assessmentId: string) {
  localStorage.removeItem(getDraftKey(assessmentId));
}

export async function saveSessionState(state: ExamSessionState) {
  const db = await ensureStore(SESSION_STORE);
  const tx = db.transaction(SESSION_STORE, "readwrite");
  tx.objectStore(SESSION_STORE).put(state);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function readSessionState(assessmentId: string): Promise<ExamSessionState | null> {
  const db = await ensureStore(SESSION_STORE);
  const tx = db.transaction(SESSION_STORE, "readonly");
  const request = tx.objectStore(SESSION_STORE).get(assessmentId);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as ExamSessionState | undefined) || null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSessionState(assessmentId: string) {
  const db = await ensureStore(SESSION_STORE);
  const tx = db.transaction(SESSION_STORE, "readwrite");
  tx.objectStore(SESSION_STORE).delete(assessmentId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueueOutbox(item: Omit<AttemptOutboxItem, "key" | "updatedAt">) {
  const db = await ensureStore(STORE_NAME);
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const key = `${item.assessmentId}:${item.kind}`;
  store.put({ ...item, key, updatedAt: new Date().toISOString() } satisfies AttemptOutboxItem);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listOutbox(): Promise<AttemptOutboxItem[]> {
  const db = await ensureStore(STORE_NAME);
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve((request.result || []) as AttemptOutboxItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removeOutboxItem(key: string) {
  const db = await ensureStore(STORE_NAME);
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
