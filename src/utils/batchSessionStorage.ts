import { CardImage, ProcessingStatus, ProcessingSettings, CropQuad, CardMetadataTags } from '../types';

export interface StoredCardRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  originalBlob: Blob;
  processedBlob?: Blob;
  status: ProcessingStatus;
  originalWidth: number;
  originalHeight: number;
  quad?: CropQuad;
  metadata?: CardMetadataTags;
  customSettings?: Partial<ProcessingSettings>;
}

export interface StoredBatchSession {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  settings: ProcessingSettings;
  cards: StoredCardRecord[];
}

const DB_NAME = 'cardcrop_batch_db';
const DB_VERSION = 1;
const STORE_NAME = 'batch_sessions';
const ACTIVE_SESSION_KEY = 'active_batch_session';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };
  });
}

/**
 * Persists current batch state into IndexedDB.
 */
export async function saveBatchSession(
  cards: CardImage[],
  settings: ProcessingSettings,
  sessionId = ACTIVE_SESSION_KEY
): Promise<void> {
  if (cards.length === 0) {
    await clearBatchSession(sessionId);
    return;
  }

  try {
    const db = await openDatabase();

    const storedCards: StoredCardRecord[] = await Promise.all(
      cards.map(async (c) => {
        let processedBlob: Blob | undefined = undefined;
        if (c.processedUrl && c.processedUrl.startsWith('blob:')) {
          try {
            const res = await fetch(c.processedUrl);
            processedBlob = await res.blob();
          } catch {
            // ignore if already revoked
          }
        }

        return {
          id: c.id,
          name: c.file.name,
          type: c.file.type || 'image/png',
          size: c.file.size,
          lastModified: c.file.lastModified || Date.now(),
          originalBlob: c.file,
          processedBlob,
          status: c.status,
          originalWidth: c.originalWidth,
          originalHeight: c.originalHeight,
          quad: c.quad,
          metadata: c.metadata,
          customSettings: c.customSettings
        };
      })
    );

    const session: StoredBatchSession = {
      sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings,
      cards: storedCards
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(session);

      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
  } catch (err) {
    console.warn('[Session Storage] Failed to save batch session:', err);
  }
}

/**
 * Retrieves the stored batch session from IndexedDB.
 */
export async function getStoredBatchSession(
  sessionId = ACTIVE_SESSION_KEY
): Promise<{ cards: CardImage[]; settings?: ProcessingSettings; savedAt: number } | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(sessionId);

      getReq.onsuccess = () => {
        const session = getReq.result as StoredBatchSession | undefined;
        if (!session || !session.cards || session.cards.length === 0) {
          resolve(null);
          return;
        }

        const restoredCards: CardImage[] = session.cards.map((s) => {
          const file = new File([s.originalBlob], s.name, {
            type: s.type,
            lastModified: s.lastModified
          });
          const previewUrl = URL.createObjectURL(file);
          let processedUrl: string | undefined = undefined;

          if (s.processedBlob) {
            processedUrl = URL.createObjectURL(s.processedBlob);
          }

          return {
            id: s.id,
            file,
            previewUrl,
            processedUrl,
            status: s.status,
            originalWidth: s.originalWidth,
            originalHeight: s.originalHeight,
            quad: s.quad,
            metadata: s.metadata,
            customSettings: s.customSettings
          };
        });

        resolve({
          cards: restoredCards,
          settings: session.settings,
          savedAt: session.updatedAt || session.createdAt
        });
      };

      getReq.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('[Session Storage] Failed to load batch session:', err);
    return null;
  }
}

/**
 * Updates a single card's processing result in the saved session for fast incremental writes.
 */
export async function updateCardRecordInSession(
  cardId: string,
  status: ProcessingStatus,
  processedBlob?: Blob,
  width?: number,
  height?: number,
  sessionId = ACTIVE_SESSION_KEY
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(sessionId);

      getReq.onsuccess = () => {
        const session = getReq.result as StoredBatchSession | undefined;
        if (!session || !session.cards) {
          resolve();
          return;
        }

        const card = session.cards.find((c) => c.id === cardId);
        if (card) {
          card.status = status;
          if (processedBlob) card.processedBlob = processedBlob;
          if (width) card.originalWidth = width;
          if (height) card.originalHeight = height;
          session.updatedAt = Date.now();
          store.put(session);
        }
        resolve();
      };

      getReq.onerror = () => resolve();
    });
  } catch {
    // Non-blocking update failure
  }
}

/**
 * Clears the stored session from IndexedDB.
 */
export async function clearBatchSession(sessionId = ACTIVE_SESSION_KEY): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const delReq = store.delete(sessionId);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[Session Storage] Failed to delete batch session:', err);
  }
}
