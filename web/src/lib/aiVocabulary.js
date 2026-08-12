const API_KEY_STORAGE = "lexisle:ai-api-key";

export const DEFAULT_AI_PROMPT = "识别对中级英语学习者较生僻、且对理解文章重要的词汇。优先选择能通过上下文学习的实词，避免人名、地名、数字和过于基础的词。";

export function readAiApiKey() {
  return window.localStorage.getItem(API_KEY_STORAGE) || window.sessionStorage.getItem(API_KEY_STORAGE) || "";
}

export function saveAiApiKey(value, remember) {
  window.localStorage.removeItem(API_KEY_STORAGE);
  window.sessionStorage.removeItem(API_KEY_STORAGE);
  if (!value) return;
  (remember ? window.localStorage : window.sessionStorage).setItem(API_KEY_STORAGE, value);
}

export function normalizeChatEndpoint(value) {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
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

function requestBody(config, articleText, testOnly) {
  const maxWords = Math.min(30, Math.max(3, Number(config.maxWords) || 12));
  return {
    model: config.model.trim(),
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "你是英语词汇学习专家。只输出 JSON 数组，不要 Markdown。数组项格式：{word, phonetic, part, definition, example, reason}。definition 使用简体中文；example 必须摘自原文；word 必须是原文中出现的单个英文单词。",
      },
      {
        role: "user",
        content: testOnly
          ? "返回一个空 JSON 数组 []，用于验证接口连通性。"
          : `${config.prompt || DEFAULT_AI_PROMPT}\n\n最多返回 ${maxWords} 个词。\n\n英文原文：\n${articleText.slice(0, 24000)}`,
      },
    ],
  };
}

async function callChat(config, apiKey, articleText, testOnly = false, fetchImpl = fetch) {
  if (!config.endpoint?.trim()) throw new Error("请填写模型接口地址。");
  if (!config.model?.trim()) throw new Error("请填写模型名称。");
  if (!apiKey?.trim()) throw new Error("请填写 API Key。");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetchImpl(normalizeChatEndpoint(config.endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify(requestBody(config, articleText, testOnly)),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `模型接口返回 ${response.status}`);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("模型响应缺少 choices[0].message.content。");
    return content;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("模型请求超时，请检查接口地址或网络。");
    if (error instanceof TypeError) throw new Error("无法连接模型接口，可能被浏览器跨域策略拦截。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callStructuredChat(config, apiKey, messages, fetchImpl = fetch) {
  if (!config.endpoint?.trim()) throw new Error("请填写模型接口地址。");
  if (!config.model?.trim()) throw new Error("请填写模型名称。");
  if (!apiKey?.trim()) throw new Error("请填写 API Key。");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetchImpl(normalizeChatEndpoint(config.endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify({ model: config.model.trim(), temperature: 0.2, messages }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `模型接口返回 ${response.status}`);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("模型响应缺少 choices[0].message.content。");
    return extractJsonObject(content);
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("模型请求超时，请稍后重试。");
    if (error instanceof TypeError) throw new Error("无法连接模型接口，可能被浏览器跨域策略拦截。");
    if (error instanceof SyntaxError) throw new Error("模型返回的 JSON 无法解析，请重新生成。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function validateSegmentTranslation(value) {
  const translation = String(value?.translation || "").trim();
  if (!translation) throw new Error("模型没有返回段落翻译。");
  return { translation };
}

export async function translateReaderSegment(config, segment, context = {}, apiKey = readAiApiKey(), fetchImpl = fetch) {
  const payload = await callStructuredChat(config, apiKey, [
    { role: "system", content: "你是英语阅读翻译助手。只输出 JSON 对象 {translation}。translation 使用简体中文，忠实、自然，不增加原文没有的信息。" },
    { role: "user", content: `相邻语境（仅用于消歧）：\n前文：${String(context.previous || "").slice(0, 320)}\n后文：${String(context.next || "").slice(0, 320)}\n\n请翻译当前段落：\n${segment.text.slice(0, 5000)}` },
  ], fetchImpl);
  return validateSegmentTranslation(payload);
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

export async function lookupWordWithAi(config, word, sentence, segment, apiKey = readAiApiKey(), fetchImpl = fetch) {
  const payload = await callStructuredChat(config, apiKey, [
    { role: "system", content: "你是英语词汇学习专家。只输出 JSON 对象，字段为 word, lemma, phonetic, part, contextMeaning, contextExplanation, meanings, collocations, example, memoryTip。中文解释使用简体中文；meanings 和 collocations 最多各 3 项；example 必须基于当前语境。" },
    { role: "user", content: `目标词：${word}\n所在句：${sentence.slice(0, 1200)}\n当前段落：${segment.text.slice(0, 5000)}` },
  ], fetchImpl);
  return validateWordDetail(payload, { word, sentence });
}

export async function analyzeVocabularyWithAi(config, articleText, apiKey = readAiApiKey(), fetchImpl = fetch) {
  const content = await callChat(config, apiKey, articleText, false, fetchImpl);
  return validateAiVocabulary(extractJson(content), articleText, config.maxWords);
}

export async function testAiConnection(config, apiKey = readAiApiKey(), fetchImpl = fetch) {
  await callChat(config, apiKey, "Connection test.", true, fetchImpl);
  return true;
}
