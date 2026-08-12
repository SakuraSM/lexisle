import test from "node:test";
import assert from "node:assert/strict";
import { calculateReaderProgress, getWordCacheKey, segmentArticle } from "../src/lib/reader.js";

function sentence(word, count) {
  return `${Array.from({ length: count }, (_, index) => `${word}${index}`).join(" ")}.`;
}

test("returns no segments for empty text and normalizes unusual newlines", () => {
  assert.deepEqual(segmentArticle("  \n \n"), []);
  const segments = segmentArticle(`First short paragraph.\nSecond short paragraph.\n\nThird paragraph has context.`);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].text.includes("Second short paragraph."), true);
});

test("combines short sentences near the target range", () => {
  const segments = segmentArticle([sentence("alpha", 35), sentence("beta", 35), sentence("gamma", 70)].join(" "));
  assert.equal(segments.length, 2);
  assert.ok(segments[0].wordCount >= 60 && segments[0].wordCount <= 120);
  assert.ok(segments[1].wordCount <= 160);
});

test("splits oversized text at the hard limit", () => {
  const segments = segmentArticle(sentence("word", 340));
  assert.ok(segments.length >= 3);
  assert.ok(segments.every((segment) => segment.wordCount <= 160));
});

test("produces stable IDs and context-specific cache keys", () => {
  const text = `${sentence("stable", 70)} ${sentence("identity", 70)}`;
  assert.deepEqual(segmentArticle(text).map((item) => item.id), segmentArticle(text).map((item) => item.id));
  assert.notEqual(getWordCacheKey("segment-a", "Context"), getWordCacheKey("segment-b", "context"));
});

test("reader progress never drops below free reading progress", () => {
  assert.equal(calculateReaderProgress({ freeProgress: 80, segments: [{ id: "a" }, { id: "b" }], completedSegmentIds: ["a"] }), 80);
});
