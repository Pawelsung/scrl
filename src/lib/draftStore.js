// Draft persistence in IndexedDB. Photos are stored once per asset instead of
// being re-serialised into a single localStorage string on every autosave,
// which used to overflow the ~5MB localStorage quota after a few photos.

const DB_NAME = "scrl";
const DB_VERSION = 1;
const ASSETS = "assets";
const DRAFTS = "drafts";
const DRAFT_KEY = "current";
const LEGACY_STORAGE_KEY = "scrl_draft_v1";

let dbPromise = null;
// id -> src of the asset record last written, so unchanged photos are skipped.
const writtenAssetSrc = new Map();

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new DOMException("Transaction aborted", "AbortError"));
  });
}

function openDb() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS);
      };
      request.onsuccess = () => {
        const db = request.result;
        // Let another tab upgrade or delete the database instead of blocking it.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function readLegacyDraft() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return { savedAt: parsed.savedAt || null, snapshot: parsed.snapshot || parsed };
  } catch {
    return null;
  }
}

function removeLegacyDraft() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage access can throw in private mode; nothing to clean up then.
  }
}

// Ask the browser not to evict drafts under storage pressure (Safari is aggressive).
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

export async function loadDraft() {
  let db;
  try {
    db = await openDb();
  } catch {
    return readLegacyDraft();
  }

  const tx = db.transaction([ASSETS, DRAFTS], "readonly");
  const [record, assets] = await Promise.all([
    promisify(tx.objectStore(DRAFTS).get(DRAFT_KEY)),
    promisify(tx.objectStore(ASSETS).getAll()),
  ]);

  if (!record) {
    const legacy = readLegacyDraft();
    if (legacy) {
      await saveDraft(legacy.snapshot);
      removeLegacyDraft();
    }
    return legacy;
  }

  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  assets.forEach((asset) => writtenAssetSrc.set(asset.id, asset.src));
  const { imageIds = [], ...snapshot } = record.snapshot;
  return {
    savedAt: record.savedAt,
    snapshot: { ...snapshot, images: imageIds.map((id) => byId.get(id)).filter(Boolean) },
  };
}

export async function saveDraft(snapshot) {
  const db = await openDb();
  const { images = [], ...rest } = snapshot;
  const tx = db.transaction([ASSETS, DRAFTS], "readwrite");
  const assetStore = tx.objectStore(ASSETS);
  const currentIds = new Set(images.map((image) => image.id));

  // Without a record of what is stored, start the asset store over so no orphans remain.
  if (!writtenAssetSrc.size) assetStore.clear();
  for (const image of images) {
    if (writtenAssetSrc.get(image.id) === image.src) continue;
    assetStore.put(image);
    writtenAssetSrc.set(image.id, image.src);
  }
  for (const id of [...writtenAssetSrc.keys()]) {
    if (currentIds.has(id)) continue;
    assetStore.delete(id);
    writtenAssetSrc.delete(id);
  }

  tx.objectStore(DRAFTS).put(
    { savedAt: Date.now(), snapshot: { ...rest, imageIds: images.map((image) => image.id) } },
    DRAFT_KEY
  );

  try {
    await transactionDone(tx);
  } catch (error) {
    // The cache no longer reflects the database; force a full rewrite next time.
    writtenAssetSrc.clear();
    throw error;
  }
}

export async function clearDraft() {
  removeLegacyDraft();
  writtenAssetSrc.clear();
  const db = await openDb();
  const tx = db.transaction([ASSETS, DRAFTS], "readwrite");
  tx.objectStore(ASSETS).clear();
  tx.objectStore(DRAFTS).clear();
  await transactionDone(tx);
}
