import { StagedUploadRecord } from '../types/stagedUpload';

const DATABASE_NAME = 'securelab-staged-uploads';
const DATABASE_VERSION = 6;
const LEGACY_STORE_NAME = 'uploads';
const STORE_NAME = 'uploadsByUploadId';
const COUNTER_STORE_NAME = 'uploadSequenceCounters';
const SESSION_INDEX = 'sessionKey';

interface LegacyStagedUploadRecord extends Omit<StagedUploadRecord, 'uploadId' | 'uploadSequence' | 'originalName' | 'submissionName'> {
  id: string;
  name: string;
}

type MigratingStagedUploadRecord = Omit<StagedUploadRecord, 'uploadSequence'> & {
  uploadSequence?: number;
  displayName?: string;
};

const createUploadId = () =>
  globalThis.crypto?.randomUUID?.() || `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: 'uploadId' });
      if (!store.indexNames.contains(SESSION_INDEX)) {
        store.createIndex(SESSION_INDEX, SESSION_INDEX, { unique: false });
      }
      const counterStore = database.objectStoreNames.contains(COUNTER_STORE_NAME)
        ? request.transaction!.objectStore(COUNTER_STORE_NAME)
        : database.createObjectStore(COUNTER_STORE_NAME, { keyPath: 'sessionKey' });

      const migrateStagedRecords = () => {
        const recordsRequest = store.getAll();
        recordsRequest.onsuccess = () => {
          const grouped = new Map<string, MigratingStagedUploadRecord[]>();
          (recordsRequest.result as MigratingStagedUploadRecord[]).forEach((record) => {
            const group = grouped.get(record.sessionKey) || [];
            group.push(record);
            grouped.set(record.sessionKey, group);
          });
          grouped.forEach((records, sessionKey) => {
            records.sort((a, b) => a.lastUpdated.localeCompare(b.lastUpdated));
            let nextSequence = records.reduce(
              (maximum, record) => Math.max(maximum, record.uploadSequence || 0),
              0
            ) + 1;
            records.forEach((migrating) => {
              const { displayName, ...record } = migrating;
              const uploadSequence = migrating.uploadSequence || nextSequence++;
              store.put({
                ...record,
                uploadSequence,
                submissionName: record.submissionName || displayName || record.originalName,
              });
            });
            counterStore.put({ sessionKey, nextSequence });
          });
        };
      };

      if (event.oldVersion < 2 && database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        const legacyStore = request.transaction!.objectStore(LEGACY_STORE_NAME);
        const cursorRequest = legacyStore.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            migrateStagedRecords();
            return;
          }
          const legacy = cursor.value as LegacyStagedUploadRecord;
          const { id, name, ...record } = legacy;
          store.put({
            ...record,
            uploadId: id || createUploadId(),
            originalName: name,
            submissionName: name,
          });
          cursor.continue();
        };
      } else if (event.oldVersion < 6) {
        migrateStagedRecords();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    operation(store, resolve, reject);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getStagedUploads = (sessionKey: string): Promise<StagedUploadRecord[]> =>
  runTransaction<StagedUploadRecord[]>('readonly', (store, resolve, reject) => {
    const request = store.index(SESSION_INDEX).getAll(sessionKey);
    request.onsuccess = () => resolve(request.result as StagedUploadRecord[]);
    request.onerror = () => reject(request.error);
  });

export const saveStagedUpload = (record: StagedUploadRecord): Promise<void> =>
  runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

export const deleteStagedUpload = (uploadId: string): Promise<void> =>
  runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(uploadId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

export const reserveUploadSequences = async (
  sessionKey: string,
  count: number
): Promise<number[]> => {
  if (count <= 0) return [];
  const database = await openDatabase();
  return new Promise<number[]>((resolve, reject) => {
    const transaction = database.transaction(COUNTER_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(COUNTER_STORE_NAME);
    const request = store.get(sessionKey);
    let sequences: number[] = [];

    request.onsuccess = () => {
      const nextSequence = Math.max(1, Number(request.result?.nextSequence) || 1);
      sequences = Array.from({ length: count }, (_, index) => nextSequence + index);
      store.put({ sessionKey, nextSequence: nextSequence + count });
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(sequences);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
};
