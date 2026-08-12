const WORD_PATTERN = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
const TARGET_MIN_WORDS = 60;
const TARGET_MAX_WORDS = 120;
const HARD_MAX_WORDS = 160;

function countWords(text) {
  return text.match(WORD_PATTERN)?.length || 0;
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [];
}

function splitOversizedSentence(sentence) {
  if (countWords(sentence) <= HARD_MAX_WORDS) return [sentence];
  const clauses = sentence.split(/(?<=[,;:])\s+/).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const clause of clauses) {
    if (current && countWords(`${current} ${clause}`) > HARD_MAX_WORDS) {
      chunks.push(current);
      current = clause;
    } else current = current ? `${current} ${clause}` : clause;
  }
  if (current) chunks.push(current);
  if (chunks.every((chunk) => countWords(chunk) <= HARD_MAX_WORDS)) return chunks;

  const words = sentence.split(/\s+/);
  return Array.from({ length: Math.ceil(words.length / HARD_MAX_WORDS) }, (_, index) => words.slice(index * HARD_MAX_WORDS, (index + 1) * HARD_MAX_WORDS).join(" "));
}

function buildSegment(text, index) {
  const normalized = text.trim();
  return {
    id: `segment-${index + 1}-${stableHash(normalized)}`,
    index,
    text: normalized,
    wordCount: countWords(normalized),
  };
}

export function segmentArticle(text) {
  if (!text?.trim()) return [];
  const sourceParagraphs = text.split(/\n\s*\n|\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const units = sourceParagraphs.flatMap((paragraph) => splitSentences(paragraph).flatMap(splitOversizedSentence));
  const segments = [];
  let current = "";

  for (const unit of units) {
    const combined = current ? `${current} ${unit}` : unit;
    const combinedCount = countWords(combined);
    if (current && countWords(current) >= TARGET_MIN_WORDS && combinedCount > TARGET_MAX_WORDS) {
      segments.push(current);
      current = unit;
    } else if (current && combinedCount > HARD_MAX_WORDS) {
      segments.push(current);
      current = unit;
    } else current = combined;
  }
  if (current) segments.push(current);

  if (segments.length > 1 && countWords(segments.at(-1)) < TARGET_MIN_WORDS) {
    const tail = segments.pop();
    const previous = segments.at(-1);
    if (countWords(`${previous} ${tail}`) <= HARD_MAX_WORDS) segments[segments.length - 1] = `${previous} ${tail}`;
    else segments.push(tail);
  }
  return segments.map(buildSegment);
}

export function createReaderData(article, existing = {}) {
  const segments = existing.segments?.length ? existing.segments : segmentArticle(article.text || "");
  const segmentIds = new Set(segments.map((segment) => segment.id));
  const completedSegmentIds = [...new Set(existing.completedSegmentIds || [])].filter((id) => segmentIds.has(id));
  const currentSegmentId = segmentIds.has(existing.currentSegmentId) ? existing.currentSegmentId : segments[0]?.id || "";
  return {
    mode: existing.mode === "focus" ? "focus" : "free",
    segments,
    currentSegmentId,
    completedSegmentIds,
    freeProgress: Math.max(0, Math.min(100, Number(existing.freeProgress ?? article.progress) || 0)),
    translations: existing.translations || {},
    wordDetails: existing.wordDetails || {},
    updatedAt: existing.updatedAt || article.updatedAt || article.createdAt || new Date().toISOString(),
  };
}

export function calculateReaderProgress(readerData) {
  const focusProgress = readerData.segments.length ? Math.round(readerData.completedSegmentIds.length / readerData.segments.length * 100) : 0;
  return Math.max(readerData.freeProgress || 0, focusProgress);
}

function mergeCache(localCache = {}, cloudCache = {}) {
  const merged = { ...localCache };
  for (const [key, cloudValue] of Object.entries(cloudCache)) {
    const localValue = merged[key];
    if (!localValue || Date.parse(cloudValue.updatedAt || 0) > Date.parse(localValue.updatedAt || 0)) merged[key] = cloudValue;
  }
  return merged;
}

export function mergeReaderData(localReader, cloudReader, article) {
  const local = createReaderData(article, localReader);
  const cloud = createReaderData(article, cloudReader);
  const cloudIsNewer = Date.parse(cloud.updatedAt || 0) > Date.parse(local.updatedAt || 0);
  const merged = createReaderData(article, {
    ...local,
    mode: cloudIsNewer ? cloud.mode : local.mode,
    currentSegmentId: cloudIsNewer ? cloud.currentSegmentId : local.currentSegmentId,
    completedSegmentIds: [...new Set([...local.completedSegmentIds, ...cloud.completedSegmentIds])],
    freeProgress: Math.max(local.freeProgress, cloud.freeProgress),
    translations: mergeCache(local.translations, cloud.translations),
    wordDetails: mergeCache(local.wordDetails, cloud.wordDetails),
    updatedAt: cloudIsNewer ? cloud.updatedAt : local.updatedAt,
  });
  return merged;
}

export function getWordCacheKey(segmentId, word) {
  return `${segmentId}:${word.toLowerCase()}`;
}

export function getSentenceForWord(segmentText, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return splitSentences(segmentText).find((sentence) => new RegExp(`\\b${escaped}\\b`, "i").test(sentence)) || segmentText;
}
