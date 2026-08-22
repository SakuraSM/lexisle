import { openDB } from "idb";
import { STORAGE_KEY_V1, STORAGE_KEY_V2, STORAGE_KEY_V3 } from "./stateModel.js";

const DATABASE_NAME = "lexisle-learning";
const DATABASE_VERSION = 1;
const SNAPSHOT_VERSION = 4;
const SETTINGS_KEY = "current";
const META_STATE_VERSION_KEY = "state-version";
const CLOUD_CURSOR_KEY_PREFIX = "cloud-cursors:";

const ENTITY_STORES = ["articles", "vocabulary", "dailyPlans", "reviewEvents", "notes", "tombstones"];
const ALL_STORES = [...ENTITY_STORES, "settings", "syncOutbox", "syncMeta"];

let databasePromise;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = openDB(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(database) {
        for (const storeName of ALL_STORES) {
          if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName, { keyPath: "storageKey" });
        }
      },
    });
  }
  return databasePromise;
}

function readLegacyState() {
  for (const storageKey of [STORAGE_KEY_V3, STORAGE_KEY_V2, STORAGE_KEY_V1]) {
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      if (value && typeof value === "object") return value;
    } catch {
      // Continue with the next compatible snapshot.
    }
  }
  return null;
}

function toStoredRecord(storageKey, value) {
  return { storageKey, value };
}

function recordMap(records, getKey = (record) => record.id) {
  return new Map(records.map((record) => [String(getKey(record)), record]));
}

function flattenTombstones(tombstones) {
  return Object.entries(tombstones || {}).flatMap(([kind, records]) => records.map((record) => ({ ...record, tombstoneKind: kind })));
}

function toStateEntities(state) {
  return {
    articles: recordMap(state.articles || []),
    vocabulary: recordMap(state.vocabulary || []),
    dailyPlans: recordMap(Object.values(state.plans || {}), (plan) => plan.date),
    reviewEvents: recordMap(state.reviewEvents || []),
    notes: recordMap(state.notes || []),
    tombstones: recordMap(flattenTombstones(state.tombstones), (record) => `${record.tombstoneKind}:${record.id}`),
  };
}

function stableRecord(value) {
  return JSON.stringify(value);
}

function changedRecords(previousRecords, nextRecords) {
  const changed = [];
  for (const [storageKey, value] of nextRecords) {
    if (!previousRecords.has(storageKey) || stableRecord(previousRecords.get(storageKey)) !== stableRecord(value)) changed.push([storageKey, value]);
  }
  return changed;
}

function removedKeys(previousRecords, nextRecords) {
  return [...previousRecords.keys()].filter((storageKey) => !nextRecords.has(storageKey));
}

function outboxKey(storeName, storageKey) {
  return `${storeName}:${storageKey}`;
}

async function readStoredValues(database, storeName) {
  const records = await database.getAll(storeName);
  return records.map((record) => record.value);
}

async function readIndexedState(database) {
  const [articles, vocabulary, dailyPlans, reviewEvents, notes, tombstones, settingsRecord, versionRecord] = await Promise.all([
    readStoredValues(database, "articles"),
    readStoredValues(database, "vocabulary"),
    readStoredValues(database, "dailyPlans"),
    readStoredValues(database, "reviewEvents"),
    readStoredValues(database, "notes"),
    readStoredValues(database, "tombstones"),
    database.get("settings", SETTINGS_KEY),
    database.get("syncMeta", META_STATE_VERSION_KEY),
  ]);
  if (!versionRecord) return null;

  const groupedTombstones = { articles: [], vocabulary: [], notes: [] };
  for (const record of tombstones) {
    const { tombstoneKind, ...value } = record;
    if (groupedTombstones[tombstoneKind]) groupedTombstones[tombstoneKind].push(value);
  }

  return {
    version: Number(versionRecord.value) || SNAPSHOT_VERSION,
    articles,
    vocabulary,
    plans: Object.fromEntries(dailyPlans.map((plan) => [plan.date, plan])),
    reviewEvents,
    notes,
    settings: settingsRecord?.value,
    tombstones: groupedTombstones,
  };
}

