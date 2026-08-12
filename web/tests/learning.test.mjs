import test from "node:test";
import assert from "node:assert/strict";
import { analyzeText, reviewWord } from "../src/lib/learning.js";
import { analyzeVocabularyWithAi, normalizeChatEndpoint, validateAiVocabulary } from "../src/lib/aiVocabulary.js";

test("extracts known and uncommon words from an English article", () => {
  const words = analyzeText("Researchers observed unprecedented biodiversity. The implications for sustainable conservation are important. Researchers carefully documented the ecosystem.");
  assert.ok(words.some((item) => item.word === "unprecedented"));
  assert.ok(words.some((item) => item.word === "biodiversity"));
  assert.ok(words.some((item) => item.word === "implications"));
});

test("a good review increases repetition and schedules a future review", () => {
  const start = new Date("2026-08-12T08:00:00.000Z");
  const reviewed = reviewWord({ repetition: 1, intervalDays: 1, easeFactor: 2.5, status: "learning" }, "good", start);
  assert.equal(reviewed.repetition, 2);
  assert.equal(reviewed.intervalDays, 3);
  assert.equal(reviewed.nextReviewAt, "2026-08-15T08:00:00.000Z");
});

test("an incorrect review resets the interval", () => {
  const reviewed = reviewWord({ repetition: 5, intervalDays: 14, easeFactor: 2.6, status: "review" }, "again", new Date("2026-08-12T08:00:00.000Z"));
  assert.equal(reviewed.repetition, 0);
  assert.equal(reviewed.intervalDays, 1);
  assert.equal(reviewed.status, "learning");
});

test("normalizes an OpenAI-compatible API base URL", () => {
  assert.equal(normalizeChatEndpoint("https://models.example.com/v1/"), "https://models.example.com/v1/chat/completions");
  assert.equal(normalizeChatEndpoint("https://models.example.com/chat/completions"), "https://models.example.com/chat/completions");
});

test("validates AI vocabulary against the original article", () => {
  const result = validateAiVocabulary([
    { word: "resilience", definition: "恢复力", example: "Wildlife shows resilience." },
    { word: "invented", definition: "不存在", example: "" },
  ], "Wildlife shows resilience in cities.", 10);
  assert.deepEqual(result.map((item) => item.word), ["resilience"]);
  assert.equal(result[0].source, "ai");
});

test("reads structured vocabulary from an OpenAI-compatible response", async () => {
  const fakeFetch = async (url, options) => {
    assert.equal(url, "https://models.example.com/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer secret");
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: "```json\n[{\"word\":\"biodiversity\",\"definition\":\"生物多样性\",\"example\":\"Healthy reefs support biodiversity.\"}]\n```" } }] }),
    };
  };
  const result = await analyzeVocabularyWithAi({ endpoint: "https://models.example.com/v1", model: "test-model", maxWords: 8, prompt: "识别生词" }, "Healthy reefs support biodiversity.", "secret", fakeFetch);
  assert.equal(result[0].word, "biodiversity");
  assert.equal(result[0].definition, "生物多样性");
});
