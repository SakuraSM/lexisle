import test from "node:test";
import assert from "node:assert/strict";
import { analyzeText, reviewWord } from "../src/lib/learning.js";

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
