import assert from "node:assert/strict";
import PocketBase from "pocketbase";
import { loadCloudData, saveCloudData } from "../src/lib/pocketbaseSync.js";
import { seedState } from "../src/data/seed.js";
import { createReaderData } from "../src/lib/reader.js";

const url = process.env.POCKETBASE_TEST_URL || "http://127.0.0.1:8090";
const email = `integration-${Date.now()}@example.com`;
const password = "integration-pass-123";
const first = new PocketBase(url);
await first.collection("users").create({ email, password, passwordConfirm: password, name: "Integration" });
await first.collection("users").authWithPassword(email, password);

const state = structuredClone(seedState);
state.articles = state.articles.slice(0, 1);
state.vocabulary = state.vocabulary.slice(0, 1);
state.articles[0].analysis = [{ word: "cortex", definition: "大脑皮层", example: "the cortex" }];
state.articles[0].readerData = {
  ...createReaderData(state.articles[0]),
  mode: "focus",
  translations: { "segment-test": { translation: "集成测试翻译", updatedAt: new Date().toISOString() } },
};
const saved = await saveCloudData(first, first.authStore.record.id, state);
assert.equal(saved.status, "ok", JSON.stringify({ failedCollections: saved.failedCollections, errors: saved.errors?.map((error) => error?.message || String(error)) }));

const second = new PocketBase(url);
await second.collection("users").authWithPassword(email, password);
const restored = await loadCloudData(second, second.authStore.record.id);
assert.equal(restored.status, "ok", JSON.stringify({ failedCollections: restored.failedCollections, unavailableCollections: restored.unavailableCollections, errors: restored.errors }));
assert.equal(restored.data.articles[0].id, state.articles[0].id);
assert.equal(restored.data.articles[0].analysis[0].word, "cortex");
assert.equal(restored.data.articles[0].readerData.mode, "focus");
assert.equal(restored.data.articles[0].readerData.translations["segment-test"].translation, "集成测试翻译");
assert.equal(restored.data.vocabulary[0].id, state.vocabulary[0].id);
console.log(`PocketBase recovery flow restored ${restored.loaded} records`);

const superuserToken = process.env.POCKETBASE_SUPERUSER_TOKEN || process.env.token;
if (superuserToken) {
  const superuser = new PocketBase(url);
  superuser.authStore.save(superuserToken);
  await superuser.collection("users").delete(first.authStore.record.id);
  console.log("PocketBase recovery test data cleaned up");
}
