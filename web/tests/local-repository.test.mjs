import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { seedState } from "../src/data/seed.js";
import { migrateState, STORAGE_KEY_V3 } from "../src/lib/stateModel.js";

const values = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  },
};

const repository = await import("../src/lib/localRepository.js");

test("migrates the legacy snapshot to IndexedDB and creates an initial outbox", async () => {
  await repository.clearLocalDatabaseForTests();
  values.clear();
  const legacyState = structuredClone(seedState);
  legacyState.version = 3;
  legacyState.articles = legacyState.articles.slice(0, 1);
  values.set(STORAGE_KEY_V3, JSON.stringify(legacyState));

  const hydrated = await repository.hydrateLocalState({ migrateState, seedState });
  const pending = await repository.listPendingSyncEntries();

  assert.equal(hydrated.version, 4);
  assert.equal(hydrated.articles.length, 1);
  assert.ok(pending.some((entry) => entry.storageKey === `articles:${hydrated.articles[0].id}`));
});

test("persists only changed entities and coalesces repeated outbox updates", async () => {
  const previousState = await repository.hydrateLocalState({ migrateState, seedState });
  const article = previousState.articles[0];
  const firstState = {
    ...previousState,
    articles: previousState.articles.map((item) => item.id === article.id ? { ...item, progress: 20, updatedAt: "2026-08-22T10:00:00.000Z" } : item),
  };
  const secondState = {
    ...firstState,
    articles: firstState.articles.map((item) => item.id === article.id ? { ...item, progress: 40, updatedAt: "2026-08-22T10:01:00.000Z" } : item),
  };

  await repository.persistLocalChanges({ previousState, nextState: firstState });
  await repository.persistLocalChanges({ previousState: firstState, nextState: secondState });
  const pending = await repository.listPendingSyncEntries();
  const articleEntries = pending.filter((entry) => entry.storageKey === `articles:${article.id}`);

  assert.equal(articleEntries.length, 1);
  assert.equal(articleEntries[0].updatedAt, "2026-08-22T10:01:00.000Z");
});

test("keeps cloud cursors isolated per signed-in user", async () => {
  await repository.writeCloudSyncCursors("user-a", { articles: { updated: "2026-08-22T10:00:00.000Z", id: "a" } });
  assert.equal((await repository.readCloudSyncCursors("user-a")).articles.id, "a");
  assert.deepEqual(await repository.readCloudSyncCursors("user-b"), {});
});
