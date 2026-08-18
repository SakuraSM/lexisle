import assert from "node:assert/strict";
import { createServer } from "node:http";
import PocketBase from "pocketbase";
import { loadCloudData, saveCloudData } from "../src/lib/pocketbaseSync.js";
import { seedState } from "../src/data/seed.js";
import { createReaderData } from "../src/lib/reader.js";

const url = process.env.POCKETBASE_TEST_URL || "http://127.0.0.1:8090";
const mockModelPort = Number(process.env.MOCK_MODEL_PORT || 18081);
let providerRequests = 0;
const mockModel = createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(request.headers.authorization, "Bearer integration-provider-key");
    assert.equal(body.model, "integration-model");
    providerRequests += 1;
    const system = body.messages?.[0]?.content || "";
    const content = system.includes("连通性测试")
      ? "[]"
      : system.includes("翻译助手")
        ? JSON.stringify({ translation: "服务端翻译成功。" })
        : JSON.stringify([{ word: "cortex", definition: "大脑皮层", example: "The cortex becomes less active." }]);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
});
await new Promise((resolve) => mockModel.listen(mockModelPort, "127.0.0.1", resolve));

const email = `integration-${Date.now()}@example.com`;
const password = "integration-pass-123";
const first = new PocketBase(url);
try {
  const guest = new PocketBase(url);
  await assert.rejects(
    guest.send("/api/lexisle/ai/settings", { method: "GET" }),
    (error) => error?.status === 401,
  );

  await first.collection("users").create({ email, password, passwordConfirm: password, name: "Integration" });
  await first.collection("users").authWithPassword(email, password);

  const savedAiSettings = await first.send("/api/lexisle/ai/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enabled: true,
      endpoint: `http://127.0.0.1:${mockModelPort}/v1`,
      model: "integration-model",
      maxWords: 8,
      prompt: "识别重要词汇",
      apiKey: "integration-provider-key",
    }),
  });
  assert.equal(savedAiSettings.keyConfigured, true);
  assert.equal(savedAiSettings.apiKey, undefined);

  const loadedAiSettings = await first.send("/api/lexisle/ai/settings", { method: "GET" });
  assert.equal(loadedAiSettings.model, "integration-model");
  assert.equal(loadedAiSettings.keyConfigured, true);
  assert.equal(loadedAiSettings.ai_api_key_encrypted, undefined);

  await assert.rejects(
    first.send("/api/lexisle/ai/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false, endpoint: "https://10.0.0.1/v1", model: "blocked-model", maxWords: 8, prompt: "" }),
    }),
    (error) => error?.status === 400 && /内网地址/.test(error?.response?.message || ""),
  );

  const testResponse = await first.send("/api/lexisle/ai/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(testResponse.content, "[]");

  const state = structuredClone(seedState);
  state.settings.ai = { enabled: true, endpoint: `http://127.0.0.1:${mockModelPort}/v1/chat/completions`, model: "integration-model", maxWords: 8, prompt: "识别重要词汇", keyConfigured: true };
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

  const testAfterSync = await first.send("/api/lexisle/ai/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(testAfterSync.content, "[]");

  const second = new PocketBase(url);
  await second.collection("users").authWithPassword(email, password);
  const restored = await loadCloudData(second, second.authStore.record.id);
  assert.equal(restored.status, "ok", JSON.stringify({ failedCollections: restored.failedCollections, unavailableCollections: restored.unavailableCollections, errors: restored.errors }));
  assert.equal(restored.data.articles[0].id, state.articles[0].id);
  assert.equal(restored.data.articles[0].analysis[0].word, "cortex");
  assert.equal(restored.data.articles[0].readerData.mode, "focus");
  assert.equal(restored.data.articles[0].readerData.translations["segment-test"].translation, "集成测试翻译");
  assert.equal(restored.data.vocabulary[0].id, state.vocabulary[0].id);
  assert.equal(providerRequests, 2);
  console.log(`PocketBase recovery flow restored ${restored.loaded} records and proxied ${providerRequests} AI requests`);
} finally {
  await new Promise((resolve) => mockModel.close(resolve));

  const superuserToken = process.env.POCKETBASE_SUPERUSER_TOKEN || process.env.token;
  if (superuserToken && first.authStore.record?.id) {
    const superuser = new PocketBase(url);
    superuser.authStore.save(superuserToken);
    await superuser.collection("users").delete(first.authStore.record.id);
    console.log("PocketBase recovery test data cleaned up");
  }
}
