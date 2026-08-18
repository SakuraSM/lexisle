import test from "node:test";
import assert from "node:assert/strict";
import { analyzeText, previewReviewSchedule, reviewWord } from "../src/lib/learning.js";
import { analyzeVocabularyWithAi, lookupWordWithAi, saveAiProviderSettings, translateReaderSegment, validateAiVocabulary, validateSegmentTranslation, validateWordDetail } from "../src/lib/aiVocabulary.js";

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

test("review preview matches the committed schedule", () => {
  const now = new Date("2026-08-12T08:00:00.000Z");
  const item = { repetition: 2, intervalDays: 3, easeFactor: 2.5, status: "review" };
  assert.deepEqual(previewReviewSchedule(item, "easy", now), {
    intervalDays: reviewWord(item, "easy", now).intervalDays,
    nextReviewAt: reviewWord(item, "easy", now).nextReviewAt,
  });
});

test("validates AI vocabulary against the original article", () => {
  const result = validateAiVocabulary([
    { word: "resilience", definition: "恢复力", example: "Wildlife shows resilience." },
    { word: "invented", definition: "不存在", example: "" },
  ], "Wildlife shows resilience in cities.", 10);
  assert.deepEqual(result.map((item) => item.word), ["resilience"]);
  assert.equal(result[0].source, "ai");
});

test("routes vocabulary analysis through the authenticated PocketBase endpoint", async () => {
  const fakeSend = async (path, options) => {
    assert.equal(path, "/api/lexisle/ai/analyze-vocabulary");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { articleText: "Healthy reefs support biodiversity." });
    return { content: "```json\n[{\"word\":\"biodiversity\",\"definition\":\"生物多样性\",\"example\":\"Healthy reefs support biodiversity.\"}]\n```" };
  };
  const result = await analyzeVocabularyWithAi({ maxWords: 8 }, "Healthy reefs support biodiversity.", fakeSend);
  assert.equal(result[0].word, "biodiversity");
  assert.equal(result[0].definition, "生物多样性");
});

test("saves provider credentials only through the PocketBase settings route", async () => {
  const fakeSend = async (path, options) => {
    assert.equal(path, "/api/lexisle/ai/settings");
    const body = JSON.parse(options.body);
    assert.equal(body.apiKey, "server-secret");
    assert.equal(body.endpoint, "https://models.example.com/v1");
    return { ...body, apiKey: undefined, keyConfigured: true };
  };
  const saved = await saveAiProviderSettings({ enabled: true, endpoint: "https://models.example.com/v1", model: "test", maxWords: 8, prompt: "识别生词" }, { apiKey: "server-secret" }, fakeSend);
  assert.equal(saved.keyConfigured, true);
  assert.equal(saved.apiKey, undefined);
});

test("validates reader translation and limits rich word details", () => {
  assert.deepEqual(validateSegmentTranslation({ translation: "这是一段翻译。" }), { translation: "这是一段翻译。" });
  const detail = validateWordDetail({ word: "context", contextMeaning: "语境", meanings: ["一", "二", "三", "四"], collocations: ["in context", "context clue", "social context", "extra"] }, { word: "context" });
  assert.equal(detail.meanings.length, 3);
  assert.equal(detail.collocations.length, 3);
  assert.equal(detail.source, "ai");
});

test("sends only the active segment for translation and word lookup", async () => {
  const requests = [];
  const fakeSend = async (path, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    const isTranslation = path.endsWith("translate-segment");
    return { content: JSON.stringify(isTranslation
      ? { translation: "当前段落的翻译。" }
      : { word: "context", lemma: "context", part: "n.", contextMeaning: "语境", contextExplanation: "这里指文章语境。", meanings: ["语境"], collocations: ["in context"], example: "Learn in context.", memoryTip: "联系上下文" }) };
  };
  const config = { endpoint: "https://models.example.com/v1", model: "test" };
  const segment = { id: "segment-a", text: "Learn the word in context." };
  assert.equal((await translateReaderSegment(config, segment, { previous: "Before.", next: "After." }, fakeSend)).translation, "当前段落的翻译。");
  assert.equal((await lookupWordWithAi(config, "context", segment.text, segment, fakeSend)).contextMeaning, "语境");
  assert.equal(JSON.stringify(requests).includes("unrelated full article"), false);
  assert.equal(JSON.stringify(requests).includes("models.example.com"), false);
});

test("reports malformed reader JSON without discarding local reading", async () => {
  const fakeSend = async () => ({ content: "not-json" });
  await assert.rejects(() => translateReaderSegment({ endpoint: "https://models.example.com/v1", model: "test" }, { text: "Text." }, {}, fakeSend), /JSON/);
});
