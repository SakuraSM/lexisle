import { pb } from "./pocketbaseClient.js";

export const DEFAULT_AI_PROMPT = "识别对中级英语学习者较生僻、且对理解文章重要的词汇。优先选择能通过上下文学习的实词，避免人名、地名、数字和过于基础的词。";

function apiMessage(error, fallback) {
  if (error?.status === 401 || error?.status === 403) return "请先登录，再使用服务端 AI。";
  if (error?.status === 404) return "AI 代理服务尚未部署，请联系管理员。";
  return error?.response?.message || error?.message || fallback;
}

async function defaultSend(path, options) {
  if (!pb.authStore.isValid) throw Object.assign(new Error("请先登录，再使用服务端 AI。"), { status: 401 });
  return pb.send(path, options);
}

async function sendJson(path, method, body, sendImpl = defaultSend) {
  try {
    return await sendImpl(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(apiMessage(error, "服务端 AI 请求失败，请稍后重试。"));
  }
}

export async function loadAiProviderSettings(sendImpl = defaultSend) {
  return sendJson("/api/lexisle/ai/settings", "GET", undefined, sendImpl);
}

export async function saveAiProviderSettings(config, { apiKey = "", clearApiKey = false } = {}, sendImpl = defaultSend) {
  return sendJson("/api/lexisle/ai/settings", "PUT", {
    enabled: Boolean(config.enabled),
    endpoint: String(config.endpoint || "").trim(),
    model: String(config.model || "").trim(),
    maxWords: Math.min(30, Math.max(3, Number(config.maxWords) || 12)),
    prompt: String(config.prompt || "").trim(),
    apiKey: String(apiKey || "").trim(),
    clearApiKey: Boolean(clearApiKey),
  }, sendImpl);
}

async function callAi(operation, input, sendImpl = defaultSend) {
  const payload = await sendJson(`/api/lexisle/ai/${operation}`, "POST", input, sendImpl);
  if (payload && Object.hasOwn(payload, "data")) return payload.data;
  if (typeof payload?.content !== "string") throw new Error("服务端返回的模型响应不完整。");
  return payload.content;
}

function extractJson(content) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) return JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1));
  const parsed = JSON.parse(cleaned);
  return parsed.words || parsed.vocabulary || parsed.items || [];
}

function extractJsonObject(content) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回 JSON 对象。");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function validateAiVocabulary(items, articleText, limit = 18) {
  if (!Array.isArray(items)) throw new Error("模型没有返回词汇数组。");
  const text = articleText.toLowerCase();
  const seen = new Set();
  const result = [];
  for (const raw of items) {
    const word = String(raw.word || "").trim().toLowerCase();
    if (!word || seen.has(word) || !new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) continue;
    const definition = String(raw.definition || raw.definition_zh || raw.meaning || "").trim();
    if (!definition) continue;
    seen.add(word);
    result.push({
      word,
      phonetic: String(raw.phonetic || "").trim(),
      part: String(raw.part || raw.pos || "").trim(),
      definition,
      example: String(raw.example || raw.context || "").trim() || articleText.split(/(?<=[.!?])\s+/).find((sentence) => new RegExp(`\\b${word}\\b`, "i").test(sentence)) || "",
      reason: String(raw.reason || "AI 结合语境识别").trim(),
      source: "ai",
    });
    if (result.length >= limit) break;
  }
  if (!result.length) throw new Error("模型返回的词汇未通过原文校验。");
  return result;
}

export function validateSegmentTranslation(value) {
  const translation = String(value?.translation || "").trim();
  if (!translation) throw new Error("模型没有返回段落翻译。");
  return { translation };
}

function limitStrings(value, limit) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit) : [];
}

export function validateWordDetail(value, fallback) {
  const word = String(value?.word || fallback.word || "").trim().toLowerCase();
  const definition = String(value?.contextMeaning || value?.definition || "").trim();
  if (!word || !definition) throw new Error("模型返回的单词详情不完整。");
  return {
    word,
    lemma: String(value?.lemma || word).trim().toLowerCase(),
    phonetic: String(value?.phonetic || fallback.phonetic || "").trim(),
    part: String(value?.part || fallback.part || "").trim(),
    definition,
    contextMeaning: definition,
    contextExplanation: String(value?.contextExplanation || "").trim(),
    meanings: limitStrings(value?.meanings, 3),
    collocations: limitStrings(value?.collocations, 3),
    example: String(value?.example || fallback.sentence || "").trim(),
    memoryTip: String(value?.memoryTip || "").trim(),
    source: "ai",
  };
}

export async function translateReaderSegment(_config, segment, context = {}, sendImpl = defaultSend) {
  const response = await callAi("translate-segment", {
    segmentText: String(segment.text || "").slice(0, 5000),
    previous: String(context.previous || "").slice(0, 320),
    next: String(context.next || "").slice(0, 320),
  }, sendImpl);
  try {
    return validateSegmentTranslation(typeof response === "string" ? extractJsonObject(response) : response);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("模型返回的 JSON 无法解析，请重新生成。");
    throw error;
  }
}

export async function lookupWordWithAi(_config, word, sentence, segment, sendImpl = defaultSend) {
  const response = await callAi("lookup-word", {
    word: String(word || "").slice(0, 120),
    sentence: String(sentence || "").slice(0, 1200),
    segmentText: String(segment.text || "").slice(0, 5000),
  }, sendImpl);
  try {
    return validateWordDetail(typeof response === "string" ? extractJsonObject(response) : response, { word, sentence });
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("模型返回的 JSON 无法解析，请重新生成。");
    throw error;
  }
}

export async function analyzeVocabularyWithAi(config, articleText, sendImpl = defaultSend) {
  const response = await callAi("analyze-vocabulary", { articleText: String(articleText || "").slice(0, 24000) }, sendImpl);
  try {
    return validateAiVocabulary(typeof response === "string" ? extractJson(response) : response, articleText, config.maxWords);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("模型返回的 JSON 无法解析，已保留本地分析能力。");
    throw error;
  }
}

export async function testAiConnection(sendImpl = defaultSend) {
  await callAi("test", {}, sendImpl);
  return true;
}
