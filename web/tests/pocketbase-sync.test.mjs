import test from "node:test";
import assert from "node:assert/strict";
import { loadCloudData, saveCloudChanges, saveCloudData } from "../src/lib/pocketbaseSync.js";
import { seedState } from "../src/data/seed.js";

function missingError() {
  return Object.assign(new Error("missing"), { status: 404 });
}

function fakePocketBase(collections = {}, failures = {}) {
  return {
    collection(name) {
      return {
        async getFullList() {
          if (failures[name]) throw failures[name];
          return collections[name] || [];
        },
        async getFirstListItem() { throw missingError(); },
        async create(payload) {
          if (failures[name]) throw failures[name];
          return { id: `${name}-cloud`, ...payload };
        },
        async update(_id, payload) { return payload; },
      };
    },
  };
}

test("uses per-collection cursors for incremental cloud pulls", async () => {
  const calls = [];
  const pb = fakePocketBase();
  const originalCollection = pb.collection;
  pb.collection = (name) => {
    const api = originalCollection(name);
    api.getFullList = async (options) => {
      calls.push({ name, options });
      return [];
    };
    return api;
  };

  const cursor = { updated: "2026-08-22T10:00:00.000Z", id: "record-a" };
  const result = await loadCloudData(pb, "user-1", { cursors: { articles: cursor } });

  assert.match(calls.find((call) => call.name === "articles").options.filter, /updated >/);
  assert.equal(calls.find((call) => call.name === "articles").options.sort, "updated,id");
  assert.deepEqual(result.cursors.articles, cursor);
});

test("reports unavailable when required collections are missing", async () => {
  const failures = Object.fromEntries(["articles", "vocabulary_items", "daily_plans", "review_events", "notes", "user_settings"].map((name) => [name, missingError()]));
  const result = await loadCloudData(fakePocketBase({}, failures), "user-1");
  assert.equal(result.status, "unavailable");
  assert.equal(result.unavailableCollections.length, 6);
});

test("loads article AI analysis, reader cache, and cloud tombstones", async () => {
  const result = await loadCloudData(fakePocketBase({ articles: [
    { id: "1", client_id: "a", title: "A", analysis_json: [{ word: "resilience" }], reader_json: { mode: "focus", translations: { s1: { translation: "翻译" } } }, created: "2026-08-12", updated: "2026-08-12", deleted_at: "" },
    { id: "2", client_id: "b", title: "B", analysis_json: [], created: "2026-08-12", updated: "2026-08-13", deleted_at: "2026-08-13" },
  ] }), "user-1");
  assert.equal(result.status, "ok");
  assert.equal(result.data.articles[0].analysis[0].word, "resilience");
  assert.equal(result.data.articles[0].readerData.translations.s1.translation, "翻译");
  assert.equal(result.data.tombstones.articles[0].id, "b");
});

test("saves article reader data without an AI key", async () => {
  const state = structuredClone(seedState);
  state.articles[0].readerData = { mode: "focus", wordDetails: { "s1:context": { definition: "语境" } }, translations: {} };
  let articlePayload;
  const pb = fakePocketBase();
  const originalCollection = pb.collection;
  pb.collection = (name) => {
    const api = originalCollection(name);
    if (name === "articles") api.create = async (payload) => { if (payload.client_id === state.articles[0].id) articlePayload = payload; return payload; };
    return api;
  };
  await saveCloudData(pb, "user-1", state);
  assert.equal(articlePayload.reader_json.mode, "focus");
  assert.equal(articlePayload.reader_json.wordDetails["s1:context"].definition, "语境");
  assert.equal(JSON.stringify(articlePayload.reader_json).includes("apiKey"), false);
});

test("reports partial saves without treating them as success", async () => {
  const state = structuredClone(seedState);
  const pb = fakePocketBase({}, { notes: new Error("network") });
  const result = await saveCloudData(pb, "user-1", state);
  assert.equal(result.status, "partial");
  assert.deepEqual(result.failedCollections, ["notes"]);
  assert.ok(result.saved > 0);
});

test("never includes API keys in cloud settings payload", async () => {
  const state = structuredClone(seedState);
  state.settings.ai.apiKey = "secret";
  let settingsPayload;
  const pb = fakePocketBase();
  const originalCollection = pb.collection;
  pb.collection = (name) => {
    const api = originalCollection(name);
    if (name === "user_settings") api.create = async (payload) => { settingsPayload = payload; return { id: "settings", ...payload }; };
    return api;
  };
  await saveCloudData(pb, "user-1", state);
  assert.equal(settingsPayload.apiKey, undefined);
  assert.equal(JSON.stringify(settingsPayload).includes("secret"), false);
  assert.equal(settingsPayload.ai_endpoint, undefined);
});

test("uploads only entities present in the local sync outbox", async () => {
  const state = structuredClone(seedState);
  const createdCollections = [];
  const pb = fakePocketBase();
  const originalCollection = pb.collection;
  pb.collection = (name) => {
    const api = originalCollection(name);
    api.create = async (payload) => {
      createdCollections.push(name);
      return { id: `${name}-cloud`, ...payload };
    };
    return api;
  };

  const article = state.articles[0];
  const result = await saveCloudChanges(pb, "user-1", state, [{ storageKey: `articles:${article.id}`, collection: "articles", entityKey: article.id }]);

  assert.deepEqual(createdCollections, ["articles"]);
  assert.deepEqual(result.acknowledgedKeys, [`articles:${article.id}`]);
});
