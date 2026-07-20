const DATABASE_NAME = "nai-style-workbench";
const STORE_NAME = "style-experiment-images";

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, 1);
  request.onerror = () => reject(request.error);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => resolve(request.result);
});

const transact = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void) => {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    action(transaction.objectStore(STORE_NAME), resolve, reject);
  });
};

export const putExperimentImage = (id: string, dataUrl: string) => transact<void>("readwrite", (store, resolve, reject) => {
  const request = store.put(dataUrl, id);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

export const getExperimentImage = (id: string) => transact<string | null>("readonly", (store, resolve, reject) => {
  const request = store.get(id);
  request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
  request.onerror = () => reject(request.error);
});

export const deleteExperimentImage = (id: string) => transact<void>("readwrite", (store, resolve, reject) => {
  const request = store.delete(id);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});
