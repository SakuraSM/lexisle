import test from "node:test";
import assert from "node:assert/strict";
import { seedState } from "../src/data/seed.js";
import { calculateLearningReport, calculateStreak, ensureDailyPlan, mergeCloudState, migrateState } from "../src/lib/stateModel.js";

test("migrates v1 state to v4 and creates reader data and the Shanghai daily plan", () => {
  const migrated = migrateState({ version: 1, articles: [], vocabulary: [], notes: [], reviewEvents: [], plans: {}, settings: { dailyGoal: 9 } }, seedState, new Date("2026-08-12T16:30:00.000Z"));
  assert.equal(migrated.version, 4);
  assert.equal(migrated.plans["2026-08-13"].wordTarget, 9);
  assert.deepEqual(migrated.tombstones, { articles: [], vocabulary: [], notes: [] });
});

test("migrates a v2 article to segmented reader data without losing progress", () => {
  const migrated = migrateState({
    ...seedState,
    version: 2,
    articles: [{ ...seedState.articles[0], progress: 37, readerData: undefined }],
  }, seedState, new Date("2026-08-12T08:00:00.000Z"));
  assert.equal(migrated.articles[0].readerData.mode, "free");
  assert.equal(migrated.articles[0].readerData.freeProgress, 37);
  assert.ok(migrated.articles[0].readerData.segments.length > 0);
});

test("ensures a new plan after midnight without changing history", () => {
  const before = migrateState({ ...seedState, plans: { "2026-08-12": { date: "2026-08-12", wordTarget: 5 } } }, seedState, new Date("2026-08-12T08:00:00.000Z"));
  const after = ensureDailyPlan(before, "2026-08-13", new Date("2026-08-12T16:01:00.000Z"));
  assert.ok(after.plans["2026-08-12"]);
  assert.equal(after.plans["2026-08-13"].wordTarget, before.settings.dailyGoal);
});

test("calculates streak and report from real plan and review events", () => {
  const state = {
    ...seedState,
    plans: {
      "2026-08-10": { readingDone: 1, readingTarget: 1, wordDone: 0, wordTarget: 5, reviewDone: 0, reviewTarget: 8 },
      "2026-08-11": { readingDone: 0, readingTarget: 1, wordDone: 1, wordTarget: 5, reviewDone: 0, reviewTarget: 8 },
      "2026-08-12": { readingDone: 0, readingTarget: 1, wordDone: 0, wordTarget: 5, reviewDone: 1, reviewTarget: 8 },
    },
    reviewEvents: [{ id: "1", result: "good" }, { id: "2", result: "again" }],
  };
  assert.equal(calculateStreak(state.plans, "2026-08-12"), 3);
  assert.equal(calculateLearningReport(state, "2026-08-12").accuracy, 50);
});

test("merges records by updated time and applies cloud soft deletes", () => {
  const local = migrateState({ ...seedState, articles: [{ id: "a", title: "local", updatedAt: "2026-08-12T10:00:00.000Z" }], vocabulary: [], notes: [], reviewEvents: [], plans: {}, tombstones: { articles: [], vocabulary: [], notes: [] } }, seedState, new Date("2026-08-12T10:00:00.000Z"));
  const merged = mergeCloudState(local, {
    articles: [], vocabulary: [], notes: [], reviewEvents: [], plans: {},
    tombstones: { articles: [{ id: "a", deletedAt: "2026-08-12T11:00:00.000Z", updatedAt: "2026-08-12T11:00:00.000Z" }], vocabulary: [], notes: [] },
  });
  assert.equal(merged.state.articles.length, 0);
  assert.equal(merged.state.tombstones.articles.length, 1);
});

test("merges completed segments and contextual caches across devices", () => {
  const article = { ...seedState.articles[0], id: "reader-a", updatedAt: "2026-08-12T10:00:00.000Z" };
  const local = migrateState({ ...seedState, articles: [article] }, seedState, new Date("2026-08-12T10:00:00.000Z"));
  const [first, second] = local.articles[0].readerData.segments;
  local.articles[0].readerData = {
    ...local.articles[0].readerData,
    completedSegmentIds: [first.id],
    wordDetails: { [`${first.id}:context`]: { definition: "本地", updatedAt: "2026-08-12T10:00:00.000Z" } },
  };
  const cloudArticle = structuredClone(local.articles[0]);
  cloudArticle.readerData.completedSegmentIds = second ? [second.id] : [first.id];
  cloudArticle.readerData.translations = { [first.id]: { translation: "翻译", updatedAt: "2026-08-12T11:00:00.000Z" } };
  cloudArticle.readerData.updatedAt = "2026-08-12T11:00:00.000Z";
  cloudArticle.updatedAt = "2026-08-12T11:00:00.000Z";
  const merged = mergeCloudState(local, { articles: [cloudArticle], vocabulary: [], notes: [], reviewEvents: [], plans: {}, tombstones: { articles: [], vocabulary: [], notes: [] } });
  assert.ok(merged.state.articles[0].readerData.completedSegmentIds.includes(first.id));
  if (second) assert.ok(merged.state.articles[0].readerData.completedSegmentIds.includes(second.id));
  assert.equal(merged.state.articles[0].readerData.translations[first.id].translation, "翻译");
  assert.equal(merged.state.articles[0].readerData.wordDetails[`${first.id}:context`].definition, "本地");
});

test("keeps article progress when returning to an older focus segment", () => {
  const local = migrateState({ ...seedState, articles: [{ ...seedState.articles[0], progress: 70 }] }, seedState, new Date("2026-08-12T10:00:00.000Z"));
  const cloudArticle = structuredClone(local.articles[0]);
  cloudArticle.progress = 20;
  cloudArticle.readerData.freeProgress = 20;
  cloudArticle.readerData.currentSegmentId = cloudArticle.readerData.segments[0].id;
  cloudArticle.readerData.updatedAt = "2026-08-12T12:00:00.000Z";
  cloudArticle.updatedAt = "2026-08-12T12:00:00.000Z";
  const merged = mergeCloudState(local, { articles: [cloudArticle], vocabulary: [], notes: [], reviewEvents: [], plans: {}, tombstones: { articles: [], vocabulary: [], notes: [] } });
  assert.equal(merged.state.articles[0].progress, 70);
});
