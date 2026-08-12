import { lexicon } from "../data/seed.js";

const WORD_PATTERN = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
const COMMON = new Set("the a an and or but in on at to for of with is are was were be been being this that these those it its as by from when while during into than then their our your his her they we you i do does did have has had can could may might will would should not more most some any each other new years body main stage slow brain waves across operation recent study found which out proteins day system risk rise clear protecting mind cities grow wildlife shows remarkable animals adapt ways surprise us only small fraction ocean floor rising temperatures now create stress living researchers testing methods also requires reducing forces warm pollute".split(" "));

export function analyzeText(text) {
  const tokens = text.match(WORD_PATTERN) || [];
  const frequency = new Map();
  for (const raw of tokens) {
    const word = raw.toLowerCase();
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  const candidates = [];
  for (const [word, count] of frequency) {
    if (COMMON.has(word) || word.length < 6) continue;
    const known = lexicon[word];
    if (!known && word.length < 10) continue;
    const contextMatch = text.split(/(?<=[.!?])\s+/).find((sentence) => new RegExp(`\\b${word}\\b`, "i").test(sentence));
    candidates.push({
      word,
      count,
      phonetic: known?.phonetic || "",
      part: known?.part || "",
      definition: known?.definition || "结合上下文理解；建议在阅读中确认具体含义",
      example: contextMatch || known?.example || "",
      score: (known ? 20 : 0) + word.length - count,
    });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 18);
}

export function reviewWord(item, result, now = new Date()) {
  const quality = { again: 1, hard: 3, good: 4, easy: 5 }[result] ?? 4;
  let repetition = item.repetition || 0;
  let intervalDays = item.intervalDays || 1;
  let easeFactor = item.easeFactor || 2.5;

  if (quality < 3) {
    repetition = 0;
    intervalDays = 1;
  } else {
    repetition += 1;
    if (repetition === 1) intervalDays = 1;
    else if (repetition === 2) intervalDays = 3;
    else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor * (result === "easy" ? 1.3 : result === "hard" ? 0.8 : 1)));
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  }

  const next = new Date(now);
  next.setDate(next.getDate() + intervalDays);
  return {
    ...item,
    repetition,
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    nextReviewAt: next.toISOString(),
    status: repetition >= 6 ? "mastered" : repetition >= 2 ? "review" : "learning",
  };
}

export function speak(text) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function isDue(item, now = new Date()) {
  return new Date(item.nextReviewAt).getTime() <= now.getTime();
}

export function formatDue(value) {
  const diff = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
  if (diff <= 0) return "现在";
  if (diff === 1) return "明天";
  return `${diff} 天后`;
}