function createOutboxEntry(storeName, storageKey, value) {
  return {
    storageKey: outboxKey(storeName, storageKey),
    collection: storeName,
    entityKey: storageKey,
    updatedAt: value?.updatedAt || value?.deletedAt || new Date().toISOString(),
  };
}

async function replaceDatabaseSnapshot(database, state, shouldEnqueueSync) {
  const transaction = database.transaction(ALL_STORES, "readwrite");
  const entities = toStateEntities(state);
  for (const storeName of ENTITY_STORES) {
    const store = transaction.objectStore(storeName);
    await store.clear();
    for (const [storageKey, value] of entities[storeName]) {
      await store.put(toStoredRecord(storageKey, value));
      if (shouldEnqueueSync) await transaction.objectStore("syncOutbox").put(createOutboxEntry(storeName, storageKey, value));
    }
  }
  await transaction.objectStore("settings").put(toStoredRecord(SETTINGS_KEY, state.settings));
  if (shouldEnqueueSync) await transaction.objectStore("syncOutbox").put(createOutboxEntry("settings", SETTINGS_KEY, state.settings));
  await transaction.objectStore("syncMeta").put(toStoredRecord(META_STATE_VERSION_KEY, SNAPSHOT_VERSION));
  await transaction.done;
}

export async function hydrateLocalState({ migrateState, seedState }) {
  const database = await openDatabase();
  const indexedState = await readIndexedState(database);
  if (indexedState) return migrateState(indexedState, seedState);

  const migratedState = migrateState(readLegacyState(), seedState);
  await replaceDatabaseSnapshot(database, migratedState, true);
  return migratedState;
}

export async function persistLocalChanges({ previousState, nextState, shouldEnqueueSync = true }) {
  const database = await openDatabase();
  const transaction = database.transaction(ALL_STORES, "readwrite");
  const previousEntities = toStateEntities(previousState);
  const nextEntities = toStateEntities(nextState);

  for (const storeName of ENTITY_STORES) {
    const store = transaction.objectStore(storeName);
    for (const storageKey of removedKeys(previousEntities[storeName], nextEntities[storeName])) await store.delete(storageKey);
    for (const [storageKey, value] of changedRecords(previousEntities[storeName], nextEntities[storeName])) {
      await store.put(toStoredRecord(storageKey, value));
      if (shouldEnqueueSync) await transaction.objectStore("syncOutbox").put(createOutboxEntry(storeName, storageKey, value));
    }
  }

  if (stableRecord(previousState.settings) !== stableRecord(nextState.settings)) {
    await transaction.objectStore("settings").put(toStoredRecord(SETTINGS_KEY, nextState.settings));
    if (shouldEnqueueSync) await transaction.objectStore("syncOutbox").put(createOutboxEntry("settings", SETTINGS_KEY, nextState.settings));
  }
  await transaction.objectStore("syncMeta").put(toStoredRecord(META_STATE_VERSION_KEY, SNAPSHOT_VERSION));
  await transaction.done;
}

export async function listPendingSyncEntries() {
  const database = await openDatabase();
  return database.getAll("syncOutbox");
}

export async function acknowledgeSyncEntries(storageKeys) {
  if (!storageKeys.length) return;
  const database = await openDatabase();
  const transaction = database.transaction("syncOutbox", "readwrite");
  await Promise.all(storageKeys.map((storageKey) => transaction.store.delete(storageKey)));
  await transaction.done;
}

export async function readCloudSyncCursors(userId) {
  if (!userId) return {};
  const database = await openDatabase();
  const record = await database.get("syncMeta", `${CLOUD_CURSOR_KEY_PREFIX}${userId}`);
  return record?.value && typeof record.value === "object" ? record.value : {};
}

export async function writeCloudSyncCursors(userId, cursors) {
  if (!userId) return;
  const database = await openDatabase();
  await database.put("syncMeta", toStoredRecord(`${CLOUD_CURSOR_KEY_PREFIX}${userId}`, cursors));
}

export async function clearLocalDatabaseForTests() {
  const database = await openDatabase();
  const transaction = database.transaction(ALL_STORES, "readwrite");
  await Promise.all(ALL_STORES.map((storeName) => transaction.objectStore(storeName).clear()));
  await transaction.done;
}
